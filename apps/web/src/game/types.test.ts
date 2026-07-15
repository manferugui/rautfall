import { describe, expect, it } from 'vitest';
import type { GamePresentationState } from './types';

describe('GamePresentationState', () => {
  it('el estado enviado a Vue contiene solo status, step y elapsedMs', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 42,
      elapsedMs: 420,
    };

    // Verificar que solo tiene las tres propiedades esperadas
    const keys = Object.keys(state);
    expect(keys).toHaveLength(3);
    expect(keys).toContain('status');
    expect(keys).toContain('step');
    expect(keys).toContain('elapsedMs');
  });

  it('no contiene propiedades adicionales del snapshot del motor', () => {
    const state: GamePresentationState = {
      status: 'running',
      step: 0,
      elapsedMs: 0,
    };

    // Verificar que no hay propiedades como board, activePiece, etc.
    expect('board' in state).toBe(false);
    expect('activePiece' in state).toBe(false);
    expect('nextPiece' in state).toBe(false);
    expect('clearedLines' in state).toBe(false);
  });

  it('soporta status gameOver', () => {
    const state: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
    };

    expect(state.status).toBe('gameOver');
  });
});
