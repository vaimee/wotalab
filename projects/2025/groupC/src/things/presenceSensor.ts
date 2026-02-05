import { loadTdJson } from "../td/loadTd.js";
import { startPresenceSimulation } from "../sensors/presenceSensorSim.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type PresenceState = {
  presence: boolean;
  status: "online" | "offline" | "error";
};

export async function createPresenceSensor(wot: WoTLike) {
  const td = loadTdJson("presence-sensor.tm.json");
  const thing = await wot.produce(td);

  const state: PresenceState = {
    presence: false,
    status: "online",
  };

  thing.setPropertyReadHandler("presence", async () => state.presence);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setActionHandler("reset", async () => {
    await setStatus("online");
    return true;
  });

  const setPresence = async (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.presence;
    state.presence = next;
    await safeWrite(thing, "presence", state.presence);
    if (changed) thing.emitEvent("presenceChanged", state.presence);
  };

  const setStatus = async (v: PresenceState["status"]) => {
    state.status = v;
    await safeWrite(thing, "status", state.status);
  };

  const stopSim = startPresenceSimulation({
    getPresence: () => state.presence,
    getStatus: () => state.status,
    setPresence,
  });

  return { thing, state, setPresence, setStatus, stopSim };
}

async function safeWrite(thing: any, name: string, value: unknown) {
  try {
    await thing.writeProperty(name, value);
  } catch {}
}
