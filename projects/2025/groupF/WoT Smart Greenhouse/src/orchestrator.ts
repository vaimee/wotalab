/**
 * Orchestratore — ruolo WoT: Consumer.
 *
 * È il "cervello" della serra e l'unico componente che conosce entrambe le
 * Thing. Il suo ciclo è quello canonico della WoT Scripting API:
 *
 *   requestThingDescription -> consume -> subscribeEvent / readProperty / invokeAction
 *
 * Da notare che in questo file non compaiono mai le parole HTTP o MQTT nelle
 * chiamate di interazione: il protocollo da usare è scritto nei form delle
 * Thing Description e lo risolve il runtime. È il Binding Template in azione.
 */

import { Servient } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import { MqttClientFactory } from "@node-wot/binding-mqtt";

import { PUMP_TOKEN, THING_IDS, THING_URLS } from "./config";
import { GreenhouseType, isGreenhouseType, planIrrigation } from "./greenhouse";

/** Payload dell'evento environmentalData, come descritto dallo schema della TD. */
interface EnvironmentalData {
  temperature: number;
  humidity: number;
}

/**
 * Impedisce di sovrapporre due cicli di irrigazione.
 *
 * La telemetria arriva ogni pochi secondi, un ciclo può durarne trenta: senza
 * questo flag l'orchestratore continuerebbe a comandare la pompa a ogni
 * lettura sotto soglia, e l'attuatore rifiuterebbe i comandi con un errore.
 */
let irrigationInProgress = false;

/** Recupera via HTTP la Thing Description all'URL indicato e la consuma. */
async function consumeThing(wot: typeof WoT, url: string): Promise<WoT.ConsumedThing> {
  const td = await wot.requestThingDescription(url);
  return wot.consume(typeof td === "string" ? JSON.parse(td) : td);
}

async function main(): Promise<void> {
  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory());
  servient.addClientFactory(new MqttClientFactory());

  // Le credenziali dell'attuatore: node-wot le associa all'id del Thing e
  // aggiunge da sé l'header Authorization: Bearer <token> alle richieste.
  servient.addCredentials({ [THING_IDS.pump]: { token: PUMP_TOKEN } });

  const wot = await servient.start();
  console.log("[ORCHESTRATORE] Runtime avviato, recupero le Thing Description...");

  const sensor = await consumeThing(wot, THING_URLS.sensor);
  const pump = await consumeThing(wot, THING_URLS.pump);
  console.log("[ORCHESTRATORE] Thing consumate.");

  // Il sensore espone environmentalData su piu' form: Servient.expose() azzera
  // quelle dichiarate nella TD e ogni server registrato genera le proprie, nel
  // proprio ordine di registrazione — prima HTTP, poi MQTT. Senza formIndex il
  // Consumer prende la prima, cioe' HTTP long polling; il canale MQTT resta
  // comunque attivo perche' il sensore ci pubblica la telemetria. Vedi la nota
  // "Binding effettivamente usato" nel readme: forzare formIndex sulla sola
  // subscribe manderebbe in cache il client MQTT, che poi verrebbe riusato
  // dalla readProperty qui sotto — e MqttClient.readResource() in node-wot 0.8
  // non e' implementata. Lasciamo scegliere al runtime.

  await sensor.subscribeEvent(
    "environmentalData",
    async (output: WoT.InteractionOutput) => {
      try {
        const { temperature, humidity } = (await output.value()) as EnvironmentalData;

        // Il tipo di serra può cambiare a runtime: va riletto a ogni ciclo,
        // perché determina sia la soglia sia le durate di irrigazione.
        const greenhouse = await readActiveGreenhouse(sensor);
        const plan = planIrrigation(greenhouse, humidity);

        console.log(
          `[ORCHESTRATORE] ${greenhouse.toUpperCase()} -> ${temperature} °C, ${humidity} %`
        );

        if (!plan) {
          console.log("[ORCHESTRATORE] Umidità sufficiente, nessuna irrigazione.");
          return;
        }

        if (irrigationInProgress) {
          console.log("[ORCHESTRATORE] Sotto soglia, ma un ciclo è già in corso.");
          return;
        }

        await runIrrigationCycle(pump, plan);
      } catch (error) {
        console.error("[ORCHESTRATORE] Errore nell'elaborazione della lettura:", error);
      }
    },
    (error) => console.error("[ORCHESTRATORE] Errore sulla sottoscrizione:", error.message)
  );

  console.log("[ORCHESTRATORE] Sottoscritto alla telemetria del sensore.");
}

/** Legge la property activeGreenhouse, con fallback prudente in caso di valore inatteso. */
async function readActiveGreenhouse(sensor: WoT.ConsumedThing): Promise<GreenhouseType> {
  const value = await (await sensor.readProperty("activeGreenhouse")).value();
  if (isGreenhouseType(value)) {
    return value;
  }
  console.warn(`[ORCHESTRATORE] Tipo di serra inatteso (${String(value)}), uso "tropical".`);
  return "tropical";
}

/**
 * Comanda un ciclo di irrigazione e tiene il flag alzato per la sua durata.
 *
 * Il flag viene rilasciato anche se l'invocazione fallisce, altrimenti un
 * singolo errore di rete bloccherebbe l'irrigazione per sempre.
 */
async function runIrrigationCycle(
  pump: WoT.ConsumedThing,
  plan: { durationSeconds: number; level: string }
): Promise<void> {
  irrigationInProgress = true;
  const release = () => {
    irrigationInProgress = false;
  };

  try {
    console.log(
      `[ORCHESTRATORE] Irrigazione ${plan.level}: avvio pompa per ${plan.durationSeconds} s.`
    );
    await pump.invokeAction("turnOnPump", plan.durationSeconds);
    setTimeout(release, plan.durationSeconds * 1000);
  } catch (error) {
    console.error("[ORCHESTRATORE] Comando turnOnPump fallito:", error);
    release();
  }
}

main().catch((error) => {
  console.error("[ORCHESTRATORE] Avvio fallito:", error);
  process.exitCode = 1;
});
