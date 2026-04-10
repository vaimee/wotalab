import { loadTdJson } from "./loadTd.js";

type WoTLike = { produce: (td: any) => Promise<any>; };

export type TempHumidityState = {
  temperature: number;
  humidityPct: number;
  status: "online" | "offline" | "error";
};

export async function createTempHumiditySensor(
  wot: WoTLike,
  getBoilerState: () => boolean,
  getWindowState: () => boolean,
  getTargetTemp: () => number
) {
  const td = loadTdJson("temp-humidity.tm.json");
  const thing = await wot.produce(td);

  const state: TempHumidityState = { temperature: 22.0, humidityPct: 45.0, status: "online" };

  thing.setPropertyReadHandler("temperature", async () => state.temperature);
  thing.setPropertyWriteHandler("temperature", async (v: any) => await setTemperature(await v.value()));
  thing.setPropertyReadHandler("humidityPct", async () => state.humidityPct);
  thing.setPropertyWriteHandler("humidityPct", async (v: any) => await setHumidityPct(await v.value()));
  thing.setPropertyReadHandler("status", async () => state.status);
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setTemperature = async (v: number) => {
    state.temperature = Math.max(-10, Math.min(35, Number(v)));
    try { await thing.writeProperty("temperature", state.temperature); } catch { }
  };

  const setHumidityPct = async (v: number) => {
    state.humidityPct = Math.max(0, Math.min(100, Number(v)));
    try { await thing.writeProperty("humidityPct", state.humidityPct); } catch { }
  };

  const setStatus = async (v: TempHumidityState["status"]) => {
    state.status = v;
    try { await thing.writeProperty("status", state.status); } catch { }
  };


// SIMULAZIONE

// Ogni 5 secondi calcola l'inerzia termica della stanza
// 1. Baseline: la stanza tende naturalmente a 15°C (temperatura ambiente).
// 2. Se la finestra è APERTA, la temperatura tende a 10°C (esterno) e l'umidità sale.
// 3. Se la caldaia è ON, la temperatura sale (fino a un massimo di 35°C).
// 4. Se la caldaia è OFF, la temperatura scende verso la baseline/esterno.

  const simInterval = setInterval(async () => {
    if (state.status !== "online") return;
    
    // Calcoliamo verso che temperatura stiamo tendendo (equilibrio attuale)
    const windowOpen = getWindowState();
    const boilerOn = getBoilerState();
    
    let targetBaseline = windowOpen ? 10.0 : 15.0; // Se apri cala bruscamente
    let coolingSpeed = windowOpen ? 0.5 : 0.1; // Se la finestra è aperta, scendi più velocemente
    let t = state.temperature;

    if (boilerOn) {
      // Se la caldaia è accesa, aumentiamo la temperatura.
      // Se la finestra è APERTA, la caldaia è meno efficiente causa dispersione (sale solo di 0.2°C).
      // Se la finestra è CHIUSA, l'efficienza è massima (sale di 0.5°C).
      let heatingSpeed = windowOpen ? 0.2 : 0.5;
      if (t < 35) t += heatingSpeed;
    } else {
      // Se è spenta, tendiamo alla baseline (raffreddamento naturale)
      if (t > targetBaseline) t -= coolingSpeed;
      else if (t < targetBaseline) t += 0.1;
    }

    // Umidità: varia sensibilmente (3% ogni 5 secondi) per rendere la demo visibile
    if (windowOpen) {
      state.humidityPct = Math.min(100, state.humidityPct + 3.0);
    } else {
      state.humidityPct = Math.max(40, state.humidityPct - 3.0);
    }

    await setTemperature(t);
  }, 5000);

  const stopSim = () => clearInterval(simInterval);

  return { thing, state, setTemperature, setHumidityPct, setStatus, stopSim };
}
