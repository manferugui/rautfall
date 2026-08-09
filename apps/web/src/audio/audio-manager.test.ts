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
    exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
    linearRampToValueAtTime: ReturnType<typeof vi.fn>;
    cancelScheduledValues: ReturnType<typeof vi.fn>;
  };
  connect: ReturnType<typeof vi.fn>;
};

type MockAudioContext = {
  state: string;
  currentTime: number;
  destination: Record<string, unknown>;
  createGain: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createBiquadFilter: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
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
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
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
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'lowpass',
        frequency: {
          setValueAtTime: vi.fn(),
        },
        Q: {
          setValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createBuffer: vi.fn(() => ({
        numberOfChannels: 1,
        length: 48000,
        sampleRate: 48000,
        getChannelData: () => new Float32Array(48000),
      })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
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

  it('procesa eventos de motor de batalla (handleBattleEvent) determinando la variante táctica de sabotaje desde la perspectiva de playerOne', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    // 1. Residuos activados por playerOne
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      step: 20,
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'residuos',
    });
    expect(playSfxSpy).toHaveBeenLastCalledWith('residuesTriggered');

    // 2. Residuos recibidos por playerOne
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      step: 21,
      source: 'playerTwo',
      target: 'playerOne',
      sabotage: 'residuos',
    });
    expect(playSfxSpy).toHaveBeenLastCalledWith('residuesReceived');

    // 3. Sobrecarga recibida por playerOne
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      step: 22,
      source: 'playerTwo',
      target: 'playerOne',
      sabotage: 'sobrecarga',
    });
    expect(playSfxSpy).toHaveBeenLastCalledWith('overloadReceived');

    // 4. Polaridad activada por playerOne
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      step: 23,
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'polaridad',
    });
    expect(playSfxSpy).toHaveBeenLastCalledWith('reversePolarityTriggered');

    // 5. Verificar que participantEvent con sabotageTriggered NO genera un segundo SFX
    playSfxSpy.mockClear();
    manager.handleBattleEvent({
      type: 'participantEvent',
      step: 24,
      participant: 'playerOne',
      event: { type: 'sabotageTriggered', step: 24, sabotage: 'residuos' },
    });
    expect(playSfxSpy).not.toHaveBeenCalled();

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
    expect(playSfxSpy).toHaveBeenCalledWith('victory', { forceSynthetic: true });
  });

  it('activa Ducking de música para prioridades Alta y Terminal y no para prioridades Baja o Media', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    expect(manager.getActiveDuckingPriority()).toBeNull();

    // Prioridad Baja (uiClick): NO debe activar Ducking
    manager.playSfx('uiClick');
    expect(manager.getActiveDuckingPriority()).toBeNull();

    // Prioridad Media (hardDrop): NO debe activar Ducking
    manager.playSfx('hardDrop');
    expect(manager.getActiveDuckingPriority()).toBeNull();

    // Prioridad Alta (quadOrTSpin): DEBE activar Ducking
    manager.playSfx('quadOrTSpin');
    expect(manager.getActiveDuckingPriority()).toBe('high');

    manager.resetDucking();
    expect(manager.getActiveDuckingPriority()).toBeNull();
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

  it('reproduce la muestra procesada de suddenDeathStarted cuando esta cargada en memoria y activa Ducking de prioridad Alta', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockBuffer = {
      duration: 10.0,
      length: 480000,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as unknown as AudioBuffer;

    manager.registerAudioBuffer('suddenDeathStarted', mockBuffer);
    expect(manager.isAssetLoaded('suddenDeathStarted')).toBe(true);

    vi.spyOn(performance, 'now').mockReturnValue(5000);
    manager.playSfx('suddenDeathStarted');

    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();
    expect(manager.getActiveDuckingPriority()).toBe('high');
  });

  it('recurre transparentemente al fallback sintético sin lanzar excepción si la carga del asset falla', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    // Simular fallo de fetch
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Fallo de red simulado')));

    vi.spyOn(performance, 'now').mockReturnValue(10000);
    expect(() => manager.playSfx('suddenDeathStarted')).not.toThrow();

    // Debe haber usado el oscilador sintético de fallback
    expect(mockAudioContext.createOscillator).toHaveBeenCalled();
  });

  it('respera la opcion forceSynthetic para audicionar el fallback sintetico aunque el asset esté cargado', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockBuffer = { duration: 3.2 } as unknown as AudioBuffer;
    manager.registerAudioBuffer('suddenDeathStarted', mockBuffer);

    vi.spyOn(performance, 'now').mockReturnValue(15000);
    const oscCountBefore = mockAudioContext.createOscillator.mock.calls.length;

    manager.playSfx('suddenDeathStarted', { forceSynthetic: true });
    expect(mockAudioContext.createOscillator.mock.calls.length).toBeGreaterThan(oscCountBefore);
  });

  it('reproduce la musica de victoria Sector Secured al ganar la batalla y detiene con fade-out al cambiar', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockMusicBuffer = {
      duration: 16.0,
      length: 768000,
      sampleRate: 48000,
      numberOfChannels: 2,
    } as unknown as AudioBuffer;

    manager.registerMusicBuffer('victory', mockMusicBuffer);
    expect(manager.isMusicLoaded('victory')).toBe(true);

    manager.handleBattleEvent({
      type: 'battleEnded',
      winner: 'playerOne',
      step: 100,
    });

    expect(manager.getCurrentMusicTrack()).toBe('victory');
    expect(mockAudioContext.createBufferSource).toHaveBeenCalled();

    // Fade-out al detener
    manager.stopMusic({ fadeOutDurationMs: 600 });
    expect(manager.getCurrentMusicTrack()).toBeNull();
  });

  it('mapea correctamente el sabotaje Residuos enviado o recibido desde la perspectiva de playerOne', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockBufferTriggered = { duration: 0.38 } as unknown as AudioBuffer;
    const mockBufferReceived = { duration: 0.90 } as unknown as AudioBuffer;
    manager.registerAudioBuffer('residuesTriggered', mockBufferTriggered);
    manager.registerAudioBuffer('residuesReceived', mockBufferReceived);

    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    // Envío de residuos por playerOne
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'residuos',
      step: 50,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('residuesTriggered');

    // Recepción de residuos por playerOne
    vi.spyOn(performance, 'now').mockReturnValue(20000);
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerTwo',
      target: 'playerOne',
      sabotage: 'residuos',
      step: 55,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('residuesReceived');
  });

  it('mapea correctamente el sabotaje Sobrecarga enviado o recibido desde la perspectiva de playerOne', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockBufferTriggered = { duration: 0.35 } as unknown as AudioBuffer;
    const mockBufferReceived = { duration: 0.85 } as unknown as AudioBuffer;
    manager.registerAudioBuffer('overloadTriggered', mockBufferTriggered);
    manager.registerAudioBuffer('overloadReceived', mockBufferReceived);

    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    // Envío de sobrecarga por playerOne
    vi.spyOn(performance, 'now').mockReturnValue(30000);
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'sobrecarga',
      step: 60,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('overloadTriggered');

    // Recepción de sobrecarga por playerOne
    vi.spyOn(performance, 'now').mockReturnValue(35000);
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerTwo',
      target: 'playerOne',
      sabotage: 'sobrecarga',
      step: 65,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('overloadReceived');
  });

  it('mapea correctamente el sabotaje Polaridad Inversa enviado o recibido desde la perspectiva de playerOne', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    const mockBufferTriggered = { duration: 0.48 } as unknown as AudioBuffer;
    const mockBufferReceived = { duration: 0.85 } as unknown as AudioBuffer;
    manager.registerAudioBuffer('reversePolarityTriggered', mockBufferTriggered);
    manager.registerAudioBuffer('reversePolarityReceived', mockBufferReceived);

    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    // Envío de polaridad inversa por playerOne
    vi.spyOn(performance, 'now').mockReturnValue(40000);
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerOne',
      target: 'playerTwo',
      sabotage: 'polaridad',
      step: 70,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('reversePolarityTriggered');

    // Recepción de polaridad inversa por playerOne
    vi.spyOn(performance, 'now').mockReturnValue(45000);
    manager.handleBattleEvent({
      type: 'sabotageRouted',
      source: 'playerTwo',
      target: 'playerOne',
      sabotage: 'polaridad',
      step: 75,
    });
    expect(playSfxSpy).toHaveBeenCalledWith('reversePolarityReceived');
  });

  it('gestiona Menu BGM respetando unlock diferido, loop, deduplicación, transiciones y silent fallback', async () => {
    const manager = AudioManager.getInstance();

    // 1. Menu BGM no arranca antes de unlock()
    manager.playMusic('menu');
    expect(manager.getCurrentMusicTrack()).toBe('menu');
    expect(mockAudioContext.createBufferSource).not.toHaveBeenCalled();

    // 2. Registrar buffer de prueba para menú y ejecutar unlock()
    const mockMenuBuffer = {
      duration: 30.0,
      length: 1440000,
      sampleRate: 48000,
      numberOfChannels: 2,
    } as unknown as AudioBuffer;
    manager.registerMusicBuffer('menu', mockMenuBuffer);
    expect(manager.isMusicLoaded('menu')).toBe(true);

    await manager.unlock();

    // Debe haber iniciado el source de menú con loop = true
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);
    const lastSourceCallIndex = mockAudioContext.createBufferSource.mock.results.length - 1;
    const createdSource = mockAudioContext.createBufferSource.mock.results[lastSourceCallIndex]?.value as { loop: boolean };
    expect(createdSource.loop).toBe(true);

    // 3. Rerender / llamadas repetidas a playMusic('menu') no reinician la pista activa
    manager.playMusic('menu');
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(1);

    // 4. Transición a modo juego (menu -> playing) desvanece y detiene la música de menú
    manager.playMusic('gameplay');
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 5. Vuelta al menú desvanece la música de gameplay e inicia Menu BGM de forma limpia
    manager.playMusic('menu');
    expect(manager.getCurrentMusicTrack()).toBe('menu');
    expect(mockAudioContext.createBufferSource).toHaveBeenCalledTimes(2);

    // 6. Transición a resultados (Results/Victory) no solapa con Menu BGM
    manager.handleBattleEvent({
      type: 'battleEnded',
      winner: 'playerOne',
      step: 100,
    });
    expect(manager.getCurrentMusicTrack()).toBe('victory');
  });

  it('gestiona la transición Gameplay -> Sudden Death, ducking de la alarma EAS (-10 dB) y recuperación suave', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();

    // 1. Registrar buffers sintéticos para gameplay, suddenDeath y suddenDeathStarted
    const mockBuffer = {
      duration: 10.0,
      length: 480000,
      sampleRate: 48000,
      numberOfChannels: 2,
    } as unknown as AudioBuffer;

    manager.registerMusicBuffer('gameplay', mockBuffer);
    manager.registerMusicBuffer('suddenDeath', mockBuffer);

    // Iniciar Gameplay BGM
    manager.playMusic('gameplay');
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 2. Disparar evento suddenDeathStarted (Transición Gameplay -> Sudden Death + alarma EAS)
    const playSfxSpy = vi.spyOn(manager, 'playSfx');
    manager.handleBattleEvent({
      type: 'suddenDeathStarted',
      step: 200,
    });

    expect(manager.getCurrentMusicTrack()).toBe('suddenDeath');
    expect(playSfxSpy).toHaveBeenCalledWith('suddenDeathStarted');

    // 3. Verificar que battleEnded (Victoria / Derrota) resetea el ducking y limpia el track activo
    manager.handleBattleEvent({
      type: 'battleEnded',
      winner: 'playerTwo',
      step: 250,
    });

    expect(manager.getCurrentMusicTrack()).toBeNull();
  });

  it('respeta la atenuación composable manteniendo la ganancia mínima (atenuación más fuerte) ante solapamientos', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const musicGainNode = manager.getMusicGainNode() as unknown as MockGainNode;
    expect(musicGainNode).not.toBeNull();

    // 1. Alarma EAS activa (-10 dB -> 0.3162)
    manager.handleBattleEvent({ type: 'suddenDeathStarted', step: 10 });
    const callsAfterEas = musicGainNode.gain.linearRampToValueAtTime.mock.calls;
    const lastEasRamp = callsAfterEas[callsAfterEas.length - 1];
    expect(lastEasRamp?.[0]).toBeCloseTo(0.3162, 3);

    // 2. Ocurre sabotaje HIGH (-6 dB -> 0.501) durante la alarma EAS: NO eleva la ganancia a 0.501
    manager.playSfx('residuesTriggered');
    const callsAfterSabotage = musicGainNode.gain.linearRampToValueAtTime.mock.calls;
    const lastSabotageRamp = callsAfterSabotage[callsAfterSabotage.length - 1];
    // La ganancia sigue evaluándose en 0.3162 (la solicitud más fuerte se mantiene)
    expect(lastSabotageRamp?.[0]).toBeCloseTo(0.3162, 3);

    // 3. resetDucking devuelve la ganancia inmediatamente al volumen nominal (1.0)
    manager.resetDucking();
    expect(musicGainNode.gain.setValueAtTime).toHaveBeenLastCalledWith(1.0, expect.any(Number));
  });

  it('permanece funcional y en silencio (silent fallback) cuando los ficheros BGM no están presentes', async () => {
    const manager = AudioManager.getInstance();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await manager.unlock();

    expect(() => {
      manager.playMusic('menu');
      manager.playMusic('gameplay');
      manager.playMusic('suddenDeath');
    }).not.toThrow();

    expect(manager.getCurrentMusicTrack()).toBe('suddenDeath');
  });

  it('destruye el gestor de audio limpiamente sin dejar recursos activos', async () => {
    const manager = AudioManager.getInstance();
    await manager.unlock();
    const ctx = manager.getAudioContext();

    manager.destroy();

    expect(ctx?.close).toHaveBeenCalled();
    expect(manager.getAudioContext()).toBeNull();
  });

  it('restartMusic() reinicia la pista seleccionada desde offset 0 sin violar mute ni desbloqueo diferido', async () => {
    const manager = AudioManager.getInstance();
    const mockBuffer = {
      duration: 30,
      length: 1440000,
      sampleRate: 48000,
      numberOfChannels: 2,
    } as unknown as AudioBuffer;

    manager.registerMusicBuffer('gameplay', mockBuffer);
    manager.registerMusicBuffer('suddenDeath', mockBuffer);
    manager.registerMusicBuffer('victory', mockBuffer);

    // 1. Contexto no inicializado: restartMusic no crea ni desbloquea AudioContext
    manager.restartMusic('gameplay');
    expect(manager.getAudioContextState()).toBe('uninitialized');
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 2. Desbloquear contexto
    await manager.unlock();
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 3. Reiniciar la misma pista 'gameplay': crea una nueva reproducción desde 0
    expect(() => manager.restartMusic('gameplay')).not.toThrow();
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 4. Cambiar a suddenDeath BGM y luego ejecutar restartMusic('gameplay')
    manager.playMusic('suddenDeath');
    expect(manager.getCurrentMusicTrack()).toBe('suddenDeath');

    manager.restartMusic('gameplay');
    expect(manager.getCurrentMusicTrack()).toBe('gameplay');

    // 5. Mute activo: conserva mute y buses
    manager.setMuted(true);
    expect(manager.isMuted()).toBe(true);
    expect(() => manager.restartMusic('gameplay')).not.toThrow();
    expect(manager.isMuted()).toBe(true);
  });
});
