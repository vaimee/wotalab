import { every, RandomWalk } from "../utils/sim.js";

export type LightSimDeps = {
  getLux: () => number;
  getStatus: () => "online" | "offline" | "error";

  getLightActuatorState: () => boolean;
  getWindowState: () => boolean;
  setLux: (v: number) => Promise<void> | void;
};

export type LightSimOptions = {
  intervalMs?: number;
};

export function startLightSimulation(
  deps: LightSimDeps,
  opts: LightSimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 10000;

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    let target = 0;

    if (deps.getLightActuatorState()) {
      target += 500;
    }

    if (deps.getWindowState()) {
      target += 800; // daylight
    }

    if (target === 0) {
      target = 20; // some ambient minimal light
    }

    // Move gently toward target, with some random noise
    const current = deps.getLux();
    let next = current + (target - current) * 0.1 + (Math.random() - 0.5) * 5;
    next = Math.max(0, Math.min(100000, next));

    await deps.setLux(next);
  });
}
