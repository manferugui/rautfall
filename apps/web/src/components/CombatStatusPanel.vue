<script setup lang="ts">
/**
 * Panel de combate simulado (energía, cartucho, Residuos).
 *
 * Responsabilidades:
 * - Mostrar tres indicadores simulados: energía, cartucho y Residuos.
 * - Cada bloque lleva su badge "SIMULADO" y su propio data-testid.
 * - Sin lógica de dominio, sin reactividad basada en el motor, sin animaciones.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §18.
 */

import {
  SIMULATED_ENERGY_SEGMENTS,
  SIMULATED_ENERGY_ACTIVE,
  SIMULATED_CARTRIDGE_LABEL,
  SIMULATED_RESIDUES_COUNT,
} from '../presentation/simulated-tactical-data';

function energySegments(): boolean[] {
  const result: boolean[] = [];
  for (let i = 0; i < SIMULATED_ENERGY_SEGMENTS; i++) {
    result.push(i < SIMULATED_ENERGY_ACTIVE);
  }
  return result;
}
</script>

<template>
  <div class="combat-panel">
    <div class="module-heading">
      <span class="panel-label">Instrumentación de combate</span>
      <span class="module-badge">PROTOTIPO</span>
    </div>

    <!-- Energía simulada -->
    <div class="combat-block" data-testid="simulated-energy">
      <div class="block-header">
        <span class="block-label">ENERGÍA</span>
        <span class="simulated-badge">SIMULADO</span>
      </div>
      <div class="energy-bar">
        <div
          v-for="(active, index) in energySegments()"
          :key="index"
          class="energy-segment"
          :class="{ active }"
        ></div>
      </div>
    </div>

    <div class="combat-divider"></div>

    <!-- Cartucho simulado -->
    <div class="combat-block" data-testid="simulated-cartridge">
      <div class="block-header">
        <span class="block-label">CARTUCHO</span>
        <span class="simulated-badge">SIMULADO</span>
      </div>
      <div class="cartridge-slot">
        <span class="cartridge-text">{{ SIMULATED_CARTRIDGE_LABEL }}</span>
      </div>
    </div>

    <div class="combat-divider"></div>

    <!-- Residuos simulados -->
    <div class="combat-block" data-testid="simulated-residues">
      <div class="block-header">
        <span class="block-label">RESIDUOS</span>
        <span class="simulated-badge">SIMULADO</span>
      </div>
      <div class="residues-indicator">
        <span class="residues-count">Residuos: {{ SIMULATED_RESIDUES_COUNT }}</span>
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

.energy-bar {
  display: flex;
  gap: 3px;
}

.energy-segment {
  width: 100%;
  height: 8px;
  border-radius: var(--rf-radius-sm, 3px);
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  transition: none;
}

.energy-segment.active {
  background: var(--rf-color-cyan, #00d4ff);
  border-color: var(--rf-color-cyan, #00d4ff);
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
