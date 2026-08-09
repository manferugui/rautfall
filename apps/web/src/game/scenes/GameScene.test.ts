// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => {
  class MockScene {
    events = { once: vi.fn(), off: vi.fn() };
    input = { keyboard: { on: vi.fn(), off: vi.fn(), addKey: vi.fn().mockReturnValue({ isDown: false }) } };
    add = { graphics: () => ({ setPosition: vi.fn() }) };
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
      Input: {
        Keyboard: {
          JustDown: vi.fn().mockReturnValue(false),
          KeyCodes: {
            LEFT: 37,
            RIGHT: 39,
            UP: 38,
            DOWN: 40,
            SPACE: 32,
            Z: 90,
            R: 82,
            ESC: 27,
            C: 67,
            A: 65,
          },
        },
      },
    },
  };
});

import { getAudioManager } from '../../audio';
import { GameScene } from './GameScene';

describe('GameScene — Desbloqueo de Audio en la interacción de usuario', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no crea ansiosamente el AudioContext durante la instanciación de la escena', () => {
    const audioManager = getAudioManager();
    expect(audioManager.getAudioContextState()).toBe('uninitialized');
    new GameScene();
    expect(audioManager.getAudioContextState()).toBe('uninitialized');
  });

  it('invoca audioManager.unlock() al recibir un evento de teclado keydown sin consumir la acción de juego', () => {
    const audioManager = getAudioManager();
    const unlockSpy = vi.spyOn(audioManager, 'unlock').mockResolvedValue(undefined);

    let keydownListener: ((event: KeyboardEvent) => void) | null = null;

    const mockKeyboard = {
      addKey: vi.fn().mockReturnValue({ isDown: false }),
      on: vi.fn().mockImplementation((event: string, handler: (e: KeyboardEvent) => void) => {
        if (event === 'keydown') {
          keydownListener = handler;
        }
      }),
      off: vi.fn(),
    };

    const scene = new GameScene();
    scene.init({ callbacks: { onStateUpdate: vi.fn() }, mode: 'training' });

    (scene as unknown as { input: { keyboard: typeof mockKeyboard } }).input = {
      keyboard: mockKeyboard,
    };
    (scene as unknown as { add: { graphics: () => { setPosition: () => void } } }).add = {
      graphics: () => ({ setPosition: vi.fn() }),
    };

    scene.create();

    expect(keydownListener).not.toBeNull();

    const mockEvent = { code: 'ArrowLeft', repeat: false } as KeyboardEvent;
    keydownListener!(mockEvent);

    expect(unlockSpy).toHaveBeenCalledTimes(1);

    // Verificar que la acción de juego normal se procesó (pendingHorizontal cambió a 'left')
    expect((scene as unknown as { pendingHorizontal: string }).pendingHorizontal).toBe('left');

    unlockSpy.mockRestore();
  });

  it('invoca getAudioManager().restartMusic("gameplay") al reiniciar la escena mediante resetGame() conservando el reset lógico', () => {
    const audioManager = getAudioManager();
    const restartSpy = vi.spyOn(audioManager, 'restartMusic');

    const scene = new GameScene();
    const onStateUpdateSpy = vi.fn();
    scene.init({ callbacks: { onStateUpdate: onStateUpdateSpy }, mode: 'training' });

    (scene as unknown as { add: { graphics: () => { setPosition: () => void } } }).add = {
      graphics: () => ({ setPosition: vi.fn() }),
    };

    scene.create();
    onStateUpdateSpy.mockClear();

    scene.resetGame();

    expect(restartSpy).toHaveBeenCalledWith('gameplay');
    expect(onStateUpdateSpy).toHaveBeenCalled();

    restartSpy.mockRestore();
  });
});
