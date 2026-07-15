import { describe, expect, it } from 'vitest';
import { buildStepInput, type KeyState } from './input-buffer';

function emptyKeys(): KeyState {
  return {
    justPressedLeft: false,
    justPressedRight: false,
    isDownLeft: false,
    isDownRight: false,
    justPressedUp: false,
    justPressedZ: false,
    justPressedSpace: false,
  };
}

function noConsumed() {
  return { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
}

describe('buildStepInput — entrada de teclado', () => {
  it('pulsación izquierda genera un único horizontal -1', () => {
    const keys = { ...emptyKeys(), justPressedLeft: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.horizontal).toBe(-1);
  });

  it('pulsación derecha genera un único horizontal 1', () => {
    const keys = { ...emptyKeys(), justPressedRight: true };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.horizontal).toBe(1);
  });

  it('mantener una tecla no repite (ya consumido)', () => {
    const keys = { ...emptyKeys(), justPressedLeft: false };
    const consumed = { horizontal: true, clockwise: false, counterclockwise: false, hardDrop: false };
    const [input] = buildStepInput(keys, consumed);
    expect(input.horizontal).toBe(0);
  });

  it('izquierda y derecha simultáneas generan horizontal 0', () => {
    const keys = {
      ...emptyKeys(),
      justPressedLeft: true,
      justPressedRight: true,
      isDownLeft: true,
      isDownRight: true,
    };
    const [input] = buildStepInput(keys, noConsumed());
    expect(input.horizontal).toBe(0);
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

  it('una acción no se repite en pasos adicionales del mismo frame', () => {
    const keys = { ...emptyKeys(), justPressedLeft: false, justPressedUp: false, justPressedSpace: false };
    const consumed = { horizontal: true, clockwise: true, counterclockwise: false, hardDrop: true };
    const [input] = buildStepInput(keys, consumed);
    expect(input.horizontal).toBe(0);
    expect(input.rotateClockwise).toBe(false);
    expect(input.hardDrop).toBe(false);
  });
});

describe('buildStepInput — rearme entre frames (keydown → consumir → keyup → keydown)', () => {
  // Simula el ciclo completo que la corrección de GameScene permite:
  // Frame 1: keydown → produce acción, consumed se marca true
  // Frame 2: sin keydown (tecla mantenida) → no produce acción (consumed sigue true)
  // Frame 3: keyup → consumed se resetea (simula el reset de GameScene.update())
  // Frame 4: nuevo keydown → vuelve a producir acción

  it('ArrowLeft: keydown → produce -1 → sin keyup → 0 → keyup+reset → nuevo keydown → -1', () => {
    const consumed = noConsumed();
    let keys: KeyState;

    // Frame 1: keydown
    keys = { ...emptyKeys(), justPressedLeft: true };
    const [input1, consumed1] = buildStepInput(keys, consumed);
    Object.assign(consumed, consumed1);
    expect(input1.horizontal).toBe(-1);

    // Frame 2: tecla mantenida (sin JustDown, consumed sigue true del frame anterior)
    keys = { ...emptyKeys(), justPressedLeft: false };
    const [input2, consumed2] = buildStepInput(keys, consumed);
    Object.assign(consumed, consumed2);
    expect(input2.horizontal).toBe(0);

    // Frame 3: keyup — GameScene resetea consumedThisFrame (simulado con fresh consumed)
    keys = { ...emptyKeys(), justPressedLeft: false };
    const freshConsumed = noConsumed();
    const [input3] = buildStepInput(keys, freshConsumed);
    expect(input3.horizontal).toBe(0);

    // Frame 4: nuevo keydown
    keys = { ...emptyKeys(), justPressedLeft: true };
    const [input4, consumed4] = buildStepInput(keys, noConsumed());
    Object.assign(consumed, consumed4);
    expect(input4.horizontal).toBe(-1);
  });

  it('ArrowRight: mismo ciclo vuelve a producir 1', () => {
    const consumed = noConsumed();
    let keys: KeyState;

    keys = { ...emptyKeys(), justPressedRight: true };
    const [i1, c1] = buildStepInput(keys, consumed);
    Object.assign(consumed, c1);
    expect(i1.horizontal).toBe(1);

    keys = { ...emptyKeys(), justPressedRight: false };
    const [i2, c2] = buildStepInput(keys, consumed);
    Object.assign(consumed, c2);
    expect(i2.horizontal).toBe(0);

    keys = { ...emptyKeys(), justPressedRight: true };
    const [i3] = buildStepInput(keys, noConsumed());
    expect(i3.horizontal).toBe(1);
  });

  it('ArrowUp: se consume una vez y vuelve a funcionar tras reset', () => {
    const consumed = noConsumed();
    let keys: KeyState;

    keys = { ...emptyKeys(), justPressedUp: true };
    const [i1, c1] = buildStepInput(keys, consumed);
    Object.assign(consumed, c1);
    expect(i1.rotateClockwise).toBe(true);

    keys = { ...emptyKeys(), justPressedUp: false };
    const [i2, c2] = buildStepInput(keys, consumed);
    Object.assign(consumed, c2);
    expect(i2.rotateClockwise).toBe(false);

    keys = { ...emptyKeys(), justPressedUp: true };
    const [i3] = buildStepInput(keys, noConsumed());
    expect(i3.rotateClockwise).toBe(true);
  });

  it('Z: se consume una vez y vuelve a funcionar tras reset', () => {
    const consumed = noConsumed();
    let keys: KeyState;

    keys = { ...emptyKeys(), justPressedZ: true };
    const [i1, c1] = buildStepInput(keys, consumed);
    Object.assign(consumed, c1);
    expect(i1.rotateCounterclockwise).toBe(true);

    keys = { ...emptyKeys(), justPressedZ: false };
    const [i2, c2] = buildStepInput(keys, consumed);
    Object.assign(consumed, c2);
    expect(i2.rotateCounterclockwise).toBe(false);

    keys = { ...emptyKeys(), justPressedZ: true };
    const [i3] = buildStepInput(keys, noConsumed());
    expect(i3.rotateCounterclockwise).toBe(true);
  });

  it('Space: se consume una vez y vuelve a funcionar tras reset', () => {
    const consumed = noConsumed();
    let keys: KeyState;

    keys = { ...emptyKeys(), justPressedSpace: true };
    const [i1, c1] = buildStepInput(keys, consumed);
    Object.assign(consumed, c1);
    expect(i1.hardDrop).toBe(true);

    keys = { ...emptyKeys(), justPressedSpace: false };
    const [i2, c2] = buildStepInput(keys, consumed);
    Object.assign(consumed, c2);
    expect(i2.hardDrop).toBe(false);

    keys = { ...emptyKeys(), justPressedSpace: true };
    const [i3] = buildStepInput(keys, noConsumed());
    expect(i3.hardDrop).toBe(true);
  });

  it('tres ciclos keydown/keyup generan exactamente tres acciones', () => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const consumed = noConsumed();
      const keys = { ...emptyKeys(), justPressedLeft: true };
      const [input] = buildStepInput(keys, consumed);
      expect(input.horizontal).toBe(-1);
    }
  });

  it('mantener pulsada: sin keyup no genera acciones adicionales entre frames', () => {
    // Simula: por cada frame, consumed se resetea pero JustDown=false (tecla mantenida)
    for (let frame = 0; frame < 5; frame++) {
      const keys = { ...emptyKeys(), justPressedLeft: false, isDownLeft: true };
      const [input] = buildStepInput(keys, noConsumed());
      expect(input.horizontal).toBe(0);
    }
  });

  it('izquierda y derecha simultáneas producen 0; al soltar una, la otra funciona', () => {
    // Frame 1: ambas presionadas simultáneamente
    let keys: KeyState = {
      ...emptyKeys(),
      justPressedLeft: true,
      justPressedRight: true,
      isDownLeft: true,
      isDownRight: true,
    };
    const [i1] = buildStepInput(keys, noConsumed());
    expect(i1.horizontal).toBe(0);

    // Frame 2: se suelta derecha, solo izquierda presionada
    keys = { ...emptyKeys(), justPressedLeft: true, isDownLeft: true, isDownRight: false };
    const [i2] = buildStepInput(keys, noConsumed());
    expect(i2.horizontal).toBe(-1);

    // Frame 3: se suelta izquierda, se presiona derecha
    keys = { ...emptyKeys(), justPressedRight: true, isDownLeft: false, isDownRight: true };
    const [i3] = buildStepInput(keys, noConsumed());
    expect(i3.horizontal).toBe(1);
  });
});
