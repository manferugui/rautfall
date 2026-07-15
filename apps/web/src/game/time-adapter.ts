/**
 * Adaptador de tiempo real a pasos lógicos fijos.
 *
 * Acumula delta de frame (limitado a 250 ms) y ejecuta tantos pasos
 * lógicos como quepan en el acumulador, sin superar 25 pasos por frame.
 * El exceso que no pueda procesarse se descarta (no arrastra deuda).
 */

export const MAX_DELTA_MS = 250;
export const MAX_STEPS_PER_FRAME = 25;

/**
 * Función pura: dado un acumulador previo, el delta real del frame (ms) y
 * el fixedStepMs, devuelve cuántos pasos lógicos ejecutar este frame y el
 * nuevo valor del acumulador tras descontarlos.
 *
 * @param accumulator  acumulador previo en ms (puede arrastrar residuo de frames anteriores)
 * @param deltaMs      delta real del frame (sin limitar)
 * @param fixedStepMs  duración de un paso lógico en ms
 * @returns [pasosAEjecutar, nuevoAcumulador]
 */
export function computeSteps(
  accumulator: number,
  deltaMs: number,
  fixedStepMs: number,
): [steps: number, newAccumulator: number] {
  const cappedDelta = Math.min(deltaMs, MAX_DELTA_MS);
  let acc = accumulator + cappedDelta;

  const steps = Math.min(Math.floor(acc / fixedStepMs), MAX_STEPS_PER_FRAME);
  acc -= steps * fixedStepMs;
  if (acc < 0) acc = 0;

  return [steps, acc];
}
