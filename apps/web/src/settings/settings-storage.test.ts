// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SETTINGS_STORAGE_KEY,
  DEFAULT_USER_SETTINGS,
  loadUserSettings,
  saveUserSettings,
  validateUserSettings,
  type UserSettings,
} from './settings-storage';
import {
  DEFAULT_CONTROL_BINDINGS,
  isRemappableControlCode,
  formatKeyDisplay,
} from './control-bindings';

describe('settings-storage — Persistencia local y validación estricta (8 ControlActions)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('devuelve los defaults cuando localStorage está vacío', () => {
    const settings = loadUserSettings();
    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
    expect(settings.controls).toEqual(DEFAULT_CONTROL_BINDINGS);
    expect(Object.keys(settings.controls)).toHaveLength(8);
  });

  it('guarda y carga correctamente una configuración válida con modificadores laterales y símbolos', () => {
    const customSettings: UserSettings = {
      version: 1,
      controls: {
        ...DEFAULT_CONTROL_BINDINGS,
        moveLeft: 'ShiftRight',
        moveRight: 'ControlRight',
        softDrop: 'Semicolon',
      },
    };

    saveUserSettings(customSettings);
    const loaded = loadUserSettings();
    expect(loaded).toEqual(customSettings);
    expect(loaded.controls.moveLeft).toBe('ShiftRight');
    expect(loaded.controls.moveRight).toBe('ControlRight');
    expect(loaded.controls.softDrop).toBe('Semicolon');
  });

  it('realiza fallback completo a defaults si el JSON en storage es sintácticamente inválido', () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{ json corrupto... }');
    const settings = loadUserSettings();
    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('realiza fallback completo a defaults si la versión no es 1', () => {
    const invalidVersion = {
      version: 2,
      controls: DEFAULT_CONTROL_BINDINGS,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(invalidVersion));
    expect(loadUserSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('realiza fallback completo a defaults si falta una acción configurable (p. ej. pause o softDrop)', () => {
    const missingAction = {
      version: 1,
      controls: {
        moveLeft: 'ArrowLeft',
        moveRight: 'ArrowRight',
        // falta softDrop
        hardDrop: 'Space',
        rotateClockwise: 'ArrowUp',
        rotateCounterClockwise: 'KeyZ',
        hold: 'KeyC',
        triggerSabotage: 'KeyA',
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(missingAction));
    expect(loadUserSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('realiza fallback completo a defaults si se incluye una propiedad extra (p. ej. pause antiguo)', () => {
    const extraProperty = {
      version: 1,
      controls: {
        ...DEFAULT_CONTROL_BINDINGS,
        pause: 'Escape', // pause ya no es configurable
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(extraProperty));
    expect(loadUserSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('realiza fallback completo a defaults si hay un código reservado (Escape, KeyR, Tab, MetaLeft, F1)', () => {
    const reservedCodeSettings = {
      version: 1,
      controls: {
        ...DEFAULT_CONTROL_BINDINGS,
        moveLeft: 'Escape', // Reservada
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(reservedCodeSettings));
    expect(loadUserSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('realiza fallback completo a defaults si hay un código de tecla duplicado', () => {
    const duplicateCodes = {
      version: 1,
      controls: {
        ...DEFAULT_CONTROL_BINDINGS,
        moveLeft: 'ArrowLeft',
        moveRight: 'ArrowLeft',
      },
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(duplicateCodes));
    expect(loadUserSettings()).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('validateUserSettings devuelve null ante entradas no válidas', () => {
    expect(validateUserSettings(null)).toBeNull();
    expect(validateUserSettings(undefined)).toBeNull();
    expect(validateUserSettings('string')).toBeNull();
    expect(validateUserSettings(123)).toBeNull();
    expect(validateUserSettings([])).toBeNull();
  });

  it('isRemappableControlCode aprueba modificadores laterales, numpad y símbolos, y rechaza teclas reservadas', () => {
    // Permitidos
    expect(isRemappableControlCode('ArrowLeft')).toBe(true);
    expect(isRemappableControlCode('ShiftLeft')).toBe(true);
    expect(isRemappableControlCode('ShiftRight')).toBe(true);
    expect(isRemappableControlCode('ControlLeft')).toBe(true);
    expect(isRemappableControlCode('ControlRight')).toBe(true);
    expect(isRemappableControlCode('AltLeft')).toBe(true);
    expect(isRemappableControlCode('AltRight')).toBe(true);
    expect(isRemappableControlCode('Numpad0')).toBe(true);
    expect(isRemappableControlCode('NumpadAdd')).toBe(true);
    expect(isRemappableControlCode('Semicolon')).toBe(true);
    expect(isRemappableControlCode('Space')).toBe(true);

    // Reservados o inválidos
    expect(isRemappableControlCode('Escape')).toBe(false);
    expect(isRemappableControlCode('KeyR')).toBe(false);
    expect(isRemappableControlCode('Tab')).toBe(false);
    expect(isRemappableControlCode('MetaLeft')).toBe(false);
    expect(isRemappableControlCode('F1')).toBe(false);
    expect(isRemappableControlCode('')).toBe(false);
    expect(isRemappableControlCode(null)).toBe(false);
  });

  it('formatKeyDisplay presenta nombres legibles en español', () => {
    expect(formatKeyDisplay('ShiftLeft')).toBe('Shift Izq');
    expect(formatKeyDisplay('ShiftRight')).toBe('Shift Der');
    expect(formatKeyDisplay('ControlLeft')).toBe('Ctrl Izq');
    expect(formatKeyDisplay('ControlRight')).toBe('Ctrl Der');
    expect(formatKeyDisplay('AltLeft')).toBe('Alt Izq');
    expect(formatKeyDisplay('AltRight')).toBe('Alt Der');
    expect(formatKeyDisplay('ArrowLeft')).toBe('←');
    expect(formatKeyDisplay('Space')).toBe('Espacio');
    expect(formatKeyDisplay('NumpadAdd')).toBe('Numpad +');
    expect(formatKeyDisplay('Semicolon')).toBe(';');
  });
});
