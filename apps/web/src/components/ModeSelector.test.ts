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
    expect(wrapper.find('.menu-title').text()).toBe('RAUTFALL');
    expect(wrapper.find('.menu-descriptor').text()).toBe('BUILD · DISRUPT · SURVIVE');
    wrapper.unmount();
  });

  it('renderiza los botones de modo Entrenamiento, Batalla y Contra Jugador', () => {
    const wrapper = mount(ModeSelector);
    const trainingBtn = wrapper.find('[data-testid="start-training-button"]');
    const battleBtn = wrapper.find('[data-testid="start-battle-button"]');
    const onlineBtn = wrapper.find('[data-testid="start-online-pvp-button"]');

    expect(trainingBtn.exists()).toBe(true);
    expect(trainingBtn.text()).toContain('ENTRENAMIENTO');

    expect(battleBtn.exists()).toBe(true);
    expect(battleBtn.text()).toContain('BATALLA TÁCTICA');

    expect(onlineBtn.exists()).toBe(true);
    expect(onlineBtn.text()).toContain('CONTRA JUGADOR');

    wrapper.unmount();
  });

  it('emite el evento openOnlinePvp al pulsar el botón CONTRA JUGADOR', async () => {
    const wrapper = mount(ModeSelector);
    await wrapper.find('[data-testid="start-online-pvp-button"]').trigger('click');

    expect(wrapper.emitted('openOnlinePvp')).toBeTruthy();
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

  it('abre la modal de selección de dificultad al pulsar el botón de Batalla Táctica', async () => {
    const wrapper = mount(ModeSelector);
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(false);

    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('permite seleccionar dificultad en la modal emitidendo selectMode con la opción elegida y cerrando la modal', async () => {
    const wrapper = mount(ModeSelector);
    const battleBtn = wrapper.find('[data-testid="start-battle-button"]');

    // Abrir modal
    await battleBtn.trigger('click');
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(true);

    // Seleccionar CADET
    const cadetBtn = wrapper.find('[data-testid="bot-profile-cadet"]');
    await cadetBtn.trigger('click');

    const emitted = wrapper.emitted('selectMode');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['battle', 'battleCadet']);

    // La modal debe haberse cerrado
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('permite cancelar la modal de dificultad sin emitir selectMode', async () => {
    const wrapper = mount(ModeSelector);
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(true);

    await wrapper.find('[data-testid="cancel-bot-difficulty-button"]').trigger('click');
    expect(wrapper.find('[data-testid="bot-difficulty-modal"]').exists()).toBe(false);
    expect(wrapper.emitted('selectMode')).toBeFalsy();

    wrapper.unmount();
  });

  it('abre la modal de controles al pulsar el botón CONTROLES de la barra de utilidades', async () => {
    const wrapper = mount(ModeSelector);
    expect(wrapper.find('[data-testid="controls-modal"]').exists()).toBe(false);

    const controlsBtn = wrapper.find('[data-testid="open-controls-button"]');
    expect(controlsBtn.exists()).toBe(true);

    await controlsBtn.trigger('click');
    expect(wrapper.find('[data-testid="controls-modal"]').exists()).toBe(true);

    // Cerrar la modal
    await wrapper.find('[data-testid="close-controls-modal-button"]').trigger('click');
    expect(wrapper.find('[data-testid="controls-modal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('renderiza el botón de Mute y alterna el estado de silencio al hacer clic', async () => {
    const wrapper = mount(ModeSelector);
    const muteBtn = wrapper.find('[data-testid="audio-mute-button"]');
    expect(muteBtn.exists()).toBe(true);

    expect(muteBtn.attributes('aria-label')).toBe('Silenciar audio');

    await muteBtn.trigger('click');
    expect(muteBtn.attributes('aria-label')).toBe('Activar audio');
    expect(muteBtn.attributes('data-audio-muted')).toBe('true');

    wrapper.unmount();
  });

  it('renderiza el acceso a DEV Tools en entorno de desarrollo y emite openDevTools al pulsarlo', async () => {
    const wrapper = mount(ModeSelector);

    const devButton = wrapper.find('[data-testid="open-dev-tools-button"]');
    expect(devButton.exists()).toBe(true);

    await devButton.trigger('click');
    expect(wrapper.emitted('openDevTools')).toBeTruthy();

    wrapper.unmount();
  });
});
