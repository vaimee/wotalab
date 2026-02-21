<script setup lang="ts">
import { Power, Settings } from 'lucide-vue-next';

const props = defineProps<{
  isOn: boolean;
  mode: 'auto' | 'manual';
  status: string;
}>();

const emit = defineEmits(['toggle', 'changeMode']);
</script>

<template>
  <div class="glass-card relay-card">
    <div class="card-header">
      <span class="card-title">Attuatore Relè</span>
      <Power :size="24" :color="isOn ? '#10b981' : '#ef4444'" />
    </div>
    
    <div class="card-body">
      <div class="relay-state">
        <span class="state-label">Stato:</span>
        <span :class="['state-value', isOn ? 'text-on' : 'text-off']">
          {{ isOn ? 'ATTIVO' : 'SPENTO' }}
        </span>
      </div>

      <div class="controls">
        <div class="control-group">
          <label class="control-label">Modalità</label>
          <div class="btn-group">
            <button 
              @click="emit('changeMode', 'auto')"
              :class="['btn', mode === 'auto' ? 'btn-primary' : 'btn-outline']"
            >
              Auto
            </button>
            <button 
              @click="emit('changeMode', 'manual')"
              :class="['btn', mode === 'manual' ? 'btn-primary' : 'btn-outline']"
            >
              Manuale
            </button>
          </div>
        </div>

        <div class="control-group" v-if="mode === 'manual'">
          <label class="control-label">Azione</label>
          <button 
            @click="emit('toggle')"
            class="btn btn-outline w-full"
            style="width: 100%"
          >
            {{ isOn ? 'Spegni' : 'Accendi' }}
          </button>
        </div>
      </div>

      <div class="status-indicator">
        <span :class="['indicator', status === 'online' ? 'indicator-on' : 'indicator-off']"></span>
        <span class="status-text">{{ status }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relay-card {
  grid-column: span 1;
}

@media (min-width: 1024px) {
  .relay-card {
    grid-column: span 2;
  }
}

.relay-state {
  margin-bottom: 1.5rem;
}

.state-label {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin-right: 0.5rem;
}

.state-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.text-on { color: #10b981; }
.text-off { color: #ef4444; }

.controls {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
}

.btn-group {
  display: flex;
  gap: 0.5rem;
}

.btn-group .btn {
  flex: 1;
}

.status-indicator {
  margin-top: 1.5rem;
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
