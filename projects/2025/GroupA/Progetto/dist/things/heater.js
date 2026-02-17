"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@node-wot/core");
const binding_http_1 = require("@node-wot/binding-http"); //HTTP: per lettura  (per actions: turnOn/turnOff e lettura property targetTemperature)
const servient = new core_1.Servient();
servient.addServer(new binding_http_1.HttpServer({ port: 8080 }));
servient.start().then(async (WoT) => {
    const thing = await WoT.produce({
        title: "HeatingSystem",
        description: "Sistema di riscaldamento",
        properties: {
            targetTemperature: {
                type: "number",
                description: "Temperatura desiderata",
                readOnly: false
            },
            isOn: {
                type: "boolean",
                description: "Stato riscaldamento (acceso/spento)",
                readOnly: true,
                observable: true
            }
        },
        actions: {
            setTargetTemperature: {
                description: "Imposta temperatura desiderata",
                input: { type: "number" }
            },
            turnOn: {
                description: "Accende il riscaldamento"
            },
            turnOff: {
                description: "Spegne il riscaldamento"
            }
        }
    });
    let targetTemp = 22;
    let isOn = false;
    thing.setPropertyReadHandler("targetTemperature", async () => targetTemp);
    thing.setPropertyWriteHandler("targetTemperature", async (value) => {
        targetTemp = Number(value);
    });
    thing.setPropertyReadHandler("isOn", async () => isOn);
    thing.setActionHandler("setTargetTemperature", async (params) => {
        const temp = await params?.value();
        targetTemp = Number(temp);
        console.log(`Target temperature impostata a: ${targetTemp}`);
        return undefined;
    });
    thing.setActionHandler("turnOn", async () => {
        isOn = true;
        console.log("Riscaldamento acceso");
        return undefined;
    });
    thing.setActionHandler("turnOff", async () => {
        isOn = false;
        console.log("Riscaldamento spento");
        return undefined;
    });
    await thing.expose();
    console.log("Sistema riscaldamento esposto su porta 8080");
});
//# sourceMappingURL=heater.js.map