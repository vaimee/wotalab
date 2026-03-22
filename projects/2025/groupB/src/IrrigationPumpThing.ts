import { Servient } from "@node-wot/core";
import * as fs from "fs/promises";

export class IrrigationPumpThing {
  private thing: WoT.ExposedThing | null = null;
  private isPumping: boolean = false;
  private flowRate: number = 10;
  private totalWaterUsed: number = 0;
  private status: "idle" | "pumping" | "error" = "idle";
  private currentRunTimeSeconds: number = 0;
  private pumpInterval: NodeJS.Timeout | null = null;
  private stopTimeout: NodeJS.Timeout | null = null;
  private startedAtMs: number | null = null;

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
    this.thing.setPropertyReadHandler("status", async () => this.status);
    this.thing.setPropertyReadHandler("currentRunTimeSeconds", async () => this.currentRunTimeSeconds);

    this.thing.setPropertyWriteHandler("flowRate", async (value) => {
      const inputFlow = (await value.value()) as number;
      if (Number.isFinite(inputFlow) && inputFlow > 0) {
        this.flowRate = Math.min(50, inputFlow);
        await this.notifyPropertyChanges(["flowRate"]);
      }
    });

    // Action per avviare la pompa
    this.thing.setActionHandler("startPump", async (params) => {
      const input = (await params?.value()) as any;
      const duration = Number(input?.duration ?? 0);
      const requestedFlowRate = Number(input?.flowRate ?? this.flowRate);

      await this.startPump(duration, requestedFlowRate);
      
      return undefined;
    });

    // Action per fermare la pompa
    this.thing.setActionHandler("stopPump", async () => {
      await this.stopPump();
      
      return undefined;
    });

    this.thing.setActionHandler("resetCounter", async () => {
      this.totalWaterUsed = 0;
      await this.notifyPropertyChanges(["totalWaterUsed"]);
      console.log("[PUMP] Contatore acqua resettato");
      
      return undefined;
    });

    await this.thing.expose();

    console.log(`[OK] Pompa Irrigazione esposta su: http://localhost:${this.port}/irrigation-pump`);
  }

  private async startPump(durationSeconds: number, flowRate: number): Promise<void> {
    if (this.isPumping) {
      console.log("[PUMP] Richiesta ignorata: pompa già in funzione");
      return;
    }

    this.flowRate = Number.isFinite(flowRate) && flowRate > 0 ? Math.min(50, flowRate) : this.flowRate;
    this.isPumping = true;
    this.status = "pumping";
    this.currentRunTimeSeconds = 0;
    this.startedAtMs = Date.now();

    await this.notifyPropertyChanges(["isPumping", "status", "flowRate", "currentRunTimeSeconds"]);

    await this.thing?.emitEvent("pumpStarted", {
      flowRate: this.flowRate,
      timestamp: new Date().toISOString(),
    });

    console.log(`[PUMP] Pompa avviata: ${this.flowRate.toFixed(1)} L/min${durationSeconds > 0 ? ` per ${durationSeconds}s` : ""}`);

    this.pumpInterval = setInterval(async () => {
      const previousRuntime = this.currentRunTimeSeconds;
      const runtimeSeconds = this.startedAtMs ? Math.floor((Date.now() - this.startedAtMs) / 1000) : previousRuntime + 1;
      const deltaSeconds = Math.max(1, runtimeSeconds - previousRuntime);

      this.currentRunTimeSeconds = runtimeSeconds;
      this.totalWaterUsed += (this.flowRate / 60) * deltaSeconds;

      await this.notifyPropertyChanges(["currentRunTimeSeconds", "totalWaterUsed"]);
    }, 1000);

    if (durationSeconds > 0) {
      this.stopTimeout = setTimeout(async () => {
        await this.stopPump();
      }, durationSeconds * 1000);
    }
  }

  private async stopPump(): Promise<void> {
    if (!this.isPumping) {
      return;
    }

    if (this.pumpInterval) {
      clearInterval(this.pumpInterval);
      this.pumpInterval = null;
    }

    if (this.stopTimeout) {
      clearTimeout(this.stopTimeout);
      this.stopTimeout = null;
    }

    if (this.startedAtMs) {
      this.currentRunTimeSeconds = Math.floor((Date.now() - this.startedAtMs) / 1000);
      this.startedAtMs = null;
    }

    this.isPumping = false;
    this.status = "idle";

    await this.notifyPropertyChanges(["isPumping", "status", "currentRunTimeSeconds", "totalWaterUsed"]);

    await this.thing?.emitEvent("pumpStopped", {
      waterUsed: this.totalWaterUsed,
      timestamp: new Date().toISOString(),
    });

    console.log(`[PUMP] Pompa fermata. Acqua totale: ${this.totalWaterUsed.toFixed(2)} L, runtime: ${this.currentRunTimeSeconds}s`);
  }

  private async notifyPropertyChanges(propertyNames: string[]): Promise<void> {
    for (const propertyName of propertyNames) {
      await this.thing?.emitPropertyChange(propertyName);
    }
  }

  async destroy(): Promise<void> {
    await this.stopPump();
    await this.thing?.destroy();
  }
}