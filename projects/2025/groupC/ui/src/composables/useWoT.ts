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
    relay: {
      isOn: false,
      mode: 'auto',
      status: 'online'
    }
  });

  const loading = ref(true);
  const error = ref<string | null>(null);

  const fetchData = async () => {
    try {
      // Backend properties as defined in main.ts
      const [pVal, lVal, tVal, hVal, wVal, rOn, rMode] = await Promise.all([
        fetch('/api/presencesensor/properties/presence').then(r => r.json()),
        fetch('/api/lightsensor/properties/illuminanceLux').then(r => r.json()),
        fetch('/api/temphumiditysensor/properties/temperature').then(r => r.json()),
        fetch('/api/temphumiditysensor/properties/humidityPct').then(r => r.json()),
        fetch('/api/windowsensor/properties/isOpen').then(r => r.json()),
        fetch('/api/relayactuator/properties/isOn').then(r => r.json()),
        fetch('/api/relayactuator/properties/mode').then(r => r.json())
      ]);

      data.value.sensors.presence.value = pVal;
      data.value.sensors.light.value = lVal;
      data.value.sensors.temp.value = tVal;
      data.value.sensors.hum.value = hVal;
      data.value.sensors.window.value = wVal;
      data.value.relay.isOn = rOn;
      data.value.relay.mode = rMode;
      
      loading.value = false;
      error.value = null;
    } catch (e: any) {
      console.error('Fetch error:', e);
      error.value = e.message;
      loading.value = false;
    }
  };

  const setRelayProperty = async (property: 'isOn' | 'mode', value: any) => {
    try {
      const res = await fetch(`/api/relayactuator/properties/${property}`, {
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
    setRelayProperty,
    invokeAction,
    refresh: fetchData
  };
}
