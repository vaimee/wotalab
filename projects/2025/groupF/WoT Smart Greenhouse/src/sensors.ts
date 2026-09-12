/**
 * Thing "Sensore Ambientale Serra" — ruolo WoT: Producer (Exposed Thing).
 *
 * Espone via HTTP le property temperature, humidity e activeGreenhouse, e
 * pubblica periodicamente l'evento environmentalData sul broker MQTT.
 *
 * Sono i due binding di protocollo del progetto: HTTP per la lettura puntuale
 * dello stato (request/response) e MQTT per la telemetria (publish/subscribe).
 */

import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { MqttBrokerServer, MqttClientFactory } from "@node-wot/binding-mqtt";

import { BASE_URIS, MQTT_BROKER, PORTS, TELEMETRY_INTERVAL, THING_URLS } from "./config";
import {
  GreenhouseType,
  isGreenhouseType,
  simulateReading,
} from "./greenhouse";
import { startDashboardServer } from "./dashboard-server";
import { SENSOR_TITLE, loadSensorThingDescription } from "./thing-description";

async function main(): Promise<void> {
  // --- Stato interno del Thing ---------------------------------------------
  // I valori esposti dalle property. Il loop di telemetria li aggiorna, gli
  // handler di lettura li restituiscono.
  let temperature = 22.5;
  let humidity = 45.0;
  let activeGreenhouse: GreenhouseType = "tropical";

  // --- Servient: come il Thing viene esposto in rete ------------------------
  const servient = new Servient();
  // baseUri: senza, gli href della TD userebbero l'IP interno del container.
  servient.addServer(new HttpServer({ port: PORTS.sensor, baseUri: BASE_URIS.sensor }));
  servient.addServer(new MqttBrokerServer({ uri: MQTT_BROKER }));
  servient.addClientFactory(new MqttClientFactory());

  console.log(`[SENSORE] HTTP sulla porta ${PORTS.sensor}, broker MQTT ${MQTT_BROKER}`);

  const WoT = await servient.start();
  const thing = await WoT.produce(loadSensorThingDescription());

  // --- Handler delle property ----------------------------------------------
  thing.setPropertyReadHandler("temperature", async () => temperature);
  thing.setPropertyReadHandler("humidity", async () => humidity);
  thing.setPropertyReadHandler("activeGreenhouse", async () => activeGreenhouse);

  // activeGreenhouse è l'unica property scrivibile: è stato di configurazione,
  // non un processo, quindi è una Property e non una Action.
  thing.setPropertyWriteHandler("activeGreenhouse", async (value) => {
    const requested = await value.value();
    if (!isGreenhouseType(requested)) {
      throw new Error(`Tipo di serra non supportato: ${String(requested)}`);
    }
    activeGreenhouse = requested;
    console.log(`[SENSORE] Serra impostata su ${activeGreenhouse.toUpperCase()}`);
  });

  await thing.expose();
  console.log(`[SENSORE] Thing "${SENSOR_TITLE}" online su HTTP e MQTT.`);
  console.log(`[SENSORE] TD disponibile su ${THING_URLS.sensor}`);

  startDashboardServer(PORTS.dashboard);

  // --- Loop di telemetria ---------------------------------------------------
  // Genera una lettura coerente con il profilo della serra attiva e la
  // pubblica come evento: i subscriber MQTT la ricevono in push, senza polling.
  setInterval(async () => {
    const reading = simulateReading(activeGreenhouse);
    temperature = reading.temperature;
    humidity = reading.humidity;

    console.log(
      `[SENSORE] ${activeGreenhouse.toUpperCase()} -> ${temperature} °C, ${humidity} %`
    );

    try {
      await thing.emitEvent("environmentalData", reading);
    } catch (error) {
      console.error("[SENSORE] Pubblicazione dell'evento MQTT fallita:", error);
    }
  }, TELEMETRY_INTERVAL);
}

main().catch((error) => {
  console.error("[SENSORE] Avvio fallito:", error);
  process.exitCode = 1;
});
