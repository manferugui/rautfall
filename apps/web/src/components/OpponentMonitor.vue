<script setup lang="ts">
/**
 * Monitor rival (Simulado / Real / Standby Entrenamiento).
 *
 * Responsabilidades:
 * - Renderizar el tablero rival estático simulado, real (modo ?battle-demo=1 / battle) o standby (entrenamiento).
 * - En modo entrenamiento (1P), mostrar estado en reposo "SIN OPONENTE" sin celdas ficticias.
 * - En modo real, mostrar visibleCells (celdas fijas, activas, fantasma y basura) proyectadas 10×20.
 * - Ocultar la insignia "SIMULADO" exclusivamente cuando existe un estado real de P2.
 * - Mostrar telemetría táctica real de P2 (Nivel, Energía, Sabotajes, Efectos, Basura pendiente).
 * - Aplicar velo de PAUSA y banner de terminalidad (DERROTA RIVAL, VICTORIA RIVAL, EMPATE).
 * - No contener lógica de dominio, colisiones ni temporizadores de motor.
 */

import { computed } from 'vue';
import type { ActiveEffectSnapshot } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner } from '@rautfall/battle-engine';
import type { GameMode, OpponentPresentationState } from '../game/types';
import {
  OPPONENT_STATIC_BOARD,
  OPPONENT_BOARD_COLS,
  OPPONENT_BOARD_ROWS,
  SIMULATED_OPPONENT_LINK_STATUS,
  SIMULATED_OPPONENT_SECTOR,
  SIMULATED_OPPONENT_CHANNEL,
} from '../presentation/simulated-tactical-data';

const props = withDefaults(
  defineProps<{
    playerTwo?: OpponentPresentationState | null;
    battleStatus?: BattleStatus | null;
    winner?: BattleWinner | null;
    isPaused?: boolean;
    mode?: GameMode;
    isTransmissionSentActive?: boolean;
  }>(),
  {
    playerTwo: null,
    battleStatus: null,
    winner: null,
    isPaused: false,
    mode: 'battle',
    isTransmissionSentActive: false,
  },
);

const isTraining = computed(() => props.mode === 'training');
const isRealMode = computed(() => props.playerTwo != null);

const terminalResultText = computed(() => {
  if (!props.battleStatus || props.battleStatus === 'running') return null;
  if (props.battleStatus === 'draw' || props.winner === 'draw') return 'EMPATE';
  if (props.battleStatus === 'playerOneWon' || props.winner === 'playerOne') return 'DERROTA RIVAL';
  if (props.battleStatus === 'playerTwoWon' || props.winner === 'playerTwo') return 'VICTORIA RIVAL';
  return null;
});

const terminalClass = computed(() => {
  if (terminalResultText.value === 'DERROTA RIVAL') return 'terminal-banner--defeat';
  if (terminalResultText.value === 'VICTORIA RIVAL') return 'terminal-banner--victory';
  if (terminalResultText.value === 'EMPATE') return 'terminal-banner--draw';
  return '';
});

function formatEffect(effect: ActiveEffectSnapshot): string {
  if (effect.type === 'sobrecarga') {
    const sec = Math.ceil(effect.remainingMs / 1000);
    return `SOBRECARGA ${sec}s`;
  }
  if (effect.type === 'polaridad') {
    return `POLARIDAD ${effect.remainingPieces}p`;
  }
  return '';
}
const CELL_SIZE = 20;
</script>

<template>
  <div class="opponent-monitor" data-testid="opponent-monitor">
    <!-- Header del módulo rival -->
    <div class="opponent-header">
      <div class="header-title-box">
        <span class="red-bar-indicator"></span>
        <span class="opponent-title">OPPONENT</span>
      </div>
      <div class="header-vent-grid" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>

    <!-- Viewport hundido del tablero rival -->
    <div
      class="opponent-board-frame"
      :class="{ 'opponent-board-frame--transmission-sent': isTransmissionSentActive }"
      :data-transmission-sent="isTransmissionSentActive"
    >
      <div
        class="opponent-board"
        data-testid="opponent-board"
        :style="{
          width: OPPONENT_BOARD_COLS * CELL_SIZE + 'px',
          height: OPPONENT_BOARD_ROWS * CELL_SIZE + 'px',
        }"
      >
        <!-- Modo Entrenamiento (1P sin rival) -->
        <template v-if="isTraining">
          <div class="standby-board-overlay" data-testid="standby-board-overlay">
            STANDBY
          </div>
        </template>

        <!-- Modo Simulado (1P legacy demo) -->
        <template v-else-if="!isRealMode">
          <div
            v-for="(cell, index) in OPPONENT_STATIC_BOARD"
            :key="index"
            class="opponent-cell"
            data-testid="opponent-cell"
            :style="{
              left: cell.x * CELL_SIZE + 'px',
              top: cell.y * CELL_SIZE + 'px',
              width: CELL_SIZE + 'px',
              height: CELL_SIZE + 'px',
              backgroundColor: cell.color,
            }"
          ></div>
        </template>

        <!-- Modo Real (2P Battle) -->
        <template v-else>
          <div
            v-for="cell in playerTwo?.visibleCells"
            :key="`${cell.x}-${cell.y}`"
            class="opponent-cell"
            :class="`opponent-cell--${cell.appearance}`"
            data-testid="opponent-cell"
            :style="{
              left: cell.x * CELL_SIZE + 'px',
              top: cell.y * CELL_SIZE + 'px',
              width: CELL_SIZE + 'px',
              height: CELL_SIZE + 'px',
              backgroundColor: cell.color,
            }"
          ></div>
        </template>

        <!-- Velo de Interferencia -->
        <div v-if="playerTwo?.isInterfered" class="interferencia-overlay" data-testid="interferencia-overlay" role="status">
          SEÑAL INTERFERIDA
        </div>

        <!-- Velo de Pausa -->
        <div v-if="isPaused" class="opponent-pause-overlay" data-testid="opponent-pause-overlay" role="status">
          PAUSA
        </div>

        <!-- Banner Terminal -->
        <div v-if="terminalResultText" class="terminal-banner" :class="terminalClass" data-testid="opponent-terminal-banner" role="status">
          {{ terminalResultText }}
        </div>
      </div>
    </div>

    <!-- Telemetría Táctica: Modo Entrenamiento -->
    <div v-if="isTraining" class="opponent-telemetry" data-testid="training-telemetry">
      <div class="telemetry-row">
        <span class="telemetry-label">Modo</span>
        <span class="telemetry-value">ENTRENAMIENTO</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Oponente</span>
        <span class="telemetry-value">NINGUNO</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Monitor</span>
        <span class="telemetry-value telemetry-value--amber">STANDBY</span>
      </div>
    </div>

    <!-- Telemetría Táctica: Modo Simulado -->
    <div v-else-if="!isRealMode" class="opponent-telemetry">
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

    <!-- Telemetría Táctica: Modo Real -->
    <div v-else class="opponent-telemetry">
      <div class="telemetry-row">
        <span class="telemetry-label">Nivel</span>
        <span class="telemetry-value" data-testid="opponent-level">{{ playerTwo?.level }}</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Energía</span>
        <span class="telemetry-value telemetry-value--cyan" data-testid="opponent-energy">{{ playerTwo?.combatEnergy }} / 100</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Sabotajes</span>
        <span class="telemetry-value" data-testid="opponent-sabotages">{{ playerTwo?.storedSabotages.join(', ') || 'VACÍO' }}</span>
      </div>
      <div class="telemetry-row">
        <span class="telemetry-label">Efectos</span>
        <span class="telemetry-value" data-testid="opponent-effects">{{ playerTwo?.activeEffects.map(formatEffect).join(', ') || 'NINGUNO' }}</span>
      </div>
      <div v-if="(playerTwo?.pendingGarbage ?? 0) > 0" class="telemetry-row">
        <span class="telemetry-label">Basura Pend.</span>
        <span class="telemetry-value telemetry-value--amber" data-testid="opponent-pending-garbage">+{{ playerTwo?.pendingGarbage }} filas</span>
      </div>
    </div>
  </div>

</template>

<style scoped>
.opponent-monitor {
  position: relative;
  background-image: url('/assets/industrial-kit/dark-metal-tile.svg');
  background-size: 512px 512px;
  background-repeat: repeat;
  border: 2px solid #36383e;
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 340px;
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

.standby-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-amber, #f39c12);
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-amber, #f39c12);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
}

.standby-board-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.4));
  font-size: 0.85rem;
  font-weight: bold;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.real-badge {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-cyan, #00d4ff);
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-cyan, #00d4ff);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
}

.opponent-vent {
  height: 8px;
  border-radius: 2px;
  opacity: 0.9;
  background-image: url('/assets/industrial-kit/vent-grille.svg');
  background-size: cover;
  border: 1px solid rgba(0, 0, 0, 0.6);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.8);
}

.opponent-board-frame {
  display: flex;
  justify-content: center;
  background: #0e0f11;
  border: 1px solid #2a2c32;
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow: inset 0 4px 14px rgba(0, 0, 0, 0.95), inset 0 0 0 1px rgba(0, 0, 0, 0.9);
  padding: 8px;
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
  box-sizing: border-box;
  border-top: 1px solid rgba(255, 255, 255, 0.22);
  border-left: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom: 1px solid rgba(0, 0, 0, 0.5);
  border-right: 1px solid rgba(0, 0, 0, 0.42);
  background-image: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0) 38%,
    rgba(0, 0, 0, 0) 62%,
    rgba(0, 0, 0, 0.2) 100%
  );
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.16),
    inset -1px -1px 1px rgba(0, 0, 0, 0.35);
}

.opponent-cell--ghost {
  opacity: 0.35;
  border: 1px dashed rgba(255, 255, 255, 0.6);
}

.opponent-cell--active {
  /* Fusiona el mismo bisel de .opponent-cell (highlight sup./izq. + sombra
     inf./der.) en vez de sustituirlo, y añade un anillo nítido sin blur
     (énfasis contenido, no glow) para seguir identificando la pieza activa. */
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.16),
    inset -1px -1px 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.35);
}

.interferencia-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: repeating-linear-gradient(
    0deg,
    rgba(23, 24, 26, 0.95) 0 2px,
    rgba(11, 11, 13, 0.9) 2px 4px
  );
  color: var(--rf-color-amber, #f39c12);
  font-size: 0.8rem;
  font-weight: bold;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-align: center;
  pointer-events: none;
  border-radius: 3px;
  border: 1px dashed var(--rf-color-amber, #f39c12);
  z-index: 8;
  animation: rf-jitter 0.3s infinite;
  box-shadow: inset 0 0 12px rgba(243, 156, 18, 0.3);
}

@media (prefers-reduced-motion: reduce) {
  .interferencia-overlay {
    animation: none;
    background: rgba(23, 24, 26, 0.95);
  }
}

.opponent-pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 11, 13, 0.75);
  color: var(--rf-color-amber, #f39c12);
  font-size: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.15em;
  pointer-events: none;
  border-radius: 3px;
  z-index: 10;
}

.terminal-banner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 11, 13, 0.85);
  font-size: 1.1rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  text-align: center;
  padding: 0.5rem;
  border-radius: 3px;
  z-index: 20;
}

.terminal-banner--defeat {
  color: var(--rf-color-cyan, #00d4ff);
  border: 1px solid var(--rf-color-cyan, #00d4ff);
}

.terminal-banner--victory {
  color: var(--rf-color-red, #e74c3c);
  border: 1px solid var(--rf-color-red, #e74c3c);
}

.terminal-banner--draw {
  color: var(--rf-color-amber, #f39c12);
  border: 1px solid var(--rf-color-amber, #f39c12);
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

.telemetry-value--ok,
.telemetry-value--cyan {
  color: var(--rf-color-cyan, #00d4ff);
}

.telemetry-value--amber {
  color: var(--rf-color-amber, #f39c12);
}

.opponent-footnote {
  font-size: 0.625rem;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
  text-align: center;
  margin: 0;
}
</style>
