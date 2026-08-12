import { describe, expect, it, vi } from 'vitest';
import { generateMatchSeed } from './seed';

describe('generateMatchSeed — generación de semillas uint32 para partidas', () => {
  it('devuelve un entero uint32 válido (rango 0 a 4.294.967.295)', () => {
    const seed = generateMatchSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(4_294_967_295);
  });

  it('utiliza crypto.getRandomValues con un Uint32Array(1) y devuelve exactamente el valor generado', () => {
    const EXPECTED_SEED = 2_718_281_828;
    const getRandomValuesSpy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (array instanceof Uint32Array) {
        expect(array.length).toBe(1);
        array[0] = EXPECTED_SEED;
      }
      return array;
    });

    const seed = generateMatchSeed();

    expect(getRandomValuesSpy).toHaveBeenCalledTimes(1);
    expect(seed).toBe(EXPECTED_SEED);

    getRandomValuesSpy.mockRestore();
  });
});
