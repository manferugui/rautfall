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

  it('renderiza los botones de modo Entrenamiento y Batalla', () => {
    const wrapper = mount(ModeSelector);
    const trainingBtn = wrapper.find('[data-testid="start-training-button"]');
    const battleBtn = wrapper.find('[data-testid="start-battle-button"]');

    expect(trainingBtn.exists()).toBe(true);
    expect(trainingBtn.text()).toContain('ENTRENAMIENTO');

    expect(battleBtn.exists()).toBe(true);
    expect(battleBtn.text()).toContain('BATALLA TÁCTICA');

    const onlineBtn = wrapper.find('[data-testid="start-online-pvp-button"]');
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

  it('emite el evento selectMode con "battle" y el perfil por defecto ("battleOperator") al pulsar el botón de Batalla', async () => {
    const wrapper = mount(ModeSelector);
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');

    const emitted = wrapper.emitted('selectMode');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['battle', 'battleOperator']);
    wrapper.unmount();
  });

  it('mantiene OPERATOR por defecto y ubica el selector BOT PROFILE fuera de la superficie interactiva de Batalla', async () => {
    const wrapper = mount(ModeSelector);
    const battleBtn = wrapper.find('[data-testid="start-battle-button"]');
    const profileSelector = wrapper.find('[data-testid="bot-profile-selector"]');

    expect(battleBtn.exists()).toBe(true);
    expect(profileSelector.exists()).toBe(true);

    // Regresión: el selector no debe estar dentro del elemento del botón de Batalla
    expect(battleBtn.element.contains(profileSelector.element)).toBe(false);

    const cadetBtn = wrapper.find('[data-testid="bot-profile-cadet"]');
    const operatorBtn = wrapper.find('[data-testid="bot-profile-operator"]');
    const eliteBtn = wrapper.find('[data-testid="bot-profile-elite"]');

    // OPERATOR seleccionado por defecto
    expect(operatorBtn.classes()).toContain('bot-profile-btn--selected');

    // Pulsar sobre CADET altera el perfil seleccionado sin emitir selectMode
    await cadetBtn.trigger('click');
    expect(cadetBtn.classes()).toContain('bot-profile-btn--selected');
    expect(operatorBtn.classes()).not.toContain('bot-profile-btn--selected');
    expect(wrapper.emitted('selectMode')).toBeFalsy();

    // Al pulsar el botón de Batalla se emite el perfil actualmente elegido (battleCadet)
    await battleBtn.trigger('click');
    const emitted = wrapper.emitted('selectMode');
    expect(emitted).toBeTruthy();
    expect(emitted![0]).toEqual(['battle', 'battleCadet']);

    // Cambiar a ELITE
    await eliteBtn.trigger('click');
    expect(eliteBtn.classes()).toContain('bot-profile-btn--selected');

    wrapper.unmount();
  });

  it('muestra la sección resumida de controles de teclado', () => {
    const wrapper = mount(ModeSelector);
    const controlsModule = wrapper.find('.controls-module');
    expect(controlsModule.exists()).toBe(true);
    expect(controlsModule.text()).toContain('Controles de teclado');
    expect(controlsModule.text()).toContain('Rotación horaria');
    expect(controlsModule.text()).toContain('Caída instantánea');
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

  // El lanzador DEV ya no se monta inline dentro de ModeSelector.vue: ahora
  // es un botón discreto que emite `openDevTools`, y la pantalla real
  // (DevLauncherScreen.vue con DevDemoLauncher.vue dentro) la monta App.vue
  // por separado. Ver DevLauncherScreen.test.ts para esa pantalla.
  it('renderiza el acceso a DEV Tools en entorno de desarrollo y emite openDevTools al pulsarlo', async () => {
    const wrapper = mount(ModeSelector);

    const devButton = wrapper.find('[data-testid="open-dev-tools-button"]');
    expect(devButton.exists()).toBe(true);

    await devButton.trigger('click');
    expect(wrapper.emitted('openDevTools')).toBeTruthy();

    wrapper.unmount();
  });
});
