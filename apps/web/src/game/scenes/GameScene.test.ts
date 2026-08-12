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

  it('KeyR actúa como hotkey fija reseteando la partida y reiniciando la música de gameplay', () => {
    const audioManager = getAudioManager();
    const restartSpy = vi.spyOn(audioManager, 'restartMusic').mockImplementation(() => {});

    const { dispatchKeyDown } = setupSceneWithListeners();

    dispatchKeyDown('KeyR');
    expect(restartSpy).toHaveBeenCalledWith('gameplay');

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
});
