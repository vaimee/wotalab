/**
 * Avvio unificato del sistema in un singolo processo.
 *
 * In produzione i tre componenti girerebbero separati (i comandi npm
 * start:sensor, start:pump e start:orchestrator lo permettono anche qui); questo
 * launcher li mette insieme per rendere immediata la demo in un solo container.
 *
 * L'orchestratore parte in ritardo perché deve poter scaricare via HTTP le
 * Thing Description dei due Producer, che devono quindi essere già esposti.
 */

import { PORTS, THING_URLS } from "./config";

/** Margine di attesa prima di avviare il Consumer, in millisecondi. */
const ORCHESTRATOR_STARTUP_DELAY = 1_500;

// Gli URL stampati sono quelli delle Thing Description, non le radici delle
// porte: node-wot serve ogni Thing sotto lo slug derivato dal suo "title", e
// la radice "/" restituisce soltanto un indice (peraltro sempre vuoto in
// node-wot 0.8, che lo costruisce iterando una Map con for...in).
console.log("=".repeat(68));
console.log("SERRA INTELLIGENTE WoT — avvio del sistema");
console.log(`TD Sensore : ${THING_URLS.sensor}`);
console.log(`TD Pompa   : ${THING_URLS.pump}`);
console.log(`Dashboard  : http://localhost:${PORTS.dashboard}/`);
console.log("=".repeat(68));

// I due Producer si avviano al momento dell'import.
import "./sensors";
import "./actuators";

setTimeout(() => {
  console.log("\n[LAUNCHER] Avvio dell'orchestratore...");
  void import("./orchestrator");
}, ORCHESTRATOR_STARTUP_DELAY);
