import WoT from "wot-typescript-definitions";
// @ts-ignore
import NodeWebcam from "node-webcam";
import { Jimp } from "jimp";

const CAPTURE_INTERVAL_MS = 3000;

interface Color {
    r: number;
    g: number;
    b: number;
}

const webcamOpts = {
    width: 320,
    height: 240,
    quality: 50,
    frames: 1,
    delay: 0,
    saveShots: true,
    output: "jpeg",
    device: false,
    callbackReturn: "location",
    verbose: false,
};

export class RGBSensorThing {
    private runtime: typeof WoT;
    private target: WoT.ThingDescription;
    private thing!: WoT.ExposedThing;

    private roomColor: Color = { r: 0, g: 0, b: 0 };

    constructor(runtime: typeof WoT, target: WoT.ThingDescription) {
        this.runtime = runtime;
        this.target = target;
    }

    async start() {
        this.thing = await this.runtime.produce(this.target);

        this.thing.setPropertyReadHandler("color", async () => ({ ...this.roomColor }));

        await this.thing.expose();
        console.info(`[RGBSensor] ${(this.target as any).title} ready`);

        setInterval(async () => {
            try {
                const color = await this.captureAverageColor();
                this.roomColor = color;
                this.thing.emitPropertyChange("color");
            } catch (err) {
                console.error("[RGBSensor] Capture error:", err);
            }
        }, CAPTURE_INTERVAL_MS);
    }

    private captureAverageColor(): Promise<Color> {
        return new Promise((resolve, reject) => {
            const webcam = NodeWebcam.create(webcamOpts);
            webcam.capture("sensor_capture", async (err: Error | null, imagePath: string) => {
                if (err) return reject(err);
                try {
                    const image = await Jimp.read(imagePath);
                    let rSum = 0, gSum = 0, bSum = 0, count = 0;
                    const { width, height, data } = image.bitmap;
                    for (let i = 0; i < width * height * 4; i += 4) {
                        rSum += data[i];
                        gSum += data[i + 1];
                        bSum += data[i + 2];
                        count++;
                    }
                    resolve({
                        r: Math.round(rSum / count),
                        g: Math.round(gSum / count),
                        b: Math.round(bSum / count),
                    });
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
