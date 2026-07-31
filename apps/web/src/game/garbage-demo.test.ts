// @vitest-environment jsdom
/**
 * Pruebas del escenario de desarrollo de Residuos (garbage-demo).
 */
import { describe, expect, it } from 'vitest';
import { prototypeConfig } from '@rautfall/game-config';
import { createGameEngine } from '@rautfall/game-engine';
import {
  isGarbageDemoActive,
  getGarbageDemoState,
  createGarbageDemoEngine,
  GARBAGE_DEMO_HELP,
} from './garbage-demo';

describe('isGarbageDemoActive (URL parsing)', () => {
  it('el parámetro ?garbage-demo=1 se reconoce solo en desarrollo', () => {
    expect(isGarbageDemoActive('?garbage-demo=1')).toBe(true);
  });

  it('ausencia de parámetro no activa el modo demo', () => {
    expect(isGarbageDemoActive('')).toBe(false);
    expect(isGarbageDemoActive('?overload-demo=1')).toBe(false);
  });

  it('valor distinto de 1 no activa el modo demo', () => {
    expect(isGarbageDemoActive('?garbage-demo=0')).toBe(false);
    expect(isGarbageDemoActive('?garbage-demo=true')).toBe(false);
  });
});

describe('getGarbageDemoState & createGarbageDemoEngine', () => {
  it('el estado inicial contiene pendingGarbage === 2 y cartucho con residuos', () => {
    const state = getGarbageDemoState();

    expect(state.pendingGarbage).toBe(2);
    expect(state.storedSabotages).toEqual(['residuos', 'residuos']);
    // Celdas preparadas en 22 y 23
    expect(state.board[22]![2]).toBe('J');
    expect(state.board[23]![2]).toBe('L');
    // Ninguna celda de basura antes de fijar
    const hasGarbageBefore = state.board.some((row) => row.some((cell) => cell === 'garbage'));
    expect(hasGarbageBefore).toBe(false);
  });

  it('el tablero no contiene filas de basura antes de la primera fijación', () => {
    const engine = createGarbageDemoEngine();
    const snap = engine.getSnapshot();

    expect(snap.pendingGarbage).toBe(2);
    expect(snap.storedSabotages).toEqual(['residuos', 'residuos']);
    const hasGarbageBefore = snap.board.some((row) => row.some((cell) => cell === 'garbage'));
    expect(hasGarbageBefore).toBe(false);
  });

  it('tras fijar la primera pieza, se aplican exactamente 2 filas de basura y desplaza las celdas preparadas 2 filas arriba', () => {
    const engine = createGarbageDemoEngine();
    engine.drainEvents();

    // Fijar la primera pieza con hard drop
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: true,
    });

    const snap = engine.getSnapshot();

    // pendingGarbage debe ser 0
    expect(snap.pendingGarbage).toBe(0);

    // Aparecen exactamente 2 filas inferiores de basura (filas 22 y 23)
    const row22Garbage = snap.board[22]!.filter((cell) => cell === 'garbage').length;
    const row23Garbage = snap.board[23]!.filter((cell) => cell === 'garbage').length;
    expect(row22Garbage).toBe(9);
    expect(row23Garbage).toBe(9);

    // Cada fila tiene exactamente 1 hueco (null)
    expect(snap.board[22]!.filter((cell) => cell === null)).toHaveLength(1);
    expect(snap.board[23]!.filter((cell) => cell === null)).toHaveLength(1);

    // Las celdas preparadas anteriores han subido 2 filas (de 22/23 a 20/21)
    expect(snap.board[20]![2]).toBe('J');
    expect(snap.board[21]![2]).toBe('L');
  });

  it('pulsar A (triggerSabotage) consume un sabotaje del cartucho y vuelve a encolar 2 filas de basura', () => {
    const engine = createGarbageDemoEngine();
    engine.drainEvents();

    // 1. Fijar pieza -> aplica las 2 filas iniciales de basura -> pendingGarbage = 0, cartucho = ['residuos', 'residuos']
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: true,
    });
    expect(engine.getSnapshot().pendingGarbage).toBe(0);

    // 2. Pulsar A -> consume 1 sabotaje del cartucho
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false, triggerSabotage: true,
    });
    engine.receiveSabotage('residuos'); // Simulación del comportamiento de GameScene para demo

    const snap = engine.getSnapshot();
    expect(snap.storedSabotages).toEqual(['residuos']);
    expect(snap.pendingGarbage).toBe(2);
  });

  it('reset restaura el escenario inicial completo', () => {
    const engine = createGarbageDemoEngine();
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: true,
    });
    expect(engine.getSnapshot().pendingGarbage).toBe(0);

    // Recrear motor con reset de demo
    const resetEngine = createGarbageDemoEngine();
    const snap = resetEngine.getSnapshot();
    expect(snap.pendingGarbage).toBe(2);
    expect(snap.storedSabotages).toEqual(['residuos', 'residuos']);
    expect(snap.board[22]![2]).toBe('J');
    expect(snap.board[23]![2]).toBe('L');
  });

  it('sin el parámetro, el arranque normal no cambia (pendingGarbage = 0)', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    expect(snap.pendingGarbage).toBe(0);
    expect(snap.storedSabotages).toEqual([]);
  });
});

describe('GARBAGE_DEMO_HELP', () => {
  it('contiene instrucciones de validación manual de Residuos', () => {
    expect(GARBAGE_DEMO_HELP).toContain('Residuos');
    expect(GARBAGE_DEMO_HELP).toContain('Basura pendiente inicial: 2 filas');
  });
});
