import mqtt from "mqtt";

export type TempHumidityState = {
  temperature: number;
  humidityPct: number;
  status: "online" | "offline" | "error";
};

/**
 * Sensore simulato che invia dati su MQTT.
 * Si comporta come un device "puro" (senza WoT).
 */
export async function startMqttTempHumiditySensor(
  getBoilerState: () => boolean,
  getWindowState: () => boolean
) {
  // Connessione al broker locale (gestito dalla cache)
  const client = mqtt.connect("mqtt://localhost:1883");

  const state: TempHumidityState = { 
    temperature: 22.0, 
    humidityPct: 45.0, 
    status: "online" 
  };

  client.on("connect", () => {
    console.log("[Sensor] Connesso al broker MQTT");
    publishData();
  });

  // Pubblica i valori sui topic definiti nella TD manuale
  const publishData = () => {
    if (client.connected) {
      client.publish("temphumiditysensor/properties/temperature", JSON.stringify(state.temperature));
      client.publish("temphumiditysensor/properties/humidityPct", JSON.stringify(state.humidityPct));
      client.publish("temphumiditysensor/properties/status", JSON.stringify(state.status));
    }
  };

  // Simulazione dell'ambiente (caldaia, finestre, ecc.)
  const simInterval = setInterval(() => {
    if (state.status !== "online") return;

    const windowOpen = getWindowState();
    const boilerOn = getBoilerState();

    let targetBaseline = windowOpen ? 10.0 : 15.0;
    let coolingSpeed = windowOpen ? 0.5 : 0.1;
    let t = state.temperature;

    if (boilerOn) {
      let heatingSpeed = windowOpen ? 0.2 : 0.5;
      if (t < 35) t += heatingSpeed;
    } else {
      if (t > targetBaseline) t -= coolingSpeed;
      else if (t < targetBaseline) t += 0.1;
    }

    if (windowOpen) {
      state.humidityPct = Math.min(100, state.humidityPct + 3.0);
    } else {
      state.humidityPct = Math.max(40, state.humidityPct - 3.0);
    }

    state.temperature = t;
    publishData();
  }, 5000);

  const stopSim = () => {
    clearInterval(simInterval);
    client.end();
  };

  return { state, stopSim };
}
