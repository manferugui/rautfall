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
}>;

export type BattleSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: BattleStatus;
  winner: BattleWinner;
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

  let step = 0;
  let elapsedMs = 0;
  let status: BattleStatus = 'running';
  let winner: BattleWinner = null;
  let eventQueue: BattleEvent[] = [{ type: 'battleStarted', step: 0 }];

  function getSnapshot(): BattleSnapshot {
    return Object.freeze({
      step,
      elapsedMs,
      status,
      winner,
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

      playerOneEngine.step(input.playerOne);
      playerTwoEngine.step(input.playerTwo);

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

      step = 0;
      elapsedMs = 0;
      status = 'running';
      winner = null;
      eventQueue = [{ type: 'battleReset', step: 0 }];

      return getSnapshot();
    },

    getEngine(participant: BattleParticipant): GameEngine {
      return participant === 'playerOne' ? playerOneEngine : playerTwoEngine;
    },
  };
}
