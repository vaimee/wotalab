import * as fs from "fs"
import {Servient} from "@node-wot/core"
import {HttpServer,HttpClientFactory} from "@node-wot/binding-http"
import { RobotArm } from "./robot-arm/RobotArm";
import { Controller } from "./controller/Controller";
import { RobotArmController } from "./orchestrators/RobotArmController";


(async function main(){
    console.log("### WOT ROBOT ARM ###")
    
    //Create things
    console.log("* creating things runtime...")
    const servient = new Servient();
    servient.addServer(new HttpServer());
    const wotRuntime= await servient.start();

    console.log("* starting robot arm thing...")
    const td= JSON.parse(fs.readFileSync("./models/robot-arm.tm.json").toString());
    const robotArm= new RobotArm(wotRuntime,td,"COM7")
    await robotArm.start();

    console.log("* starting input controller thing...")
    const tdController= JSON.parse(fs.readFileSync("./models/controller.tm.json").toString());
    const controller= new Controller(wotRuntime,tdController)
    await controller.start();


    //Create orchestrator
    console.log("* creating orchestrator runtime...")
    const orchestratorServient = new Servient();
    orchestratorServient.addClientFactory(new HttpClientFactory(null));
    const orchestratorRuntime= await orchestratorServient.start();
    
    console.log("* starting orchestrator...")  
    const robotArmTd= await orchestratorRuntime.requestThingDescription("http://localhost:8080/robotarm");
    const controllerTd= await orchestratorRuntime.requestThingDescription("http://localhost:8080/controller");
    const orchestrator= new RobotArmController(orchestratorRuntime,robotArmTd,controllerTd)
    await orchestrator.start(); 
    
    console.log("SYSTEM ONLINE!")
})()