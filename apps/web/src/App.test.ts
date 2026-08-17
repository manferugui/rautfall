// @vitest-environment jsdom
/**
 * Pruebas de integración de App.vue con controlador Phaser simulado y flujo unificado de ResultsModal + Firma arcade.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import App from './App.vue';
import { createAppRouter } from './router';
import type { GamePresentationState } from './game/types';
import * as clientModule from './api/client';
import { AudioManager } from './audio/audio-manager';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  togglePause: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('./game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

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

describe('App.vue — flujo web de modos, resultados, firma arcade unificada e idempotencia', () => {
  let mockAudioContext: MockAudioContext;
  let mockGainNode: MockGainNode;

  beforeEach(() => {
    localStorage.clear();
    AudioManager.resetInstance();
    vi.clearAllMocks();

    mockGainNode = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
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
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'lowpass',
        frequency: { setValueAtTime: vi.fn() },
        Q: { setValueAtTime: vi.fn() },
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

  function mountApp(initialRoute = '/', hasActiveResult?: () => boolean): { wrapper: ReturnType<typeof mount>; router: ReturnType<typeof createAppRouter> } {
    const router = createAppRouter({
      history: createMemoryHistory(),
      hasActiveResult,
    });
    void router.push(initialRoute);
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          NextPiecesPreview: true,
          ScorePanel: true,
          OpponentMonitor: true,
          CombatStatusPanel: true,
        },
      },
    });
    return { wrapper, router };
  }

  async function flushRouter(wrapper: ReturnType<typeof mount>): Promise<void> {
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await wrapper.vm.$nextTick();
  }

  it('arranca por defecto en la pantalla de Menú Principal (ModeSelector)', async () => {
    const { wrapper, router } = mountApp();
    await router.isReady();
    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(false);
    expect(router.currentRoute.value.name).toBe('home');
    wrapper.unmount();
  });

  it('permite navegar libremente a Batalla, Entrenamiento, Historial y Ranking sin solicitar tag previo', async () => {
    vi.spyOn(clientModule, 'getMatchHistory').mockResolvedValue([]);
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);

    const { wrapper, router } = mountApp();
    await router.isReady();

    // 1. Abrir Historial sin tag
    await wrapper.find('[data-testid="open-history-button"]').trigger('click');
    await flushRouter(wrapper);
    expect(router.currentRoute.value.name).toBe('history');
    expect(wrapper.find('[data-testid="history-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    await wrapper.find('[data-testid="history-back-button"]').trigger('click');
    await flushRouter(wrapper);
    expect(router.currentRoute.value.name).toBe('home');

    // 2. Abrir Ranking sin tag
    await wrapper.find('[data-testid="open-ranking-button"]').trigger('click');
    await flushRouter(wrapper);
    expect(router.currentRoute.value.name).toBe('ranking');
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    await wrapper.find('[data-testid="ranking-back-button"]').trigger('click');
    await flushRouter(wrapper);
    expect(router.currentRoute.value.name).toBe('home');

    // 3. Iniciar Batalla sin tag
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');
    await flushRouter(wrapper);
    expect(router.currentRoute.value.name).toBe('battle');
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('al terminar partida muestra ResultsModal con iniciales integradas y nunca abre un segundo popup', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    const { wrapper, router } = mountApp();
    await router.isReady();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');
    await flushRouter(wrapper);

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const gameOverState: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
      score: 850,
      clearedLines: 8,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
      activeEffects: [],
      level: 2,
      baseGravityCellsPerSecond: 1.25,
      activeGravityCellsPerSecond: 1.25,
    };
    stateUpdateCallback(gameOverState);
    await flushRouter(wrapper);

    // Muestra pantalla de resultados con la firma de operador integrada en el propio modal
    expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-signature-block"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    expect(submitSpy).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('escribir en Results no altera localStorage de inmediato y confirma el POST guardando el tag solo si la API responde OK', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);

    const { wrapper, router } = mountApp();
    await router.isReady();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');
    await flushRouter(wrapper);

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await flushRouter(wrapper);

    // Escribir iniciales 'RAU' en la pantalla de Results
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    // Comprobar que localStorage aún NO se ha actualizado
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();

    // Confirmar resultado
    await wrapper.find('[data-testid="confirm-save-button"]').trigger('click');
    await flushRouter(wrapper);

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        playerName: 'RAU',
        score: 850,
        linesCleared: 8,
      }),
    );

    // Tras el POST exitoso, el tag local se guarda y navega automáticamente a Ranking
    expect(localStorage.getItem('rautfall_player_tag')).toBe('RAU');
    await flushRouter(wrapper);
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('si la API falla, el tag persistente no cambia, las iniciales editadas se conservan y no abre Ranking', async () => {
    vi.spyOn(clientModule, 'submitMatch').mockRejectedValue(new Error('Network error'));

    const { wrapper, router } = mountApp();
    await router.isReady();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');
    await flushRouter(wrapper);

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await flushRouter(wrapper);

    // Escribir 'RAU'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    // Intentar guardar
    await wrapper.find('[data-testid="confirm-save-button"]').trigger('click');
    await flushRouter(wrapper);

    // Results permanece abierto en estado de error
    expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="save-status-tag"]').text()).toContain('ERROR AL PERSISTIR');

    // Las iniciales editadas 'RAU' se conservan en pantalla pero localStorage no se ha alterado
    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();

    wrapper.unmount();
  });

  it('abandonar Results mediante Volver a jugar limpia pendingMatchResult y no arrastra datos a la siguiente partida', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    const { wrapper, router } = mountApp();
    await router.isReady();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');
    await flushRouter(wrapper);

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await flushRouter(wrapper);

    // Pulsar 'Volver a jugar' sin confirmar
    await wrapper.find('[data-testid="replay-button"]').trigger('click');
    await flushRouter(wrapper);

    expect(submitSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);

    wrapper.unmount();
  });

  describe('Flujo de Activación de Audio e Integración del Modal Industrial en App.vue', () => {
    it('1. el modal aparece al arrancar si audioManager.isUnlocked() es false', () => {
      const manager = AudioManager.getInstance();
      expect(manager.isUnlocked()).toBe(false);

      const { wrapper } = mountApp();
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="keep-silent-button"]').exists()).toBe(true);
      wrapper.unmount();
    });

    it('2. el modal no aparece si el audio ya está desbloqueado', async () => {
      const manager = AudioManager.getInstance();
      await manager.unlock();
      expect(manager.isUnlocked()).toBe(true);

      const { wrapper } = mountApp();
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('3, 4 y 5. INICIALIZAR AUDIO llama a unlock(), mantiene el modal durante la promesa y lo cierra al terminar', async () => {
      const manager = AudioManager.getInstance();
      let resolveUnlock!: () => void;
      const unlockPromise = new Promise<void>((resolve) => {
        resolveUnlock = resolve;
      });
      const unlockSpy = vi.spyOn(manager, 'unlock').mockImplementation(async () => {
        await unlockPromise;
        (manager as unknown as { unlocked: boolean }).unlocked = true;
      });

      const { wrapper } = mountApp();
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);

      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      expect(unlockSpy).toHaveBeenCalledTimes(1);

      // Mientras unlock() está pendiente, el modal permanece abierto
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);

      resolveUnlock();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      // Al resolverse correctamente, el modal se cierra
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('6. tras un unlock() correcto invoca la reconciliación de BGM de la pantalla actual', async () => {
      const manager = AudioManager.getInstance();
      const playMusicSpy = vi.spyOn(manager, 'playMusic');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(playMusicSpy).toHaveBeenCalledWith('menu');
      wrapper.unmount();
    });

    it('7 y 8. SEGUIR EN SILENCIO cierra el modal sin llamar a unlock() ni BGM y no reaparece durante la navegación', async () => {
      const manager = AudioManager.getInstance();
      const unlockSpy = vi.spyOn(manager, 'unlock');
      const playMusicSpy = vi.spyOn(manager, 'playMusic');

      const { wrapper } = mountApp();
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);

      await wrapper.find('[data-testid="keep-silent-button"]').trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      expect(unlockSpy).not.toHaveBeenCalled();
      expect(playMusicSpy).not.toHaveBeenCalled();
      expect(manager.isUnlocked()).toBe(false);

      // Navegar libremente no reabre el modal
      await wrapper.find('[data-testid="open-settings-button"]').trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('9. si unlock() rechaza, el modal permanece abierto, muestra error, no BGM ni click, y permite reintentar', async () => {
      const manager = AudioManager.getInstance();
      const unlockSpy = vi.spyOn(manager, 'unlock').mockRejectedValueOnce(new Error('Audio unlock rejected'));
      const playSfxSpy = vi.spyOn(manager, 'playSfx');
      const playMusicSpy = vi.spyOn(manager, 'playMusic');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(unlockSpy).toHaveBeenCalledTimes(1);
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="audio-error-indicator"]').exists()).toBe(true);
      expect(playSfxSpy).not.toHaveBeenCalled();
      expect(playMusicSpy).not.toHaveBeenCalled();

      // Permitir reintento tras fallo
      unlockSpy.mockImplementationOnce(async () => {
        (manager as unknown as { unlocked: boolean }).unlocked = true;
      });
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('10. INICIALIZAR AUDIO desbloquea el sistema sin sobrescribir preferencias persistidas y reproduce uiClick tras éxito', async () => {
      const manager = AudioManager.getInstance();
      manager.setMuted(true);
      expect(manager.isMuted()).toBe(true);
      expect(localStorage.getItem('rautfall_audio_muted')).toBe('true');

      const unlockSpy = vi.spyOn(manager, 'unlock');
      const playSfxSpy = vi.spyOn(manager, 'playSfx');
      const playMusicSpy = vi.spyOn(manager, 'playMusic');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(unlockSpy).toHaveBeenCalled();
      expect(manager.isUnlocked()).toBe(true);
      expect(manager.isMuted()).toBe(true);
      expect(localStorage.getItem('rautfall_audio_muted')).toBe('true');
      expect(playSfxSpy).toHaveBeenCalledWith('uiClick');
      expect(playMusicSpy).toHaveBeenCalledWith('menu');
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('11. si unlock() falla, el estado de mute y la preferencia persistida permanecen inalterados', async () => {
      const manager = AudioManager.getInstance();
      manager.setMuted(true);
      vi.spyOn(manager, 'unlock').mockRejectedValueOnce(new Error('Unlock failed'));
      const setMutedSpy = vi.spyOn(manager, 'setMuted');
      const playSfxSpy = vi.spyOn(manager, 'playSfx');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(manager.isMuted()).toBe(true);
      expect(localStorage.getItem('rautfall_audio_muted')).toBe('true');
      expect(setMutedSpy).not.toHaveBeenCalled();
      expect(playSfxSpy).not.toHaveBeenCalled();
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(true);
      wrapper.unmount();
    });

    it('12. si el estado inicial ya es muted = false, INICIALIZAR AUDIO mantiene el audio no silenciado sin errores', async () => {
      const manager = AudioManager.getInstance();
      manager.setMuted(false);
      expect(manager.isMuted()).toBe(false);

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="initialize-audio-button"]').trigger('click');
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();

      expect(manager.isUnlocked()).toBe(true);
      expect(manager.isMuted()).toBe(false);
      expect(wrapper.find('[data-testid="initialize-audio-button"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('13. SEGUIR EN SILENCIO no modifica la preferencia de mute persistida ni invoca unlock()', async () => {
      const manager = AudioManager.getInstance();
      manager.setMuted(true);
      const unlockSpy = vi.spyOn(manager, 'unlock');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="keep-silent-button"]').trigger('click');
      await wrapper.vm.$nextTick();

      expect(unlockSpy).not.toHaveBeenCalled();
      expect(manager.isMuted()).toBe(true);
      expect(localStorage.getItem('rautfall_audio_muted')).toBe('true');
      wrapper.unmount();
    });

    it('14. permite alternar independientemente los canales de Música y SFX mediante los botones de la cabecera', async () => {
      const manager = AudioManager.getInstance();
      await manager.unlock();

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="start-training-button"]').trigger('click');
      await flushRouter(wrapper);

      const musicBtn = wrapper.find('[data-testid="music-toggle-button"]');
      const sfxBtn = wrapper.find('[data-testid="sfx-toggle-button"]');

      expect(musicBtn.text()).toContain('MÚSICA: ON');
      expect(sfxBtn.text()).toContain('SFX: ON');

      await musicBtn.trigger('click');
      expect(manager.isMusicEnabled()).toBe(false);
      expect(manager.isSfxEnabled()).toBe(true);
      expect(musicBtn.text()).toContain('MÚSICA: OFF');
      expect(sfxBtn.text()).toContain('SFX: ON');

      await sfxBtn.trigger('click');
      expect(manager.isMusicEnabled()).toBe(false);
      expect(manager.isSfxEnabled()).toBe(false);
      expect(sfxBtn.text()).toContain('SFX: OFF');

      wrapper.unmount();
    });

    it('14. orquesta la compuerta de pausa y el transporte de música (pauseMusic y resumeMusic) al alternar el estado de pausa', async () => {
      const manager = AudioManager.getInstance();
      await manager.unlock();

      const playSfxSpy = vi.spyOn(manager, 'playSfx');
      const pauseMusicSpy = vi.spyOn(manager, 'pauseMusic');
      const resumeMusicSpy = vi.spyOn(manager, 'resumeMusic');

      const { wrapper } = mountApp();
      await wrapper.find('[data-testid="start-training-button"]').trigger('click');
      await flushRouter(wrapper);

      const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

      const baseState: GamePresentationState = {
        status: 'running',
        step: 10,
        elapsedMs: 1000,
        nextPieces: ['O', 'T', 'I'],
        heldPiece: null,
        score: 100,
        clearedLines: 0,
        combo: 0,
        backToBack: 0,
        combatEnergy: 0,
        storedSabotages: [],
        pendingGarbage: 0,
        activeEffects: [],
        level: 1,
        baseGravityCellsPerSecond: 1,
        activeGravityCellsPerSecond: 1,
      };

      // 1. Transición running -> paused
      stateUpdateCallback({ ...baseState, status: 'paused' });
      await wrapper.vm.$nextTick();

      expect(playSfxSpy).toHaveBeenCalledWith('pauseShutterClose');
      expect(pauseMusicSpy).toHaveBeenCalledTimes(1);

      // 2. Transición paused -> running
      stateUpdateCallback({ ...baseState, status: 'running' });
      await wrapper.vm.$nextTick();

      expect(playSfxSpy).toHaveBeenCalledWith('pauseShutterOpen');
      expect(resumeMusicSpy).toHaveBeenCalledTimes(1);

      wrapper.unmount();
    });
  });

  describe('Integración de Vue Router y sincronización de URL', () => {
    it('la pantalla renderizada y la URL derivan directamente del router y no pueden divergir', async () => {
      const { wrapper, router } = mountApp('/');
      await router.isReady();

      expect(router.currentRoute.value.name).toBe('home');
      expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);

      await router.push({ name: 'settings' });
      await wrapper.vm.$nextTick();
      expect(router.currentRoute.value.name).toBe('settings');
      expect(wrapper.find('[data-testid="settings-screen"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(false);

      await router.push({ name: 'ranking' });
      await wrapper.vm.$nextTick();
      expect(router.currentRoute.value.name).toBe('ranking');
      expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(true);

      wrapper.unmount();
    });

    it('acceder directamente a /results sin resultado activo redirige deterministamente a home', async () => {
      const { wrapper, router } = mountApp('/results', () => false);
      await router.isReady();
      await wrapper.vm.$nextTick();

      expect(router.currentRoute.value.name).toBe('home');
      expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('en entorno de producción la ruta /dev-tools está protegida y redirige a home', async () => {
      const { wrapper, router } = mountApp('/dev-tools');
      await router.isReady();
      await wrapper.vm.$nextTick();

      expect(router.currentRoute.value.name).toBe('home');
      wrapper.unmount();
    });

    describe('Navegación VOLVER AL MENÚ desde demos DEV y partidas normales', () => {
      it('Caso 1 — desde demo Battle DEV (/battle?battle-demo=1&sudden-death-demo=1), al pulsar Menú llega a home sin query params y muestra el menú principal', async () => {
        const { wrapper, router } = mountApp('/');
        await router.isReady();
        await router.push('/battle?battle-demo=1&sudden-death-demo=1');
        await wrapper.vm.$nextTick();

        const exitBtn = wrapper.find('[data-testid="exit-to-menu-button"]');
        expect(exitBtn.exists()).toBe(true);
        await exitBtn.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 10));
        await wrapper.vm.$nextTick();

        expect(router.currentRoute.value.name).toBe('home');
        expect(router.currentRoute.value.query).toEqual({});
        expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
        wrapper.unmount();
      });

      it('Caso 2 — desde otra demo DEV (/training?sabotage-demo=1), al pulsar Menú llega a home sin query params y muestra el menú principal', async () => {
        const { wrapper, router } = mountApp('/');
        await router.isReady();
        await router.push('/training?sabotage-demo=1');
        await wrapper.vm.$nextTick();

        const exitBtn = wrapper.find('[data-testid="exit-to-menu-button"]');
        expect(exitBtn.exists()).toBe(true);
        await exitBtn.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 10));
        await wrapper.vm.$nextTick();

        expect(router.currentRoute.value.name).toBe('home');
        expect(router.currentRoute.value.query).toEqual({});
        expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
        wrapper.unmount();
      });

      it('Caso 3 — flujo normal no DEV (/battle), pulsar Menú redirige a home sin regresiones', async () => {
        const { wrapper, router } = mountApp('/');
        await router.isReady();
        await router.push('/battle');
        await wrapper.vm.$nextTick();

        const exitBtn = wrapper.find('[data-testid="exit-to-menu-button"]');
        expect(exitBtn.exists()).toBe(true);
        await exitBtn.trigger('click');
        await new Promise((resolve) => setTimeout(resolve, 10));
        await wrapper.vm.$nextTick();

        expect(router.currentRoute.value.name).toBe('home');
        expect(router.currentRoute.value.query).toEqual({});
        expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
        wrapper.unmount();
      });

      it('Caso 4 — no reactivación: permanece en home tras avanzar ticks sin redirigir de nuevo a battle', async () => {
        const { wrapper, router } = mountApp('/');
        await router.isReady();
        await router.push('/battle?battle-demo=1&sudden-death-demo=1');
        await wrapper.vm.$nextTick();

        const exitBtn = wrapper.find('[data-testid="exit-to-menu-button"]');
        expect(exitBtn.exists()).toBe(true);
        await exitBtn.trigger('click');
        await router.isReady();
        await wrapper.vm.$nextTick();

        // Espera de ticks adicionales para asegurar estabilidad en home
        await new Promise((resolve) => setTimeout(resolve, 50));
        await wrapper.vm.$nextTick();

        expect(router.currentRoute.value.name).toBe('home');
        expect(router.currentRoute.value.query).toEqual({});
        expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="game-canvas"]').exists()).toBe(false);
        wrapper.unmount();
      });
    });
  });
});
