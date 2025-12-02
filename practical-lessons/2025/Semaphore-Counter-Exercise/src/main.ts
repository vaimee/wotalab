import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
//import { SemaphoreThing } from "./SemaphoreThing"
//import { CounterThing } from "./CounterThing"
import { wait } from "./utils/wait"

/*
*SIMPLE THINGS ARE SMART TOGETHER
Fundamental smartIOT pattern according to WOT:
Things are independent between eachother, the intelligence is in the "orchestration logic"
-> In this example we suppose the things are deployed on a remote server, and the orchestrator interacts with them remotely
*/
(async function main(){
    console.log("---# Counter - Semaphore orchestrator #---")
    //Expose remote things
    //...


    //Consume and orchestrate them
    //...
})()