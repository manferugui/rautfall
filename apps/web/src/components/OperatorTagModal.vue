<script setup lang="ts">
/**
 * Componente Modal de Firma / Registro de Operador (Iniciales Arcade de 3 Caracteres).
 *
 * Responsabilidades:
 * - Componente puro de presentación y entrada de iniciales postpartida.
 * - NO accede directamente a localStorage ni ejecuta operaciones de API.
 * - Normalización visual a mayúsculas y filtrado estricto A-Z 0-9.
 * - Manejo de teclado: A-Z/0-9, Backspace, Enter (solo activo con 3 caracteres) y Escape (cancelar).
 * - Emite los hechos 'confirm' y 'cancel' a la capa de orquestación (App.vue / ResultsModal).
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { getAudioManager } from '../audio';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    canCancel?: boolean;
    initialTag?: string;
  }>(),
  {
    canCancel: true,
    initialTag: '',
  }
);

const emit = defineEmits<{
  (e: 'confirm', tag: string): void;
  (e: 'cancel'): void;
}>();

const audioManager = getAudioManager();
const rawTag = ref<string>('');
const hiddenInputRef = ref<HTMLInputElement | null>(null);

function focusInput(): void {
  if (hiddenInputRef.value) {
    hiddenInputRef.value.focus();
  }
}

function syncInitialTag(): void {
  const existing = props.initialTag ? props.initialTag.trim().toUpperCase() : '';
  if (/^[A-Z0-9]{3}$/.test(existing)) {
    rawTag.value = existing;
  } else {
    rawTag.value = '';
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      syncInitialTag();
      setTimeout(() => focusInput(), 50);
    }
  },
  { immediate: true }
);

const tagChars = computed(() => {
  const chars = ['', '', ''];
  for (let i = 0; i < rawTag.value.length && i < 3; i++) {
    chars[i] = rawTag.value[i] ?? '';
  }
  return chars;
});

const activeCellIndex = computed(() => {
  if (rawTag.value.length < 3) return rawTag.value.length;
  return 2;
});

const isValid = computed(() => rawTag.value.length === 3 && /^[A-Z0-9]{3}$/.test(rawTag.value));

function confirmTag(): void {
  if (!isValid.value) return;
  audioManager.playSfx('uiClick');
  emit('confirm', rawTag.value);
}

function cancelTag(): void {
  if (!props.canCancel) return;
  audioManager.playSfx('uiClick');
  emit('cancel');
}

function onInput(event: Event): void {
  const input = event.target as HTMLInputElement;
  const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  rawTag.value = cleaned;
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!props.isOpen) return;
  if (event.repeat) return;

  if (event.key === 'Backspace') {
    event.preventDefault();
    if (rawTag.value.length > 0) {
      audioManager.playSfx('uiClick');
      rawTag.value = rawTag.value.slice(0, -1);
    }
    return;
  }

  if (event.key === 'Enter') {
    if (isValid.value) {
      event.preventDefault();
      confirmTag();
    }
    return;
  }

  if (event.key === 'Escape') {
    if (props.canCancel) {
      event.preventDefault();
      cancelTag();
    }
    return;
  }

  if (event.key.length === 1 && /^[a-zA-Z0-9]$/.test(event.key)) {
    event.preventDefault();
    if (rawTag.value.length < 3) {
      audioManager.playSfx('uiClick');
      rawTag.value = (rawTag.value + event.key).toUpperCase();
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div v-if="isOpen" class="operator-tag-backdrop" data-testid="operator-tag-modal" role="dialog" aria-modal="true">
    <div class="operator-tag-modal rf-riveted-panel">
      <!-- Tornillos / remaches mecánicos en esquinas -->
      <div class="modal-bolt modal-bolt--tl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--tr" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--bl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--br" aria-hidden="true"></div>

      <div class="modal-header">
        <div class="title-tag">
          <h2 class="modal-title" data-testid="operator-tag-title">REGISTRO DE OPERADOR</h2>
        </div>
        <p class="modal-subtitle">INTRODUCE INICIALES</p>
      </div>

      <div class="rf-hazard-strip hazard-strip" aria-hidden="true"></div>

      <div class="modal-body">
        <!-- Receptáculo de 3 celdas estilo arcade industrial -->
        <div
          class="tag-cells-container"
          data-testid="tag-cells-container"
          tabindex="0"
          @click="focusInput"
        >
          <div
            v-for="index in 3"
            :key="index"
            class="tag-cell"
            :class="{
              'tag-cell--filled': Boolean(tagChars[index - 1]),
              'tag-cell--active': activeCellIndex === index - 1,
            }"
            :data-testid="`tag-cell-${index - 1}`"
          >
            <span class="cell-char" :data-testid="`tag-cell-char-${index - 1}`">
              {{ tagChars[index - 1] }}
            </span>
            <span
              v-if="activeCellIndex === index - 1"
              class="cell-cursor"
              aria-hidden="true"
            ></span>
          </div>
        </div>

        <!-- Input invisible para captura de foco / soporte táctil -->
        <input
          ref="hiddenInputRef"
          type="text"
          class="hidden-tag-input"
          maxlength="3"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="characters"
          spellcheck="false"
          :value="rawTag"
          @input="onInput"
        />

        <p class="tag-hint">3 CARACTERES (A-Z, 0-9)</p>
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="rf-btn-tactical rf-btn-primary confirm-btn"
          :disabled="!isValid"
          data-testid="confirm-tag-button"
          @click="confirmTag"
        >
          CONFIRMAR INICIALES
        </button>

        <button
          v-if="canCancel"
          type="button"
          class="rf-btn-tactical rf-btn-secondary cancel-btn"
          data-testid="cancel-tag-button"
          @click="cancelTag"
        >
          CANCELAR
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.operator-tag-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(9, 10, 12, 0.88);
  backdrop-filter: blur(5px);
  padding: 1rem;
}

.operator-tag-modal {
  position: relative;
  width: 100%;
  max-width: 460px;
  background: linear-gradient(165deg, #1e2024 0%, #121316 60%, #0b0c0e 100%);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  padding: 1.75rem 1.5rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 8px rgba(0, 0, 0, 0.9),
    0 16px 40px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-sizing: border-box;
}

.modal-bolt {
  position: absolute;
  width: 10px;
  height: 10px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.9));
  z-index: 4;
}

.modal-bolt--tl { top: 8px; left: 9px; }
.modal-bolt--tr { top: 8px; right: 9px; }
.modal-bolt--bl { bottom: 8px; left: 9px; }
.modal-bolt--br { bottom: 8px; right: 9px; }

.modal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.title-tag {
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-cyan, #00d4ff);
  padding: 0.4rem 1.25rem 0.4rem 0.85rem;
}

.modal-title {
  font-size: 1.35rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--rf-color-text-primary, #e8e8ec);
  margin: 0;
}

.modal-subtitle {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--rf-color-cyan, #00d4ff);
  margin: 0.15rem 0 0;
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

.modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}

/* Celdas Arcade Industriales */
.tag-cells-container {
  display: flex;
  justify-content: center;
  gap: 1rem;
  cursor: pointer;
  outline: none;
  padding: 0.75rem;
  background: #08090b;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow: inset 0 3px 10px rgba(0, 0, 0, 0.9);
  width: 100%;
  box-sizing: border-box;
}

.tag-cell {
  position: relative;
  width: 72px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #141518 0%, #0a0b0d 100%);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow:
    inset 0 2px 6px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.tag-cell--active {
  border-color: var(--rf-color-cyan, #00d4ff);
  box-shadow:
    inset 0 2px 8px rgba(0, 0, 0, 0.95),
    0 0 10px rgba(0, 212, 255, 0.25);
}

.tag-cell--filled {
  border-color: var(--rf-color-metal-400, #585a62);
}

.cell-char {
  font-family: 'Oswald', monospace, sans-serif;
  font-size: 2.75rem;
  font-weight: 800;
  color: var(--rf-color-text-primary, #e8e8ec);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
  line-height: 1;
  user-select: none;
}

.tag-cell--active .cell-char {
  color: var(--rf-color-cyan, #00d4ff);
}

.cell-cursor {
  position: absolute;
  bottom: 8px;
  width: 24px;
  height: 3px;
  background: var(--rf-color-cyan, #00d4ff);
  box-shadow: 0 0 6px var(--rf-color-cyan, #00d4ff);
  animation: cursor-blink 0.9s infinite alternate;
}

@keyframes cursor-blink {
  0% { opacity: 0.2; }
  100% { opacity: 1; }
}

.hidden-tag-input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
}

.tag-hint {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin: 0;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.confirm-btn,
.cancel-btn {
  flex: 1;
  justify-content: center;
  padding: 0.75rem 1rem;
}
</style>
