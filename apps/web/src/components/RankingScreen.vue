<script setup lang="ts">
/**
 * Pantalla de Ranking por Modo de Juego (Batalla / Entrenamiento).
 *
 * Responsabilidades:
 * - Consultar y presentar las mejores puntuaciones únicas por jugador dentro de cada modo.
 * - Proveer selector explícito de modo (Batalla / Entrenamiento).
 * - Soportar estados: loading, empty, error (con reintento), success.
 * - Estética Industrial Dramatic.
 */

import { ref, onMounted } from 'vue';
import type { RankingEntry, GameModeContract } from '@rautfall/contracts';
import { getRanking } from '../api/client';
import { getAudioManager } from '../audio';

const emit = defineEmits<{
  (e: 'back-to-menu'): void;
}>();

const audioManager = getAudioManager();
const selectedMode = ref<GameModeContract>('battle');
const status = ref<'loading' | 'empty' | 'error' | 'success'>('loading');
const errorMessage = ref<string>('');
const rankingList = ref<RankingEntry[]>([]);

async function loadRanking(mode: GameModeContract): Promise<void> {
  selectedMode.value = mode;
  status.value = 'loading';
  errorMessage.value = '';
  try {
    const data = await getRanking(mode, 30);
    rankingList.value = data;
    if (data.length === 0) {
      status.value = 'empty';
    } else {
      status.value = 'success';
    }
  } catch (err: unknown) {
    status.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : 'Error desconocido al cargar el ranking.';
  }
}

onMounted(() => {
  void loadRanking('battle');
});

function onSelectMode(mode: GameModeContract): void {
  audioManager.playSfx('uiClick');
  void loadRanking(mode);
}

function onBack(): void {
  audioManager.playSfx('uiClick');
  emit('back-to-menu');
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}
</script>

<template>
  <div class="ranking-screen" data-testid="ranking-screen">
    <div class="ranking-header">
      <div class="header-tag">
        <h1 class="header-title">CLASIFICACIÓN Y RANKING</h1>
      </div>
      <p class="header-subtitle">Mejor puntuación individual por jugador</p>
    </div>

    <div class="hazard-strip" aria-hidden="true"></div>

    <div class="mode-tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ 'tab-btn--active': selectedMode === 'battle' }"
        data-testid="ranking-tab-battle"
        @click="onSelectMode('battle')"
      >
        BATALLA CONTRA LA IA
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{ 'tab-btn--active': selectedMode === 'training' }"
        data-testid="ranking-tab-training"
        @click="onSelectMode('training')"
      >
        MODO ENTRENAMIENTO
      </button>
    </div>

    <div class="ranking-content">
      <div v-if="status === 'loading'" class="state-panel state-panel--loading" data-testid="ranking-loading">
        <span class="loading-spinner" aria-hidden="true">⏳</span>
        <p>Cargando clasificación de {{ selectedMode === 'battle' ? 'Batalla' : 'Entrenamiento' }}...</p>
      </div>

      <div v-else-if="status === 'error'" class="state-panel state-panel--error" data-testid="ranking-error">
        <p class="error-msg">⚠️ No se pudo obtener la clasificación</p>
        <p class="error-sub">{{ errorMessage }}</p>
        <button type="button" class="retry-btn" data-testid="ranking-retry-button" @click="loadRanking(selectedMode)">
          REINTENTAR CONEXIÓN
        </button>
      </div>

      <div v-else-if="status === 'empty'" class="state-panel state-panel--empty" data-testid="ranking-empty">
        <p>No existen registros de ranking todavía para el modo {{ selectedMode === 'battle' ? 'Batalla' : 'Entrenamiento' }}.</p>
        <p class="empty-sub">Sé el primero en completar una partida en este modo para inaugurar la tabla.</p>
      </div>

      <div v-else-if="status === 'success'" class="table-container" data-testid="ranking-table">
        <table class="ranking-table">
          <thead>
            <tr>
              <th class="rank-col">Pos.</th>
              <th>Jugador</th>
              <th>Puntuación</th>
              <th>Líneas</th>
              <th>Nivel</th>
              <th>Duración</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in rankingList" :key="item.playerId" data-testid="ranking-row">
              <td class="rank-col">
                <span class="rank-badge" :class="`rank-badge--top${item.rank <= 3 ? item.rank : 'other'}`">
                  #{{ item.rank }}
                </span>
              </td>
              <td class="player-col">{{ item.playerName }}</td>
              <td class="numeric-val score-highlight">{{ item.score }}</td>
              <td class="numeric-val">{{ item.linesCleared }}</td>
              <td class="numeric-val">{{ item.level }}</td>
              <td class="numeric-val">{{ formatDuration(item.durationMs) }}</td>
              <td class="date-val">{{ formatDate(item.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="ranking-footer">
      <button
        type="button"
        class="back-btn"
        data-testid="ranking-back-button"
        @click="onBack"
      >
        VOLVER AL MENÚ PRINCIPAL
      </button>
    </div>
  </div>
</template>

<style scoped>
.ranking-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  max-width: 720px;
  width: 100%;
  margin: 1.5rem auto;
  padding: 1.75rem;
  background: var(--rf-color-graphite-800, #1f2023);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
}

.ranking-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.header-tag {
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-amber, #f39c12);
  padding: 0.5rem 1.5rem 0.5rem 1rem;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.header-subtitle {
  font-size: 0.8125rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.hazard-strip {
  width: 100%;
  height: 8px;
  border-radius: 2px;
  opacity: 0.5;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-amber, #f39c12) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

.mode-tabs {
  display: flex;
  width: 100%;
  gap: 0.5rem;
}

.tab-btn {
  flex: 1;
  padding: 0.6rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-900, #17181a);
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.tab-btn--active {
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-amber, #f39c12);
  border-color: var(--rf-color-amber, #f39c12);
}

.ranking-content {
  width: 100%;
  min-height: 240px;
}

.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
  text-align: center;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.error-msg {
  color: var(--rf-color-red, #e74c3c);
  font-weight: 700;
}

.error-sub, .empty-sub {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.retry-btn {
  padding: 0.5rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid var(--rf-color-amber, #f39c12);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-amber, #f39c12);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  text-align: left;
}

.ranking-table th {
  padding: 0.6rem 0.75rem;
  background: var(--rf-color-graphite-900, #17181a);
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--rf-color-metal-600, #3a3b3f);
}

.ranking-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--rf-color-metal-600, #3a3b3f);
  color: var(--rf-color-text-primary, #e8e8ec);
}

.rank-col {
  width: 50px;
  text-align: center;
}

.rank-badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-weight: 800;
  border-radius: 2px;
}

.rank-badge--top1 {
  background: rgba(243, 156, 18, 0.25);
  color: var(--rf-color-amber, #f39c12);
  border: 1px solid var(--rf-color-amber, #f39c12);
}

.rank-badge--top2 {
  background: rgba(0, 212, 255, 0.2);
  color: var(--rf-color-cyan, #00d4ff);
  border: 1px solid var(--rf-color-cyan, #00d4ff);
}

.rank-badge--top3 {
  background: rgba(232, 232, 236, 0.15);
  color: var(--rf-color-text-primary, #e8e8ec);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.rank-badge--topother {
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.player-col {
  font-weight: 700;
}

.numeric-val {
  font-family: monospace;
  font-weight: bold;
}

.score-highlight {
  color: var(--rf-color-amber, #f39c12);
}

.date-val {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.ranking-footer {
  width: 100%;
  display: flex;
  justify-content: center;
}

.back-btn {
  padding: 0.75rem 1.5rem;
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
  transition: background 0.15s, border-color 0.15s;
}

.back-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-amber, #f39c12);
}
</style>
