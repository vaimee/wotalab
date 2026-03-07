import { Servient } from "@node-wot/core";
import httpBinding from "@node-wot/binding-http";

import { createPresenceSensor } from "./things/presenceSensor.js";
import { createWindowSensor } from "./things/windowSensor.js";
import { createLightSensor } from "./things/lightSensor.js";
import { createTempHumiditySensor } from "./things/tempHumiditySensor.js";
import { createRelayActuator } from "./things/relayActuator.js";
import { createHouseController } from "./things/houseController.js";
import { startRoomOrchestrator } from "./orchestrators/roomOrchestrator.js";

const { HttpServer } = httpBinding;

async function main() {
  const servient = new Servient();
  servient.addServer(new HttpServer({ port: 8080 }));

  const wot = await servient.start();

  const controller = await createHouseController(wot as any);


  const presence = await createPresenceSensor(wot as any);
  const windowS = await createWindowSensor(wot as any);
  const lightActuator = await createRelayActuator(wot as any, "light-actuator.tm.json");
  const boilerActuator = await createRelayActuator(wot as any, "boiler-actuator.tm.json");

  const light = await createLightSensor(
    wot as any,
    () => lightActuator.state.isOn,
    () => windowS.state.isOpen
  );

  const th = await createTempHumiditySensor(
    wot as any,
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

  await presence.thing.expose();
  await windowS.thing.expose();
  await light.thing.expose();
  await th.thing.expose();
  await lightActuator.thing.expose();
  await boilerActuator.thing.expose();
  await controller.thing.expose();

  const stopOrch = startRoomOrchestrator({
    presence,
    windowS,
    light,
    th,
    lightActuator,
    boilerActuator,
    controller
  });

  setInterval(() => {
    console.log(
      "STAT",
      "mode=", controller.state.currentMode,
      "alarm=", controller.state.alarmActive ? "!! ALARM !!" : "ok",
      "pres=", presence.state.presence,
      "win=", windowS.state.isOpen,
      "lux=", Math.round(light.state.illuminanceLux),
      "t=", th.state.temperature.toFixed(1),
      "light=", lightActuator.state.isOn,
      "boiler=", boilerActuator.state.isOn
    );
  }, 2000);

  console.log("WoT API: http://localhost:8080");
  console.log("Controller: http://localhost:8080/housecontroller");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
