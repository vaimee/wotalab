const { Servient } = require("@node-wot/core");
const { HttpClientFactory } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

//Ogni 5 secondi legge i dati (umidità e luce) e  li stampa a schermo nel terminale (facendoti vedere il resoconto)

// Variabili di stato locale per evitare comandi duplicati
let lastPumpStatus = null;
let lastLampStatus = null;

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

    console.log("ORCHESTRATORE CONNESSO E OPERATIVO!");

    setInterval(async () => {
        try {
            // 2. LETTURA VALORI (solo monitoraggio, niente automazione)
            const valMoisture = await (await soilSensor.readProperty("moisture")).value();
            const valLight = await (await lightSensor.readProperty("illumination")).value();

            console.log(`[Monitor] Umidità: ${valMoisture.toFixed(1)}% | Luce: ${valLight.toFixed(0)} lx`);
            
            // Nessuna automazione il controllo è manuale 

        } catch (e) {
            console.error("❌ Errore nel ciclo di monitoraggio:", e.message);
        }
    }, 5000); 
}

start();