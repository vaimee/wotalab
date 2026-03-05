import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { IrrigationPumpThing } from "./IrrigationPumpThing";
import { LightSensorThing } from "./LightSensorThing";
import { HumiditySensorThing } from "./HumiditySensorThing";
import { IrrigationOrchestrator } from "./Orchestrator";

async function main() {
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8080 })); // imposta tutte le thing sulla porta 8080

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
  const orchestrator = new IrrigationOrchestrator(orchestratorServient);
  await orchestrator.init();

  // Avvia il monitoraggio automatico
  orchestrator.startMonitoring(5);

  // Avvia le simulazioni
  lightSensor.startSimulation();
  humiditySensor.startSimulation();

  // Connetti il sensore di umidità con l'orchestrator per simulazione realistica
  orchestrator.setHumiditySensor(humiditySensor)

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
      console.log(`  💧 Umidità terreno : ${status.sensors.soilMoisture?.toFixed(1)}%`);
      console.log(`  🌡️ Temperatura     : ${status.sensors.temperature?.toFixed(1)}°C`);
      console.log(`  ☀️ Luminosità      : ${status.sensors.luminosity?.toFixed(0)} lux`);
      console.log(`  ⚙️ Pompa           : ${status.pump.isPumping ? "IN FUNZIONE" : "FERMA"}`);
      console.log(`  🚰 Acqua totale    : ${status.pump.totalWaterUsed?.toFixed(2)} L\n`);
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
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
});