/**
 * Thing "Pompa Irrigazione Serra" — ruolo WoT: Producer (Exposed Thing).
 *
 * Espone la property di sola lettura pumpStatus e l'action turnOnPump, che
 * avvia l'irrigazione per una durata in secondi. L'endpoint è protetto dallo
 * schema di sicurezza "bearer" della TD: senza header Authorization le
 * richieste ricevono 401.
 *
 * turnOnPump è modellata come Action e non come property scrivibile perché è
 * un processo con una durata che agisce sullo stato fisico nel tempo, che è
 * esattamente il criterio della specifica W3C.
 */

import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

import { BASE_URIS, PORTS, PUMP_TOKEN, THING_IDS } from "./config";
import { PUMP_TITLE, loadPumpThingDescription } from "./thing-description";

/** Limiti accettati per la durata, coerenti con l'input schema della TD. */
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 300;

/**
 * Workaround per un bug di node-wot 0.8 nella validazione del Bearer token.
 *
 * Il server confronta lo scheme in modo case-sensitive contro la stringa
 * "Bearer", mentre la specifica W3C richiede che nella TD sia scritto in
 * minuscolo ("bearer"). Il risultato è che una TD conforme non viene mai
 * autenticata. Qui alziamo temporaneamente lo scheme per la durata del
 * controllo e lo ripristiniamo subito dopo, così il documento TD resta
 * conforme alla specifica e il runtime funziona.
 */
function patchBearerCaseSensitivity(server: HttpServer): void {
  const server_ = server as unknown as {
    checkCredentials(thing: any, req: unknown): Promise<boolean>;
  };
  const original = server_.checkCredentials.bind(server);

  server_.checkCredentials = async (thing: any, req: unknown) => {
    const definition = thing.securityDefinitions[thing.security[0]];
    if (definition?.scheme !== "bearer") {
      return original(thing, req);
    }
    definition.scheme = "Bearer";
    try {
      return await original(thing, req);
    } finally {
      definition.scheme = "bearer";
    }
  };
}

async function main(): Promise<void> {
  // --- Stato interno --------------------------------------------------------
  let pumpRunning = false;

  // --- Servient -------------------------------------------------------------
  const httpServer = new HttpServer({
    port: PORTS.pump,
    // baseUri: senza, gli href della TD userebbero l'IP interno del container.
    baseUri: BASE_URIS.pump,
    security: [{ scheme: "bearer" }],
  });
  patchBearerCaseSensitivity(httpServer);

  const servient = new Servient();
  servient.addServer(httpServer);

  // Il token è un Private Security Data: sta nel Servient, mai nella TD, che
  // dichiara soltanto quale meccanismo di sicurezza usare.
  servient.addCredentials({ [THING_IDS.pump]: { token: PUMP_TOKEN } });

  const WoT = await servient.start();
  const thing = await WoT.produce(loadPumpThingDescription());

  thing.setPropertyReadHandler("pumpStatus", async () => pumpRunning);

  thing.setActionHandler("turnOnPump", async (params) => {
    const duration = Number(await params.value());

    if (!Number.isFinite(duration) || duration < MIN_DURATION_SECONDS || duration > MAX_DURATION_SECONDS) {
      throw new Error(
        `Durata non valida: attesi ${MIN_DURATION_SECONDS}-${MAX_DURATION_SECONDS} secondi, ricevuto ${String(duration)}.`
      );
    }

    // Un secondo comando mentre la pompa è già attiva viene rifiutato: due
    // cicli sovrapposti allagherebbero il terreno e falserebbero pumpStatus.
    if (pumpRunning) {
      throw new Error("La pompa è già attiva.");
    }

    pumpRunning = true;
    console.log(`[ATTUATORE] Pompa accesa per ${duration} s.`);

    // Lo spegnimento è differito: è ciò che rende turnOnPump un processo che
    // manipola lo stato fisico nel tempo, e non una semplice scrittura.
    setTimeout(() => {
      pumpRunning = false;
      console.log("[ATTUATORE] Pompa spenta, irrigazione terminata.");
    }, duration * 1000);

    return `Irrigazione avviata per ${duration} secondi.`;
  });

  await thing.expose();
  console.log(`[ATTUATORE] Thing "${PUMP_TITLE}" online, HTTP protetto sulla porta ${PORTS.pump}.`);
}

main().catch((error) => {
  console.error("[ATTUATORE] Avvio fallito:", error);
  process.exitCode = 1;
});
