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

import { PORTS } from "./config";

/** Margine di attesa prima di avviare il Consumer, in millisecondi. */
const ORCHESTRATOR_STARTUP_DELAY = 1_500;

console.log("=".repeat(68));
console.log("SERRA INTELLIGENTE WoT — avvio del sistema");
console.log(`Sensore  : http://localhost:${PORTS.sensor}`);
console.log(`Pompa    : http://localhost:${PORTS.pump}`);
console.log(`Dashboard: http://localhost:${PORTS.dashboard}`);
console.log("=".repeat(68));

// I due Producer si avviano al momento dell'import.
import "./sensors";
import "./actuators";

setTimeout(() => {
  console.log("\n[LAUNCHER] Avvio dell'orchestratore...");
  void import("./orchestrator");
}, ORCHESTRATOR_STARTUP_DELAY);
