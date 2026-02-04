import { loadTdJson } from "../td/loadTd.js";

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
    state.status = "online";
    return true;
  });

  const setTemperature = (v: number) => {
    const next = Math.max(-10, Math.min(50, Number(v)));
    state.temperature = next;
  };

  const setHumidityPct = (v: number) => {
    const next = Math.max(0, Math.min(100, Number(v)));
    state.humidityPct = next;
  };

  const setTempHumidity = (t: number, h: number) => {
    setTemperature(t);
    setHumidityPct(h);
  };

  const setStatus = (v: TempHumidityState["status"]) => {
    state.status = v;
  };

  return { thing, state, setTemperature, setHumidityPct, setTempHumidity, setStatus };
}
