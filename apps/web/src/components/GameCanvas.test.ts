// @vitest-environment jsdom
/**
 * Pruebas de ciclo de vida de GameCanvas.vue con mocks.
 *
 * Se mockea createPhaserGame para evitar arrancar WebGL real en Vitest.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import GameCanvas from './GameCanvas.vue';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('../game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

describe('GameCanvas.vue — ciclo de vida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crea una única instancia al montar', async () => {
    const wrapper = mount(GameCanvas, {
      props: {
        onStateUpdate: vi.fn(),
      },
    });

    await flushPromises();

    expect(mockCreatePhaserGame).toHaveBeenCalledTimes(1);
    expect(mockCreatePhaserGame).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: expect.any(HTMLElement),
        onStateUpdate: expect.any(Function),
      }),
    );

    wrapper.unmount();
  });

  it('no duplica instancia al montar de nuevo', async () => {
    const wrapper = mount(GameCanvas, {
      props: {
        onStateUpdate: vi.fn(),
      },
    });

    await flushPromises();

    expect(mockCreatePhaserGame).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('destruye la instancia al desmontar', async () => {
    const wrapper = mount(GameCanvas, {
      props: {
        onStateUpdate: vi.fn(),
      },
    });

    await flushPromises();

    expect(mockController.destroy).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(mockController.destroy).toHaveBeenCalledTimes(1);
  });

  it('emite controllerReady con el controlador', async () => {
    const wrapper = mount(GameCanvas, {
      props: {
        onStateUpdate: vi.fn(),
      },
    });

    await flushPromises();

    expect(wrapper.emitted('controllerReady')).toHaveLength(1);
    expect(wrapper.emitted('controllerReady')![0]![0]).toBe(mockController);

    wrapper.unmount();
  });

  it('no crea la instancia de Phaser si se desmonta antes de resolver la carga asíncrona', async () => {
    const wrapper = mount(GameCanvas, {
      props: {
        onStateUpdate: vi.fn(),
      },
    });

    // Desmontar síncronamente antes de flushPromises()
    wrapper.unmount();

    await flushPromises();

    expect(mockCreatePhaserGame).not.toHaveBeenCalled();
    expect(wrapper.emitted('controllerReady')).toBeUndefined();
  });
});
