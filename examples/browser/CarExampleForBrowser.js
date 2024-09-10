// The car example from the SimPy/Sim# lecture.  

const nodeSim = new SimLuxJS();
const maut = nodeSim.createResource(1);

async function car(carid, parktime, drivetime, mauttime) {
    await nodeSim.advance(parktime);
    console.log("Car " + carid + " Driving at " + nodeSim.getTime());
    await nodeSim.advance(drivetime);
    console.log("Car " + carid + " at MAUT station at " + nodeSim.getTime());
    let releaseMaut = await nodeSim.waitForResource(maut);
    // Charge the maut fee
    console.log("Car " + carid + "# charge maut at " + nodeSim.getTime());
    await nodeSim.advance(mauttime);
    console.log("Car " + carid + "# leaving maut st. " + nodeSim.getTime());
    releaseMaut();
    console.log("Car " + carid + " Driving again at " + nodeSim.getTime());
};
   
nodeSim.addSimEntity(new SimEntity(SimEntity => car(1, 3, 6, 1)));
nodeSim.addSimEntity(new SimEntity(SimEntity => car(2, 2, 7, 1)));
nodeSim.addSimEntity(new SimEntity(SimEntity => car(3, 1, 8, 1)));
nodeSim.run().then(() => {
    console.log("fertig!");
});