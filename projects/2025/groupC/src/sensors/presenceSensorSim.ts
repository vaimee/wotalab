import { every, rareToggle } from "../utils/sim.js";

export type PresenceSimDeps = {
  getPresence: () => boolean;
  getStatus: () => "online" | "offline" | "error";
  setPresence: (v: boolean) => Promise<void> | void;
};

export type PresenceSimOptions = {
  intervalMs?: number;
  toggleProbability?: number;
};

export function startPresenceSimulation(
  deps: PresenceSimDeps,
  opts: PresenceSimOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1000;
  const p = opts.toggleProbability ?? 0.05;

  return every(intervalMs, async () => {
    if (deps.getStatus() !== "online") return;

    const current = deps.getPresence();
    const next = rareToggle(current, p);

    if (next !== current) {
      await deps.setPresence(next);
    }
  });
}
