// ***************************************************************************************
// *  © 2023 Michael Danzig
// *  All Rights Reserved.
// *
// *  This module serves the purpose to run Simulations on JavaScript in a similar way to
// *  SLX or SimPy/Sim#.
// ***************************************************************************************

/**
 * The main functionality of the Simulation is happening here.
 */
class SimLuxJS {
    /**
     * A list of SimEntities which have recently been added but not started yet.
     */
    #newSimEntities = [];
    /**
     * This serves the purpose to make the main simulation loop wait for all SimEntities to stop
     * before advancing in time or ending. Its value counts how many SimEntities have stopped already.
     */
    #simulationSemaphore;

    /**
     * The current simulation time. It increases when the awaited time given in 'advance' 
     * or the timeout in 'waitForResource' is the next planned event to handle.
     */
    #time = 0;
    /**
     * The list of all WaitingListEntries which have a awaitedTime. These may also be additionally contained in the conditionMap.
     */
    #waitingList = [];
    /**
     * This contains a map of conditions and their WaitingListEntries.
     */
    #controlVariableConditionMap = new Map();
    /**
     * This prevents unnecessary sortings of the waiting list.
     */
    #waitingListIsSorted = true;
    /**
     * The waiting list entry which the simulation stopped for, because its awaited time lies after the desired simulation stop time.
     * This is only defined when the simulation is stopping or resuming after a stop.
     */
    #breakPointEntry = undefined;
    /**
     * An indicator that 'waitForResource' successfully acquired a resource recently. This proves that at least one SimEntity
     * is still running and prevents the simulation from ending.
     */
    #continueingAfterResourceAquisition = false;

    enableLogging;
    /**
     * An optional time at which the simulation stops.
     */
    stopTime = undefined;

    constructor(enableLogging=false) {
        this.enableLogging = enableLogging;
    }

    #logIfEnabled(text) {
        if (this.enableLogging) {
            console.log("Simulation: " + text);
        }
    }
    
    async #startSimEntity(SimEntity) {
        await SimEntity.run();
        this.#simulationSemaphore.release(1);
    }

    async advance(waitingTime) {
        const awaitedTime = this.#time + waitingTime;
 
        // The following code adds the calling SimEntity to the waiting list. Conditional entries are treated separately.
        let entry = this.#waitingList.find(entry => entry.awaitedTime == awaitedTime && entry.condition === undefined);
        if (entry === undefined) { 
            entry = new WaitingListEntry(undefined, awaitedTime);
            this.#waitingListIsSorted = false;
            this.#waitingList.push(entry);
        } else {
            entry.waitingSimEntities++; 
        }

        this.#simulationSemaphore.release(1); // Counts the calling SimEntity as waiting.
        await entry.mutex.waitForUnlock();
    }

    /**
     * Advances to the time of the given WaitingListEntry or the simulation stop time, whichever comes first.
     * @param targetEntry A WaitingListEntry which must have an awaitedTime to which the simulation shall advance. 
     * @returns True, if the given target time has been reached. False if the stop time has been reached.
     */
    #advanceToEntry(targetEntry) {
        const targetTime = targetEntry.awaitedTime
        let canAdvanceToTargetTime = this.stopTime === undefined || targetTime < this.stopTime;
        this.#setTime(canAdvanceToTargetTime ? targetTime : this.stopTime);
        return canAdvanceToTargetTime;
    }

    /**
     * This method performs the required steps after the awaited time of the given waiting list entry has been reached.
     * This is supposed to be called after 'advanceToTime' returned successfully.
     * @param {WaitingListEntry} entry The waiting list entry which has been reached.
     */
    async #continueWithWLEntry(entry) {
        this.#simulationSemaphore = new Semaphore(0); // Discards the old semaphore and creates a new one.
        entry.mutex.release(); // Lets all waiting SimEntities continue their work.

        // Removes this entry from the controlVariableConditionMap if needed.
        if (entry.condition !== undefined) {
            for (let [controlVariable, mapWithUpdateNote] of this.#controlVariableConditionMap.entries()) {
                let entryQueue = mapWithUpdateNote.conditionEntryMap.get(entry.condition);
                if (entryQueue !== undefined) {
                    let indexToDelete = entryQueue.indexOf(entry);
                    if (indexToDelete > -1) {
                        entryQueue.splice(indexToDelete, 1);
                        if (entryQueue.length == 0) {
                            mapWithUpdateNote.conditionEntryMap.delete(entry.condition);
                            if (mapWithUpdateNote.size == 0) {
                                this.#controlVariableConditionMap.delete(controlVariable);
                            }
                        }
                    }
                    break;
                }
            }
        }

        this.#logIfEnabled(entry.waitingSimEntities + " SimEntities are resuming.");
        await this.#simulationSemaphore.acquire(entry.waitingSimEntities); // Waits for all SimEntities to stop.
    }

    #setTime(newTime) {
        if (newTime != this.#time) {
            this.#time = newTime;
            this.#logIfEnabled("Time has advanced to " + this.#time + ".");
        }
    }

    /**
     * Waits until the given resource has enough free capacities and reserves these.
     * @param resource A resource which has been created by 'createResource'.
     * @param {Number} weight The amount of resources to reserve before continueing.
     * @returns A parameterless release function which must be called to release the resource.
     */
    async waitForResource(resource, weight=1) {
        // This counts the current SimEntity as waiting. With this information the simulation is free
        // to advance in time in order for another advancing SimEntity to release the resource.
        this.#simulationSemaphore.release(1);

        let [value, release] = await resource.acquire(weight);

        // This line notifies the simulation main loop that something is happening and prevents
        // it from ending or advancing too early.
        this.#continueingAfterResourceAquisition = true;

        // This counts the current SimEntity as running again.
        this.#simulationSemaphore.acquire(1);
        return release;
    }

    /**
     * Waits until the given condition is true or until the given timeout is reached.
     * This is executed when a SimEntity calls 'waitUntil' on a ControlVariable.
     */
    async #waitUntil(controlVariable, conditionFunction, timeout) {
        let mapWithUpdateNote = this.#controlVariableConditionMap.get(controlVariable);
        
        /* The idea behind this commented out block is to prevent unnecessary delays to the calling SimEntity.
        Unfortunately, this does not work, because the 'await' which is supposed to be used in combination with
        'waitUntil' temporarily stops the calling SimEntity anyway by putting its thread to the end of the
        event queue even if the condition is true. Instead, this block ruins the condition check of some calling
        SimEntities in some szenarios.

        // If this conditionFunction is new and true, then there is no need to wait at all.
        if ((mapWithUpdateNote === undefined || !mapWithUpdateNote.conditionEntryMap.has(conditionFunction)) && conditionFunction(controlVariable.getValue())) {
            return;
        }
        // Otherwise the waiting SimEntities are handled on a first come, first serve basis.
        */

        // The following code block adds a new WaitingListEntry at the proper place in the maps.
        if (mapWithUpdateNote === undefined) {
            mapWithUpdateNote = new MapWithUpdateNote();
        }
        let entryQueue = mapWithUpdateNote.conditionEntryMap.get(conditionFunction);
        if (entryQueue === undefined) {
            entryQueue = [];
            // This causes all conditions to be checked again.
            mapWithUpdateNote.recentlyUpdated = true;
        }
        let entry = new WaitingListEntry(conditionFunction, timeout !== undefined ? this.#time + timeout : undefined);
        entryQueue.push(entry);
        mapWithUpdateNote.conditionEntryMap.set(conditionFunction, entryQueue);
        this.#controlVariableConditionMap.set(controlVariable, mapWithUpdateNote);

        // In case of a timeout, this entry is additionally added to the ordinary waitingList.
        // Another entry with the same awaitedTime might exist but they are treaded separately.
        if (entry.awaitedTime !== undefined) {
            this.#waitingListIsSorted = false;
            this.#waitingList.push(entry);
        }

        this.#simulationSemaphore.release(1); // Counts the calling SimEntity as waiting.
        await entry.mutex.acquire();
        this.#simulationSemaphore.acquire(1); // Counts the calling SimEntity as running.
    }

    #onControlVariableValueUpdate(controlVariable) {
        let mapWithUpdateNote = this.#controlVariableConditionMap.get(controlVariable);
        if (mapWithUpdateNote !== undefined) {
            mapWithUpdateNote.recentlyUpdated = true;
        }
    }

    getTime() {
        return this.#time;
    }

    addSimEntity(SimEntity) {
        this.#newSimEntities.push(SimEntity);
    }

    createResource(capacity) {
        return new Semaphore(capacity);
    }

    /**
     * Creates and returns a variable that can be used to call 'waitUntil' on. The conditions given in 'waitUntil'
     * are evaluated whenever 'setValue' is used.
     * @param {any} value
     */
    createControlVariable(value=undefined) {
        return new ControlVariable(
            (controlVariable, condition, timeout) => this.#waitUntil(controlVariable, condition, timeout),
            (controlVariable) => this.#onControlVariableValueUpdate(controlVariable),
            value);
    }

    /**
     * Runs the whole simulation. If this simulation is paused because the given stop time is reached,
     * then it can be continued with this method too.
     * @param {number} until An optional simulation time at which to pause.
     * @returns true if run to completion or false if paused.
     */
    async run(until=undefined) {
        this.stopTime = until;

        // The following block checks handles the case that the simulation continues after a stop.
        if (this.#breakPointEntry !== undefined) {
            if (!this.#advanceToEntry(this.#breakPointEntry)) {
                this.#logIfEnabled("Cannot continue because the stop time " + this.stopTime + " lies before or at the next event time " + this.#breakPointEntry.awaitedTime + ".");
                return false;
            }
            await this.#continueWithWLEntry(this.#breakPointEntry);
            this.#breakPointEntry = undefined;
        }

        let somethingHappened;
        do {
            somethingHappened = false;

            // The following block handles the case that SimEntities have recently acquired a ressource.
            // This means that this simulation loop continues although there are still SimEntities
            if (this.#continueingAfterResourceAquisition) {
                // this.#logIfEnabled("Waiting for the SimEntities which recently acquired a resource.")
                this.#continueingAfterResourceAquisition = false;
                
                // This line is the actual handling for this case. It prevents the simulation from ending
                // and allows the SimEntities to continue their work.
                await setTimeout(f => {}, 0);
                somethingHappened = true;
                continue;
            }
            
            for (const [controlVariable, mapWithUpdateNote] of this.#controlVariableConditionMap.entries()) {
                // These four lines of code prevent redundant condition checks.
                if (!mapWithUpdateNote.recentlyUpdated || mapWithUpdateNote.size == 0) {
                    continue;
                }
                mapWithUpdateNote.recentlyUpdated = false;

                // This loop releases the lock which was created by 'waitUntil' if the corresponding condition is true.
                // Each distinct condition is only checked as often as needed.
                for (const [condition, entryQueue] of mapWithUpdateNote.conditionEntryMap.entries()) {
                    while(entryQueue.length > 0 && condition(controlVariable.getValue())) {
                        let entry = entryQueue.shift();
                        this.#simulationSemaphore = new Semaphore(0);
                        // In the current implementation entry.waitingSimEntities == 1.
                        this.#logIfEnabled(entry.waitingSimEntities + " SimEntity is resuming because its awaited condition became true.");
                        entry.mutex.release();
    
                        // Removes this entry from the waitingList if contained.
                        if (entry.awaitedTime !== undefined) {
                            const index = this.#waitingList.indexOf(entry);
                            if (index > -1) {
                                this.#waitingList.splice(index, 1);
                            }
                        }
    
                        // The truth of the condition may change when waiting SimEntities are freed and must be reevaluated.
                        //this.#logIfEnabled("Waiting for " + entry.waitingSimEntities + " SimEntity to stop.");
                        await this.#simulationSemaphore.acquire(entry.waitingSimEntities.length);
                    }
                    if (entryQueue.length == 0) {
                        mapWithUpdateNote.conditionEntryMap.delete(condition);
                    }
                }

                if (mapWithUpdateNote.size == 0) {
                    this.#controlVariableConditionMap.delete(controlVariable)
                }
                somethingHappened = true;
            }
            if (somethingHappened) {
                continue;
            }
            
            // This block starts new SimEntities which have recently been added by 'addSimEntity' and waits for them to stop.
            if (this.#newSimEntities.length > 0) {
                let runningSimEntitys = this.#newSimEntities;
                this.#newSimEntities = [];
                this.#logIfEnabled("Starting " + runningSimEntitys.length + " new SimEntitys.");

                // The simulation semaphore is prepared for the bulk of new SimEntities. 
                // The previous semaphore has served its purpose and is discarded.
                this.#simulationSemaphore = new Semaphore(0);
                
                // This line start all new SimEntities.
                runningSimEntitys.forEach(SimEntity => this.#startSimEntity(SimEntity));
                
                // this.#logIfEnabled("Waiting for " + runningSimEntitys.length + " SimEntitys to stop.");
                await this.#simulationSemaphore.acquire(runningSimEntitys.length);
                somethingHappened = true;
                continue;
            }

            if (this.#waitingList.length > 0) {
                if (!this.#waitingListIsSorted) {
                    this.#waitingList = this.#waitingList.sort((e1, e2) => e2.awaitedTime - e1.awaitedTime);
                    this.#waitingListIsSorted = true;
                }
                let nextEntry = this.#waitingList.pop();
                somethingHappened = true;
                if (!this.#advanceToEntry(nextEntry)) {
                    this.#breakPointEntry = nextEntry;
                    this.#logIfEnabled("The simulation pauses, because the desired stop time is reached.");
                    return false;
                }
                await this.#continueWithWLEntry(nextEntry);
            }
        } while (somethingHappened);
        this.#logIfEnabled("Nothing is happening anymore -> the simulation ends.");
        return true;
    }
}

class SimEntity {
    runFunction

    run() {
        return this.runFunction(this);
    }

    constructor(runFunction = () => { console.info("This SimEntity is doing nothing. Override SimEntity.run or give the SimEntity's constructor a meaningful function to call."); }) {
        this.runFunction = runFunction;
    }
}

/**
 * An entry in the NodeSim's waitingList or a conditional entry queue. Either a condition or an awaitedTime must be given.
 */
class WaitingListEntry {
    waitingSimEntities = 1;
    mutex = new Mutex();
    condition;
    awaitedTime;
    
    constructor(condition, awaitedTime) {
        this.condition = condition;
        this.awaitedTime = awaitedTime;
        this.mutex.acquire();
    }
}

class MapWithUpdateNote {
    conditionEntryMap = new Map();
    recentlyUpdated;
}

/**
 * A control variable that can be used to call 'waitUntil' on. The conditions given in 'waitUntil'
 * are evaluated whenever 'setValue' is used.
 * @param {any} value
 */
class ControlVariable {
    // These functions are stored here to keep the corresponding NodeSim's methods private.
    #waitUntilFunction; 
    #newValueFunction;
    #value;

    constructor(waitUntilFunction, newValueFunction, value) {
        this.#waitUntilFunction = waitUntilFunction;
        this.#newValueFunction = newValueFunction;
        this.#value = value;
    }

    getValue() {
        return this.#value;
    }

    async setValue(value) {
        this.#value = value;
        this.#newValueFunction(this);
    }

    /**
     * Waits until the given condition is true or until the given timeout is reached.
     * @param {function(() => boolean)} conditionFunction 
     * @param {Number} timeout An optional maximum timespan to wait given in simulation time units.
     */
    async waitUntil(condition, timeout=undefined) {
        await this.#waitUntilFunction(this, condition, timeout);
    }
}