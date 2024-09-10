// Same idea as in examples/DishExample.js, but changed for performance tests.
const {SimLuxJS, SimEntity} = require('../../SimLuxJS.js');

class DishExampleSimulation {
	constructor(n, preRinsers, washers, rinsers, driers, enableLogging) {
		this.dishLogging = enableLogging;
		this.simLuxJS = new SimLuxJS();
		this.preRinsers = this.simLuxJS.createResource(preRinsers);
		this.washers = this.simLuxJS.createResource(washers);
		this.rinsers = this.simLuxJS.createResource(rinsers);
		this.driers = this.simLuxJS.createResource(driers);
		
		let nHalf = n / 2;
		for (let i = 1; i <= nHalf + 1; i++) {
			this.simLuxJS.addSimEntity(new Dish(this, Dish.Type.Plate, i, i % 7 == 0));
			this.simLuxJS.addSimEntity(new Dish(this, Dish.Type.Glass, i, i % 5 == 2));
		}
    }

	async run() {
		await this.simLuxJS.run();
	}
}

class Dish extends SimEntity {
	static Type = {
		Plate: "Plate",
		Glass: "Glass",
	}

	constructor(dishExampleSimulation, dishType, nr, hiddenDirt) {
		super();
		this.deSim = dishExampleSimulation;
		this.dishType = dishType;
		this.nr = nr;
		this.hiddenDirt = hiddenDirt;
	}

	log(message) {
		if (this.deSim.dishLogging) {
			console.log(this.deSim.simLuxJS.getTime() + ": " + this.dishType + " nr. " + this.nr + " " + message);
		}
	}

	async run() {
		let deSim = this.deSim;
		let simLuxJS = deSim.simLuxJS;
		let release = await simLuxJS.waitForResource(deSim.preRinsers);
		this.log("is being pre-prinsed");
		await simLuxJS.advance(1);
		release();
		release = await simLuxJS.waitForResource(deSim.washers);
		this.log("is being washed.");
		if (this.dishType == Dish.Type.Glass && this.nr % 10 == 1) {
			// This branch demonstrates how new SimEntities can be added into the running simulation. 
			await simLuxJS.advance(0.4);
			this.log("while being washed, the dish washer found out, that there was another glass inside.")
			let newGlass = new Dish(deSim, Dish.Type.Glass, this.nr + "(new)", false)
			newGlass.log("is added to the beginning of the washing pipeline.")
			simLuxJS.addSimEntity(newGlass);
		}
		await simLuxJS.advance(5);
		release();
		release = await simLuxJS.waitForResource(deSim.rinsers);
		this.log("is being rinsed.");
		await simLuxJS.advance(1);
		release();
		release = await simLuxJS.waitForResource(deSim.driers);
		this.log("is being dried.");
		if (this.hiddenDirt) {
			await simLuxJS.advance(1.2);
			release();
			release = await simLuxJS.waitForResource(deSim.washers);
			this.log("is being washed again because the drier found some hidden dirt.");
			await simLuxJS.advance(3);
			release();
			release = await simLuxJS.waitForResource(deSim.rinsers);
			this.log("is being rinsed again after the hidden dirt had been washed off.");
			await simLuxJS.advance(1);
			release();
			release = await simLuxJS.waitForResource(deSim.driers);
			this.log("is being dried again after the hidden dirt had been rinsed.");
		}
		await simLuxJS.advance(this.dishType == Dish.Type.Plate ? 2 : 3); // glasses take longer to dry.
		release();
		this.log("is completely clean.");
	}
}

async function testPerformance() {
	const fs = require('node:fs');

	let outputFilePath = "Performance Tests/Dishwashing/nodejsOutput_with_logging_vscode.csv"
	let outputFile = fs.openSync(outputFilePath, "w");
	
	function errorHandler(error) {
		if (error !== null)
			console.error(err);
	}
	
	function appendToOutput(content) {
		fs.writeSync(outputFile, content);
	}
	
	function stopTime(startTime) {
		return (new Date() - startTime) / 1000;
	}

	let repeatitions = 10;

	let preRinsersCount = 2;
	let washersCount = 4;
	let rinsersCount = 2;
	let driersCount = 3;
	
	appendToOutput(new Date().toISOString() + ",,,,\n");
	appendToOutput("preRinsers: " + preRinsersCount + ",washers: " + washersCount + ",rinsers: " + rinsersCount + ",driers: " + driersCount + ",repeatitions: " + repeatitions + "\n");
	appendToOutput(",,,,\n");
	appendToOutput("logging,n,preparationDuration,runDuration,totalDuration\n");

	for (let logging of [true, false]) {
		for (let n of [100, 1000, 10000, 25000, 50000, 100000, 250000]) {
			appendToOutput(",,,,\n");
			
			for (let simNr = 0; simNr < repeatitions; simNr++ ) {
				appendToOutput("" + logging + "," + n);
				let preparationStartTime = new Date();
				console.log("starting (logging: " + logging + ", n: " + n + ") at real time: " + preparationStartTime.toISOString());
				let sim = new DishExampleSimulation(n, preRinsersCount, washersCount, rinsersCount, driersCount, logging)
				preparationDuration = stopTime(preparationStartTime);
				console.log("preparation duration: " + preparationDuration + "s");
				appendToOutput("," + preparationDuration);
				
				let runStartTime = new Date();
				await sim.run();
				let runDuration = stopTime(runStartTime);
				console.log("run duration: " + runDuration + "s");
				let totalDuration = preparationDuration + runDuration
				console.log("Finished at simulated time: " + sim.simLuxJS.getTime() + " after " + totalDuration + " real seconds.");
				console.log("Total duration: " + totalDuration);
				appendToOutput("," + runDuration + "," + totalDuration + "\n");
			}
		}
	}

	fs.closeSync(outputFile);
}

testPerformance();