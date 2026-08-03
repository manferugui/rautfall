/**
 * Pruebas unitarias para el Menú Principal y Selector de Modos (ModeSelector.vue).
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ModeSelector from './ModeSelector.vue';

describe('ModeSelector.vue', () => {
  it('renderiza la cabecera con el título Rautfall y el descriptor', () => {
    const wrapper = mount(ModeSelector);
    expect(wrapper.find('.selector-title').text()).toBe('Rautfall');
    expect(wrapper.find('.selector-descriptor').text()).toBe('Build. Disrupt. Survive.');
    wrapper.unmount();
  });

  it('renderiza los botones de modo Entrenamiento y Batalla', () => {
    const wrapper = mount(ModeSelector);
    const trainingBtn = wrapper.find('[data-testid="start-training-button"]');
    const battleBtn = wrapper.find('[data-testid="start-battle-button"]');

    expect(trainingBtn.exists()).toBe(true);
    expect(trainingBtn.text()).toContain('Modo Entrenamiento');

    expect(battleBtn.exists()).toBe(true);
    expect(battleBtn.text()).toContain('Batalla contra la IA');

    wrapper.unmount();
  });

  it('emite el evento selectMode con "training" al pulsar el botón de Entrenamiento', async () => {
    const wrapper = mount(ModeSelector);
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const emitted = wrapper.emitted('selectMode');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['training']);
    wrapper.unmount();
  });

  it('emite el evento selectMode con "battle" al pulsar el botón de Batalla', async () => {
    const wrapper = mount(ModeSelector);
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');

    const emitted = wrapper.emitted('selectMode');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['battle']);
    wrapper.unmount();
  });

  it('muestra la sección resumida de controles de teclado', () => {
    const wrapper = mount(ModeSelector);
    const controlsCard = wrapper.find('.controls-card');
    expect(controlsCard.exists()).toBe(true);
    expect(controlsCard.text()).toContain('Controles de teclado');
    expect(controlsCard.text()).toContain('Rotación horaria');
    expect(controlsCard.text()).toContain('Caída instantánea');
    wrapper.unmount();
  });
});
