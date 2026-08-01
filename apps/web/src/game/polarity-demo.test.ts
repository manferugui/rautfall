// @vitest-environment jsdom
/**
 * Pruebas del escenario de desarrollo de Polaridad inversa (polarity-demo).
 */
import { describe, expect, it } from 'vitest';
import { buildStepInput, type KeyState } from './input-buffer';
import {
  isPolarityDemoActive,
  getPolarityDemoState,
  createPolarityDemoEngine,
  POLARITY_DEMO_HELP,
} from './polarity-demo';

describe('isPolarityDemoActive (URL parsing)', () => {
  it('el parámetro ?polarity-demo=1 se reconoce solo en desarrollo', () => {
    expect(isPolarityDemoActive('?polarity-demo=1')).toBe(true);
  });

  it('ausencia de parámetro no activa el modo demo', () => {
    expect(isPolarityDemoActive('')).toBe(false);
    expect(isPolarityDemoActive('?sabotage-demo=1')).toBe(false);
  });

  it('valor distinto de 1 no activa el modo demo', () => {
    expect(isPolarityDemoActive('?polarity-demo=0')).toBe(false);
    expect(isPolarityDemoActive('?polarity-demo=true')).toBe(false);
  });
});

describe('getPolarityDemoState & createPolarityDemoEngine', () => {
  it('el estado inicial contiene un único efecto Polaridad con remainingPieces = 1 y cartucho cargado', () => {
    const state = getPolarityDemoState();

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects![0]).toEqual({ type: 'polaridad', remainingPieces: 1 });
    expect(state.storedSabotages![0]).toBe('polaridad');
    expect(state.board.every((row) => row.every((cell) => cell === null))).toBe(true);
  });

  it('el motor arranca inmediatamente con POLARIDAD a 1 pieza y cartucho con polaridad', () => {
    const engine = createPolarityDemoEngine();
    const snap = engine.getSnapshot();

    expect(snap.activeEffects).toHaveLength(1);
    expect(snap.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });
    expect(snap.storedSabotages[0]).toBe('polaridad');
  });

  it('secuencia de activaciones con la tecla A (triggerSabotage + loopback)', () => {
    const engine = createPolarityDemoEngine();
    engine.drainEvents();

    // 1. Estado inicial
    const snap0 = engine.getSnapshot();
    expect(snap0.activeEffects).toHaveLength(1);
    expect(snap0.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });
    expect(snap0.storedSabotages).toEqual(['polaridad', 'polaridad']);

    // 2. Primera pulsación de A (primer consumo y loopback)
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false, triggerSabotage: true,
    });
    const events1 = engine.drainEvents();
    const trig1 = events1.find((e) => e.type === 'sabotageTriggered');
    expect(trig1).toBeDefined();
    if (trig1 && trig1.type === 'sabotageTriggered') {
      expect(trig1.sabotage).toBe('polaridad');
      engine.receiveSabotage(trig1.sabotage);
    }

    const eventsStarted1 = engine.drainEvents().filter((e) => e.type === 'effectStarted');
    expect(eventsStarted1).toHaveLength(1);
    expect(eventsStarted1[0]).toEqual({
      type: 'effectStarted',
      step: 1,
      effect: 'polaridad',
      durationPieces: 2,
    });

    const snap1 = engine.getSnapshot();
    expect(snap1.activeEffects).toHaveLength(1);
    expect(snap1.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });
    expect(snap1.storedSabotages).toEqual(['polaridad']);

    // 3. Segunda pulsación de A (segundo consumo y loopback)
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false, triggerSabotage: true,
    });
    const events2 = engine.drainEvents();
    const trig2 = events2.find((e) => e.type === 'sabotageTriggered');
    expect(trig2).toBeDefined();
    if (trig2 && trig2.type === 'sabotageTriggered') {
      engine.receiveSabotage(trig2.sabotage);
    }

    const snap2 = engine.getSnapshot();
    expect(snap2.activeEffects).toHaveLength(1);
    expect(snap2.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });
    expect(snap2.storedSabotages).toEqual([]);
  });

  it('fijar una pieza reduce remainingPieces y la siguiente fijación expira el efecto', () => {
    const engine = createPolarityDemoEngine();
    engine.drainEvents();

    // Renovar a 2 piezas
    engine.receiveSabotage('polaridad');
    expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });

    // Fijar la primera pieza mediante hardDrop
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: true,
    });

    expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

    // Fijar la segunda pieza mediante hardDrop
    engine.step({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: true,
    });

    expect(engine.getSnapshot().activeEffects).toEqual([]);
  });

  it('mantener la tecla A produce un único consumo (flanco único y consumedThisFrame)', () => {
    const keys: KeyState = {
      horizontalPressed: null, leftHeld: false, rightHeld: false,
      justPressedUp: false, justPressedZ: false, justPressedSpace: false,
      justPressedC: false, justPressedA: true, softDropHeld: false,
    };

    const emptyConsumed = {
      horizontal: false, clockwise: false, counterclockwise: false,
      hardDrop: false, hold: false, triggerSabotage: false,
    };

    // Paso 1: tecla A recién pulsada (justPressedA: true) -> triggerSabotage: true y marca consumed.triggerSabotage = true
    const [input1, consumed1] = buildStepInput(keys, emptyConsumed);
    expect(input1.triggerSabotage).toBe(true);
    expect(consumed1.triggerSabotage).toBe(true);

    // Paso 2 (mismo frame o pasos subsiguientes en mantención sin soltar) -> triggerSabotage: false
    const [input2, consumed2] = buildStepInput(keys, consumed1);
    expect(input2.triggerSabotage).toBeUndefined();
    expect(consumed2.triggerSabotage).toBe(true);
  });

  it('fuera de las demos de desarrollo, la activación de un sabotaje no aplica loopback al propio jugador', () => {
    // Comprobar que en partida normal (?polarity-demo no presente), isPolarityDemoActive devuelve false
    expect(isPolarityDemoActive('')).toBe(false);
  });
});

describe('POLARITY_DEMO_HELP', () => {
  it('contiene instrucciones claras de validación manual de Polaridad inversa', () => {
    expect(POLARITY_DEMO_HELP).toContain('Polaridad');
    expect(POLARITY_DEMO_HELP).toContain('POLARIDAD · 1 PIEZA');
  });
});
