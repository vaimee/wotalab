import { loadTdJson } from "../td/loadTd.js";
import { startTempHumiditySimulation } from "../sensors/tempHumiditySensorSim.js";

type WoTLike = {
  produce: (td: any) => Promise<any>;
};

export type TempHumidityState = {
  temperature: number;
  humidityPct: number;
  status: "online" | "offline" | "error";
};

export async function createTempHumiditySensor(wot: WoTLike) {
  const td = loadTdJson("temp-humidity.tm.json");
  const thing = await wot.produce(td);

  const state: TempHumidityState = {
    temperature: 22.0,
    humidityPct: 45.0,
    status: "online",
  };

  thing.setPropertyReadHandler("temperature", async () => state.temperature);
  thing.setPropertyReadHandler("humidityPct", async () => state.humidityPct);
  thing.setPropertyReadHandler("status", async () => state.status);

  thing.setActionHandler("reset", async () => {
    await setStatus("online");
    return true;
  });

  const setTemperature = async (v: number) => {
    const next = Math.max(-10, Math.min(50, Number(v)));
    state.temperature = next;
    await safeWrite(thing, "temperature", state.temperature);
  };

  const setHumidityPct = async (v: number) => {
    const next = Math.max(0, Math.min(100, Number(v)));
    state.humidityPct = next;
    await safeWrite(thing, "humidityPct", state.humidityPct);
  };

  const setTempHumidity = async (t: number, h: number) => {
    const nextT = Math.max(-10, Math.min(50, Number(t)));
    const nextH = Math.max(0, Math.min(100, Number(h)));

    state.temperature = nextT;
    state.humidityPct = nextH;

    await safeWrite(thing, "temperature", state.temperature);
    await safeWrite(thing, "humidityPct", state.humidityPct);
  };

  const setStatus = async (v: TempHumidityState["status"]) => {
    state.status = v;
    await safeWrite(thing, "status", state.status);
  };

  const stopSim = startTempHumiditySimulation({
    getTemperature: () => state.temperature,
    getHumidity: () => state.humidityPct,
    getStatus: () => state.status,
    setTempHumidity,
  });

  return {
    thing,
    state,
    setTemperature,
    setHumidityPct,
    setTempHumidity,
    setStatus,
    stopSim,
  };
}

async function safeWrite(thing: any, name: string, value: unknown) {
  try {
    await thing.writeProperty(name, value);
  } catch {}
}
