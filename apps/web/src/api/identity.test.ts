// @vitest-environment jsdom
import { describe, beforeEach, it, expect } from 'vitest';
import { getOrCreatePlayerId, getPlayerName } from './identity';

describe('Identidad anónima MVP (identity.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('genera y persiste un UUID v4 si no existe en localStorage', () => {
    const id1 = getOrCreatePlayerId();
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const id2 = getOrCreatePlayerId();
    expect(id2).toBe(id1);
  });

  it('reemplaza un valor corrupto/no UUID en localStorage con uno nuevo válido', () => {
    localStorage.setItem('rautfall_player_id', 'valor-corrupto-invalid-uuid');
    const id = getOrCreatePlayerId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(id).not.toBe('valor-corrupto-invalid-uuid');
  });

  it('deriva el alias visual estable Jugador-XXXX si no hay nombre personalizado', () => {
    const playerId = '123e4567-e89b-12d3-a456-426614174000';
    const name = getPlayerName(playerId);
    expect(name).toBe('Jugador-4000');
  });

  it('respeta el nombre personalizado de localStorage si está definido', () => {
    localStorage.setItem('rautfall_player_name', 'CyberMaster');
    const name = getPlayerName('123e4567-e89b-12d3-a456-426614174000');
    expect(name).toBe('CyberMaster');
  });
});
