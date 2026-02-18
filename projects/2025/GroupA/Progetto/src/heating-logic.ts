import { Servient } from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";

const servient = new Servient();
servient.addClientFactory(new HttpClientFactory());

const rooms = [
    { name: "Cucina", port: 8081 },
    { name: "Camera", port: 8082 },
    { name: "Bagno", port: 8083 }
];

servient.start().then(async (WoT) => {
    const sensors: Array<{ name: string; sensor: any }> = [];
    for (const room of rooms) {
        const td = await WoT.requestThingDescription(`http://localhost:${room.port}/sensor${room.name.toLowerCase()}`);
        const sensor = await WoT.consume(td);
        sensors.push({ name: room.name, sensor });
    }

    const heaterTD = await WoT.requestThingDescription("http://localhost:8080/heatingsystem");
    const heater = await WoT.consume(heaterTD);

    console.log("Orchestratore avviato");

    for (const { sensor } of sensors) {
        await sensor.invokeAction("setHeatingState", false);
    }
    await heater.invokeAction("turnOff");

    setInterval(async () => {
        const isOnOutput = await heater.readProperty("isOn");
        const isOn = await isOnOutput.value();

        let needsHeating = false;

        for (const { name, sensor } of sensors) {
            const tempOutput = await sensor.readProperty("temperature");
            const targetOutput = await sensor.readProperty("targetTemperature");

            const temp = Number(await tempOutput.value());
            const target = Number(await targetOutput.value());

            console.log(`${name}: ${temp}°C / Target: ${target}°C`);

            if (temp <= target - 0.1) {
                needsHeating = true;
            }
        }

        if (needsHeating && !isOn) {
            await heater.invokeAction("turnOn");
            for (const { sensor } of sensors) {
                await sensor.invokeAction("setHeatingState", true);
            }
            console.log("→ Riscaldamento ACCESO");
        } else if (isOn && !needsHeating) {
            //Il riscaldamento è acceso ma nessuna stanza è sotto target - 0.1
            //Controlla se almeno una valvola è ancora aperta
            let anyValveOpen = false;
            for (const { sensor } of sensors) {
                const valveOutput = await sensor.readProperty("isValveOpen");
                const isOpen = await valveOutput.value();
                if (isOpen) {
                    anyValveOpen = true;
                    break;
                }
            }

            //Spegne il riscaldamento solo se nessuna valvola è aperta
            if (!anyValveOpen) {
                await heater.invokeAction("turnOff");
                for (const { sensor } of sensors) {
                    await sensor.invokeAction("setHeatingState", false);
                }
                console.log("→ Riscaldamento SPENTO");
            }
        }
    }, 1000);
});
