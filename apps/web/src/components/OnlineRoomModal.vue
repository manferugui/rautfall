<script setup lang="ts">
/**
 * Componente Modal para la gestión de Salas Online PvP (Crear / Unirse).
 *
 * Responsabilidades:
 * - UI Industrial Dramatic para la selección entre Crear partida o Unirse a partida.
 * - En modo Crear: Muestra el código de sala de 5 caracteres recibido y la animación "ESPERANDO AL RIVAL...".
 * - En modo Unirse: Input de exactamente 5 caracteres (normalizado a mayúsculas), botón "UNIRSE" y desplegable de errores contractuales.
 * - No contiene lógica de Phaser ni reconexión.
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { OnlineGameSession, OnlineSessionStatus } from '../api/online-game-session';
import { getAudioManager } from '../audio';

const props = defineProps<{
  isOpen: boolean;
  session: OnlineGameSession | null;
}>();

const emit = defineEmits<{
  (e: 'startCreate'): void;
  (e: 'startJoin', code: string): void;
  (e: 'cancel'): void;
}>();

const audioManager = getAudioManager();
const activeSubView = ref<'choice' | 'create' | 'join'>('choice');
const inputCode = ref('');
const localErrorMessage = ref<string | null>(null);

const currentSessionStatus = ref<OnlineSessionStatus>(props.session?.status ?? 'idle');
const currentRoomCode = ref<string>(props.session?.roomCode ?? '');

watch(
  () => props.session,
  (session, _oldSession, onCleanup) => {
    if (!session) {
      currentSessionStatus.value = 'idle';
      currentRoomCode.value = '';
      return;
    }

    const updateFromSession = () => {
      currentSessionStatus.value = session.status;
      currentRoomCode.value = session.roomCode ?? '';
    };

    updateFromSession();

    if (typeof session.onStatusChange === 'function') {
      const unbind = session.onStatusChange(() => {
        updateFromSession();
      });
      onCleanup(() => {
        if (typeof unbind === 'function') {
          unbind();
        }
      });
    }
  },
  { immediate: true }
);

const sessionStatus = computed(() => currentSessionStatus.value);
const roomCode = computed(() => currentRoomCode.value);

const isJoinValid = computed(() => inputCode.value.trim().length === 5);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      activeSubView.value = 'choice';
      inputCode.value = '';
      localErrorMessage.value = null;
    }
  }
);

watch(
  () => props.session?.lastError,
  (err) => {
    if (err) {
      if (err.code === 'ROOM_NOT_FOUND') {
        localErrorMessage.value = 'CÓDIGO DE SALA NO ENCONTRADO';
      } else if (err.code === 'ROOM_NOT_WAITING') {
        localErrorMessage.value = 'LA SALA YA ESTÁ COMPLETA O EN PARTIDA';
      } else if (err.code === 'ALREADY_IN_ROOM') {
        localErrorMessage.value = 'YA TIENES UNA SALA ACTIVA';
      } else if (err.code === 'CONNECTION_FAILED' || err.code === 'WEBSOCKET_ERROR') {
        localErrorMessage.value = err.message || 'NO SE PUDO CONECTAR CON EL SERVIDOR PVP';
      } else {
        localErrorMessage.value = err.message || 'ERROR DE CONEXIÓN CON LA SALA';
      }
    } else {
      localErrorMessage.value = null;
    }
  },
  { immediate: true }
);

function handleSelectCreate(): void {
  audioManager.playSfx('uiClick');
  activeSubView.value = 'create';
  if (!props.session?.lastError) {
    localErrorMessage.value = null;
  }
  emit('startCreate');
}

function handleSelectJoinView(): void {
  audioManager.playSfx('uiClick');
  activeSubView.value = 'join';
  inputCode.value = '';
  if (!props.session?.lastError) {
    localErrorMessage.value = null;
  }
}

function handleConfirmJoin(): void {
  if (!isJoinValid.value) return;
  audioManager.playSfx('uiClick');
  localErrorMessage.value = null;
  emit('startJoin', inputCode.value.trim().toUpperCase());
}

function handleCancel(): void {
  audioManager.playSfx('uiClick');
  emit('cancel');
}

function handleCodeInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const cleaned = target.value
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, 5);
  inputCode.value = cleaned;
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if (!props.isOpen) return;
  if (event.key === 'Escape') {
    handleCancel();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div v-if="isOpen" class="online-modal-backdrop" data-testid="online-room-modal">
    <div class="online-modal-chassis">
      <div class="online-modal-texture" aria-hidden="true"></div>

      <!-- Remaches tácticos -->
      <div class="modal-rivet modal-rivet--tl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--tr" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--bl" aria-hidden="true"></div>
      <div class="modal-rivet modal-rivet--br" aria-hidden="true"></div>

      <header class="online-modal-header">
        <span class="modal-badge-tag">ONLINE MULTIPLAYER · 2P</span>
        <h2 class="modal-title">COMBATE CONTRA JUGADOR</h2>
      </header>

      <div class="online-modal-body">
        <!-- VISTA 1: Selección inicial (Crear o Unirse) -->
        <div v-if="activeSubView === 'choice'" class="choice-view">
          <button
            type="button"
            class="rf-btn-console mode-choice-btn"
            data-testid="create-room-button"
            @click="handleSelectCreate"
          >
            <span class="rf-btn-console-face">
              <span class="btn-primary-title">CREAR PARTIDA</span>
              <span class="btn-subtext">Genera un código de sala de 5 caracteres</span>
            </span>
          </button>

          <button
            type="button"
            class="rf-btn-console mode-choice-btn"
            data-testid="join-room-button"
            @click="handleSelectJoinView"
          >
            <span class="rf-btn-console-face">
              <span class="btn-primary-title">UNIRSE A PARTIDA</span>
              <span class="btn-subtext">Introduce el código facilitado por tu rival</span>
            </span>
          </button>
        </div>

        <!-- VISTA 2: Espera tras crear sala -->
        <div v-else-if="activeSubView === 'create'" class="create-view">
          <div class="code-display-module">
            <span class="code-label">CÓDIGO DE SALA</span>
            <div class="code-box" data-testid="room-code-display">
              <span v-if="roomCode" class="code-text">{{ roomCode }}</span>
              <span v-else-if="sessionStatus === 'error'" class="code-error">ERROR AL CONECTAR</span>
              <span v-else class="code-loading">GENERANDO...</span>
            </div>
            <p class="code-instructions">
              {{ sessionStatus === 'error' ? 'No se pudo conectar con el servidor PvP' : 'Comparte este código de 5 caracteres con tu rival' }}
            </p>
          </div>

          <div v-if="sessionStatus !== 'error'" class="waiting-indicator" data-testid="waiting-opponent-status">
            <div class="pulse-beacon" aria-hidden="true"></div>
            <span>ESPERANDO AL RIVAL...</span>
          </div>
        </div>

        <!-- VISTA 3: Input para unirse a sala existente -->
        <div v-else-if="activeSubView === 'join'" class="join-view">
          <div class="join-input-module">
            <label for="room-code-input" class="code-label">INTRODUCE EL CÓDIGO (5 CARACTERES)</label>
            <input
              id="room-code-input"
              type="text"
              class="join-code-input"
              data-testid="join-room-code-input"
              :value="inputCode"
              maxlength="5"
              placeholder="AB12C"
              autocomplete="off"
              spellcheck="false"
              @input="handleCodeInput"
              @keyup.enter="handleConfirmJoin"
            />
          </div>

          <button
            type="button"
            class="rf-btn-console join-submit-btn"
            data-testid="submit-join-room-button"
            :disabled="!isJoinValid || sessionStatus === 'connecting'"
            @click="handleConfirmJoin"
          >
            <span class="rf-btn-console-face">
              <span>{{ sessionStatus === 'connecting' ? 'CONECTANDO...' : 'UNIRSE' }}</span>
            </span>
          </button>
        </div>

        <!-- Alerta de Errores -->
        <div v-if="localErrorMessage" class="error-banner" data-testid="room-error-message" role="alert">
          <span class="error-icon" aria-hidden="true">⚠</span>
          <span>{{ localErrorMessage }}</span>
        </div>
      </div>

      <footer class="online-modal-footer">
        <button
          type="button"
          class="rf-btn-console footer-cancel-btn"
          data-testid="cancel-online-room-button"
          @click="handleCancel"
        >
          <span class="rf-btn-console-face">
            <span>{{ activeSubView === 'choice' ? 'CANCELAR' : 'VOLVER AL MENÚ' }}</span>
          </span>
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.online-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 11, 13, 0.85);
  backdrop-filter: blur(4px);
}

.online-modal-chassis {
  position: relative;
  width: min(560px, calc(100vw - 32px));
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

.online-modal-texture {
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

.online-modal-header,
.online-modal-body,
.online-modal-footer {
  position: relative;
  z-index: 1;
}

.online-modal-header {
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
  color: var(--rf-color-pvp-green, #a6ff00);
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

.online-modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.choice-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
}

.mode-choice-btn {
  width: 100%;
  max-width: 400px;
  height: 68px;
}

.mode-choice-btn .rf-btn-console-face {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 0.2rem;
  clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 8px), 0 8px);
}

.btn-primary-title {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--rf-color-pvp-green, #a6ff00);
  white-space: nowrap;
}

.btn-subtext {
  font-size: 0.72rem;
  color: rgba(232, 232, 236, 0.65);
  white-space: nowrap;
}

.mode-choice-btn:focus-visible .rf-btn-console-face::before {
  border-top: 2px solid var(--rf-color-pvp-green, #a6ff00);
  border-left: 2px solid var(--rf-color-pvp-green, #a6ff00);
}

.mode-choice-btn:focus-visible .rf-btn-console-face::after {
  border-bottom: 2px solid var(--rf-color-pvp-green, #a6ff00);
  border-right: 2px solid var(--rf-color-pvp-green, #a6ff00);
}

.room-code-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  text-align: center;
  background: linear-gradient(160deg, rgba(32, 35, 40, 0.95) 0%, rgba(18, 19, 22, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 2px 6px rgba(0, 0, 0, 0.6);
}

.code-label {
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #a0a4a9;
  text-align: center;
}

.code-box {
  box-sizing: border-box;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, rgba(6, 7, 9, 0.98) 0%, rgba(12, 13, 15, 0.98) 100%);
  border: 1.5px solid var(--rf-color-pvp-green, #a6ff00);
  padding: 0.5rem 1.5rem;
  border-radius: 4px;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.95);
}

.code-text {
  font-family: monospace;
  font-size: 2.2rem;
  font-weight: 900;
  letter-spacing: 0.25em;
  padding-left: 0.25em;
  color: var(--rf-color-pvp-green, #a6ff00);
  text-align: center;
}

.code-loading {
  font-family: monospace;
  font-size: 1.2rem;
  color: #888;
  text-align: center;
}

.code-instructions {
  font-size: 0.78rem;
  color: rgba(232, 232, 236, 0.7);
  margin: 0;
  text-align: center;
}

.waiting-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 1.75rem;
  font-family: monospace;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--rf-color-pvp-green, #a6ff00);
}

.pulse-beacon {
  width: 10px;
  height: 10px;
  background-color: var(--rf-color-pvp-green, #a6ff00);
  border-radius: 50%;
  animation: pulse 1.2s infinite ease-in-out;
}

@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.4; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.4; }
}

.join-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.join-input-module {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.join-code-input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-align: center;
  text-transform: uppercase;
  background: #0d0e11;
  color: #e8e8ec;
  border: 2px solid #3a3c44;
  border-radius: 4px;
  outline: none;
}

.join-code-input:focus {
  border-color: var(--rf-color-pvp-green, #a6ff00);
}

.join-submit-btn {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  height: 48px;
}

.join-submit-btn .rf-btn-console-face {
  color: var(--rf-color-pvp-green, #a6ff00);
  clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 6px), 0 6px);
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  background: rgba(180, 40, 40, 0.2);
  border: 1px solid #e74c3c;
  border-radius: 4px;
  color: #ff6b6b;
  font-family: monospace;
  font-size: 0.75rem;
  font-weight: 700;
}

.online-modal-footer {
  display: flex;
  justify-content: center;
  width: 100%;
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
