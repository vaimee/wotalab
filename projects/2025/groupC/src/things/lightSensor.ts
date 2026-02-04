import { loadTdJson } from "../td/loadTd.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type LightState = {
  illuminanceLux: number;
  status: "online" | "offline" | "error";
};

export async function createLightSensor(wot: WoTLike) {
  const td = loadTdJson("light-sensor.tm.json");
  const thing = await wot.produce(td);

  const state: LightState = {
    illuminanceLux: 150,
    status: "online",
  };

  thing.setPropertyReadHandler("illuminanceLux", async () => state.illuminanceLux);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setActionHandler("reset", async () => {
    state.status = "online";
    return true;
  });

  const setIlluminanceLux = (v: number) => {
    const next = Math.max(0, Math.min(100000, Number(v)));
    const changed = Math.abs(next - state.illuminanceLux) >= 10;
    state.illuminanceLux = next;
    if (changed) thing.emitEvent("illuminanceChanged", state.illuminanceLux);
  };

  const setStatus = (v: LightState["status"]) => {
    state.status = v;
  };

  return { thing, state, setIlluminanceLux, setStatus };
}
