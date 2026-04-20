import { Servient } from "@node-wot/core";
import mqttBinding from "@node-wot/binding-mqtt";
import { loadTdJson } from "./loadTd.js";

const { MqttClientFactory } = mqttBinding;

type WoTLike = { produce: (td: any) => Promise<any>; };

export type AdapterState = {
  temperature: number;
  humidityPct: number;
  status: "online" | "offline" | "error";
};

/**
 * Crea una Thing "adapter" che:
 * 1. Consuma il TD del sensore MQTT direttamente (ricevuto dal main)
 * 2. Riceve aggiornamenti MQTT via observeProperty
 * 3. Espone gli stessi dati via HTTP (usando il Servient HTTP del main)
 *
 * L'orchestratore e la UI continuano a leggere da HTTP come prima.
 */
export async function createTempHumidityAdapter(httpWot: WoTLike, sensorTd: any) {
  // --- Lato MQTT Consumer: crea un Servient client MQTT ---
  const mqttClient = new Servient();
  mqttClient.addClientFactory(new MqttClientFactory());
  const mqttWot = await mqttClient.start();

  // Consuma il sensore MQTT usando il TD ricevuto direttamente
  const mqttThing = await (mqttWot as any).consume(sensorTd);
  console.log("[Adapter] Connesso al sensore MQTT tramite TD diretto");

  // --- Lato HTTP Producer: usa il Servient HTTP già esistente ---
  const adapterTd = loadTdJson("temp-humidity-adapter.tm.json");
  const adapterThing = await httpWot.produce(adapterTd);

  const adapter: AdapterState = { temperature: 22.0, humidityPct: 45.0, status: "online" };

  // Espone le proprietà in sola lettura dall'adapter
  adapterThing.setPropertyReadHandler("temperature", async () => adapter.temperature);
  adapterThing.setPropertyReadHandler("humidityPct", async () => adapter.humidityPct);
  adapterThing.setPropertyReadHandler("status", async () => adapter.status);

  try {
    await mqttThing.observeProperty("temperature", async (data: any) => {
      const temp = await data.value() as number;
      adapter.temperature = temp;
      console.log(`[Adapter] Aggiornamento MQTT → HTTP: temp=${temp.toFixed(1)}°C`);
    });

    await mqttThing.observeProperty("humidityPct", async (data: any) => {
      const hum = await data.value() as number;
      adapter.humidityPct = hum;
    });

    await mqttThing.observeProperty("status", async (data: any) => {
      const status = await data.value() as string;
      adapter.status = status as AdapterState["status"];
    });

    console.log("[Adapter] Sottoscrizione alle proprietà MQTT completata con successo (observeProperty)");
  } catch (e) {
    console.error("[Adapter] Errore durante la sottoscrizione MQTT:", (e as Error).message);
  }

  const stopAdapter = () => { /* no-op */ };

  return { thing: adapterThing, adapter, stopAdapter };
}
