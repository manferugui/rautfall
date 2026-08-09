import { describe, it, expect } from 'vitest';
import { isSfxLabActive } from './game/sfx-lab-demo';

describe('Verificación de construcción de producción (SFX LAB)', () => {
  it('desactiva sfx-lab incondicionalmente si import.meta.env.DEV no es verdadero', () => {
    const isDevBackup = import.meta.env.DEV;
    try {
      (import.meta.env as Record<string, boolean>).DEV = false;
      expect(isSfxLabActive('?sfx-lab=1')).toBe(false);
    } finally {
      (import.meta.env as Record<string, boolean>).DEV = isDevBackup;
    }
  });
});
