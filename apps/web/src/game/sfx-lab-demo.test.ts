import { describe, it, expect } from 'vitest';
import { isSfxLabActive } from './sfx-lab-demo';

describe('sfx-lab-demo', () => {
  it('activa el laboratorio solo en DEV con ?sfx-lab=1', () => {
    expect(isSfxLabActive('?sfx-lab=1')).toBe(true);
    expect(isSfxLabActive('?sfx-lab=0')).toBe(false);
    expect(isSfxLabActive('')).toBe(false);
    expect(isSfxLabActive('?battle-demo=1')).toBe(false);
  });
});
