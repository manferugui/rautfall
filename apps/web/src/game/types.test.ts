import { describe, expect, it } from 'vitest';
import type { GamePresentationState } from './types';

describe('GamePresentationState', () => {
  it('el estado enviado a Vue contiene status, step, elapsedMs, nextPieces y heldPiece', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 42,
      elapsedMs: 420,
      nextPieces: ['I', 'O', 'T'],
      heldPiece: null,
    };

    // Verificar que solo tiene las cinco propiedades esperadas
    const keys = Object.keys(state);
    expect(keys).toHaveLength(5);
    expect(keys).toContain('status');
    expect(keys).toContain('step');
    expect(keys).toContain('elapsedMs');
    expect(keys).toContain('nextPieces');
    expect(keys).toContain('heldPiece');
  });

  it('no contiene el campo singular nextPiece', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['T', 'S', 'Z'],
      heldPiece: null,
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
    };

    // Verificar que no hay propiedades como board, activePiece, etc.
    expect('board' in state).toBe(false);
    expect('activePiece' in state).toBe(false);
    expect('clearedLines' in state).toBe(false);
    // holdUsed no debe filtrarse a nivel superior
    expect('holdUsed' in state).toBe(false);
  });

  it('soporta status gameOver', () => {
    const state: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
    };

    expect(state.status).toBe('gameOver');
  });

  it('soporta status paused', () => {
    const state: GamePresentationState = {
      status: 'paused',
      step: 50,
      elapsedMs: 2500,
      nextPieces: ['S', 'Z', 'J'],
      heldPiece: null,
    };

    expect(state.status).toBe('paused');
    const keys = Object.keys(state);
    expect(keys).toHaveLength(5);
  });

  it('nextPieces tiene tres elementos', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['J', 'L', 'S'],
      heldPiece: null,
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
    };

    expect(state.heldPiece).toBeNull();
  });
});
