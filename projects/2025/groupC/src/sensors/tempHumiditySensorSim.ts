import { every, RandomWalk } from "../utils/sim.js";

export type TempHumiditySimDeps = {
  getTemperature: () => number;
  getHumidity: () => number;
  getStatus: () => "online" | "offline" | "error";
  setTempHumidity: (t: number, h: number) => Promise<void> | void;
};

export type TempHumiditySimOptions = {
  intervalMs?: number;
  tempStep?: number;
  humStep?: number;
  tempMin?: number;
  tempMax?: number;
  humMin?: number;
  humMax?: number;
};

export function startTempHumiditySimulation(
  deps: TempHumiditySimDeps,
  opts: TempHumiditySimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1500;

  const tempWalk = new RandomWalk(
    deps.getTemperature(),
    opts.tempStep ?? 0.3,
    { min: opts.tempMin ?? -10, max: opts.tempMax ?? 50 }
  );

  const humWalk = new RandomWalk(
    deps.getHumidity(),
    opts.humStep ?? 1.5,
    { min: opts.humMin ?? 0, max: opts.humMax ?? 100 }
  );

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    const t = tempWalk.tick();
    const h = humWalk.tick();

    await deps.setTempHumidity(t, h);
  });
}
