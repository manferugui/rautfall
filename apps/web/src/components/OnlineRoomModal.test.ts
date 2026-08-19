/**
 * Pruebas unitarias para OnlineRoomModal.vue.
 */

// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OnlineRoomModal from './OnlineRoomModal.vue';
import type { OnlineGameSession } from '../api/online-game-session';

describe('OnlineRoomModal.vue', () => {
  it('no muestra el modal si isOpen es false', () => {
    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: false,
        session: null,
      },
    });

    expect(wrapper.find('[data-testid="online-room-modal"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('muestra el modal y permite elegir entre CREAR Y UNIRSE', () => {
    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: null,
      },
    });

    expect(wrapper.find('[data-testid="online-room-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="create-room-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="join-room-button"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('emite startCreate al pulsar CREAR PARTIDA', async () => {
    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: null,
      },
    });

    await wrapper.find('[data-testid="create-room-button"]').trigger('click');
    expect(wrapper.emitted('startCreate')).toBeTruthy();
    expect(wrapper.find('[data-testid="room-code-display"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('muestra el código de sala y mensaje de espera cuando la sesión está en estado waiting y tiene roomCode', async () => {
    const mockSession = {
      status: 'waiting',
      roomCode: 'AB12C',
      lastError: null,
      onStatusChange: vi.fn(),
      onError: vi.fn(),
    };

    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: mockSession as unknown as OnlineGameSession,
      },
    });

    await wrapper.find('[data-testid="create-room-button"]').trigger('click');

    expect(wrapper.find('[data-testid="room-code-display"]').text()).toBe('AB12C');
    expect(wrapper.text()).toContain('ESPERANDO AL RIVAL...');

    wrapper.unmount();
  });

  it('valida el código de 5 caracteres al UNIRSE A PARTIDA y emite startJoin con el código en mayúsculas', async () => {
    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: null,
      },
    });

    // Seleccionar pestaña UNIRSE
    await wrapper.find('[data-testid="join-room-button"]').trigger('click');

    const input = wrapper.find('[data-testid="join-room-code-input"]');
    const submitBtn = wrapper.find('[data-testid="submit-join-room-button"]');

    // Botón deshabilitado inicialmente por código incompleto
    expect((submitBtn.element as HTMLButtonElement).disabled).toBe(true);

    // Escribir código en minúsculas 'xy34z'
    await input.setValue('xy34z');
    expect((submitBtn.element as HTMLButtonElement).disabled).toBe(false);

    await submitBtn.trigger('click');
    const emitted = wrapper.emitted('startJoin');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['XY34Z']);

    wrapper.unmount();
  });

  it('muestra banner contractual de error cuando la sesión emite un error', async () => {
    const mockSession = {
      status: 'idle',
      roomCode: null,
      lastError: {
        code: 'ROOM_NOT_FOUND',
        message: 'La sala especificada no existe o ya ha expirado.',
      },
      onStatusChange: vi.fn(),
      onError: vi.fn(),
    };

    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: mockSession as unknown as OnlineGameSession,
      },
    });

    const errorBanner = wrapper.find('[data-testid="room-error-message"]');
    expect(errorBanner.exists()).toBe(true);
    expect(errorBanner.text()).toContain('CÓDIGO DE SALA NO ENCONTRADO');

    wrapper.unmount();
  });

  it('emite cancel al pulsar el botón CANCELAR', async () => {
    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: null,
      },
    });

    await wrapper.find('[data-testid="cancel-online-room-button"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeTruthy();

    wrapper.unmount();
  });

  it('en caso de error de conexión en la vista de creación, muestra el aviso de error sin quedar bloqueado en GENERANDO...', async () => {
    const mockSession = {
      status: 'error',
      roomCode: null,
      lastError: {
        code: 'CONNECTION_FAILED',
        message: 'Fallo al conectar con el servidor WebSocket PvP',
      },
      onStatusChange: vi.fn(),
      onError: vi.fn(),
    };

    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: mockSession as unknown as OnlineGameSession,
      },
    });

    await wrapper.find('[data-testid="create-room-button"]').trigger('click');

    expect(wrapper.find('[data-testid="room-code-display"]').text()).toBe('ERROR AL CONECTAR');
    expect(wrapper.find('[data-testid="waiting-opponent-status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="room-error-message"]').text()).toContain('Fallo al conectar con el servidor WebSocket PvP');

    wrapper.unmount();
  });

  it('actualiza reactivamente el código de sala cuando la sesión cambia asíncronamente de estado mediante onStatusChange', async () => {
    let statusCallback: (() => void) | null = null;
    const sessionState = {
      status: 'connecting',
      roomCode: null as string | null,
      lastError: null,
      onStatusChange: vi.fn((cb: () => void) => {
        statusCallback = cb;
        return () => {
          statusCallback = null;
        };
      }),
    };

    const wrapper = mount(OnlineRoomModal, {
      props: {
        isOpen: true,
        session: sessionState as unknown as OnlineGameSession,
      },
    });

    await wrapper.find('[data-testid="create-room-button"]').trigger('click');

    expect(wrapper.find('[data-testid="room-code-display"]').text()).toBe('GENERANDO...');

    // Simulamos la llegada de room_created actualizando el objeto de sesión y notificando cambios
    sessionState.status = 'waiting';
    sessionState.roomCode = '7BS3S';
    if (statusCallback) {
      (statusCallback as () => void)();
    }

    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="room-code-display"]').text()).toBe('7BS3S');

    wrapper.unmount();
  });
});
