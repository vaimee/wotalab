import { loadTdJson } from "./loadTd.js";

type WoTLike = { produce: (td: any) => Promise<any>; };

export type PresenceState = {
  presence: boolean;
  status: "online" | "offline" | "error";
};

export async function createPresenceSensor(wot: WoTLike) {
  const td = loadTdJson("presence-sensor.tm.json");
  const thing = await wot.produce(td);
  const state: PresenceState = { presence: false, status: "online" };

  thing.setPropertyReadHandler("presence", async () => state.presence);
  thing.setPropertyWriteHandler("presence", async (v: any) => await setPresence(await v.value()));
  thing.setPropertyReadHandler("status", async () => state.status);
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setPresence = async (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.presence;
    state.presence = next;
    try { await thing.writeProperty("presence", state.presence); } catch { }
    if (changed) thing.emitEvent("presenceChanged", state.presence);
  };

  const setStatus = async (v: PresenceState["status"]) => {
    state.status = v;
    try { await thing.writeProperty("status", state.status); } catch { }
  };

  return { thing, state, setPresence, setStatus };
}
