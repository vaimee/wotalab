import { loadTdJson } from "../td/loadTd.js";

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
    state.status = "online";
    return true;
  });

  const setIsOpen = (v: boolean) => {
    const next = Boolean(v);
    const changed = next !== state.isOpen;
    state.isOpen = next;
    if (changed) thing.emitEvent("windowStateChanged", state.isOpen);
  };

  const setStatus = (v: WindowState["status"]) => {
    state.status = v;
  };

  return { thing, state, setIsOpen, setStatus };
}
