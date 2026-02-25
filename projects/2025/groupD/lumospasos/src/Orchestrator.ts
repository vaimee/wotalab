import WoT from "wot-typescript-definitions";
import { Servient } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import express from "express";
import path from "path";

const WEB_PORT = 4000;
const LAMP_URL = "http://localhost:8081/smart-lamp";
const SENSOR_URL = "http://localhost:8081/rgb-sensor";
const CONTROLLER_URL = "http://localhost:8081/mqtt-controller";
const MQTT_TOPIC = "paso";

interface Color {
    r: number;
    g: number;
    b: number;
}

export default class Orchestrator {
    private lampThing!: WoT.ConsumedThing;
    private sensorThing!: WoT.ConsumedThing;
    private controllerThing!: WoT.ConsumedThing;

    private currentMode: "manual" | "automatic" = "manual";
    private targetColor: Color = { r: 255, g: 255, b: 255 };
    private currentRoomColor: Color = { r: 0, g: 0, b: 0 };
    private currentLampBrightness = 255;
    private currentLampTemp = 127;

    async start() {
        console.log("[Orchestrator] Starting...");

        // --- WoT setup: consume remote things ---
        const servient = new Servient();
        servient.addClientFactory(new HttpClientFactory(null));
        const wotRuntime = await servient.start();

        const lampTD = await wotRuntime.requestThingDescription(LAMP_URL);
        const sensorTD = await wotRuntime.requestThingDescription(SENSOR_URL);
        const controllerTD = await wotRuntime.requestThingDescription(CONTROLLER_URL);

        this.lampThing = await wotRuntime.consume(lampTD);
        this.sensorThing = await wotRuntime.consume(sensorTD);
        this.controllerThing = await wotRuntime.consume(controllerTD);

        // Observe sensor color → automatic mode compensation
        this.sensorThing.observeProperty(
            "color",
            async (data) => {
                const color = await data.value() as any as Color;
                this.currentRoomColor = color;

                if (this.currentMode === "automatic") {
                    const comp = Orchestrator.computeCompensation(this.targetColor, color);
                    await this.lampThing.writeProperty("brightness", comp.brightness);
                    await this.lampThing.writeProperty("colorTemperature", comp.temperature);
                    this.currentLampBrightness = comp.brightness;
                    this.currentLampTemp = comp.temperature;

                    const payload = JSON.stringify({
                        mode: "automatic",
                        brightness: comp.brightness,
                        temperature: comp.temperature,
                    });
                    await this.controllerThing.invokeAction("publishCommand", { topic: MQTT_TOPIC, payload });
                }
            },
            (err) => console.error("[Orchestrator] Error observing sensor color:", err)
        );

        // Track lamp property changes
        this.lampThing.observeProperty(
            "brightness",
            async (data) => { this.currentLampBrightness = await data.value() as any; },
            (err) => console.error("[Orchestrator] Error observing lamp brightness:", err)
        );
        this.lampThing.observeProperty(
            "colorTemperature",
            async (data) => { this.currentLampTemp = await data.value() as any; },
            (err) => console.error("[Orchestrator] Error observing lamp temperature:", err)
        );

        console.log("[Orchestrator] WoT things connected");

        // --- Express web API ---
        this.startWebServer();
    }

    private startWebServer() {
        const app = express();
        app.use(express.static(path.join(__dirname, "../public")));
        app.use(express.json());

        app.get("/api/state", (_req, res) => {
            const computedLampColor = this.currentMode === "automatic"
                ? Orchestrator.computeCompensation(this.targetColor, this.currentRoomColor).color
                : Orchestrator.lampOutputColor(this.currentLampBrightness, this.currentLampTemp);

            res.json({
                mode: this.currentMode,
                targetColor: this.targetColor,
                roomColor: this.currentRoomColor,
                lampBrightness: this.currentLampBrightness,
                lampTemp: this.currentLampTemp,
                computedLampColor,
                computedMixedColor: Orchestrator.mixColors(computedLampColor, this.currentRoomColor),
            });
        });

        app.post("/api/mode", (req, res) => {
            const { mode } = req.body;
            if (mode === "manual" || mode === "automatic") {
                this.currentMode = mode;
                console.log(`[Orchestrator] Mode switched to ${mode}`);
                res.json({ status: "ok" });
            } else {
                res.status(400).json({ error: "Invalid mode" });
            }
        });

        app.post("/api/manual", async (req, res) => {
            if (this.currentMode !== "manual") {
                return res.status(400).json({ error: "Must be in manual mode" });
            }
            const brightness = req.body.brightness !== undefined ? Number(req.body.brightness) : undefined;
            const temperature = req.body.temperature !== undefined ? Number(req.body.temperature) : undefined;

            if (brightness !== undefined) {
                await this.lampThing.writeProperty("brightness", brightness);
                this.currentLampBrightness = brightness;
            }
            if (temperature !== undefined) {
                await this.lampThing.writeProperty("colorTemperature", temperature);
                this.currentLampTemp = temperature;
            }

            const payload = JSON.stringify({ mode: "manual", brightness, temperature });
            await this.controllerThing.invokeAction("publishCommand", { topic: MQTT_TOPIC, payload });
            res.json({ status: "ok" });
        });

        app.post("/api/automatic", (req, res) => {
            if (this.currentMode !== "automatic") {
                return res.status(400).json({ error: "Must be in automatic mode" });
            }
            const { r, g, b } = req.body;
            this.targetColor = { r: Number(r), g: Number(g), b: Number(b) };
            console.log(`[Orchestrator] Target color set to R:${r} G:${g} B:${b}`);
            res.json({ status: "ok" });
        });

        app.listen(WEB_PORT, () => {
            console.log(`[Orchestrator] Web interface at http://localhost:${WEB_PORT}`);
        });
    }

    // --- Private static helpers ---

    /** Compute the lamp's output RGB from brightness and color temperature. */
    private static lampOutputColor(brightness: number, temperature: number): Color {
        const t = temperature / 255;
        const b = brightness / 255;
        return {
            r: Math.round(t * b * 255),
            g: Math.round((0.3 + t * 0.4) * b * 255),
            b: Math.round((1 - t) * b * 255),
        };
    }

    /** Additive color mix, clamped to [0, 255]. */
    private static mixColors(a: Color, b: Color): Color {
        return {
            r: Math.min(255, a.r + b.r),
            g: Math.min(255, a.g + b.g),
            b: Math.min(255, a.b + b.b),
        };
    }

    /** In automatic mode, compute lamp = target - room (per-channel, clamped >= 0). */
    private static computeCompensation(
        target: Color,
        room: Color
    ): { color: Color; brightness: number; temperature: number } {
        const comp: Color = {
            r: Math.max(0, target.r - room.r),
            g: Math.max(0, target.g - room.g),
            b: Math.max(0, target.b - room.b),
        };

        const brightness = Math.max(comp.r, comp.g, comp.b);

        let temperature = 127;
        if (brightness > 0) {
            const rNorm = comp.r / brightness;
            const bNorm = comp.b / brightness;
            temperature = Math.round((rNorm / (rNorm + bNorm || 1)) * 255);
        }

        return { color: comp, brightness, temperature };
    }
}
