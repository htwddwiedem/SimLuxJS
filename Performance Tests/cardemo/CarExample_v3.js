// Version conflict: This file was layed out for another version of SimLuxJS that has a special performance measurement.

console.log("Start Simulation program " ) ; 
const {SimLuxJS, SimEntity} = require('../../SimLuxJS.js');

const simLuxJS = new SimLuxJS();
const toll = simLuxJS.createResource(1);
perftime_Min = 1000.0; 
simLuxJS.dbglv = dbglv_Global;  // set Debugg level also in internal routines 
dbglv_Global =1;  // global debugglevel for all console outputs:  1 = minimal outputs  / 5 = maximmal    

// Global model defiitions 
tollqueue =0, tollqueueMax = -1; 
global_eventid = 0;
timeDigits1 = 100; // = 2 digits 
UseDistributionNr = 0; 

function normalDistribution(mean, sigma)
{   let i, x = 0.0, n=30, xn = 0.0; 
    for (i=1 ; i<= n; i++)
         x = x + Math.random(); 
      xn = (x/n + mean ) * sigma  ; 
      if (dbglv>=4)  console.log("    $DIST$ xn= " +xn ) ; 
      return xn; 
}

function simlog(dbglv, logtext ) {
	if (dbglv_Global>=dbglv) {
		let simlogtext = "" ; 
     	if (dbglv>0) simlogtext =  "T=" + simLuxJS.getTime() + " evid=" + global_eventid; 
		simlogtext += logtext;
		console.log( simlogtext ) ; 
    }
}

async function car(simid, carid, parktime, drivetime1, tolltime,drivetime2)
{   await simLuxJS.advance(parktime); global_eventid++;
     simlog(3,  " Car " + carid + " Starting in Sim=" + simid + " with drivetime=" + drivetime1 );
    await simLuxJS.advance(drivetime1); global_eventid++;
     simlog(3,  " Car " + carid + " After Drive1 - now at toll station - tollQueue=" + tollqueue );
    tollqueue++; 
    if (tollqueue > tollqueueMax ) tollqueueMax = tollqueue;
    let releasetoll = await simLuxJS.waitForResource(toll); global_eventid++;
    tollqueue--;
    // Charge the toll fee
     simlog(3,  " Car " + carid + " # charge toll - duration=" + tolltime);
    await simLuxJS.advance(tolltime); global_eventid++;
     simlog(3,  " Car " + carid + " # leaving toll station ");
    releasetoll(); global_eventid++;
    
    // continue after toll station 
    simlog(3, " Car " + carid + " Driving again to EXIT " + " with drivetime=" + drivetime2 );
    await simLuxJS.advance(drivetime2); global_eventid++;
    simlog(3," Car " + carid + " EXIT and Terminate!" );
};
   
async function DoSimulationExperiments ( )
{
	// measure runtime over a number of simulation experiments each with 3 cars
	console.log("Start Simulation-experiments  ############ " ) ; 

	simLuxJS.enableLogging = false;  
	// simLuxJS.enableLogging = true; 

	// Experiment specific iit vaulues 
	simexperiments = 20; 
	perftime_Sum =0.0; 
	perftime_count=0.0; 

	// Model specific values --------------------------
	eventid = 0;
	Maxenid = 10000, enid = 0;

	genInterval =1; 

	for (exp = 1; exp<=simexperiments; exp++) {
		simlog(3, "### Start Simulation-experiment Number " + exp + " ################ " ) ; 
		tollqueueMax=-1; 
		// const simLuxJS = new simLuxJS();
		// const toll = simLuxJS.createResource(1); 
		for ( enid =1; enid<=Maxenid; enid++ ) { 
			const carid = (exp-1)*Maxenid +enid; // Count Cars up .. 
			parktime = 2+2*enid;
			drivetime = 6;
			tolltime  = 3; 
			drivetime1 = drivetime; 
			drivetime2 = drivetime; 
			if ( UseDistributionNr == 1) // Use uniform distribution
			{
				drivetime1 = drivetime  + 2 * Math.round(Math.random() * timeDigits1)/timeDigits1;
				drivetime2= drivetime  + 2 * Math.round(Math.random() * timeDigits1)/timeDigits1;
			} 
			if ( UseDistributionNr == 2) // Use uniform distribution
			{  drivetime1 = drivetime  + Math.round(normalDistribution(2,1) * timeDigits1)/timeDigits1;
				drivetime2= drivetime  +  Math.round(Math.random(2,1) * timeDigits1)/timeDigits1;
			} 
			simLuxJS.addSimEntity(new SimEntity(simEntity => car(exp, carid, parktime, drivetime1, tolltime ,drivetime2))) ; ;
			simlog(3, " ... created Enitity: " +  carid + " with Parktime=" + parktime) ; 
			// simLuxJS.addSimEntity(new SimEntity(simEntity => car(exp, exp*Maxenid +enid, 2+2*enid, 6, 3)));
			// await simLuxJS.advance(genInterval);
		}

		await simLuxJS.run();

		perf_runTime_show =   simLuxJS.perf_runTime; 
		perftime_count = perftime_count +1; 
		perftime_Sum +=  perf_runTime_show; 
		// let sigma_qsum2 = (perf_runTime_show  )
		
		if (perf_runTime_show < perftime_Min )  perftime_Min = perf_runTime_show; 
		

		simlog(3, "### EndSim exp=" + exp + " with " + perf_runTime_show + " ms  MaxtollQueue=" + tollqueueMax  + "### " ) ; 
	}
	// end of all simulations 
	// xp--; // for cpompensation of for next ++ 
	simlog(0, "End of all simulations #############################################################");
	simlog(0, " - runs           :  " +  exp  );
	simlog(0, " - Sum of all runs:  " +  perftime_Sum );
	simlog(0, " - mean           :  " +  perftime_Sum/ perftime_count  );
	simlog(0," - min            :  " +  perftime_Min  );
	simlog(0," - events         :  " +  global_eventid  );
	// simlog(0," - events/run     :  " +  eventid/exp  );
	simlog(0," - tollqueueMax   :  " +  tollqueueMax  );

    simlog(0,"End of measurements  #############################################################");
} // end of DoSimulationExperiments

simlog(0,"CALL DoSimulationExperiments ...  " ) ; 
DoSimulationExperiments().then(() => {simlog("end")}); 
simlog(0,"End of Call to DoSimulationExperiments ===================================  " ) ;
