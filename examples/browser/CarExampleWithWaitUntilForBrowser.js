// The same as the CarExample.js but it uses 'waitUntil' instead of 'waitForResource'.

const nodeSim = new SimLuxJS(true);
let maut = nodeSim.createControlVariable(0); // Counts the cars paying the maut.
let lunch = nodeSim.createControlVariable(false); // Counts the cars paying the maut.

function isMautFree(carCount) {
    return carCount == 0;
}
function isMautWorking(isLunchTime) {
    return !isLunchTime;
}

async function car(carid, parktime, drivetime, mauttime) {
    await nodeSim.advance(parktime);
    console.log("Car " + carid + " Driving at " + nodeSim.getTime());
    await nodeSim.advance(drivetime);
    console.log("Car " + carid + " at MAUT station at " + nodeSim.getTime());
    await maut.waitUntil(isMautFree);
    maut.setValue(maut.getValue() + 1);
    await lunch.waitUntil(isMautWorking);
    // Charge the maut fee
    console.log("Car " + carid + "# charge maut at " + nodeSim.getTime());
    await nodeSim.advance(mauttime);
    console.log("Car " + carid + "# leaving maut st. " + nodeSim.getTime());
    await maut.setValue(maut.getValue() - 1)
    console.log("Car " + carid + " Driving again at " + nodeSim.getTime());
};

// This demonstrates another possible usage of 'waitUntil'.
async function mautChecker(interval, endTime) {
    while(nodeSim.getTime() < endTime) {
        await maut.waitUntil(cars => cars > 0, interval);
        if (maut.getValue() > 0) {
            console.log("The maut station finally has something to do at " + nodeSim.getTime());
            await maut.waitUntil(isMautFree, endTime - nodeSim.getTime());
        } else {
            console.log("No new car has come to the maut station for some time at " + nodeSim.getTime());
        }
    }
    console.log("The maut checker quits at " + nodeSim.getTime());
}

async function mautWorkingTimeHandler(pauseStart, pauseLength) {
    await nodeSim.advance(pauseStart);
    lunch.setValue(true);
    console.log("Lunch break! No new car may be handled by the maut station at " + nodeSim.getTime())
    await nodeSim.advance(pauseLength)
    lunch.setValue(false);
    console.log("The lunch break is over. The maut station is open again at " + nodeSim.getTime())
}

nodeSim.addSimEntity(new SimEntity(SimEntity => car(1, 3, 6, 1)));
nodeSim.addSimEntity(new SimEntity(SimEntity => car(2, 2, 7, 1)));
nodeSim.addSimEntity(new SimEntity(SimEntity => car(3, 1, 8, 1)));

nodeSim.addSimEntity(new SimEntity(async SimEntity => mautChecker(4, 15)));
nodeSim.addSimEntity(new SimEntity(async SimEntity => mautWorkingTimeHandler(10, 0.5)));

nodeSim.run(11.5).then(() => {
    console.log("Simulation step 1 finished.")
    nodeSim.run().then(() => {
		console.log("Simulation finished.")
	});
});