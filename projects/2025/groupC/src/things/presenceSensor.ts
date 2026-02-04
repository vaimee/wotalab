import { loadTdJson } from "../td/loadTd.js";
type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type PresenceState = {
  presence: boolean;
  status: "online" | "offline" | "error";
};

export async function createPresenceSensor(wot:WoTLike) {
  const td = loadTdJson("presence-sensor.tm.json");
  const thing = await wot.produce(td);

  const state: PresenceState = {
    presence: false,
    status: "online",
  };

  thing.setPropertyReadHandler("presence", async () => state.presence);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setActionHandler("reset", async () => {
    state.status = "online";
    return true;
  });

  const setPresence = (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.presence;
    state.presence = next;
    if (changed) thing.emitEvent("presenceChanged", state.presence);
  };

  const setStatus = (v: PresenceState["status"]) => {
    state.status = v;
  };

  return { thing, state, setPresence, setStatus };
}
