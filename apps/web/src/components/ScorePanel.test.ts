// @vitest-environment jsdom
/**
 * Pruebas del componente ScorePanel.
 *
 * Verifica que muestra correctamente puntuación, nivel, gravedad, combo, back-to-back y energía reales.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScorePanel from './ScorePanel.vue';

describe('ScorePanel', () => {
  it('muestra 0 en puntuación y la raya en combo cuando score=0 y combo=0', () => {
    const wrapper = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper.find('[data-testid="score-value"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="combo-value"]').text()).toBe('\u2014');
  });

  it('muestra el valor de puntuación cuando score es distinto de cero', () => {
    const wrapper = mount(ScorePanel, { props: { score: 1234, combo: 0, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper.find('[data-testid="score-value"]').text()).toBe('1234');
  });

  it('muestra el nivel y la gravedad activa formateada', () => {
    const wrapper = mount(ScorePanel, {
      props: {
        score: 0,
        combo: 0,
        backToBack: 0,
        combatEnergy: 0,
        level: 5,
        activeGravityCellsPerSecond: 7.5,
      },
    });
    expect(wrapper.find('[data-testid="level-value"]').text()).toBe('5');
    expect(wrapper.find('[data-testid="gravity-value"]').text()).toBe('7.50 c/s');
  });

  it('muestra el valor numérico de combo cuando combo >= 1', () => {
    const wrapper1 = mount(ScorePanel, { props: { score: 100, combo: 1, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper1.find('[data-testid="combo-value"]').text()).toBe('1');

    const wrapper3 = mount(ScorePanel, { props: { score: 500, combo: 3, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper3.find('[data-testid="combo-value"]').text()).toBe('3');
  });

  it('muestra raya en back-to-back cuando backToBack=0', () => {
    const wrapper = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper.find('[data-testid="backToBack-value"]').text()).toBe('\u2014');
  });

  it('muestra el valor numérico de back-to-back cuando backToBack > 0', () => {
    const wrapper = mount(ScorePanel, { props: { score: 800, combo: 1, backToBack: 2, combatEnergy: 0 } });
    expect(wrapper.find('[data-testid="backToBack-value"]').text()).toBe('2');
  });

  it('muestra el valor de combatEnergy en data-testid="combatEnergy-value"', () => {
    const wrapper0 = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper0.find('[data-testid="combatEnergy-value"]').text()).toBe('0');

    const wrapper50 = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 50 } });
    expect(wrapper50.find('[data-testid="combatEnergy-value"]').text()).toBe('50');

    const wrapper100 = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 100 } });
    expect(wrapper100.find('[data-testid="combatEnergy-value"]').text()).toBe('100');
  });

  it('expone data-testid="score-panel" en el contenedor raíz', () => {
    const wrapper = mount(ScorePanel, { props: { score: 0, combo: 0, backToBack: 0, combatEnergy: 0 } });
    expect(wrapper.find('[data-testid="score-panel"]').exists()).toBe(true);
  });
});
