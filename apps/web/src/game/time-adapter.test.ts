import { describe, expect, it } from 'vitest';
import { computeSteps } from './time-adapter';

const FIXED_STEP_MS = 10;

describe('computeSteps — adaptación temporal', () => {
  it('delta menor que fixedStepMs no ejecuta pasos', () => {
    const [steps, acc] = computeSteps(0, 5, FIXED_STEP_MS);
    expect(steps).toBe(0);
    expect(acc).toBe(5);
  });

  it('delta suficiente ejecuta un paso', () => {
    const [steps, acc] = computeSteps(0, 10, FIXED_STEP_MS);
    expect(steps).toBe(1);
    expect(acc).toBe(0);
  });

  it('un frame puede ejecutar varios pasos', () => {
    const [steps, acc] = computeSteps(0, 25, FIXED_STEP_MS);
    expect(steps).toBe(2);
    expect(acc).toBe(5);
  });

  it('el delta efectivo queda limitado a 250 ms', () => {
    const [steps, acc] = computeSteps(0, 500, FIXED_STEP_MS);
    expect(steps).toBe(25);
    expect(acc).toBe(0);
  });

  it('nunca se ejecutan más de 25 pasos', () => {
    const [steps, acc] = computeSteps(0, 3000, FIXED_STEP_MS);
    expect(steps).toBe(25);
    expect(acc).toBe(0);
  });

  it('el exceso se descarta tras alcanzar el límite de pasos', () => {
    const [steps, acc] = computeSteps(0, 1000, FIXED_STEP_MS);
    expect(steps).toBe(25);
    expect(acc).toBe(0);
  });

  it('no queda deuda temporal indefinida tras alcanzar el límite', () => {
    // Primer frame con delta grande
    const [steps1, acc1] = computeSteps(0, 300, FIXED_STEP_MS);
    expect(steps1).toBe(25);
    expect(acc1).toBe(0); // cap 250, 25*10=250, 250-250=0

    // Segundo frame sin nuevo delta: acumulador parte de 0
    const [steps2, acc2] = computeSteps(acc1, 0, FIXED_STEP_MS);
    expect(steps2).toBe(0);
    expect(acc2).toBe(0);
  });

  it('el cálculo usa fixedStepMs recibido y no un 10 hardcodeado', () => {
    const [steps, acc] = computeSteps(0, 50, 25);
    expect(steps).toBe(2);
    expect(acc).toBe(0);
  });

  it('el acumulador arrastra residuo de frames anteriores', () => {
    const [s1, a1] = computeSteps(0, 8, FIXED_STEP_MS);
    expect(s1).toBe(0);
    expect(a1).toBe(8);

    const [s2, a2] = computeSteps(a1, 8, FIXED_STEP_MS);
    expect(s2).toBe(1);
    expect(a2).toBe(6);
  });
});
