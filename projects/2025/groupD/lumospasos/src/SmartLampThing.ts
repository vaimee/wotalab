import WoT from "wot-typescript-definitions";
import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { MqttBrokerServer } from "@node-wot/binding-mqtt";
import * as fs from "fs";

const HTTP_PORT = 8081;
const MQTT_URI = "mqtt://localhost";

export class SmartLampThing {
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;

    private brightness = 255;
    private colorTemperature = 127;

    constructor(runtime: typeof WoT, target: WoT.ThingDescription) {
        this.runtime = runtime;
        this.target = target;
    }

    async start() {
        this.thing = await this.runtime.produce(this.target);

        this.thing.setPropertyReadHandler("brightness", async () => this.brightness);
        this.thing.setPropertyWriteHandler("brightness", async (value) => {
            const num = Number(await value.value());
            if (num >= 0 && num <= 255) {
                this.brightness = num;
                console.log(`[SmartLamp] Brightness set to ${this.brightness}`);
                this.thing.emitPropertyChange("brightness");
            }
        });

        this.thing.setPropertyReadHandler("colorTemperature", async () => this.colorTemperature);
        this.thing.setPropertyWriteHandler("colorTemperature", async (value) => {
            const num = Number(await value.value());
            if (num >= 0 && num <= 255) {
                this.colorTemperature = num;
                console.log(`[SmartLamp] Color temperature set to ${this.colorTemperature}`);
                this.thing.emitPropertyChange("colorTemperature");
            }
        });

        this.thing.setActionHandler("turnOff", async () => {
            this.brightness = 0;
            console.log("[SmartLamp] Turned off");
            this.thing.emitPropertyChange("brightness");
            return undefined;
        });

        this.thing.setActionHandler("turnOn", async () => {
            if (this.brightness === 0) this.brightness = 255;
            console.log(`[SmartLamp] Turned on (brightness: ${this.brightness})`);
            this.thing.emitPropertyChange("brightness");
            return undefined;
        });

        await this.thing.expose();
        console.info(`[SmartLamp] ${(this.target as any).title} ready on port ${HTTP_PORT}`);
    }
}
