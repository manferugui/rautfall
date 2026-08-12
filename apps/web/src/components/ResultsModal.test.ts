/**
 * Pruebas unitarias para la Pantalla/Modal de Resultados (ResultsModal.vue).
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ResultsModal from './ResultsModal.vue';
import type { GameResultSummary } from '../game/types';

describe('ResultsModal.vue', () => {
  it('renderiza la presentación de fin de partida en modo Entrenamiento', () => {
    const trainingResult: GameResultSummary = {
      mode: 'training',
      title: 'ENTRENAMIENTO FINALIZADO',
      subtitle: 'Sesión individual de práctica',
      score: 1250,
      level: 2,
      elapsedMs: 85000,
    };

    const wrapper = mount(ResultsModal, {
      props: { result: trainingResult },
    });

    expect(wrapper.find('[data-testid="results-title"]').text()).toBe('ENTRENAMIENTO FINALIZADO');
    expect(wrapper.find('[data-testid="final-score"]').text()).toBe('1250');
    expect(wrapper.find('[data-testid="final-level"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="final-time"]').text()).toBe('01:25');
    expect(wrapper.find('[data-testid="final-battle-step"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('renderiza el resultado de Victoria en modo Batalla', () => {
    const battleVictoryResult: GameResultSummary = {
      mode: 'battle',
      title: 'VICTORIA',
      subtitle: 'Has derrotado al rival autónomo',
      score: 3400,
      level: 4,
      elapsedMs: 142000,
      battleResult: {
        status: 'playerOneWon',
        winner: 'playerOne',
        step: 1420,
      },
    };

    const wrapper = mount(ResultsModal, {
      props: { result: battleVictoryResult },
    });

    expect(wrapper.find('[data-testid="results-title"]').text()).toBe('VICTORIA');
    expect(wrapper.find('[data-testid="results-title"]').classes()).toContain('results-title--victory');
    expect(wrapper.find('[data-testid="final-score"]').text()).toBe('3400');
    expect(wrapper.find('[data-testid="final-level"]').text()).toBe('4');
    expect(wrapper.find('[data-testid="final-time"]').text()).toBe('02:22');
    // El paso global de Battle mantiene formato es-ES con separador de miles
    // (a diferencia del SCORE, unificado sin separador con el HUD).
    expect(wrapper.find('[data-testid="final-battle-step"]').text()).toBe('1.420');

    wrapper.unmount();
  });

  it('renderiza el resultado de Derrota y Empate en modo Batalla', () => {
    const defeatResult: GameResultSummary = {
      mode: 'battle',
      title: 'DERROTA',
      score: 800,
      level: 1,
      elapsedMs: 45000,
      battleResult: { status: 'playerTwoWon', winner: 'playerTwo', step: 450 },
    };

    const wrapperDefeat = mount(ResultsModal, { props: { result: defeatResult } });
    expect(wrapperDefeat.find('[data-testid="results-title"]').text()).toBe('DERROTA');
    expect(wrapperDefeat.find('[data-testid="results-title"]').classes()).toContain('results-title--defeat');
    wrapperDefeat.unmount();

    const drawResult: GameResultSummary = {
      mode: 'battle',
      title: 'EMPATE',
      score: 1500,
      level: 2,
      elapsedMs: 90000,
      battleResult: { status: 'draw', winner: 'draw', step: 900 },
    };

    const wrapperDraw = mount(ResultsModal, { props: { result: drawResult } });
    expect(wrapperDraw.find('[data-testid="results-title"]').text()).toBe('EMPATE');
    expect(wrapperDraw.find('[data-testid="results-title"]').classes()).toContain('results-title--draw');
    wrapperDraw.unmount();
  });

  it('emite evento replay al pulsar Volver a jugar', async () => {
    const summary: GameResultSummary = {
      mode: 'training',
      title: 'ENTRENAMIENTO FINALIZADO',
      score: 500,
      level: 1,
      elapsedMs: 30000,
    };

    const wrapper = mount(ResultsModal, { props: { result: summary } });
    await wrapper.find('[data-testid="replay-button"]').trigger('click');

    expect(wrapper.emitted('replay')).toBeTruthy();
    wrapper.unmount();
  });

  it('emite evento mainMenu al pulsar Menú principal', async () => {
    const summary: GameResultSummary = {
      mode: 'training',
      title: 'ENTRENAMIENTO FINALIZADO',
      score: 500,
      level: 1,
      elapsedMs: 30000,
    };

    const wrapper = mount(ResultsModal, { props: { result: summary } });
    await wrapper.find('[data-testid="main-menu-button"]').trigger('click');

    expect(wrapper.emitted('mainMenu')).toBeTruthy();
    wrapper.unmount();
  });
});
