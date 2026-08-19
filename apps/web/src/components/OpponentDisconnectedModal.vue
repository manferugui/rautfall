<script setup lang="ts">
/**
 * Componente Modal Industrial para Desconexión del Rival en PvP Online.
 *
 * Responsabilidades:
 * - Notificar inmediatamente al operador cuando el oponente abandona la partida.
 * - Bloquear la interacción con el juego de forma estricta (modal modal="true").
 * - Ofrecer como única acción posible regresar al menú principal.
 */

import { ref, onMounted, nextTick } from 'vue';

const emit = defineEmits<{
  (e: 'mainMenu'): void;
}>();

const mainMenuBtnRef = ref<HTMLButtonElement | null>(null);

function handleMainMenu(): void {
  emit('mainMenu');
}

function handleKeyDown(event: KeyboardEvent): void {
  event.stopPropagation();
  if (event.key === 'Enter' || event.key === 'Space' || event.key === 'Escape') {
    event.preventDefault();
    handleMainMenu();
  }
}

function handleKeyUp(event: KeyboardEvent): void {
  event.stopPropagation();
}

onMounted(async () => {
  await nextTick();
  if (mainMenuBtnRef.value) {
    mainMenuBtnRef.value.focus();
  }
});
</script>

<template>
  <div
    class="disconnected-modal-backdrop"
    role="dialog"
    aria-modal="true"
    aria-labelledby="disconnected-modal-title"
    aria-describedby="disconnected-modal-desc"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
  >
    <div class="disconnected-modal-panel">
      <!-- Remaches tácticos industriales en esquinas -->
      <div class="modal-bolt modal-bolt--tl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--tr" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--bl" aria-hidden="true"></div>
      <div class="modal-bolt modal-bolt--br" aria-hidden="true"></div>

      <!-- Cabecera de alerta industrial -->
      <header class="modal-header">
        <h2 id="disconnected-modal-title" class="modal-title">RIVAL DESCONECTADO</h2>
      </header>

      <div class="hazard-strip" aria-hidden="true"></div>

      <!-- Cuerpo explicativo -->
      <div class="modal-body">
        <p id="disconnected-modal-desc" class="modal-description">
          EL RIVAL HA ABANDONADO LA PARTIDA
        </p>
      </div>

      <!-- Acción única -->
      <footer class="modal-actions">
        <button
          ref="mainMenuBtnRef"
          type="button"
          class="rf-btn-tactical rf-btn-primary main-menu-btn"
          data-testid="opponent-disconnected-main-menu-button"
          @click="handleMainMenu"
        >
          VOLVER AL MENÚ PRINCIPAL
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.disconnected-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 11, 0.92);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2500;
}

.disconnected-modal-panel {
  position: relative;
  background: var(--rf-color-graphite-900, #17181a);
  width: 420px;
  max-width: 92vw;
  border: 2px solid var(--rf-color-red, #e74c3c);
  border-radius: var(--rf-radius-md, 6px);
  padding: 1.5rem 1.35rem 1.35rem;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 8px rgba(0, 0, 0, 0.9),
    0 0 24px rgba(231, 76, 60, 0.3),
    0 16px 40px rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  text-align: center;
}

.modal-title {
  font-size: 1.35rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-red, #e74c3c);
  margin: 0;
}

.hazard-strip {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  opacity: 0.8;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-red, #e74c3c) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

.modal-body {
  display: flex;
  flex-direction: column;
  text-align: center;
  padding: 0.25rem 0;
}

.modal-description {
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.45;
  color: var(--rf-color-text-primary, #e8e8ec);
  margin: 0;
}

.modal-actions {
  display: flex;
  width: 100%;
  margin-top: 0.2rem;
}

.main-menu-btn {
  width: 100%;
  justify-content: center;
  padding: 0.75rem 1rem;
}
</style>
