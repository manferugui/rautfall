<script setup lang="ts">
/**
 * Panel de combate (energía real, cartucho real de sabotajes, Residuos encolados).
 *
 * Responsabilidades:
 * - Mostrar la energía de combate real con 20 segmentos (5 puntos por segmento).
 * - Mostrar los sabotajes almacenados en el cartucho FIFO (máx 2).
 * - Mostrar la basura pendiente por aplicar (Residuos).
 * - 4 estados de color estáticos: 0-49 cian, 50-74 cian intenso/azul, 75-99 ámbar, 100 READY.
 */

import { computed } from 'vue';
import type { SabotageType } from '@rautfall/game-engine';

const TOTAL_SEGMENTS = 20;

const props = withDefaults(
  defineProps<{
    combatEnergy?: number;
    storedSabotages?: readonly SabotageType[];
    pendingGarbage?: number;
  }>(),
  {
    combatEnergy: 0,
    storedSabotages: () => [],
    pendingGarbage: 0,
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

const cartridgeDisplay = computed(() => {
  if (!props.storedSabotages || props.storedSabotages.length === 0) {
    return 'VACÍO';
  }
  return props.storedSabotages.join(', ');
});
</script>

<template>
  <div class="combat-panel">
    <div class="module-heading">
      <span class="panel-label">Instrumentación de combate</span>
      <span class="module-badge">PROTOTIPO</span>
    </div>

    <!-- Energía real -->
    <div
      class="combat-block"
      data-testid="simulated-energy"
      :data-energy-tier="energyTier"
    >
      <div class="block-header">
        <span class="block-label">ENERGÍA</span>
        <span
          v-if="energyTier === 'ready'"
          class="status-badge status-badge--ready"
          data-testid="energy-ready-badge"
        >READY</span>
        <span v-else class="simulated-badge">SIMULADO</span>
      </div>
      <div class="energy-bar" :class="`energy-bar--${energyTier}`">
        <div
          v-for="(active, index) in energySegments()"
          :key="index"
          class="energy-segment"
          :class="[{ active }, active ? `segment--${energyTier}` : '']"
        ></div>
      </div>
    </div>

    <div class="combat-divider"></div>

    <!-- Cartucho real -->
    <div class="combat-block" data-testid="simulated-cartridge">
      <div class="block-header">
        <span class="block-label">CARTUCHO</span>
      </div>
      <div class="cartridge-slot">
        <span class="cartridge-text" data-testid="cartridge-text">{{ cartridgeDisplay }}</span>
      </div>
    </div>

    <div class="combat-divider"></div>

    <!-- Residuos reales -->
    <div class="combat-block" data-testid="simulated-residues">
      <div class="block-header">
        <span class="block-label">RESIDUOS</span>
      </div>
      <div class="residues-indicator">
        <span class="residues-count" data-testid="residues-count">Residuos: {{ props.pendingGarbage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.combat-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.module-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.15rem;
}

.panel-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.module-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
}

.combat-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--rf-color-metal-600, #3a3b3f), transparent);
}

.combat-block {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.block-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.simulated-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-primary, #e8e8ec);
  background: var(--rf-color-metal-600, #3a3b3f);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
}

.status-badge--ready {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #0b0b0d;
  background: #2ecc71;
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
}

.energy-bar {
  display: flex;
  gap: 2px;
}

.energy-segment {
  width: 100%;
  height: 8px;
  border-radius: 1px;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  transition: none;
}

.energy-segment.active.segment--normal {
  background: var(--rf-color-cyan, #00d4ff);
  border-color: var(--rf-color-cyan, #00d4ff);
}

.energy-segment.active.segment--intense {
  background: #0077ff;
  border-color: #0077ff;
}

.energy-segment.active.segment--amber {
  background: var(--rf-color-amber, #f39c12);
  border-color: var(--rf-color-amber, #f39c12);
}

.energy-segment.active.segment--ready {
  background: #2ecc71;
  border-color: #2ecc71;
}

.cartridge-slot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cartridge-text {
  font-size: 0.8125rem;
  color: var(--rf-color-amber, #f39c12);
  font-weight: 600;
}

.residues-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.residues-count {
  font-size: 0.8125rem;
  color: var(--rf-color-red, #e74c3c);
  font-weight: 600;
}
</style>
