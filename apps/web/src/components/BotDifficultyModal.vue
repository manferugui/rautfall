<script setup lang="ts">
/**
 * Componente Modal Industrial para la Selección de Dificultad del Rival (Bot Profile).
 *
 * Responsabilidades:
 * - Desplegar las opciones de dificultad para el modo Batalla Táctica (CADET, OPERATOR, ELITE).
 * - Permitir la selección directa en un solo clic, cerrando la modal y emitiendo el perfil elegido.
 * - Permitir la cancelación mediante botón CANCELAR, tecla Escape o clic en backdrop.
 */

import { onMounted, onUnmounted, watch } from 'vue';
import type { BotProfileId } from '@rautfall/battle-engine';
import { getAudioManager } from '../audio';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'selectProfile', profile: BotProfileId): void;
  (e: 'cancel'): void;
}>();

const audioManager = getAudioManager();

function handleSelectProfile(profile: BotProfileId): void {
  audioManager.playSfx('uiClick');
  emit('selectProfile', profile);
}

function handleCancel(): void {
  audioManager.playSfx('uiClick');
  emit('cancel');
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    handleCancel();
  }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!props.isOpen) return;
  if (event.key === 'Escape') {
    handleCancel();
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      audioManager.playSfx('uiClick');
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="difficulty-modal-backdrop"
    data-testid="bot-difficulty-modal"
    role="dialog"
    aria-modal="true"
    @click="handleBackdropClick"
  >
    <div class="difficulty-modal-chassis">
      <div class="difficulty-modal-texture" aria-hidden="true"></div>

      <!-- Remaches tácticos -->
      <div class="modal-rivet modal-rivet--tl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--tr" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--bl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--br" aria-hidden="true"></div>

      <header class="difficulty-modal-header">
        <span class="modal-badge-tag">NIVEL DE DIFICULTAD · VS BOT</span>
        <h2 class="modal-title">BATALLA TÁCTICA</h2>
      </header>

      <div class="difficulty-modal-body">
        <p class="difficulty-prompt">SELECCIONA EL PERFIL DEL RIVAL AUTOMATIZADO</p>

        <div class="difficulty-options">
          <!-- Opción 1: CADET -->
          <button
            type="button"
            class="rf-btn-console difficulty-option-btn"
            data-testid="bot-profile-cadet"
            @click="handleSelectProfile('battleCadet')"
          >
            <span class="rf-btn-console-face">
              <span class="option-header">
                <span class="option-title">CADET</span>
                <span class="option-tag option-tag--cadet">INICIACIÓN</span>
              </span>
              <span class="option-desc">Cadencia de ataque reducida · Ideal para aprendizaje</span>
            </span>
          </button>

          <!-- Opción 2: OPERATOR (Estándar recomendado) -->
          <button
            type="button"
            class="rf-btn-console difficulty-option-btn difficulty-option-btn--operator"
            data-testid="bot-profile-operator"
            @click="handleSelectProfile('battleOperator')"
          >
            <span class="rf-btn-console-face">
              <span class="option-header">
                <span class="option-title option-title--operator">OPERATOR</span>
                <span class="option-tag option-tag--operator">ESTÁNDAR · OFICIAL</span>
              </span>
              <span class="option-desc">Patrón de respuesta equilibrado · Combate oficial</span>
            </span>
          </button>

          <!-- Opción 3: ELITE -->
          <button
            type="button"
            class="rf-btn-console difficulty-option-btn"
            data-testid="bot-profile-elite"
            @click="handleSelectProfile('battleElite')"
          >
            <span class="rf-btn-console-face">
              <span class="option-header">
                <span class="option-title option-title--elite">ELITE</span>
                <span class="option-tag option-tag--elite">AVANZADO</span>
              </span>
              <span class="option-desc">Máxima velocidad de ejecución · Respuesta inmediata</span>
            </span>
          </button>
        </div>
      </div>

      <footer class="difficulty-modal-footer">
        <button
          type="button"
          class="rf-btn-console footer-cancel-btn"
          data-testid="cancel-bot-difficulty-button"
          @click="handleCancel"
        >
          <span class="rf-btn-console-face">
            <span>CANCELAR</span>
          </span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.difficulty-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 11, 13, 0.85);
  backdrop-filter: blur(4px);
  padding: 16px;
  box-sizing: border-box;
}

.difficulty-modal-chassis {
  position: relative;
  width: min(520px, calc(100vw - 32px));
  border: 4px solid #383a42;
  border-radius: 8px;
  background: radial-gradient(ellipse at 50% 15%, #242629 0%, #17181b 60%, #0d0e10 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.16),
    inset 0 -4px 12px rgba(0, 0, 0, 0.9),
    0 16px 48px rgba(0, 0, 0, 0.8);
  padding: 20px 40px 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.difficulty-modal-texture {
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/dark-steel-corten.webp');
  background-size: 340px 340px;
  background-repeat: repeat;
  opacity: 0.25;
  pointer-events: none;
  z-index: 0;
}

.modal-rivet {
  position: absolute;
  width: 10px;
  height: 10px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  pointer-events: none;
  z-index: 2;
}
.modal-rivet--tl { top: 6px; left: 6px; }
.modal-rivet--tr { top: 6px; right: 6px; }
.modal-rivet--bl { bottom: 6px; left: 6px; }
.modal-rivet--br { bottom: 6px; right: 6px; }

.difficulty-modal-header,
.difficulty-modal-body,
.difficulty-modal-footer {
  position: relative;
  z-index: 1;
}

.difficulty-modal-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  text-align: center;
}

.modal-badge-tag {
  font-family: monospace;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--rf-color-cyan, #00d4ff);
}

.modal-title {
  font-family: 'Oswald', sans-serif;
  font-size: 1.8rem;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0;
  color: #e8e8ec;
  letter-spacing: 0.05em;
}

.difficulty-modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.difficulty-prompt {
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #a0a4a9;
  text-align: center;
  margin: 0;
}

.difficulty-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.difficulty-option-btn {
  width: 100%;
  height: 76px;
  padding: 5px 5px;
}

.difficulty-option-btn .rf-btn-console-face {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  padding: 0.85rem 1.15rem;
  gap: 0.3rem;
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 6px), 0 6px);
}

.option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.option-title {
  font-family: 'Oswald', sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #e8e8ec;
}

.option-title--operator {
  color: var(--rf-color-cyan, #00d4ff);
}

.option-title--elite {
  color: var(--rf-color-red, #e74c3c);
}

.option-tag {
  font-family: monospace;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 2px;
}

.option-tag--cadet {
  color: #a0a4a9;
  background: rgba(255, 255, 255, 0.06);
}

.option-tag--operator {
  color: var(--rf-color-cyan, #00d4ff);
  background: rgba(0, 212, 255, 0.12);
  border: 1px solid rgba(0, 212, 255, 0.3);
}

.option-tag--elite {
  color: var(--rf-color-red, #e74c3c);
  background: rgba(231, 76, 60, 0.12);
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.option-desc {
  font-size: 0.72rem;
  color: rgba(232, 232, 236, 0.65);
}

.difficulty-modal-footer {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 0.1rem;
}

.footer-cancel-btn {
  width: 100%;
  max-width: 240px;
  height: 40px;
}

.footer-cancel-btn .rf-btn-console-face {
  font-size: 0.75rem;
  color: rgba(232, 232, 236, 0.7);
  clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 6px), 0 6px);
}

.footer-cancel-btn:hover:not(:disabled) .rf-btn-console-face {
  color: #ffffff;
}
</style>
