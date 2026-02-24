import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { MqttBrokerServer } from "@node-wot/binding-mqtt";

const servient = new Servient();
servient.addServer(new HttpServer({ port: 8081 }));
servient.addServer(new HttpServer({ port: 8082 }));
servient.addServer(new HttpServer({ port: 8083 }));
const brokerUri = "mqtt://localhost:1883";
servient.addServer(new MqttBrokerServer({ uri: brokerUri }));

const rooms = [
    { name: "Cucina", port: 8081, initialTemp: 22 },
    { name: "Camera", port: 8082, initialTemp: 22 },
    { name: "Bagno", port: 8083, initialTemp: 22 }
];

servient.start().then(async (WoT) => {
    for (const room of rooms) {
        const thing = await WoT.produce({
            title: `Sensor${room.name}`,
            description: `Sensore di temperatura ${room.name}`,
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
            "@type": ["saref:TemperatureSensor", "saref:Device"],
            properties: {
                temperature: {
                    type: "number",
                    description: "Temperatura attuale della stanza",
                    readOnly: true,
                    observable: true,
                    "@type": ["saref:Temperature", "qudt:QuantityValue"],
                    unit: "unit:DEG_C"
                },
                targetTemperature: {
                    type: "number",
                    description: "Temperatura desiderata",
                    readOnly: false,
                    "@type": ["s4bldg:TemperatureSetpoint", "qudt:QuantityValue"],
                    unit: "unit:DEG_C"
                },
                isValveOpen: {
                    type: "boolean",
                    description: "Stato termostato (valvola aperta/chiusa)",
                    readOnly: true,
                    observable: true,
                    "@type": "saref:OnOffState"
                }
            },
            actions: {
                setHeatingState: {
                    description: "Imposta stato riscaldamento (per simulazione)",
                    input: { type: "boolean" },
                    "@type": "schema:ControlAction"
                },
                setTargetTemperature: {
                    description: "Imposta temperatura desiderata",
                    input: { type: "number" },
                    "@type": "schema:ControlAction"
                }
            }
        });

        let currentTemp = room.initialTemp;
        let targetTemp = 22;
        let isHeatingOn = false;
        let isValveOpen = false;

        thing.setPropertyReadHandler("temperature", async () => currentTemp);
        thing.setPropertyReadHandler("targetTemperature", async () => targetTemp);
        thing.setPropertyWriteHandler("targetTemperature", async (value) => {
            targetTemp = Number(value);
        });
        thing.setPropertyReadHandler("isValveOpen", async () => isValveOpen);

        thing.setActionHandler("setHeatingState", async (params) => {
            const state = await params?.value();
            isHeatingOn = Boolean(state);

            //quando il riscaldamento si spegne, chiude subito la valvola
            if (!isHeatingOn) {
                isValveOpen = false;
            } else {
                //quando il riscaldamento si accende, controlla subito se aprire la valvola
                if (currentTemp <= targetTemp - 0.1) {
                    isValveOpen = true;
                } else if (currentTemp >= targetTemp + 0.3) {
                    isValveOpen = false;
                }
            }

            return undefined;
        });

        thing.setActionHandler("setTargetTemperature", async (params) => {
            const temp = await params?.value();
            targetTemp = Number(temp);
            console.log(`${room.name} - Target temperature: ${targetTemp}°C`);
            return undefined;
        });

        setInterval(() => {
            if (isHeatingOn) {
                //Controlla prima della dispersione se aprire/chiudere la valvola
                if (currentTemp <= targetTemp - 0.1) {
                    isValveOpen = true;
                } else if (currentTemp >= targetTemp + 0.3) {
                    isValveOpen = false;
                }

                //dispersione termica costante
                currentTemp -= 0.02;

                //se la valvola è aperta, scalda
                if (isValveOpen) {
                    currentTemp += 0.04;
                }
            } else {
                //Riscaldamento spento: solo dispersione
                isValveOpen = false;
                currentTemp -= 0.02;
            }

            currentTemp = Math.round(currentTemp * 100) / 100;
        }, 1000);

        await thing.expose();
        console.log(`Sensore ${room.name} esposto su porta ${room.port}`);
    }
});
