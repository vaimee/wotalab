import { loadTdJson } from "./loadTd.js";

type WoTLike = { produce: (td: any) => Promise<any>; };
export type WindowState = { isOpen: boolean; status: "online" | "offline" | "error"; };

export async function createWindowSensor(wot: WoTLike) {
  const td = loadTdJson("window-sensor.tm.json");
  const thing = await wot.produce(td);
  const state: WindowState = { isOpen: false, status: "online" };

  thing.setPropertyReadHandler("isOpen", async () => state.isOpen);
  thing.setPropertyWriteHandler("isOpen", async (v: any) => await setIsOpen(await v.value()));
  thing.setPropertyReadHandler("status", async () => state.status);
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setIsOpen = async (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.isOpen;
    state.isOpen = next;
    try { await thing.writeProperty("isOpen", state.isOpen); } catch { }
    if (changed) thing.emitEvent("windowStateChanged", state.isOpen);
  };

  const setStatus = async (v: WindowState["status"]) => {
    state.status = v;
    try { await thing.writeProperty("status", state.status); } catch { }
  };

  return { thing, state, setIsOpen, setStatus };
}
