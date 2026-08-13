// @vitest-environment jsdom
import { describe, beforeEach, it, expect } from 'vitest';
import {
  getOrCreatePlayerId,
  getPlayerName,
  getPlayerTag,
  setPlayerTag,
  hasPlayerTag,
  isValidPlayerTag,
} from './identity';

describe('Identidad del operador y tag arcade (identity.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('genera y persiste un UUID v4 si no existe en localStorage', () => {
    const id1 = getOrCreatePlayerId();
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const id2 = getOrCreatePlayerId();
    expect(id2).toBe(id1);
  });

  it('reemplaza un valor corrupto de UUID en localStorage con uno nuevo válido', () => {
    localStorage.setItem('rautfall_player_id', 'valor-corrupto-invalid-uuid');
    const id = getOrCreatePlayerId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(id).not.toBe('valor-corrupto-invalid-uuid');
  });

  it('valida estrictamente los casos de tag alfanumérico de 3 caracteres', () => {
    expect(isValidPlayerTag('RAU')).toBe(true);
    expect(isValidPlayerTag('A1Z')).toBe(true);
    expect(isValidPlayerTag('000')).toBe(true);

    expect(isValidPlayerTag('AB')).toBe(false);
    expect(isValidPlayerTag('ABCD')).toBe(false);
    expect(isValidPlayerTag('A B')).toBe(false);
    expect(isValidPlayerTag('A-B')).toBe(false);
    expect(isValidPlayerTag('A_1')).toBe(false);
    expect(isValidPlayerTag(null)).toBe(false);
    expect(isValidPlayerTag(undefined)).toBe(false);
  });

  it('normaliza a mayúsculas y persiste rautfall_player_tag', () => {
    const saved = setPlayerTag('rau');
    expect(saved).toBe('RAU');
    expect(hasPlayerTag()).toBe(true);
    expect(getPlayerTag()).toBe('RAU');
    expect(getPlayerName()).toBe('RAU');
    expect(localStorage.getItem('rautfall_player_tag')).toBe('RAU');
  });

  it('trata un valor corrupto guardado en localStorage como ausencia de tag y devuelve fallback ---', () => {
    localStorage.setItem('rautfall_player_tag', 'CORRUPTO_Y_LARGO');
    expect(hasPlayerTag()).toBe(false);
    expect(getPlayerTag()).toBeNull();
    expect(getPlayerName()).toBe('---');
  });

  it('permite cambiar el tag repetidamente sin alterar el UUID persistido', () => {
    const uuidBefore = getOrCreatePlayerId();
    setPlayerTag('RAU');
    expect(getOrCreatePlayerId()).toBe(uuidBefore);

    setPlayerTag('XYZ');
    expect(getPlayerTag()).toBe('XYZ');
    expect(getOrCreatePlayerId()).toBe(uuidBefore);
  });
});
