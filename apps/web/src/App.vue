<script setup lang="ts">
import { ref } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import NextPiecesPreview from './components/NextPiecesPreview.vue';
import HeldPiecePreview from './components/HeldPiecePreview.vue';
import OpponentMonitor from './components/OpponentMonitor.vue';
import CombatStatusPanel from './components/CombatStatusPanel.vue';
import type { GamePresentationState, PhaserGameController } from './game/types';

const gameState = ref<GamePresentationState>({ status: 'running', step: 0, elapsedMs: 0, nextPieces: ['I', 'I', 'I'], heldPiece: null });
const error = ref<string | null>(null);
let controller: PhaserGameController | null = null;

function onStateUpdate(state: GamePresentationState): void {
  gameState.value = state;
}

function onControllerReady(c: PhaserGameController): void {
  controller = c;
}

function doReset(): void {
  if (controller) {
    controller.reset();
  }
}

function doTogglePause(): void {
  controller?.togglePause();
}
</script>

<template>
  <div class="app">
    <!-- Aviso de ancho insuficiente: fuera de la carcasa, es un mensaje de sistema, no parte de la máquina -->
    <div class="width-warning" data-testid="width-warning" role="status">
      Rautfall Tactical está pensado para escritorio o portátil con más ancho de pantalla.
      La experiencia puede resultar incómoda por debajo de 760 px.
    </div>

    <div class="tactical-chassis panel-riveted">
      <header class="app-header">
        <div class="title-tag">
          <h1 class="app-title">Rautfall</h1>
        </div>
        <span class="app-descriptor">Build. Disrupt. Survive.</span>
        <div class="hazard-strip" aria-hidden="true"></div>
      </header>

      <div v-if="error" class="error">
        <strong>Error:</strong> {{ error }}
      </div>

      <div class="game-layout">
        <!-- Zona 1: Tablero propio -->
        <div class="board-column" data-testid="own-board-column">
          <div class="board-bezel" :class="`board-bezel--${gameState.status}`">
            <div class="canvas-wrapper">
              <GameCanvas
                :on-state-update="onStateUpdate"
                @controller-ready="onControllerReady"
              />
              <div v-if="gameState.status === 'paused'" class="pause-overlay" role="status" aria-live="polite" data-testid="pause-overlay">
                PAUSA
              </div>
            </div>
          </div>
        </div>

        <!-- Zona 2: Columna táctica -->
        <div class="tactical-column" data-testid="tactical-column">
          <div class="tactical-console">
            <!-- Reserva -->
            <div class="console-section">
              <HeldPiecePreview :held-piece="gameState.heldPiece" />
            </div>

            <div class="console-divider"></div>

            <!-- Próximas piezas reales -->
            <div class="console-section">
              <NextPiecesPreview :next-pieces="gameState.nextPieces" />
            </div>

            <div class="console-divider"></div>

            <!-- Estado de sesión real -->
            <div class="console-section">
              <div class="session-header">
                <span class="panel-label">Estado de sesión</span>
              </div>
              <div class="session-grid">
                <div class="session-item">
                  <span class="session-label">Status</span>
                  <span class="session-value" :class="gameState.status" data-testid="session-status">{{ gameState.status }}</span>
                </div>
                <div class="session-item">
                  <span class="session-label">Step</span>
                  <span class="session-value" data-testid="session-step">{{ gameState.step }}</span>
                </div>
                <div class="session-item">
                  <span class="session-label">Tiempo (ms)</span>
                  <span class="session-value">{{ gameState.elapsedMs }}</span>
                </div>
              </div>
            </div>

            <div class="console-divider"></div>

            <!-- Controles reales -->
            <div class="console-section console-section--actions">
              <div class="actions">
                <button
                  type="button"
                  :disabled="gameState.status === 'gameOver'"
                  data-testid="pause-toggle"
                  @click="doTogglePause"
                >
                  {{ gameState.status === 'paused' ? 'Reanudar' : 'Pausar' }}
                </button>
                <button type="button" data-testid="reset-button" @click="doReset">
                  Reiniciar
                </button>
              </div>

              <div class="controls-help">
                <h2 class="controls-heading">Controles</h2>
                <ul>
                  <li><kbd>&larr;</kbd> <kbd>&rarr;</kbd> Mover</li>
                  <li><kbd>&uarr;</kbd> Girar sentido horario</li>
                  <li><kbd>Z</kbd> Girar sentido antihorario</li>
                  <li><kbd>Space</kbd> Caída instantánea</li>
                  <li><kbd>R</kbd> Reiniciar</li>
                  <li><kbd>Esc</kbd> Pausar/Reanudar</li>
                  <li><kbd>C</kbd> Reserva</li>
                </ul>
              </div>
            </div>

            <div class="console-divider"></div>

            <!-- Panel de combate simulado -->
            <div class="console-section">
              <CombatStatusPanel />
            </div>
          </div>

          <!-- Banner de gameOver -->
          <div v-if="gameState.status === 'gameOver'" class="game-over-banner">
            GAME OVER
          </div>
        </div>

        <!-- Zona 3: Monitor rival -->
        <div class="opponent-column" data-testid="opponent-column">
          <OpponentMonitor />
        </div>
      </div>
    </div>

    <p class="footnote">Prototipo técnico — 0009b</p>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--rf-color-void, #0b0b0d);
  background-image: radial-gradient(ellipse at 50% -10%, rgba(255, 255, 255, 0.04), transparent 60%);
  color: var(--rf-color-text-primary, #e8e8ec);
  min-height: 100vh;
}

.app {
  max-width: 1440px;
  margin: 0 auto;
  padding: 2rem 1.25rem 1.5rem;
}

/* Carcasa general: agrupa cabecera y las tres zonas en una única máquina */
.tactical-chassis {
  position: relative;
  background: linear-gradient(180deg, var(--rf-color-graphite-800, #1f2023), var(--rf-color-graphite-900, #17181a));
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel), var(--rf-shadow-chassis);
  padding: 1.25rem 1.75rem 1.75rem;
}

/* Remaches decorativos de esquina: máximo dos por panel, reservados a la carcasa general */
.panel-riveted::before,
.panel-riveted::after {
  content: '';
  position: absolute;
  top: 10px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--rf-rivet, #55565b);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}

.panel-riveted::before {
  left: 12px;
}

.panel-riveted::after {
  right: 12px;
}

/* Cabecera: placa estructural integrada en la carcasa, no un <header> web */
.app-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.title-tag {
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 3px solid var(--rf-color-amber, #f39c12);
  clip-path: polygon(0 0, 100% 0, 94% 100%, 0% 100%);
  padding: 0.35rem 1.5rem 0.35rem 0.85rem;
}

.app-title {
  font-size: 1.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--rf-color-text-primary, #e8e8ec);
  white-space: nowrap;
}

.app-descriptor {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.hazard-strip {
  flex-shrink: 0;
  width: 72px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.7;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-amber, #f39c12) 0 6px,
    var(--rf-color-graphite-900, #17181a) 6px 12px
  );
}

/* Error */
.error {
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-red, #e74c3c);
  padding: 1rem;
  border-radius: var(--rf-radius-md, 6px);
  margin-bottom: 1rem;
  font-family: monospace;
  border: 1px solid var(--rf-color-red, #e74c3c);
}

/* Layout Tactical de tres columnas */
.game-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: center;
}

/* Zona 1: Tablero propio — carcasa · bisel · hueco interior · canvas */
.board-column {
  flex-shrink: 0;
  background: var(--rf-color-graphite-800, #1f2023);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
  padding: 14px;
}

.board-bezel {
  border-radius: var(--rf-radius-sm, 3px);
  padding: 4px;
  background: linear-gradient(135deg, var(--rf-color-metal-400, #55565b), var(--rf-color-metal-600, #3a3b3f) 70%);
  box-shadow: var(--rf-shadow-board-frame);
}

.board-bezel--running {
  background: linear-gradient(135deg, var(--rf-color-cyan, #00d4ff), var(--rf-color-metal-600, #3a3b3f) 75%);
}

.board-bezel--paused {
  background: linear-gradient(135deg, var(--rf-color-amber, #f39c12), var(--rf-color-metal-600, #3a3b3f) 75%);
}

.board-bezel--gameOver {
  background: linear-gradient(135deg, var(--rf-color-red, #e74c3c), var(--rf-color-metal-600, #3a3b3f) 75%);
}

.canvas-wrapper {
  position: relative;
  background: var(--rf-color-graphite-900, #17181a);
  border-radius: 3px;
  box-shadow: var(--rf-shadow-recessed);
  padding: 8px;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 11, 13, 0.75);
  color: var(--rf-color-amber, #f39c12);
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 0.2em;
  pointer-events: none;
  border-radius: 3px;
}

/* Zona 2: Columna táctica — una única consola de instrumentación, no tarjetas sueltas */
.tactical-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 320px;
  max-width: 400px;
}

.tactical-console {
  background: var(--rf-color-graphite-800, #1f2023);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
}

.console-section {
  padding: 0.6rem 0;
}

.console-section:first-child {
  padding-top: 0;
}

.console-section--actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.console-divider {
  height: 1px;
  flex-shrink: 0;
  background: linear-gradient(90deg, transparent, var(--rf-color-metal-600, #3a3b3f), transparent);
}

.session-header {
  margin-bottom: 0.5rem;
}

.panel-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.session-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
}

.session-item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.session-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.session-value {
  font-size: 1rem;
  font-family: monospace;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.session-value.running {
  color: var(--rf-color-cyan, #00d4ff);
}

.session-value.paused {
  color: var(--rf-color-amber, #f39c12);
}

.session-value.gameOver {
  color: var(--rf-color-red, #e74c3c);
}

/* Acciones */
.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}

button:hover:not(:disabled) {
  background: var(--rf-color-graphite-800, #1f2023);
}

button:active:not(:disabled) {
  background: var(--rf-color-graphite-900, #17181a);
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Controles: fila más dentro de la misma consola, sin chrome de tarjeta propia */
.controls-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.controls-help ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.controls-help li {
  font-size: 0.8125rem;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.controls-help kbd {
  background: var(--rf-color-graphite-700, #28292c);
  padding: 1px 6px;
  border-radius: var(--rf-radius-sm, 3px);
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
}

/* Game Over */
.game-over-banner {
  background: var(--rf-color-graphite-900, #17181a);
  color: var(--rf-color-red, #e74c3c);
  padding: 0.75rem;
  border-radius: var(--rf-radius-md, 6px);
  text-align: center;
  font-size: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.1em;
  border: 1px solid var(--rf-color-red, #e74c3c);
  border-left: 4px solid var(--rf-color-red, #e74c3c);
}

/* Zona 3: Monitor rival */
.opponent-column {
  flex-shrink: 0;
}

/* Aviso de ancho insuficiente */
.width-warning {
  display: none;
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-amber, #f39c12);
  padding: 0.75rem 1rem;
  border-radius: var(--rf-radius-md, 6px);
  margin-bottom: 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid var(--rf-color-amber, #f39c12);
  text-align: center;
}

.footnote {
  margin-top: 2rem;
  font-size: 0.75rem;
  opacity: 0.4;
  text-align: center;
}

/* === RESPONSIVE === */

/* Portátil compacto: 760px – 1199px — tablero fijo a la izquierda,
   columna táctica y monitor rival apilados a la derecha en ese orden */
@media (max-width: 1199px) {
  .game-layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
  }

  .board-column {
    grid-column: 1;
    grid-row: 1 / span 2;
  }

  .tactical-column {
    grid-column: 2;
    grid-row: 1;
    max-width: none;
  }

  .opponent-column {
    grid-column: 2;
    grid-row: 2;
  }
}

/* Suelo mínimo: < 760px */
@media (max-width: 759px) {
  .game-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .width-warning {
    display: flex;
  }

  .board-column,
  .tactical-column,
  .opponent-column {
    max-width: 100%;
    min-width: auto;
    width: auto;
  }
}
</style>
