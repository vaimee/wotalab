<script setup lang="ts">
import { ref } from 'vue';
import { 
  Thermometer, 
  Droplets, 
  Sun, 
  Users, 
  AppWindow,
  AlertCircle,
  ShieldAlert,
  Settings,
  X,
  Home,
  Moon,
  Leaf,
  Plane
} from 'lucide-vue-next';
import { useWoT } from './composables/useWoT';
import SensorCard from './components/SensorCard.vue';
import RelayControl from './components/RelayControl.vue';
import AdminPanel from './components/AdminPanel.vue';

const { data, loading, error, setProperty, invokeAction, refresh } = useWoT();

const showAdmin = ref(false);


const setHouseMode = (mode: string) => {
  setProperty('housecontroller', 'currentMode', mode);
};

const dismissAlarm = () => {
  invokeAction('housecontroller', 'resetAlarm');
};

const modes = [
  { id: 'HOME', name: 'Home', icon: Home, color: '#38bdf8' },
  { id: 'NIGHT', name: 'Night', icon: Moon, color: '#818cf8' },
  { id: 'ECO', name: 'Eco', icon: Leaf, color: '#10b981' },
  { id: 'VACATION', name: 'Away', icon: Plane, color: '#fb7185' },
];
</script>

<template>
  <div class="dashboard-wrapper">
    <!-- Alarm Banner -->
    <Transition name="fade">
      <div v-if="data.controller.alarmActive" class="alarm-banner">
        <div class="alarm-content">
          <ShieldAlert class="pulse" />
          <div class="alarm-text">
            <strong>SICUREZZA: INTRUSIONE RILEVATA!</strong>
            <span>{{ data.controller.alarmReason }}</span>
          </div>
        </div>
        <button @click="dismissAlarm" class="dismiss-btn">
          <X :size="16" />
        </button>
      </div>
    </Transition>

    <div class="dashboard-container" :class="{ 'admin-open': showAdmin }">
      <header class="dashboard-header">
        <div class="header-main">
          <h1>Smart Room <span class="badge">Group C</span></h1>
          <button @click="showAdmin = !showAdmin" class="admin-toggle" :class="{ active: showAdmin }">
            <Settings />
          </button>
        </div>
        <p class="subtitle">IoT & Web of Things Control System</p>
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

      <div v-else>
        <!-- Mode Switcher -->
        <div class="mode-selector">
          <button 
            v-for="m in modes" 
            :key="m.id"
            @click="setHouseMode(m.id)"
            :class="['mode-card', { active: data.controller.currentMode === m.id }]"
            :style="{ '--mode-color': m.color }"
          >
            <component :is="m.icon" :size="20" />
            <span>{{ m.name }}</span>
          </button>
        </div>

        <div class="dashboard-grid">
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
            :value="data.sensors.hum.value.toFixed(0)" 
            unit="%" 
            :icon="Droplets" 
            :status="data.sensors.hum.status"
            color="#38bdf8"
          />

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

          <SensorCard 
            title="Finestra" 
            :value="data.sensors.window.value ? 'Aperta' : 'Chiusa'" 
            :icon="AppWindow" 
            :status="data.sensors.window.status"
            :color="data.sensors.window.value ? '#fb7185' : '#38bdf8'"
          />

          <RelayControl 
            title="Luce Smart"
            :isOn="data.actuators.light.isOn" 
            :mode="data.actuators.light.mode" 
            :status="data.actuators.light.status"
            @toggle="invokeAction('lightactuator', 'toggle')"
            @changeMode="(m) => setProperty('lightactuator', 'mode', m)"
          />

          <RelayControl 
            title="Caldaia (Boiler)"
            :isOn="data.actuators.boiler.isOn" 
            :mode="data.actuators.boiler.mode" 
            :status="data.actuators.boiler.status"
            @toggle="invokeAction('boileractuator', 'toggle')"
            @changeMode="(m) => setProperty('boileractuator', 'mode', m)"
          />
        </div>
      </div>
    </div>

    <!-- Admin Panel Slider -->
    <AdminPanel 
      :show="showAdmin" 
      :data="data" 
      @close="showAdmin = false"
      @setProperty="setProperty"
      @invokeAction="invokeAction"
    />
  </div>
</template>

<style>
.dashboard-wrapper {
  position: relative;
  min-height: 100vh;
}

.dashboard-container {
  width: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dashboard-container.admin-open {
  padding-right: 320px;
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
}

.admin-toggle {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}

.admin-toggle:hover, .admin-toggle.active {
  background: rgba(56, 189, 248, 0.1);
  border-color: #38bdf8;
  color: #38bdf8;
}

/* Mode Selector Styles */
.mode-selector {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 2.5rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 1rem;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mode-card:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-2px);
}

.mode-card.active {
  background: rgba(var(--mode-color), 0.1);
  border-color: var(--mode-color);
  color: white;
  box-shadow: 0 4px 20px -5px rgba(var(--mode-color), 0.3);
}

.mode-card span {
  font-size: 0.875rem;
  font-weight: 600;
}

/* Alarm Banner */
.alarm-banner {
  position: fixed;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  background: #ef4444;
  color: white;
  padding: 1rem 1.5rem;
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 2rem;
  box-shadow: 0 10px 40px -10px rgba(239, 68, 68, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.alarm-content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alarm-text {
  display: flex;
  flex-direction: column;
}

.alarm-text strong {
  font-size: 1rem;
  letter-spacing: 1px;
}

.alarm-text span {
  font-size: 0.8125rem;
  opacity: 0.9;
}

.dismiss-btn {
  background: rgba(0, 0, 0, 0.2);
  border: none;
  color: white;
  padding: 0.5rem;
  border-radius: 8px;
  cursor: pointer;
}

.pulse {
  animation: pulse-red 2s infinite;
}

@keyframes pulse-red {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
}

/* Spinner and other shared styles */
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

.fade-enter-active, .fade-leave-active {
  transition: all 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px);
}
</style>
