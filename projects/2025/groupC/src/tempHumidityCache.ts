import { Servient } from "@node-wot/core";
import mqttBinding from "@node-wot/binding-mqtt";
import { loadTdJson } from "./loadTd.js";

const { MqttClientFactory } = mqttBinding;

type WoTLike = { produce: (td: any) => Promise<any> };

/**
 * Crea il componente Cache MQTT → HTTP:
 *
 * 1. Consuma il device MQTT tramite target.td.json (forms MQTT espliciti).
 *    Usa observeProperty per ricevere gli aggiornamenti dai topic MQTT.
 * 2. Memorizza i valori in una Map<string, number> (cache).
 * 3. Ad ogni aggiornamento MQTT chiama emitPropertyChange sulla thing esposta,
 *    notificando eventuali osservatori HTTP in tempo reale.
 * 4. Espone i dati in cache come Thing HTTP usando temperature.td.json.
 */
export async function createTempHumidityCache(httpWot: WoTLike) {
  // --- 1. Lato MQTT Consumer: crea un Servient client MQTT ---
  const mqttServient = new Servient();
  mqttServient.addClientFactory(new MqttClientFactory());
  const mqttWot = await mqttServient.start();

  // Carica il target TD (con i forms MQTT espliciti verso i topic del device)
  const targetTd = loadTdJson("target.td.json");
  const deviceThing = await (mqttWot as any).consume(targetTd);
  console.log("[Cache] Connesso al device MQTT tramite target.td");

  // --- 2. Cache locale come Map ---
  const cache = new Map<string, number>([
    ["temperature", 22.0],
    ["humidityPct", 45.0],
  ]);

  // --- 3. Lato HTTP Producer: espone la cache via HTTP ---
  const exposedTd = loadTdJson("temperature.td.json");
  const exposedThing = await httpWot.produce(exposedTd);

  exposedThing.setPropertyReadHandler("temperature", async () => cache.get("temperature") ?? 0);
  exposedThing.setPropertyReadHandler("humidityPct", async () => cache.get("humidityPct") ?? 0);

  await exposedThing.expose();
  console.log("[Cache] Exposed Thing HTTP avviato su /temphumiditysensor");

  // --- 4. Sottoscrizione ai topic MQTT: aggiorna cache ed emette propertyChange ---
  try {
    await deviceThing.observeProperty("temperature", async (data: any) => {
      const value = await data.value() as number;
      cache.set("temperature", value);
      console.log(`[Cache] Aggiornamento temperatura: ${value.toFixed(1)}°C`);
      try { await exposedThing.emitPropertyChange("temperature"); } catch { }
    });

    await deviceThing.observeProperty("humidityPct", async (data: any) => {
      const value = await data.value() as number;
      cache.set("humidityPct", value);
      console.log(`[Cache] Aggiornamento umidità: ${value.toFixed(1)}%`);
      try { await exposedThing.emitPropertyChange("humidityPct"); } catch { }
    });

    console.log("[Cache] Sottoscrizione ai topic MQTT completata");
  } catch (e) {
    console.error("[Cache] Errore durante la sottoscrizione MQTT:", (e as Error).message);
  }

  return { thing: exposedThing, cache };
}
