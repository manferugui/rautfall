<template>
  <div class="settings-screen" data-testid="settings-screen">
    <header class="settings-header">
      <h1 class="settings-title">CONFIGURACIÓN DE CONTROLES</h1>
      <p class="settings-subtitle">REMAPEO DE TECLADO Y PERSISTENCIA LOCAL</p>
    </header>

    <main class="settings-content">
      <div v-if="errorMessage" class="error-banner" data-testid="settings-error-banner" role="alert">
        <span class="error-icon" aria-hidden="true">⚠️</span>
        <span class="error-text">{{ errorMessage }}</span>
      </div>

      <div class="controls-section">
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
                <span v-else class="key-badge" data-testid="key-badge">
                  {{ formatKeyDisplay(bindings[action]) }}
                </span>
              </td>
              <td class="action-button-cell">
                <button
                  type="button"
                  class="remap-btn"
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
          class="reset-btn"
          data-testid="reset-defaults-button"
          :disabled="capturingAction !== null"
          @click="onResetDefaults"
        >
          RESTAURAR CONTROLES PREDETERMINADOS
        </button>

        <button
          type="button"
          class="back-btn"
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
import { ref, onUnmounted } from 'vue';
import {
  CONTROL_ACTIONS,
  ACTION_LABELS,
  formatKeyDisplay,
  type ControlAction,
} from '../settings/control-bindings';
import { useSettings } from '../settings/settings-store';

const emit = defineEmits<{
  (e: 'back'): void;
}>();

const { bindings, updateBinding, resetControlBindings } = useSettings();

const capturingAction = ref<ControlAction | null>(null);
const errorMessage = ref<string | null>(null);

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
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  box-sizing: border-box;
  color: var(--color-text, #f0f0f0);
  font-family: var(--font-family, system-ui, sans-serif);
}

.settings-header {
  text-align: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--color-border, #333);
  padding-bottom: 1rem;
}

.settings-title {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  margin: 0 0 0.5rem 0;
  color: var(--color-primary, #00f0ff);
}

.settings-subtitle {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #888);
  margin: 0;
}

.error-banner {
  background-color: rgba(255, 0, 60, 0.15);
  border: 1px solid #ff003c;
  color: #ff4d6d;
  padding: 0.75rem 1rem;
  border-radius: 4px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.controls-section {
  background: rgba(20, 20, 25, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 1.25rem;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--color-text-highlight, #fff);
  letter-spacing: 0.05em;
}

.controls-table {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: 0.75rem 0.5rem;
    font-size: 0.8rem;
    color: #888;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  td {
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    vertical-align: middle;
  }
}

.row-capturing {
  background-color: rgba(0, 240, 255, 0.08);
}

.action-label {
  font-weight: 600;
  font-size: 0.95rem;
}

.key-badge-cell {
  width: 40%;
}

.key-badge {
  display: inline-block;
  background: #1e1e24;
  border: 1px solid #00f0ff;
  color: #00f0ff;
  font-family: monospace;
  font-weight: 700;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 1rem;
  min-width: 2rem;
  text-align: center;
}

.capturing-prompt {
  color: #ff00ff;
  font-weight: 700;
  font-size: 0.85rem;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.remap-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    background: #00f0ff;
    color: #000;
    border-color: #00f0ff;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.settings-actions {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.reset-btn, .back-btn {
  padding: 0.75rem 1.25rem;
  border-radius: 4px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn {
  background: rgba(255, 0, 60, 0.1);
  border: 1px solid #ff003c;
  color: #ff4d6d;

  &:hover:not(:disabled) {
    background: #ff003c;
    color: #fff;
  }
}

.back-btn {
  background: #2a2a35;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;

  &:hover:not(:disabled) {
    background: #3a3a48;
  }
}
</style>
