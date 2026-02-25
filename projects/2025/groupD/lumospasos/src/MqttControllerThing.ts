import WoT from "wot-typescript-definitions";
import mqtt, { MqttClient } from "mqtt";

export class MqttControllerThing {
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;
    private mqttClient!: MqttClient;
    private mqttUri: string;

    constructor(runtime: typeof WoT, target: WoT.ThingDescription, mqttUri: string) {
        this.runtime = runtime;
        this.target = target;
        this.mqttUri = mqttUri;
    }

    async start() {
        this.mqttClient = mqtt.connect(this.mqttUri);
        this.mqttClient.on("connect", () => console.log("[MqttController] Connected to MQTT broker"));

        this.thing = await this.runtime.produce(this.target);

        this.thing.setActionHandler("publishCommand", async (params) => {
            const data = await params.value() as any;
            const topic = data?.topic || "paso";
            const payload = data?.payload || "{}";
            console.log(`[MqttController] Publishing to ${topic}: ${payload}`);
            this.mqttClient.publish(topic, payload);
            return undefined;
        });

        await this.thing.expose();
        console.info(`[MqttController] ${(this.target as any).title} ready`);
    }
}
