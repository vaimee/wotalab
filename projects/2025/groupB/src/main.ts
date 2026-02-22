import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { IrrigationPumpThing } from "./IrrigationPumpThing";
import { LightSensorThing } from "./LightSensorThing";
import { HumiditySensorThing } from "./HumiditySensorThing";
import { IrrigationOrchestrator } from "./Orchestrator";

async function main() {
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
  const orchestrator = new IrrigationOrchestrator(orchestratorServient);
  await orchestrator.init();

  // Avvia il monitoraggio automatico
  orchestrator.startMonitoring(5);

  console.log("\n[MAIN] Sistema di irrigazione completamente avviato");
  console.log("[MAIN] Premi CTRL+C per terminare\n");

  async function cleanup() {
    console.log("[MAIN] Pulizia risorse...");
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