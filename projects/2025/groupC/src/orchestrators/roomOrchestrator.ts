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
  relay: Relay;
};

export type OrchestratorOptions = {
  intervalMs?: number;
  luxOnThreshold?: number;
  luxOffThreshold?: number;
};

export function startRoomOrchestrator(
  deps: OrchestratorDeps,
  opts: OrchestratorOptions = {}
) {
  const intervalMs = opts.intervalMs ?? 1000;
  const luxOn = opts.luxOnThreshold ?? 200;
  const luxOff = opts.luxOffThreshold ?? 260;

  return every(intervalMs, async () => {
    if (deps.relay.state.status !== "online") return;
    if (deps.relay.state.mode !== "auto") return;

    const presenceOk =
      deps.presence.state.status === "online" && deps.presence.state.presence;

    const windowOpen =
      deps.windowS.state.status === "online" && deps.windowS.state.isOpen;

    const lux =
      deps.light.state.status === "online"
        ? deps.light.state.illuminanceLux
        : 999999;

    if (!presenceOk) {
      if (deps.relay.state.isOn) await deps.relay.setRelay(false);
      return;
    }

    if (windowOpen) {
      if (deps.relay.state.isOn) await deps.relay.setRelay(false);
      return;
    }

    if (lux < luxOn && !deps.relay.state.isOn) {
      await deps.relay.setRelay(true);
      return;
    }

    if (lux >= luxOff && deps.relay.state.isOn) {
      await deps.relay.setRelay(false);
      return;
    }
  });
}
