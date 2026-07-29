import { describe, expect, it } from 'vitest';
import { buildStepInput, type KeyState } from './input-buffer';

function emptyKeys(): KeyState {
  return {
    horizontalPressed: null,
    leftHeld: false,
    rightHeld: false,
    justPressedUp: false,
    justPressedZ: false,
    justPressedSpace: false,
    justPressedC: false,
    softDropHeld: false,
  };
}

function noConsumed() {
  return { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false };
}

describe('buildStepInput — flanco horizontal único', () => {
  it('horizontalPressed=left produce leftPressed=true, leftHeld=true', () => {
    const keys = { ...emptyKeys(), horizontalPressed: 'left' as const, leftHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.leftPressed).toBe(true);
    expect(input.leftHeld).toBe(true);
    expect(input.rightPressed).toBe(false);
    expect(input.rightHeld).toBe(false);
  });

  it('horizontalPressed=right produce rightPressed=true, rightHeld=true', () => {
    const keys = { ...emptyKeys(), horizontalPressed: 'right' as const, rightHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.rightPressed).toBe(true);
    expect(input.rightHeld).toBe(true);
    expect(input.leftPressed).toBe(false);
    expect(input.leftHeld).toBe(false);
  });

  it('horizontalPressed=null no produce ningún flanco', () => {
    const keys = { ...emptyKeys(), horizontalPressed: null, leftHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.leftPressed).toBe(false);
    expect(input.leftHeld).toBe(true);
    expect(input.rightPressed).toBe(false);
  });

  it('flanco se consume una sola vez (consumido=true no lo entrega)', () => {
    const keys = { ...emptyKeys(), horizontalPressed: 'left' as const, leftHeld: true };
    const consumed = { horizontal: true, clockwise: false, counterclockwise: false, hardDrop: false, hold: false };
    const [input] = buildStepInput(keys, consumed);
    expect(input.leftPressed).toBe(false);
    expect(input.leftHeld).toBe(true);
  });

  it('mantener izquierda produce leftHeld=true sin flanco si consumed=true', () => {
    const keys = { ...emptyKeys(), horizontalPressed: null, leftHeld: true };
    const consumed = { horizontal: true, clockwise: false, counterclockwise: false, hardDrop: false, hold: false };
    const [input] = buildStepInput(keys, consumed);
    expect(input.leftHeld).toBe(true);
    expect(input.leftPressed).toBe(false);
  });

  it('mantener derecha produce rightHeld=true sin flanco si consumed=true', () => {
    const keys = { ...emptyKeys(), horizontalPressed: null, rightHeld: true };
    const consumed = { horizontal: true, clockwise: false, counterclockwise: false, hardDrop: false, hold: false };
    const [input] = buildStepInput(keys, consumed);
    expect(input.rightHeld).toBe(true);
    expect(input.rightPressed).toBe(false);
  });

  it('nunca entrega ambos flancos simultáneos (horizontalPressed garantiza unicidad)', () => {
    const keys = { ...emptyKeys(), horizontalPressed: 'left' as const, leftHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    // Con horizontalPressed='left', rightPressed nunca puede ser true
    expect(input.leftPressed && !input.rightPressed).toBe(true);
    expect(input.rightPressed).toBe(false);
  });

  it('soft drop: softDropHeld produce softDropHeld en el StepInput', () => {
    const keys = { ...emptyKeys(), softDropHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.softDropHeld).toBe(true);
  });

  it('soft drop: sin pulsar produce softDropHeld false', () => {
    const keys = { ...emptyKeys(), softDropHeld: false };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.softDropHeld).toBe(false);
  });

  it('soft drop mantenido no se consume (no tiene consumed)', () => {
    const keys = { ...emptyKeys(), softDropHeld: true };
    const [input] = buildStepInput(keys, { horizontal: true, clockwise: true, counterclockwise: true, hardDrop: true, hold: true });
    expect(input.softDropHeld).toBe(true);
  });

  it('rotación horaria se consume una vez', () => {
    const keys = { ...emptyKeys(), justPressedUp: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.rotateClockwise).toBe(true);
  });

  it('rotación antihoraria se consume una vez', () => {
    const keys = { ...emptyKeys(), justPressedZ: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.rotateCounterclockwise).toBe(true);
  });

  it('nunca se generan ambas rotaciones simultáneamente', () => {
    const keys = { ...emptyKeys(), justPressedUp: true, justPressedZ: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.rotateClockwise).toBe(false);
    expect(input.rotateCounterclockwise).toBe(false);
  });

  it('hard drop se consume una vez', () => {
    const keys = { ...emptyKeys(), justPressedSpace: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.hardDrop).toBe(true);
  });

  describe('hold (reserva)', () => {
    it('justPressedC produce hold: true una sola vez', () => {
      const keys = { ...emptyKeys(), justPressedC: true };
      const [input] = buildStepInput(keys, noConsumed());
      expect(input.hold).toBe(true);
    });

    it('sin flanco produce hold ausente (undefined)', () => {
      const keys = { ...emptyKeys(), justPressedC: false };
      const [input] = buildStepInput(keys, noConsumed());
      expect(input.hold).toBeUndefined();
    });

    it('se consume una sola vez (consumido=true no lo entrega)', () => {
      const keys = { ...emptyKeys(), justPressedC: true };
      const consumed = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: true };
      const [input] = buildStepInput(keys, consumed);
      expect(input.hold).toBeUndefined();
    });

    it('puede coexistir con rotación y hard drop', () => {
      const keys = { ...emptyKeys(), justPressedC: true, justPressedUp: true, justPressedSpace: true };
      const [input] = buildStepInput(keys, noConsumed());
      expect(input.hold).toBe(true);
      expect(input.rotateClockwise).toBe(true);
      expect(input.hardDrop).toBe(true);
    });
  });

  it('acciones no repetidas en pasos adicionales del mismo frame (todo consumido)', () => {
    const keys = {
      ...emptyKeys(),
      horizontalPressed: null,
      leftHeld: true,
      justPressedUp: false,
      justPressedSpace: false,
      softDropHeld: true,
    };
    const consumed = { horizontal: true, clockwise: true, counterclockwise: false, hardDrop: true, hold: true };
    const [input] = buildStepInput(keys, consumed);
    expect(input.leftPressed).toBe(false);
    expect(input.leftHeld).toBe(true);
    expect(input.rotateClockwise).toBe(false);
    expect(input.hardDrop).toBe(false);
    expect(input.softDropHeld).toBe(true);
  });

  it('horizontalPressed=right con leftHeld=true (ambas mantenidas) no produce conflicto', () => {
    const keys = { ...emptyKeys(), horizontalPressed: 'right' as const, leftHeld: true, rightHeld: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.leftHeld).toBe(true);
    expect(input.rightHeld).toBe(true);
    expect(input.leftPressed).toBe(false);
    expect(input.rightPressed).toBe(true); // solo el flanco derecho
  });
});
