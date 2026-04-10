import { ref, onMounted, onUnmounted } from 'vue';

export function useWoT() {
  const data = ref<any>({
    sensors: {
      presence: { value: false, status: 'online' },
      light: { value: 0, status: 'online' },
      temp: { value: 0, status: 'online' },
      hum: { value: 0, status: 'online' },
      window: { value: false, status: 'online' }
    },
    actuators: {
      light: { isOn: false, mode: 'auto', status: 'online' },
      boiler: { isOn: false, mode: 'auto', status: 'online' }
    },
    controller: {
      currentMode: 'HOME',
      alarmActive: false,
      alarmReason: '',
      targetTemperatureHome: 22,
      targetTemperatureNight: 19,
      targetTemperatureEco: 18,
      targetTemperatureAway: 15
    }
  });

  const loading = ref(true);
  const error = ref<string | null>(null);

  const safeFetch = async (url: string) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status} at ${url}`);
    const json = await r.json();
    // Node-WoT can return { value: X, ... } or just X
    return (json !== null && typeof json === 'object' && 'value' in json) ? json.value : json;
  };

  const fetchData = async () => {
    try {
      const [
        pVal, lVal, tVal, hVal, wVal,
        lOn, lMode, lStatus,
        bOn, bMode, bStatus,
        cMode, cAlarm, cReason, cTargetTempHome, cTargetTempNight, cTargetTempEco, cTargetTempAway
      ] = await Promise.all([
        safeFetch('/api/presencesensor/properties/presence'),
        safeFetch('/api/lightsensor/properties/illuminanceLux'),
        safeFetch('/api/temphumiditysensor/properties/temperature'),
        safeFetch('/api/temphumiditysensor/properties/humidityPct'),
        safeFetch('/api/windowsensor/properties/isOpen'),

        safeFetch('/api/lightactuator/properties/isOn'),
        safeFetch('/api/lightactuator/properties/mode'),
        safeFetch('/api/lightactuator/properties/status'),

        safeFetch('/api/boileractuator/properties/isOn'),
        safeFetch('/api/boileractuator/properties/mode'),
        safeFetch('/api/boileractuator/properties/status'),

        safeFetch('/api/housecontroller/properties/currentMode'),
        safeFetch('/api/housecontroller/properties/alarmActive'),
        safeFetch('/api/housecontroller/properties/alarmReason'),
        safeFetch('/api/housecontroller/properties/targetTemperatureHome'),
        safeFetch('/api/housecontroller/properties/targetTemperatureNight'),
        safeFetch('/api/housecontroller/properties/targetTemperatureEco'),
        safeFetch('/api/housecontroller/properties/targetTemperatureAway')
      ]);

      data.value.sensors.presence.value = pVal;
      data.value.sensors.light.value = lVal;
      data.value.sensors.temp.value = tVal;
      data.value.sensors.hum.value = hVal;
      data.value.sensors.window.value = wVal;

      data.value.actuators.light.isOn = lOn;
      data.value.actuators.light.mode = lMode;
      data.value.actuators.light.status = lStatus;

      data.value.actuators.boiler.isOn = bOn;
      data.value.actuators.boiler.mode = bMode;
      data.value.actuators.boiler.status = bStatus;

      data.value.controller.currentMode = cMode;
      data.value.controller.alarmActive = cAlarm;
      data.value.controller.alarmReason = cReason;
      data.value.controller.targetTemperatureHome = cTargetTempHome;
      data.value.controller.targetTemperatureNight = cTargetTempNight;
      data.value.controller.targetTemperatureEco = cTargetTempEco;
      data.value.controller.targetTemperatureAway = cTargetTempAway;

      loading.value = false;
      error.value = null;
    } catch (e: any) {
      console.error('Fetch error:', e);
      error.value = e.message;
      loading.value = false;
    }
  };

  const setProperty = async (thing: string, property: string, value: any) => {
    try {
      const res = await fetch(`/api/${thing}/properties/${property}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await fetchData();
    } catch (e: any) {
      error.value = e.message;
    }
  };

  const invokeAction = async (thing: string, action: string, input?: any) => {
    try {
      const res = await fetch(`/api/${thing}/actions/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: input !== undefined ? JSON.stringify(input) : undefined
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      await fetchData();
    } catch (e: any) {
      error.value = e.message;
    }
  };

  let interval: any;
  onMounted(() => {
    fetchData();
    interval = setInterval(fetchData, 2000);
  });

  onUnmounted(() => {
    clearInterval(interval);
  });

  return {
    data,
    loading,
    error,
    setProperty,
    invokeAction,
    refresh: fetchData
  };
}
