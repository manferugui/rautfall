// @vitest-environment jsdom
/**
 * Pruebas del componente ScorePanel.
 *
 * Verifica que muestra correctamente puntuación y combo reales.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ScorePanel from './ScorePanel.vue';

describe('ScorePanel', () => {
  it('muestra 0 en puntuación y la raya en combo cuando score=0 y combo=0', () => {
    const wrapper = mount(ScorePanel, { props: { score: 0, combo: 0 } });
    expect(wrapper.find('[data-testid="score-value"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="combo-value"]').text()).toBe('\u2014');
  });

  it('muestra el valor de puntuación cuando score es distinto de cero', () => {
    const wrapper = mount(ScorePanel, { props: { score: 1234, combo: 0 } });
    expect(wrapper.find('[data-testid="score-value"]').text()).toBe('1234');
  });

  it('muestra el valor numérico de combo cuando combo >= 1', () => {
    const wrapper1 = mount(ScorePanel, { props: { score: 100, combo: 1 } });
    expect(wrapper1.find('[data-testid="combo-value"]').text()).toBe('1');

    const wrapper3 = mount(ScorePanel, { props: { score: 500, combo: 3 } });
    expect(wrapper3.find('[data-testid="combo-value"]').text()).toBe('3');
  });

  it('expone data-testid="score-panel" en el contenedor raíz', () => {
    const wrapper = mount(ScorePanel, { props: { score: 0, combo: 0 } });
    expect(wrapper.find('[data-testid="score-panel"]').exists()).toBe(true);
  });
});
