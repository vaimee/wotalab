import {Servient} from "@node-wot/core";
import * as fs from "fs/promises";
import {clearInterval} from "node:timers";

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
        
        // Imposta i Read Handler
        this.thing.setPropertyReadHandler("soilMoisture", async () => this.soilMoisture);
        this.thing.setPropertyReadHandler("temperature", async () => this.temperature);
        this.thing.setPropertyReadHandler("status", async () => this.status);
        
        await this.thing.expose();

        console.log(`[OK] Sensore Umidità esposto su: http://localhost:${this.port}/humidity-sensor`);
    }
    
    startSimulation(): void{
        this.simulationInterval = setInterval(async () => {
            // Simulazione realistica dell'umidità
            let variation;
            if (this.isPumpActive){
                // Durante l'irrigazione: umidità aumenta
                variation = 2 + Math.random()*2;
            } else {
                // Senza irrigazione: diminuisce (evaporazione)
                // Diminuzione piu veloce con temperature alte
                const evaporationRate = 0.3 + (this.temperature/100);
                variation = -(evaporationRate + Math.random() * 0.2);
            }
            // Aggiorniamo umidità bloccandola tra 0 e 100
            this.soilMoisture = Math.max(0, Math.min(100, this.soilMoisture + variation));
            
            // Temperatura varia leggermente
            const tempVariation = (Math.random() - 0.5) * 0.5;
            this.temperature = Math.max(0, Math.min(40, this.temperature + tempVariation))

            // Le proprietà si aggiornano automaticamente per chi legge
            if (this.soilMoisture < this.drySoilThreshold){
                await this.thing?.emitEvent("drySoil",{
                    soilMoisture: this.soilMoisture,
                    threshold: this.drySoilThreshold,
                    timestamp: new Date().toISOString(),
                });
                console.log(`[EVENT] Terreno secco (${this.soilMoisture.toFixed(1)}%)`);
            }
            
            if (this.soilMoisture > this.wetSoilThreshold){
                await this.thing?.emitEvent("wetSoil", {
                    soilMoisture: this.soilMoisture,
                    threshold: this.wetSoilThreshold,
                    timestamp: new Date().toISOString(),
                })
                console.log(`[EVENT] Terreno umido (${this.soilMoisture.toFixed(1)}%)`);
            }
            
        }, 3000)
    }
    
    stopSimulation(): void {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }
    
    // Notifica il sensore dello stato della pompa per simulazione realistica
    setPumpStatus(isActive: boolean): void{
        this.isPumpActive = isActive;
        console.log(`[SENSOR] Sensore umidita: pompa ${isActive ? 'ATTIVA' : 'SPENTA'} - comportamento aggiornato}`);
    }
    
    async destroy(): Promise<void> {
        this.stopSimulation();
        await this.thing?.destroy();
    }
}