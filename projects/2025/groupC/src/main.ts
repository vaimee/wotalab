import { Servient } from "@node-wot/core";
import httpBinding from "@node-wot/binding-http";

import { createPresenceSensor } from "./presenceSensor.js";
import { createWindowSensor } from "./windowSensor.js";
import { createLightSensor } from "./lightSensor.js";
import { startMqttTempHumiditySensor } from "./tempHumiditySensor.js";
import { createTempHumidityAdapter } from "./tempHumidityAdapter.js";
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


  // Istanziamo e registriamo i vari dispositivi virtuali all'interno della rete
  const presence = await createPresenceSensor(wot as any);
  const windowS = await createWindowSensor(wot as any);
  const lightActuator = await createRelayActuator(wot as any, "light-actuator.tm.json");
  const boilerActuator = await createRelayActuator(wot as any, "boiler-actuator.tm.json");

  const light = await createLightSensor(
    wot as any,
    () => lightActuator.state.isOn,
    () => windowS.state.isOpen
  );

  // ---- SENSORE TEMPERATURA/UMIDITÀ VIA MQTT ----
  // Il sensore ha un Servient MQTT proprio (broker in-process su porta 1883).
  // I dati vengono pubblicati via protocol binding MQTT.
  const th = await startMqttTempHumiditySensor(
    () => boilerActuator.state.isOn,
    () => windowS.state.isOpen,
    () => {
      const mode = controller.state.currentMode;
      if (mode === "NIGHT") return controller.state.targetTemperatureNight;
      if (mode === "ECO") return controller.state.targetTemperatureEco;
      if (mode === "AWAY") return controller.state.targetTemperatureAway;
      return controller.state.targetTemperatureHome;
    }
  );

  // ---- ADAPTER HTTP (ponte MQTT → HTTP) ----
  // L'adapter consuma il sensore via MQTT e ri-espone i dati via HTTP
  // sull'URL /temphumiditysensor (stesso URL di prima, nessuna modifica per orchestratore/UI).
  const thAdapter = await createTempHumidityAdapter(wot as any, th.exposedTd);

  await presence.thing.expose();
  await windowS.thing.expose();
  await light.thing.expose();
  await thAdapter.thing.expose(); 
  await lightActuator.thing.expose();
  await boilerActuator.thing.expose();
  await controller.thing.expose();

  // Dopo aver agganciato e messo online tutti i nodi sensore e controller, facciamo partire 
  //l'Orchestrator che ciclicamente controlla i parametri e interviene.
  await startRoomOrchestrator();

  setInterval(() => {
    console.log(
      "STAT",
      "mode=", controller.state.currentMode,
      "alarm=", controller.state.alarmActive ? "!! ALARM !!" : "ok",
      "pres=", presence.state.presence,
      "win=", windowS.state.isOpen,
      "lux=", Math.round(light.state.illuminanceLux),
      "t=", th.state.temperature.toFixed(1),
      "t(adpt)=", thAdapter.adapter.temperature.toFixed(1),
      "light=", lightActuator.state.isOn,
      "boiler=", boilerActuator.state.isOn
    );
  }, 30000);

  console.log("--- Exposed WoT APIs ---");
  console.log("Presence:        http://localhost:8080/presencesensor");
  console.log("Window:          http://localhost:8080/windowsensor");
  console.log("Light:           http://localhost:8080/lightsensor");
  console.log("Temp/Hum (MQTT): mqtt://localhost:1883/temphumiditysensor");
  console.log("Temp/Hum (Adpt): http://localhost:8080/temphumiditysensor");
  console.log("Light Actuator:  http://localhost:8080/lightactuator");
  console.log("Boiler Actuator: http://localhost:8080/boileractuator");
  console.log("Controller:      http://localhost:8080/housecontroller");
  console.log("------------------------");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
