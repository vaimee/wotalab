import { Servient } from "@node-wot/core";
import httpBinding from "@node-wot/binding-http";

import { createPresenceSensor } from "./things/presenceSensor.js";
import { createWindowSensor } from "./things/windowSensor.js";
import { createLightSensor } from "./things/lightSensor.js";
import { createTempHumiditySensor } from "./things/tempHumiditySensor.js";
import { createRelayActuator } from "./things/relayActuator.js";
import { startRoomOrchestrator } from "./orchestrators/roomOrchestrator.js";

const { HttpServer } = httpBinding;

async function main() {
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8080 }));

  const wot = await servient.start();

  const presence = await createPresenceSensor(wot as any);
  const windowS = await createWindowSensor(wot as any);
  const light = await createLightSensor(wot as any);
  const th = await createTempHumiditySensor(wot as any);
  const relay = await createRelayActuator(wot as any);

  await presence.thing.expose();
  await windowS.thing.expose();
  await light.thing.expose();
  await th.thing.expose();
  await relay.thing.expose();

  const stopOrch = startRoomOrchestrator({ presence, windowS, light, th, relay });

  setInterval(() => {
  console.log(
    "SIM",
    "presence=", presence.state.presence,
    "window=", windowS.state.isOpen,
    "lux=", Math.round(light.state.illuminanceLux),
    "t=", th.state.temperature.toFixed(1),
    "h=", th.state.humidityPct.toFixed(1),
    "relay=", relay.state.isOn,
    "mode=", relay.state.mode
  );
}, 2000);

  console.log("WoT API: http://localhost:8080");

  console.log("presence: http://localhost:8080/presencesensor/properties/presence");
  console.log("window:   http://localhost:8080/windowsensor/properties/isOpen");
  console.log("light:    http://localhost:8080/lightsensor/properties/illuminanceLux");
  console.log("temp:     http://localhost:8080/temphumiditysensor/properties/temperature");
  console.log("hum:      http://localhost:8080/temphumiditysensor/properties/humidityPct");
  console.log("relay:    http://localhost:8080/relayactuator/properties/isOn");
  console.log("mode:     http://localhost:8080/relayactuator/properties/mode");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
