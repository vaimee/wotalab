import { every, RandomWalk } from "../utils/sim.js";

export type TempHumiditySimDeps = {
  getTemperature: () => number;
  getHumidity: () => number;
  getStatus: () => "online" | "offline" | "error";

  getBoilerState: () => boolean;
  getWindowState: () => boolean;
  getTargetTemp: () => number;
  setTempHumidity: (t: number, h: number) => Promise<void> | void;
};

export type TempHumiditySimOptions = {
  intervalMs?: number;
};

export function startTempHumiditySimulation(
  deps: TempHumiditySimDeps,
  opts: TempHumiditySimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 10000;

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    let t = deps.getTemperature();
    let h = deps.getHumidity();

    const isBoilerOn = deps.getBoilerState();
    const isWindowOpen = deps.getWindowState();
    const targetTemp = deps.getTargetTemp();

    if (isBoilerOn) {
      t += 0.5 + (Math.random() * 0.2);
      h -= 0.5 + (Math.random() * 0.2);
    } else {
      if (t > targetTemp) {
        t -= 0.2 + (Math.random() * 0.1);
      } else if (t < targetTemp - 0.5) {
        t += 0.2 + (Math.random() * 0.1);
      } else {
        t += (Math.random() - 0.5) * 0.2;
      }
    }

    if (isWindowOpen) {
      if (h < 60) h += 1.0 + (Math.random() * 0.5);
      if (t > 15) t -= 0.8 + (Math.random() * 0.3);
    } else {
      if (!isBoilerOn) {
        if (h > 45) {
          h -= 0.2 + (Math.random() * 0.1);
        } else if (h < 40) {
          h += 0.2 + (Math.random() * 0.1);
        } else {
          h += (Math.random() - 0.5) * 0.2;
        }
      }
    }

    t = Math.max(-10, Math.min(50, t));
    h = Math.max(0, Math.min(100, h));

    await deps.setTempHumidity(t, h);
  });
}
