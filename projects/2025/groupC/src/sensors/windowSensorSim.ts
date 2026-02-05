import { every, rareToggle } from "../utils/sim.js";

export type WindowSimDeps = {
  getIsOpen: () => boolean;
  getStatus: () => "online" | "offline" | "error";
  setIsOpen: (v: boolean) => Promise<void> | void;
};

export type WindowSimOptions = {
  intervalMs?: number;
  toggleProbability?: number;
};

export function startWindowSimulation(
  deps: WindowSimDeps,
  opts: WindowSimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1500;
  const p = opts.toggleProbability ?? 0.01;

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    const current = deps.getIsOpen();
    const next = rareToggle(current, p);

    if (next !== current) {
      await deps.setIsOpen(next);
    }
  });
}
