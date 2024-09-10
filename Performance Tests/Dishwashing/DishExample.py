# This is expected to do the same as the neighbouring DishExample.js.

from enum import Enum
import simpy
from datetime import datetime

class DishExampleSimulation():
	def __init__(self, n, preRinsers, washers, rinsers, driers, enableLogging):
		self.dishLogging = enableLogging
		self.env = simpy.Environment()
		self.preRinsers = simpy.Resource(self.env, capacity=preRinsers)
		self.washers = simpy.Resource(self.env, capacity=washers)
		self.rinsers = simpy.Resource(self.env, capacity=rinsers)
		self.driers = simpy.Resource(self.env, capacity=driers)
		
		nHalf = int(n / 2);
		for i in range(1, nHalf + 1):
			self.env.process(Dish(self, Dish.Type.Plate, i, i % 7 == 0).run())
			self.env.process(Dish(self, Dish.Type.Glass, i, i % 5 == 2).run())
    
	def run(self):
		self.env.run()
    
class Dish():
	class Type(Enum):
		Plate = "Plate"
		Glass = "Glass"
	
	def __init__(self, dishExampleSimulation, dishType, nr, hiddenDirt, isNew=False):
		self.deSim = dishExampleSimulation;
		self.dishType = dishType;
		self.nr = nr;
		self.hiddenDirt = hiddenDirt;
		self.isNew = isNew
    
	def log(self, message):
		if self.deSim.dishLogging:
			print(str(self.deSim.env.now) + ": " + self.dishType.value + " nr. " + str(self.nr) + ("(new) " if self.isNew else " ") + message);
	
	def run(self):
		deSim = self.deSim
		env = deSim.env
		request = deSim.preRinsers.request()
		yield request
		self.log("is being pre-prinsed")
		yield env.timeout(1)
		deSim.preRinsers.release(request)
		request = deSim.washers.request()
		yield request
		self.log("is being washed.")
		if self.dishType == Dish.Type.Glass and not self.isNew and self.nr % 10 == 1:
			# This branch demonstrates how new SimEntities can be added into the running simulation. 
			yield env.timeout(0.4)
			self.log("while being washed, the dish washer found out, that there was another glass inside.")
			newGlass = Dish(deSim, Dish.Type.Glass, self.nr, False, isNew=True)
			newGlass.log("is added to the beginning of the washing pipeline.")
			env.process(newGlass.run())
		yield env.timeout(5)
		deSim.washers.release(request)
		request = deSim.rinsers.request()
		yield request
		self.log("is being rinsed.")
		yield env.timeout(1)
		deSim.rinsers.release(request)
		request = deSim.driers.request()
		yield request
		self.log("is being dried.")
		if (self.hiddenDirt):
			yield env.timeout(1.2)
			deSim.driers.release(request)
			request = deSim.washers.request()
			yield request
			self.log("is being washed again because the drier found some hidden dirt.")
			yield env.timeout(3)
			deSim.washers.release(request)
			request = deSim.rinsers.request()
			yield request
			self.log("is being rinsed again after the hidden dirt had been washed off.")
			yield env.timeout(1)		
			deSim.rinsers.release(request)
			request = deSim.driers.request()
			yield request
			self.log("is being dried again after the hidden dirt had been rinsed.")
		yield env.timeout(2 if self.dishType == Dish.Type.Plate else 3)	# glasses take longer to dry.
		deSim.driers.release(request)
		self.log("is completely clean.")
	
def testPerformance():
	outputFilePath = "Performance Tests/Dishwashing/pythonOutput.csv"
	outputFile = open(outputFilePath, 'w', 1)
	
	def stopTime(startTime):
		return (datetime.now() - startTime).total_seconds()

	repeatitions = 10;

	preRinsersCount = 2;
	washersCount = 4;
	rinsersCount = 2;
	driersCount = 3;
	
	outputFile.write(datetime.now().isoformat() + ",,,,\n")
	outputFile.write("preRinsers: " + str(preRinsersCount) + ",washers: " + str(washersCount) + ",rinsers: " + str(rinsersCount) + ",driers: " + str(driersCount) + ",repeatitions: " + str(repeatitions) + "\n")
	outputFile.write(",,,,\n")
	outputFile.write("logging,n,preparationDuration,runDuration,totalDuration\n")
        
	for logging in [True, False]:
		for n in [100, 1000, 10000, 25000, 50000, 100000, 250000]:
			outputFile.write(",,,,\n");
			
			for simNr in range(repeatitions):
				outputFile.write(str(logging) + "," + str(n))
				preparationStartTime = datetime.now()
				print("starting (logging: " + str(logging) + ", n: " + str(n) + ") at real time: " + preparationStartTime.isoformat())
				sim = DishExampleSimulation(n, preRinsersCount, washersCount, rinsersCount, driersCount, logging)
				preparationDuration = stopTime(preparationStartTime)
				preparationDurationStr = str(preparationDuration)
				print("preparation duration: " + preparationDurationStr + "s")
				outputFile.write("," + preparationDurationStr)
				
				runStartTime = datetime.now()
				sim.run()
				runDuration = stopTime(runStartTime)
				runDurationStr = str(runDuration)
				print("run duration: " + runDurationStr + "s")
				totalDurationStr = str(preparationDuration + runDuration)
				print("Finished at simulated time: " + str(sim.env.now) + " after " + totalDurationStr + " real seconds.")
				print("Total duration: " + totalDurationStr)
				outputFile.write("," + runDurationStr + "," + totalDurationStr + "\n")
	outputFile.close()

testPerformance()