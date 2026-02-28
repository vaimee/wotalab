import { every } from "../utils/sim.js";

type Presence = { state: { presence: boolean; status: string } };
type WindowS = { state: { isOpen: boolean; status: string } };
type Light = { state: { illuminanceLux: number; status: string } };
type TH = { state: { temperature: number; humidityPct: number; status: string } };
type Relay = {
  state: { isOn: boolean; mode: "manual" | "auto"; status: string };
  setRelay: (v: boolean) => Promise<boolean> | boolean;
};

export type OrchestratorDeps = {
  presence: Presence;
  windowS: WindowS;
  light: Light;
  th: TH;
  lightActuator: Relay;
  boilerActuator: Relay;
};

export type OrchestratorOptions = {
  intervalMs?: number;
  luxOnThreshold?: number;
  luxOffThreshold?: number;
  tempOnThreshold?: number;
  tempOffThreshold?: number;
};

export function startRoomOrchestrator(
  deps: OrchestratorDeps,
  opts: OrchestratorOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1000;
  const luxOn = opts.luxOnThreshold ?? 200;
  const luxOff = opts.luxOffThreshold ?? 260;
  const tempOn = opts.tempOnThreshold ?? 19;
  const tempOff = opts.tempOffThreshold ?? 22;

  return every(intervalMs, async () => {
    // --- LIGHT LOGIC ---
    if (deps.lightActuator.state.status === "online" && deps.lightActuator.state.mode === "auto") {
      const presenceOk = deps.presence.state.status === "online" && deps.presence.state.presence;
      const lux = deps.light.state.status === "online" ? deps.light.state.illuminanceLux : 999999;

      if (!presenceOk) {
        if (deps.lightActuator.state.isOn) await deps.lightActuator.setRelay(false);
      } else {
        if (lux < luxOn && !deps.lightActuator.state.isOn) {
          await deps.lightActuator.setRelay(true);
        } else if (lux >= luxOff && deps.lightActuator.state.isOn) {
          await deps.lightActuator.setRelay(false);
        }
      }
    }

    // --- BOILER LOGIC ---
    if (deps.boilerActuator.state.status === "online" && deps.boilerActuator.state.mode === "auto") {
      const windowOpen = deps.windowS.state.status === "online" && deps.windowS.state.isOpen;
      const temp = deps.th.state.status === "online" ? deps.th.state.temperature : 99;

      if (windowOpen) {
        // Stop heating if window is open to save energy
        if (deps.boilerActuator.state.isOn) await deps.boilerActuator.setRelay(false);
      } else {
        if (temp < tempOn && !deps.boilerActuator.state.isOn) {
          await deps.boilerActuator.setRelay(true);
        } else if (temp >= tempOff && deps.boilerActuator.state.isOn) {
          await deps.boilerActuator.setRelay(false);
        }
      }
    }
  });
}
