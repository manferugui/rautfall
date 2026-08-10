// @vitest-environment jsdom
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HistoryScreen from './HistoryScreen.vue';
import * as clientModule from '../api/client';

vi.mock('../api/client');

describe('HistoryScreen.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el estado de carga inicialmente', () => {
    vi.spyOn(clientModule, 'getMatchHistory').mockReturnValue(new Promise(() => {}));
    const wrapper = mount(HistoryScreen);
    expect(wrapper.find('[data-testid="history-loading"]').exists()).toBe(true);
  });

  it('muestra estado vacío si el historial está vacío', async () => {
    vi.spyOn(clientModule, 'getMatchHistory').mockResolvedValue([]);
    const wrapper = mount(HistoryScreen);
    await new Promise(resolve => setTimeout(resolve, 10));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="history-empty"]').exists()).toBe(true);
  });

  it('muestra la tabla con registros si existen partidas en el historial', async () => {
    const mockRecord = {
      id: '22222222-2222-4222-8222-222222222222',
      clientMatchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      playerId: '11111111-1111-4111-8111-111111111111',
      playerName: 'Jugador-1111',
      score: 1800,
      linesCleared: 15,
      durationMs: 45000,
      level: 2,
      mode: 'training' as const,
      result: 'finished' as const,
      opponentProfile: null,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(clientModule, 'getMatchHistory').mockResolvedValue([mockRecord]);
    const wrapper = mount(HistoryScreen);
    await new Promise(resolve => setTimeout(resolve, 10));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="history-table"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="history-row"]')).toHaveLength(1);
  });

  it('emite back-to-menu al pulsar el botón de volver', async () => {
    vi.spyOn(clientModule, 'getMatchHistory').mockResolvedValue([]);
    const wrapper = mount(HistoryScreen);
    await wrapper.find('[data-testid="history-back-button"]').trigger('click');
    expect(wrapper.emitted('back-to-menu')).toBeTruthy();
  });
});
