import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"

//https://github.com/eclipse-thingweb/node-wot?tab=readme-ov-file#examples
(async function main(){
    console.log("---# Counter Thing #---")
    const verbose=false;
    // Required steps to create a servient for creating a thing
    const servient = new Servient();
    servient.addServer(new HttpServer());



    console.log("Starting thing...")
    servient.start().then( async (WoT) => {
        // Then from here on you can use the WoT object to produce the thing
        let count = 0;
        const exposingThing = await WoT.produce({
            title: "Counter",
            description: "A simple counter thing",
            properties: {
                count: {
                    type: "integer",
                    description: "current counter value",
                    observable: true,
                    readOnly: true
                }
            },
            actions: {
                increment: {
                    description: "increment counter value",
                }
            }
        })
        exposingThing.setPropertyReadHandler("count", async () => { 
            if(verbose) console.log("> read count: "+count)
            return count; 
        });
        exposingThing.setActionHandler("increment", async () => { 
            count++; 
            if(verbose) console.log("< increment count to: "+count)
            exposingThing.emitPropertyChange("count");
            return "ok"; 
        });
        await exposingThing.expose();
        // now you can interact with the thing via http://localhost:8080/counter
        console.log("Exposed Counter thing at: http://localhost:8080/counter");

        //TEST
        if(process.argv.length>=3){
            const cmd= process.argv[2];
            if(cmd=="test"){
                console.log("*Starting test client...")
                await test();
            }
        }
    });
})()


async function test(){
    //Client code example
    const servient = new Servient();
    servient.addClientFactory(new HttpClientFactory(null));

    servient.start().then(async (WoT) => {
        const td = await WoT.requestThingDescription("http://localhost:8080/counter");
        // Then from here on you can consume the thing
        let thing = await WoT.consume(td);
        for (let i = 0; i < 5; i++) {
            await thing.invokeAction("increment");
            const currCount= await thing.readProperty("count")
            console.log("count:",await currCount.value());
        }
        console.log("Test finished!")
    }).catch((err) => { console.error(err); });
}