import { Servient } from "@node-wot/core";
import httpBinding from "@node-wot/binding-http";

import { createPresenceSensor } from "./presenceSensor.js";
import { createWindowSensor } from "./windowSensor.js";
import { createLightSensor } from "./lightSensor.js";
import { startMqttTempHumiditySensor } from "./tempHumiditySensor.js";
import { createTempHumidityCache } from "./tempHumidityCache.js";
import { createRelayActuator } from "./relayActuator.js";
import { createHouseController } from "./houseController.js";
import { startRoomOrchestrator } from "./roomOrchestrator.js";

const { HttpServer } = httpBinding;


async function main() {
  // Avviamo un'entità Servient capace di funzionare sia come Producer che Consumer, configurandola per esporre
  // le estensioni di rete sulla porta 8080. Così facendo apriamo la rete all'esterno.
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8080 }));

  const wot = await servient.start();

  const controller = await createHouseController(wot as any);


  // Setup sensori e attuatori
  const presence = await createPresenceSensor(wot as any);
  const windowS = await createWindowSensor(wot as any);
  const lightActuator = await createRelayActuator(wot as any, "light-actuator.tm.json");
  const boilerActuator = await createRelayActuator(wot as any, "boiler-actuator.tm.json");

  const light = await createLightSensor(
    wot as any,
    () => lightActuator.state.isOn,
    () => windowS.state.isOpen
  );

  // Parte MQTT: Cache/Adapter e poi il sensore fisico
  // La cache deve partire prima perché fa anche da broker
  const thCache = await createTempHumidityCache(wot as any);

  // Il sensore è un semplice client MQTT (niente WoT qui)
  const th = await startMqttTempHumiditySensor(
    () => boilerActuator.state.isOn,
    () => windowS.state.isOpen
  );

  await presence.thing.expose();
  await windowS.thing.expose();
  await light.thing.expose();
  await lightActuator.thing.expose();
  await boilerActuator.thing.expose();
  await controller.thing.expose();

  // Avvio dell'orchestratore per l'automazione
  await startRoomOrchestrator();

  setInterval(() => {
    console.log(
      "LOG STATO:",
      "mode=", controller.state.currentMode,
      "alarm=", controller.state.alarmActive ? "!! ALARM !!" : "ok",
      "pres=", presence.state.presence,
      "win=", windowS.state.isOpen,
      "lux=", Math.round(light.state.illuminanceLux),
      "t(cache)=", (thCache.cache.get("temperature") ?? 0).toFixed(1),
      "h(cache)=", (thCache.cache.get("humidityPct") ?? 0).toFixed(1),
      "boiler=", boilerActuator.state.isOn
    );
  }, 30000);

  console.log("--- Exposed WoT APIs ---");
  console.log("Presence:        http://localhost:8080/presencesensor");
  console.log("Window:          http://localhost:8080/windowsensor");
  console.log("Light:           http://localhost:8080/lightsensor");
  console.log("Temp/Hum (MQTT): mqtt://localhost:1883/temphumiditysensor");
  console.log("Temp/Hum (Cache): http://localhost:8080/temphumiditysensor");
  console.log("Light Actuator:  http://localhost:8080/lightactuator");
  console.log("Boiler Actuator: http://localhost:8080/boileractuator");
  console.log("Controller:      http://localhost:8080/housecontroller");
  console.log("------------------------");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
