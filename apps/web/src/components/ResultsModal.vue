<script setup lang="ts">
/**
 * Componente Modal / Panel de Resultados al finalizar la partida.
 *
 * Responsabilidades:
 * - Mostrar el resultado oficial de la partida (Victoria, Derrota, Empate, Fin de Entrenamiento).
 * - Exponer desglose de métricas oficiales (Puntuación, Nivel, Tiempo, Líneas eliminadas).
 * - Integrar la firma de iniciales arcade (3 caracteres A-Z / 0-9) directamente en la consola.
 * - Manejar la entrada de teclado local (una pulsación = un carácter, filtrando event.repeat).
 * - Permitir la confirmación del resultado e iniciar el registro en la API.
 * - Acciones secundarias: Volver a jugar y Menú principal (limpiando resultados no guardados).
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import type { GameResultSummary } from '../game/types';
import { getAudioManager } from '../audio';

const props = defineProps<{
  result: GameResultSummary;
  saveStatus?: 'idle' | 'awaitingTag' | 'readyToSave' | 'saving' | 'saved' | 'failed' | 'error';
  playerTag?: string | null;
}>();

const emit = defineEmits<{
  (e: 'replay'): void;
  (e: 'mainMenu'): void;
  (e: 'confirmSave', tag: string): void;
}>();

const audioManager = getAudioManager();
const editableTag = ref<string>('');
const hiddenInputRef = ref<HTMLInputElement | null>(null);

function syncInitialTag(): void {
  if (props.playerTag && /^[A-Z0-9]{3}$/.test(props.playerTag.trim().toUpperCase())) {
    editableTag.value = props.playerTag.trim().toUpperCase();
  } else if (!editableTag.value) {
    editableTag.value = '';
  }
}

watch(
  () => props.playerTag,
  () => {
    syncInitialTag();
  },
  { immediate: true }
);

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

const isBattle = computed(() => props.result.mode === 'battle' || props.result.mode === 'online');
const isOnline = computed(() => props.result.mode === 'online');

const outcomeState = computed(() => {
  if (props.result.mode === 'training') return 'training';
  const winner = props.result.battleResult?.winner;
  if (winner === 'playerOne') return 'victory';
  if (winner === 'playerTwo') return 'defeat';
  return 'draw';
});

const titleClass = computed(() => `results-title--${outcomeState.value}`);

const tagChars = computed(() => {
  const chars = ['', '', ''];
  for (let i = 0; i < editableTag.value.length && i < 3; i++) {
    chars[i] = editableTag.value[i] ?? '';
  }
  return chars;
});

const activeCellIndex = computed(() => {
  if (editableTag.value.length < 3) return editableTag.value.length;
  return 2;
});

const isValidTag = computed(() => editableTag.value.length === 3 && /^[A-Z0-9]{3}$/.test(editableTag.value));

function focusTagZone(): void {
  if (hiddenInputRef.value) {
    hiddenInputRef.value.focus();
  }
}

function onConfirmSave(): void {
  if (!isValidTag.value || props.saveStatus === 'saving') return;
  audioManager.playSfx('uiClick');
  emit('confirmSave', editableTag.value);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (props.saveStatus === 'saving') return;

  // REQUISITO 13: Ignorar autorepetición del sistema operativo (mantener tecla pulsada no produce RRR)
  if (event.repeat) return;

  if (event.key === 'Backspace') {
    event.preventDefault(); // Evitar navegación de navegador y doble evento
    if (editableTag.value.length > 0) {
      audioManager.playSfx('uiClick');
      editableTag.value = editableTag.value.slice(0, -1);
    }
    return;
  }

  if (event.key === 'Enter') {
    if (isValidTag.value) {
      event.preventDefault();
      onConfirmSave();
    }
    return;
  }

  // ACEPTAR SOLO CARACTERES ALFANUMÉRICOS (1 SOLA TECLA FISICA = 1 CARACTER)
  if (event.key.length === 1 && /^[a-zA-Z0-9]$/.test(event.key)) {
    event.preventDefault(); // REQUISITO 11/12: Prevenir que el input genere un evento @input redundante
    if (editableTag.value.length < 3) {
      audioManager.playSfx('uiClick');
      editableTag.value = (editableTag.value + event.key).toUpperCase();
    }
  }
}

function onInput(event: Event): void {
  // Manejador de respaldo para teclados virtuales / autocompletado en móviles o Playwright fill()
  const input = event.target as HTMLInputElement;
  const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  editableTag.value = cleaned;
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  setTimeout(() => focusTagZone(), 50);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div class="results-backdrop" data-testid="results-modal" role="dialog" aria-modal="true">
    <div class="results-modal" :class="`results-modal--${outcomeState}`">
      <!-- Placa exterior con doble marco y 4 tornillos -->
      <div class="results-plate" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--tl" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--tr" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--bl" aria-hidden="true"></div>
      <div class="results-bolt results-bolt--br" aria-hidden="true"></div>

      <!-- Cara interior hundida: composición unificada Industrial Dramatic -->
      <div class="results-face">
        <!-- 1. Encabezado y resultado de partida -->
        <div class="results-header" :class="`results-header--${outcomeState}`">
          <h2 class="results-title" :class="titleClass" data-testid="results-title">
            {{ result.title }}
          </h2>
          <p v-if="result.subtitle" class="results-subtitle">{{ result.subtitle }}</p>

          <div v-if="saveStatus" class="save-status-tag" data-testid="save-status-tag">
            <span v-if="saveStatus === 'saving'" class="save-status save-status--saving">REGISTRANDO PARTIDA…</span>
            <span v-else-if="saveStatus === 'saved'" class="save-status save-status--saved">RESULTADO REGISTRADO EN RANKING</span>
            <span v-else-if="saveStatus === 'failed' || saveStatus === 'error'" class="save-status save-status--error">ERROR AL PERSISTIR (REINTENTABLE)</span>
            <span v-else-if="!isValidTag" class="save-status save-status--awaiting">INGRESA LAS 3 INICIALES PARA REGISTRAR</span>
            <span v-else class="save-status save-status--idle">RESULTADO LISTO PARA CONFIRMAR</span>
          </div>
        </div>

        <div class="results-divider"></div>

        <!-- 2. Puntuación y métricas oficiales -->
        <div class="results-grid">
          <div class="result-metric result-metric--highlight">
            <span class="metric-label">PUNTUACIÓN FINAL</span>
            <span class="metric-value metric-value--score" data-testid="final-score">{{ formatInteger(result.score) }}</span>
          </div>

          <div class="result-metric">
            <span class="metric-label">NIVEL ALCANZADO</span>
            <span class="metric-value" data-testid="final-level">{{ result.level }}</span>
          </div>

          <div class="result-metric">
            <span class="metric-label">TIEMPO DE PARTIDA</span>
            <span class="metric-value" data-testid="final-time">{{ formattedTime }}</span>
          </div>

          <div v-if="result.linesCleared !== undefined" class="result-metric">
            <span class="metric-label">LÍNEAS ELIMINADAS</span>
            <span class="metric-value" data-testid="final-lines">{{ result.linesCleared }}</span>
          </div>
          <div v-else-if="isBattle && result.battleResult" class="result-metric">
            <span class="metric-label">PASO GLOBAL</span>
            <span class="metric-value" data-testid="final-battle-step">{{ formatInteger(result.battleResult.step) }}</span>
          </div>
        </div>

        <div class="results-divider"></div>

        <!-- 3. Módulo de Firma de Operador Integrado (Celdas Arcade, solo en modo local) -->
        <div v-if="!isOnline" class="operator-signature-block rf-panel-inset" data-testid="operator-signature-block" @click="focusTagZone">
          <div class="signature-header">
            <span class="signature-title">FIRMA DE OPERADOR</span>
            <span class="signature-subtext">3 CARACTERES · A-Z / 0-9</span>
          </div>

          <div class="tag-cells-container" data-testid="tag-cells-container">
            <input
              ref="hiddenInputRef"
              type="text"
              class="hidden-tag-input"
              :value="editableTag"
              maxlength="3"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="characters"
              spellcheck="false"
              aria-label="Iniciales de Operador"
              @input="onInput"
            />

            <div
              v-for="(char, index) in tagChars"
              :key="index"
              class="tag-cell rf-keycap"
              :class="{
                'cell--active': index === activeCellIndex && saveStatus !== 'saving',
                'cell--filled': char !== '',
              }"
              :data-testid="`tag-cell-${index}`"
            >
              <span class="char-value" :data-testid="`tag-cell-char-${index}`">
                {{ char !== '' ? char : '_' }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="!isOnline" class="results-divider"></div>

        <!-- 4. Acción Primaria (Confirmar Resultado, solo en modo local) -->
        <div v-if="!isOnline" class="primary-action-block">
          <button
            type="button"
            class="rf-btn-tactical rf-btn-primary confirm-save-btn"
            data-testid="confirm-save-button"
            :disabled="saveStatus === 'saving' || !isValidTag"
            @click="onConfirmSave"
          >
            <span v-if="saveStatus === 'saving'">REGISTRANDO PARTIDA...</span>
            <span v-else-if="saveStatus === 'failed' || saveStatus === 'error'">REINTENTAR REGISTRO</span>
            <span v-else>CONFIRMAR RESULTADO</span>
          </button>
        </div>

        <!-- 5. Acciones Secundarias (Volver a jugar / Menú Principal) -->
        <div class="results-actions">
          <button
            type="button"
            class="rf-btn-tactical rf-btn-secondary action-btn"
            data-testid="replay-button"
            :disabled="saveStatus === 'saving'"
            @click="emit('replay')"
          >
            VOLVER A JUGAR
          </button>

          <button
            type="button"
            class="rf-btn-tactical rf-btn-secondary action-btn"
            data-testid="main-menu-button"
            :disabled="saveStatus === 'saving'"
            @click="emit('mainMenu')"
          >
            MENÚ PRINCIPAL
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
  background: rgba(11, 11, 13, 0.88);
  backdrop-filter: blur(5px);
  padding: 1rem;
}

.results-modal {
  position: relative;
  width: 100%;
  max-width: 480px;
  padding: 1.75rem 1.5rem 1.5rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
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

.results-face {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: linear-gradient(160deg, #1c1d21 0%, #0e0f11 55%, #121316 100%);
  border-radius: 4px;
  padding: 1.25rem 1.15rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -3px 8px rgba(0, 0, 0, 0.8),
    inset 0 0 0 1px rgba(0, 0, 0, 0.6);
}

.results-header {
  text-align: center;
  padding: 0.75rem 0.75rem 0.6rem;
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
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  margin: 0;
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
  font-size: 0.8rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin-top: 0.2rem;
  margin-bottom: 0;
}

.save-status-tag {
  margin-top: 0.45rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.save-status--saving { color: var(--rf-color-amber, #f39c12); }
.save-status--saved { color: var(--rf-color-cyan, #00d4ff); }
.save-status--awaiting { color: var(--rf-color-amber, #f39c12); }
.save-status--error { color: var(--rf-color-red, #e74c3c); }
.save-status--idle { color: var(--rf-color-cyan, #00d4ff); }

.results-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--rf-color-metal-600, #3a3b3f), transparent);
}

/* Métricas del Resultado */
.results-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.result-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.2rem;
  background: #0a0b0d;
  padding: 0.55rem 0.5rem;
  border-radius: 3px;
  box-shadow:
    inset 0 2px 5px rgba(0, 0, 0, 0.85),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 0 0 1px rgba(0, 0, 0, 0.5);
}

.result-metric--highlight {
  grid-column: 1 / -1;
  align-items: center;
  background: linear-gradient(180deg, #101216 0%, #08090b 100%);
  border: 1px solid rgba(0, 212, 255, 0.2);
  padding: 0.6rem 0.75rem;
}

.metric-label {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  white-space: nowrap;
}

.metric-value {
  font-size: 1.25rem;
  font-family: monospace;
  font-weight: 800;
  color: var(--rf-color-text-primary, #e8e8ec);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
}

.metric-value--score {
  font-size: 1.85rem;
  color: var(--rf-color-cyan, #00d4ff);
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}

@media (max-width: 380px) {
  .results-grid {
    grid-template-columns: 1fr;
  }
  .result-metric--highlight {
    grid-column: 1;
  }
}

/* Módulo de Firma Integrado */
.operator-signature-block {
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;
}

.signature-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.signature-title {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.signature-subtext {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.5));
}

.tag-cells-container {
  position: relative;
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  align-items: center;
  padding: 0.35rem;
}

.hidden-tag-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.tag-cell {
  width: 52px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0e11;
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: 4px;
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.9),
    0 2px 4px rgba(0, 0, 0, 0.5);
  transition: all 0.15s ease;
}

.cell--active {
  border-color: var(--rf-color-cyan, #00d4ff);
  box-shadow:
    0 0 12px rgba(0, 212, 255, 0.4),
    inset 0 0 8px rgba(0, 212, 255, 0.2);
}

.cell--filled {
  background: #15171c;
}

.char-value {
  font-family: monospace;
  font-size: 1.85rem;
  font-weight: 800;
  color: var(--rf-color-cyan, #00d4ff);
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
}

/* Botón Primario y Secundarios */
.primary-action-block {
  display: flex;
  width: 100%;
}

.confirm-save-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  justify-content: center;
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
