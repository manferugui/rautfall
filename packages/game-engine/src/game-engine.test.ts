import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@rautfall/game-config';
import {
  createGameEngine,
  EngineOptionsError,
  type EngineOptions,
} from './index';

// Alternative non-default configuration to prove fixedStepMs is not hardcoded
const alternativeConfig = {
  version: 'test-alt-config',
  fixedStepMs: 25,
  dasMs: 150,
  arrMs: 50,
  gravityCellsPerSecond: 1,
  softDropCellsPerSecond: 20,
  lockDelayMs: 500,
  maxLockResets: 15,
};

function makeValidOptions(
  overrides?: Partial<EngineOptions>,
): EngineOptions {
  return {
    seed: 42,
    config: prototypeConfig,
    ...overrides,
  };
}

describe('createGameEngine', () => {
  it('creates an engine with valid options', () => {
    const engine = createGameEngine(makeValidOptions());
    const snapshot = engine.getSnapshot();

    expect(snapshot.step).toBe(0);
    expect(snapshot.elapsedMs).toBe(0);
    expect(snapshot.status).toBe('running');
    expect(snapshot.seed).toBe(42);
    expect(snapshot.configVersion).toBe('prototype-0001');
  });

  it('accepts seed = 0 as valid', () => {
    const engine = createGameEngine(makeValidOptions({ seed: 0 }));
    expect(engine.getSnapshot().seed).toBe(0);
  });

  it('accepts seed = 4_294_967_295 as valid', () => {
    const engine = createGameEngine(
      makeValidOptions({ seed: 4_294_967_295 }),
    );
    expect(engine.getSnapshot().seed).toBe(4_294_967_295);
  });

  it('rejects a negative seed', () => {
    expect(() => createGameEngine(makeValidOptions({ seed: -1 }))).toThrow(
      EngineOptionsError,
    );
  });

  it('rejects a seed > uint32 max', () => {
    expect(() =>
      createGameEngine(makeValidOptions({ seed: 4_294_967_296 })),
    ).toThrow(EngineOptionsError);
  });

  it('rejects a non-integer seed', () => {
    expect(() =>
      createGameEngine(makeValidOptions({ seed: 1.5 })),
    ).toThrow(EngineOptionsError);
  });

  it('uses config.fixedStepMs for one step', () => {
    const engine = createGameEngine(makeValidOptions());
    engine.step({});
    const snapshot = engine.getSnapshot();

    expect(snapshot.step).toBe(1);
    expect(snapshot.elapsedMs).toBe(prototypeConfig.fixedStepMs);
  });

  it('does not hardcode 10 when using alternative fixedStepMs', () => {
    const engine = createGameEngine({
      seed: 42,
      config: alternativeConfig,
    });

    engine.step({});
    const snapshot = engine.getSnapshot();

    expect(snapshot.elapsedMs).toBe(25);
    expect(snapshot.elapsedMs).not.toBe(10);
  });

  it('accumulates step and elapsedMs on repeated steps', () => {
    const engine = createGameEngine(makeValidOptions());

    engine.step({});
    engine.step({});
    engine.step({});

    const snapshot = engine.getSnapshot();
    expect(snapshot.step).toBe(3);
    expect(snapshot.elapsedMs).toBe(3 * prototypeConfig.fixedStepMs);
  });

  it('snapshot cannot mutate engine internal state', () => {
    const engine = createGameEngine(makeValidOptions());
    const snapshot = engine.getSnapshot();

    // Attempt mutation (types disallow this but we verify at runtime too)
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (snapshot as any).step = 999;
    }).toThrow();

    // Engine state remains unchanged
    expect(engine.getSnapshot().step).toBe(0);
  });

  it('emits engineStarted on creation', () => {
    const engine = createGameEngine(makeValidOptions());
    const events = engine.drainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('engineStarted');
    expect(events[0]?.step).toBe(0);
  });

  it('events are returned in emission order', () => {
    const engine = createGameEngine(makeValidOptions());
    const firstEvents = engine.drainEvents();

    expect(firstEvents).toHaveLength(1);
    expect(firstEvents[0]?.type).toBe('engineStarted');
    expect(firstEvents[0]?.step).toBe(0);

    // After reset, only engineReset should be in the queue
    engine.reset(makeValidOptions());
    const secondEvents = engine.drainEvents();

    expect(secondEvents).toHaveLength(1);
    expect(secondEvents[0]?.type).toBe('engineReset');
    expect(secondEvents[0]?.step).toBe(0);
  });

  it('drainEvents clears the queue', () => {
    const engine = createGameEngine(makeValidOptions());
    const firstDrain = engine.drainEvents();
    expect(firstDrain).toHaveLength(1);

    const secondDrain = engine.drainEvents();
    expect(secondDrain).toHaveLength(0);
  });

  it('second drain with no new events returns empty read-only collection', () => {
    const engine = createGameEngine(makeValidOptions());
    engine.drainEvents(); // consume engineStarted
    engine.step({});

    const events = engine.drainEvents();
    expect(events).toHaveLength(0);
  });

  it('reset restores counters to zero', () => {
    const engine = createGameEngine(makeValidOptions());

    engine.step({});
    engine.step({});

    engine.reset(makeValidOptions({ seed: 100 }));

    const snapshot = engine.getSnapshot();
    expect(snapshot.step).toBe(0);
    expect(snapshot.elapsedMs).toBe(0);
    expect(snapshot.seed).toBe(100);
  });

  it('reset clears stale events and emits exactly one engineReset', () => {
    const engine = createGameEngine(makeValidOptions());
    engine.drainEvents(); // consume engineStarted

    engine.step({});
    engine.step({});
    engine.reset(makeValidOptions());

    const events = engine.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('engineReset');
    expect(events[0]?.step).toBe(0);
  });

  it('reset validates new options', () => {
    const engine = createGameEngine(makeValidOptions());

    expect(() =>
      engine.reset(makeValidOptions({ seed: -5 })),
    ).toThrow(EngineOptionsError);
  });

  it('reset followed by step works correctly', () => {
    const engine = createGameEngine(makeValidOptions());

    engine.step({});
    engine.reset(makeValidOptions());
    engine.step({});

    const snapshot = engine.getSnapshot();
    expect(snapshot.step).toBe(1);
    expect(snapshot.elapsedMs).toBe(prototypeConfig.fixedStepMs);
  });

  it('two consecutive resets are consistent', () => {
    const engine = createGameEngine(makeValidOptions());

    engine.reset(makeValidOptions({ seed: 100 }));
    engine.reset(makeValidOptions({ seed: 200 }));

    expect(engine.getSnapshot().seed).toBe(200);
  });

  it('identical valid inputs produce the same observable result', () => {
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());

    engineA.step({});
    engineA.step({});
    engineB.step({});
    engineB.step({});

    expect(engineA.getSnapshot()).toEqual(engineB.getSnapshot());
  });
});
