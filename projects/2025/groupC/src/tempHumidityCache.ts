import { EventEmitter } from "events";
import { Servient } from "@node-wot/core";
import mqttBinding from "@node-wot/binding-mqtt";
import { loadTdJson } from "./loadTd.js";

const { MqttClientFactory, MqttBrokerServer } = mqttBinding;

type WoTLike = { produce: (td: any) => Promise<any> };

/**
 * Classe Cache: Gestisce i dati grezzi e la comunicazione MQTT.
 * Estende EventEmitter per notificare i cambiamenti in modo disaccoppiato.
 */
class TempHumidityCache extends EventEmitter {
  private cache: Map<string, any>;

  constructor() {
    super();
    this.cache = new Map<string, any>([
      ["temperature", 22.0],
      ["humidityPct", 45.0],
      ["status", "online"]
    ]);
  }

  public get(key: string): any {
    return this.cache.get(key);
  }

  public set(key: string, value: any) {
    if (this.cache.get(key) !== value) {
      this.cache.set(key, value);
      // Emettiamo un evento interno di cambiamento
      this.emit("change", key, value);
    }
  }

  /**
   * Connette il bridge MQTT per aggiornare i dati nella cache.
   */
  public async startMqttBridge() {
    const mqttConsumerServient = new Servient();
    mqttConsumerServient.addClientFactory(new MqttClientFactory());
    const mqttWot = await mqttConsumerServient.start();

    const targetTd = loadTdJson("target.td.json");
    const deviceThing = await (mqttWot as any).consume(targetTd);
    
    console.log("[Cache] Bridge MQTT avviato: in ascolto del device tramite target.td.json");

    const properties = ["temperature", "humidityPct", "status"];
    
    for (const prop of properties) {
      try {
        await deviceThing.observeProperty(prop, async (data: any) => {
          const value = await data.value();
          this.set(prop, value);
          console.log(`[Cache Data] Ricevuto ${prop}: ${value}`);
        });
      } catch (e) {
        console.error(`[Cache Error] Impossibile osservare ${prop}:`, (e as Error).message);
      }
    }
  }
}

/**
 * Crea il componente Cache (Broker + Bridge).
 */
export async function createTempHumidityCache(httpWot: WoTLike) {
  
  // --- 1. Avvia il Broker MQTT ---
  const brokerServient = new Servient();
  brokerServient.addServer(
    new MqttBrokerServer({ uri: "mqtt://localhost:1883", selfHost: true }) as any
  );
  await brokerServient.start();
  console.log("[Cache] Broker MQTT attivo su porta 1883");

  // --- 2. Inizializza la cache ---
  const cache = new TempHumidityCache();
  await cache.startMqttBridge();

  // --- 3. Espone i dati via HTTP (WoT) ---
  const exposedTd = loadTdJson("temperature.td.json");
  const exposedThing = await httpWot.produce(exposedTd);

  // Legge sempre i dati aggiornati dalla cache
  exposedThing.setPropertyReadHandler("temperature", async () => cache.get("temperature"));
  exposedThing.setPropertyReadHandler("humidityPct", async () => cache.get("humidityPct"));
  exposedThing.setPropertyReadHandler("status", async () => cache.get("status"));

  // --- 4. DISACCOPPIAMENTO tramite Eventi ---
  // La Thing si sottoscrive agli eventi interni della Cache.
  // Quando la cache cambia, la Thing emette il cambio verso l'esterno (HTTP).
  cache.on("change", (key, value) => {
    console.log(`[Cache Bridge] Notifica cambiamento a WoT: ${key} = ${value}`);
    exposedThing.emitPropertyChange(key);
  });

  await exposedThing.expose();
  console.log("[Cache] Exposed Thing HTTP pronta su http://localhost:8080/temphumiditysensor");

  return { thing: exposedThing, cache };
}
