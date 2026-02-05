import { loadTdJson } from "../td/loadTd.js";
import { startLightSimulation } from "../sensors/lightSensorSim.js";

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
    await setStatus("online");
    return true;
  });

  const setIlluminanceLux = async (v: number) => {
    const next = Math.max(0, Math.min(100000, Number(v)));
    const changed = Math.abs(next - state.illuminanceLux) >= 10;
    state.illuminanceLux = next;
    await safeWrite(thing, "illuminanceLux", state.illuminanceLux);
    if (changed) thing.emitEvent("illuminanceChanged", state.illuminanceLux);
  };

  const setStatus = async (v: LightState["status"]) => {
    state.status = v;
    await safeWrite(thing, "status", state.status);
  };

  const stopSim = startLightSimulation({
    getLux: () => state.illuminanceLux,
    getStatus: () => state.status,
    setLux: setIlluminanceLux,
  });

  return { thing, state, setIlluminanceLux, setStatus, stopSim };
}

async function safeWrite(thing: any, name: string, value: unknown) {
  try {
    await thing.writeProperty(name, value);
  } catch {}
}
