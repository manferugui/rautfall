/**
 * Composable / Store reactivo de Settings para Vue.
 *
 * Responsabilidades:
 * - Proporcionar estado reactivo de las configuraciones de usuario.
 * - Permitir la actualización de un binding de control respetando la detección de duplicados y teclas soportadas.
 * - Permitir la restauración de los controles predeterminados.
 * - Sincronizar automáticamente los cambios con localStorage mediante `saveUserSettings`.
 */

import { ref, computed } from 'vue';
import {
  DEFAULT_CONTROL_BINDINGS,
  findDuplicateAction,
  isRemappableControlCode,
  type ControlAction,
  type ControlBindings,
} from './control-bindings';
import {
  loadUserSettings,
  saveUserSettings,
  type UserSettings,
} from './settings-storage';

const settingsState = ref<UserSettings>(loadUserSettings());

export function useSettings() {
  const bindings = computed<ControlBindings>(() => settingsState.value.controls);

  function reloadSettings(): void {
    settingsState.value = loadUserSettings();
  }

  function updateBinding(
    action: ControlAction,
    newCode: string,
  ): { success: boolean; duplicateAction: ControlAction | null; unsupportedCode?: boolean } {
    const trimmedCode = newCode.trim();
    if (!isRemappableControlCode(trimmedCode)) {
      return { success: false, duplicateAction: null, unsupportedCode: true };
    }

    const duplicate = findDuplicateAction(settingsState.value.controls, action, trimmedCode);
    if (duplicate !== null) {
      return { success: false, duplicateAction: duplicate };
    }

    const updatedControls: ControlBindings = Object.freeze({
      ...settingsState.value.controls,
      [action]: trimmedCode,
    });

    const updatedSettings: UserSettings = Object.freeze({
      version: 1,
      controls: updatedControls,
    });

    settingsState.value = updatedSettings;
    saveUserSettings(updatedSettings);

    return { success: true, duplicateAction: null };
  }

  function resetControlBindings(): void {
    const defaultSettings: UserSettings = Object.freeze({
      version: 1,
      controls: DEFAULT_CONTROL_BINDINGS,
    });
    settingsState.value = defaultSettings;
    saveUserSettings(defaultSettings);
  }

  return {
    bindings,
    reloadSettings,
    updateBinding,
    resetControlBindings,
  };
}
