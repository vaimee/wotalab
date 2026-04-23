const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

async function getThing(WoT, url) {
    while (true) {
        try {
            const td = await WoT.requestThingDescription(url);
            return await WoT.consume(td);
        } catch (e) {
            console.log(`... in attesa di ${url} ...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

async function start() {
    const WoT = await servient.start();

    // 1. CONNESSIONE A TUTTE LE THING
    const soilSensor = await getThing(WoT, "http://localhost:8081/soilmoisturesensor");
    const irrigator = await getThing(WoT, "http://localhost:8082/irrigationsystem");
    const lightSensor = await getThing(WoT, "http://localhost:8081/lightsensor");
    const smartLamp = await getThing(WoT, "http://localhost:8082/smartlamp");

    // Definiamo le soglie per l'automazione (simili a quelle usate nella UI per i consigli)
    const MOISTURE_LOW_THRESHOLD = 30;  // Sotto questa soglia, accendi la pompa
    const MOISTURE_HIGH_THRESHOLD = 80; // Sopra questa soglia, spegni la pompa
    const LIGHT_LOW_THRESHOLD = 100;    // Sotto questa soglia, accendi la lampada
    const LIGHT_HIGH_THRESHOLD = 400;   // Sopra questa soglia, spegni la lampada

    // Variabili di stato per tracciare l'ultimo comando inviato dall'orchestratore.
    // Questo evita di inviare comandi duplicati e permette all'utente di sovrascrivere
    // le decisioni dell'automazione.
    let lastPumpStatus = null;
    let lastLampStatus = null;

    console.log("ORCHESTRATORE CONNESSO E OPERATIVO!");

    setInterval(async () => {
        try {
            // 2. LETTURA VALORI DAI SENSORI
            const valMoisture = await (await soilSensor.readProperty("moisture")).value();
            const valLight = await (await lightSensor.readProperty("illumination")).value();

            console.log(`[Monitor] Umidità: ${valMoisture.toFixed(1)}% | Luce: ${valLight.toFixed(0)} lx`);

            // 3. LOGICA DI AUTOMAZIONE

            // --- Automazione Pompa ---
            // Se l'umidità è sotto la soglia bassa e la pompa non è già accesa, accendila
            if (valMoisture < MOISTURE_LOW_THRESHOLD && lastPumpStatus !== true) {
                console.log(`[Orchestratore] Umidità bassa (${valMoisture.toFixed(1)}%). Accensione pompa...`);
                await irrigator.invokeAction("toggle", true);
                await soilSensor.invokeAction("updatePumpStatus", true); // Sincronizza lo stato del simulatore
                lastPumpStatus = true;
            // altrimenti, se l'umidità supera la soglia massima e la pompa non è già spenta, spegnila    
            } else if (valMoisture > MOISTURE_HIGH_THRESHOLD && lastPumpStatus !== false) {
                console.log(`[Orchestratore] Umidità sufficiente (${valMoisture.toFixed(1)}%). Spegnimento pompa...`);
                await irrigator.invokeAction("toggle", false);  // Invia il comando di spegnimento alla pompa
                await soilSensor.invokeAction("updatePumpStatus", false);   // Sincronizza lo stato del simulatore
                lastPumpStatus = false;
            }

            // --- Automazione Lampada ---
            if (valLight < LIGHT_LOW_THRESHOLD && lastLampStatus !== true) {
                console.log(`[Orchestratore] Luce bassa (${valLight.toFixed(0)} lx). Accensione lampada...`);
                await smartLamp.invokeAction("switch", true);
                await lightSensor.invokeAction("updateLampStatus", true); // Sincronizza lo stato del simulatore
                lastLampStatus = true;
            } else if (valLight > LIGHT_HIGH_THRESHOLD && lastLampStatus !== false) {
                console.log(`[Orchestratore] Luce sufficiente (${valLight.toFixed(0)} lx). Spegnimento lampada...`);
                await smartLamp.invokeAction("switch", false);
                await lightSensor.invokeAction("updateLampStatus", false);
                lastLampStatus = false;
            }

        } catch (e) {
            console.error("❌ Errore nel ciclo di automazione:", e.message);
        }
    }, 5000); 
}

start();