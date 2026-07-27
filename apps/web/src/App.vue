<script setup lang="ts">
import { ref } from 'vue';
import GameCanvas from './components/GameCanvas.vue';
import NextPiecesPreview from './components/NextPiecesPreview.vue';
import type { GamePresentationState, PhaserGameController } from './game/types';

const gameState = ref<GamePresentationState>({ status: 'running', step: 0, elapsedMs: 0, nextPieces: ['I', 'I', 'I'] });
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
    <h1>Rautfall</h1>

    <div v-if="error" class="error">
      <strong>Error:</strong> {{ error }}
    </div>

    <div class="game-layout">
      <div class="canvas-wrapper">
        <GameCanvas
          :on-state-update="onStateUpdate"
          @controller-ready="onControllerReady"
        />
        <div v-if="gameState.status === 'paused'" class="pause-overlay" role="status" aria-live="polite">
          PAUSA
        </div>
      </div>

      <div class="info-panel">
        <div class="info-grid">
          <div class="info-item">
            <span class="label">Status</span>
            <span class="value">{{ gameState.status }}</span>
          </div>
          <div class="info-item">
            <span class="label">Step</span>
            <span class="value">{{ gameState.step }}</span>
          </div>
          <div class="info-item">
            <span class="label">Elapsed time (ms)</span>
            <span class="value">{{ gameState.elapsedMs }}</span>
          </div>
        </div>

        <NextPiecesPreview :next-pieces="gameState.nextPieces" />

        <div class="actions">
          <button type="button" :disabled="gameState.status === 'gameOver'" @click="doTogglePause">
            {{ gameState.status === 'paused' ? 'Reanudar' : 'Pausar' }}
          </button>
          <button type="button" @click="doReset">Reiniciar</button>
        </div>

        <div class="controls-help">
          <h2>Controles</h2>
          <ul>
            <li><kbd>&larr;</kbd> <kbd>&rarr;</kbd> Mover</li>
            <li><kbd>&uarr;</kbd> Girar sentido horario</li>
            <li><kbd>Z</kbd> Girar sentido antihorario</li>
            <li><kbd>Space</kbd> Caída instantánea</li>
            <li><kbd>R</kbd> Reiniciar</li>
            <li><kbd>Esc</kbd> Pausar/Reanudar</li>
          </ul>
        </div>

        <div v-if="gameState.status === 'gameOver'" class="game-over-banner">
          GAME OVER
        </div>
      </div>
    </div>

    <p class="footnote">Prototipo técnico — 0008</p>
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
  background: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.error {
  background: #3d1f1f;
  color: #ff6b6b;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-family: monospace;
}

.game-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;
}

.canvas-wrapper {
  flex-shrink: 0;
  position: relative;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 20, 0.6);
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 0.2em;
  pointer-events: none;
}

.info-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}

.info-item {
  background: #16213e;
  padding: 0.75rem;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.value {
  font-size: 1.125rem;
  font-family: monospace;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

button {
  padding: 0.5rem 1.25rem;
  font-size: 0.875rem;
  font-family: inherit;
  border: 1px solid #0f3460;
  background: #0f3460;
  color: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

button:hover:not(:disabled) {
  background: #1a4a8a;
}

button:active:not(:disabled) {
  background: #0d2b50;
}

button:disabled {
  opacity: 0.4;
  cursor: default;
}

.controls-help {
  background: #16213e;
  padding: 1rem;
  border-radius: 4px;
}

.controls-help h2 {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.controls-help ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.controls-help li {
  font-size: 0.8125rem;
}

.controls-help kbd {
  background: #0f3460;
  padding: 1px 6px;
  border-radius: 2px;
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid #1a4a8a;
}

.game-over-banner {
  background: #8b0000;
  color: #ffffff;
  padding: 1rem;
  border-radius: 4px;
  text-align: center;
  font-size: 1.25rem;
  font-weight: bold;
  letter-spacing: 0.1em;
}

.footnote {
  margin-top: 2rem;
  font-size: 0.75rem;
  opacity: 0.4;
  text-align: center;
}
</style>
