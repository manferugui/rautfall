/**
 * Escena principal de Phaser para Rautfall.
 *
 * Responsabilidades:
 * - Crear y gestionar el motor de juego (`@rautfall/game-engine`).
 * - Capturar teclado y traducirlo a StepInput.
 * - Adaptar tiempo real a pasos lógicos fijos.
 * - Renderizar tablero fijo y pieza activa desde snapshots del motor.
 * - Drenar eventos del motor.
 * - Notificar a Vue mediante callback con el resumen mínimo.
 * - Soportar reset desde teclado (R) y desde controlador externo.
 * - Gestionar pausa, reanudación y reinicio coordinados (0008).
 * - Neutralizar entrada al pausar y rearmar al reanudar/reiniciar.
 * - No contiene reglas de dominio (colisiones, SRS, gravedad, DAS, ARR, soft drop, hold, etc.).
 */

import Phaser from 'phaser';
import { createGameEngine, type GameEngine, type PieceType, type EngineSnapshot, type SabotageType, type ActiveEffectSnapshot } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import type { GameMode, GamePresentationState, SessionStatus, BotDevDiagnostic, SabotageBlockedDetails, SabotageLaunchedDetails } from '../types';
import { computeSteps } from '../time-adapter';
import { buildStepInput, type KeyState } from '../input-buffer';
import { logDebug, snapshotResult, snapshotFrameEvents, isAdapterRelevant, shouldLogEngineResult, hasImportantEngineEvent } from '../input-debug';
import { computeSessionStatus, canTogglePause } from '../session-status';
import { isTSpinDemoActive, createTSpinDemoEngine } from '../tspin-demo';
import { isSabotageDemoActive, createSabotageDemoEngine } from '../sabotage-demo';
import { isOverloadDemoActive, createOverloadDemoEngine } from '../overload-demo';
import { isGarbageDemoActive, createGarbageDemoEngine } from '../garbage-demo';
import { isPolarityDemoActive, createPolarityDemoEngine } from '../polarity-demo';
import { isBattleDemoActive, createBattleDemoSession } from '../battle-demo';
import { isWarningDemoActive, createWarningDemoSession, prepareWarningDemoSabotage } from '../warning-demo';
import {
  createBattleSession,
  createDeterministicBot,
  getBotProfileConfig,
  isNeutralPlacementInput,
  normalizeBotProfileId,
  type BattleSession,
  type BotProfileId,
  type DeterministicBot,
  type BattleEvent,
  type BattleStatus,
  type BattleParticipantStateSnapshot,
} from '@rautfall/battle-engine';
import type { OnlineGameSession } from '../../api/online-game-session';

export type GameSceneData = {
  callbacks: GameSceneCallbacks;
  mode?: GameMode;
  seed?: number | undefined;
  botProfile?: BotProfileId | undefined;
  onlineSession?: OnlineGameSession | undefined;
};
import { getLevelDemoTarget, createLevelDemoEngine } from '../level-demo';
import { armReleaseGuard, clearReleaseGuardKey, resolveHeld, NO_RELEASE_GUARD, type ReleaseGuard } from '../input-release-guard';
import {
  CELL_SIZE,
  HIDDEN_ROWS,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  boardXToCanvas,
  boardYToCanvas,
  isRowVisible,
} from '../coordinates';
import { mapEngineToOpponentPresentation } from '../opponent-mapper';
import { getAudioManager } from '../../audio';
import { loadUserSettings } from '../../settings/settings-storage';
import { getActionByCode, type ControlAction, type ControlBindings } from '../../settings/control-bindings';
import { shadeColor } from '../piece-shading';
import { generateMatchSeed } from '../seed';


const PIECE_COLORS: Record<PieceType | 'garbage', number> = {
  I: 0x00d4ff,
  O: 0xffd700,
  T: 0x9b59b6,
  S: 0x2ecc71,
  Z: 0xe74c3c,
  J: 0x3498db,
  L: 0xf39c12,
  garbage: 0x555555,
};

type ConsumedFlags = {
  horizontal: boolean;
  clockwise: boolean;
  counterclockwise: boolean;
  hardDrop: boolean;
  hold: boolean;
  triggerSabotage: boolean;
};

export type GameSceneCallbacks = {
  onStateUpdate: (state: GamePresentationState) => void;
};

export class GameScene extends Phaser.Scene {
  private mode: GameMode = 'training';
  private botProfile?: BotProfileId | undefined;
  private onlineSession: OnlineGameSession | null = null;
  private unbindOnlineSessionFns: Array<() => void> = [];
  private windowBlurCleaner: (() => void) | null = null;
  private engine!: GameEngine;
  private battleSession: BattleSession | null = null;
  private playerTwoBot: DeterministicBot | null = null;
  private lastSabotageRouted: string | null = null;
  private lastSabotageBlocked: string | null = null;
  private lastSabotageBlockedDetails: SabotageBlockedDetails | null = null;
  private sabotageBlockedCounter = 0;
  private lastSabotageLaunchedDetails: SabotageLaunchedDetails | null = null;
  private sabotageLaunchedCounter = 0;
  private pendingDevSabotage: 'sobrecarga' | 'polaridad' | 'interferencia' | null = null;
  private graphics!: Phaser.GameObjects.Graphics;
  private accumulator = 0;
  private lastState: GamePresentationState | null = null;
  private callbacks!: GameSceneCallbacks;
  private consumedThisFrame: ConsumedFlags = {
    horizontal: false,
    clockwise: false,
    counterclockwise: false,
    hardDrop: false,
    hold: false,
    triggerSabotage: false,
  };

  private controlBindings!: ControlBindings;
  private physicallyHeldCodes = new Set<string>();
  private pendingPressedActions = new Set<ControlAction>();

  /** true mientras la sesión web está pausada. El motor no recibe step() durante la pausa. */
  private isPaused = false;

  /**
   * Guardián de liberación de teclas. Bloquea left/right/softDrop hasta que
   * se observe su keyup real, evitando que teclas mantenidas durante una
   * transición (pausa→running, reinicio) produzcan acciones fantasma.
   */
  private releaseGuard: ReleaseGuard = NO_RELEASE_GUARD;

  /**
   * Flanco horizontal pendiente. Se establece en el evento `keydown` real
   * (filtrando auto-repeat del navegador) y se consume en el primer paso
   * lógico disponible. Solo puede tomar un valor a la vez: la última
   * pulsación real gana.
   */
  private pendingHorizontal: 'left' | 'right' | null = null;

  /**
   * Listeners registrados para poder retirarlos al destruir la escena.
   */
  private horizontalListeners: (() => void) | null = null;

  private bountyInterval: ReturnType<typeof setInterval> | null = null;

  /** Telemetría acumulativa de diagnóstico exclusiva para entornos DEV. */
  private devHardDropPhaseStepCount = 0;
  private devMaxActionsInSingleStep = 0;
  private devSessionGeneration = 1;

  private matchSeed = 42;

  /** Estado del FX de impacto mecánico de residuos (garbageApplied) */
  private garbageImpactRemainingMs = 0;
  private garbageImpactTotalMs = 160;
  private garbageImpactLinesCount = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  /**
   * Dispara el FX de impacto de residuos en el tablero.
   */
  private triggerGarbageImpact(linesCount: number): void {
    this.garbageImpactLinesCount = linesCount;
    this.garbageImpactTotalMs = 160;
    this.garbageImpactRemainingMs = 160;
  }

  /**
   * Devuelve el estado de presentación del FX de impacto de residuos.
   * Método de inspección para pruebas y telemetría visual.
   */
  public getGarbageImpactFXState(): { active: boolean; remainingMs: number; linesCount: number; yOffset: number } {
    const active = this.garbageImpactRemainingMs > 0;
    const totalMs = this.garbageImpactTotalMs || 160;
    const progress = active ? Math.min(1, Math.max(0, 1 - this.garbageImpactRemainingMs / totalMs)) : 1;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let maxShake = 5.0;
    if (this.garbageImpactLinesCount <= 1) {
      maxShake = 2.0;
    } else if (this.garbageImpactLinesCount <= 3) {
      maxShake = 3.5;
    }

    // Curva seca: impulso inicial fuerte hacia arriba (-Y), rebote corto y asentamiento rápido
    const yOffset = active && !prefersReducedMotion
      ? -maxShake * Math.sin(Math.sqrt(progress) * 2.2 * Math.PI) * Math.pow(1 - progress, 2.2)
      : 0;

    return {
      active,
      remainingMs: this.garbageImpactRemainingMs,
      linesCount: this.garbageImpactLinesCount,
      yOffset,
    };
  }

  init(data: GameSceneData): void {
    this.callbacks = data.callbacks;
    this.mode = data.mode ?? 'training';
    this.matchSeed = data.seed ?? generateMatchSeed();
    this.botProfile = data.botProfile;
    this.onlineSession = data.onlineSession ?? null;
  }

  getMatchSeed(): number {
    return this.matchSeed;
  }

  create(): void {
    this.controlBindings = loadUserSettings().controls;
    this.physicallyHeldCodes.clear();
    this.pendingPressedActions.clear();
    this.pendingHorizontal = null;

    if (this.mode !== 'online') {
      this.resetEngine();
    }

    this.graphics = this.add.graphics();
    this.graphics.setPosition(0, 0);

    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
    this.lastState = null;

    // Suscribir shutdown() una sola vez a los eventos de ciclo de vida
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);

    if (this.mode === 'online') {
      const onKeyDown = (event: KeyboardEvent): void => {
        void getAudioManager().unlock();

        if (event.code === 'Escape' || event.code === 'KeyR') return;

        const action = getActionByCode(this.controlBindings, event.code);
        if (action !== null && (event.code === 'Space' || event.code.startsWith('Arrow') || event.code.startsWith('Alt'))) {
          event.preventDefault();
        }

        if (event.repeat) return;

        if (action !== null && this.onlineSession) {
          this.onlineSession.handleKeyDown(action);
        }
      };

      const onKeyUp = (event: KeyboardEvent): void => {
        const action = getActionByCode(this.controlBindings, event.code);
        if (action !== null && this.onlineSession) {
          this.onlineSession.handleKeyUp(action);
        }
      };

      const onWindowBlur = (): void => {
        if (this.onlineSession) {
          this.onlineSession.handleBlur();
        }
      };

      this.input.keyboard!.on('keydown', onKeyDown);
      this.input.keyboard!.on('keyup', onKeyUp);
      window.addEventListener('blur', onWindowBlur);

      this.horizontalListeners = () => {
        this.input.keyboard!.off('keydown', onKeyDown);
        this.input.keyboard!.off('keyup', onKeyUp);
      };

      this.windowBlurCleaner = () => {
        window.removeEventListener('blur', onWindowBlur);
      };

      if (this.onlineSession) {
        const unbindState = this.onlineSession.onGameState((msg) => {
          for (const event of msg.events) {
            getAudioManager().handleBattleEvent(event as unknown as BattleEvent);
            if (
              event.type === 'participantEvent' &&
              event.participant === this.onlineSession?.role &&
              event.event.type === 'garbageApplied'
            ) {
              this.triggerGarbageImpact(event.event.linesCount);
            }
          }
          this.renderFrame();
          this.notifyState();
        });

        const unbindEnded = this.onlineSession.onBattleEnded(() => {
          this.notifyState();
        });

        const unbindDisc = this.onlineSession.onPlayerDisconnected(() => {
          this.notifyState();
        });

        this.unbindOnlineSessionFns = [unbindState, unbindEnded, unbindDisc];
      }

      this.notifyState();
      return;
    }

    // Registrar listener de keydown para el orden real de pulsaciones horizontales y acciones discretas.
    const onKeyDown = (event: KeyboardEvent): void => {
      void getAudioManager().unlock();

      // Tecla Escape fija: alternar pausa/reanudación
      if (event.code === 'Escape') {
        if (!event.repeat) {
          this.togglePause();
        }
        return;
      }

      // Tecla KeyR fija: reiniciar partida
      if (event.code === 'KeyR') {
        if (!event.repeat) {
          getAudioManager().restartMusic('gameplay');
          this.resetEngine();
        }
        return;
      }

      if ((isBattleDemoActive() || isWarningDemoActive()) && !event.repeat) {
        if (event.code === 'Digit0' || event.code === 'Numpad0') {
          this.resetEngine();
          return;
        }
        if (isWarningDemoActive()) {
          if (event.code === 'Digit1' || event.code === 'Numpad1') {
            this.pendingDevSabotage = 'sobrecarga';
          } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
            this.pendingDevSabotage = 'polaridad';
          } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
            this.pendingDevSabotage = 'interferencia';
          }
        }
      }

      const action = getActionByCode(this.controlBindings, event.code);

      // Prevenir scroll/navegación del navegador para teclas asignadas a gameplay
      if (action !== null && (event.code === 'Space' || event.code.startsWith('Arrow') || event.code.startsWith('Alt'))) {
        event.preventDefault();
      }

      if (event.repeat) return; // Ignorar auto-repeat del navegador

      this.physicallyHeldCodes.add(event.code);

      if (action === 'moveLeft') {
        this.pendingHorizontal = 'left';
      } else if (action === 'moveRight') {
        this.pendingHorizontal = 'right';
      } else if (action !== null) {
        this.pendingPressedActions.add(action);
      }
    };

    // Registrar keyup para actualizar el conjunto físico y limpiar el guardián de liberación
    const onKeyUp = (event: KeyboardEvent): void => {
      this.physicallyHeldCodes.delete(event.code);

      const action = getActionByCode(this.controlBindings, event.code);
      if (action === 'moveLeft') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'left');
      } else if (action === 'moveRight') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'right');
      } else if (action === 'softDrop') {
        this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'softDrop');
      }
    };

    this.input.keyboard!.on('keydown', onKeyDown);
    this.input.keyboard!.on('keyup', onKeyUp);

    this.horizontalListeners = () => {
      this.input.keyboard!.off('keydown', onKeyDown);
      this.input.keyboard!.off('keyup', onKeyUp);
    };

    logDebug({ source: 'lifecycle', event: 'create' });
  }

  /**
   * Se llama cuando la escena se destruye o se cierra (suscrito con once()).
   * Limpia listeners y estado pendiente.
   */
  shutdown(): void {
    if (this.horizontalListeners) {
      this.horizontalListeners();
      this.horizontalListeners = null;
    }
    if (this.windowBlurCleaner) {
      this.windowBlurCleaner();
      this.windowBlurCleaner = null;
    }
    this.unbindOnlineSessionFns.forEach((fn) => fn());
    this.unbindOnlineSessionFns = [];

    this.physicallyHeldCodes.clear();
    this.pendingPressedActions.clear();
    this.pendingHorizontal = null;
    this.pendingDevSabotage = null;

    logDebug({ source: 'lifecycle', event: 'shutdown' });

    if (this.bountyInterval !== null) {
      clearInterval(this.bountyInterval);
      this.bountyInterval = null;
    }

    // Retirar las propias suscripciones de ciclo de vida (seguridad adicional)
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.off(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
  }

  update(_time: number, delta: number): void {
    // Actualizar temporizador de FX de residuos
    if (this.garbageImpactRemainingMs > 0) {
      this.garbageImpactRemainingMs = Math.max(0, this.garbageImpactRemainingMs - delta);
    }

    if (this.mode === 'online') {
      this.renderFrame();
      return;
    }

    // Reiniciar banderas de consumo al empezar el frame
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };

    const engineStatus = this.engine.getSnapshot().status;

    // gameOver prevalece sobre cualquier otro estado
    if (engineStatus === 'gameOver') {
      if (this.isPaused) this.isPaused = false;
      this.renderFrame();
      this.engine.drainEvents();
      this.notifyState();
      return;
    }

    // Mientras está pausado: drenar entrada, renderizar (congelado) y notificar
    if (this.isPaused) {
      this.readKeys();
      this.renderFrame();
      this.notifyState();
      return;
    }

    const fixedStepMs = prototypeConfig.fixedStepMs;
    const [stepsToExecute, newAcc] = computeSteps(this.accumulator, delta, fixedStepMs);
    this.accumulator = newAcc;

    const keys = this.readKeys();

    let demoWaitingForInput = false;
    if (isTSpinDemoActive()) {
      const snap = this.engine.getSnapshot();
      if (snap.step === 0) {
        const hasInput = keys.horizontalPressed !== null ||
          keys.justPressedUp ||
          keys.justPressedZ ||
          keys.justPressedSpace ||
          keys.justPressedC ||
          keys.justPressedA ||
          keys.leftHeld ||
          keys.rightHeld ||
          keys.softDropHeld;
        if (!hasInput) {
          demoWaitingForInput = true;
          this.accumulator = 0;
        }
      }
    }

    if (!demoWaitingForInput) {
      for (let i = 0; i < stepsToExecute; i++) {
        if (this.engine.getSnapshot().status === 'gameOver') break;

        const [input, updatedConsumed] = buildStepInput(
          i === 0 ? keys : this.emptyInput(),
          i === 0
            ? this.consumedThisFrame
            : { horizontal: true, clockwise: true, counterclockwise: true, hardDrop: true, hold: true, triggerSabotage: true },
        );

        if (i === 0) {
          this.consumedThisFrame = updatedConsumed;
        }

        if (this.battleSession) {
          const bSnap = this.battleSession.getSnapshot();
          if (bSnap.status === 'running') {
            let p2Input = this.playerTwoBot
              ? this.playerTwoBot.nextStep(this.battleSession.getEngine('playerTwo'), bSnap.status, bSnap.playerOne)
              : this.emptyStepInput();

            if (isWarningDemoActive() && this.pendingDevSabotage !== null) {
              const sabotageToTrigger = this.pendingDevSabotage;
              this.pendingDevSabotage = null;
              prepareWarningDemoSabotage(this.battleSession, sabotageToTrigger);
              p2Input = { ...this.emptyStepInput(), triggerSabotage: true };
            }

            if (import.meta.env.DEV && this.playerTwoBot) {
              const placementActions = isNeutralPlacementInput(p2Input) ? 0 : 1;
              const sabotageActions = p2Input.triggerSabotage ? 1 : 0;
              const actionsInThisStep = placementActions + sabotageActions;

              if (actionsInThisStep > this.devMaxActionsInSingleStep) {
                this.devMaxActionsInSingleStep = actionsInThisStep;
              }
            }

            this.battleSession.step({
              playerOne: input,
              playerTwo: p2Input,
            });
          }
        } else if (this.engine.getSnapshot().status === 'running') {
          const snapBefore = this.engine.getSnapshot();
          const xBefore = snapBefore.activePiece?.x ?? 0;
          const yBefore = snapBefore.activePiece?.y ?? 0;

          const adapterEntry = {
            source: 'adapter' as const,
            logicalStep: snapBefore.step,
            stepIndex: i,
            totalSteps: stepsToExecute,
            leftHeld: input.leftHeld,
            rightHeld: input.rightHeld,
            leftPressed: input.leftPressed,
            rightPressed: input.rightPressed,
            softDropHeld: input.softDropHeld,
            rotateClockwise: input.rotateClockwise ?? false,
            rotateCounterclockwise: input.rotateCounterclockwise ?? false,
            hardDrop: input.hardDrop,
            pendingHorizontal: keys.horizontalPressed,
            consumedHorizontal: this.consumedThisFrame.horizontal,
          };

          const hadRelevantInput = isAdapterRelevant(adapterEntry);

          if (hadRelevantInput) {
            logDebug(adapterEntry);
          }

          this.engine.step(input);

          const snapAfter = this.engine.getSnapshot();
          const pieceAfter = snapAfter.activePiece?.type ?? null;
          const xAfter = snapAfter.activePiece?.x ?? xBefore;
          const yAfter = snapAfter.activePiece?.y ?? yBefore;

          if (shouldLogEngineResult({
            hadRelevantInput,
            softDropHeld: input.softDropHeld,
            hardDrop: input.hardDrop,
            xBefore,
            xAfter,
            yBefore,
            yAfter,
            pieceBefore: snapBefore.activePiece?.type ?? null,
            pieceAfter,
            statusBefore: snapBefore.status,
            statusAfter: snapAfter.status,
            hadEdgeAction: input.leftPressed || input.rightPressed || input.rotateClockwise === true || input.rotateCounterclockwise === true || input.hardDrop,
          })) {
            logDebug(snapshotResult(
              snapAfter.step,
              pieceAfter,
              xBefore,
              xAfter,
              yBefore,
              yAfter,
              snapAfter.status,
            ));
          }
        }
      }
    }

    this.renderFrame();
    if (this.battleSession) {
      const battleEvents = this.battleSession.drainEvents();
      for (const event of battleEvents) {
        getAudioManager().handleBattleEvent(event);
        if (event.type === 'sabotageRouted') {
          this.lastSabotageRouted = `${event.sabotage} (${event.source} -> ${event.target})`;
          this.lastSabotageLaunchedDetails = Object.freeze({
            source: event.source,
            target: event.target,
            sabotage: event.sabotage,
            id: ++this.sabotageLaunchedCounter,
          });
        } else if (event.type === 'sabotageBlocked') {
          this.lastSabotageBlocked = `${event.sabotage} -> ${event.target} (${event.reason})`;
          this.lastSabotageBlockedDetails = Object.freeze({
            target: event.target,
            source: event.source,
            sabotage: event.sabotage,
            reason: event.reason,
            id: ++this.sabotageBlockedCounter,
          });
        } else if (event.type === 'participantEvent' && event.participant === 'playerOne' && event.event.type === 'garbageApplied') {
          this.triggerGarbageImpact(event.event.linesCount);
        }
      }
    } else {
      const frameEvents = this.engine.drainEvents();
      for (const event of frameEvents) {
        getAudioManager().handleEngineEvent(event);
        if (event.type === 'sabotageTriggered') {
          this.lastSabotageLaunchedDetails = Object.freeze({
            source: 'playerOne',
            target: 'playerTwo',
            sabotage: event.sabotage,
            id: ++this.sabotageLaunchedCounter,
          });
          if (isSabotageDemoActive() || isOverloadDemoActive() || isGarbageDemoActive() || isPolarityDemoActive()) {
            this.engine.receiveSabotage(event.sabotage);
          }
        } else if (event.type === 'garbageApplied') {
          this.triggerGarbageImpact(event.linesCount);
        }
      }
      const frameEventTypes = frameEvents.map(e => e.type);
      if (hasImportantEngineEvent(frameEventTypes)) {
        const snap = this.engine.getSnapshot();
        logDebug(snapshotFrameEvents(
          snap.step,
          frameEventTypes,
          snap.activePiece?.type ?? null,
          snap.status,
        ));
      }
    }
    this.notifyState();
  }

  resetGame(): void {
    if (this.mode === 'online') return;
    getAudioManager().restartMusic('gameplay');
    this.resetEngine();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
    this.notifyState();
    logDebug({ source: 'lifecycle', event: 'reset – resetGame' });
  }

  /**
   * Alterna entre running y paused.
   * Es la única implementación de la operación de pausa: tanto Escape como el
   * botón Vue llaman exactamente a este método.
   */
  togglePause(): void {
    if (this.mode === 'online') return;
    const engineStatus = this.engine.getSnapshot().status;
    if (!canTogglePause(engineStatus)) return;

    this.isPaused = !this.isPaused;

    this.pendingHorizontal = null;
    this.pendingPressedActions.clear();
    this.readKeys();

    if (this.isPaused) {
      this.accumulator = 0;
      logDebug({ source: 'lifecycle', event: 'pause' });
    } else {
      this.releaseGuard = armReleaseGuard({
        left: this.physicallyHeldCodes.has(this.controlBindings.moveLeft),
        right: this.physicallyHeldCodes.has(this.controlBindings.moveRight),
        softDrop: this.physicallyHeldCodes.has(this.controlBindings.softDrop),
      });
      this.accumulator = 0;
      logDebug({ source: 'lifecycle', event: 'resume' });
    }

    this.renderFrame();
    this.notifyState();
  }

  private resetEngine(): void {
    this.controlBindings = this.controlBindings ?? loadUserSettings().controls;

    if (import.meta.env.DEV) {
      this.devHardDropPhaseStepCount = 0;
      this.devMaxActionsInSingleStep = 0;
      this.devSessionGeneration = (this.devSessionGeneration || 0) + 1;
    }

    const levelDemoTarget = getLevelDemoTarget();
    if (isWarningDemoActive()) {
      this.battleSession = createWarningDemoSession();
      this.playerTwoBot = null;
      this.engine = this.battleSession.getEngine('playerOne');
      this.lastSabotageRouted = null;
      this.lastSabotageBlocked = null;
    } else if (isBattleDemoActive()) {
      this.battleSession = createBattleDemoSession();
      const botConfig = getBotProfileConfig(normalizeBotProfileId(this.botProfile));
      this.playerTwoBot = createDeterministicBot(botConfig);
      this.engine = this.battleSession.getEngine('playerOne');
      this.lastSabotageRouted = null;
    } else if (levelDemoTarget !== null) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createLevelDemoEngine(levelDemoTarget);
    } else if (isTSpinDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createTSpinDemoEngine();
    } else if (isSabotageDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createSabotageDemoEngine();
    } else if (isOverloadDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createOverloadDemoEngine();
    } else if (isGarbageDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createGarbageDemoEngine();
    } else if (isPolarityDemoActive()) {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createPolarityDemoEngine();
    } else if (this.mode === 'battle') {
      this.battleSession = createBattleSession({ seed: this.matchSeed, config: prototypeConfig });
      const botConfig = getBotProfileConfig(normalizeBotProfileId(this.botProfile));
      this.playerTwoBot = createDeterministicBot(botConfig);
      this.engine = this.battleSession.getEngine('playerOne');
      this.lastSabotageRouted = null;
      this.lastSabotageBlocked = null;
    } else {
      this.battleSession = null;
      this.playerTwoBot = null;
      this.engine = createGameEngine({ seed: this.matchSeed, config: prototypeConfig });
    }
    if (this.playerTwoBot) {
      this.playerTwoBot.reset();
    }
    this.garbageImpactRemainingMs = 0;
    this.garbageImpactLinesCount = 0;
    if (this.graphics) {
      this.graphics.setPosition(0, 0);
    }

    this.engine.drainEvents();
    this.accumulator = 0;
    this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false, hold: false, triggerSabotage: false };
    this.pendingHorizontal = null;
    this.pendingPressedActions.clear();
    this.pendingDevSabotage = null;
    this.isPaused = false;
    this.releaseGuard = armReleaseGuard({
      left: this.physicallyHeldCodes.has(this.controlBindings.moveLeft),
      right: this.physicallyHeldCodes.has(this.controlBindings.moveRight),
      softDrop: this.physicallyHeldCodes.has(this.controlBindings.softDrop),
    });
    this.readKeys();
    logDebug({ source: 'lifecycle', event: 'reset – engine' });
  }

  /**
   * Lee el estado de teclas para este frame.
   *
   * El flanco horizontal se determina a partir del último evento `keydown`
   * real registrado desde el frame anterior. Si la tecla correspondiente
   * ya no está mantenida (se soltó antes de consumir), el flanco se descarta
   * para no violar la validación `pressed requiere held` del motor.
   *
   * Aplica el guardián de liberación (releaseGuard) a left, right y softDrop
   * para neutralizar teclas mantenidas durante transiciones de pausa/reinicio.
   */
  private readKeys(): KeyState {
    let horizontalPressed: 'left' | 'right' | null = null;
    let leftHeld = resolveHeld(this.releaseGuard, 'left', this.physicallyHeldCodes.has(this.controlBindings.moveLeft));
    let rightHeld = resolveHeld(this.releaseGuard, 'right', this.physicallyHeldCodes.has(this.controlBindings.moveRight));

    if (this.pendingHorizontal !== null) {
      if (this.pendingHorizontal === 'left') {
        horizontalPressed = 'left';
        leftHeld = true;
      } else {
        horizontalPressed = 'right';
        rightHeld = true;
      }
      this.pendingHorizontal = null; // consumido para el frame
    }

    const justPressedUp = this.pendingPressedActions.has('rotateClockwise');
    this.pendingPressedActions.delete('rotateClockwise');

    const justPressedZ = this.pendingPressedActions.has('rotateCounterClockwise');
    this.pendingPressedActions.delete('rotateCounterClockwise');

    const justPressedSpace = this.pendingPressedActions.has('hardDrop');
    this.pendingPressedActions.delete('hardDrop');

    const justPressedC = this.pendingPressedActions.has('hold');
    this.pendingPressedActions.delete('hold');

    const justPressedA = this.pendingPressedActions.has('triggerSabotage');
    this.pendingPressedActions.delete('triggerSabotage');

    return {
      horizontalPressed,
      leftHeld,
      rightHeld,
      justPressedUp,
      justPressedZ,
      justPressedSpace,
      justPressedC,
      justPressedA,
      softDropHeld: resolveHeld(this.releaseGuard, 'softDrop', this.physicallyHeldCodes.has(this.controlBindings.softDrop)),
    };
  }

  /**
   * Genera un KeyState para pasos lógicos adicionales dentro del mismo frame.
   * Preserva el estado mantenido de teclas horizontales y soft drop
   * porque el motor necesita conocer el valor real de `leftHeld`/`rightHeld`
   * para continuar o limpiar la secuencia DAS/ARR. El flanco horizontal
   * se bloquea (null) para no repetir la pulsación; lo mismo para rotación
   * y hard drop, que se consumen con `consumedThisFrame`.
   *
   * Aplica el guardián de liberación a left, right y softDrop.
   */
  private emptyInput(): KeyState {
    return {
      horizontalPressed: null,
      leftHeld: resolveHeld(this.releaseGuard, 'left', this.physicallyHeldCodes.has(this.controlBindings.moveLeft)),
      rightHeld: resolveHeld(this.releaseGuard, 'right', this.physicallyHeldCodes.has(this.controlBindings.moveRight)),
      justPressedUp: false,
      justPressedZ: false,
      justPressedSpace: false,
      justPressedC: false,
      justPressedA: false,
      softDropHeld: resolveHeld(this.releaseGuard, 'softDrop', this.physicallyHeldCodes.has(this.controlBindings.softDrop)),
    };
  }

  private emptyStepInput(): import('@rautfall/game-engine').StepInput {
    return {
      leftHeld: false,
      rightHeld: false,
      leftPressed: false,
      rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    };
  }

  /**
   * Dibuja una celda de tetrominó con volumen: base plana + degradado interno
   * diagonal sutil + bisel de borde (highlight arriba/izquierda, sombra
   * abajo/derecha) + contorno oscuro controlado. Solo renderizado visual —
   * no afecta colisiones, PieceType ni semántica de dominio.
   */
  private drawBeveledCell(x: number, y: number, size: number, color: number, alpha = 1): void {
    const highlight = shadeColor(color, 0.32);
    const shadow = shadeColor(color, -0.32);
    const edge = 3;

    // Base plana
    this.graphics.fillStyle(color, alpha);
    this.graphics.fillRect(x, y, size, size);

    // Degradado interno diagonal (dos triángulos suaves, sin blur)
    this.graphics.fillStyle(highlight, alpha * 0.18);
    this.graphics.fillTriangle(x, y, x + size, y, x, y + size);
    this.graphics.fillStyle(shadow, alpha * 0.18);
    this.graphics.fillTriangle(x + size, y, x + size, y + size, x, y + size);

    // Bisel de borde: highlight arriba/izquierda, sombra abajo/derecha
    this.graphics.fillStyle(highlight, alpha * 0.85);
    this.graphics.fillRect(x, y, size, edge);
    this.graphics.fillRect(x, y, edge, size);
    this.graphics.fillStyle(shadow, alpha * 0.85);
    this.graphics.fillRect(x, y + size - edge, size, edge);
    this.graphics.fillRect(x + size - edge, y, edge, size);

    // Contorno exterior oscuro y controlado
    this.graphics.lineStyle(1, 0x000000, 0.45);
    this.graphics.strokeRect(x, y, size, size);
  }

  private renderFrame(): void {
      const snap = this.mode === 'online'
        ? (this.onlineSession?.latestGameState?.self ?? null)
        : (this.battleSession ? this.battleSession.getSnapshot().playerOne : this.engine.getSnapshot());

      if (!snap) return;

      const fxState = this.getGarbageImpactFXState();
      if (fxState.active) {
        this.graphics.setPosition(0, fxState.yOffset);
      } else {
        this.graphics.setPosition(0, 0);
      }

      this.graphics.clear();

      // Dibujar tablero fijo (filas visibles 4-23)
      for (let y = HIDDEN_ROWS; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          const cell = snap.board[y]![x];
          const canvasX = boardXToCanvas(x);
          const canvasY = boardYToCanvas(y);
          if (cell !== null) {
            if (cell === 'garbage') {
              // Estilo visual exclusivo de celda de basura: bloque sólido de
              // acero contaminado (no un hueco con borde óxido). Misma
              // construcción de bisel de borde que drawBeveledCell
              // (highlight sup./izq., sombra inf./der., contorno oscuro),
              // pero con relleno grafito visible como base, apagada y con
              // manchas de corrosión contenidas en vez de un relleno oscuro
              // grande que vaciaba el centro.
              const garbageEdge = 3;
              this.graphics.fillStyle(0x4a4c52, 1);
              this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);

              // Manchas de corrosión contenidas (parches apagados, no un
              // relleno grande) — dan textura de "contaminado" sin abrir
              // un centro oscuro.
              this.graphics.fillStyle(0x5c4a34, 0.3);
              this.graphics.fillRect(canvasX + CELL_SIZE * 0.15, canvasY + CELL_SIZE * 0.45, CELL_SIZE * 0.22, CELL_SIZE * 0.18);
              this.graphics.fillStyle(0x33353a, 0.4);
              this.graphics.fillRect(canvasX + CELL_SIZE * 0.55, canvasY + CELL_SIZE * 0.2, CELL_SIZE * 0.2, CELL_SIZE * 0.16);

              // Bisel de borde apagado y sucio (mismo edge que drawBeveledCell)
              this.graphics.fillStyle(0x64666c, 0.55);
              this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, garbageEdge);
              this.graphics.fillRect(canvasX, canvasY, garbageEdge, CELL_SIZE);
              this.graphics.fillStyle(0x362a20, 0.7);
              this.graphics.fillRect(canvasX, canvasY + CELL_SIZE - garbageEdge, CELL_SIZE, garbageEdge);
              this.graphics.fillRect(canvasX + CELL_SIZE - garbageEdge, canvasY, garbageEdge, CELL_SIZE);

              // Contorno corroído oscuro
              this.graphics.lineStyle(1, 0x241a12, 0.75);
              this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
            } else {
              this.drawBeveledCell(canvasX, canvasY, CELL_SIZE, PIECE_COLORS[cell as PieceType]);
            }
          } else {
            this.graphics.fillStyle(0x141517, 1);
            this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
            this.graphics.lineStyle(1, 0x25262a, 1);
            this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
          }
        }
      }

      // Dibujar pieza fantasma si existe pieza activa
      if (snap.activePiece) {
        const ghostColor = PIECE_COLORS[snap.activePiece.type as PieceType];
        for (const cell of snap.activePiece.landingCells) {
          if (!isRowVisible(cell.y)) continue;
          const canvasX = boardXToCanvas(cell.x);
          const canvasY = boardYToCanvas(cell.y);
          this.graphics.fillStyle(ghostColor, 0.25); // Opacidad reducida
          this.graphics.fillRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
          this.graphics.lineStyle(1, ghostColor, 0.5); // Contorno con opacidad media
          this.graphics.strokeRect(canvasX, canvasY, CELL_SIZE, CELL_SIZE);
        }
      }

      // Superponer pieza activa
      if (snap.activePiece) {
        const color = PIECE_COLORS[snap.activePiece.type as PieceType];
        for (const cell of snap.activePiece.cells) {
          if (!isRowVisible(cell.y)) continue;
          const canvasX = boardXToCanvas(cell.x);
          const canvasY = boardYToCanvas(cell.y);
          this.drawBeveledCell(canvasX, canvasY, CELL_SIZE, color);
        }
      }

      // Banda/flash de impacto en el borde inferior interior del tablero
      if (this.garbageImpactRemainingMs > 0) {
        const totalMs = this.garbageImpactTotalMs || 160;
        const progress = Math.min(1, Math.max(0, 1 - this.garbageImpactRemainingMs / totalMs));
        let flashAlpha = 1.0;
        if (this.garbageImpactLinesCount <= 1) {
          flashAlpha = 0.6;
        } else if (this.garbageImpactLinesCount <= 3) {
          flashAlpha = 0.8;
        }
        // Caída rápida de intensidad para sensación de impacto seco
        const currentAlpha = flashAlpha * Math.pow(1 - progress, 2.5);
        if (currentAlpha > 0) {
          const stripY = CANVAS_HEIGHT - 9;
          // Grafito / óxido / ámbar apagado sin glow ni neón
          this.graphics.fillStyle(0xa06030, currentAlpha);
          this.graphics.fillRect(0, stripY, CANVAS_WIDTH, 9);
          this.graphics.fillStyle(0x503820, currentAlpha * 0.7);
          this.graphics.fillRect(0, stripY, CANVAS_WIDTH, 3);
          this.graphics.fillStyle(0xd08040, currentAlpha * 0.5);
          this.graphics.fillRect(0, stripY + 6, CANVAS_WIDTH, 3);
        }
      }
    }

  private notifyState(): void {
    if (this.mode === 'online') {
      const msg = this.onlineSession?.latestGameState;
      if (!msg) return;

      const selfSnap = msg.self;
      let sessionStatus: SessionStatus = 'running';
      if (msg.status !== 'running' || this.onlineSession?.status === 'ended') {
        sessionStatus = 'gameOver';
      }

      const battleWinner = msg.winner ?? (msg.status === 'running' ? null : 'draw');
      const bStatus: BattleStatus = msg.status === 'running' ? 'running' : (msg.status as BattleStatus);

      const newState: GamePresentationState = {
        status: sessionStatus,
        step: msg.step,
        elapsedMs: msg.elapsedMs,
        nextPieces: [...selfSnap.nextPieces] as PieceType[],
        heldPiece: selfSnap.heldPiece as PieceType | null,
        score: selfSnap.score,
        clearedLines: selfSnap.clearedLines,
        combo: selfSnap.combo,
        backToBack: selfSnap.backToBack,
        combatEnergy: selfSnap.combatEnergy,
        storedSabotages: [...selfSnap.storedSabotages] as SabotageType[],
        pendingGarbage: selfSnap.pendingGarbage,
        activeEffects: [...selfSnap.activeEffects] as ActiveEffectSnapshot[],
        level: selfSnap.level,
        baseGravityCellsPerSecond: 1.0,
        activeGravityCellsPerSecond: 1.0,
        lastSabotageLaunchedDetails: this.lastSabotageLaunchedDetails,
        battleState: {
          status: bStatus,
          winner: battleWinner,
          step: msg.step,
          lastSabotageRouted: this.lastSabotageRouted,
          lastSabotageBlocked: this.lastSabotageBlocked,
          lastSabotageBlockedDetails: this.lastSabotageBlockedDetails,
          suddenDeathPhase: msg.suddenDeath?.phase ?? null,
          playerOneState: msg.selfState as BattleParticipantStateSnapshot,
          playerTwo: mapEngineToOpponentPresentation(
            msg.opponent as unknown as EngineSnapshot,
            msg.opponentState as BattleParticipantStateSnapshot,
          ),
        },
      };

      this.lastState = newState;
      this.callbacks.onStateUpdate(newState);
      return;
    }

    const snap = this.battleSession ? this.battleSession.getSnapshot().playerOne : this.engine.getSnapshot();
    let newState: GamePresentationState = {
      status: computeSessionStatus(snap.status, this.isPaused),
      step: snap.step,
      elapsedMs: snap.elapsedMs,
      nextPieces: [...snap.nextPieces],
      heldPiece: snap.heldPiece,
      score: snap.score,
      clearedLines: snap.clearedLines,
      combo: snap.combo,
      backToBack: snap.backToBack,
      combatEnergy: snap.combatEnergy,
      storedSabotages: [...snap.storedSabotages],
      pendingGarbage: snap.pendingGarbage,
      activeEffects: [...snap.activeEffects],
      level: snap.level,
      baseGravityCellsPerSecond: snap.baseGravityCellsPerSecond,
      activeGravityCellsPerSecond: snap.activeGravityCellsPerSecond,
      lastSabotageLaunchedDetails: this.lastSabotageLaunchedDetails,
    };

    if (this.battleSession) {
      const bSnap = this.battleSession.getSnapshot();

      let botDevDiagnostic: BotDevDiagnostic | undefined = undefined;
      if (import.meta.env.DEV && this.playerTwoBot) {
        const p2Engine = this.battleSession.getEngine('playerTwo');
        const p2Snap = p2Engine.getSnapshot();
        const p2Active = p2Snap.activePiece;
        const diag = this.playerTwoBot.getDiagnostic();

        let boardCellCount = 0;
        for (let r = 0; r < 24; r++) {
          const row = p2Snap.board[r];
          if (!row) continue;
          for (let c = 0; c < 10; c++) {
            if (row[c] !== null && row[c] !== undefined) boardCellCount++;
          }
        }

        const minCellY = p2Active ? Math.min(...p2Active.cells.map((cell) => cell.y)) : null;

        if (diag.currentPhase === 'waitingBeforeHardDrop') {
          this.devHardDropPhaseStepCount++;
        }

        botDevDiagnostic = Object.freeze({
          pieceId: p2Active?.pieceId ?? null,
          x: p2Active?.x ?? null,
          y: p2Active?.y ?? null,
          minCellY,
          orientation: p2Active?.orientation ?? null,
          boardCellCount,
          phase: diag.currentPhase,
          reactionStepsRemaining: diag.reactionTimerSteps,
          actionIntervalStepsRemaining: diag.actionIntervalTimer,
          hardDropDelayStepsRemaining: diag.hardDropDelayTimer,
          actionIndex: diag.actionIndex,
          lastActionStep: diag.lastActionStep,
          lastAction: diag.lastAction,
          currentAction: diag.currentPhase === 'executing' ? 'active' : null,
          planLength: diag.planDiagnostic?.selectedActionCount ?? 0,
          sabotageDecision: diag.sabotageDecision ? (diag.sabotageDecision.shouldTrigger ? diag.sabotageDecision.sabotage : 'none') : null,
          sabotageDecisionReason: diag.sabotageDecision?.reason ?? null,
          sabotageCooldownRemaining: diag.sabotageCooldownRemaining ?? 0,
          sabotageDecisionIntervalRemaining: diag.sabotageDecisionIntervalRemaining ?? 0,
          lastSabotageUsed: diag.lastSabotageUsed ?? null,
          lastSabotageEvaluationStep: diag.lastSabotageEvaluationStep ?? null,
          frontStoredSabotage: diag.frontStoredSabotage ?? null,
          hardDropPhaseStepCount: this.devHardDropPhaseStepCount,
          maxActionsInSingleStep: this.devMaxActionsInSingleStep,
          sessionGeneration: this.devSessionGeneration,
        });
      }

      newState = {
        ...newState,
        battleState: {
          status: bSnap.status,
          winner: bSnap.winner,
          step: bSnap.step,
          lastSabotageRouted: this.lastSabotageRouted,
          lastSabotageBlocked: this.lastSabotageBlocked,
          lastSabotageBlockedDetails: this.lastSabotageBlockedDetails,
          suddenDeathPhase: bSnap.suddenDeath?.phase ?? null,
          playerOneState: bSnap.playerOneState,
          playerTwo: mapEngineToOpponentPresentation(
            this.battleSession.getPerceivedOpponentSnapshot('playerOne'),
            bSnap.playerTwoState,
          ),
          botDevDiagnostic,
        },
      };
    }

    if (
      this.lastState &&
      this.lastState.status === newState.status &&
      this.lastState.step === newState.step &&
      this.lastState.elapsedMs === newState.elapsedMs &&
      this.lastState.nextPieces.length === newState.nextPieces.length &&
      this.lastState.nextPieces.every((p, i) => p === newState.nextPieces[i]) &&
      this.lastState.heldPiece === newState.heldPiece &&
      this.lastState.score === newState.score &&
      this.lastState.combo === newState.combo &&
      this.lastState.backToBack === newState.backToBack &&
      this.lastState.combatEnergy === newState.combatEnergy &&
      this.lastState.storedSabotages.length === newState.storedSabotages.length &&
      this.lastState.storedSabotages.every((s, i) => s === newState.storedSabotages[i]) &&
      this.lastState.pendingGarbage === newState.pendingGarbage &&
      this.lastState.activeEffects.length === newState.activeEffects.length &&
      this.lastState.activeEffects.every((e, i) => {
        const n = newState.activeEffects[i];
        if (!n || e.type !== n.type) return false;
        if (e.type === 'sobrecarga' && n.type === 'sobrecarga') return e.remainingMs === n.remainingMs;
        if (e.type === 'polaridad' && n.type === 'polaridad') return e.remainingPieces === n.remainingPieces;
        return false;
      }) &&
      this.lastState.level === newState.level &&
      this.lastState.baseGravityCellsPerSecond === newState.baseGravityCellsPerSecond &&
      this.lastState.activeGravityCellsPerSecond === newState.activeGravityCellsPerSecond &&
      (!this.lastState.battleState && !newState.battleState ||
        this.lastState.battleState && newState.battleState &&
        this.lastState.battleState.status === newState.battleState.status &&
        this.lastState.battleState.winner === newState.battleState.winner &&
        this.lastState.battleState.step === newState.battleState.step &&
        this.lastState.battleState.lastSabotageRouted === newState.battleState.lastSabotageRouted &&
        this.lastState.battleState.playerOneState === newState.battleState.playerOneState &&
        this.lastState.battleState.playerTwo === newState.battleState.playerTwo)
    ) {
      return;
    }

    this.lastState = newState;
    this.callbacks.onStateUpdate(newState);
  }
}
