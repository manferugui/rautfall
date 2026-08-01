<script setup lang="ts">
/**
 * Monitor rival (Simulado / Real).
 *
 * Responsabilidades:
 * - Renderizar el tablero rival estático simulado (modo 1P normal) o real (modo ?battle-demo=1).
 * - En modo real, mostrar visibleCells (celdas fijas, activas, fantasma y basura) proyectadas 10×20.
 * - Ocultar la insignia "SIMULADO" exclusivamente cuando existe un estado real de P2.
 * - Mostrar telemetría táctica real de P2 (Nivel, Energía, Sabotajes, Efectos, Basura pendiente).
 * - Aplicar velo de PAUSA y banner de terminalidad (DERROTA RIVAL, VICTORIA RIVAL, EMPATE).
 * - No contener lógica de dominio, colisiones ni temporizadores de motor.
 */

import { computed } from 'vue';
import type { ActiveEffectSnapshot } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner } from '@rautfall/battle-engine';
import type { OpponentPresentationState } from '../game/types';
import {
  OPPONENT_STATIC_BOARD,
  OPPONENT_BOARD_COLS,
  OPPONENT_BOARD_ROWS,
  OPPONENT_CELL_SIZE,
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
  }>(),
  {
    playerTwo: null,
    battleStatus: null,
    winner: null,
    isPaused: false,
  },
);

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
</script>

<template>
  <div class="opponent-monitor" data-testid="opponent-monitor">
    <div class="opponent-header">
      <span class="opponent-title">RIVAL</span>
      <span v-if="!isRealMode" class="simulated-badge" data-testid="simulated-badge">SIMULADO</span>
      <span v-else class="real-badge" data-testid="real-badge">Lvl {{ playerTwo?.level }}</span>
    </div>

    <div class="opponent-vent" aria-hidden="true"></div>

    <div class="opponent-board-frame">
      <div
        class="opponent-board"
        data-testid="opponent-board"
        :style="{
          width: OPPONENT_BOARD_COLS * OPPONENT_CELL_SIZE + 'px',
          height: OPPONENT_BOARD_ROWS * OPPONENT_CELL_SIZE + 'px',
        }"
      >
        <!-- Modo Simulado (1P normal) -->
        <template v-if="!isRealMode">
          <div
            v-for="(cell, index) in OPPONENT_STATIC_BOARD"
            :key="index"
            class="opponent-cell"
            data-testid="opponent-cell"
            :style="{
              left: cell.x * OPPONENT_CELL_SIZE + 'px',
              top: cell.y * OPPONENT_CELL_SIZE + 'px',
              width: OPPONENT_CELL_SIZE + 'px',
              height: OPPONENT_CELL_SIZE + 'px',
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
              left: cell.x * OPPONENT_CELL_SIZE + 'px',
              top: cell.y * OPPONENT_CELL_SIZE + 'px',
              width: OPPONENT_CELL_SIZE + 'px',
              height: OPPONENT_CELL_SIZE + 'px',
              backgroundColor: cell.color,
            }"
          ></div>
        </template>

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

    <!-- Telemetría Táctica: Modo Simulado -->
    <div v-if="!isRealMode" class="opponent-telemetry">
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

    <p class="opponent-footnote">
      {{ isRealMode ? 'Monitor táctico en tiempo real' : 'Vista de prototipo — sin lógica de combate' }}
    </p>
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

.opponent-cell--ghost {
  opacity: 0.35;
  border: 1px dashed rgba(255, 255, 255, 0.6);
}

.opponent-cell--active {
  box-shadow: inset 0 0 2px rgba(255, 255, 255, 0.8);
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
