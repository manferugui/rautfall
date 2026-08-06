// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManager } from './audio-manager';
import type { AudioSfxType } from './types';
import type { EngineEvent } from '@rautfall/game-engine';
import type { BattleEvent } from '@rautfall/battle-engine';

type MockGainNode = {
  gain: {
    value: number;
    setValueAtTime: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
};

type MockAudioContext = {
  state: string;
  currentTime: number;
  destination: Record<string, unknown>;
  createGain: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

describe('AudioManager', () => {
  let mockAudioContext: MockAudioContext;
  let mockGainNode: MockGainNode;

  beforeEach(() => {
    localStorage.clear();
    AudioManager.resetInstance();

    mockGainNode = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn((val: number) => {
          mockGainNode.gain.value = val;
        }),
      },
      connect: vi.fn(),
    };

    mockAudioContext = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      createGain: vi.fn(() => mockGainNode),
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      resume: vi.fn().mockImplementation(async () => {
        mockAudioContext.state = 'running';
      }),
      close: vi.fn().mockImplementation(async () => {
        mockAudioContext.state = 'closed';
      }),
    };

    const MockAudioCtx = vi.fn().mockImplementation(function (this: unknown) {
      return mockAudioContext;
    });
    vi.stubGlobal('AudioContext', MockAudioCtx);
    vi.stubGlobal('webkitAudioContext', MockAudioCtx);
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'AudioContext', { value: MockAudioCtx, writable: true, configurable: true });
      Object.defineProperty(window, 'webkitAudioContext', { value: MockAudioCtx, writable: true, configurable: true });
    }
  });

  afterEach(() => {
    AudioManager.resetInstance();
    vi.restoreAllMocks();
  });

  it('no construye el AudioContext al obtener la instancia mediante getInstance() o getAudioManager()', () => {
    const manager = AudioManager.getInstance();
    expect(manager.getAudioContext()).toBeNull();
  });

  it('construye el AudioContext una sola vez tras unlock() de forma idempotente', async () => {
    const manager = AudioManager.getInstance();
    expect(manager.getAudioContext()).toBeNull();

    await manager.unlock();
    const ctx1 = manager.getAudioContext();
    expect(ctx1).toBe(mockAudioContext);

    await manager.unlock();
    const ctx2 = manager.getAudioContext();
    expect(ctx2).toBe(ctx1);
  });

  it('desbloquea el AudioContext suspendido tras llamar a unlock()', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1);
    expect(mockAudioContext.state).toBe('running');
  });

  it('persiste el estado de silencio (mute) en localStorage', async () => {
    const manager = AudioManager.getInstance();
    expect(manager.isMuted()).toBe(false);

    const newMutedState = manager.toggleMute();
    expect(newMutedState).toBe(true);
    expect(manager.isMuted()).toBe(true);
    expect(localStorage.getItem('rautfall_audio_muted')).toBe('true');

    await manager.unlock();
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, mockAudioContext.currentTime);

    manager.setMuted(false);
    expect(manager.isMuted()).toBe(false);
    expect(localStorage.getItem('rautfall_audio_muted')).toBe('false');
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(1, mockAudioContext.currentTime);
  });

  it('inicializa el estado de mute desde localStorage al arrancar', async () => {
    localStorage.setItem('rautfall_audio_muted', 'true');
    const manager = AudioManager.getInstance();

    expect(manager.isMuted()).toBe(true);
    await manager.unlock();
    expect(mockGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, mockAudioContext.currentTime);
  });

  it('reproduce SFX sintéticos sin error cuando el AudioContext está activo', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const sfxTypes: AudioSfxType[] = [
      'hardDrop',
      'pieceLocked',
      'linesCleared',
      'quadOrTSpin',
      'sabotageTriggered',
      'suddenDeathWarning',
      'suddenDeathStarted',
      'gameOver',
      'victory',
      'uiClick',
    ];

    sfxTypes.forEach((type, idx) => {
      // Avanzar tiempo para evitar deduplicación
      vi.spyOn(performance, 'now').mockReturnValue(idx * 100);
      expect(() => manager.playSfx(type)).not.toThrow();
    });

    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
  });

  it('aplica deduplicación (cooldown) e impide reproducir el mismo SFX repetidamente en menos de 40ms', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    vi.spyOn(performance, 'now').mockReturnValue(1000);
    manager.playSfx('hardDrop');
    const countAfterFirst = mockAudioContext.createOscillator.mock.calls.length;

    // Llamada inmediata en el mismo tick (1005ms < 1000ms + 40ms)
    vi.spyOn(performance, 'now').mockReturnValue(1005);
    manager.playSfx('hardDrop');

    expect(mockAudioContext.createOscillator.mock.calls.length).toBe(countAfterFirst);
  });

  it('procesa eventos de motor de juego (handleEngineEvent) correctamente', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const moveEvent: EngineEvent = { type: 'pieceMoved', step: 10, reason: 'hardDrop' };
    manager.handleEngineEvent(moveEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('hardDrop');

    const lockEvent: EngineEvent = { type: 'pieceLocked', step: 11, piece: 'I' };
    manager.handleEngineEvent(lockEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('pieceLocked');

    const lineEvent: EngineEvent = { type: 'linesCleared', step: 12, lines: 2, lineIndices: [20, 21] };
    manager.handleEngineEvent(lineEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('linesCleared');

    const quadEvent: EngineEvent = { type: 'linesCleared', step: 13, lines: 4, lineIndices: [20, 21, 22, 23] };
    manager.handleEngineEvent(quadEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('quadOrTSpin');
  });

  it('procesa eventos de motor de batalla (handleBattleEvent) correctamente', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const routedEvent: BattleEvent = {
      type: 'sabotageRouted',
      step: 20,
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'residuos',
    };
    manager.handleBattleEvent(routedEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('sabotageTriggered');

    const warningEvent: BattleEvent = {
      type: 'suddenDeathWarning',
      step: 25,
      warningRemainingMs: 15000,
    };
    manager.handleBattleEvent(warningEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('suddenDeathWarning');

    const endedEvent: BattleEvent = {
      type: 'battleEnded',
      step: 30,
      winner: 'playerOne',
    };
    manager.handleBattleEvent(endedEvent);
    expect(playSfxSpy).toHaveBeenCalledWith('victory');
  });

  it('soporta la API musical (playMusic, stopMusic, setMusicIntensity) sin assets, fetch ni errores 404', () => {
    const manager = AudioManager.getInstance();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const consoleErrorSpy = vi.spyOn(console, 'error');

    expect(() => {
      manager.playMusic('menu');
      manager.setMusicIntensity(0.8);
      expect(manager.getCurrentMusicTrack()).toBe('menu');
      expect(manager.getMusicIntensity()).toBe(0.8);
      manager.playMusic('gameplay');
      expect(manager.getCurrentMusicTrack()).toBe('gameplay');
      manager.stopMusic();
      expect(manager.getCurrentMusicTrack()).toBeNull();
    }).not.toThrow();

    expect(fetchSpy).not.toThrow();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('degrada de forma totalmente segura si Web Audio API no está disponible en el navegador', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    AudioManager.resetInstance();

    const manager = AudioManager.getInstance();
    expect(manager.getAudioContext()).toBeNull();

    expect(() => {
      void manager.unlock();
      manager.playSfx('hardDrop');
      manager.setMuted(true);
      manager.destroy();
    }).not.toThrow();
  });

  it('destruye el gestor de audio limpiamente sin dejar recursos activos', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const ctx = manager.getAudioContext();

    manager.destroy();

    expect(ctx?.close).toHaveBeenCalled();
    expect(manager.getAudioContext()).toBeNull();
  });
});
