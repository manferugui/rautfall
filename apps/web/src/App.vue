<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { createGameEngine, type GameEngine, type EngineSnapshot, type GameEvent, EngineOptionsError } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';

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

function doStep(): void {
  if (!engine.value) return;
  try {
    engine.value.step({});
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
      </div>

      <div class="actions">
        <button type="button" @click="doStep">Step</button>
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

    <p class="footnote">Technical prototype — 0001</p>
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

.footnote {
  margin-top: 2rem;
  font-size: 0.75rem;
  opacity: 0.4;
  text-align: center;
}
</style>
