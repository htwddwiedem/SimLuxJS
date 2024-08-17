// The car example from the SimPy/Sim# lecture.  

const SimLuxJS = require('../../SimLuxJS.js').SimLuxJS; 
const SimEntity = require('../../SimLuxJS.js').SimEntity;  

const sim = new SimLuxJS(true);
const maut = sim.createResource(1);

async function car(carid, parktime, drivetime, mauttime) {
    await sim.advance(parktime);
    console.log("Car " + carid + " Driving at " + sim.getTime());
    await sim.advance(drivetime);
    console.log("Car " + carid + " at MAUT station at " + sim.getTime());
    let releaseMaut = await sim.waitForResource(maut);
    // Charge the maut fee
    console.log("Car " + carid + "# charge maut at " + sim.getTime());
    await sim.advance(mauttime);
    console.log("Car " + carid + "# leaving maut st. " + sim.getTime());
    releaseMaut();
    console.log("Car " + carid + " Driving again at " + sim.getTime());
};
   
sim.addSimEntity(new SimEntity(s => car(1, 3, 6, 1)));
sim.addSimEntity(new SimEntity(s => car(2, 2, 7, 1)));
sim.addSimEntity(new SimEntity(s => car(3, 1, 8, 1)));
sim.run().then(() => {
    console.log("fertig!");
});