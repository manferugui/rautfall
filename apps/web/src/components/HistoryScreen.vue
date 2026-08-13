<script setup lang="ts">
/**
 * Pantalla de Historial de Partidas del Jugador Local.
 *
 * Responsabilidades:
 * - Consultar y presentar las partidas recientes del playerId anónimo local.
 * - Soportar estados: loading, empty, error (con reintento), success.
 * - Estética Industrial Dramatic.
 */

import { ref, onMounted } from 'vue';
import type { MatchRecord } from '@rautfall/contracts';
import { getOrCreatePlayerId, getPlayerName } from '../api/identity';
import { getMatchHistory } from '../api/client';
import { getAudioManager } from '../audio';

const emit = defineEmits<{
  (e: 'back-to-menu'): void;
}>();

const audioManager = getAudioManager();
const playerId = getOrCreatePlayerId();
const playerName = getPlayerName();

const status = ref<'loading' | 'empty' | 'error' | 'success'>('loading');
const errorMessage = ref<string>('');
const matchesList = ref<MatchRecord[]>([]);

async function loadHistory(): Promise<void> {
  status.value = 'loading';
  errorMessage.value = '';
  try {
    const data = await getMatchHistory(playerId, 30);
    matchesList.value = data;
    if (data.length === 0) {
      status.value = 'empty';
    } else {
      status.value = 'success';
    }
  } catch (err: unknown) {
    status.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : 'Error desconocido al cargar el historial.';
  }
}

onMounted(() => {
  void loadHistory();
});

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
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getResultText(record: MatchRecord): string {
  if (record.mode === 'training') return 'FINALIZADA';
  if (record.result === 'victory') return 'VICTORIA';
  if (record.result === 'defeat') return 'DERROTA';
  return 'EMPATE';
}

function getResultClass(record: MatchRecord): string {
  if (record.mode === 'training') return 'badge--training';
  if (record.result === 'victory') return 'badge--victory';
  if (record.result === 'defeat') return 'badge--defeat';
  return 'badge--draw';
}
</script>

<template>
  <div class="history-screen rf-riveted-panel" data-testid="history-screen">
    <div class="history-header">
      <div class="title-tag">
        <h1 class="history-title">HISTORIAL DE PARTIDAS</h1>
      </div>
      <p class="header-subtitle">Jugador local: <strong class="player-tag">{{ playerName }}</strong></p>
    </div>

    <div class="rf-hazard-strip hazard-strip" aria-hidden="true"></div>

    <div class="history-content">
      <div v-if="status === 'loading'" class="state-panel state-panel--loading" data-testid="history-loading">
        <span class="loading-spinner" aria-hidden="true">⏳</span>
        <p>Cargando historial de partidas...</p>
      </div>

      <div v-else-if="status === 'error'" class="state-panel state-panel--error" data-testid="history-error">
        <p class="error-msg">⚠️ No se pudo obtener el historial</p>
        <p class="error-sub">{{ errorMessage }}</p>
        <button type="button" class="rf-btn-tactical rf-btn-utility retry-btn" data-testid="history-retry-button" @click="loadHistory">
          REINTENTAR CONEXIÓN
        </button>
      </div>

      <div v-else-if="status === 'empty'" class="state-panel state-panel--empty" data-testid="history-empty">
        <p>No se registraron partidas finalizadas todavía para este jugador.</p>
        <p class="empty-sub">Juega una partida en Entrenamiento o Batalla para guardar tu primer registro.</p>
      </div>

      <div v-else-if="status === 'success'" class="table-container rf-panel-inset" data-testid="history-table">
        <table class="history-table">
          <thead>
            <tr>
              <th>Resultado</th>
              <th>Modo</th>
              <th>Puntuación</th>
              <th>Líneas</th>
              <th>Nivel</th>
              <th>Duración</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in matchesList" :key="item.id" data-testid="history-row">
              <td>
                <span class="badge" :class="getResultClass(item)">{{ getResultText(item) }}</span>
              </td>
              <td>{{ item.mode === 'battle' ? 'Batalla 2P' : 'Entrenamiento 1P' }}</td>
              <td class="numeric-val">{{ item.score }}</td>
              <td class="numeric-val">{{ item.linesCleared }}</td>
              <td class="numeric-val">{{ item.level }}</td>
              <td class="numeric-val">{{ formatDuration(item.durationMs) }}</td>
              <td class="date-val">{{ formatDate(item.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="history-footer">
      <button
        type="button"
        class="rf-btn-tactical rf-btn-secondary back-btn"
        data-testid="history-back-button"
        @click="onBack"
      >
        VOLVER AL MENÚ PRINCIPAL
      </button>
    </div>
  </div>
</template>

<style scoped>
.history-screen {
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

.history-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.header-tag {
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-cyan, #00d4ff);
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

.player-tag {
  color: var(--rf-color-cyan, #00d4ff);
}

.hazard-strip {
  width: 100%;
  height: 8px;
  border-radius: 2px;
  opacity: 0.5;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-cyan, #00d4ff) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

.history-content {
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
  border-color: var(--rf-color-amber, #f39c12);
  color: var(--rf-color-amber, #f39c12);
}

.table-container {
  width: 100%;
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
  text-align: left;
}

.history-table th {
  padding: 0.6rem 0.75rem;
  background: var(--rf-color-graphite-900, #17181a);
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid var(--rf-color-metal-600, #3a3b3f);
}

.history-table td {
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--rf-color-metal-600, #3a3b3f);
  color: var(--rf-color-text-primary, #e8e8ec);
}

.numeric-val {
  font-family: monospace;
  font-weight: bold;
}

.date-val {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.badge {
  display: inline-block;
  padding: 2px 6px;
  font-size: 0.6875rem;
  font-weight: 800;
  text-transform: uppercase;
  border-radius: 2px;
}

.badge--victory {
  background: rgba(0, 212, 255, 0.15);
  color: var(--rf-color-cyan, #00d4ff);
  border: 1px solid var(--rf-color-cyan, #00d4ff);
}

.badge--defeat {
  background: rgba(231, 76, 60, 0.15);
  color: var(--rf-color-red, #e74c3c);
  border: 1px solid var(--rf-color-red, #e74c3c);
}

.badge--draw, .badge--training {
  background: rgba(243, 156, 18, 0.15);
  color: var(--rf-color-amber, #f39c12);
  border: 1px solid var(--rf-color-amber, #f39c12);
}

.history-footer {
  width: 100%;
  display: flex;
  justify-content: center;
}

.back-btn {
  padding: 0.75rem 1.5rem;
  font-size: 0.8125rem;
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.back-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-amber, #f39c12);
}
</style>
