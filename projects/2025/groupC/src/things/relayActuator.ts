import { loadTdJson } from "../td/loadTd.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type RelayState = {
  isOn: boolean;
  mode: "manual" | "auto";
  status: "online" | "offline" | "error";
};

export async function createRelayActuator(wot: WoTLike) {
  const td = loadTdJson("relay-actuator.tm.json");
  const thing = await wot.produce(td);

  const state: RelayState = {
    isOn: false,
    mode: "auto",
    status: "online",
  };

  thing.setPropertyReadHandler("isOn", async () => state.isOn);
  thing.setPropertyReadHandler("mode", async () => state.mode);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setPropertyWriteHandler("isOn", async (v: unknown) => {
    const next = Boolean(v);
    const changed = next !== state.isOn;
    state.isOn = next;
    if (changed) thing.emitEvent("stateChanged", state.isOn);
  });

  thing.setPropertyWriteHandler("mode", async (v: unknown) => {
    state.mode = v === "manual" ? "manual" : "auto";
  });

  const setRelay = (v: boolean) => {
    const changed = v !== state.isOn;
    state.isOn = v;
    if (changed) thing.emitEvent("stateChanged", state.isOn);
    return true;
  };

  thing.setActionHandler("turnOn", async () => setRelay(true));
  thing.setActionHandler("turnOff", async () => setRelay(false));
  thing.setActionHandler("toggle", async () => setRelay(!state.isOn));

  thing.setActionHandler("reset", async () => {
    state.status = "online";
    return true;
  });

  const setStatus = (v: RelayState["status"]) => {
    state.status = v;
  };

  return { thing, state, setRelay, setStatus };
}
