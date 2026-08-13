<script setup lang="ts">
/**
 * Componente Modal Industrial de Activación de Audio.
 *
 * Responsabilidades:
 * - Informar explícitamente al operador sobre el estado en espera (STANDBY) del módulo de audio.
 * - Actuar como la interacción explícita requerida para desbloquear Web Audio Context.
 * - Accesibilidad de diálogo (role="dialog", aria-modal, focus trap, restoration y atajo Escape).
 * - Aislamiento estricto de eventos de teclado respecto a los controles de gameplay globales.
 */

import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const props = withDefaults(
  defineProps<{
    isInitializing?: boolean;
    error?: boolean | string;
  }>(),
  {
    isInitializing: false,
    error: false,
  }
);

const emit = defineEmits<{
  (e: 'initialize'): void;
  (e: 'keepSilent'): void;
}>();

const modalPanelRef = ref<HTMLDivElement | null>(null);
const initButtonRef = ref<HTMLButtonElement | null>(null);
const keepSilentButtonRef = ref<HTMLButtonElement | null>(null);

let previouslyFocusedElement: HTMLElement | null = null;

function handleInitialize(): void {
  if (props.isInitializing) return;
  emit('initialize');
}

function handleKeepSilent(): void {
  if (props.isInitializing) return;
  emit('keepSilent');
}

function handleKeyDown(event: KeyboardEvent): void {
  // Prevenir que las teclas del modal activen acciones de juego de Rautfall
  event.stopPropagation();

  if (event.key === 'Escape') {
    event.preventDefault();
    handleKeepSilent();
    return;
  }

  if (event.key === 'Tab') {
    const focusables = [initButtonRef.value, keepSilentButtonRef.value].filter(
      (el): el is HTMLButtonElement => el !== null && !el.disabled
    );

    if (focusables.length === 0) return;

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    const activeEl = document.activeElement;

    if (firstEl && lastEl) {
      if (event.shiftKey) {
        if (activeEl === firstEl || !modalPanelRef.value?.contains(activeEl)) {
          event.preventDefault();
          lastEl.focus();
        }
      } else {
        if (activeEl === lastEl || !modalPanelRef.value?.contains(activeEl)) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    }
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  event.stopPropagation();
}

onMounted(async () => {
  if (typeof document !== 'undefined') {
    previouslyFocusedElement = document.activeElement as HTMLElement | null;
  }

  await nextTick();
  if (initButtonRef.value) {
    initButtonRef.value.focus();
  }
});

onUnmounted(() => {
  if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
    try {
      previouslyFocusedElement.focus();
    } catch {
      // Ignorar si el elemento ya no está en el DOM
    }
  }
});
</script>

<template>
  <div
    class="audio-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="audio-modal-title"
    aria-describedby="audio-modal-desc"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
  >
    <div ref="modalPanelRef" class="audio-modal-panel">
      <!-- Remaches tácticos industriales en esquinas -->
      <div class="modal-bolt modal-bolt--tl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--tr" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--bl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--br" aria-hidden="true"></div>

      <!-- Cabecera / Microplaca de estado industrial -->
      <header class="modal-header">
        <div class="module-tag">
          <span class="module-label">AUDIO MODULE</span>
          <span class="module-status-badge">STANDBY</span>
        </div>
        <h2 id="audio-modal-title" class="modal-title">SISTEMA DE AUDIO // EN ESPERA</h2>
      </header>

      <div class="hazard-strip" aria-hidden="true"></div>

      <!-- Cuerpo explicativo -->
      <div class="modal-body">
        <p id="audio-modal-desc" class="modal-description">
          Se requiere confirmación del operador para inicializar el módulo de sonido.
        </p>

        <!-- Indicación discreta de error si falla unlock() -->
        <div v-if="error" class="error-indicator" data-testid="audio-error-indicator" role="alert">
          <span class="error-icon">⚠️</span>
          <span class="error-text">AUDIO INIT FAILED // RETRY</span>
        </div>

        <div class="tech-detail-box">
          <span class="tech-detail-code">SYS.ACC // AUDIO_CONTEXT_LOCK</span>
          <span class="tech-detail-label">OPERATOR CONFIRMATION REQUIRED</span>
        </div>
      </div>

      <!-- Acciones principales -->
      <footer class="modal-actions">
        <button
          ref="initButtonRef"
          type="button"
          class="rf-btn-tactical rf-btn-primary init-btn"
          data-testid="initialize-audio-button"
          :disabled="isInitializing"
          @click="handleInitialize"
        >
          <span v-if="isInitializing" class="btn-spinner">⏳</span>
          {{ isInitializing ? 'INICIALIZANDO...' : 'INICIALIZAR AUDIO' }}
        </button>

        <button
          ref="keepSilentButtonRef"
          type="button"
          class="rf-btn-tactical rf-btn-utility silent-btn"
          data-testid="keep-silent-button"
          :disabled="isInitializing"
          @click="handleKeepSilent"
        >
          SEGUIR EN SILENCIO
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.audio-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 11, 0.88);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.audio-modal-panel {
  position: relative;
  background: var(--rf-color-graphite-900, #17181a);
  width: 460px;
  max-width: 92vw;
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  padding: 1.75rem 1.5rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 8px rgba(0, 0, 0, 0.9),
    0 16px 40px rgba(0, 0, 0, 0.9);
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
  gap: 0.5rem;
  text-align: center;
}

.module-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-amber, #ffaa00);
  padding: 0.35rem 0.85rem;
  border-radius: var(--rf-radius-sm, 3px);
}

.module-label {
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--rf-color-text-secondary, rgba(232, 232, 236, 0.75));
}

.module-status-badge {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--rf-color-amber, #ffaa00);
  background: rgba(255, 170, 0, 0.12);
  padding: 0.1rem 0.4rem;
  border-radius: 2px;
  border: 1px solid rgba(255, 170, 0, 0.3);
}

.modal-title {
  font-size: 1.2rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-primary, #e8e8ec);
  margin: 0;
}

.hazard-strip {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  opacity: 0.7;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-amber, #ffaa00) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: center;
}

.modal-description {
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--rf-color-text-primary, #e8e8ec);
  margin: 0;
}

.error-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(255, 50, 50, 0.12);
  border: 1px solid rgba(255, 50, 50, 0.4);
  padding: 0.5rem 0.85rem;
  border-radius: var(--rf-radius-sm, 3px);
  color: #ff5555;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.tech-detail-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: #08090b;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  padding: 0.6rem 0.85rem;
  border-radius: var(--rf-radius-sm, 3px);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.8);
}

.tech-detail-code {
  font-family: 'Oswald', monospace, sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: var(--rf-color-metal-400, #585a62);
}

.tech-detail-label {
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--rf-color-amber, #ffaa00);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.init-btn,
.silent-btn {
  flex: 1;
  justify-content: center;
  padding: 0.75rem 1rem;
}

.btn-spinner {
  margin-right: 0.35rem;
}
</style>
