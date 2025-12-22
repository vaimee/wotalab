import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer} from "@node-wot/binding-http"
import { DHTTemperatureSensor } from "./DHTTemperatureSensor";




(async function main(){
    //Create thing
    const servient = new Servient();
    servient.addServer(new HttpServer());
    const wotRuntime= await servient.start();

    const td= JSON.parse(fs.readFileSync("./models/dht.tm.json").toString());
    const sensor= new DHTTemperatureSensor(wotRuntime,td)
    await sensor.start();
})()