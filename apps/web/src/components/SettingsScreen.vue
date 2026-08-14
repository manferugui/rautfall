<template>
  <div class="settings-screen rf-panel rf-riveted-panel" data-testid="settings-screen">
    <header class="settings-header">
      <div class="title-tag">
        <h1 class="settings-title">CONFIGURACIÓN DE CONTROLES</h1>
      </div>
      <p class="settings-subtitle">REMAPEO DE TECLADO Y PERSISTENCIA LOCAL</p>
    </header>

    <div class="rf-hazard-strip hazard-strip" aria-hidden="true"></div>

    <main class="settings-content">
      <div v-if="errorMessage" class="error-banner" data-testid="settings-error-banner" role="alert">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <span class="error-text">{{ errorMessage }}</span>
      </div>

      <div class="controls-section rf-panel-inset">
        <div class="section-title">CANALES DE AUDIO</div>
        <div class="tag-setting-row">
          <div class="tag-info">
            <span class="tag-label">MÚSICA:</span>
            <button
              type="button"
              class="rf-btn-tactical audio-setting-btn"
              data-testid="settings-music-toggle-button"
              :data-music-enabled="isMusicEnabled"
              :disabled="capturingAction !== null"
              @click="toggleMusic"
            >
              {{ isMusicEnabled ? 'MÚSICA ACTIVADA' : 'MÚSICA DESACTIVADA' }}
            </button>
          </div>
          <div class="tag-info">
            <span class="tag-label">EFECTOS:</span>
            <button
              type="button"
              class="rf-btn-tactical audio-setting-btn"
              data-testid="settings-sfx-toggle-button"
              :data-sfx-enabled="isSfxEnabled"
              :disabled="capturingAction !== null"
              @click="toggleSfx"
            >
              {{ isSfxEnabled ? 'EFECTOS ACTIVADOS' : 'EFECTOS DESACTIVADOS' }}
            </button>
          </div>
        </div>
      </div>

      <div class="controls-section rf-panel-inset">
        <div class="section-title">IDENTIFICACIÓN DE OPERADOR</div>
        <div class="tag-setting-row">
          <div class="tag-info">
            <span class="tag-label">TAG ACTUAL:</span>
            <span class="rf-keycap tag-display" data-testid="current-operator-tag">{{ currentTag }}</span>
          </div>
          <button
            type="button"
            class="rf-btn-tactical rf-btn-primary change-tag-btn"
            data-testid="change-operator-tag-button"
            :disabled="capturingAction !== null"
            @click="onChangeTag"
          >
            CAMBIAR TAG
          </button>
        </div>
      </div>

      <div class="controls-section rf-panel-inset">
        <div class="section-title">CONTROLES DE GAMEPLAY</div>
        <table class="controls-table">
          <thead>
            <tr>
              <th scope="col">ACCIÓN</th>
              <th scope="col">TECLA ASIGNADA</th>
              <th scope="col">REMAPEAR</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="action in CONTROL_ACTIONS"
              :key="action"
              :data-testid="`control-row-${action}`"
              :class="{ 'row-capturing': capturingAction === action }"
            >
              <td class="action-label">{{ ACTION_LABELS[action] }}</td>
              <td class="key-badge-cell">
                <span v-if="capturingAction === action" class="capturing-prompt" data-testid="capture-prompt">
                  PULSA UNA TECLA (ESC para cancelar)
                </span>
                <span v-else class="rf-keycap key-badge" data-testid="key-badge">
                  {{ formatKeyDisplay(bindings[action]) }}
                </span>
              </td>
              <td class="action-button-cell">
                <button
                  type="button"
                  class="rf-btn-tactical remap-btn"
                  :data-testid="`change-btn-${action}`"
                  :disabled="capturingAction !== null"
                  @click="startCapture(action)"
                >
                  {{ capturingAction === action ? 'CAPTURANDO...' : 'CAMBIAR' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="settings-actions">
        <button
          type="button"
          class="rf-btn-tactical rf-btn-destructive reset-btn"
          data-testid="reset-defaults-button"
          :disabled="capturingAction !== null"
          @click="onResetDefaults"
        >
          RESTAURAR CONTROLES PREDETERMINADOS
        </button>

        <button
          type="button"
          class="rf-btn-tactical rf-btn-secondary back-btn"
          data-testid="settings-back-button"
          :disabled="capturingAction !== null"
          @click="onBack"
        >
          VOLVER AL MENÚ
        </button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import {
  CONTROL_ACTIONS,
  ACTION_LABELS,
  formatKeyDisplay,
  type ControlAction,
} from '../settings/control-bindings';
import { useSettings } from '../settings/settings-store';
import { getPlayerTag } from '../api/identity';
import { getAudioManager } from '../audio';

const emit = defineEmits<{
  (e: 'back'): void;
  (e: 'change-tag'): void;
}>();

const audioManager = getAudioManager();
const isMusicEnabled = ref(audioManager.isMusicEnabled());
const isSfxEnabled = ref(audioManager.isSfxEnabled());

function toggleMusic(): void {
  audioManager.playSfx('uiClick');
  isMusicEnabled.value = audioManager.toggleMusic();
}

function toggleSfx(): void {
  isSfxEnabled.value = audioManager.toggleSfx();
  audioManager.playSfx('uiClick');
}

const { bindings, updateBinding, resetControlBindings } = useSettings();

const capturingAction = ref<ControlAction | null>(null);
const errorMessage = ref<string | null>(null);
const currentTag = computed(() => getPlayerTag() || '---');

function onChangeTag(): void {
  stopCapture();
  emit('change-tag');
}

let currentKeyDownListener: ((event: KeyboardEvent) => void) | null = null;

function stopCapture(): void {
  if (currentKeyDownListener) {
    window.removeEventListener('keydown', currentKeyDownListener, true);
    currentKeyDownListener = null;
  }
  capturingAction.value = null;
}

function startCapture(action: ControlAction): void {
  stopCapture();
  errorMessage.value = null;
  capturingAction.value = action;

  const onKeyDown = (event: KeyboardEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (event.repeat) return; // Ignorar auto-repeat del navegador

    // Tecla Escape: cancelar captura sin modificar binding ni pausar
    if (event.code === 'Escape') {
      stopCapture();
      return;
    }

    const newCode = event.code;
    const result = updateBinding(action, newCode);

    if (result.success) {
      errorMessage.value = null;
      stopCapture();
    } else if (result.unsupportedCode) {
      const formattedKey = formatKeyDisplay(newCode);
      errorMessage.value = `La tecla "${formattedKey || newCode}" no está soportada para control.`;
      stopCapture();
    } else if (result.duplicateAction) {
      const conflictingActionLabel = ACTION_LABELS[result.duplicateAction];
      const formattedKey = formatKeyDisplay(newCode);
      errorMessage.value = `La tecla "${formattedKey}" ya está asignada a "${conflictingActionLabel}".`;
      stopCapture();
    }
  };

  currentKeyDownListener = onKeyDown;
  window.addEventListener('keydown', onKeyDown, true);
}

function onResetDefaults(): void {
  stopCapture();
  errorMessage.value = null;
  resetControlBindings();
}

function onBack(): void {
  stopCapture();
  emit('back');
}

onUnmounted(() => {
  stopCapture();
});
</script>

<style scoped>
.settings-screen {
  width: 100%;
  max-width: 780px;
  max-height: calc(100vh - 64px);
  margin: 1.5rem auto;
  padding: 1.75rem;
  box-sizing: border-box;
  color: var(--rf-color-text-primary, #e8e8ec);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow: hidden;
}

.settings-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-right: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: #4a4c54 #14151a;
}

.settings-content::-webkit-scrollbar {
  width: 9px;
}

.settings-content::-webkit-scrollbar-track {
  background: #14151a;
}

.settings-content::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #52545c 0%, #34363c 100%);
  border: 1px solid #0a0b0c;
  border-radius: 2px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #62646c 0%, #40424a 100%);
}

.settings-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  text-align: center;
}

.header-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-amber, #f39c12);
  padding: 0.5rem 1.5rem 0.5rem 1rem;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.settings-subtitle {
  font-size: 0.8125rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.hazard-strip {
  width: 100%;
  height: 8px;
  border-radius: 2px;
}

.error-banner {
  background: rgba(231, 76, 60, 0.15);
  border: 1px solid var(--rf-color-red, #e74c3c);
  color: var(--rf-color-red, #e74c3c);
  padding: 0.75rem 1rem;
  border-radius: var(--rf-radius-sm, 3px);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.85rem;
}

.controls-section {
  padding: 1.25rem;
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin-bottom: 1rem;
}

.controls-table {
  width: 100%;
  border-collapse: collapse;
}

.controls-table th {
  text-align: left;
  padding: 0.6rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  border-bottom: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.controls-table td {
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--rf-color-graphite-700, #28292c);
  vertical-align: middle;
}

.row-capturing {
  background-color: rgba(0, 212, 255, 0.08);
}

.action-label {
  font-weight: 600;
  font-size: 0.875rem;
}

.key-badge-cell {
  width: 45%;
}

.key-badge {
  font-size: 0.85rem;
  min-width: 2.2rem;
  text-align: center;
}

.capturing-prompt {
  color: var(--rf-color-amber, #f39c12);
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}

.settings-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.5rem;
}

.tag-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tag-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.tag-label {
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.tag-display {
  font-size: 1.1rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--rf-color-cyan, #00d4ff);
  padding: 0.25rem 0.75rem;
}

</style>
