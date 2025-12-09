import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
import { SemaphoreThing } from "./SemaphoreThing"
import { CounterThing } from "./CounterThing"
import { wait } from "./utils/wait"

/*
*SIMPLE THINGS ARE SMART TOGETHER
Fundamental smartIOT pattern according to WOT:
Things are independent between eachother, the intelligence is in the "orchestration logic"
-> In this example we suppose the things are deployed on a remote server, and the orchestrator interacts with them remotely
*/
(async function main(){
    console.log("---# Counter - Semaphore orchestrator #---")
    const verbose=false;
    //Expose remote things
    const remoteServient = new Servient();
    remoteServient.addServer(new HttpServer({"port":8080})); //all things on port 8080, in more realistic scenarios we have 1 servient for each thing
    const remoteWotRuntime= await remoteServient.start();
    const counterTD= JSON.parse(fs.readFileSync("./models/counter.tm.json").toString());
    const semaphoreTD= JSON.parse(fs.readFileSync("./models/semaphore.tm.json").toString());
    const counter = new CounterThing(remoteWotRuntime,counterTD)
    const semaphore= new SemaphoreThing(remoteWotRuntime,semaphoreTD)
    await counter.start();
    await semaphore.start();


    //Orchestrate things
    //We suppose the orchestrator does not know the internals of the things, it just consumes them remotely
    const servient= new Servient();
    servient.addClientFactory(new HttpClientFactory(null));
    const wotRuntime= await servient.start();
    const consumedCounterTD = await wotRuntime.requestThingDescription("http://localhost:8080/counter");
    const consumedSemaphoreTD = await wotRuntime.requestThingDescription("http://localhost:8080/semaphore");
    let counterThing = await wotRuntime.consume(consumedCounterTD);
    let semaphoreThing = await wotRuntime.consume(consumedSemaphoreTD);
    //Theresolds
    const thresholds={
        red: 0,
        yellow: 5,
        green: 10
    }
    //Polling
    while (true) {
        await wait(500);
        const currCountProp= await counterThing.readProperty("count")
        const currCount:number= await currCountProp.value() as any;
        let desiredColor: "red" | "yellow" | "green"="red";
        if (currCount >= thresholds.green) desiredColor = "green";
        else if (currCount >= thresholds.yellow) desiredColor = "yellow";
        else desiredColor = "red";
        await semaphoreThing.invokeAction("setColor",desiredColor);
        console.log(`count = ${currCount}, color -> ${desiredColor}`);
    }
    //Subscription alternative
    /*counterThing.observeProperty("count",
        async (data) => {
            const currCount: number = await data.value() as any;
            let desiredColor: "red" | "yellow" | "green" = "red";
            if (currCount >= thresholds.green) desiredColor = "green";
            else if (currCount >= thresholds.yellow) desiredColor = "yellow";
            else desiredColor = "red";
            await semaphoreThing.invokeAction("setColor", desiredColor);
            console.log(`count = ${currCount}, color -> ${desiredColor}`);
        },
        (err) => {
            console.error("Error observing count:", err);
        }
    );*/

    //TEST
    //if(process.argv.length>=3){
    //    const cmd= process.argv[2];
    //    if(cmd=="test"){
    //        console.log("Starting test client...")
    //        await test();
    //    }
    //}
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