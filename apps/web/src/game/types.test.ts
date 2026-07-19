import { describe, expect, it } from 'vitest';
import type { GamePresentationState } from './types';

describe('GamePresentationState', () => {
  it('el estado enviado a Vue contiene status, step, elapsedMs y nextPieces', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 42,
      elapsedMs: 420,
      nextPieces: ['I', 'O', 'T'],
    };

    // Verificar que solo tiene las cuatro propiedades esperadas
    const keys = Object.keys(state);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('status');
    expect(keys).toContain('step');
    expect(keys).toContain('elapsedMs');
    expect(keys).toContain('nextPieces');
  });

  it('no contiene el campo singular nextPiece', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['T', 'S', 'Z'],
    };

    expect('nextPiece' in state).toBe(false);
  });

  it('no contiene propiedades adicionales del snapshot del motor', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['I', 'J', 'L'],
    };

    // Verificar que no hay propiedades como board, activePiece, etc.
    expect('board' in state).toBe(false);
    expect('activePiece' in state).toBe(false);
    expect('clearedLines' in state).toBe(false);
  });

  it('soporta status gameOver', () => {
    const state: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
    };

    expect(state.status).toBe('gameOver');
  });

  it('nextPieces tiene tres elementos', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
      nextPieces: ['J', 'L', 'S'],
    };

    expect(state.nextPieces).toHaveLength(3);
  });
});
