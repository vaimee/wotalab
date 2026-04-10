import { loadTdJson } from "./loadTd.js";

type WoTLike = { produce: (td: any) => Promise<any>; };

export type RelayState = {
  isOn: boolean;
  mode: "manual" | "auto";
  status: "online" | "offline" | "error";
};

export async function createRelayActuator(wot: WoTLike, modelName: string) {
  const td = loadTdJson(modelName);
  const thing = await wot.produce(td);

  const state: RelayState = { isOn: false, mode: "auto", status: "online" };

  // Colleghiamo gli handler in lettura per i parametri d'interesse
  thing.setPropertyReadHandler("isOn", async () => state.isOn);
  thing.setPropertyReadHandler("mode", async () => state.mode);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setPropertyWriteHandler("isOn", async (v: unknown) => {
    const val = await (v as any).value();
    const next = Boolean(val);
    const changed = next !== state.isOn;
    state.isOn = next;
    try { await thing.writeProperty("isOn", state.isOn); } catch {}
    if (changed) thing.emitEvent("stateChanged", state.isOn);
  });

  thing.setPropertyWriteHandler("mode", async (v: unknown) => {
    const val = await (v as any).value();
    state.mode = val === "manual" ? "manual" : "auto";
    try { await thing.writeProperty("mode", state.mode); } catch {}
  });

  const setRelay = async (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.isOn;
    state.isOn = next;
    try { await thing.writeProperty("isOn", state.isOn); } catch {}
    if (changed) thing.emitEvent("stateChanged", state.isOn);
    return true;
  };

  // Definiamo come questo attuatore debba rispondere quando qualcuno prova a interagire
  thing.setActionHandler("turnOn", async () => setRelay(true));
  thing.setActionHandler("turnOff", async () => setRelay(false));
  thing.setActionHandler("toggle", async () => setRelay(!state.isOn));
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setStatus = async (v: RelayState["status"]) => {
    state.status = v;
    try { await thing.writeProperty("status", state.status); } catch {}
  };

  return { thing, state, setRelay, setStatus };
}
