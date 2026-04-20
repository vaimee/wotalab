import { Servient } from "@node-wot/core";
import mqttBinding from "@node-wot/binding-mqtt";
import { loadTdJson } from "./loadTd.js";

const { MqttBrokerServer } = mqttBinding;

export type TempHumidityState = {
  temperature: number;
  humidityPct: number;
  status: "online" | "offline" | "error";
};

/**
 * Avvia il sensore temperatura/umidità come Thing MQTT.
 * Crea un proprio Servient con MqttBrokerServer (selfHost = broker in-process)
 * e pubblica i dati della simulazione via protocollo MQTT.
 */
export async function startMqttTempHumiditySensor(
  getBoilerState: () => boolean,
  getWindowState: () => boolean,
  getTargetTemp: () => number
) {
  // Servient dedicato al sensore MQTT con broker in-process sulla porta 1883
  const servient = new Servient();
  servient.addServer(
    new MqttBrokerServer({ uri: "mqtt://localhost:1883", selfHost: true }) as any
  );

  const wot = await servient.start();
  const td = loadTdJson("temp-humidity.tm.json");
  const thing = await (wot as any).produce(td);

  const state: TempHumidityState = { temperature: 22.0, humidityPct: 45.0, status: "online" };

  // --- Handler lettura/scrittura proprietà ---
  thing.setPropertyReadHandler("temperature", async () => state.temperature);
  thing.setPropertyWriteHandler("temperature", async (v: any) => await setTemperature(await v.value()));
  thing.setPropertyReadHandler("humidityPct", async () => state.humidityPct);
  thing.setPropertyWriteHandler("humidityPct", async (v: any) => await setHumidityPct(await v.value()));
  thing.setPropertyReadHandler("status", async () => state.status);
  thing.setActionHandler("reset", async () => { await setStatus("online"); return true; });

  const setTemperature = async (v: number) => {
    state.temperature = Math.max(-10, Math.min(35, Number(v)));
    try { await thing.emitPropertyChange("temperature"); } catch { }
  };

  const setHumidityPct = async (v: number) => {
    state.humidityPct = Math.max(0, Math.min(100, Number(v)));
    try { await thing.emitPropertyChange("humidityPct"); } catch { }
  };

  const setStatus = async (v: TempHumidityState["status"]) => {
    state.status = v;
    try { await thing.emitPropertyChange("status"); } catch { }
  };

  // --- SIMULAZIONE ---
  // Ogni 5 secondi calcola l'inerzia termica della stanza
  // 1. Baseline: la stanza tende naturalmente a 15°C (temperatura ambiente).
  // 2. Se la finestra è APERTA, la temperatura tende a 10°C (esterno) e l'umidità sale.
  // 3. Se la caldaia è ON, la temperatura sale (fino a un massimo di 35°C).
  // 4. Se la caldaia è OFF, la temperatura scende verso la baseline/esterno.

  const simInterval = setInterval(async () => {
    if (state.status !== "online") return;

    const windowOpen = getWindowState();
    const boilerOn = getBoilerState();

    let targetBaseline = windowOpen ? 10.0 : 15.0;
    let coolingSpeed = windowOpen ? 0.5 : 0.1;
    let t = state.temperature;

    if (boilerOn) {
      let heatingSpeed = windowOpen ? 0.2 : 0.5;
      if (t < 35) t += heatingSpeed;
    } else {
      if (t > targetBaseline) t -= coolingSpeed;
      else if (t < targetBaseline) t += 0.1;
    }

    if (windowOpen) {
      state.humidityPct = Math.min(100, state.humidityPct + 3.0);
    } else {
      state.humidityPct = Math.max(40, state.humidityPct - 3.0);
    }

    await setTemperature(t);
  }, 5000);

  await thing.expose();
  console.log("[MQTT Sensor] tempHumiditySensor esposto via MQTT su mqtt://localhost:1883");

  // Restituiamo il TD esposto, così l'adapter può consumarlo direttamente
  const exposedTd = thing.getThingDescription();

  const stopSim = () => clearInterval(simInterval);
  return { thing, state, exposedTd, setTemperature, setHumidityPct, setStatus, stopSim };
}
