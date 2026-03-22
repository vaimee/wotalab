import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { IrrigationPumpThing } from "./IrrigationPumpThing";
import { LightSensorThing } from "./LightSensorThing";
import { HumiditySensorThing } from "./HumiditySensorThing";
import { IrrigationOrchestrator } from "./Orchestrator";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import * as http from "http";
import * as path from "path";

async function main() {
  console.log("============================================================");
  console.log("   SISTEMA DI IRRIGAZIONE INTELLIGENTE - WoT");
  console.log("============================================================\n");

  try {
    // 1. Setup Express per servire la dashboard web
    const app = express();
    const server = http.createServer(app);
    
    // Servire file statici dalla directory principale e www
    app.use(express.static(path.join(__dirname, '..')));
    app.use(express.json());
    
    // Route per la homepage
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'www', 'index.html'));
    });

    // API endpoint per ottenere lo stato del sistema
    let orchestrator: IrrigationOrchestrator;
    app.get('/api/status', async (req, res) => {
      try {
        const status = await orchestrator.getSystemStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: 'Errore nel recupero dello stato' });
      }
    });

    // Avvia server HTTP su porta 3000
    const WEB_PORT = 3000;
    server.listen(WEB_PORT, () => {
      console.log(`[WEB] Dashboard disponibile su: http://localhost:${WEB_PORT}`);
      console.log(`      Apri il browser e vai a http://localhost:${WEB_PORT}\n`);
    });

    // 2. Setup WebSocket Server per aggiornamenti real-time
    const wss = new WebSocketServer({ server });
    console.log("🔌 WebSocket Server inizializzato\n");

    // 3. Crea un unico servient per tutti i dispositivi WoT
    const servient = new Servient();
    servient.addServer(new HttpServer({ port: 8080 }));

    // Servient per l'orchestratore (solo client)
    const orchestratorServient = new Servient();

    console.log("[MAIN] Inizializzazione Things...");

  // Tutti usano lo stesso servient
  const lightSensor = new LightSensorThing(servient, 8080);
  await lightSensor.init();
  
  const humiditySensor = new HumiditySensorThing(servient, 8080);
  await humiditySensor.init();

  const pumpThing = new IrrigationPumpThing(servient, 8080);
  await pumpThing.init();

  console.log("[MAIN] Things avviati con successo");

  // Attendi un momento per assicurarsi che i server HTTP siano pronti
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Inizializza l'orchestratore
  console.log("[MAIN] Inizializzazione orchestratore...");
  orchestrator = new IrrigationOrchestrator(orchestratorServient);
  await orchestrator.init();

  // 4. Gestione connessioni WebSocket
  wss.on('connection', (ws: WebSocket) => {
    orchestrator.addWebSocketClient(ws);

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'updateConfig':
            orchestrator.updateConfiguration(data.config);
            break;
          
          case 'manualStart':
            await orchestrator.manualIrrigation(data.duration || 30, data.flowRate || 15);
            break;
          
          case 'manualStop':
            await orchestrator.stopIrrigation();
            break;
          
          case 'toggleAuto':
            orchestrator.toggleAutoMode();
            break;
          
          case 'getStatus':
            const status = await orchestrator.getSystemStatus();
            ws.send(JSON.stringify({ type: 'status', data: status }));
            break;
        }
      } catch (error) {
        console.error('Errore elaborazione messaggio WebSocket:', error);
      }
    });
  });

  // 5. Avvia le simulazioni
  lightSensor.startSimulation();
  humiditySensor.startSimulation();

  // 6. Connetti il sensore di umidità con l'orchestrator per simulazione realistica
  orchestrator.setHumiditySensor(humiditySensor);

  // 7. Avvia il monitoraggio automatico (ogni 5 secondi per aggiornamenti real-time)
  orchestrator.startMonitoring(5);

  console.log("\n============================================================");
  console.log("   SISTEMA AVVIATO - Dashboard disponibile su porta 3000");
  console.log("============================================================\n");

  console.log("\n--- COMANDI DISPONIBILI ---");
  console.log("  's' - Stato del sistema");
  console.log("  'a' - Toggle modalità automatica");
  console.log("  'm' - Irrigazione manuale (30 secondi)");
  console.log("  'x' - Ferma irrigazione");
  console.log("  'q' - Esci\n");

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", async (key) => {
    const command = key.toString();

    if (command === "q") {
      console.log("\n\n[STOP] Arresto del sistema...");
      await cleanup();
      process.exit(0);
    } else if (command === "s") {
      const status = await orchestrator.getSystemStatus();
      console.log("\n--- STATO DEL SISTEMA ---");
      console.log(`   Umidità terreno : ${status.sensors.soilMoisture?.toFixed(1)}%`);
      console.log(`   Temperatura     : ${status.sensors.temperature?.toFixed(1)}°C`);
      console.log(`   Luminosità      : ${status.sensors.luminosity?.toFixed(0)} lux`);
      console.log(`   Pompa           : ${status.pump.isPumping ? "IN FUNZIONE" : "FERMA"}`);
      console.log(`   Acqua totale    : ${status.pump.totalWaterUsed?.toFixed(2)} L\n`);
    } else if (command === "a") {
      orchestrator.toggleAutoMode();
    } else if (command === "m") {
      await orchestrator.manualIrrigation(30);
    } else if (command === "x") {
      await orchestrator.stopIrrigation();
    }
  });

  async function cleanup() {
    console.log("[MAIN] Pulizia risorse...");
    orchestrator.stopMonitoring();
    lightSensor.stopSimulation();
    humiditySensor.stopSimulation();
    wss.close();
    server.close();
    await orchestrator.destroy();
    await lightSensor.destroy();
    await humiditySensor.destroy();
    await pumpThing.destroy();
  }

  process.on("SIGINT", async () => {
    console.log("\n[MAIN] Arresto in corso...");
    await cleanup();
    process.exit(0);
  });
  } catch (error) {
    console.error("[ERROR] Errore fatale:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
});