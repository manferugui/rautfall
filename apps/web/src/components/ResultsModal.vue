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

// Formato de miles es-ES (2602 -> "2.602", 15680 -> "15.680"), usado
// exclusivamente para el paso global de Battle (final-battle-step). El
// SCORE ya no pasa por aquí: se muestra sin separador para coincidir con
// el HUD (ScorePanel.vue). Opciones explícitas (no solo el default del
// constructor) para que la agrupación no dependa de comportamiento
// implícito. Solo presentación — no toca los datos ni la lógica de dominio.
const numberFormatter = new Intl.NumberFormat('es-ES', {
  useGrouping: true,
  maximumFractionDigits: 0,
});
function formatInteger(value: number): string {
  return numberFormatter.format(value);
}

const formattedTime = computed(() => {
  const totalSec = Math.floor(props.result.elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
});

const isBattle = computed(() => props.result.mode === 'battle');

// Estado semántico único (reemplaza el icono/isotipo placeholder anterior):
// gobierna color, franja de borde y clase de la placa exterior a la vez.
const outcomeState = computed(() => {
  if (!isBattle.value) return 'training';
  const winner = props.result.battleResult?.winner;
  if (winner === 'playerOne') return 'victory';
  if (winner === 'playerTwo') return 'defeat';
  return 'draw';
});

const titleClass = computed(() => `results-title--${outcomeState.value}`);
</script>

<template>
  <div class="results-backdrop" data-testid="results-modal" role="dialog" aria-modal="true">
    <div class="results-modal" :class="`results-modal--${outcomeState}`">
      <!-- Placa exterior con doble marco y 4 tornillos (mismo asset que HOLD/consola) -->
      <div class="results-plate" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--tl" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--tr" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--bl" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--br" aria-hidden="true"></div>

      <!-- Cara interior hundida: aquí vive todo el contenido -->
      <div class="results-face">
        <div class="results-header" :class="`results-header--${outcomeState}`">
          <h2 class="results-title" :class="titleClass" data-testid="results-title">
            {{ result.title }}
          </h2>
          <p v-if="result.subtitle" class="results-subtitle">{{ result.subtitle }}</p>

          <div v-if="saveStatus" class="save-status-tag" data-testid="save-status-tag">
            <span v-if="saveStatus === 'saving'" class="save-status save-status--saving">Guardando en ranking…</span>
            <span v-else-if="saveStatus === 'saved'" class="save-status save-status--saved">Partida registrada</span>
            <span v-else-if="saveStatus === 'error'" class="save-status save-status--error">Modo local (sin servidor)</span>
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
            <span class="metric-value" data-testid="final-battle-step">{{ formatInteger(result.battleResult.step) }}</span>
          </div>
        </div>

        <div class="results-divider"></div>

        <div class="results-actions">
          <button
            type="button"
            class="rf-btn-tactical rf-btn-primary action-btn"
            data-testid="replay-button"
            @click="emit('replay')"
          >
            Volver a jugar
          </button>

          <button
            type="button"
            class="rf-btn-tactical rf-btn-secondary action-btn"
            data-testid="main-menu-button"
            @click="emit('mainMenu')"
          >
            Menú principal
          </button>
        </div>
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

/* Placa exterior: mismo lenguaje físico que HOLD (module-bezel.svg —
   doble marco, chaflanes y 4 tornillos ya incluidos en el asset). */
.results-modal {
  position: relative;
  width: 100%;
  max-width: 440px;
  padding: 1.75rem 1.5rem 1.5rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7);
}

.results-plate {
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/module-bezel.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  z-index: 0;
}

.results-bolt {
  position: absolute;
  width: 11px;
  height: 11px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.9));
  z-index: 4;
}

.results-bolt--tl { top: 8px; left: 9px; }
.results-bolt--tr { top: 8px; right: 9px; }
.results-bolt--bl { bottom: 8px; left: 9px; }
.results-bolt--br { bottom: 8px; right: 9px; }

/* Cara interior: fondo grafito con variación de material + borde
   hundido — el mismo lenguaje de "rebaje interior" que la consola. */
.results-face {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: linear-gradient(160deg, #1c1d21 0%, #0e0f11 55%, #121316 100%);
  border-radius: 4px;
  padding: 1.25rem 1.1rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -3px 8px rgba(0, 0, 0, 0.8),
    inset 0 0 0 1px rgba(0, 0, 0, 0.6);
}

/* Cabecera con placa de estado: franja de borde + tinte de fondo por
   resultado en vez de un icono/isotipo sin función. Sin glow permanente. */
.results-header {
  text-align: center;
  padding: 0.85rem 0.75rem 0.7rem;
  border-radius: 3px;
  border-left: 3px solid var(--rf-color-metal-600, #3a3b3f);
  background: rgba(255, 255, 255, 0.02);
}

.results-header--victory {
  border-left-color: var(--rf-color-cyan, #00d4ff);
  background: linear-gradient(90deg, rgba(0, 212, 255, 0.09), transparent 70%);
}

.results-header--defeat {
  border-left-color: var(--rf-color-red, #e74c3c);
  background: linear-gradient(90deg, rgba(231, 76, 60, 0.09), transparent 70%);
}

.results-header--draw,
.results-header--training {
  border-left-color: var(--rf-color-amber, #f39c12);
  background: linear-gradient(90deg, rgba(243, 156, 18, 0.09), transparent 70%);
}

.results-title {
  font-size: 1.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
}

.results-title--victory {
  color: var(--rf-color-cyan, #00d4ff);
}

.results-title--defeat {
  color: var(--rf-color-red, #e74c3c);
}

.results-title--draw,
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
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
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
  gap: 0.65rem;
}

/* Módulo de métrica inset — placa hundida, no "card SaaS". */
.result-metric {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  background: #0a0b0d;
  padding: 0.65rem 0.75rem;
  border-radius: 3px;
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.85),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 0 0 1px rgba(0, 0, 0, 0.5);
}

.metric-label {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.metric-value {
  font-size: 1.4rem;
  font-family: monospace;
  font-weight: 800;
  color: var(--rf-color-text-primary, #e8e8ec);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.results-actions {
  display: flex;
  gap: 0.75rem;
}

.action-btn {
  flex: 1;
  justify-content: center;
}
</style>
