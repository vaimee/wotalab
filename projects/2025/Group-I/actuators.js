const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addServer(new HttpServer({ 
    port: 8082, // Porta per attuatori
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] } 
}));

// Variabili per memorizzare lo stato reale degli attuatori
let isPumpOn = false;
let isLampOn = false;

servient.start().then((WoT) => {
    // --- THING 1: IrrigationSystem ---
    WoT.produce({
        title: "IrrigationSystem",
        properties: {
            status: { type: "boolean", description: "Stato attuale della pompa (true=ON, false=OFF)" }
        },
        actions: {
            toggle: { input: { type: "boolean" } }  //action richiede in ingresso (input) un valore booleano (true per accendere, false per spegnere).
        }
    }).then((thing) => {
        // Permette alla Web App di leggere lo stato attuale
        thing.setPropertyReadHandler("status", async () => isPumpOn);

        //funzione che gestisce l'azione "toggle" per il sistema di irrigazione. 
        // Quando viene chiamata, stampa un messaggio in console indicando se la pompa è stata accesa o spenta, a seconda del valore booleano ricevuto in input.
        thing.setActionHandler("toggle", async (input) => {
            // Estrae il valore booleano gestendo sia input diretti che oggetti InteractionOutput di WoT
            isPumpOn = (input && typeof input.value === 'function') ? await input.value() : input;
            console.log(isPumpOn ? "[ATTUATORE] Pompa: ON" : "[ATTUATORE] Pompa: OFF");
            return isPumpOn;
        });
        //permette al thing di essere accessibile tramite HTTP sulla porta 8082 con il percorso /irrigationsystem, rendendolo pronto a ricevere richieste di azione da parte del client o dell'orchestratore.
        thing.expose().then(() => {
            console.log("IrrigationSystem pronto su http://localhost:8082/irrigationsystem");
        });
    });

    // --- THING 2: SmartLamp ---
    WoT.produce({
        title: "SmartLamp",
        properties: {
            status: { type: "boolean", description: "Stato attuale della lampada (true=ON, false=OFF)" }
        },
        actions: { 
            switch: { input: { type: "boolean" } } 
        }
    }).then((thing) => {
        // Permette alla Web App di leggere lo stato attuale
        thing.setPropertyReadHandler("status", async () => isLampOn);

        thing.setActionHandler("switch", async (input) => {
            isLampOn = (input && typeof input.value === 'function') ? await input.value() : input;
            console.log(isLampOn ? "[ATTUATORE] Lampada: ON" : "[ATTUATORE] Lampada: OFF");
            return isLampOn;
        });
        thing.expose().then(() => {
            console.log("SmartLamp pronta su http://localhost:8082/smartlamp");
        });
    });
}).catch(err => console.error("Errore attuatori:", err));