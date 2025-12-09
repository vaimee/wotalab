import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
import { ModbusClientFactory } from "@node-wot/binding-modbus";
import { ModbusSemaphoreThing } from "./ModbusSemaphoreThing"
import { CounterThing } from "./CounterThing"
import { wait } from "./utils/wait"
import Orchestrator from "./Orchestrator"

/*
*SIMPLE THINGS ARE SMART TOGETHER
Fundamental smartIOT pattern according to WOT:
Things are independent between eachother, the intelligence is in the "orchestration logic"
-> In this example we suppose the things are deployed on a remote server, and the orchestrator interacts with them remotely
*/
(async function main(){
    console.log("---# Counter - Semaphore orchestrator #---")
    const verbose=false;
    //STEP 1: CREATE SERVIENT
    /*
    ...Add code here...
    */

    //Then, Orchestrate things
    const orchestrator= new Orchestrator()
    await orchestrator.start()
    

    //TEST
    if(process.argv.length>=3){
        const cmd= process.argv[2];
        if(cmd=="test"){
            console.log("Starting test client...")
            await test();
        }
    }
})()


async function test(){
    //Client code example
    const servient = new Servient();
    servient.addClientFactory(new HttpClientFactory(null));

    servient.start().then(async (WoT) => {
        const td = await WoT.requestThingDescription("http://localhost:8080/counter");
        let thing = await WoT.consume(td);
        //* START TEST
        //Increment counter
        for (let i = 0; i < 15; i++) {
            await wait(1000);
            await thing.invokeAction("increment");
            const currCount= await thing.readProperty("count")
            console.log("count:",await currCount.value());
        }
        //Check semaphore state
        console.log("Test finished!")
    }).catch((err) => { console.error(err); });
}