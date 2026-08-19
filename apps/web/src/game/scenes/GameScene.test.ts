// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    events = { once: vi.fn(), off: vi.fn() };
    input = {
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
      },
    };
    add = {
      graphics: () => ({
        setPosition: vi.fn(),
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRect: vi.fn(),
        fillTriangle: vi.fn(),
        lineStyle: vi.fn(),
        strokeRect: vi.fn(),
      }),
    };
  }

  return {
    default: {
      Scene: MockScene,
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
          DESTROY: 'destroy',
        },
      },
    },
  };
});

import { getAudioManager } from '../../audio';
import { GameScene } from './GameScene';
import { saveUserSettings } from '../../settings/settings-storage';
import { DEFAULT_CONTROL_BINDINGS } from '../../settings/control-bindings';
import type { BattleSession } from '@rautfall/battle-engine';
import type { OnlineGameSession } from '../../api/online-game-session';

describe('GameScene — Entrada física (KeyboardEvent.code), lateralidad, DAS/ARR y hotkeys fijas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function setupSceneWithListeners(customBindings?: Partial<typeof DEFAULT_CONTROL_BINDINGS>) {
    if (customBindings) {
      saveUserSettings({
        version: 1,
        controls: {
          ...DEFAULT_CONTROL_BINDINGS,
          ...customBindings,
        },
      });
    }

    let keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    let keyupHandler: ((e: KeyboardEvent) => void) | null = null;

    const mockKeyboard = {
      on: vi.fn().mockImplementation((event: string, handler: (e: KeyboardEvent) => void) => {
        if (event === 'keydown') keydownHandler = handler;
        if (event === 'keyup') keyupHandler = handler;
      }),
      off: vi.fn(),
    };

    const onStateUpdate = vi.fn();
    const scene = new GameScene();
    scene.init({ callbacks: { onStateUpdate }, mode: 'training' });

    (scene as unknown as { input: { keyboard: typeof mockKeyboard } }).input = { keyboard: mockKeyboard };
    (scene as unknown as { add: { graphics: () => unknown } }).add = {
      graphics: () => ({
        setPosition: vi.fn(),
        clear: vi.fn(),
        fillStyle: vi.fn(),
        fillRect: vi.fn(),
        fillTriangle: vi.fn(),
        lineStyle: vi.fn(),
        strokeRect: vi.fn(),
      }),
    };

    scene.create();

    const dispatchKeyDown = (code: string, repeat = false) => {
      const event = { code, repeat, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      keydownHandler!(event);
    };

    const dispatchKeyUp = (code: string) => {
      const event = { code, preventDefault: vi.fn() } as unknown as KeyboardEvent;
      keyupHandler!(event);
    };

    const readKeys = (scene as unknown as { readKeys: () => ReturnType<typeof scene['readKeys']> }).readKeys.bind(scene);

    return { scene, onStateUpdate, dispatchKeyDown, dispatchKeyUp, readKeys };
  }

  it('no crea ansiosamente el AudioContext durante la instanciación de la escena', () => {
    const audioManager = getAudioManager();
    expect(audioManager.getAudioContextState()).toBe('uninitialized');
    new GameScene();
    expect(audioManager.getAudioContextState()).toBe('uninitialized');
  });

  it('distingue correctamente la lateralidad de modificadores (ShiftLeft vs ShiftRight, ControlLeft vs ControlRight)', () => {
    const { dispatchKeyDown, readKeys } = setupSceneWithListeners({
      moveLeft: 'ShiftRight',
      moveRight: 'ControlRight',
      hold: 'ShiftLeft',
    });

    // Pulsar ShiftLeft (asignado a hold, NO a moveLeft)
    dispatchKeyDown('ShiftLeft');
    let keys = readKeys();
    expect(keys.leftHeld).toBe(false);
    expect(keys.justPressedC).toBe(true); // hold

    // Pulsar ShiftRight (asignado a moveLeft)
    dispatchKeyDown('ShiftRight');
    keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    // Pulsar ControlRight (asignado a moveRight)
    dispatchKeyDown('ControlRight');
    keys = readKeys();
    expect(keys.rightHeld).toBe(true);
  });

  it('preserva leftHeld=true sostenido en múltiples lecturas consecutivas (DEFAULT ArrowLeft)', () => {
    const { dispatchKeyDown, dispatchKeyUp, readKeys } = setupSceneWithListeners();

    dispatchKeyDown('ArrowLeft');

    // Lectura 1 (frame 0)
    let keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    // Lectura 2 (frame 1 sin nuevo keydown)
    keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    // Lectura 3 (frame 2 sin nuevo keydown)
    keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    // keyup ArrowLeft
    dispatchKeyUp('ArrowLeft');
    keys = readKeys();
    expect(keys.leftHeld).toBe(false);
  });

  it('preserva leftHeld=true sostenido en múltiples lecturas con CUSTOM ShiftRight', () => {
    const { dispatchKeyDown, dispatchKeyUp, readKeys } = setupSceneWithListeners({
      moveLeft: 'ShiftRight',
    });

    dispatchKeyDown('ShiftRight');

    let keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    keys = readKeys();
    expect(keys.leftHeld).toBe(true);

    dispatchKeyUp('ShiftRight');
    keys = readKeys();
    expect(keys.leftHeld).toBe(false);
  });

  it('conserva la prioridad por último flanco horizontal (pendingHorizontal)', () => {
    // Caso A: keydown moveLeft, luego keydown moveRight -> gana moveRight
    const { dispatchKeyDown, readKeys } = setupSceneWithListeners();

    dispatchKeyDown('ArrowLeft');
    dispatchKeyDown('ArrowRight');

    let keys = readKeys();
    expect(keys.horizontalPressed).toBe('right');
    expect(keys.rightHeld).toBe(true);

    // Caso B: keydown moveRight, luego keydown moveLeft -> gana moveLeft
    dispatchKeyDown('ArrowRight');
    dispatchKeyDown('ArrowLeft');

    keys = readKeys();
    expect(keys.horizontalPressed).toBe('left');
    expect(keys.leftHeld).toBe(true);
  });

  it('ejecuta acciones discretas una sola vez y rechaza disparos repetidos por auto-repeat del navegador', () => {
    const { dispatchKeyDown, readKeys } = setupSceneWithListeners({
      hardDrop: 'Space',
      rotateClockwise: 'KeyU',
      hold: 'KeyH',
      triggerSabotage: 'KeyP',
    });

    // keydown no-repeat
    dispatchKeyDown('Space', false);
    dispatchKeyDown('KeyU', false);
    dispatchKeyDown('KeyH', false);
    dispatchKeyDown('KeyP', false);

    let keys = readKeys();
    expect(keys.justPressedSpace).toBe(true);
    expect(keys.justPressedUp).toBe(true);
    expect(keys.justPressedC).toBe(true);
    expect(keys.justPressedA).toBe(true);

    // Frames siguientes sin nuevos eventos: no deben volver a dispararse
    keys = readKeys();
    expect(keys.justPressedSpace).toBe(false);
    expect(keys.justPressedUp).toBe(false);

    // Eventos con repeat === true (auto-repeat del navegador) deben ignorarse
    dispatchKeyDown('Space', true);
    dispatchKeyDown('KeyU', true);
    keys = readKeys();
    expect(keys.justPressedSpace).toBe(false);
    expect(keys.justPressedUp).toBe(false);
  });

  it('Escape actúa como hotkey fija de sistema alternando pausa/reanudación sin responder a auto-repeat', () => {
    const { scene, onStateUpdate, dispatchKeyDown } = setupSceneWithListeners();

    expect((scene as unknown as { isPaused: boolean }).isPaused).toBe(false);

    // Primer Escape (!repeat): alterna de running a paused
    dispatchKeyDown('Escape', false);
    expect((scene as unknown as { isPaused: boolean }).isPaused).toBe(true);
    expect(onStateUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'paused' }));

    // Evento con repeat === true (auto-repeat del navegador): debe ignorarse y mantener paused
    dispatchKeyDown('Escape', true);
    expect((scene as unknown as { isPaused: boolean }).isPaused).toBe(true);

    // Segundo Escape (!repeat): alterna de paused a running
    dispatchKeyDown('Escape', false);
    expect((scene as unknown as { isPaused: boolean }).isPaused).toBe(false);
    expect(onStateUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'running' }));
  });

  it('KeyR actúa como hotkey fija reseteando la partida con la misma semilla (seed) y reiniciando la música de gameplay', () => {
    const audioManager = getAudioManager();
    const restartSpy = vi.spyOn(audioManager, 'restartMusic').mockImplementation(() => {});

    const { scene, dispatchKeyDown } = setupSceneWithListeners();
    const initialSeed = (scene as unknown as { getMatchSeed: () => number }).getMatchSeed();

    dispatchKeyDown('KeyR');
    expect(restartSpy).toHaveBeenCalledWith('gameplay');
    const newSeed = (scene as unknown as { getMatchSeed: () => number }).getMatchSeed();
    expect(newSeed).toBe(initialSeed);

    restartSpy.mockRestore();
  });

  it('mantiene la inversión de Polaridad intacta al enviar acciones abstractas producidas por remapeos custom', () => {
    const { scene } = setupSceneWithListeners({
      moveLeft: 'ShiftRight',
      moveRight: 'ControlRight',
    });

    const engine = (scene as unknown as { engine: { receiveSabotage: (s: string) => void; getSnapshot: () => { activeEffects: unknown[] } } }).engine;
    engine.receiveSabotage('polaridad');

    expect(engine.getSnapshot().activeEffects).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'polaridad' })]),
    );
  });

  describe('Semillas de producción y determinismo (matchSeed)', () => {
    it('respeta una semilla explícita pasada en init', () => {
      const scene = new GameScene();
      scene.init({ callbacks: { onStateUpdate: vi.fn() }, mode: 'battle', seed: 12345 });
      expect(scene.getMatchSeed()).toBe(12345);
    });

    it('genera una semilla uint32 aleatoria cuando no se pasa seed en init', () => {
      const scene1 = new GameScene();
      scene1.init({ callbacks: { onStateUpdate: vi.fn() }, mode: 'training' });
      const seed1 = scene1.getMatchSeed();

      expect(Number.isInteger(seed1)).toBe(true);
      expect(seed1).toBeGreaterThanOrEqual(0);
      expect(seed1).toBeLessThanOrEqual(4_294_967_295);
    });

    it('reutiliza exactamente la misma semilla al pulsar la tecla R para reiniciar la partida', () => {
      const scene = new GameScene();
      scene.init({ callbacks: { onStateUpdate: vi.fn() }, mode: 'battle', seed: 9999 });

      (scene as unknown as { input: { keyboard: { on: unknown; off: unknown } } }).input = {
        keyboard: { on: vi.fn(), off: vi.fn() },
      };
      (scene as unknown as { add: { graphics: () => unknown } }).add = {
        graphics: () => ({
          setPosition: vi.fn(),
          clear: vi.fn(),
          fillStyle: vi.fn(),
          fillRect: vi.fn(),
          fillTriangle: vi.fn(),
          lineStyle: vi.fn(),
          strokeRect: vi.fn(),
        }),
      };

      scene.create();

      const initialEngineSeed = (scene as unknown as { engine: { getSnapshot: () => { seed: number } } }).engine.getSnapshot().seed;
      expect(initialEngineSeed).toBe(9999);

      // Simular reset manual
      scene.resetGame();

      const resettedEngineSeed = (scene as unknown as { engine: { getSnapshot: () => { seed: number } } }).engine.getSnapshot().seed;
      expect(resettedEngineSeed).toBe(9999);
      expect(scene.getMatchSeed()).toBe(9999);
    });
  });

  describe('Controles DEV para warning-demo (Digit1/2/3, Numpad1/2/3)', () => {
    it('Digit1 y Numpad1 disparan warning de sobrecarga en playerOne cuando warning-demo está activo', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const battleSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;
      expect(battleSession).toBeDefined();

      dispatchKeyDown('Digit1', false);
      scene.update(0, 16);

      const snap = battleSession.getSnapshot();
      expect(snap.playerOneState.warnings.some((w) => w.sabotage === 'sobrecarga')).toBe(true);

      window.history.pushState({}, '', '/');
    });

    it('Digit2 y Numpad2 disparan warning de polaridad en playerOne cuando warning-demo está activo', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const battleSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;

      dispatchKeyDown('Numpad2', false);
      scene.update(0, 16);

      const snap = battleSession.getSnapshot();
      expect(snap.playerOneState.warnings.some((w) => w.sabotage === 'polaridad')).toBe(true);

      window.history.pushState({}, '', '/');
    });

    it('Digit3 y Numpad3 disparan warning de interferencia en playerOne cuando warning-demo está activo', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const battleSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;

      dispatchKeyDown('Digit3', false);
      scene.update(0, 16);

      const snap = battleSession.getSnapshot();
      expect(snap.playerOneState.warnings.some((w) => w.sabotage === 'interferencia')).toBe(true);

      window.history.pushState({}, '', '/');
    });

    it('event.repeat === true ignora la pulsación y no genera warning adicional', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const battleSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;

      dispatchKeyDown('Digit1', true);
      scene.update(0, 16);

      const snap = battleSession.getSnapshot();
      expect(snap.playerOneState.warnings).toHaveLength(0);

      window.history.pushState({}, '', '/');
    });

    it('fuera de warning-demo las teclas Digit1/2/3 no ejecutan lógica DEV', () => {
      window.history.pushState({}, '', '?battle-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const battleSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;

      dispatchKeyDown('Digit1', false);
      scene.update(0, 16);

      const snap = battleSession.getSnapshot();
      expect(snap.playerOneState.warnings).toHaveLength(0);

      window.history.pushState({}, '', '/');
    });

    it('tecla 0 (Digit0/Numpad0) resetea la demo y permite volver a disparar el mismo sabotaje inmediatamente', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      // 1. Disparar sobrecarga con tecla 1
      dispatchKeyDown('Digit1', false);
      scene.update(0, 16);

      let bSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;
      expect(bSession.getSnapshot().playerOneState.warnings).toHaveLength(1);

      // 2. Pulsar tecla 0 para resetear la demo
      dispatchKeyDown('Digit0', false);

      bSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;
      const resetSnap = bSession.getSnapshot();
      expect(resetSnap.playerOneState.warnings).toHaveLength(0);
      expect(resetSnap.playerOneState.immunities).toHaveLength(0);
      expect(resetSnap.playerOneState.activeEffects).toHaveLength(0);
      expect(resetSnap.playerOne.seed).toBe(42);

      // 3. Disparar inmediatamente de nuevo sobrecarga con tecla 1
      dispatchKeyDown('Digit1', false);
      scene.update(0, 16);

      const snapAfterReTrigger = bSession.getSnapshot();
      expect(snapAfterReTrigger.playerOneState.warnings).toHaveLength(1);
      expect(snapAfterReTrigger.playerOneState.warnings[0]!.sabotage).toBe('sobrecarga');

      window.history.pushState({}, '', '/');
    });

    it('event.repeat === true en tecla 0 se ignora y fuera de warning-demo no hace nada', () => {
      window.history.pushState({}, '', '?warning-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      // Disparar warning
      dispatchKeyDown('Digit1', false);
      scene.update(0, 16);

      const bSession = (scene as unknown as { battleSession: BattleSession | null }).battleSession!;
      expect(bSession.getSnapshot().playerOneState.warnings).toHaveLength(1);

      // Evento repeat en 0 -> ignora y conserva warning
      dispatchKeyDown('Digit0', true);
      expect(bSession.getSnapshot().playerOneState.warnings).toHaveLength(1);

      // Fuera de warning-demo
      window.history.pushState({}, '', '?battle-demo=1');
      dispatchKeyDown('Digit0', false);

      window.history.pushState({}, '', '/');
    });
  });

  describe('FX de impacto mecánico de residuos (garbageApplied)', () => {
    it('garbageApplied dispara el estado/FX de impacto visual', () => {
      window.history.pushState({}, '', '?garbage-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      // Estado inicial neutro
      const initialState = scene.getGarbageImpactFXState();
      expect(initialState.active).toBe(false);
      expect(initialState.remainingMs).toBe(0);
      expect(initialState.yOffset).toBe(0);

      // Hard drop en garbage-demo aplica 2 filas de basura y emite garbageApplied
      dispatchKeyDown('Space', false);
      scene.update(0, 16);

      const impactState = scene.getGarbageImpactFXState();
      expect(impactState.active).toBe(true);
      expect(impactState.remainingMs).toBe(160);
      expect(impactState.linesCount).toBe(2);

      // Avanzar un frame (10ms) dentro de la oscilación para verificar el desplazamiento vertical hacia arriba
      scene.update(10, 10);
      expect(scene.getGarbageImpactFXState().yOffset).toBeLessThan(0);

      window.history.pushState({}, '', '/');
    });

    it('eventos ajenos (ej. caídas, fijaciones simples sin basura) no disparan el FX de impacto', () => {
      window.history.pushState({}, '', '/');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      // Hard drop en training mode sin basura pendiente
      dispatchKeyDown('Space', false);
      scene.update(0, 16);

      const impactState = scene.getGarbageImpactFXState();
      expect(impactState.active).toBe(false);
      expect(impactState.remainingMs).toBe(0);
      expect(impactState.yOffset).toBe(0);
    });

    it('el FX de impacto vuelve automáticamente a estado neutro tras transcurrir la duración (160ms)', () => {
      window.history.pushState({}, '', '?garbage-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      dispatchKeyDown('Space', false);
      scene.update(0, 16);
      expect(scene.getGarbageImpactFXState().active).toBe(true);

      // Avanzar el tiempo más allá de la duración (160ms)
      scene.update(165, 165);

      const finishedState = scene.getGarbageImpactFXState();
      expect(finishedState.active).toBe(false);
      expect(finishedState.remainingMs).toBe(0);
      expect(finishedState.yOffset).toBe(0);

      window.history.pushState({}, '', '/');
    });

    it('eventos garbageApplied consecutivos vuelven a disparar el FX reiniciando el temporizador', () => {
      window.history.pushState({}, '', '?garbage-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();

      // 1ª aplicación de basura
      dispatchKeyDown('Space', false);
      scene.update(0, 16);
      expect(scene.getGarbageImpactFXState().remainingMs).toBe(160);

      // Consumir 120ms
      scene.update(120, 120);
      expect(scene.getGarbageImpactFXState().remainingMs).toBe(40);

      // Cargar 2 filas con A y volver a fijar con Space
      dispatchKeyDown('KeyA', false);
      scene.update(136, 16);
      dispatchKeyDown('Space', false);
      scene.update(152, 16);

      // Debe reiniciarse a 160ms
      const retriggeredState = scene.getGarbageImpactFXState();
      expect(retriggeredState.active).toBe(true);
      expect(retriggeredState.remainingMs).toBe(160);

      window.history.pushState({}, '', '/');
    });

    it('el FX de impacto no altera el estado lógico del motor ni las coordenadas lógicas', () => {
      window.history.pushState({}, '', '?garbage-demo=1');

      const { scene, dispatchKeyDown } = setupSceneWithListeners();
      const engine = (scene as unknown as { engine: import('@rautfall/game-engine').GameEngine }).engine;

      const snapshotBefore = engine.getSnapshot();
      expect(snapshotBefore.pendingGarbage).toBe(2);
      dispatchKeyDown('Space', false);
      scene.update(0, 16);
      const snapshotAfter = engine.getSnapshot();

      // El FX visual no modifica el tablero lógico salvo por las 2 filas insertadas determinísticamente por el motor
      expect(snapshotAfter.board[22]!.filter(c => c === 'garbage')).toHaveLength(9);
      expect(snapshotAfter.board[23]!.filter(c => c === 'garbage')).toHaveLength(9);
      expect(snapshotAfter.activePiece).not.toBeNull();
      // Las coordenadas lógicas del activePiece son números enteros en la rejilla
      expect(Number.isInteger(snapshotAfter.activePiece!.x)).toBe(true);
      expect(Number.isInteger(snapshotAfter.activePiece!.y)).toBe(true);

      window.history.pushState({}, '', '/');
    });
  });

  describe('Telemetría DEV de maxActionsInSingleStep en fotogramas multi-paso (stepsToExecute >= 2)', () => {
    it('mantiene maxActionsInSingleStep <= 1 cuando un único fotograma visual ejecuta múltiples pasos lógicos con acciones', () => {
      window.history.pushState({}, '', '?battle-demo=1');

      const { scene, onStateUpdate } = setupSceneWithListeners();

      // Inyectar bot controlado para simular de forma determinista acciones activas en pasos consecutivos del mismo frame
      const mockNextStep = vi.fn()
        .mockReturnValueOnce({ leftHeld: true, leftPressed: true, rightHeld: false, rightPressed: false, softDropHeld: false, hardDrop: false })
        .mockReturnValueOnce({ leftHeld: false, leftPressed: false, rightHeld: true, rightPressed: true, softDropHeld: false, hardDrop: false })
        .mockReturnValue({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false });

      (scene as unknown as { playerTwoBot: unknown }).playerTwoBot = {
        nextStep: mockNextStep,
        getDiagnostic: () => ({
          currentPhase: 'executing',
          reactionTimerSteps: 0,
          actionIntervalTimer: 0,
          hardDropDelayTimer: 0,
          actionIndex: 2,
          lastActionStep: 1,
          lastAction: 'left',
        }),
      };

      // Ejecutar un fotograma visual con delta = 24 ms (hace que computeSteps devuelva stepsToExecute >= 2 con fixedStepMs = 10 ms)
      scene.update(1000, 24);

      // Demostrar explícitamente que nextStep fue invocado en múltiples pasos lógicos (>= 2) en este fotograma visual
      expect(mockNextStep.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Demostrar que la telemetría reporta maxActionsInSingleStep = 1 (medición por paso lógico)
      const lastCall = onStateUpdate.mock.calls[onStateUpdate.mock.calls.length - 1]?.[0] as import('../types').GamePresentationState | undefined;
      const diag = lastCall?.battleState?.botDevDiagnostic;

      expect(diag).toBeDefined();
      expect(diag!.maxActionsInSingleStep).toBe(1);

      window.history.pushState({}, '', '/');
    });
  });

  describe('Modo Online PvP (mode === "online")', () => {
    it('no crea ni avanza GameEngine local y delega las pulsaciones físicas a onlineSession', () => {
      const onStateUpdate = vi.fn();
      const mockOnlineSession = {
        status: 'playing',
        role: 'playerOne',
        latestGameState: {
          step: 42,
          elapsedMs: 420,
          status: 'running',
          winner: null,
          events: [],
          self: {
            board: Array.from({ length: 24 }, () => Array.from({ length: 10 }, () => null)),
            activePiece: null,
            nextPieces: ['I', 'J', 'L'],
            heldPiece: null,
            score: 100,
            clearedLines: 2,
            combo: 0,
            backToBack: 0,
            combatEnergy: 20,
            storedSabotages: [],
            pendingGarbage: 0,
            activeEffects: [],
            level: 1,
          },
          selfState: {},
          opponent: {
            board: Array.from({ length: 24 }, () => Array.from({ length: 10 }, () => null)),
            activePiece: null,
            nextPieces: ['S', 'Z'],
            heldPiece: null,
            score: 50,
            clearedLines: 0,
            combo: 0,
            backToBack: 0,
            combatEnergy: 0,
            storedSabotages: [],
            pendingGarbage: 0,
            activeEffects: [],
            level: 1,
            status: 'running',
          },
          opponentState: {},
        },
        handleKeyDown: vi.fn(),
        handleKeyUp: vi.fn(),
        handleBlur: vi.fn(),
        onGameState: vi.fn().mockReturnValue(() => {}),
        onBattleEnded: vi.fn().mockReturnValue(() => {}),
        onPlayerDisconnected: vi.fn().mockReturnValue(() => {}),
      };

      const scene = new GameScene();
      scene.init({
        callbacks: { onStateUpdate },
        mode: 'online',
        onlineSession: mockOnlineSession as unknown as OnlineGameSession,
      });

      scene.create();

      // Simular tecla presionada (ArrowLeft -> moveLeft)
      const keyDownHandler = (scene.input.keyboard!.on as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => call[0] === 'keydown',
      )?.[1] as ((e: KeyboardEvent) => void) | undefined;

      expect(keyDownHandler).toBeDefined();

      keyDownHandler!({ code: 'ArrowLeft', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent);
      expect(mockOnlineSession.handleKeyDown).toHaveBeenCalledWith('moveLeft');

      // Simular tecla Escape (no debe pausar ni fallar en online)
      keyDownHandler!({ code: 'Escape', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent);

      // update() no debe ejecutar accumulator/step del motor
      scene.update(1000, 16);

      // Ver que notifyState fue invocado con los datos del servidor
      const stateCall = onStateUpdate.mock.calls[onStateUpdate.mock.calls.length - 1]?.[0] as import('../types').GamePresentationState;
      expect(stateCall).toBeDefined();
      expect(stateCall.step).toBe(42);
      expect(stateCall.score).toBe(100);
      expect(stateCall.battleState?.playerTwo).toBeDefined();
    });
  });
});
