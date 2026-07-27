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

describe('App.vue — pausa, reanudación y reinicio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountApp(): ReturnType<typeof mount> {
    return mount(App, {
      global: {
        stubs: {
          NextPiecesPreview: true,
        },
      },
    });
  }

  it('muestra "Pausar" cuando el estado es running', () => {
    const wrapper = mountApp();
    const pauseButton = wrapper.find('button:first-child');
    expect(pauseButton.text()).toBe('Pausar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('al simular paused, el botón muestra "Reanudar" y aparece el overlay', async () => {
    const wrapper = mountApp();

    // Obtener el callback onStateUpdate desde el mock de createPhaserGame
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // Simular transición a paused
    const pausedState: GamePresentationState = {
      status: 'paused',
      step: 50,
      elapsedMs: 2500,
      nextPieces: ['S', 'Z', 'J'],
    };
    stateUpdateCallback(pausedState);
    await wrapper.vm.$nextTick();

    const pauseButton = wrapper.find('button:first-child');
    expect(pauseButton.text()).toBe('Reanudar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();

    // Verificar overlay
    const overlay = wrapper.find('.pause-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.text()).toBe('PAUSA');

    wrapper.unmount();
  });

  it('al pulsar el botón de pausa/reanudación se invoca controller.togglePause() una vez', async () => {
    const wrapper = mountApp();

    // No está pulsado aún
    expect(mockController.togglePause).not.toHaveBeenCalled();

    await wrapper.find('button:first-child').trigger('click');
    expect(mockController.togglePause).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('con gameOver el botón de pausa/reanudación está disabled y muestra "Pausar"', async () => {
    const wrapper = mountApp();

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const gameOverState: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
    };
    stateUpdateCallback(gameOverState);
    await wrapper.vm.$nextTick();

    const pauseButton = wrapper.find('button:first-child');
    expect(pauseButton.text()).toBe('Pausar');
    expect(pauseButton.attributes('disabled')).toBeDefined();

    wrapper.unmount();
  });

  it('el botón "Reiniciar" está presente y habilitado en los tres estados', async () => {
    const wrapper = mountApp();

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // Verificar en running (estado inicial)
    const resetButton = wrapper.find('button:last-child');
    expect(resetButton.text()).toBe('Reiniciar');
    expect(resetButton.attributes('disabled')).toBeUndefined();

    // Verificar en paused
    stateUpdateCallback({ status: 'paused', step: 50, elapsedMs: 2500, nextPieces: ['S', 'Z', 'J'] });
    await wrapper.vm.$nextTick();
    expect(resetButton.attributes('disabled')).toBeUndefined();

    // Verificar en gameOver
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'] });
    await wrapper.vm.$nextTick();
    expect(resetButton.attributes('disabled')).toBeUndefined();

    wrapper.unmount();
  });

  it('al pulsar "Reiniciar" se invoca controller.reset()', async () => {
    const wrapper = mountApp();

    expect(mockController.reset).not.toHaveBeenCalled();
    await wrapper.find('button:last-child').trigger('click');
    expect(mockController.reset).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('el overlay PAUSA no aparece con status running o gameOver', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // running — sin overlay
    expect(wrapper.find('.pause-overlay').exists()).toBe(false);

    // gameOver — sin overlay
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'] });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.pause-overlay').exists()).toBe(false);

    wrapper.unmount();
  });

  it('NextPiecesPreview recibe nextPieces desde App', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const state: GamePresentationState = {
      status: 'running',
      step: 10,
      elapsedMs: 500,
      nextPieces: ['T', 'L', 'J'],
    };
    stateUpdateCallback(state);
    await wrapper.vm.$nextTick();

    // Verificar que la prop se pasa al componente NextPiecesPreview
    const preview = wrapper.findComponent({ name: 'NextPiecesPreview' });
    expect(preview.exists()).toBe(true);
    expect(preview.props('nextPieces')).toEqual(['T', 'L', 'J']);

    wrapper.unmount();
  });
});
