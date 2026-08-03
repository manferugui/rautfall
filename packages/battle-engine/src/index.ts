import type { GameConfig } from '@rautfall/game-config';
import {
  createGameEngine,
  validateStepInput,
  type EngineEvent,
  type EngineSnapshot,
  type GameEngine,
  type SabotageType,
  type StepInput,
  type EngineInitialState,
} from '@rautfall/game-engine';

export type BattleParticipant = 'playerOne' | 'playerTwo';

export {
  createDeterministicBot,
  isActivePieceFullyVisible,
  isNeutralPlacementInput,
  normalizeBotConfig,
  BOT_REACTION_DELAY_STEPS,
  BOT_ACTION_INTERVAL_STEPS,
  BOT_HARD_DROP_DELAY_STEPS,
  type DeterministicBot,
  type DeterministicBotDiagnostic,
} from './bot/deterministic-bot';
export {
  DEFAULT_BOT_HEURISTIC_WEIGHTS,
  type BoardMetrics,
  evaluateBoardMetrics,
  scoreBoardMetrics,
} from './bot/board-evaluator';
export {
  searchPlacements,
  BOT_MAX_SEARCH_NODES,
  type SearchMetrics,
  type SearchResult,
} from './bot/placement-search';
export {
  evaluateSabotageDecision,
  getOpponentMaxHeight,
  getOpponentPieceWallDistance,
  isOpponentPieceFullyVisible,
  normalizeBotSabotageConfig,
} from './bot/sabotage-policy';
export {
  DEFAULT_BOT_SABOTAGE_CONFIG,
  type BotAction,
  type BotConfig,
  type BotExecutionPhase,
  type BotHeuristicWeights,
  type BotPlan,
  type BotPlanDiagnostic,
  type BotSabotageConfig,
  type PlacementCandidate,
  type SabotageDecision,
  type SabotageDecisionReason,
  type SabotagePolicyInput,
} from './bot/types';

export type SuddenDeathPhase =
  | 'inactive'
  | 'warning'
  | 'phase1'
  | 'phase2'
  | 'phase3';

export type SuddenDeathSnapshot = Readonly<{
  phase: SuddenDeathPhase;
  warningRemainingMs: number;
  activeElapsedMs: number;
  gravityMultiplier: number;
  energyMultiplier: number;
}>;

export function computeSuddenDeath(elapsedMs: number): SuddenDeathSnapshot {
  if (elapsedMs < 285_000) {
    return Object.freeze({
      phase: 'inactive',
      warningRemainingMs: 0,
      activeElapsedMs: 0,
      gravityMultiplier: 1.0,
      energyMultiplier: 1.0,
    });
  } else if (elapsedMs < 300_000) {
    return Object.freeze({
      phase: 'warning',
      warningRemainingMs: 300_000 - elapsedMs,
      activeElapsedMs: 0,
      gravityMultiplier: 1.0,
      energyMultiplier: 1.0,
    });
  } else if (elapsedMs < 330_000) {
    return Object.freeze({
      phase: 'phase1',
      warningRemainingMs: 0,
      activeElapsedMs: elapsedMs - 300_000,
      gravityMultiplier: 1.15,
      energyMultiplier: 1.20,
    });
  } else if (elapsedMs < 360_000) {
    return Object.freeze({
      phase: 'phase2',
      warningRemainingMs: 0,
      activeElapsedMs: elapsedMs - 300_000,
      gravityMultiplier: 1.30,
      energyMultiplier: 1.20,
    });
  } else {
    return Object.freeze({
      phase: 'phase3',
      warningRemainingMs: 0,
      activeElapsedMs: elapsedMs - 300_000,
      gravityMultiplier: 1.50,
      energyMultiplier: 1.20,
    });
  }
}

export type BattleStatus =
  | 'running'
  | 'playerOneWon'
  | 'playerTwoWon'
  | 'draw';

export type BattleWinner =
  | 'playerOne'
  | 'playerTwo'
  | 'draw'
  | null;

export type BattleStepInput = Readonly<{
  playerOne: StepInput;
  playerTwo: StepInput;
}>;

export type BattleSessionOptions = Readonly<{
  seed: number;
  config: GameConfig;
  playerOneInitialState?: EngineInitialState;
  playerTwoInitialState?: EngineInitialState;
  initialElapsedMs?: number;
}>;

export type BattleSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: BattleStatus;
  winner: BattleWinner;
  suddenDeath: SuddenDeathSnapshot;
  playerOne: EngineSnapshot;
  playerTwo: EngineSnapshot;
}>;

export type BattleEvent =
  | Readonly<{
      type: 'battleStarted';
      step: number;
    }>
  | Readonly<{
      type: 'battleReset';
      step: number;
    }>
  | Readonly<{
      type: 'participantEvent';
      step: number;
      participant: BattleParticipant;
      event: EngineEvent;
    }>
  | Readonly<{
      type: 'sabotageRouted';
      step: number;
      source: BattleParticipant;
      target: BattleParticipant;
      sabotage: SabotageType;
    }>
  | Readonly<{
      type: 'battleEnded';
      step: number;
      winner: Exclude<BattleWinner, null>;
    }>
  | Readonly<{
      type: 'suddenDeathWarning';
      step: number;
      warningRemainingMs: number;
    }>
  | Readonly<{
      type: 'suddenDeathStarted';
      step: number;
    }>
  | Readonly<{
      type: 'suddenDeathPhaseChanged';
      step: number;
      phase: SuddenDeathPhase;
      gravityMultiplier: number;
    }>;

export type BattleStepErrorCode =
  | 'INVALID_BATTLE_INPUT'
  | 'BATTLE_NOT_RUNNING';

export class BattleStepError extends Error {
  readonly code: BattleStepErrorCode;

  constructor(code: BattleStepErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'BattleStepError';
    this.code = code;
  }
}

export interface BattleSession {
  step(input: BattleStepInput): BattleSnapshot;
  getSnapshot(): BattleSnapshot;
  drainEvents(): readonly BattleEvent[];
  reset(): BattleSnapshot;
  getEngine(participant: BattleParticipant): GameEngine;
}

export function createBattleSession(options: BattleSessionOptions): BattleSession {
  if (options.initialElapsedMs !== undefined) {
    if (
      typeof options.initialElapsedMs !== 'number' ||
      options.initialElapsedMs < 0 ||
      !Number.isFinite(options.initialElapsedMs)
    ) {
      throw new Error('initialElapsedMs must be a non-negative finite number');
    }
  }

  const playerOneEngine: GameEngine = createGameEngine(
    { seed: options.seed, config: options.config },
    options.playerOneInitialState,
  );
  const playerTwoEngine: GameEngine = createGameEngine(
    { seed: options.seed, config: options.config },
    options.playerTwoInitialState,
  );

  playerOneEngine.drainEvents();
  playerTwoEngine.drainEvents();

  let step = options.initialElapsedMs !== undefined ? Math.floor(options.initialElapsedMs / options.config.fixedStepMs) : 0;
  let elapsedMs = options.initialElapsedMs ?? 0;
  let status: BattleStatus = 'running';
  let winner: BattleWinner = null;
  let lastSuddenDeathPhase: SuddenDeathPhase = computeSuddenDeath(elapsedMs).phase;
  let eventQueue: BattleEvent[] = [{ type: 'battleStarted', step }];

  function getSnapshot(): BattleSnapshot {
    return Object.freeze({
      step,
      elapsedMs,
      status,
      winner,
      suddenDeath: computeSuddenDeath(elapsedMs),
      playerOne: playerOneEngine.getSnapshot(),
      playerTwo: playerTwoEngine.getSnapshot(),
    });
  }

  return {
    step(input: BattleStepInput): BattleSnapshot {
      if (status !== 'running') {
        throw new BattleStepError('BATTLE_NOT_RUNNING', 'Battle is not running');
      }

      if (typeof input !== 'object' || input === null || !('playerOne' in input) || !('playerTwo' in input)) {
        throw new BattleStepError('INVALID_BATTLE_INPUT', 'BattleStepInput must contain playerOne and playerTwo');
      }

      try {
        validateStepInput(input.playerOne);
      } catch (err) {
        throw new BattleStepError('INVALID_BATTLE_INPUT', 'Invalid input for playerOne', err);
      }

      try {
        validateStepInput(input.playerTwo);
      } catch (err) {
        throw new BattleStepError('INVALID_BATTLE_INPUT', 'Invalid input for playerTwo', err);
      }

      step++;
      elapsedMs += options.config.fixedStepMs;

      const suddenDeath = computeSuddenDeath(elapsedMs);
      if (suddenDeath.phase !== lastSuddenDeathPhase) {
        if (suddenDeath.phase === 'warning') {
          eventQueue.push({
            type: 'suddenDeathWarning',
            step,
            warningRemainingMs: suddenDeath.warningRemainingMs,
          });
        } else if (suddenDeath.phase === 'phase1') {
          eventQueue.push({
            type: 'suddenDeathStarted',
            step,
          });
        } else if (suddenDeath.phase === 'phase2' || suddenDeath.phase === 'phase3') {
          eventQueue.push({
            type: 'suddenDeathPhaseChanged',
            step,
            phase: suddenDeath.phase,
            gravityMultiplier: suddenDeath.gravityMultiplier,
          });
        }
        lastSuddenDeathPhase = suddenDeath.phase;
      }

      const modifiers = {
        gravityMultiplier: suddenDeath.gravityMultiplier,
        energyMultiplier: suddenDeath.energyMultiplier,
      };

      playerOneEngine.step({ ...input.playerOne, modifiers });
      playerTwoEngine.step({ ...input.playerTwo, modifiers });

      const p1Events = playerOneEngine.drainEvents();
      for (const evt of p1Events) {
        eventQueue.push({
          type: 'participantEvent',
          step,
          participant: 'playerOne',
          event: evt,
        });
      }

      const p2Events = playerTwoEngine.drainEvents();
      for (const evt of p2Events) {
        eventQueue.push({
          type: 'participantEvent',
          step,
          participant: 'playerTwo',
          event: evt,
        });
      }

      const p1Snap = playerOneEngine.getSnapshot();
      const p2Snap = playerTwoEngine.getSnapshot();
      const p1GameOver = p1Snap.status === 'gameOver';
      const p2GameOver = p2Snap.status === 'gameOver';

      if (p1GameOver || p2GameOver) {
        if (p1GameOver && p2GameOver) {
          status = 'draw';
          winner = 'draw';
        } else if (p1GameOver) {
          status = 'playerTwoWon';
          winner = 'playerTwo';
        } else {
          status = 'playerOneWon';
          winner = 'playerOne';
        }

        eventQueue.push({
          type: 'battleEnded',
          step,
          winner: winner!,
        });

        return getSnapshot();
      }

      // Routing de sabotajes
      const p1Sabotages = p1Events.filter((e) => e.type === 'sabotageTriggered') as Extract<
        EngineEvent,
        { type: 'sabotageTriggered' }
      >[];
      for (const sabEvt of p1Sabotages) {
        playerTwoEngine.receiveSabotage(sabEvt.sabotage);
        eventQueue.push({
          type: 'sabotageRouted',
          step,
          source: 'playerOne',
          target: 'playerTwo',
          sabotage: sabEvt.sabotage,
        });
        const newP2Events = playerTwoEngine.drainEvents();
        for (const evt of newP2Events) {
          eventQueue.push({
            type: 'participantEvent',
            step,
            participant: 'playerTwo',
            event: evt,
          });
        }
      }

      const p2Sabotages = p2Events.filter((e) => e.type === 'sabotageTriggered') as Extract<
        EngineEvent,
        { type: 'sabotageTriggered' }
      >[];
      for (const sabEvt of p2Sabotages) {
        playerOneEngine.receiveSabotage(sabEvt.sabotage);
        eventQueue.push({
          type: 'sabotageRouted',
          step,
          source: 'playerTwo',
          target: 'playerOne',
          sabotage: sabEvt.sabotage,
        });
        const newP1Events = playerOneEngine.drainEvents();
        for (const evt of newP1Events) {
          eventQueue.push({
            type: 'participantEvent',
            step,
            participant: 'playerOne',
            event: evt,
          });
        }
      }

      return getSnapshot();
    },

    getSnapshot,

    drainEvents(): readonly BattleEvent[] {
      const events = [...eventQueue];
      eventQueue = [];
      return Object.freeze(events);
    },

    reset(): BattleSnapshot {
      playerOneEngine.reset({ seed: options.seed, config: options.config }, options.playerOneInitialState);
      playerTwoEngine.reset({ seed: options.seed, config: options.config }, options.playerTwoInitialState);
      playerOneEngine.drainEvents();
      playerTwoEngine.drainEvents();

      step = options.initialElapsedMs !== undefined ? Math.floor(options.initialElapsedMs / options.config.fixedStepMs) : 0;
      elapsedMs = options.initialElapsedMs ?? 0;
      status = 'running';
      winner = null;
      lastSuddenDeathPhase = computeSuddenDeath(elapsedMs).phase;
      eventQueue = [{ type: 'battleReset', step }];

      return getSnapshot();
    },

    getEngine(participant: BattleParticipant): GameEngine {
      return participant === 'playerOne' ? playerOneEngine : playerTwoEngine;
    },
  };
}
