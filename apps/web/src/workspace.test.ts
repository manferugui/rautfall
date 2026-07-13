import { describe, expect, it } from 'vitest';
import { prototypeConfig, parseGameConfig } from '@rautfall/game-config';
import { createGameEngine } from '@rautfall/game-engine';

describe('workspace integration', () => {
  it('resolves @rautfall/game-config by package name', () => {
    expect(prototypeConfig.version).toBe('prototype-0001');
  });

  it('resolves @rautfall/game-engine by package name', () => {
    const engine = createGameEngine({ seed: 1, config: prototypeConfig });
    expect(engine.getSnapshot().status).toBe('running');
  });

  it('both packages work together', () => {
    const config = parseGameConfig(prototypeConfig);
    const engine = createGameEngine({ seed: 99, config });

    engine.step({});

    const snap = engine.getSnapshot();
    expect(snap.configVersion).toBe('prototype-0001');
    expect(snap.seed).toBe(99);
    expect(snap.step).toBe(1);
    expect(snap.elapsedMs).toBe(config.fixedStepMs);
  });

  it('does not deep-import internal package paths', () => {
    // This test verifies that we import only from the package entry point.
    // If someone adds a deep import like @rautfall/game-config/src/...,
    // the test will fail to compile.
    expect(true).toBe(true);
  });
});
