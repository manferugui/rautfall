<script setup lang="ts">
/**
 * Módulo ENERGY de la consola central (energía de combate real, 20 segmentos).
 *
 * Responsabilidades:
 * - Mostrar la energía de combate real con 20 segmentos (5 puntos por segmento).
 * - 4 estados de color estáticos: 0-49 cian, 50-74 cian intenso/azul, 75-99 ámbar, 100 READY.
 *
 * ATTACK SLOTS vive en AttackSlotsPanel.vue (separado para poder ordenar la
 * consola como ENERGY → SCORE → COMBO → ATTACK SLOTS).
 */

import { computed } from 'vue';

const TOTAL_SEGMENTS = 20;

const props = withDefaults(
  defineProps<{
    combatEnergy?: number;
  }>(),
  {
    combatEnergy: 0,
  },
);

const energyValue = computed(() => Math.max(0, Math.min(100, props.combatEnergy)));

const activeSegmentsCount = computed(() => Math.floor(energyValue.value / 5));

const energyTier = computed(() => {
  const e = energyValue.value;
  if (e >= 100) return 'ready';
  if (e >= 75) return 'amber';
  if (e >= 50) return 'intense';
  return 'normal';
});

function energySegments(): boolean[] {
  const activeCount = activeSegmentsCount.value;
  const result: boolean[] = [];
  for (let i = 0; i < TOTAL_SEGMENTS; i++) {
    result.push(i < activeCount);
  }
  return result;
}
</script>

<template>
  <div class="rf-console-module energy-module" data-testid="simulated-energy" :data-energy-tier="energyTier">
    <div class="rf-console-face">
      <div class="energy-card-header">
        <span class="rf-console-label">ENERGY</span>
        <span v-if="energyTier === 'ready'" class="ready-badge" data-testid="energy-ready-badge">READY</span>
      </div>
      <div class="energy-meter-row">
        <span class="lightning-symbol">⚡</span>
        <div class="energy-segments-track" :class="`track--${energyTier}`">
          <div
            v-for="(active, index) in energySegments()"
            :key="index"
            class="energy-segment-block"
            :class="[{ active }, active ? `segment--${energyTier}` : '']"
          ></div>
        </div>
        <span class="energy-value-num">{{ energyValue }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.energy-module {
  width: 100%;
  box-sizing: border-box;
}

.energy-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ready-badge {
  font-size: 0.625rem;
  font-weight: 800;
  color: #08090b;
  background: #2ecc71;
  padding: 1px 6px;
  border-radius: 3px;
}

.energy-meter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.lightning-symbol {
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  color: #00d4ff;
  font-size: 1.35rem;
  text-shadow: 0 0 4px rgba(0, 212, 255, 0.55);
}

.energy-segments-track {
  flex: 1;
  display: flex;
  gap: 2px;
  background: #050607;
  padding: 4px;
  border-radius: 3px;
  box-shadow:
    inset 0 4px 8px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(0, 0, 0, 0.7);
}

.energy-segment-block {
  flex: 1;
  height: 24px;
  background: #1a1c20;
  border-radius: 1px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.energy-segment-block.active.segment--normal,
.energy-segment-block.active.segment--intense {
  background: #00d4ff;
  box-shadow: 0 0 3px rgba(0, 212, 255, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.energy-segment-block.active.segment--amber {
  background: #f39c12;
  box-shadow: 0 0 3px rgba(243, 156, 18, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.energy-segment-block.active.segment--ready {
  background: #2ecc71;
  box-shadow: 0 0 3px rgba(46, 204, 113, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.energy-value-num {
  flex-shrink: 0;
  font-size: 1.4rem;
  font-weight: 800;
  font-family: monospace;
  color: #ffffff;
  min-width: 40px;
  text-align: right;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  margin-right: 5px;
}
</style>
