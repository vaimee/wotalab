import * as fs from "fs";
import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { MqttBrokerServer } from "@node-wot/binding-mqtt";
import { SmartLampThing } from "./SmartLampThing";
import { RGBSensorThing } from "./RGBSensorThing";
import { MqttControllerThing } from "./MqttControllerThing";
import Orchestrator from "./Orchestrator";
import { wait } from "./utils/wait";

// https://www.w3.org/TR/wot-thing-description11/
(async function main() {
    console.log("---# LumoPaso - Ambient Lighting WoT System #---");

    const MQTT_URI = "mqtt://localhost";
    const WOT_INIT_DELAY_MS = 5000;

    // --- Shared servient: exposes all three Things ---
    const servient = new Servient();
    servient.addServer(new HttpServer({ port: 8081 }));  // lamp
    servient.addServer(new MqttBrokerServer({ uri: MQTT_URI }));
    const wotRuntime = await servient.start();

    // Load Thing Models
    const lampTD = JSON.parse(fs.readFileSync("./models/smart-lamp.tm.json").toString());
    const sensorTD = JSON.parse(fs.readFileSync("./models/rgb-sensor.tm.json").toString());
    const controllerTD = JSON.parse(fs.readFileSync("./models/mqtt-controller.tm.json").toString());

    // Start Things
    const lamp = new SmartLampThing(wotRuntime, lampTD);
    const sensor = new RGBSensorThing(wotRuntime, sensorTD);
    const controller = new MqttControllerThing(wotRuntime, controllerTD, MQTT_URI);

    await lamp.start();
    await sensor.start();
    await controller.start();

    console.log("-------------------------------------------");
    console.log(`Waiting ${WOT_INIT_DELAY_MS / 1000}s before starting orchestrator...`);

    await wait(WOT_INIT_DELAY_MS);

    // --- Orchestrator: consumes Things and runs control logic ---
    const orchestrator = new Orchestrator();
    await orchestrator.start();

    console.log("-------------------------------------------");
})();
