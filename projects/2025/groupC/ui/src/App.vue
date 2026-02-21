<script setup lang="ts">
import { 
  Thermometer, 
  Droplets, 
  Sun, 
  Users, 
  AppWindow,
  AlertCircle
} from 'lucide-vue-next';
import { useWoT } from './composables/useWoT';
import SensorCard from './components/SensorCard.vue';
import RelayControl from './components/RelayControl.vue';

const { data, loading, error, setRelayProperty, invokeAction, refresh } = useWoT();

const handleToggle = () => {
  invokeAction('relayactuator', 'toggle');
};

const handleModeChange = (mode: 'auto' | 'manual') => {
  setRelayProperty('mode', mode);
};
</script>

<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>Smart Room <span class="badge">Group C</span></h1>
      <p class="subtitle">Web of Things Control Center</p>
    </header>

    <div v-if="loading" class="state-msg">
      <div class="spinner"></div>
      <p>Connessione al sistema WoT...</p>
    </div>

    <div v-else-if="error" class="state-msg error">
      <AlertCircle :size="48" />
      <p>Errore di connessione: {{ error }}</p>
      <button @click="refresh()" class="btn btn-outline">Riprova</button>
    </div>

    <div v-else class="dashboard-grid">
      <!-- Row 1: Termini & Umidità -->
      <SensorCard 
        title="Temperatura" 
        :value="data.sensors.temp.value.toFixed(1)" 
        unit="°C" 
        :icon="Thermometer" 
        :status="data.sensors.temp.status"
        color="#fbbf24"
      />
      
      <SensorCard 
        title="Umidità" 
        :value="data.sensors.hum.value.toFixed(1)" 
        unit="%" 
        :icon="Droplets" 
        :status="data.sensors.hum.status"
        color="#38bdf8"
      />

      <!-- Row 2: Luce & Presenza -->
      <SensorCard 
        title="Luminosità" 
        :value="Math.round(data.sensors.light.value)" 
        unit="lux" 
        :icon="Sun" 
        :status="data.sensors.light.status"
        color="#fde047"
      />

      <SensorCard 
        title="Presenza" 
        :value="data.sensors.presence.value ? 'Rilevata' : 'Assente'" 
        :icon="Users" 
        :status="data.sensors.presence.status"
        :color="data.sensors.presence.value ? '#10b981' : '#94a3b8'"
      />

      <!-- Row 3: Finestra & Relè -->
      <SensorCard 
        title="Finestra" 
        :value="data.sensors.window.value ? 'Aperta' : 'Chiusa'" 
        :icon="AppWindow" 
        :status="data.sensors.window.status"
        :color="data.sensors.window.value ? '#fb7185' : '#38bdf8'"
      />

      <RelayControl 
        :isOn="data.relay.isOn" 
        :mode="data.relay.mode" 
        :status="data.relay.status"
        @toggle="handleToggle"
        @changeMode="handleModeChange"
      />
    </div>
  </div>
</template>

<style>
.dashboard-container {
  width: 100%;
}

.dashboard-header {
  margin-bottom: 3rem;
  text-align: center;
}

h1 {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0;
  background: linear-gradient(to right, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.badge {
  font-size: 0.875rem;
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(56, 189, 248, 0.2);
  -webkit-text-fill-color: initial;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.125rem;
  margin-top: 0.5rem;
}

.state-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 1.5rem;
  color: var(--text-muted);
}

.error {
  color: #ef4444;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(56, 189, 248, 0.1);
  border-left-color: #38bdf8;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
