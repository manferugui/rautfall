<script setup lang="ts">
/**
 * Componente Modal / Panel de Resultados al finalizar la partida.
 *
 * Responsabilidades:
 * - Mostrar el resultado oficial de la partida (Victoria, Derrota, Empate, Fin de Entrenamiento).
 * - Exponer desglose de métricas oficiales de dominio (Puntuación, Nivel, Tiempo transcurrido).
 * - Proveer acciones inmediatas: Volver a jugar (mismo modo) y Menú principal.
 * - No calcula ni muestra métricas no registradas en los contratos oficiales.
 */

import { computed } from 'vue';
import type { GameResultSummary } from '../game/types';

const props = defineProps<{
  result: GameResultSummary;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
}>();

const emit = defineEmits<{
  (e: 'replay'): void;
  (e: 'mainMenu'): void;
}>();

const formattedTime = computed(() => {
  const totalSec = Math.floor(props.result.elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
});

const isBattle = computed(() => props.result.mode === 'battle');

const titleClass = computed(() => {
  if (!isBattle.value) return 'results-title--training';
  const winner = props.result.battleResult?.winner;
  if (winner === 'playerOne') return 'results-title--victory';
  if (winner === 'playerTwo') return 'results-title--defeat';
  return 'results-title--draw';
});
</script>

<template>
  <div class="results-backdrop" data-testid="results-modal" role="dialog" aria-modal="true">
    <div class="results-modal">
      <div class="results-header">
        <h2 class="results-title" :class="titleClass" data-testid="results-title">
          {{ result.title }}
        </h2>
        <p v-if="result.subtitle" class="results-subtitle">{{ result.subtitle }}</p>

        <div v-if="saveStatus" class="save-status-tag" data-testid="save-status-tag">
          <span v-if="saveStatus === 'saving'" class="save-status save-status--saving">⏳ Guardando en ranking...</span>
          <span v-else-if="saveStatus === 'saved'" class="save-status save-status--saved">✓ Partida registrada</span>
          <span v-else-if="saveStatus === 'error'" class="save-status save-status--error">⚠️ Modo local (sin servidor)</span>
        </div>
      </div>

      <div class="results-divider"></div>

      <div class="results-grid">
        <div class="result-metric">
          <span class="metric-label">Puntuación final</span>
          <span class="metric-value" data-testid="final-score">{{ result.score }}</span>
        </div>

        <div class="result-metric">
          <span class="metric-label">Nivel alcanzado</span>
          <span class="metric-value" data-testid="final-level">{{ result.level }}</span>
        </div>

        <div class="result-metric">
          <span class="metric-label">Tiempo de partida</span>
          <span class="metric-value" data-testid="final-time">{{ formattedTime }}</span>
        </div>

        <div v-if="isBattle && result.battleResult" class="result-metric">
          <span class="metric-label">Paso global (Battle)</span>
          <span class="metric-value" data-testid="final-battle-step">{{ result.battleResult.step }}</span>
        </div>
      </div>

      <div class="results-divider"></div>

      <div class="results-actions">
        <button
          type="button"
          class="action-btn action-btn--primary"
          data-testid="replay-button"
          @click="emit('replay')"
        >
          Volver a jugar
        </button>

        <button
          type="button"
          class="action-btn action-btn--secondary"
          data-testid="main-menu-button"
          @click="emit('mainMenu')"
        >
          Menú principal
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.results-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(11, 11, 13, 0.85);
  backdrop-filter: blur(4px);
  padding: 1rem;
}

.results-modal {
  width: 100%;
  max-width: 440px;
  background: var(--rf-color-graphite-800, #1f2023);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.results-header {
  text-align: center;
}

.results-title {
  font-size: 1.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.results-title--victory {
  color: var(--rf-color-cyan, #00d4ff);
}

.results-title--defeat {
  color: var(--rf-color-red, #e74c3c);
}

.results-title--draw {
  color: var(--rf-color-amber, #f39c12);
}

.results-title--training {
  color: var(--rf-color-amber, #f39c12);
}

.results-subtitle {
  font-size: 0.8125rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin-top: 0.25rem;
}

.save-status-tag {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.save-status--saving {
  color: var(--rf-color-amber, #f39c12);
}

.save-status--saved {
  color: var(--rf-color-cyan, #00d4ff);
}

.save-status--error {
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.results-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--rf-color-metal-600, #3a3b3f), transparent);
}

.results-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.result-metric {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: var(--rf-color-graphite-900, #17181a);
  padding: 0.75rem;
  border-radius: var(--rf-radius-sm, 3px);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.metric-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.metric-value {
  font-size: 1.25rem;
  font-family: monospace;
  font-weight: bold;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.results-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.action-btn--primary {
  border: 1px solid var(--rf-color-cyan, #00d4ff);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-cyan, #00d4ff);
}

.action-btn--primary:hover {
  background: var(--rf-color-graphite-800, #1f2023);
}

.action-btn--secondary {
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
}

.action-btn--secondary:hover {
  background: var(--rf-color-graphite-800, #1f2023);
}
</style>
