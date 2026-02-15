import { Servient } from "@node-wot/core";
import * as fs from "fs/promises";

export class IrrigationPumpThing {
  private thing: WoT.ExposedThing | null = null;
  private isPumping: boolean = false;
  private flowRate: number = 10;
  private totalWaterUsed: number = 0;

  constructor(private servient: Servient, private port: number = 8083) {}

  async init(): Promise<void> {
    const tmPath = "./models/irrigation-pump.tm.json";
    const tm = JSON.parse(await fs.readFile(tmPath, "utf-8"));

    const wot = await this.servient.start();
    this.thing = await wot.produce(tm);

    // Imposta i Read Handler per le proprietà
    this.thing.setPropertyReadHandler("isPumping", async () => this.isPumping);
    this.thing.setPropertyReadHandler("flowRate", async () => this.flowRate);
    this.thing.setPropertyReadHandler("totalWaterUsed", async () => this.totalWaterUsed);

    // Action per avviare la pompa
    this.thing.setActionHandler("startPump", async (params) => {
      const input = (await params?.value()) as any;
      const duration = input?.duration || 0;
      
      this.isPumping = true;
      console.log(`[PUMP] Pompa avviata per ${duration}s`);
      
      return undefined;
    });

    // Action per fermare la pompa
    this.thing.setActionHandler("stopPump", async () => {
      this.isPumping = false;
      console.log(`[PUMP] Pompa fermata`);
      
      return undefined;
    });

    await this.thing.expose();

    console.log(`[OK] Pompa Irrigazione esposta su: http://localhost:${this.port}/irrigation-pump`);
  }

  async destroy(): Promise<void> {
    await this.thing?.destroy();
  }
}