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
            properties: {
                temperature: {
                    type: "number",
                    description: "Temperatura attuale della stanza",
                    readOnly: true,
                    observable: true
                },
                targetTemperature: {
                    type: "number",
                    description: "Temperatura desiderata",
                    readOnly: false
                },
                isValveOpen: {
                    type: "boolean",
                    description: "Stato termostato (valvola aperta/chiusa)",
                    readOnly: true,
                    observable: true
                }
            },
            actions: {
                setHeatingState: {
                    description: "Imposta stato riscaldamento (per simulazione)",
                    input: { type: "boolean" }
                },
                setTargetTemperature: {
                    description: "Imposta temperatura desiderata",
                    input: { type: "number" }
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
