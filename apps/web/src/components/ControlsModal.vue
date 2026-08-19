<script setup lang="ts">
/**
 * Componente Modal de Guía de Controles de Teclado.
 *
 * Responsabilidades:
 * - Mostrar de forma clara y organizada la distribución de teclas de juego.
 * - Leer dinámicamente las teclas configuradas desde el store de settings.
 * - Desglosar los controles en tres categorías: MOVIMIENTO, ACCIONES y SISTEMA.
 * - Incluir aclaración contextual de que ESC no pausa partidas online.
 * - Permitir cierre mediante botón CERRAR, tecla Escape o clic en backdrop.
 */

import { onMounted, onUnmounted, watch } from 'vue';
import { useSettings } from '../settings/settings-store';
import { formatKeyDisplay } from '../settings/control-bindings';
import { getAudioManager } from '../audio';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const audioManager = getAudioManager();
const { bindings } = useSettings();

function handleClose(): void {
  audioManager.playSfx('uiClick');
  emit('close');
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    handleClose();
  }
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!props.isOpen) return;
  if (event.key === 'Escape') {
    handleClose();
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
    class="controls-modal-backdrop"
    data-testid="controls-modal"
    role="dialog"
    aria-modal="true"
    @click="handleBackdropClick"
  >
    <div class="controls-modal-chassis">
      <div class="controls-modal-texture" aria-hidden="true"></div>

      <!-- Remaches tácticos -->
      <div class="modal-rivet modal-rivet--tl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--tr" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--bl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--br" aria-hidden="true"></div>

      <header class="controls-modal-header">
        <span class="modal-badge-tag">GUÍA TÉCNICA · TECLADO</span>
        <h2 class="modal-title">CONTROLES DE MANDOS</h2>
      </header>

      <div class="controls-modal-body">
        <!-- SECCIÓN 1: MOVIMIENTO -->
        <div class="controls-section">
          <h3 class="controls-section-title">MOVIMIENTO</h3>
          <ul class="controls-list">
            <li>
              <div class="keys-group">
                <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.moveLeft) }}</kbd>
                <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.moveRight) }}</kbd>
              </div>
              <span class="action-desc">Mover horizontalmente</span>
            </li>
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.softDrop) }}</kbd>
              <span class="action-desc">Caída suave (Soft Drop)</span>
            </li>
          </ul>
        </div>

        <!-- SECCIÓN 2: ACCIONES -->
        <div class="controls-section">
          <h3 class="controls-section-title">ACCIONES DE PIEZA Y COMBATE</h3>
          <ul class="controls-list">
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.rotateClockwise) }}</kbd>
              <span class="action-desc">Rotación horaria (CW)</span>
            </li>
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.rotateCounterClockwise) }}</kbd>
              <span class="action-desc">Rotación antihoraria (CCW)</span>
            </li>
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.hardDrop) }}</kbd>
              <span class="action-desc">Caída instantánea (Hard Drop)</span>
            </li>
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.hold) }}</kbd>
              <span class="action-desc">Reserva de pieza (Hold)</span>
            </li>
            <li>
              <kbd class="rf-keycap">{{ formatKeyDisplay(bindings.triggerSabotage) }}</kbd>
              <span class="action-desc">Lanzar sabotaje táctico</span>
            </li>
          </ul>
        </div>

        <!-- SECCIÓN 3: SISTEMA -->
        <div class="controls-section">
          <h3 class="controls-section-title">SISTEMA</h3>
          <ul class="controls-list">
            <li>
              <kbd class="rf-keycap">Esc</kbd>
              <div class="system-action-wrap">
                <span class="action-desc">Pausar / Reanudar partida</span>
                <span class="system-note">Pausa disponible en modos 1P y VS Bot; en PvP Online la partida no se detiene</span>
              </div>
            </li>
            <li>
              <kbd class="rf-keycap">R</kbd>
              <span class="action-desc">Reiniciar partida</span>
            </li>
          </ul>
        </div>
      </div>

      <footer class="controls-modal-footer">
        <button
          type="button"
          class="rf-btn-console footer-close-btn"
          data-testid="close-controls-modal-button"
          @click="handleClose"
        >
          <span class="rf-btn-console-face">
            <span>CERRAR</span>
          </span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.controls-modal-backdrop {
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

.controls-modal-chassis {
  position: relative;
  width: min(580px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border: 4px solid #383a42;
  border-radius: 8px;
  background: radial-gradient(ellipse at 50% 15%, #242629 0%, #17181b 60%, #0d0e10 100%);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.16),
    inset 0 -4px 12px rgba(0, 0, 0, 0.9),
    0 16px 48px rgba(0, 0, 0, 0.8);
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.controls-modal-texture {
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

.controls-modal-header,
.controls-modal-body,
.controls-modal-footer {
  position: relative;
  z-index: 1;
}

.controls-modal-header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
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

.controls-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.controls-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(15, 16, 18, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 3px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: 4px;
}

.controls-section-title {
  font-family: monospace;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: #a0a4a9;
  text-transform: uppercase;
  margin: 0;
}

.controls-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.controls-list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.78rem;
  color: #e8e8ec;
}

.keys-group {
  display: flex;
  gap: 0.25rem;
}

.action-desc {
  font-size: 0.78rem;
  color: #e8e8ec;
}

.system-action-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.system-note {
  font-size: 0.68rem;
  color: rgba(232, 232, 236, 0.55);
  font-style: italic;
}

.controls-modal-footer {
  display: flex;
  justify-content: flex-end;
}

.footer-close-btn {
  width: 100%;
  height: 42px;
}

@media (max-width: 640px) {
  .controls-modal-chassis {
    padding: 16px;
  }
}
</style>
