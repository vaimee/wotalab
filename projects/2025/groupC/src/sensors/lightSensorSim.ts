import { every, RandomWalk } from "../utils/sim.js";

export type LightSimDeps = {
  getLux: () => number;
  getStatus: () => "online" | "offline" | "error";
  setLux: (v: number) => Promise<void> | void;
};

export type LightSimOptions = {
  intervalMs?: number;
  step?: number;
  min?: number;
  max?: number;
};

export function startLightSimulation(
  deps: LightSimDeps,
  opts: LightSimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1000;
  const step = opts.step ?? 50;
  const min = opts.min ?? 0;
  const max = opts.max ?? 100000;

  const walk = new RandomWalk(deps.getLux(), step, { min, max });

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    const next = walk.tick();
    await deps.setLux(next);
  });
}
