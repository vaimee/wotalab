import { Servient } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";

export class IrrigationOrchestrator {
  private wot: any = null;
  private lightSensor: WoT.ConsumedThing | null = null;
  private humiditySensor: WoT.ConsumedThing | null = null;
  private pump: WoT.ConsumedThing | null = null;
  private humiditySensorThing: any = null; // Riferimento al sensore fisico per simulazione
  
  // Parametri del sistema di irrigazione
  private minSoilMoisture: number = 30;
  private maxSoilMoisture: number = 70;
  private minLightForIrrigation: number = 3000;
  private checkInterval: NodeJS.Timeout | null = null;
  private isAutoMode: boolean = true;

  private dataHistory: Array<{
    timestamp: number;
    soilMoisture: number;
    temperature: number;
    luminosity: number;
    isPumping: boolean;
  }> = [];
  private maxHistorySize: number = 100; // Mantiene gli ultimi 100 punti

  constructor(private servient: Servient) {
    // Aggiungi il client HTTP per consumare altri Thing
    this.servient.addClientFactory(new HttpClientFactory());
  }

  async init(): Promise<void> {
    try {
      console.log("\n[ORCHESTRATOR] Inizializzazione in corso...");

      this.wot = await this.servient.start();

      // Funzione di retry per gestire il caricamento asincrono dei Thing
      const fetchWithRetry = async (url: string, retries = 5, delay = 1000): Promise<WoT.ThingDescription> => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json() as WoT.ThingDescription;
          } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`  [RETRY] Tentativo ${i + 1}/${retries} fallito per ${url}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
        throw new Error("Impossibile recuperare la Thing Description");
      };

      // Connessione al sensore di luminosità (porta 8080)
      const lightTD = await fetchWithRetry("http://localhost:8080/light-sensor");
      this.lightSensor = await this.wot.consume(lightTD);
      console.log("  [OK] Sensore luminosità connesso");

      // Connessione al sensore di umidità (porta 8080)
      const humidityTD = await fetchWithRetry("http://localhost:8080/humidity-sensor");
      this.humiditySensor = await this.wot.consume(humidityTD);
      console.log("  [OK] Sensore umidità connesso");

      // Connessione alla pompa (porta 8083)
      const pumpTD = await fetchWithRetry("http://localhost:8080/irrigation-pump");
      this.pump = await this.wot.consume(pumpTD);
      console.log("  [OK] Pompa irrigazione connessa");

      console.log("\n[ORCHESTRATOR] Inizializzazione completata!");
      console.log(`  Soglia umidità minima: ${this.minSoilMoisture}%`);
      console.log(`  Soglia umidità massima: ${this.maxSoilMoisture}%`);
      console.log(`  Luce minima per irrigazione: ${this.minLightForIrrigation} lux\n`);
    } catch (error) {
      console.error("[ERROR] Errore durante l'inizializzazione dell'orchestrator:", error);
      throw error;
    }
  }

  private async checkAndIrrigate(): Promise<void> {
    try {
      // Verifica che tutti i dispositivi siano connessi
      if (!this.humiditySensor || !this.lightSensor || !this.pump) {
        return;
      }

      // Lettura dei sensori
      const soilMoistureData = await this.humiditySensor.readProperty("soilMoisture");
      const soilMoisture = await soilMoistureData?.value() as number;
      
      const luminosityData = await this.lightSensor.readProperty("luminosity");
      const luminosity = await luminosityData?.value() as number;
      
      const isPumpingData = await this.pump.readProperty("isPumping");
      const isPumping = await isPumpingData?.value() as boolean;

      const temperatureData = await this.humiditySensor?.readProperty("temperature");
      const temperature = await temperatureData?.value() as number;

      this.addToHistory({
        timestamp: Date.now(),
        soilMoisture,
        temperature,
        luminosity,
        isPumping
      });

      // Log stato attuale
      const now = new Date().toLocaleTimeString('it-IT');
      console.log(`[${now}] Umidità: ${soilMoisture.toFixed(1)}% | Luce: ${luminosity.toFixed(0)} lux | Pompa: ${isPumping ? 'ATTIVA' : 'Spenta'}`);

      // LOGICA DI IRRIGAZIONE
      if (!this.isAutoMode) {
        console.log("   [MODE] Modalità manuale - automazione disabilitata")
        return
      }
      
      // Se la pompa è attiva e l'umidità ha raggiunto il massimo -> FERMA
      if (isPumping && soilMoisture >= this.maxSoilMoisture) {
        console.log(`  [STOP] Umidità massima raggiunta (${this.maxSoilMoisture}%)`);

        // Notifica il sensore che la pompa si sta fermando
        if (this.humiditySensorThing) {
          this.humiditySensorThing.setPumpStatus(false);
        }
        
        await this.pump.invokeAction("stopPump");
        return;
      }

      // Se l'umidità è bassa e c'è luce -> AVVIA irrigazione
      if (soilMoisture < this.minSoilMoisture && !isPumping) {
        if (luminosity >= this.minLightForIrrigation) {
          console.log(`  [START] Avvio irrigazione (umidità troppo bassa)`);
          await this.startIrrigation();
        } else {
          console.log(`  [WAIT] Luce insufficiente per irrigare`);
        }
      }
    } catch (error) {
      // Errore silenzioso durante il caricamento iniziale
    }
  }

  private addToHistory(dataPoint: {
    timestamp: number;
    soilMoisture: number;
    temperature: number;
    luminosity: number;
    isPumping: boolean;
  }): void {
    this.dataHistory.push(dataPoint);

    // Mantieni solo gli ultimi maxHistorySize punti
    if (this.dataHistory.length > this.maxHistorySize) {
      this.dataHistory.shift();
    }
  }

  private async startIrrigation(): Promise<void> {
    try {
      const soilMoistureData = await this.humiditySensor?.readProperty("soilMoisture");
      const soilMoisture = await soilMoistureData?.value() as number;
      
      // Calcola durata in base al deficit di umidità
      const moistureDeficit = this.maxSoilMoisture - soilMoisture;
      const duration = Math.min(Math.max(moistureDeficit * 2, 10), 60);

      console.log(`\n[START] Avvio irrigazione per ${duration} secondi...`);
      
      // Notifica il sensore che la pompa sta per attivarsi
      if (this.humiditySensorThing) {
        this.humiditySensorThing.setPumpStatus(true);
      }
      
      await this.pump?.invokeAction("startPump", {
        duration: duration,
        flowRate: 15,
      });
    } catch (error) {
      console.error("[ERROR] Errore durante l'avvio dell'irrigazione:", error);
    }
  }
  
  async stopIrrigation(): Promise<void> {
    console.log("\n[STOP] Interruzione irrigazione manuale...");

    // Notifica il sensore che la pompa si sta fermando
    if (this.humiditySensorThing) {
      this.humiditySensorThing.setPumpStatus(false);
    }

    await this.pump?.invokeAction("stopPump");
  }

  startMonitoring(intervalSeconds: number = 5): void {
    console.log(`[ORCHESTRATOR] Monitoraggio attivo (ogni ${intervalSeconds}s)\n`);
    
    this.checkInterval = setInterval(async () => {
      await this.checkAndIrrigate();
    }, intervalSeconds * 1000);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("[ORCHESTRATOR] Monitoraggio fermato");
    }
  }

  toggleAutoMode(): void {
    this.isAutoMode = !this.isAutoMode;
    console.log(`\n[ORCHESTRATOR] Modalità Automatica: ${this.isAutoMode ? 'ATTIVA' : 'DISATTIVATA'}`);
  }

  async destroy(): Promise<void> {
    this.stopMonitoring();
    console.log("[ORCHESTRATOR] Terminato");
  }
}