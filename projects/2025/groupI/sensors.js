const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8081, cors: { origin: "*" } }));

// STATO GLOBALE SIMULATO
let currentMoisture = 20.0; // Inizia da un numero basso
let isPumpActive = false;
let isLampActive = false;
let currentLight = 50.0; // Inizia con poca luce

// Timer per il decadimento ritardato
// Questi timer tengono traccia di quando la pompa o la lampada sono state spente per iniziare il decadimento dopo 15 secondi
let pumpOffTime = null;
let lampOffTime = null;

servient.start().then((WoT) => {

    // --- THING 1: SoilMoistureSensor ---
    WoT.produce({
        title: "SoilMoistureSensor",
        //definiamo le proprietà dell'umidità overo sarà un numero con unità percentuale e l'azione per aggiornare lo stato della pompa
        properties: { moisture: { type: "number", unit: "percent" } },
        actions: {
            updatePumpStatus: { input: { type: "boolean" } }
        }
    }).then((thing) => {
        thing.setPropertyReadHandler("moisture", async () => {  //ogni volta che arrriva una richiesta di lettura pe rl'umidità, restituisce il valore attuale
            return currentMoisture; // Valore stabile, niente random noise
        });

        //Estrazione del valore reale dall'InteractionOutput
        //setActionHandler è usato per definire cosa succede quando arriva una richiesta di azione per "updatePumpStatus" 
        // L'input è un booleano che indica se la pompa è attiva o no, e aggiorna lo stato globale isPumpActive di conseguenza. Inoltre, stampa lo stato aggiornato della pompa nel terminale.
        thing.setActionHandler("updatePumpStatus", async (params) => {
            const val = await params.value(); // Estrae true o false
            isPumpActive = val; 
            console.log("[SIMULATORE] Stato pompa aggiornato:", isPumpActive);
            return isPumpActive;
        });

        thing.expose();
    });

    // --- THING 2: LightSensor ---
    WoT.produce({
        title: "LightSensor",
        properties: { illumination: { type: "number", unit: "lux" } },
        actions: {
            updateLampStatus: { input: { type: "boolean" } }
        }
    }).then((thing) => {
        thing.setPropertyReadHandler("illumination", async () => {
            return currentLight; // Valore stabile, niente random noise
        });

        // Estrazione del valore reale
        thing.setActionHandler("updateLampStatus", async (params) => {
            const val = await params.value();
            isLampActive = val;
            console.log("[SIMULATORE] Stato lampada aggiornato:", isLampActive);
            return isLampActive;
        });

        thing.expose();
    });

    // --- LOGICA DI EVOLUZIONE TEMPORALE ---
    setInterval(() => {
        // Gestione Umidità
        if (isPumpActive === true) {
            currentMoisture = Math.min(100, currentMoisture + 2.0); // Sale velocemente quando pompa ON
            pumpOffTime = null; // Reset il timer quando pompa è ON
        } else {
            // Pompa OFF: aspetta 15 secondi prima di iniziare a diminuire
            if (pumpOffTime === null) {
                pumpOffTime = Date.now();
            }
            const timeSincePumpOff = Date.now() - pumpOffTime;
            if (timeSincePumpOff > 15000) { // Dopo 15 secondi inizia decadimento
                currentMoisture = Math.max(0, currentMoisture - 0.25);
            }
            // Altrimenti rimane stabile
        }

        // Gestione Luce
        if (isLampActive === true) {
            currentLight = Math.min(500, currentLight + 50); // Aumenta se accesa
            lampOffTime = null; // Reset il timer quando lampada è ON
        } else {
            // Lampada OFF: aspetta 15 secondi prima di iniziare a diminuire
            if (lampOffTime === null) {
                lampOffTime = Date.now();
            }
            const timeSinceLampOff = Date.now() - lampOffTime;
            if (timeSinceLampOff > 15000) { // Dopo 15 secondi inizia decadimento
                currentLight = Math.max(20, currentLight - 5);
            }
            // Altrimenti rimane stabile
        }
    }, 2000);

}).catch(err => console.error("Errore sensori:", err));