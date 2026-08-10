// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsScreen from './SettingsScreen.vue';
import { DEFAULT_CONTROL_BINDINGS } from '../settings/control-bindings';
import { loadUserSettings, saveUserSettings } from '../settings/settings-storage';

describe('SettingsScreen.vue — Interfaz y captura de controles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza la lista de las 8 acciones de control con sus teclas asignadas por defecto', () => {
    const wrapper = mount(SettingsScreen);

    expect(wrapper.find('[data-testid="settings-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="control-row-moveLeft"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="control-row-triggerSabotage"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="control-row-pause"]').exists()).toBe(false); // Pause ya no es configurable
  });

  it('entra en modo captura al hacer clic en "CAMBIAR", actualiza el binding al pulsar ShiftRight y realiza cleanup del listener', async () => {
    const wrapper = mount(SettingsScreen);

    const changeBtn = wrapper.find('[data-testid="change-btn-moveLeft"]');
    await changeBtn.trigger('click');

    expect(wrapper.find('[data-testid="capture-prompt"]').exists()).toBe(true);

    // Simular keydown de 'ShiftRight' (modificador lateral soportado)
    const event = new KeyboardEvent('keydown', { code: 'ShiftRight', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="capture-prompt"]').exists()).toBe(false);

    const loaded = loadUserSettings();
    expect(loaded.controls.moveLeft).toBe('ShiftRight');
  });

  it('cancela la captura sin modificar el binding al pulsar Escape', async () => {
    const wrapper = mount(SettingsScreen);

    const changeBtn = wrapper.find('[data-testid="change-btn-moveRight"]');
    await changeBtn.trigger('click');

    expect(wrapper.find('[data-testid="capture-prompt"]').exists()).toBe(true);

    const event = new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="capture-prompt"]').exists()).toBe(false);

    const loaded = loadUserSettings();
    expect(loaded.controls.moveRight).toBe('ArrowRight');
  });

  it('muestra un mensaje de error y no guarda estado cuando se intenta asignar una tecla duplicada', async () => {
    const wrapper = mount(SettingsScreen);

    const changeBtn = wrapper.find('[data-testid="change-btn-moveLeft"]');
    await changeBtn.trigger('click');

    // Intentar asignar 'ArrowRight' (usado por moveRight)
    const event = new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    await wrapper.vm.$nextTick();

    const banner = wrapper.find('[data-testid="settings-error-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('ya está asignada');

    // moveLeft debe seguir siendo ArrowLeft
    expect(loadUserSettings().controls.moveLeft).toBe('ArrowLeft');
  });

  it('muestra un mensaje de error cuando se intenta asignar una tecla reservada como Tab o F1', async () => {
    const wrapper = mount(SettingsScreen);

    const changeBtn = wrapper.find('[data-testid="change-btn-moveLeft"]');
    await changeBtn.trigger('click');

    const event = new KeyboardEvent('keydown', { code: 'Tab', bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    await wrapper.vm.$nextTick();

    const banner = wrapper.find('[data-testid="settings-error-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('no está soportada');

    expect(loadUserSettings().controls.moveLeft).toBe('ArrowLeft');
  });

  it('restaura los valores predeterminados al hacer clic en "RESTAURAR CONTROLES PREDETERMINADOS"', async () => {
    saveUserSettings({
      version: 1,
      controls: {
        ...DEFAULT_CONTROL_BINDINGS,
        moveLeft: 'ShiftRight',
        moveRight: 'ControlRight',
      },
    });

    const wrapper = mount(SettingsScreen);
    const resetBtn = wrapper.find('[data-testid="reset-defaults-button"]');
    await resetBtn.trigger('click');

    const loaded = loadUserSettings();
    expect(loaded.controls.moveLeft).toBe('ArrowLeft');
    expect(loaded.controls.moveRight).toBe('ArrowRight');
  });

  it('emite el evento "back" al hacer clic en "VOLVER AL MENÚ"', async () => {
    const wrapper = mount(SettingsScreen);
    const backBtn = wrapper.find('[data-testid="settings-back-button"]');
    await backBtn.trigger('click');

    expect(wrapper.emitted('back')).toBeTruthy();
  });
});
