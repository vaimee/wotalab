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
  state: {
    currentMode: string;
    alarmActive: boolean;
    targetTemperatureHome: number;
    targetTemperatureNight: number;
    targetTemperatureEco: number;
    targetTemperatureAway: number;
  };
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

    // --- LOGIC 1: SECURITY (AWAY MODE) ---
    if (currentMode === "AWAY") {
      if (deps.presence.state.presence && deps.presence.state.status === "online") {
        await deps.controller.triggerAlarm("Intrusion: Movement detected while in AWAY mode!");
      }
      if (deps.windowS.state.isOpen && deps.windowS.state.status === "online") {
        await deps.controller.triggerAlarm("Intrusion: Window opened while in AWAY mode!");
      }
    }

    // --- LOGIC 2: ECO SAVINGS & TARGET TEMP ---
    let targetTemp = deps.controller.state.targetTemperatureHome ?? 22;
    if (currentMode === "NIGHT") {
      targetTemp = deps.controller.state.targetTemperatureNight ?? 19;
    } else if (currentMode === "ECO") {
      targetTemp = deps.controller.state.targetTemperatureEco ?? 18;
    } else if (currentMode === "AWAY") {
      targetTemp = deps.controller.state.targetTemperatureAway ?? 15;
    }

    let tOn = targetTemp - 0.5;
    let tOff = targetTemp + 0.5;

    // --- LIGHT LOGIC ---
    if (deps.lightActuator.state.status === "online" && deps.lightActuator.state.mode === "auto") {
      const presenceOk = deps.presence.state.status === "online" && deps.presence.state.presence;
      const lux = deps.light.state.status === "online" ? deps.light.state.illuminanceLux : 999999;

      const luxOn = opts.luxOnThreshold ?? 200;
      const luxOff = opts.luxOffThreshold ?? 260;

      // In AWAY or ECO, we might want lights always OFF unless alarm
      if (currentMode === "AWAY" || currentMode === "ECO" || !presenceOk) {
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

      if (windowOpen || currentMode === "AWAY") {
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
