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
  DEFAULT_BOT_PROFILE_ID,
  BOT_PROFILES,
  normalizeBotProfileId,
  getBotProfileConfig,
} from './bot/profiles';
export {
  DEFAULT_BOT_SABOTAGE_CONFIG,
  type BotAction,
  type BotConfig,
  type BotExecutionPhase,
  type BotHeuristicWeights,
  type BotPlan,
  type BotPlanDiagnostic,
  type BotProfileId,
  type BotSabotageConfig,
  type PlacementCandidate,
  type SabotageDecision,
  type SabotageDecisionReason,
  type SabotagePolicyInput,
} from './bot/types';

export const WARNING_DURATION_MS = 750;
export const IMMUNITY_DURATION_MS = 4000;
export const INTERFERENCIA_DURATION_MS = 5000;

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

export type BattleWarningSnapshot = Readonly<{
  sabotage: SabotageType;
  remainingMs: number;
}>;

export type BattleImmunitySnapshot = Readonly<{
  sabotage: SabotageType;
  remainingMs: number;
}>;

export type BattleEffectSnapshot = Readonly<{
  type: 'interferencia';
  remainingMs: number;
}>;

export type BattleParticipantStateSnapshot = Readonly<{
  warnings: readonly BattleWarningSnapshot[];
  immunities: readonly BattleImmunitySnapshot[];
  activeEffects: readonly BattleEffectSnapshot[];
  isInterfered: boolean;
  interferenciaRemainingMs: number;
}>;

export type BattleSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: BattleStatus;
  winner: BattleWinner;
  suddenDeath: SuddenDeathSnapshot;
  playerOne: EngineSnapshot;
  playerTwo: EngineSnapshot;
  playerOneState: BattleParticipantStateSnapshot;
  playerTwoState: BattleParticipantStateSnapshot;
}>;

export type SabotageBlockedReason = 'immunity' | 'alreadyActive' | 'warningPending';

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
      type: 'warningStarted';
      step: number;
      participant: BattleParticipant;
      sabotage: SabotageType;
      durationMs: number;
    }>
  | Readonly<{
      type: 'warningExpired';
      step: number;
      participant: BattleParticipant;
      sabotage: SabotageType;
    }>
  | Readonly<{
      type: 'sabotageBlocked';
      step: number;
      target: BattleParticipant;
      source: BattleParticipant;
      sabotage: SabotageType;
      reason: SabotageBlockedReason;
    }>
  | Readonly<{
      type: 'immunityStarted';
      step: number;
      participant: BattleParticipant;
      sabotage: SabotageType;
      durationMs: number;
    }>
  | Readonly<{
      type: 'immunityExpired';
      step: number;
      participant: BattleParticipant;
      sabotage: SabotageType;
    }>
  | Readonly<{
      type: 'interferenciaStarted';
      step: number;
      participant: BattleParticipant;
      durationMs: number;
    }>
  | Readonly<{
      type: 'interferenciaExpired';
      step: number;
      participant: BattleParticipant;
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
  getPerceivedOpponentSnapshot(participant: BattleParticipant): EngineSnapshot;
}

type InternalParticipantState = {
  warnings: { sabotage: SabotageType; remainingMs: number; source: BattleParticipant; createdStep: number }[];
  immunities: { sabotage: SabotageType; remainingMs: number; createdStep: number }[];
  activeEffects: { type: 'interferencia'; remainingMs: number; createdStep: number }[];
  perceivedOpponentSnapshot: EngineSnapshot;
};

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

  const p1State: InternalParticipantState = {
    warnings: [],
    immunities: [],
    activeEffects: [],
    perceivedOpponentSnapshot: playerTwoEngine.getSnapshot(),
  };

  const p2State: InternalParticipantState = {
    warnings: [],
    immunities: [],
    activeEffects: [],
    perceivedOpponentSnapshot: playerOneEngine.getSnapshot(),
  };

  function buildParticipantStateSnapshot(
    pState: InternalParticipantState,
  ): BattleParticipantStateSnapshot {
    const warnings: BattleWarningSnapshot[] = pState.warnings.map((w) =>
      Object.freeze({ sabotage: w.sabotage, remainingMs: w.remainingMs }),
    );
    const immunities: BattleImmunitySnapshot[] = pState.immunities.map((imm) =>
      Object.freeze({ sabotage: imm.sabotage, remainingMs: imm.remainingMs }),
    );
    const activeEffects: BattleEffectSnapshot[] = pState.activeEffects.map((eff) =>
      Object.freeze({ type: eff.type, remainingMs: eff.remainingMs }),
    );
    const interferencia = pState.activeEffects.find((e) => e.type === 'interferencia');
    const isInterfered = interferencia !== undefined;
    const interferenciaRemainingMs = interferencia ? interferencia.remainingMs : 0;

    return Object.freeze({
      warnings: Object.freeze(warnings),
      immunities: Object.freeze(immunities),
      activeEffects: Object.freeze(activeEffects),
      isInterfered,
      interferenciaRemainingMs,
    });
  }

  function getSnapshot(): BattleSnapshot {
    return Object.freeze({
      step,
      elapsedMs,
      status,
      winner,
      suddenDeath: computeSuddenDeath(elapsedMs),
      playerOne: playerOneEngine.getSnapshot(),
      playerTwo: playerTwoEngine.getSnapshot(),
      playerOneState: buildParticipantStateSnapshot(p1State),
      playerTwoState: buildParticipantStateSnapshot(p2State),
    });
  }

  function getPerceivedOpponentSnapshot(participant: BattleParticipant): EngineSnapshot {
    return participant === 'playerOne'
      ? p1State.perceivedOpponentSnapshot
      : p2State.perceivedOpponentSnapshot;
  }

  return {
    step(input: BattleStepInput): BattleSnapshot {
      if (status !== 'running') {
        throw new BattleStepError('BATTLE_NOT_RUNNING', 'Battle is not running');
      }

      if (typeof input !== 'object' || input === null || !('playerOne' in input) || !('playerTwo' in input)) {
        throw new BattleStepError('INVALID_BATTLE_INPUT', 'BattleStepInput must contain playerOne and playerTwo');
      }

      // 1. Pre-validación de entradas
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

      // 2. Avance temporal del paso
      step++;
      elapsedMs += options.config.fixedStepMs;

      // 3. Muerte súbita
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

      // 4. Actualización de temporizadores existentes (creados en steps ANTERIORES)
      const participants: BattleParticipant[] = ['playerOne', 'playerTwo'];
      for (const p of participants) {
        const pState = p === 'playerOne' ? p1State : p2State;

        // 4a. Efectos de Interferencia activos
        for (let i = pState.activeEffects.length - 1; i >= 0; i--) {
          const eff = pState.activeEffects[i]!;
          if (eff.createdStep === step) continue; // Creado en este paso, no pierde tiempo
          eff.remainingMs -= options.config.fixedStepMs;
          if (eff.remainingMs <= 0) {
            pState.activeEffects.splice(i, 1);
            eventQueue.push({ type: 'interferenciaExpired', step, participant: p });

            // Iniciar Inmunidad post-efecto para interferencia (4000 ms, creado en este step)
            const existingImm = pState.immunities.find((imm) => imm.sabotage === 'interferencia');
            if (existingImm) {
              existingImm.remainingMs = IMMUNITY_DURATION_MS;
              existingImm.createdStep = step;
            } else {
              pState.immunities.push({ sabotage: 'interferencia', remainingMs: IMMUNITY_DURATION_MS, createdStep: step });
            }
            eventQueue.push({
              type: 'immunityStarted',
              step,
              participant: p,
              sabotage: 'interferencia',
              durationMs: IMMUNITY_DURATION_MS,
            });
          }
        }

        // 4b. Inmunidades activas
        for (let i = pState.immunities.length - 1; i >= 0; i--) {
          const imm = pState.immunities[i]!;
          if (imm.createdStep === step) continue; // Creada en este paso, no pierde tiempo
          imm.remainingMs -= options.config.fixedStepMs;
          if (imm.remainingMs <= 0) {
            pState.immunities.splice(i, 1);
            eventQueue.push({ type: 'immunityExpired', step, participant: p, sabotage: imm.sabotage });
          }
        }

        // 4c. Warnings activos
        for (let i = pState.warnings.length - 1; i >= 0; i--) {
          const warn = pState.warnings[i]!;
          if (warn.createdStep === step) continue; // Creado en este paso, no pierde tiempo
          warn.remainingMs -= options.config.fixedStepMs;
          if (warn.remainingMs <= 0) {
            pState.warnings.splice(i, 1);
            eventQueue.push({ type: 'warningExpired', step, participant: p, sabotage: warn.sabotage });

            // Verificar si el objetivo tiene inmunidad activa para este sabotaje
            const isImmune = pState.immunities.some((imm) => imm.sabotage === warn.sabotage);
            if (isImmune) {
              eventQueue.push({
                type: 'sabotageBlocked',
                step,
                target: p,
                source: warn.source,
                sabotage: warn.sabotage,
                reason: 'immunity',
              });
            } else {
              // Activar efecto
              if (warn.sabotage === 'sobrecarga' || warn.sabotage === 'polaridad') {
                const selfEngine = p === 'playerOne' ? playerOneEngine : playerTwoEngine;
                selfEngine.receiveSabotage(warn.sabotage);
              } else if (warn.sabotage === 'interferencia') {
                // Al activar Interferencia: pState.perceivedOpponentSnapshot conserva exactamente la última percepción previa
                pState.activeEffects.push({ type: 'interferencia', remainingMs: INTERFERENCIA_DURATION_MS, createdStep: step });
                eventQueue.push({
                  type: 'interferenciaStarted',
                  step,
                  participant: p,
                  durationMs: INTERFERENCIA_DURATION_MS,
                });
              }
            }
          }
        }
      }

      // 5. Ejecución de los motores de juego individuales
      playerOneEngine.step({ ...input.playerOne, modifiers });
      playerTwoEngine.step({ ...input.playerTwo, modifiers });

      // 6. Drenaje de eventos de los motores
      for (const p of participants) {
        const engine = p === 'playerOne' ? playerOneEngine : playerTwoEngine;
        const pState = p === 'playerOne' ? p1State : p2State;
        const events = engine.drainEvents();

        for (const evt of events) {
          eventQueue.push({
            type: 'participantEvent',
            step,
            participant: p,
            event: evt,
          });

          // Detectar expiración de sobrecarga/polaridad en el motor para iniciar inmunidad post-efecto
          if (evt.type === 'effectExpired') {
            const existingImm = pState.immunities.find((imm) => imm.sabotage === evt.effect);
            if (existingImm) {
              existingImm.remainingMs = IMMUNITY_DURATION_MS;
              existingImm.createdStep = step;
            } else {
              pState.immunities.push({ sabotage: evt.effect, remainingMs: IMMUNITY_DURATION_MS, createdStep: step });
            }
            eventQueue.push({
              type: 'immunityStarted',
              step,
              participant: p,
              sabotage: evt.effect,
              durationMs: IMMUNITY_DURATION_MS,
            });
          }
        }
      }

      // 7. Verificación de terminalidad
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

        // Actualizar percepción final antes de salir si no están interferidos
        if (!p1State.activeEffects.some((e) => e.type === 'interferencia')) {
          p1State.perceivedOpponentSnapshot = playerTwoEngine.getSnapshot();
        }
        if (!p2State.activeEffects.some((e) => e.type === 'interferencia')) {
          p2State.perceivedOpponentSnapshot = playerOneEngine.getSnapshot();
        }

        return getSnapshot();
      }

      // 8. Procesamiento y ruteo de nuevos sabotajes disparados en este step
      for (const p of participants) {
        const oppParticipant = p === 'playerOne' ? 'playerTwo' : 'playerOne';
        const oppState = oppParticipant === 'playerOne' ? p1State : p2State;
        const oppEngine = oppParticipant === 'playerOne' ? playerOneEngine : playerTwoEngine;

        // Drenar eventos de sabotaje disparados por p en ESTE step exclusivamente
        const participantEvts = eventQueue.filter(
          (e) => e.type === 'participantEvent' && e.participant === p && e.step === step,
        ) as Extract<BattleEvent, { type: 'participantEvent' }>[];
        const sabotageEvts = participantEvts
          .map((pe) => pe.event)
          .filter((e) => e.type === 'sabotageTriggered') as Extract<EngineEvent, { type: 'sabotageTriggered' }>[];

        for (const sabEvt of sabotageEvts) {
          eventQueue.push({
            type: 'sabotageRouted',
            step,
            source: p,
            target: oppParticipant,
            sabotage: sabEvt.sabotage,
          });

          if (sabEvt.sabotage === 'residuos') {
            // Residuos es una modificación física inmediata: no participa en warning ni inmunidad
            oppEngine.receiveSabotage('residuos');
            const newEvts = oppEngine.drainEvents();
            for (const evt of newEvts) {
              eventQueue.push({
                type: 'participantEvent',
                step,
                participant: oppParticipant,
                event: evt,
              });
            }
          } else {
            // Sabotajes temporales (sobrecarga, polaridad, interferencia): aplicar política de bloqueo
            // 1. ¿Tiene el objetivo inmunidad activa para este sabotaje?
            const isImmune = oppState.immunities.some((imm) => imm.sabotage === sabEvt.sabotage);
            if (isImmune) {
              eventQueue.push({
                type: 'sabotageBlocked',
                step,
                target: oppParticipant,
                source: p,
                sabotage: sabEvt.sabotage,
                reason: 'immunity',
              });
              continue;
            }

            // 2. ¿Tiene el objetivo un efecto activo para este sabotaje?
            const isAlreadyActive =
              sabEvt.sabotage === 'interferencia'
                ? oppState.activeEffects.some((e) => e.type === 'interferencia')
                : oppEngine.getSnapshot().activeEffects.some((e) => e.type === sabEvt.sabotage);

            if (isAlreadyActive) {
              eventQueue.push({
                type: 'sabotageBlocked',
                step,
                target: oppParticipant,
                source: p,
                sabotage: sabEvt.sabotage,
                reason: 'alreadyActive',
              });
              continue;
            }

            // 3. ¿Tiene el objetivo un warning pendiente para este sabotaje?
            const hasWarningPending = oppState.warnings.some((w) => w.sabotage === sabEvt.sabotage);
            if (hasWarningPending) {
              eventQueue.push({
                type: 'sabotageBlocked',
                step,
                target: oppParticipant,
                source: p,
                sabotage: sabEvt.sabotage,
                reason: 'warningPending',
              });
              continue;
            }

            // 4. En caso contrario $\to$ Iniciar nuevo warning (750 ms, no pierde tiempo en este step)
            oppState.warnings.push({
              sabotage: sabEvt.sabotage,
              remainingMs: WARNING_DURATION_MS,
              source: p,
              createdStep: step,
            });
            eventQueue.push({
              type: 'warningStarted',
              step,
              participant: oppParticipant,
              sabotage: sabEvt.sabotage,
              durationMs: WARNING_DURATION_MS,
            });
          }
        }
      }

      // 9. Actualización de la percepción de ambos participantes
      // Si P1 está interferido -> conservar el snapshot congelado existente (no incorporar cambios de P2 de este step)
      if (!p1State.activeEffects.some((e) => e.type === 'interferencia')) {
        p1State.perceivedOpponentSnapshot = playerTwoEngine.getSnapshot();
      }
      // Si P2 está interferido -> conservar el snapshot congelado existente (no incorporar cambios de P1 de este step)
      if (!p2State.activeEffects.some((e) => e.type === 'interferencia')) {
        p2State.perceivedOpponentSnapshot = playerOneEngine.getSnapshot();
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

      p1State.warnings = [];
      p1State.immunities = [];
      p1State.activeEffects = [];
      p1State.perceivedOpponentSnapshot = playerTwoEngine.getSnapshot();

      p2State.warnings = [];
      p2State.immunities = [];
      p2State.activeEffects = [];
      p2State.perceivedOpponentSnapshot = playerOneEngine.getSnapshot();

      return getSnapshot();
    },

    getEngine(participant: BattleParticipant): GameEngine {
      return participant === 'playerOne' ? playerOneEngine : playerTwoEngine;
    },

    getPerceivedOpponentSnapshot,
  };
}
