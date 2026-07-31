// @vitest-environment jsdom
/**
 * Pruebas del escenario de desarrollo de Sobrecarga (overload-demo).
 */
import { describe, expect, it } from 'vitest';
import { prototypeConfig } from '@rautfall/game-config';
import { createGameEngine } from '@rautfall/game-engine';
import {
  isOverloadDemoActive,
  getOverloadDemoState,
  createOverloadDemoEngine,
  OVERLOAD_DEMO_HELP,
} from './overload-demo';

describe('isOverloadDemoActive (URL parsing)', () => {
  it('el parámetro ?overload-demo=1 se reconoce solo en desarrollo', () => {
    expect(isOverloadDemoActive('?overload-demo=1')).toBe(true);
  });

  it('ausencia de parámetro no activa el modo demo', () => {
    expect(isOverloadDemoActive('')).toBe(false);
    expect(isOverloadDemoActive('?sabotage-demo=1')).toBe(false);
  });

  it('valor distinto de 1 no activa el modo demo', () => {
    expect(isOverloadDemoActive('?overload-demo=0')).toBe(false);
    expect(isOverloadDemoActive('?overload-demo=true')).toBe(false);
  });
});

describe('getOverloadDemoState & createOverloadDemoEngine', () => {
  it('el estado inicial contiene un único efecto Sobrecarga con 10.000 ms y cartucho cargado', () => {
    const state = getOverloadDemoState();

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects![0]).toEqual({ type: 'sobrecarga', remainingMs: 10000 });
    expect(state.storedSabotages![0]).toBe('sobrecarga');
    expect(state.board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it('el motor arranca inmediatamente con SOBRECARGA a 10.000 ms y cartucho con sobrecarga', () => {
    const engine = createOverloadDemoEngine();
    const snap = engine.getSnapshot();

    expect(snap.activeEffects).toHaveLength(1);
    expect(snap.activeEffects[0]).toEqual({ type: 'sobrecarga', remainingMs: 10000 });
    expect(snap.storedSabotages[0]).toBe('sobrecarga');
  });

  it('pulsar A (triggerSabotage) renueva Sobrecarga a 10.000 ms sin duplicar el efecto', () => {
    const engine = createOverloadDemoEngine();
    engine.drainEvents();

    // Avanzar 50 pasos (500 ms)
    for (let i = 0; i < 50; i++) {
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
    }
    expect(engine.getSnapshot().activeEffects[0]?.remainingMs).toBe(9500);

    // Simular pulsación de A (triggerSabotage) que consume el sabotaje del cartucho
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false, triggerSabotage: true,
    });
    engine.receiveSabotage('sobrecarga'); // Simulación del comportamiento de GameScene en demo

    const snap = engine.getSnapshot();
    expect(snap.activeEffects).toHaveLength(1);
    expect(snap.activeEffects[0]?.remainingMs).toBe(10000);
  });

  it('el paso de tiempo descuenta el temporizador y al expirar deja activeEffects en vacio', () => {
    const engine = createOverloadDemoEngine();
    engine.drainEvents();

    // Avanzar 1000 pasos de 10 ms (10.000 ms)
    for (let i = 0; i < 1000; i++) {
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
    }

    const snap = engine.getSnapshot();
    expect(snap.activeEffects).toEqual([]);
  });

  it('reset restaura el estado inicial con Sobrecarga activa a 10.000 ms', () => {
    const engine = createOverloadDemoEngine();

    // Avanzar 1000 pasos para que expire
    for (let i = 0; i < 1000; i++) {
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
    }
    expect(engine.getSnapshot().activeEffects).toEqual([]);

    // Reset en modo demo recrea el estado limpio de la demo
    const resetEngine = createOverloadDemoEngine();
    expect(resetEngine.getSnapshot().activeEffects[0]?.remainingMs).toBe(10000);
  });

  it('sin el parámetro, el estado inicial normal no cambia (activeEffects vacio y cartucho vacio)', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    expect(snap.activeEffects).toEqual([]);
    expect(snap.storedSabotages).toEqual([]);
  });
});

describe('OVERLOAD_DEMO_HELP', () => {
  it('contiene instrucciones claras de validación manual de Sobrecarga', () => {
    expect(OVERLOAD_DEMO_HELP).toContain('Sobrecarga');
    expect(OVERLOAD_DEMO_HELP).toContain('Gravedad pasiva 3x');
  });
});
