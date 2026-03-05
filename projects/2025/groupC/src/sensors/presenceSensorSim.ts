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
  // Return an empty stop function. Presence is no longer simulated randomly.
  return () => { };
}
