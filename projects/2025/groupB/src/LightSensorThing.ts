import { Servient } from "@node-wot/core";
import * as fs from "fs/promises";

export class LightSensorThing {
  private thing: WoT.ExposedThing | null = null;
  private luminosity: number = 5000;
  private status: string = "online";
  private lowLightThreshold: number = 2000;
  private highLightThreshold: number = 50000;
  private simulationInterval: NodeJS.Timeout | null = null;
  private simulationTime: number = 0; // Tempo simulato in ore (0-24)

  constructor(private servient: Servient, private port: number = 8081) {}

  async init(): Promise<void> {
    const tmPath = "./models/light-sensor.tm.json";
    const tm = JSON.parse(await fs.readFile(tmPath, "utf-8"));

    const wot = await this.servient.start();
    this.thing = await wot.produce(tm);

    // Imposta i Read Handler
    this.thing.setPropertyReadHandler("luminosity", async () => this.luminosity);
    this.thing.setPropertyReadHandler("status", async () => this.status);
    this.thing.setPropertyReadHandler("simulatedTime", async () => this.getTimeString());

    await this.thing.expose();
    
    console.log(`[OK] Sensore Luminosità esposto su: http://localhost:${this.port}/light-sensor`);
  }

  startSimulation(): void {
    // Inizia la simulazione alle 6:00 del mattino
    this.simulationTime = 6;
    this.updateLuminosityForTime();
    
    this.simulationInterval = setInterval(async () => {
      // Avanza di 0.5 ore (30 minuti simulati) ogni 3 secondi reali
      this.simulationTime += 0.5;
      
      // Reset a mezzanotte
      if (this.simulationTime >= 24) {
        this.simulationTime = 0;
      }
      
      // Calcola luminosità in base all'ora del giorno
      this.updateLuminosityForTime();

      // Le proprietà si aggiornano automaticamente tramite i Read Handler

      if (this.luminosity < this.lowLightThreshold) {
        await this.thing?.emitEvent("lowLight", {
          luminosity: this.luminosity,
          threshold: this.lowLightThreshold,
          timestamp: new Date().toISOString(),
        });
        console.log(`[EVENT] Luce bassa (${this.luminosity.toFixed(0)} lux)`);
      }

      if (this.luminosity > this.highLightThreshold) {
        await this.thing?.emitEvent("highLight", {
          luminosity: this.luminosity,
          threshold: this.highLightThreshold,
          timestamp: new Date().toISOString(),
        });
        console.log(`[EVENT] Luce alta (${this.luminosity.toFixed(0)} lux)`);
      }

      const timeStr = this.getTimeString();
    }, 3000);
  }

  private updateLuminosityForTime(): void {
    
    let baseLuminosity: number;
    
    if (this.simulationTime >= 0 && this.simulationTime < 6) {
      // Notte profonda: 0-500 lux
      baseLuminosity = 100 + Math.random() * 400;
    } else if (this.simulationTime >= 6 && this.simulationTime < 8) {
      // Alba: graduale aumento
      const progress = (this.simulationTime - 6) / 2;
      baseLuminosity = 500 + progress * 29500;
    } else if (this.simulationTime >= 8 && this.simulationTime < 12) {
      // Mattina: luce crescente
      const progress = (this.simulationTime - 8) / 4;
      baseLuminosity = 30000 + progress * 30000;
    } else if (this.simulationTime >= 12 && this.simulationTime < 15) {
      // Mezzogiorno: massima luminosità
      baseLuminosity = 60000 + Math.random() * 20000;
    } else if (this.simulationTime >= 15 && this.simulationTime < 18) {
      // Pomeriggio: luce calante
      const progress = (this.simulationTime - 15) / 3;
      baseLuminosity = 60000 - progress * 30000;
    } else if (this.simulationTime >= 18 && this.simulationTime < 20) {
      // Tramonto: rapido calo
      const progress = (this.simulationTime - 18) / 2;
      baseLuminosity = 30000 - progress * 29500;
    } else {
      // Sera/notte: 0-500 lux
      baseLuminosity = 100 + Math.random() * 400;
    }
    
    // Aggiungi variazione casuale (nuvole, ecc.) ±10%
    const variation = baseLuminosity * 0.1 * (Math.random() - 0.5) * 2;
    this.luminosity = Math.max(0, Math.min(100000, baseLuminosity + variation));
  }

  private getTimeString(): string {
    const hours = Math.floor(this.simulationTime);
    const minutes = Math.floor((this.simulationTime - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  stopSimulation(): void {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }

  async destroy(): Promise<void> {
    this.stopSimulation();
    await this.thing?.destroy();
  }
}