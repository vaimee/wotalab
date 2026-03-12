import { every } from "../utils/sim.js";

type Presence = { state: { presence: boolean; status: string } };
type WindowS = { state: { isOpen: boolean; status: string } };
type Light = { state: { illuminanceLux: number; status: string } };
type TH = { state: { temperature: number; status: string } };
type Relay = {
  state: { isOn: boolean; mode: "manual" | "auto"; status: string };
  setRelay: (v: boolean) => Promise<boolean> | boolean;
};
type HouseController = {
  state: { currentMode: string; alarmActive: boolean };
  triggerAlarm: (reason: string) => Promise<void>;
};

export type OrchestratorDeps = {
  presence: Presence;
  windowS: WindowS;
  light: Light;
  th: TH;
  lightActuator: Relay;
  boilerActuator: Relay;
  controller: HouseController;
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
  
  return every(intervalMs, async () => {
    const { currentMode } = deps.controller.state;

    // --- LOGIC 1: SECURITY (VACATION MODE) ---
    if (currentMode === "VACATION") {
      if (deps.presence.state.presence && deps.presence.state.status === "online") {
        await deps.controller.triggerAlarm("Intrusion: Movement detected while in VACATION mode!");
      }
      if (deps.windowS.state.isOpen && deps.windowS.state.status === "online") {
        await deps.controller.triggerAlarm("Intrusion: Window opened while in VACATION mode!");
      }
    }

    // --- LOGIC 2: CLIMATE & ECO SAVINGS ---
    // Change thresholds based on mode
    let tOn = opts.tempOnThreshold ?? 19;
    let tOff = opts.tempOffThreshold ?? 22;

    if (currentMode === "ECO") {
      tOn = 16; // Lower target temperature for ECO
      tOff = 18;
    } else if (currentMode === "NIGHT") {
      tOn = 18;
      tOff = 20;
    }

    // --- LIGHT LOGIC ---
    if (deps.lightActuator.state.status === "online" && deps.lightActuator.state.mode === "auto") {
      const presenceOk = deps.presence.state.status === "online" && deps.presence.state.presence;
      const lux = deps.light.state.status === "online" ? deps.light.state.illuminanceLux : 999999;
      
      const luxOn = opts.luxOnThreshold ?? 200;
      const luxOff = opts.luxOffThreshold ?? 260;

      // In VACATION or ECO, we might want lights always OFF unless alarm
      if (currentMode === "VACATION" || currentMode === "ECO" || !presenceOk) {
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

      if (windowOpen || currentMode === "VACATION") {
        // Stop heating if window is open or we are away
        if (deps.boilerActuator.state.isOn) await deps.boilerActuator.setRelay(false);
      } else {
        if (temp < tOn && !deps.boilerActuator.state.isOn) {
          await deps.boilerActuator.setRelay(true);
        } else if (temp >= tOff && deps.boilerActuator.state.isOn) {
          await deps.boilerActuator.setRelay(false);
        }
      }
    }
  });
}
