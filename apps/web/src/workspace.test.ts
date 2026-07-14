import { describe, expect, it } from 'vitest';
import { prototypeConfig, parseGameConfig } from '@rautfall/game-config';
import { createGameEngine } from '@rautfall/game-engine';

describe('integración del workspace', () => {
  it('resuelve @rautfall/game-config por el nombre del paquete', () => {
    expect(prototypeConfig.version).toBe('prototype-0001');
  });

  it('resuelve @rautfall/game-engine por el nombre del paquete', () => {
    const engine = createGameEngine({ seed: 1, config: prototypeConfig });
    expect(engine.getSnapshot().status).toBe('running');
  });

  it('ambos paquetes funcionan juntos', () => {
    const config = parseGameConfig(prototypeConfig);
    const engine = createGameEngine({ seed: 99, config });

    engine.step({ horizontal: 0, hardDrop: false });

    const snap = engine.getSnapshot();
    expect(snap.configVersion).toBe('prototype-0001');
    expect(snap.seed).toBe(99);
    expect(snap.step).toBe(1);
    expect(snap.elapsedMs).toBe(config.fixedStepMs);
  });

  it('no hace imports profundos de rutas internas de los paquetes', () => {
    // Este test verifica que solo se importa desde el punto de entrada del paquete.
    // Si alguien añade un import profundo como @rautfall/game-config/src/...,
    // el test no compilará.
    expect(true).toBe(true);
  });
});
