#// The car example from the SimPy/Sim# lecture.  
#//JS/ console.log("Start Simulation program " ) ; 
#//JS/const SimLuxJS = require('../../SimLuxJS.js').SimLuxJS; 
#//JS/const SimEntity = require('../../SimLuxJS.js').SimEntity;
# Py - specific 
import math
import time
import simpy
env = simpy.Environment()
#//JS/ const simLuxJS = new SimLuxJS();
#//JS/ const toll = simLuxJS.createResource(1);
perftime_Min = 1000.0; 
dbglv_Global =3;  #// global debugglevel for all console outputs:  1 = minimal outputs  / 5 = maximmal    
dbglv = dbglv_Global;  #// set Debugg level also in internal routines 

#// Global model defiitions 
tollqueue =0;
tollqueueMax = -1;
toll = simpy.Resource(env, capacity=1)
global_eventid = 0;
timeDigits1 = 100; #// = 2 digits 
UseDistributionNr = 0;
perftime_Min=1000000; 

def simlog(dbglv, logtext ) : 
 if (dbglv_Global>=dbglv) :
      simlogtext = "" ; 
      if (dbglv>0) :
            simlogtext =  "T=" + str(env.now) + " evid=" + str(global_eventid); 
      simlogtext += logtext;
      print ( simlogtext ) ; 
     

def normalDistribution(mean, sigma) :
   i=0;  x = 0.0; n=30; xn = 0.0; 
   for i in range (1 , n) :
         x = x + math.random(); 
   xn = (x/n + mean ) * sigma  ; 
   if (dbglv>=4) :
                  simlog("    $DIST$ xn= " +xn ) ; 
   return xn; 


def car(env,simid, carid, parktime, drivetime1, tolltime,drivetime2) : 
    #// await simLuxJS.advance(parktime);
    global tollqueueMax; global tollqueue; global global_eventid;
    yield env.timeout(parktime); global_eventid+=1;# global_eventid++;
    simlog(3,  " Car " + str(carid) + " Starting in Sim=" + str(simid) + " with drivetime=" + str(drivetime1) );
    #// await simLuxJS.advance(drivetime1);
    yield env.timeout(drivetime1); global_eventid+=1;# global_eventid++;
    simlog(3,  " Car " + str(carid) + " After Drive1 - now at toll station - tollQueue=" + str(tollqueue) );
    tollqueue += 1; 
    if (tollqueue > tollqueueMax )  :
             tollqueueMax = tollqueue;
    # let releasetoll = await simLuxJS.waitForResource(toll);
    tollreq = toll.request();global_eventid+=1; # global_eventid++;
    tollqueue -=1 ;
    #// Charge the toll fee
    simlog(3,  " Car " + str(carid) + " # charge toll - duration=" + str(tolltime));
    # await simLuxJS.advance(tolltime);
    yield env.timeout(tolltime);global_eventid+=1; # global_eventid++;
    simlog(3,  " Car " + str(carid )+ " # leaving toll station ");
    # releasetoll(); global_eventid++;
    toll.release(tollreq); global_eventid+=1;

    #// continue after toll station 
    simlog(3, " Car " + str(carid) + " Driving again to EXIT " + " with drivetime=" + str(drivetime2) );
    # await simLuxJS.advance(drivetime2);
    yield env.timeout(drivetime1); global_eventid+=1;
    
    simlog(3," Car " + str(carid) + " EXIT and Terminate!" );
     #};
   
def  DoSimulationExperiments ( ) :
    #// measure runtime over a number of simulation experiments each with 3 cars
    simlog(1, "Start Simulation-experiments  ############ " ) ; 
    global perftime_Min;
    #simLuxJS.enableLogging = false;  
    # // simLuxJS.enableLogging = true; 

    #// Experiment specific iit vaulues 
    simexperiments = 20+1; 
    perftime_Sum =0.0; 
    perftime_count=0.0; 

    # // Model specific values --------------------------
    eventid = 0;
    Maxenid = 10000;
    enid = 0;

    genInterval =1;
    perf_runTime =0; 

    # for (exp = 1; exp<=simexperiments; exp++)
    for exp in range ( 1, simexperiments) :
        simlog(3, "### Start Simulation-experiment Number " + str(exp) + " ################ " ) ; 
        global tollqueueMax; global tollqueue;
        tollqueueMax=-1; tollqueue =0;
        
        #// const simLuxJS = new simLuxJS();
        #// const toll = simLuxJS.createResource(1); 
        for enid in range (1, Maxenid) :
            carid = (exp-1)*Maxenid +enid; # // Count Cars up .. 
            parktime = 2+2*enid;
            drivetime = 6;   tolltime  = 3; 
            drivetime1 = drivetime;    drivetime2 = drivetime; 
            if ( UseDistributionNr == 1) : #// Use uniform distribution
             #{
                drivetime1 = drivetime  + 2 * Math.round(Math.random() * timeDigits1)/timeDigits1;
                drivetime2= drivetime  + 2 * Math.round(Math.random() * timeDigits1)/timeDigits1;
             #} 
            if ( UseDistributionNr == 2) : # // Use uniform distribution
                # {
                drivetime1 = drivetime  + Math.round(normalDistribution(2,1) * timeDigits1)/timeDigits1;
                drivetime2= drivetime  +  Math.round(Math.random(2,1) * timeDigits1)/timeDigits1;
                #} 
                # simLuxJS.addSimEntity(new SimEntity(simEntity => car(exp, carid, parktime, drivetime1, tolltime ,drivetime2))) ;
            env.process(car(env, exp, carid, parktime, drivetime1, tolltime ,drivetime2 ))
            simlog(3, " ... created Enitity: " +  str(carid) + " with Parktime=" + str(parktime)) ; 

            #}

        # await simLuxJS.run(until=undefined).then();
        
        #' LEVEL INSIDE eDPERMENT
        perf_runTime=time.perf_counter();
        env.run()
        perf_runTime=time.perf_counter()-perf_runTime;
    
        perf_runTime_show =   perf_runTime;
        perftime_count = perftime_count +1; 
        perftime_Sum +=  perf_runTime_show; 
        #// let sigma_qsum2 = (perf_runTime_show  )
    
        if (perf_runTime_show < perftime_Min ) :
            perftime_Min = perf_runTime_show; 
    
        simlog(3, "### EndSim exp=" + str(exp) + " with " + str(perf_runTime_show) + " s  MaxtollQueue=" + str(tollqueueMax)  + "### " ) ; 
        #}
    #// end of all simulations 
    #// xp--; // for cpompensation of for next ++ 
    simlog(0, "End of all simulations #############################################################");
    simlog(0, " - runs           :  " +  str(exp)  );
    simlog(0, " - Sum of all runs:  " +  str(perftime_Sum) );
    simlog(0, " - mean  [s]      :  " +  str(perftime_Sum/ perftime_count)  );
    simlog(0," - min            :  " +  str(perftime_Min)  );
    simlog(0," - events         :  " +  str(global_eventid)  );
    #// simlog(0," - events/run     :  " +  eventid/exp  );
    simlog(0," - tollqueueMax   :  " +  str(tollqueueMax)  );

    simlog(0,"End of measurements  #############################################################");
#} // end of DoSimulationExperiments

simlog(0,"CALL DoSimulationExperiments ...  " ) ; 
DoSimulationExperiments()  ; 
simlog(0,"End of Call to DoSimulationExperiments ===================================  " ) ;
