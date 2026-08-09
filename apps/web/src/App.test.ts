// @vitest-environment jsdom
/**
 * Pruebas de integración de App.vue con controlador Phaser simulado.
 *
 * Se mockea createPhaserGame para evitar arrancar WebGL real en Vitest.
 * El controlador simulado expone reset, togglePause y destroy.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';
import type { GamePresentationState } from './game/types';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  togglePause: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('./game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

describe('App.vue — flujo web de modos, resultados y ciclo de vida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountApp(): ReturnType<typeof mount> {
    return mount(App, {
      global: {
        stubs: {
          NextPiecesPreview: true,
          ScorePanel: true,
          OpponentMonitor: true,
          CombatStatusPanel: true,
        },
      },
    });
  }

  it('arranca por defecto en la pantalla de Menú Principal (ModeSelector)', () => {
    const wrapper = mountApp();
    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('transiciona a playing al seleccionar Modo Entrenamiento', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(mockCreatePhaserGame).toHaveBeenCalledWith(expect.objectContaining({ mode: 'training' }));
    wrapper.unmount();
  });

  it('transiciona a playing al seleccionar Batalla contra la IA', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');

    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(mockCreatePhaserGame).toHaveBeenCalledWith(expect.objectContaining({ mode: 'battle' }));
    wrapper.unmount();
  });

  it('muestra "Pausar" cuando el estado es running', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const pauseButton = wrapper.find('[data-testid="pause-toggle"]');
    expect(pauseButton.text()).toBe('Pausar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('al simular paused, el botón muestra "Reanudar" y aparece el overlay', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const pausedState: GamePresentationState = {
      status: 'paused',
      step: 50,
      elapsedMs: 2500,
      nextPieces: ['S', 'Z', 'J'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
      activeEffects: [],
      level: 1,
      baseGravityCellsPerSecond: 1.0,
      activeGravityCellsPerSecond: 1.0,
    };
    stateUpdateCallback(pausedState);
    await wrapper.vm.$nextTick();

    const pauseButton = wrapper.find('[data-testid="pause-toggle"]');
    expect(pauseButton.text()).toBe('Reanudar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();

    const overlay = wrapper.find('.pause-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.text()).toBe('PAUSA');

    wrapper.unmount();
  });

  it('al pulsar el botón de pausa/reanudación se invoca controller.togglePause() una vez', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    expect(mockController.togglePause).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="pause-toggle"]').trigger('click');
    expect(mockController.togglePause).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('transiciona a la pantalla de Resultados cuando la partida termina (gameOver)', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const gameOverState: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
      score: 850,
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
    await wrapper.vm.$nextTick();

    const resultsModal = wrapper.find('[data-testid="results-modal"]');
    expect(resultsModal.exists()).toBe(true);
    expect(wrapper.find('[data-testid="results-title"]').text()).toBe('ENTRENAMIENTO FINALIZADO');
    expect(wrapper.find('[data-testid="final-score"]').text()).toBe('850');

    wrapper.unmount();
  });

  it('en la pantalla de Resultados, el botón "Volver a jugar" destruye el controlador, invoca restartMusic("gameplay") y crea una nueva partida', async () => {
    const { getAudioManager } = await import('./audio');
    const audioManager = getAudioManager();
    const restartSpy = vi.spyOn(audioManager, 'restartMusic');

    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'], heldPiece: null, score: 850, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await wrapper.vm.$nextTick();

    expect(mockCreatePhaserGame).toHaveBeenCalledTimes(1);

    await wrapper.find('[data-testid="replay-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(restartSpy).toHaveBeenCalledWith('gameplay');
    expect(mockController.destroy).toHaveBeenCalledTimes(1);
    expect(mockCreatePhaserGame).toHaveBeenCalledTimes(2);

    restartSpy.mockRestore();
    wrapper.unmount();
  });

  it('en la pantalla de Resultados, el botón "Menú principal" destruye la partida y regresa a menu', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'], heldPiece: null, score: 850, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await wrapper.vm.$nextTick();

    await wrapper.find('[data-testid="main-menu-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockController.destroy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('el botón de cabecera "Menú" destruye la partida activa y regresa a menu', async () => {
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');

    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);

    await wrapper.find('[data-testid="exit-to-menu-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(mockController.destroy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('el botón "Reiniciar" está presente y habilitado durante el juego e invoca restartMusic("gameplay")', async () => {
    const { getAudioManager } = await import('./audio');
    const audioManager = getAudioManager();
    const restartSpy = vi.spyOn(audioManager, 'restartMusic');

    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const resetButton = wrapper.find('[data-testid="reset-button"]');
    expect(resetButton.text()).toBe('Reiniciar');
    expect(resetButton.attributes('disabled')).toBeUndefined();

    await resetButton.trigger('click');
    expect(mockController.reset).toHaveBeenCalledTimes(1);
    expect(restartSpy).toHaveBeenCalledWith('gameplay');

    restartSpy.mockRestore();
    wrapper.unmount();
  });

  it('registra gameplay como pista deseada al ingresar directamente por flag DEV sin crear AudioContext ansiosamente', async () => {
    const originalLocation = window.location;
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Location }).location = {
      pathname: '/',
      search: '?tspin-demo=1',
      href: 'http://localhost/?tspin-demo=1',
    } as unknown as Location;

    const { getAudioManager } = await import('./audio');
    const audioManager = getAudioManager();

    const wrapper = mountApp();
    await wrapper.vm.$nextTick();

    expect(audioManager.getCurrentMusicTrack()).toBe('gameplay');
    expect(audioManager.getAudioContextState()).toBe('uninitialized');

    await audioManager.unlock();
    expect(audioManager.getCurrentMusicTrack()).toBe('gameplay');

    wrapper.unmount();
    (window as unknown as { location: Location }).location = originalLocation;
  });
});
