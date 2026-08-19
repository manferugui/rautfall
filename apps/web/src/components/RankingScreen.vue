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

import { ref, watch } from 'vue';
import type { RankingEntry, GameModeContract } from '@rautfall/contracts';
import { getRanking } from '../api/client';
import { getAudioManager } from '../audio';

const props = withDefaults(
  defineProps<{
    initialMode?: GameModeContract;
  }>(),
  {
    initialMode: 'battle',
  }
);

const emit = defineEmits<{
  (e: 'back-to-menu'): void;
}>();

const audioManager = getAudioManager();
const selectedMode = ref<GameModeContract>(props.initialMode || 'battle');
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

watch(
  () => props.initialMode,
  (newMode) => {
    void loadRanking(newMode || 'battle');
  },
  { immediate: true }
);

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
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const min = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} ${hours}:${min}`;
  } catch {
    return isoString;
  }
}
</script>

<template>
  <div class="ranking-screen" data-testid="ranking-screen">
    <div class="ranking-plate rf-riveted-panel">
      <!-- Tornillos mecánicos en las 4 esquinas de la placa principal -->
      <div class="plate-bolt bolt--tl" aria-hidden="true"></div>
      <div class="plate-bolt bolt--tr" aria-hidden="true"></div>
      <div class="plate-bolt bolt--bl" aria-hidden="true"></div>
      <div class="plate-bolt bolt--br" aria-hidden="true"></div>

      <!-- Cabecera táctica -->
      <header class="ranking-header">
        <div class="title-container">
          <h1 class="screen-title" data-testid="ranking-title">CLASIFICACIÓN DE OPERADORES</h1>
          <span class="screen-badge">MEJORES REGISTROS</span>
        </div>

        <button
          type="button"
          class="rf-btn-tactical rf-btn-secondary back-btn"
          data-testid="ranking-back-button"
          @click="onBack"
        >
          VOLVER AL MENÚ
        </button>
      </header>

      <div class="rf-hazard-strip hazard-strip" aria-hidden="true"></div>

      <!-- Selector de Modo de Juego -->
      <div class="mode-tabs" data-testid="ranking-mode-tabs">
        <button
          type="button"
          class="mode-tab"
          :class="{ 'mode-tab--active': selectedMode === 'battle' }"
          data-testid="tab-battle"
          @click="onSelectMode('battle')"
        >
          BATALLA 2P
        </button>

        <button
          type="button"
          class="mode-tab"
          :class="{ 'mode-tab--active': selectedMode === 'training' }"
          data-testid="tab-training"
          @click="onSelectMode('training')"
        >
          ENTRENAMIENTO 1P
        </button>
      </div>

      <!-- Cuerpo de Contenido / Tabla -->
      <main class="ranking-body">
        <!-- Estado: Cargando -->
        <div v-if="status === 'loading'" class="status-box" data-testid="ranking-loading">
          <span class="spinner" aria-hidden="true"></span>
          <p class="status-text">Cargando clasificación de {{ selectedMode === 'battle' ? 'Batalla' : 'Entrenamiento' }}…</p>
        </div>

        <!-- Estado: Error -->
        <div v-else-if="status === 'error'" class="status-box status-box--error" data-testid="ranking-error">
          <p class="status-title">ERROR DE CONEXIÓN</p>
          <p class="status-text">{{ errorMessage }}</p>
          <button
            type="button"
            class="rf-btn-tactical rf-btn-primary retry-btn"
            data-testid="ranking-retry-button"
            @click="loadRanking(selectedMode)"
          >
            REINTENTAR
          </button>
        </div>

        <!-- Estado: Vacío -->
        <div v-else-if="status === 'empty'" class="status-box status-box--empty" data-testid="ranking-empty">
          <p class="status-title">SIN REGISTROS</p>
          <p class="status-text">
            No hay puntuaciones registradas para el modo {{ selectedMode === 'battle' ? 'Batalla 2P' : 'Entrenamiento 1P' }}.
          </p>
        </div>

        <!-- Estado: Éxito con Tabla -->
        <div v-else-if="status === 'success'" class="table-container" data-testid="ranking-table">
          <table class="ranking-table">
            <thead>
              <tr>
                <th class="col-rank">POS</th>
                <th class="col-player">OPERADOR</th>
                <th class="col-score">PUNTUACIÓN</th>
                <th class="col-level">NIVEL</th>
                <th class="col-time">TIEMPO</th>
                <th class="col-date">FECHA</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in rankingList"
                :key="item.rank"
                class="ranking-row"
                :class="{ 'ranking-row--top3': item.rank <= 3 }"
                :data-testid="`ranking-row-${item.rank}`"
              >
                <td class="col-rank">
                  <span class="rank-badge" :class="`rank-badge--${item.rank}`">#{{ item.rank }}</span>
                </td>
                <td class="col-player">
                  <span class="rf-keycap player-tag">{{ item.playerName }}</span>
                </td>
                <td class="col-score">
                  <span class="score-value">{{ item.score.toLocaleString('es-ES') }}</span>
                </td>
                <td class="col-level">{{ item.level }}</td>
                <td class="col-time">{{ formatDuration(item.durationMs) }}</td>
                <td class="col-date">{{ formatDate(item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.ranking-screen {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--rf-color-graphite-900, #0d0e10);
  padding: 1.75rem 1.5rem 1.5rem;
  box-sizing: border-box;
  overflow: hidden;
}

.ranking-plate {
  position: relative;
  width: 100%;
  max-width: 860px;
  height: calc(100vh - 3.5rem);
  max-height: calc(100vh - 3.5rem);
  background: linear-gradient(165deg, #1c1d21 0%, #101114 60%, #0a0b0d 100%);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  padding: 1.75rem 1.5rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -3px 8px rgba(0, 0, 0, 0.9),
    0 16px 40px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-sizing: border-box;
  overflow: hidden;
}

.plate-bolt {
  position: absolute;
  width: 10px;
  height: 10px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.9));
  z-index: 4;
}

.bolt--tl { top: 8px; left: 9px; }
.bolt--tr { top: 8px; right: 9px; }
.bolt--bl { bottom: 8px; left: 9px; }
.bolt--br { bottom: 8px; right: 9px; }

.ranking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.title-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.screen-title {
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--rf-color-text-primary, #e8e8ec);
  margin: 0;
}

.screen-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-cyan, #00d4ff);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 3px solid var(--rf-color-cyan, #00d4ff);
  padding: 0.2rem 0.5rem;
  border-radius: 2px;
}

.back-btn {
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
}

.hazard-strip {
  width: 100%;
  height: 6px;
  border-radius: 2px;
  opacity: 0.65;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-cyan, #00d4ff) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

/* Tabs de Modo */
.mode-tabs {
  display: flex;
  gap: 0.5rem;
  background: #08090b;
  padding: 0.35rem;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: 4px;
}

.mode-tab {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.5rem 1rem;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.mode-tab:hover {
  color: var(--rf-color-text-primary, #e8e8ec);
  background: rgba(255, 255, 255, 0.04);
}

.mode-tab--active {
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-cyan, #00d4ff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border-left: 3px solid var(--rf-color-cyan, #00d4ff);
}

.ranking-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding-right: 0.35rem;
  scrollbar-width: thin;
  scrollbar-color: #4a4c54 #14151a;
}

.ranking-body::-webkit-scrollbar {
  width: 9px;
}

.ranking-body::-webkit-scrollbar-track {
  background: #14151a;
}

.ranking-body::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #52545c 0%, #34363c 100%);
  border: 1px solid #0a0b0c;
  border-radius: 2px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
}

.ranking-body::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #62646c 0%, #40424a 100%);
}

.status-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.status-title {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  margin: 0;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.status-text {
  font-size: 0.85rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin: 0;
}

.status-box--error .status-title {
  color: var(--rf-color-red, #e74c3c);
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(0, 212, 255, 0.2);
  border-top-color: var(--rf-color-cyan, #00d4ff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 0.5rem;
  padding: 0.4rem 1rem;
}

/* Tabla de Ranking */
.table-container {
  overflow-x: auto;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: 4px;
  background: #08090b;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.82rem;
}

.ranking-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #141518;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--rf-color-metal-600, #3a3b3f);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.ranking-table td {
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  color: var(--rf-color-text-primary, #e8e8ec);
}

.ranking-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.ranking-row--top3 {
  background: rgba(0, 212, 255, 0.03);
}

.col-rank { width: 70px; }
.col-player { width: 140px; }
.col-score { font-family: monospace; font-weight: 800; }
.col-level { width: 80px; text-align: center; }
.col-time { width: 100px; font-family: monospace; }
.col-date { width: 130px; color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6)); font-size: 0.75rem; }

.rank-badge {
  font-family: monospace;
  font-weight: 800;
  padding: 0.15rem 0.4rem;
  border-radius: 2px;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.rank-badge--1 {
  color: #ffd700;
  text-shadow: 0 0 6px rgba(255, 215, 0, 0.4);
}

.rank-badge--2 {
  color: #c0c0c0;
}

.rank-badge--3 {
  color: #cd7f32;
}

.player-tag {
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--rf-color-cyan, #00d4ff);
}

.score-value {
  font-size: 0.95rem;
  color: var(--rf-color-cyan, #00d4ff);
}
</style>
