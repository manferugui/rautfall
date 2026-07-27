import { describe, expect, it } from 'vitest';
import { computeSessionStatus, canTogglePause } from './session-status';

describe('computeSessionStatus', () => {
  it('gameOver con isPaused=false devuelve gameOver', () => {
    expect(computeSessionStatus('gameOver', false)).toBe('gameOver');
  });

  it('gameOver con isPaused=true devuelve gameOver (precedencia)', () => {
    expect(computeSessionStatus('gameOver', true)).toBe('gameOver');
  });

  it('running con isPaused=true devuelve paused', () => {
    expect(computeSessionStatus('running', true)).toBe('paused');
  });

  it('running con isPaused=false devuelve running', () => {
    expect(computeSessionStatus('running', false)).toBe('running');
  });
});

describe('canTogglePause', () => {
  it('running permite alternar pausa', () => {
    expect(canTogglePause('running')).toBe(true);
  });

  it('gameOver no permite alternar pausa', () => {
    expect(canTogglePause('gameOver')).toBe(false);
  });
});
