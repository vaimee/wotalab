import { Servient } from "@node-wot/core";
import httpBinding from "@node-wot/binding-http";

const { HttpClientFactory } = httpBinding;

export async function startRoomOrchestrator(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? 5000;

  console.log("[Orchestrator] Avvio dell'hub d'automazione...");
  
  // Utilizziamo un Servient WoT puramente in forma client HTTP per potersi
  // allacciare agevolmente ai sensori esaminandoli.

  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory(null));
  const wot = await servient.start();

  console.log("[Orchestrator] Recupero e validazione delle specifiche collegate sulla rete locale...");
  
  const [
    presenceTD, windowTD, lightTD, thTD,
    lightActuatorTD, boilerActuatorTD, controllerTD
  ] = await Promise.all([
    wot.requestThingDescription("http://localhost:8080/presencesensor"),
    wot.requestThingDescription("http://localhost:8080/windowsensor"),
    wot.requestThingDescription("http://localhost:8080/lightsensor"),
    wot.requestThingDescription("http://localhost:8080/temphumiditysensor"),
    wot.requestThingDescription("http://localhost:8080/lightactuator"),
    wot.requestThingDescription("http://localhost:8080/boileractuator"),
    wot.requestThingDescription("http://localhost:8080/housecontroller"),
  ]);

  const presenceThing = await wot.consume(presenceTD);
  const windowThing = await wot.consume(windowTD);
  const lightThing = await wot.consume(lightTD);
  const thThing = await wot.consume(thTD);
  const lightActuatorThing = await wot.consume(lightActuatorTD);
  const boilerActuatorThing = await wot.consume(boilerActuatorTD);
  const controllerThing = await wot.consume(controllerTD);

  console.log("[Orchestrator] Tutte le definizioni sono state assimilate. Inizio loop logico primario...");

  const simInterval = setInterval(async () => {
    try {
      // Si richiede lo status più aggiornato ai vari nodi al fine di valutare la situazione globale attenendosi alle letture della stanza
      const pMode = await controllerThing.readProperty("currentMode");
      const currentMode = await pMode.value() as string;

      const pPres = await presenceThing.readProperty("presence");
      const presence = await pPres.value() as boolean;

      const pWin = await windowThing.readProperty("isOpen");
      const windowOpen = await pWin.value() as boolean;

      const pLux = await lightThing.readProperty("illuminanceLux");
      const lux = await pLux.value() as number;

      const pTemp = await thThing.readProperty("temperature");
      const temp = await pTemp.value() as number;

      const pLightOn = await lightActuatorThing.readProperty("isOn");
      const lightOn = await pLightOn.value() as boolean;
      const pLightMode = await lightActuatorThing.readProperty("mode");
      const lightMode = await pLightMode.value() as string;

      const pBoilOn = await boilerActuatorThing.readProperty("isOn");
      const boilerOn = await pBoilOn.value() as boolean;
      const pBoilMode = await boilerActuatorThing.readProperty("mode");
      const boilerMode = await pBoilMode.value() as string;

      // AUTOMAZIONE: GESTIONE MODALITÀ ANTIFURTO
      if (currentMode === "AWAY") {
        if (presence) {
          await controllerThing.invokeAction("triggerAlarm", "Intrusion: Movement detected while in AWAY mode!");
        }
        if (windowOpen) {
          await controllerThing.invokeAction("triggerAlarm", "Intrusion: Window opened while in AWAY mode!");
        }
      }

      // AUTOMAZIONE: PROFILO TERMICO
      // Adeguiamo il target della temperatura alla scelta corrente stabilita dall'utente.
      let targetProp = "targetTemperatureHome";
      if (currentMode === "NIGHT") targetProp = "targetTemperatureNight";
      else if (currentMode === "ECO") targetProp = "targetTemperatureEco";
      else if (currentMode === "AWAY") targetProp = "targetTemperatureAway";

      const pTarget = await controllerThing.readProperty(targetProp);
      const targetTemp = await pTarget.value() as number;

      let tOn = targetTemp - 0.5;
      let tOff = targetTemp + 0.5;

      // AUTOMAZIONE: ILLUMINAZIONE SMART
      // Garantiamo il risparmio energetico spegnendo automaticamente le luci nei vari casi o 
      // accendendole da zero se c'è insufficiente irraggiamento naturale e presenza registrata
      if (lightMode === "auto") {
        if (currentMode === "AWAY" || currentMode === "ECO" || !presence) {
          if (lightOn) await lightActuatorThing.invokeAction("turnOff");
        } else {
          if (lux < 200 && !lightOn) await lightActuatorThing.invokeAction("turnOn");
          else if (lux >= 800 && lightOn) await lightActuatorThing.invokeAction("turnOff");
        }
      }

      // AUTOMAZIONE: CONTROLLO IMPIANTO DI RISCALDAMENTO
      // Disattiva il boiler per non sprecare calore verso l'esterno quando arieggiamo (o siamo usciti)
      if (boilerMode === "auto") {
        if (windowOpen || currentMode === "AWAY") {
          if (boilerOn) await boilerActuatorThing.invokeAction("turnOff");
        } else {
          if (temp < tOn && !boilerOn) await boilerActuatorThing.invokeAction("turnOn");
          else if (temp >= tOff && boilerOn) await boilerActuatorThing.invokeAction("turnOff");
        }
      }

    } catch (e) {
      console.error("[Orchestrator] Error during control loop:", e);
    }
  }, intervalMs);
  
  return () => clearInterval(simInterval);
}
