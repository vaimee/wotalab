import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { IrrigationPumpThing } from "./IrrigationPumpThing";

async function main() {
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8083 }));

  const pumpThing = new IrrigationPumpThing(servient, 8083);
  await pumpThing.init();

  console.log("[MAIN] Sistema di irrigazione avviato");
  console.log("[MAIN] Premi CTRL+C per terminare");

  process.on("SIGINT", async () => {
    console.log("\n[MAIN] Arresto in corso...");
    await pumpThing.destroy();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("[ERROR]", error);
  process.exit(1);
});