/**
 * Persistencia local de las configuraciones de usuario bajo la clave `rautfall.settings.v1`.
 *
 * Responsabilidades:
 * - Cargar y guardar `UserSettings` en `localStorage`.
 * - Validar de forma estricta el esquema deserializado.
 * - Realizar un fallback completo a `DEFAULT_USER_SETTINGS` ante cualquier anomalía.
 */

import {
  CONTROL_ACTIONS,
  DEFAULT_CONTROL_BINDINGS,
  isRemappableControlCode,
  type ControlAction,
  type ControlBindings,
} from './control-bindings';

export const SETTINGS_STORAGE_KEY = 'rautfall.settings.v1';

export interface UserSettings {
  readonly version: 1;
  readonly controls: ControlBindings;
}

export const DEFAULT_USER_SETTINGS: UserSettings = Object.freeze({
  version: 1,
  controls: DEFAULT_CONTROL_BINDINGS,
});

/**
 * Valida de forma estricta una estructura de datos deserializada como `UserSettings`.
 * Devuelve el objeto `UserSettings` válido o `null` si no cumple con la especificación estricta.
 */
export function validateUserSettings(payload: unknown): UserSettings | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (candidate.version !== 1) {
    return null;
  }

  if (typeof candidate.controls !== 'object' || candidate.controls === null || Array.isArray(candidate.controls)) {
    return null;
  }

  const controlsObj = candidate.controls as Record<string, unknown>;
  const keys = Object.keys(controlsObj);

  // Verificar que el número de propiedades en controls sea exactamente el de CONTROL_ACTIONS (8 acciones)
  if (keys.length !== CONTROL_ACTIONS.length) {
    return null;
  }

  const usedCodes = new Set<string>();
  const validatedBindings = {} as Record<ControlAction, string>;

  for (const action of CONTROL_ACTIONS) {
    const val = controlsObj[action];
    if (typeof val !== 'string' || !isRemappableControlCode(val)) {
      return null;
    }

    if (usedCodes.has(val)) {
      return null; // Duplicado detectado: rechazar payload completo
    }

    usedCodes.add(val);
    validatedBindings[action] = val;
  }

  return {
    version: 1,
    controls: Object.freeze(validatedBindings),
  };
}

/**
 * Carga `UserSettings` desde `localStorage`.
 * Devuelve `DEFAULT_USER_SETTINGS` ante cualquier fallo de lectura o validación.
 */
export function loadUserSettings(): UserSettings {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_USER_SETTINGS;
    }
    const parsed = JSON.parse(raw);
    const validated = validateUserSettings(parsed);
    return validated ?? DEFAULT_USER_SETTINGS;
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

/**
 * Guarda `UserSettings` en `localStorage`.
 */
export function saveUserSettings(settings: UserSettings): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  const validated = validateUserSettings(settings);
  if (!validated) {
    return;
  }

  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(validated));
  } catch {
    // Silenciar errores de cuota de almacenamiento local si ocurrieran
  }
}
