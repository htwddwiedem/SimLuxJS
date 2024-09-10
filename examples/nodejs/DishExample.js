// A Simple Simulation of dishes that must be pre-rinsed, washed, rinsed and dried.

const {SimLuxJS, SimEntity} = require('../../SimLuxJS.js');

const sim = new SimLuxJS(true);
var dishLogging = true;
const preRinsers = sim.createResource(2);
const washers = sim.createResource(4);
const rinsers = sim.createResource(2);
const driers = sim.createResource(3);

class Dish extends SimEntity {
	static Type = {
		Plate: "Plate",
		Glass: "Glass",
	}

	constructor(dishType, nr, hiddenDirt) {
		super();
		this.dishType = dishType;
		this.nr = nr;
		this.hiddenDirt = hiddenDirt;
	}

	log(message) {
		if (dishLogging) {
			console.log(sim.getTime() + ": " + this.dishType + " nr. " + this.nr + " " + message);
		}
	}

	async run() {
		let release = await sim.waitForResource(preRinsers);
		this.log("is being pre-prinsed");
		await sim.advance(1);
		release();
		release = await sim.waitForResource(washers);
		this.log("is being washed.");
		if (this.dishType == Dish.Type.Glass && this.nr % 10 == 1) {
			// This branch demonstrates how new SimEntities can be added into the running simulation. 
			await sim.advance(0.4);
			this.log("while being washed, the dish washer found out, that there was another glass inside.")
			let newGlass = new Dish(Dish.Type.Glass, this.nr + "(new)", false)
			newGlass.log("is added to the beginning of the washing pipeline.")
			sim.addSimEntity(newGlass);
		}
		await sim.advance(5);
		release();
		release = await sim.waitForResource(rinsers);
		this.log("is being rinsed.");
		await sim.advance(1);
		release();
		release = await sim.waitForResource(driers);
		this.log("is being dried.");
		if (this.hiddenDirt) {
			await sim.advance(1.2);
			release();
			release = await sim.waitForResource(washers);
			this.log("is being washed again because the drier found some hidden dirt.");
			await sim.advance(3);
			release();
			release = await sim.waitForResource(rinsers);
			this.log("is being rinsed again after the hidden dirt had been washed off.");
			await sim.advance(1);
			release();
			release = await sim.waitForResource(driers);
			this.log("is being dried again after the hidden dirt had been rinsed.");
		}
		await sim.advance(this.dishType == Dish.Type.Plate ? 2 : 3); // glasses take longer to dry.
		release();
		this.log("is completely clean.");
	};
}

let realTimePreparation = new Date();
for (let i = 1; i <= 15; i++) {
	sim.addSimEntity(new Dish(Dish.Type.Plate, i, i % 7 == 0));
	sim.addSimEntity(new Dish(Dish.Type.Glass, i, i % 5 == 2));
}
let realTimeStart = new Date();
let preparationDuration = (realTimeStart - realTimePreparation) / 1000;
console.log("preparation duration: " + preparationDuration + "s");

sim.run().then(() => {
	let realTimeEnd = new Date();
	let simulationRuntime = (realTimeEnd - realTimeStart) / 1000;
	let totalDuration = preparationDuration + simulationRuntime
	console.log("Finished at simulated time: " + sim.getTime() + " after " + simulationRuntime + " real seconds.");
	console.log("Total duration: " + totalDuration);
});
