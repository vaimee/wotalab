import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http"; //HTTP: per lettura  (per actions: turnOn/turnOff e lettura property targetTemperature)

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8080 }));

servient.start().then(async (WoT) => { 
    const thing = await WoT.produce({ //definizione della Thing Description per il sistema di riscaldamento
        title: "HeatingSystem",
        description: "Sistema di riscaldamento",
        support: "https://github.com/eclipse-thingweb/node-wot/",
        "@context": [
            "https://www.w3.org/2022/wot/td/v1.1",
            {
                saref: "https://saref.etsi.org/core/",
                s4bldg: "https://saref.etsi.org/saref4bldg/",
                qudt: "http://qudt.org/schema/qudt/",
                unit: "http://qudt.org/vocab/unit/",
                schema: "https://schema.org/"
            }
        ],
        "@type": ["s4bldg:Boiler", "saref:Device"],
        properties: {
            targetTemperature: {
                type: "number",
                description: "Temperatura desiderata",
                readOnly: false,
                "@type": ["s4bldg:TemperatureSetpoint", "qudt:QuantityValue"],
                unit: "unit:DEG_C"
            },
            isOn: {
                type: "boolean",
                description: "Stato riscaldamento (acceso/spento)",
                readOnly: true,
                observable: true,
                "@type": "saref:OnOffState"
            }
        },
        actions: {
            setTargetTemperature: {
                description: "Imposta temperatura desiderata",
                input: { type: "number" },
                "@type": "schema:ControlAction"
            },
            turnOn: {
                description: "Accende il riscaldamento",
                "@type": "schema:ActivateAction"
            },
            turnOff: {
                description: "Spegne il riscaldamento",
                "@type": "schema:DeactivateAction"
            }
        }
    });

    let targetTemp = 22; //valore iniziale della temperatura target
    let isOn = false; //riscaldamento spento inizialmente

    thing.setPropertyReadHandler("targetTemperature", async () => targetTemp);
    thing.setPropertyWriteHandler("targetTemperature", async (value) => { 
        targetTemp = Number(value);
    });

    thing.setPropertyReadHandler("isOn", async () => isOn);

    //gestisce l'azione per impostare la temperatura target
    thing.setActionHandler("setTargetTemperature", async (params) => {
        const temp = await params?.value();
        targetTemp = Number(temp);
        console.log(`Target temperature impostata a: ${targetTemp}`);
        return undefined;
    });

    //gestisce l'azione per accendere il riscaldamento
    thing.setActionHandler("turnOn", async () => { 
        isOn = true;
        console.log("Riscaldamento acceso");
        return undefined;
    });

    //gestisce l'azione per spegnere il riscaldamento
    thing.setActionHandler("turnOff", async () => {
        isOn = false;
        console.log("Riscaldamento spento");
        return undefined;
    });

    await thing.expose();
    console.log("Sistema riscaldamento esposto su porta 8080");
});
