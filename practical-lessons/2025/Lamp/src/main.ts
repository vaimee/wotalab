import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
import { LampThing } from "./LampThing";
import { wait } from "./utils/wait";



//https://www.w3.org/TR/wot-thing-description11/
(async function main(){
    console.log("---# Lamp Thing - WoT project example #---")
    //Create thing
    const servient = new Servient();
    servient.addServer(new HttpServer());
    const wotRuntime= await servient.start();
    
    const td= JSON.parse(fs.readFileSync("./models/lamp.tm.json").toString());
    console.log("Starting lamp thing...")
    const lamp= new LampThing(wotRuntime,td)
    await lamp.start();
    console.log("-------------------------------------------")

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
        const td = await WoT.requestThingDescription("http://localhost:8080/lamp");
        // Then from here on you can consume the thing
        let thing = await WoT.consume(td);
        for (let i = 0; i < 10; i++) {
            await wait(1000)
            await thing.invokeAction("toggle");
            const currCount= await thing.readProperty("status")
            console.log("status:",await currCount.value());
        }
        console.log("Test finished!")
    }).catch((err) => { console.error(err); });
}