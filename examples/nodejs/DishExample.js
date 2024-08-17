// A Simple Simulation of dishes that must be pre-rinsed, washed, rinsed and dried.

const NodeSim = require('./NodeSim.js').NodeSim;
const SimEntity = require('./NodeSim.js').SimEntity;

const nodeSim = new NodeSim(true);
var dishLogging = true;
const preRinsers = nodeSim.createResource(2);
const washers = nodeSim.createResource(4);
const rinsers = nodeSim.createResource(2);
const driers = nodeSim.createResource(3);

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
			console.log(nodeSim.getTime() + ": " + this.dishType + " nr. " + this.nr + " " + message);
		}
	}

	async run() {
		let release = await nodeSim.waitForResource(preRinsers);
		this.log("is being pre-prinsed");
		await nodeSim.advance(1);
		release();
		release = await nodeSim.waitForResource(washers);
		this.log("is being washed.");
		if (this.dishType == Dish.Type.Glass && this.nr % 10 == 1) {
			// This branch demonstrates how new SimEntities can be added into the running simulation. 
			await nodeSim.advance(0.4);
			this.log("while being washed, the dish washer found out, that there was another glass inside.")
			let newGlass = new Dish(Dish.Type.Glass, this.nr + "(new)", false)
			newGlass.log("is added to the beginning of the washing pipeline.")
			nodeSim.addSimEntity(newGlass);
		}
		await nodeSim.advance(5);
		release();
		release = await nodeSim.waitForResource(rinsers);
		this.log("is being rinsed.");
		await nodeSim.advance(1);
		release();
		release = await nodeSim.waitForResource(driers);
		this.log("is being dried.");
		if (this.hiddenDirt) {
			await nodeSim.advance(1.2);
			release();
			release = await nodeSim.waitForResource(washers);
			this.log("is being washed again because the drier found some hidden dirt.");
			await nodeSim.advance(3);
			release();
			release = await nodeSim.waitForResource(rinsers);
			this.log("is being rinsed again after the hidden dirt had been washed off.");
			await nodeSim.advance(1);
			release();
			release = await nodeSim.waitForResource(driers);
			this.log("is being dried again after the hidden dirt had been rinsed.");
		}
		await nodeSim.advance(this.dishType == Dish.Type.Plate ? 2 : 3); // glasses take longer to dry.
		release();
		this.log("is completely clean.");
	};
}

let realTimePreparation = new Date();
for (let i = 1; i <= 15; i++) {
	nodeSim.addSimEntity(new Dish(Dish.Type.Plate, i, i % 7 == 0));
	nodeSim.addSimEntity(new Dish(Dish.Type.Glass, i, i % 5 == 2));
}
let realTimeStart = new Date();
let preparationDuration = (realTimeStart - realTimePreparation) / 1000;
console.log("preparation duration: " + preparationDuration + "s");

nodeSim.run().then(() => {
	let realTimeEnd = new Date();
	let simulationRuntime = (realTimeEnd - realTimeStart) / 1000;
	let totalDuration = preparationDuration + simulationRuntime
	console.log("Finished at simulated time: " + nodeSim.getTime() + " after " + simulationRuntime + " real seconds.");
	console.log("Total duration: " + totalDuration);
});
