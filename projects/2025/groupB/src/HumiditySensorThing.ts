import {Servient} from "@node-wot/core";
import * as fs from "fs/promises";

export class HumiditySensorThing{
    private thing: WoT.ExposedThing | null = null;
    private soilMoisture: number = 50;
    private temperature: number = 22;
    private status: string = "online";
    
    private drySoilThreshold: number = 30;
    private wetSoilThreshold: number = 80;
    private simulationInterval: NodeJS.Timeout | null = null;
    private isPumpActive: boolean = false;
    
    constructor(private servient: Servient, private port: number = 8082) {}
    
    async init(): Promise<void>{
        const tmPath = "./models/humidity-sensor.tm.json";
        const tm = JSON.parse(await fs.readFile(tmPath, "utf-8"));
        
        const wot = await this.servient.start();
        
        this.thing = await wot.produce(tm);
        
        await this.thing.expose();

        console.log(`[OK] Sensore Umidità esposto su: http://localhost:${this.port}/humidity-sensor`);
    }
}