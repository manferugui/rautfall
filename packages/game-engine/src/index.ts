import { type GameConfig, parseGameConfig } from '@rautfall/game-config';

// ── Public types ────────────────────────────────────────────────────────

export type EngineStatus = 'running';

export type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number };

export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
}>;

export type EngineStepInput = Record<string, never>;

export type EngineOptions = {
  seed: number;
  config: GameConfig;
};

export type GameEngine = {
  step(input: EngineStepInput): void;
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  reset(options: EngineOptions): void;
};

// ── Error type ──────────────────────────────────────────────────────────

export class EngineOptionsError extends Error {
  readonly code = 'INVALID_ENGINE_OPTIONS';

  constructor(message: string) {
    super(message);
    this.name = 'EngineOptionsError';
  }
}

// ── Constants ───────────────────────────────────────────────────────────

const UINT32_MAX = 4_294_967_295;

// ── Factory ─────────────────────────────────────────────────────────────

export function createGameEngine(options: EngineOptions): GameEngine {
  validateSeed(options.seed);
  parseGameConfig(options.config);

  let currentStep = 0;
  let currentElapsedMs = 0;
  let currentSeed = options.seed;
  let currentConfig = options.config;
  const eventQueue: GameEvent[] = [{ type: 'engineStarted', step: 0 }];

  return {
    step(_input: EngineStepInput): void {
      void _input;
      currentStep++;
      currentElapsedMs += currentConfig.fixedStepMs;
    },

    getSnapshot(): EngineSnapshot {
      return Object.freeze({
        step: currentStep,
        elapsedMs: currentElapsedMs,
        status: 'running',
        seed: currentSeed,
        configVersion: currentConfig.version,
      });
    },

    drainEvents(): readonly GameEvent[] {
      const events = eventQueue.slice();
      eventQueue.length = 0;
      return Object.freeze(events);
    },

    reset(options: EngineOptions): void {
      validateSeed(options.seed);
      parseGameConfig(options.config);

      currentStep = 0;
      currentElapsedMs = 0;
      currentSeed = options.seed;
      currentConfig = options.config;
      eventQueue.length = 0;
      eventQueue.push({ type: 'engineReset', step: 0 });
    },
  };
}

// ── Private helpers ─────────────────────────────────────────────────────

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed)) {
    throw new EngineOptionsError(`Seed must be an integer, got ${seed}`);
  }

  if (seed < 0) {
    throw new EngineOptionsError(`Seed must be >= 0, got ${seed}`);
  }

  if (seed > UINT32_MAX) {
    throw new EngineOptionsError(
      `Seed must be <= ${UINT32_MAX}, got ${seed}`,
    );
  }
}
