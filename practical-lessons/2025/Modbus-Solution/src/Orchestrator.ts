import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
import { ModbusSemaphoreThing } from "./ModbusSemaphoreThing"
import { CounterThing } from "./CounterThing"
import { wait } from "./utils/wait"

export default class Orchestrator{
    private counterThing!:WoT.ConsumedThing;
    private semaphoreThing!:WoT.ConsumedThing;
    private thresholds={
            red: 0,
            yellow: 5,
            green: 10
        }
    private type:"poll"|"subscription";
    constructor(type:"poll"|"subscription"="poll"){
        this.type=type;
    }
    async start(){
        console.log("Starting orchestrator...")
        const servient= new Servient();
        servient.addClientFactory(new HttpClientFactory(null));
        const wotRuntime= await servient.start();
        const consumedCounterTD = await wotRuntime.requestThingDescription("http://localhost:8080/counter");
        const consumedSemaphoreTD = await wotRuntime.requestThingDescription("http://localhost:8080/semaphore");
        this.counterThing = await wotRuntime.consume(consumedCounterTD);
        this.semaphoreThing = await wotRuntime.consume(consumedSemaphoreTD);
        if(this.type=="subscription"){
            this.subscribe() //async
        }else{
            this.poll() //async
        }
        console.log("Orchestrator started")
    }

    async poll(){
        while (true) {
            await wait(500);
            const currCountProp= await this.counterThing.readProperty("count")
            const currCount:number= await currCountProp.value() as any;
            let desiredColor: "red" | "yellow" | "green"="red";
            if (currCount >= this.thresholds.green) desiredColor = "green";
            else if (currCount >= this.thresholds.yellow) desiredColor = "yellow";
            else desiredColor = "red";
            await this.semaphoreThing.invokeAction("setColor",desiredColor);
            console.log(`count = ${currCount}, color -> ${desiredColor}`);
        }
    }

    async subscribe(){
        this.counterThing.observeProperty("count",
            async (data) => {
                const currCount: number = await data.value() as any;
                let desiredColor: "red" | "yellow" | "green" = "red";
                if (currCount >= this.thresholds.green) desiredColor = "green";
                else if (currCount >= this.thresholds.yellow) desiredColor = "yellow";
                else desiredColor = "red";
                await this.semaphoreThing.invokeAction("setColor", desiredColor);
                console.log(`count = ${currCount}, color -> ${desiredColor}`);
            },
            (err) => {
                console.error("Error observing count:", err);
            }
        );
    }
}