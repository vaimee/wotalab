<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  title: string;
  value: string | number | boolean;
  unit?: string;
  icon: any;
  status: string;
  color?: string;
}>();

const displayValue = computed(() => {
  if (typeof props.value === 'boolean') {
    return props.value ? 'ON' : 'OFF';
  }
  return props.value;
});

const isOnline = computed(() => props.status === 'online');
</script>

<template>
  <div class="glass-card sensor-card">
    <div class="card-header">
      <span class="card-title">{{ title }}</span>
      <component 
        :is="icon" 
        :size="24" 
        :color="isOnline ? (color || '#38bdf8') : '#64748b'" 
      />
    </div>
    <div class="card-body">
      <div class="card-value">
        {{ displayValue }}
        <span v-if="unit" class="card-unit">{{ unit }}</span>
      </div>
      <div class="status-indicator">
        <span :class="['indicator', isOnline ? 'indicator-on' : 'indicator-off']"></span>
        <span class="status-text">{{ status }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sensor-card {
  display: flex;
  flex-direction: column;
}

.card-body {
  margin-top: 0.5rem;
}

.status-indicator {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
  color: var(--text-muted);
}
</style>
