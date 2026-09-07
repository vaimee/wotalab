/**
 * Configurazione centralizzata del sistema.
 *
 * Tutti i valori che dipendono dall'ambiente di esecuzione (locale vs Docker)
 * arrivano da variabili d'ambiente con un default sensato per lo sviluppo
 * locale; docker-compose.yml sovrascrive quelli che servono.
 */

/** URI del broker MQTT. In Docker vale mqtt://broker:1883 (nome del servizio). */
export const MQTT_BROKER = process.env.MQTT_BROKER ?? "mqtt://localhost:1883";

/** Intervallo di campionamento e pubblicazione della telemetria, in millisecondi. */
export const TELEMETRY_INTERVAL = Number(process.env.TELEMETRY_INTERVAL) || 10_000;

/** Porte HTTP dei tre servizi esposti dall'applicazione. */
export const PORTS = {
  /** Exposed Thing del sensore ambientale. */
  sensor: 8080,
  /** Server statico della dashboard web. */
  dashboard: 8081,
  /** Exposed Thing della pompa, protetto da Bearer token. */
  pump: 8082,
} as const;

/**
 * Identificativi dei due Thing. Coincidono con il campo "id" delle rispettive
 * Thing Description e sono la chiave con cui il Servient associa le credenziali.
 */
export const THING_IDS = {
  sensor: "urn:dev:wot:greenhouse-environmental-sensor-01",
  pump: "urn:dev:wot:greenhouse-irrigation-pump-01",
} as const;

/**
 * Bearer token che protegge l'attuatore.
 *
 * NOTA DI SICUREZZA: in un sistema reale questo valore non sarebbe un default
 * nel codice ma un segreto iniettato dall'ambiente, e il client web otterrebbe
 * un token a tempo da un authorization server (OAuth2) invece di conoscerlo.
 * Qui il default esiste solo per rendere immediato l'avvio in laboratorio.
 */
export const PUMP_TOKEN = process.env.PUMP_TOKEN ?? "chiave-segreta-pompa";

/**
 * Slug HTTP sotto cui node-wot espone i due Thing.
 *
 * Attenzione: node-wot deriva il path dal campo "title" della TD (normalizzato
 * in minuscolo con i trattini), NON dal campo "id". Da qui i due nomi italiani.
 */
export const THING_PATHS = {
  sensor: "sensore-ambientale-serra",
  pump: "pompa-irrigazione-serra",
} as const;

/**
 * Host con cui i Thing si annunciano negli href delle proprie Thing Description.
 *
 * Senza questo, node-wot compone gli href con il primo indirizzo di rete non
 * interno della macchina: dentro Docker e' l'IP privato del container (es.
 * 172.18.0.3), irraggiungibile da fuori. La TD servita risultava quindi
 * inutilizzabile per qualsiasi Consumer esterno, che e' esattamente il caso
 * d'uso della TD. Poiche' docker-compose pubblica le porte sull'host, dichiarare
 * "localhost" funziona sia in locale sia dall'esterno del container; su una
 * macchina raggiungibile in rete si sovrascrive con il nome host reale.
 */
export const PUBLIC_HOST = process.env.PUBLIC_HOST ?? "localhost";

/** URI base con cui ciascun Exposed Thing costruisce gli href della propria TD. */
export const BASE_URIS = {
  sensor: `http://${PUBLIC_HOST}:${PORTS.sensor}`,
  pump: `http://${PUBLIC_HOST}:${PORTS.pump}`,
} as const;

/** URL delle TD, usati dall'orchestratore per recuperarle. */
export const THING_URLS = {
  sensor: `${BASE_URIS.sensor}/${THING_PATHS.sensor}`,
  pump: `${BASE_URIS.pump}/${THING_PATHS.pump}`,
} as const;
