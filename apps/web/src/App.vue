<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { createGameEngine, type GameEngine, type EngineSnapshot, type GameEvent, EngineOptionsError, Orientation } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import { composeBoardForRendering } from './board-composition';

const engine = ref<GameEngine | null>(null);
const snapshot = ref<EngineSnapshot | null>(null);
const events = ref<readonly GameEvent[]>([]);
const error = ref<string | null>(null);

const FIXED_SEED = 42;

onMounted(() => {
  try {
    const eng = createGameEngine({ seed: FIXED_SEED, config: prototypeConfig });
    engine.value = eng;
    snapshot.value = eng.getSnapshot();
    events.value = eng.drainEvents();
  } catch (e) {
    error.value = e instanceof EngineOptionsError ? e.message : String(e);
  }
});

function doLeft(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: -1, hardDrop: false });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doStep(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: 0, hardDrop: false });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doRight(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: 1, hardDrop: false });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doHardDrop(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: 0, hardDrop: true });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doRotateCW(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: 0, hardDrop: false, rotateClockwise: true });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doRotateCCW(): void {
  if (!engine.value) return;
  try {
    engine.value.step({ horizontal: 0, hardDrop: false, rotateCounterclockwise: true });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

function doReset(): void {
  if (!engine.value) return;
  try {
    engine.value.reset({ seed: FIXED_SEED, config: prototypeConfig });
    snapshot.value = engine.value.getSnapshot();
    events.value = engine.value.drainEvents();
  } catch (e) {
    error.value = String(e);
  }
}

const renderedBoard = computed(() =>
  snapshot.value ? composeBoardForRendering(snapshot.value.board, snapshot.value.activePiece) : [],
);

const orientationLabel: Record<number, string> = {
  [Orientation.Spawn]: 'Spawn',
  [Orientation.Right]: 'Right',
  [Orientation.Reverse]: 'Reverse',
  [Orientation.Left]: 'Left',
};
</script>

<template>
  <div class="app">
    <h1>Rautfall</h1>

    <div v-if="error" class="error">
      <strong>Error:</strong> {{ error }}
    </div>

    <div v-else-if="snapshot" class="dashboard">
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Configuration version</span>
          <span class="value">{{ snapshot.configVersion }}</span>
        </div>
        <div class="info-item">
          <span class="label">Seed</span>
          <span class="value">{{ snapshot.seed }}</span>
        </div>
        <div class="info-item">
          <span class="label">Step</span>
          <span class="value">{{ snapshot.step }}</span>
        </div>
        <div class="info-item">
          <span class="label">Elapsed time (ms)</span>
          <span class="value">{{ snapshot.elapsedMs }}</span>
        </div>
        <div class="info-item">
          <span class="label">Status</span>
          <span class="value">{{ snapshot.status }}</span>
        </div>
        <div class="info-item">
          <span class="label">Cleared lines</span>
          <span class="value">{{ snapshot.clearedLines }}</span>
        </div>
      </div>

      <div v-if="snapshot.activePiece" class="piece-info">
        <h2>Active piece</h2>
        <div class="piece-details">
          <div class="info-item">
            <span class="label">Type</span>
            <span class="value">{{ snapshot.activePiece.type }}</span>
          </div>
          <div class="info-item">
            <span class="label">Position</span>
            <span class="value">({{ snapshot.activePiece.x }}, {{ snapshot.activePiece.y }})</span>
          </div>
          <div class="info-item">
            <span class="label">Orientation</span>
            <span class="value">{{ orientationLabel[snapshot.activePiece.orientation] ?? snapshot.activePiece.orientation }}</span>
          </div>
          <div class="info-item">
            <span class="label">Cells</span>
            <span class="value cell-list">
              <span v-for="(cell, ci) in snapshot.activePiece.cells" :key="ci" class="cell-coord">
                ({{ cell.x }},{{ cell.y }})
              </span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="snapshot.nextPiece" class="piece-info">
        <h2>Next piece</h2>
        <div class="piece-details">
          <div class="info-item">
            <span class="label">Type</span>
            <span class="value">{{ snapshot.nextPiece }}</span>
          </div>
        </div>
      </div>

      <div class="board-section">
        <h2>Board (24 rows, hidden: 0-3, visible: 4-23)</h2>
        <div class="board-grid">
          <div v-for="(row, yi) in renderedBoard" :key="yi" class="board-row" :class="{ 'hidden-row': yi < 4 }">
            <div class="row-label">{{ yi }}</div>
            <div
              v-for="(cell, xi) in row"
              :key="xi"
              class="board-cell"
              :class="{
                'cell-filled': cell !== null,
                'cell-I': cell === 'I',
                'cell-O': cell === 'O',
                'cell-T': cell === 'T',
                'cell-S': cell === 'S',
                'cell-Z': cell === 'Z',
                'cell-J': cell === 'J',
                'cell-L': cell === 'L',
              }"
            ></div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button type="button" @click="doLeft">Left</button>
        <button type="button" @click="doRotateCCW">Rotate CCW</button>
        <button type="button" @click="doStep">Step</button>
        <button type="button" @click="doRotateCW">Rotate CW</button>
        <button type="button" @click="doRight">Right</button>
        <button type="button" @click="doHardDrop">Hard drop</button>
        <button type="button" @click="doReset">Reset</button>
      </div>

      <div class="events">
        <h2>Latest events</h2>
        <ul v-if="events.length > 0">
          <li v-for="event in events" :key="event.step + event.type">
            <code>{{ event.type }}</code> at step {{ event.step }}
          </li>
        </ul>
        <p v-else class="empty">No events</p>
      </div>
    </div>

    <p class="footnote">Technical prototype — 0003</p>
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
  max-width: 640px;
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

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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

button:hover {
  background: #1a4a8a;
}

button:active {
  background: #0d2b50;
}

.events {
  background: #16213e;
  padding: 1rem;
  border-radius: 4px;
}

.events h2 {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.events ul {
  list-style: none;
}

.events li {
  font-size: 0.8125rem;
  padding: 0.25rem 0;
  font-family: monospace;
}

.events li + li {
  border-top: 1px solid #1a1a2e;
}

.empty {
  font-size: 0.8125rem;
  opacity: 0.5;
  font-style: italic;
}

.board-section {
  background: #16213e;
  padding: 1rem;
  border-radius: 4px;
}

.board-section h2 {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.board-grid {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.board-row {
  display: flex;
  gap: 1px;
  align-items: center;
}

.board-row.hidden-row {
  opacity: 0.4;
}

.row-label {
  width: 1.5rem;
  font-size: 0.625rem;
  font-family: monospace;
  opacity: 0.5;
  text-align: right;
  padding-right: 4px;
}

.board-cell {
  width: 14px;
  height: 14px;
  background: #1a1a2e;
  border: 1px solid #2a2a3e;
  border-radius: 1px;
}

.board-cell.cell-filled {
  border-color: #555;
}

.board-cell.cell-I { background: #00d4ff; }
.board-cell.cell-O { background: #ffd700; }
.board-cell.cell-T { background: #9b59b6; }
.board-cell.cell-S { background: #2ecc71; }
.board-cell.cell-Z { background: #e74c3c; }
.board-cell.cell-J { background: #3498db; }
.board-cell.cell-L { background: #f39c12; }

.piece-info {
  background: #16213e;
  padding: 1rem;
  border-radius: 4px;
}

.piece-info h2 {
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  opacity: 0.7;
}

.piece-details {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.cell-list {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.cell-coord {
  font-size: 0.75rem;
  background: #1a1a2e;
  padding: 1px 4px;
  border-radius: 2px;
}

.footnote {
  margin-top: 2rem;
  font-size: 0.75rem;
  opacity: 0.4;
  text-align: center;
}
</style>
