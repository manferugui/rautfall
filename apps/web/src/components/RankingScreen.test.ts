// @vitest-environment jsdom
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import RankingScreen from './RankingScreen.vue';
import * as clientModule from '../api/client';

vi.mock('../api/client');

describe('RankingScreen.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el estado de carga inicialmente', () => {
    vi.spyOn(clientModule, 'getRanking').mockReturnValue(new Promise(() => {}));
    const wrapper = mount(RankingScreen);
    expect(wrapper.find('[data-testid="ranking-loading"]').exists()).toBe(true);
  });

  it('muestra la tabla de ranking si existen registros', async () => {
    const mockRanking = [
      {
        id: 'rec-1',
        rank: 1,
        playerId: '11111111-1111-4111-8111-111111111111',
        playerName: 'RAU',
        score: 4500,
        linesCleared: 30,
        level: 4,
        durationMs: 80000,
        mode: 'battle' as const,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(clientModule, 'getRanking').mockResolvedValue(mockRanking);
    const wrapper = mount(RankingScreen);
    await new Promise(resolve => setTimeout(resolve, 10));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="ranking-table"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ranking-row-1"]').exists()).toBe(true);
  });

  it('permite cambiar entre los tabs de Batalla y Entrenamiento', async () => {
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);
    const wrapper = mount(RankingScreen);

    await wrapper.find('[data-testid="tab-training"]').trigger('click');
    expect(clientModule.getRanking).toHaveBeenCalledWith('training', 30);
  });

  it('emite back-to-menu al pulsar el botón de volver', async () => {
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);
    const wrapper = mount(RankingScreen);
    await wrapper.find('[data-testid="ranking-back-button"]').trigger('click');
    expect(wrapper.emitted('back-to-menu')).toBeTruthy();
  });
});
