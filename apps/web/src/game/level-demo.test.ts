import { describe, expect, it } from 'vitest';
import {
  isLevelDemoActive,
  getLevelDemoTarget,
  getLevelDemoState,
  createLevelDemoEngine,
} from './level-demo';

describe('Level Demo Mode', () => {
  it('isLevelDemoActive retorna false cuando no hay query param', () => {
    expect(isLevelDemoActive('?foo=bar')).toBe(false);
  });

  it('getLevelDemoTarget detecta ?level-demo=1 y ?level-demo=10', () => {
    expect(getLevelDemoTarget('?level-demo=1')).toBe(1);
    expect(getLevelDemoTarget('?level-demo=10')).toBe(10);
    expect(getLevelDemoTarget('?level-demo=5')).toBe(null);
  });

  it('getLevelDemoState(1) inicializa en Nivel 1 con 9 líneas acumuladas y tablero preparado', () => {
    const state = getLevelDemoState(1);
    expect(state.clearedLines).toBe(9);
    expect(state.board[23]![0]).toBe('I');
    expect(state.board[23]![3]).toBe(null);
  });

  it('getLevelDemoState(10) inicializa en Nivel 10 con 90 líneas acumuladas', () => {
    const state = getLevelDemoState(10);
    expect(state.clearedLines).toBe(90);
  });

  it('createLevelDemoEngine(1) genera un motor en nivel 1 con 9 líneas', () => {
    const engine = createLevelDemoEngine(1);
    const snap = engine.getSnapshot();
    expect(snap.level).toBe(1);
    expect(snap.clearedLines).toBe(9);
    expect(snap.baseGravityCellsPerSecond).toBe(1.0);
  });

  it('createLevelDemoEngine(10) genera un motor en nivel 10 con 90 líneas', () => {
    const engine = createLevelDemoEngine(10);
    const snap = engine.getSnapshot();
    expect(snap.level).toBe(10);
    expect(snap.clearedLines).toBe(90);
    expect(snap.baseGravityCellsPerSecond).toBe(10.0);
  });
});
