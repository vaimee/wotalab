import { loadTdJson } from "../td/loadTd.js";
import { startWindowSimulation } from "../sensors/windowSensorSim.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type WindowState = {
  isOpen: boolean;
  status: "online" | "offline" | "error";
};

export async function createWindowSensor(wot: WoTLike) {
  const td = loadTdJson("window-sensor.tm.json");
  const thing = await wot.produce(td);

  const state: WindowState = {
    isOpen: false,
    status: "online",
  };

  thing.setPropertyReadHandler("isOpen", async () => state.isOpen);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setActionHandler("reset", async () => {
    await setStatus("online");
    return true;
  });

  const setIsOpen = async (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.isOpen;
    state.isOpen = next;
    await safeWrite(thing, "isOpen", state.isOpen);
    if (changed) thing.emitEvent("windowStateChanged", state.isOpen);
  };

  const setStatus = async (v: WindowState["status"]) => {
    state.status = v;
    await safeWrite(thing, "status", state.status);
  };

  const stopSim = startWindowSimulation({
    getIsOpen: () => state.isOpen,
    getStatus: () => state.status,
    setIsOpen,
  });

  return { thing, state, setIsOpen, setStatus, stopSim };
}

async function safeWrite(thing: any, name: string, value: unknown) {
  try {
    await thing.writeProperty(name, value);
  } catch {}
}
