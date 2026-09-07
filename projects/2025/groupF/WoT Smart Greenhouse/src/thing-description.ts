/**
 * Caricamento delle Thing Description.
 *
 * I due documenti .td.json sono la fonte di verita' del modello WoT; questo
 * modulo li importa e li prepara per WoT.produce().
 */

import sensorDocument from "./td/environmental-sensor.td.json";
import pumpDocument from "./td/pump-actuator.td.json";

/**
 * Converte un documento TD importato da JSON nel tipo atteso da node-wot.
 *
 * TypeScript inferisce dai file .json tipi troppo larghi — per esempio
 * "type": "number" diventa string invece del literal union DataSchemaType —
 * quindi l'oggetto non combacia con ExposedThingInit pur essendo una TD
 * valida. La conversione vive qui, in un punto solo, invece di essere sparsa
 * come "as any" nei file dei Thing.
 */
function asThingDescription(document: unknown): WoT.ExposedThingInit {
  return document as WoT.ExposedThingInit;
}

/** Titoli dei due Thing, usati nei log e da cui node-wot deriva gli slug HTTP. */
export const SENSOR_TITLE = sensorDocument.title;
export const PUMP_TITLE = pumpDocument.title;

/**
 * Restituisce la TD del sensore.
 *
 * Nota: la form MQTT scritta nel file NON arriva al runtime. Servient.expose()
 * azzera le forms di ogni affordance prima di passare il Thing ai server, che
 * poi ne generano di proprie; l'href della TD sopravvive solo come template per
 * i metadati accessori. L'indirizzo del broker effettivo e' quello passato a
 * MqttBrokerServer in sensors.ts, non quello della TD.
 */
export function loadSensorThingDescription(): WoT.ExposedThingInit {
  return asThingDescription(sensorDocument);
}

/** Restituisce la TD della pompa. */
export function loadPumpThingDescription(): WoT.ExposedThingInit {
  return asThingDescription(pumpDocument);
}
