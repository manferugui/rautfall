/**
 * Generación de semillas para partidas de producción en Rautfall.
 *
 * Principio:
 * - Una partida de producción genera una semilla uint32 aleatoria al iniciar.
 * - Métrica determinista: misma semilla => misma secuencia de piezas.
 */

/**
 * Genera una semilla uint32 aleatoria (rango 0 a 4.294.967.295) para una nueva partida de producción.
 * Utiliza `crypto.getRandomValues` para garantizar aleatoriedad uniforme.
 */
export function generateMatchSeed(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]!;
}
