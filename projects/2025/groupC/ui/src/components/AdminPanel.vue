<script setup lang="ts">
import { 
  Settings, 
  X, 
  Zap, 
  ShieldAlert, 
  Thermometer, 
  Droplets, 
  Sun, 
  Users, 
  AppWindow,
  RefreshCw
} from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  data: any;
}>();

const emit = defineEmits(['close', 'setProperty', 'invokeAction']);

const setMode = (mode: string) => {
  emit('setProperty', 'housecontroller', 'currentMode', mode);
};

const resetAlarm = () => {
  emit('invokeAction', 'housecontroller', 'resetAlarm');
};

const updateSensor = (thing: string, prop: string, value: any) => {
  emit('setProperty', thing, prop, value);
};

const toggleSimulation = () => {
  emit('setProperty', 'housecontroller', 'simulationEnabled', !props.data.controller.simulationEnabled);
};
</script>

<template>
  <Transition name="slide">
    <aside v-if="show" class="admin-panel">
      <div class="admin-header">
        <div class="title">
          <Settings class="icon" />
          <h2>Admin Simulator</h2>
        </div>
        <button @click="emit('close')" class="close-btn">
          <X :size="20" />
        </button>
      </div>

      <div class="admin-content">
        <!-- SIMULATION MASTER TOGGLE -->
        <section class="admin-section simulation-master">
          <div class="section-title">
            <RefreshCw :class="{ 'spinning': data.controller.simulationEnabled }" />
            <h3>Simulation Engine</h3>
          </div>
          <button 
            @click="toggleSimulation" 
            :class="['sim-toggle-btn', { active: data.controller.simulationEnabled }]"
          >
            <span class="status-dot"></span>
            {{ data.controller.simulationEnabled ? 'RANDOM SIM: ON' : 'MANUAL MODE: ON' }}
          </button>
          <p class="sim-hint">
            {{ data.controller.simulationEnabled 
              ? 'Sensors are generating random data.' 
              : 'Sensors are locked. Use sliders below.' }}
          </p>
        </section>

        <!-- ALARM SECTION -->
        <section v-if="data.controller.alarmActive" class="admin-section alarm-active">
          <div class="section-title danger">
            <ShieldAlert />
            <h3>ALARM ACTIVE!</h3>
          </div>
          <p class="reason">{{ data.controller.alarmReason }}</p>
          <button @click="resetAlarm" class="btn btn-danger btn-full">
            Reset Alarm
          </button>
        </section>

        <!-- HOUSE MODES -->
        <section class="admin-section">
          <div class="section-title">
            <Zap />
            <h3>Operation Modes</h3>
          </div>
          <div class="mode-grid">
            <button 
              v-for="mode in ['HOME', 'NIGHT', 'ECO', 'VACATION']" 
              :key="mode"
              @click="setMode(mode)"
              :class="['mode-btn', { active: data.controller.currentMode === mode }]"
            >
              {{ mode }}
            </button>
          </div>
        </section>

        <!-- SENSOR OVERRIDES -->
        <section class="admin-section">
          <div class="section-title">
            <RefreshCw />
            <h3>Sensor Overrides</h3>
          </div>
          
          <div class="override-item">
            <div class="label-row">
              <span class="label"><Thermometer :size="16" /> Temp</span>
              <span class="value">{{ data.sensors.temp.value.toFixed(1) }}°C</span>
            </div>
            <input 
              type="range" min="10" max="40" step="0.5" 
              :value="data.sensors.temp.value"
              @input="(e: any) => updateSensor('temphumiditysensor', 'temperature', parseFloat(e.target.value))"
            >
          </div>

          <div class="override-item">
            <div class="label-row">
              <span class="label"><Droplets :size="16" /> Humidity</span>
              <span class="value">{{ data.sensors.hum.value.toFixed(0) }}%</span>
            </div>
            <input 
              type="range" min="0" max="100" 
              :value="data.sensors.hum.value"
              @input="(e: any) => updateSensor('temphumiditysensor', 'humidityPct', parseFloat(e.target.value))"
            >
          </div>

          <div class="override-item">
            <div class="label-row">
              <span class="label"><Sun :size="16" /> Light</span>
              <span class="value">{{ Math.round(data.sensors.light.value) }} lux</span>
            </div>
            <input 
              type="range" min="0" max="1000" 
              :value="data.sensors.light.value"
              @input="(e: any) => updateSensor('lightsensor', 'illuminanceLux', parseFloat(e.target.value))"
            >
          </div>

          <div class="toggle-grid">
            <button 
              @click="updateSensor('presencesensor', 'presence', !data.sensors.presence.value)"
              :class="['toggle-btn', { active: data.sensors.presence.value }]"
            >
              <Users :size="18" />
              {{ data.sensors.presence.value ? 'In Stanza' : 'Fuori' }}
            </button>

            <button 
              @click="updateSensor('windowsensor', 'isOpen', !data.sensors.window.value)"
              :class="['toggle-btn', { active: data.sensors.window.value }]"
            >
              <AppWindow :size="18" />
              {{ data.sensors.window.value ? 'Finestra Aperta' : 'Chiusa' }}
            </button>
          </div>
        </section>
      </div>

      <div class="admin-footer">
        <p>Università Presentation Mode</p>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.admin-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(12px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
}

.admin-header {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #38bdf8;
}

.title h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.admin-section {
  margin-bottom: 2rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
  margin-bottom: 1rem;
}

.section-title h3 {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  margin: 0;
}

.section-title.danger {
  color: #ef4444;
}

.alarm-active {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  padding: 1rem;
  border-radius: 12px;
}

.reason {
  font-size: 0.875rem;
  color: #fca5a5;
  margin-bottom: 1rem;
}

.simulation-master {
  background: rgba(56, 189, 248, 0.05);
  border: 1px solid rgba(56, 189, 248, 0.2);
  padding: 1rem;
  border-radius: 12px;
}

.sim-toggle-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-weight: 700;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sim-toggle-btn.active {
  background: rgba(56, 189, 248, 0.15);
  border-color: #38bdf8;
  color: #38bdf8;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #475569;
  transition: all 0.3s;
}

.active .status-dot {
  background: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
}

.sim-hint {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 0.75rem;
  text-align: center;
  font-style: italic;
}

.spinning {
  animation: spin 3s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.mode-btn {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn.active {
  background: #38bdf8;
  color: #0f172a;
  border-color: #38bdf8;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
}

.override-item {
  margin-bottom: 1.25rem;
}

.label-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #cbd5e1;
}

.value {
  color: #38bdf8;
  font-weight: 600;
}

input[type="range"] {
  width: 100%;
  accent-color: #38bdf8;
}

.toggle-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  margin-top: 1rem;
}

.toggle-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  padding: 1rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: rgba(16, 185, 129, 0.1);
  border-color: #10b981;
  color: #10b981;
}

.admin-footer {
  padding: 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: #475569;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Transitions */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from, .slide-leave-to {
  transform: translateX(100%);
}

.btn-danger {
  background: #ef4444;
  color: white;
  border: none;
  padding: 0.75rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-full {
  width: 100%;
}
</style>
