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
    <!-- Remaches mecánicos discretos de carcasa principal -->
    <div class="chassis-rivet chassis-rivet--tl" aria-hidden="true"></div>
    <div class="chassis-rivet chassis-rivet--tr" aria-hidden="true"></div>
    <div class="chassis-rivet chassis-rivet--bl" aria-hidden="true"></div>
    <div class="chassis-rivet chassis-rivet--br" aria-hidden="true"></div>

    <!-- MASA 1: PLACA DE CABECERA FÍSICA SOBRESALIENTE CON CORTE ANGULAR -->
    <header class="opponent-header-plate">
      <div class="header-plate-bolt header-plate-bolt--l" aria-hidden="true"></div>
      <div class="header-identity">
        <div class="header-primary-line">
          <span class="red-bar-indicator" aria-hidden="true"></span>
          <span class="opponent-title">OPPONENT</span>
        </div>
        <div class="header-secondary-line">
          <span class="chassis-stencil-mark">TACTICAL MONITOR // SYS R-02</span>
        </div>
      </div>
      <div class="header-status-cluster" aria-hidden="true">
        <div class="header-led" :class="{ 'header-led--active': isRealMode && !isPaused, 'header-led--hold': isPaused }"></div>
        <div class="header-vent-grid">
          <span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="header-plate-bolt header-plate-bolt--r" aria-hidden="true"></div>
    </header>

    <!-- MASA 2: CUERPO CENTRAL CON MONTANTES ESTRUCTURALES Y VIEWPORT HUNDIDO DE 3 NIVELES DE PROFUNDIDAD -->
    <main class="opponent-viewport-container">
      <!-- Montante estructural izquierdo (columna de acero de 22px con volumen) -->
      <aside class="opponent-side-post opponent-side-post--left" aria-hidden="true">
        <div class="post-hex-bolt post-hex-bolt--top"></div>
        <div class="post-bracket post-bracket--top"></div>
        <div class="post-channel"></div>
        <div class="post-bracket post-bracket--bottom"></div>
        <div class="post-hex-bolt post-hex-bolt--bottom"></div>
      </aside>

      <!-- Viewport hundido de 3 niveles de profundidad -->
      <div
        class="opponent-board-frame"
        :class="{
          'opponent-board-frame--transmission-sent': isTransmissionSentActive,
          'opponent-board-frame--paused': isPaused,
        }"
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
          <!-- Reflejo de cristal protector estático -->
          <div class="viewport-glass-glare" aria-hidden="true"></div>

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

          <!-- Velo de Pausa: Feed Suspendido / Monitor Hold -->
          <div
            v-if="isPaused"
            class="opponent-pause-overlay"
            data-testid="opponent-pause-overlay"
            role="status"
            aria-label="Feed táctico del rival suspendido por pausa"
          >
            <div class="pause-feed-badge">
              <span class="pause-feed-primary">FEED HOLD</span>
              <span class="pause-feed-secondary">TACTICAL LINK SUSPENDED</span>
            </div>
          </div>

          <!-- Banner Terminal -->
          <div v-if="terminalResultText" class="terminal-banner" :class="terminalClass" data-testid="opponent-terminal-banner" role="status">
            {{ terminalResultText }}
          </div>
        </div>
      </div>

      <!-- Montante estructural derecho -->
      <aside class="opponent-side-post opponent-side-post--right" aria-hidden="true">
        <div class="post-hex-bolt post-hex-bolt--top"></div>
        <div class="post-bracket post-bracket--top"></div>
        <div class="post-channel"></div>
        <div class="post-bracket post-bracket--bottom"></div>
        <div class="post-hex-bolt post-hex-bolt--bottom"></div>
      </aside>
    </main>

    <!-- MASA 3: SUBMÓDULO FÍSICO INDEPENDIENTE DE TELEMETRÍA (TELEMETRY BAY) SOBRESALIENTE -->
    <section class="opponent-telemetry-bay">
      <!-- Junta mecánica superior de ensamblaje -->
      <div class="bay-top-seam" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>

      <div class="telemetry-bay-header" aria-hidden="true">
        <div class="telemetry-bay-title-box">
          <span class="telemetry-bay-indicator"></span>
          <span class="telemetry-bay-title">TELEMETRY BAY // P2-DATA</span>
        </div>
        <div class="telemetry-bay-screws">
          <span></span><span></span>
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
    </section>
  </div>
</template>

<style scoped>
/* MAIN CHASSIS CON VOLUMEN INDUSTRIAL Y MARCO ROBUSTO */
.opponent-monitor {
  position: relative;
  background-color: #16181e;
  background-image: url('/assets/industrial-kit/dark-metal-tile.svg');
  background-size: 512px 512px;
  background-repeat: repeat;
  border: 4px solid #2c3039;
  outline: 2px solid #090a0d;
  border-radius: var(--rf-radius-md, 6px);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.18),
    inset 0 -4px 8px rgba(0, 0, 0, 0.9),
    inset 0 0 0 2px rgba(0, 0, 0, 0.6),
    0 16px 40px rgba(0, 0, 0, 0.85);
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 344px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.chassis-rivet {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--rf-color-metal-500, #4c4d54);
  border: 1px solid #0d0e11;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.9);
  pointer-events: none;
  z-index: 6;
}

.chassis-rivet--tl { top: 6px; left: 6px; }
.chassis-rivet--tr { top: 6px; right: 6px; }
.chassis-rivet--bl { bottom: 6px; left: 6px; }
.chassis-rivet--br { bottom: 6px; right: 6px; }

/* MASA 1: PLACA DE CABECERA FÍSICA SOBRESALIENTE CON CORTE ANGULAR */
.opponent-header-plate {
  position: relative;
  width: calc(100% + 20px);
  margin-left: -10px;
  margin-top: -4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  background: linear-gradient(180deg, #2f333e 0%, #1a1c23 100%);
  border: 2px solid #414654;
  border-top: 3px solid #525868;
  border-bottom: 3px solid #08090b;
  border-radius: 4px;
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px);
  padding: 0.5rem 0.75rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -2px 4px rgba(0, 0, 0, 0.85),
    0 4px 10px rgba(0, 0, 0, 0.75);
  z-index: 5;
}

.header-plate-bolt {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #505565;
  border: 1px solid #111215;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
.header-plate-bolt--l { left: 6px; }
.header-plate-bolt--r { right: 6px; }

.header-identity {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-left: 0.5rem;
}

.header-primary-line {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  line-height: 1;
}

.red-bar-indicator {
  width: 5px;
  height: 13px;
  background: var(--rf-color-red, #e74c3c);
  border-radius: 1px;
  box-shadow: 0 0 6px rgba(231, 76, 60, 0.7);
}

.opponent-title {
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--rf-color-text-primary, #e8e8ec);
  line-height: 1;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.header-secondary-line {
  line-height: 1;
}

.chassis-stencil-mark {
  font-size: 0.58rem;
  font-family: monospace;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.5));
  text-transform: uppercase;
}

.header-status-cluster {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.5rem;
}

.header-led {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2b2e36;
  border: 1px solid #0d0e11;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.9);
}

.header-led--active {
  background: #00d4ff;
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.9);
}

.header-led--hold {
  background: var(--rf-color-amber, #f39c12);
  box-shadow: 0 0 8px rgba(243, 156, 18, 0.85);
}

.header-vent-grid {
  display: flex;
  gap: 3px;
}

.header-vent-grid span {
  width: 3px;
  height: 11px;
  background: #08090c;
  border-radius: 1px;
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.9);
}

/* MASA 2: CUERPO CENTRAL CON MONTANTES ESTRUCTURALES Y VIEWPORT HUNDIDO DE 3 NIVELES DE PROFUNDIDAD */
.opponent-viewport-container {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(180deg, #0b0c0f 0%, #13151b 100%);
  border: 2px solid #262932;
  border-radius: 4px;
  padding: 8px;
  box-shadow:
    inset 0 6px 16px rgba(0, 0, 0, 0.96),
    0 3px 6px rgba(0, 0, 0, 0.7);
}

/* MONTANTES LATERALES GRUESOS (COLUMNAS STRUCTURALES DE ACERO DE 22PX) */
.opponent-side-post {
  position: relative;
  width: 22px;
  align-self: stretch;
  background: linear-gradient(90deg, #13151b 0%, #2f333f 30%, #444957 50%, #252833 75%, #0f1014 100%);
  border: 1px solid #434855;
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset -2px 0 4px rgba(0, 0, 0, 0.7),
    0 2px 5px rgba(0, 0, 0, 0.8);
  flex-shrink: 0;
}

.post-channel {
  width: 4px;
  height: 60%;
  background: #060709;
  border-radius: 1px;
  box-shadow:
    inset 0 0 4px rgba(0, 0, 0, 0.98),
    1px 0 0 rgba(255, 255, 255, 0.1);
}

.post-hex-bolt {
  width: 6px;
  height: 6px;
  background: #505564;
  border: 1px solid #111215;
  clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.post-bracket {
  width: 14px;
  height: 3px;
  background: #1d1f27;
  border: 1px solid #3d414d;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

/* VIEWPORT HUNDIDO DEL TABLERO RIVAL (DOBLE / TRIPLE BISEL) */
.opponent-board-frame {
  position: relative;
  display: flex;
  justify-content: center;
  background: #040506;
  border: 3px solid #363a45;
  outline: 2px solid #090a0d;
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow:
    inset 0 8px 20px rgba(0, 0, 0, 0.98),
    inset 0 0 0 1px rgba(0, 0, 0, 0.95),
    0 3px 8px rgba(0, 0, 0, 0.7);
  padding: 6px;
}

.opponent-board-frame--paused .opponent-board {
  filter: contrast(0.75) brightness(0.65);
}

.opponent-board {
  position: relative;
  flex-shrink: 0;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
}

.viewport-glass-glare {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0) 35%,
    rgba(0, 0, 0, 0) 100%
  );
  pointer-events: none;
  z-index: 4;
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
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.16),
    inset -1px -1px 1px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.35);
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(8, 9, 12, 0.78);
  background-image: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.4) 0px,
    rgba(0, 0, 0, 0.4) 1px,
    transparent 1px,
    transparent 3px
  );
  pointer-events: none;
  border-radius: 3px;
  z-index: 10;
  border: 1px solid rgba(243, 156, 18, 0.35);
  box-shadow: inset 0 0 16px rgba(0, 0, 0, 0.85);
}

.pause-feed-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: rgba(10, 11, 14, 0.75);
  border: 1px solid rgba(243, 156, 18, 0.35);
  border-left: 2px solid var(--rf-color-amber, #f39c12);
  padding: 0.35rem 0.55rem;
  border-radius: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

.pause-feed-primary {
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #ffb732;
  text-transform: uppercase;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.95);
}

.pause-feed-secondary {
  font-size: 0.5rem;
  font-family: monospace;
  font-weight: 700;
  letter-spacing: 0.09em;
  color: rgba(232, 232, 236, 0.75);
  text-transform: uppercase;
  line-height: 1;
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

/* MASA 3: SUBMÓDULO FÍSICO INDEPENDIENTE DE TELEMETRÍA (TELEMETRY BAY) SOBRESALIENTE */
.opponent-telemetry-bay {
  position: relative;
  width: calc(100% + 14px);
  margin-left: -7px;
  margin-bottom: -4px;
  background: linear-gradient(180deg, #1c1e25 0%, #111216 100%);
  border: 2px solid #363a46;
  border-top: 3px solid #08090b;
  border-radius: 4px;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px));
  padding: 0.6rem 0.75rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 3px 6px rgba(0, 0, 0, 0.95),
    0 4px 10px rgba(0, 0, 0, 0.6);
  z-index: 5;
}

.bay-top-seam {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: -0.4rem;
  margin-bottom: 0.35rem;
}

.bay-top-seam span {
  width: 12px;
  height: 2px;
  background: #08090b;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
}

.telemetry-bay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #2a2d37;
  padding-bottom: 0.3rem;
  margin-bottom: 0.45rem;
}

.telemetry-bay-title-box {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.telemetry-bay-indicator {
  width: 3px;
  height: 8px;
  background: var(--rf-color-cyan, #00d4ff);
  border-radius: 1px;
  box-shadow: 0 0 4px rgba(0, 212, 255, 0.6);
}

.telemetry-bay-title {
  font-size: 0.55rem;
  font-family: monospace;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.55));
  text-transform: uppercase;
}

.telemetry-bay-screws {
  display: flex;
  gap: 5px;
}

.telemetry-bay-screws span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #464a58;
  border: 1px solid #0d0e11;
}

.opponent-telemetry {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
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
</style>
