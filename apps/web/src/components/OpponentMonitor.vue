<script setup lang="ts">
/**
 * Monitor rival simulado.
 *
 * Responsabilidades:
 * - Mostrar un tablero estático de 10×20 con un patrón fijo de bloques.
 * - Incluir etiqueta "SIMULADO" visible para no confundirse con una partida real.
 * - Mostrar señalética secundaria puramente decorativa (enlace, sector, canal),
 *   estática y sin lógica reactiva.
 * - No contener temporizadores, animaciones ni suscripciones al motor.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §17
 * y docs/tasks/0009b (revisión visual) §7.
 */

import {
  OPPONENT_STATIC_BOARD,
  OPPONENT_BOARD_COLS,
  OPPONENT_BOARD_ROWS,
  OPPONENT_CELL_SIZE,
  SIMULATED_OPPONENT_LINK_STATUS,
  SIMULATED_OPPONENT_SECTOR,
  SIMULATED_OPPONENT_CHANNEL,
} from '../presentation/simulated-tactical-data';
</script>

<template>
  <div class="opponent-monitor">
    <div class="opponent-header">
      <span class="opponent-title">RIVAL</span>
      <span class="simulated-badge">SIMULADO</span>
    </div>

    <div class="opponent-vent" aria-hidden="true"></div>

    <div class="opponent-board-frame">
      <div
        class="opponent-board"
        :style="{
          width: OPPONENT_BOARD_COLS * OPPONENT_CELL_SIZE + 'px',
          height: OPPONENT_BOARD_ROWS * OPPONENT_CELL_SIZE + 'px',
        }"
      >
        <div
          v-for="(cell, index) in OPPONENT_STATIC_BOARD"
          :key="index"
          class="opponent-cell"
          :style="{
            left: cell.x * OPPONENT_CELL_SIZE + 'px',
            top: cell.y * OPPONENT_CELL_SIZE + 'px',
            width: OPPONENT_CELL_SIZE + 'px',
            height: OPPONENT_CELL_SIZE + 'px',
            backgroundColor: cell.color,
          }"
        ></div>
      </div>
    </div>

    <div class="opponent-telemetry">
      <div class="telemetry-row">
        <span class="telemetry-label">Enlace</span>
        <span class="telemetry-value telemetry-value--ok">{{ SIMULATED_OPPONENT_LINK_STATUS }}</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Sector</span>
        <span class="telemetry-value">{{ SIMULATED_OPPONENT_SECTOR }}</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Canal</span>
        <span class="telemetry-value">{{ SIMULATED_OPPONENT_CHANNEL }}</span>
      </div>
    </div>

    <p class="opponent-footnote">Vista de prototipo — sin lógica de combate</p>
  </div>
</template>

<style scoped>
.opponent-monitor {
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-opponent, inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 2px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2));
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 240px;
  flex-shrink: 0;
}

.opponent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.opponent-title {
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

/* Ranura de ventilación decorativa: único detalle industrial propio de este panel */
.opponent-vent {
  height: 6px;
  border-radius: 2px;
  opacity: 0.8;
  background: repeating-linear-gradient(
    90deg,
    var(--rf-color-graphite-700, #28292c) 0 3px,
    transparent 3px 6px
  );
}

.opponent-board-frame {
  display: flex;
  justify-content: center;
  background: var(--rf-color-graphite-900, #17181a);
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow: var(--rf-shadow-recessed, inset 0 2px 10px rgba(0,0,0,0.8));
  padding: 6px;
}

.opponent-board {
  position: relative;
  flex-shrink: 0;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
}

.opponent-cell {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

.opponent-telemetry {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.telemetry-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.telemetry-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.telemetry-value {
  font-size: 0.625rem;
  font-family: monospace;
  letter-spacing: 0.03em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.telemetry-value--ok {
  color: var(--rf-color-cyan, #00d4ff);
}

.opponent-footnote {
  font-size: 0.625rem;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
  text-align: center;
  margin: 0;
}
</style>
