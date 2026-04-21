const { Servient } = require("@node-wot/core");
const { HttpServer } = require("@node-wot/binding-http");

const servient = new Servient();
servient.addServer(new HttpServer({ 
    port: 8082, // Porta per attuatori
    cors: { origin: "*", methods: ["GET", "POST", "PUT"] } 
}));

servient.start().then((WoT) => {
    // --- THING 1: IrrigationSystem ---
    WoT.produce({
        title: "IrrigationSystem",
        actions: {
            toggle: { input: { type: "boolean" } }  //azione richiede in ingresso (input) un valore booleano (true per accendere, false per spegnere).
        }
    }).then((thing) => {
        //funzione che gestisce l'azione "toggle" per il sistema di irrigazione. 
        // Quando viene chiamata, stampa un messaggio in console indicando se la pompa è stata accesa o spenta, a seconda del valore booleano ricevuto in input.
        thing.setActionHandler("toggle", async (input) => {
            console.log(input ? "[ATTUATORE] Pompa: ON" : "ATTUATORE] Pompa: OFF");
            return input;
        });
        //permette al thing di essere accessibile tramite HTTP sulla porta 8082 con il percorso /irrigationsystem, rendendolo pronto a ricevere richieste di azione da parte del client o dell'orchestratore.
        thing.expose().then(() => {
            console.log("IrrigationSystem pronto su http://localhost:8082/irrigationsystem");
        });
    });

    // --- THING 2: SmartLamp ---
    WoT.produce({
        title: "SmartLamp",
        actions: { 
            switch: { input: { type: "boolean" } } 
        }
    }).then((thing) => {
        thing.setActionHandler("switch", async (input) => {
            console.log(input ? "[ATTUATORE] Lampada: ON" : "[ATTUATORE] Lampada: OFF");
            return input;
        });
        thing.expose().then(() => {
            console.log("SmartLamp pronta su http://localhost:8082/smartlamp");
        });
    });
}).catch(err => console.error("Errore attuatori:", err));