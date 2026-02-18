import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { IrrigationPumpThing } from "./IrrigationPumpThing";
import { LightSensorThing } from "./LightSensorThing";

async function main() {
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8083 }));

  const pumpThing = new IrrigationPumpThing(servient, 8083);
  await pumpThing.init();
  
  const lightSensor = new LightSensorThing(servient, 8080);
  await lightSensor.init();

  console.log("[MAIN] Sistema di irrigazione avviato");
  console.log("[MAIN] Premi CTRL+C per terminare");

  async function cleanup() {
	await lightSensor.destroy();
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