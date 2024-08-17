// The same as the CarExample.js but it uses 'waitUntil' instead of 'waitForResource'.

const SimLuxJS = require('../../SimLuxJS.js').SimLuxJS; 
const SimEntity = require('../../SimLuxJS.js').SimEntity;  

const sim = new SimLuxJS(true);
let maut = sim.createControlVariable(0); // Counts the cars paying the maut.
let lunch = sim.createControlVariable(false); // Counts the cars paying the maut.

function isMautFree(carsCharging) {
    return carsCharging == 0;
}
function isMautWorking(isLunchTime) {
    return !isLunchTime;
}

async function car(carid, parktime, drivetime, mauttime) {
    await sim.advance(parktime);
    console.log("Car " + carid + " Driving at " + sim.getTime());
    await sim.advance(drivetime);
    console.log("Car " + carid + " at MAUT station at " + sim.getTime());
    await maut.waitUntil(isMautFree);
    maut.setValue(maut.getValue() + 1);
    //await lunch.waitUntil(isMautWorking);
    // Charge the maut fee
    console.log("Car " + carid + "# charge maut at " + sim.getTime());
    await sim.advance(mauttime);
    console.log("Car " + carid + "# leaving maut st. " + sim.getTime());
    await maut.setValue(maut.getValue() - 1)
    console.log("Car " + carid + " Driving again at " + sim.getTime());
};

// This demonstrates another possible usage of 'waitUntil'.
async function mautChecker(interval, endTime) {
    while(sim.getTime() < endTime) {
        await maut.waitUntil(cars => cars > 0, interval);
        if (maut.getValue() > 0) {
            console.log("The maut station finally has something to do at " + sim.getTime());
            await maut.waitUntil(isMautFree, endTime - sim.getTime());
        } else {
            console.log("No new car has come to the maut station for some time at " + sim.getTime());
        }
    }
    console.log("The maut checker quits at " + sim.getTime());
}

async function mautWorkingTimeHandler(pauseStart, pauseLength) {
    await sim.advance(pauseStart);
    lunch.setValue(true);
    console.log("Lunch break! No new car may be handled by the maut station at " + sim.getTime())
    await sim.advance(pauseLength)
    lunch.setValue(false);
    console.log("The lunch break is over. The maut station is open again at " + sim.getTime())
}

sim.addSimEntity(new SimEntity(s => car(1, 3, 6, 1)));
sim.addSimEntity(new SimEntity(s => car(2, 2, 7, 1)));
sim.addSimEntity(new SimEntity(s => car(3, 1, 8, 1)));

//sim.addSimEntity(new SimEntity(async s => mautChecker(4, 15)));
//sim.addSimEntity(new SimEntity(async s => mautWorkingTimeHandler(10, 0.5)));

sim.run(11).catch(e => {
	console.error(e);
}).then(finished => {
    console.log("Simulation step 1 finished. Finished completely? " + finished)
    sim.run().then();
});