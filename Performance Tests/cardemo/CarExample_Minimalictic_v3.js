// Import of SimLuxJs-simulation kernel  
const SimLuxJS = require('../../SimLuxJs.js').SimLuxJs; 
const SimEntity = require('../../SimLuxJS.js').SimEntity;  
const simLuxJs = new SimLuxJs();


// global model definitions - the car -model
const toll = simLuxJs.createResource(1);
let tollqueue =0, tollqueueMax = -1; 

function normalDistribution(mean, sigma)
{   let i, x = 0.0, n=30, xn = 0.0; 
    for (i=1 ; i<= n; i++)
         x = x + Math.random(); 
      xn = (x/n + mean ) * sigma  ; 
      if (dbglv>=4)  console.log("    $DIST$ xn= " +xn ) ; 
      return xn; 
}


async function car(simid, carid, parktime, drivetime1, tolltime,drivetime2)
{   await simLuxJs.advance(parktime); 
    await simLuxJs.advance(drivetime1); 
    tollqueue++; 
    if (tollqueue > tollqueueMax ) tollqueueMax = tollqueue;
    let releasetoll = await simLuxJs.waitForResource(toll); 
    tollqueue--;     
    await simLuxJs.advance(tolltime);  // Charge the toll fee
    releasetoll(); 
    await simLuxJs.advance(drivetime2);  // continue after toll station 
};
   
async function DoSimulationExperiments ( )
{
// measure runtime over a number of simulation experiments each with 3 cars
console.log("Start Simulation-experiments  ############ " ) ; 

simLuxJs.enableLogging = false;  
// simLuxJs.enableLogging = true; 

// Experiment specific iit vaulues 
let simexperiments = 10; 
let perftime_Sum =0.0; 
let perftime_count=0.0; 

// Model specific values --------------------------
let eventid = 0,  Maxenid = 10, enid = 0;

let genInterval =1; 

for (exp = 1; exp<=simexperiments; exp++)
    {  
    tollqueueMax=-1; 
    // const simLuxJs = new simLuxJs();
    // const toll = simLuxJs.createResource(1); 
    for ( enid =1; enid<=Maxenid; enid++ )
    { 
		let carid = (exp-1)*Maxenid +enid; // Count Cars up .. 
		let parktime = 2+2*enid;
    let drivetime = 6;
    let tolltime  = 3; 
    let drivetime1 = drivetime; 
    let drivetime2 = drivetime; 
     
		simLuxJs.addSimEntity(new SimEntity(simEntity => car(exp, carid, parktime, drivetime1, tolltime ,drivetime2))) ; ;
		console.log(" ... created Enitity: " +  carid + " with Parktime=" + parktime) ; 
        // simLuxJs.addSimEntity(new SimEntity(simEntity => car(exp, exp*Maxenid +enid, 2+2*enid, 6, 3)));
        // await simLuxJs.advance(genInterval);
    }

    await simLuxJs.run(until=undefined).then();

    let perf_runTime_show =   simLuxJs.perf_runTime; 
    perftime_count = perftime_count +1; 
    perftime_Sum +=  perf_runTime_show; 
    // let sigma_qsum2 = (perf_runTime_show  )

    }
  // end of all simulations 
  // xp--; // for cpompensation of for next ++ 
  console.log("End of all simulations #############################################################");
  console.log(" - runs           :  " +  exp  );
  console.log(" - events/run     :  " +  eventid/exp  );
  console.log(" - tollqueueMax   :  " +  tollqueueMax  );

  
  
  




  console.log("End of measurements  #############################################################");
} // end of DoSimulationExperiments

console.log("CALL DoSimulationExperiments ...  " ) ; 
DoSimulationExperiments().then  ; 
console.log("End of Call to DoSimulationExperiments ===================================  " ) ;
