import { describe, expect, it } from 'vitest';
import type { GamePresentationState } from './types';

describe('GamePresentationState', () => {
  it('el estado enviado a Vue contiene status, step, elapsedMs, nextPieces, heldPiece, score, combo, backToBack, combatEnergy, storedSabotages y pendingGarbage', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 42,
      elapsedMs: 420,
      nextPieces: ['I', 'O', 'T'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    // Verificar que solo tiene las 11 propiedades esperadas
    const keys = Object.keys(state);
    expect(keys).toHaveLength(11);
    expect(keys).toContain('status');
    expect(keys).toContain('step');
    expect(keys).toContain('elapsedMs');
    expect(keys).toContain('nextPieces');
    expect(keys).toContain('heldPiece');
    expect(keys).toContain('score');
    expect(keys).toContain('combo');
    expect(keys).toContain('backToBack');
    expect(keys).toContain('combatEnergy');
    expect(keys).toContain('storedSabotages');
    expect(keys).toContain('pendingGarbage');
  });

  it('no contiene el campo singular nextPiece', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['T', 'S', 'Z'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect('nextPiece' in state).toBe(false);
  });

  it('no contiene propiedades adicionales del snapshot del motor', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['I', 'J', 'L'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    // Verificar que no hay propiedades como board, activePiece, etc.
    expect('board' in state).toBe(false);
    expect('activePiece' in state).toBe(false);
    expect('clearedLines' in state).toBe(false);
    // holdUsed no debe filtrarse a nivel superior
    expect('holdUsed' in state).toBe(false);
    // maxCombo no debe estar presente
    expect('maxCombo' in state).toBe(false);
  });

  it('soporta status gameOver', () => {
    const state: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
      score: 1234,
      combo: 3,
      backToBack: 0,
      combatEnergy: 50,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(state.status).toBe('gameOver');
    expect(state.score).toBe(1234);
    expect(state.combo).toBe(3);
    expect(state.combatEnergy).toBe(50);
  });

  it('soporta status paused', () => {
    const state: GamePresentationState = {
      status: 'paused',
      step: 50,
      elapsedMs: 2500,
      nextPieces: ['S', 'Z', 'J'],
      heldPiece: null,
      score: 500,
      combo: 2,
      backToBack: 1,
      combatEnergy: 25,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(state.status).toBe('paused');
    const keys = Object.keys(state);
    expect(keys).toHaveLength(11);
  });

  it('nextPieces tiene tres elementos', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['J', 'L', 'S'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(state.nextPieces).toHaveLength(3);
  });

  it('heldPiece puede ser un tipo de pieza', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 5,
      elapsedMs: 50,
      nextPieces: ['T', 'I', 'O'],
      heldPiece: 'L',
      score: 100,
      combo: 1,
      backToBack: 0,
      combatEnergy: 10,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(state.heldPiece).toBe('L');
  });

  it('heldPiece puede ser null (reserva vacía)', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['I', 'I', 'I'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(state.heldPiece).toBeNull();
  });

  it('score y combo son números', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['I', 'I', 'I'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(typeof state.score).toBe('number');
    expect(typeof state.combo).toBe('number');
  });

  it('backToBack y combatEnergy son números', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['I', 'I', 'I'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
    };

    expect(typeof state.backToBack).toBe('number');
    expect(typeof state.combatEnergy).toBe('number');
  });
});
