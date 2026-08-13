// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AudioActivationModal from './AudioActivationModal.vue';

describe('AudioActivationModal', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('1. renderiza AUDIO MODULE, STANDBY, descripción y ambos botones', () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });

    expect(wrapper.text()).toContain('AUDIO MODULE');
    expect(wrapper.text()).toContain('STANDBY');
    expect(wrapper.text()).toContain('Se requiere confirmación del operador para inicializar el módulo de sonido.');

    const initBtn = wrapper.find('[data-testid="initialize-audio-button"]');
    const silentBtn = wrapper.find('[data-testid="keep-silent-button"]');

    expect(initBtn.exists()).toBe(true);
    expect(initBtn.text()).toContain('INICIALIZAR AUDIO');

    expect(silentBtn.exists()).toBe(true);
    expect(silentBtn.text()).toContain('SEGUIR EN SILENCIO');
  });

  it('2. emite el evento initialize al pulsar el botón principal', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    const initBtn = wrapper.find('[data-testid="initialize-audio-button"]');

    await initBtn.trigger('click');

    expect(wrapper.emitted('initialize')).toHaveLength(1);
  });

  it('3. emite el evento keepSilent al pulsar el botón secundario', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    const silentBtn = wrapper.find('[data-testid="keep-silent-button"]');

    await silentBtn.trigger('click');

    expect(wrapper.emitted('keepSilent')).toHaveLength(1);
  });

  it('4. presionar Escape emite el evento keepSilent', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    const backdrop = wrapper.find('.audio-modal-backdrop');

    await backdrop.trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('keepSilent')).toHaveLength(1);
  });

  it('5. sitúa el foco inicial en INICIALIZAR AUDIO al montarse', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    await wrapper.vm.$nextTick();

    const initBtnElement = wrapper.find('[data-testid="initialize-audio-button"]').element;
    expect(document.activeElement).toBe(initBtnElement);
  });

  it('6, 7 y 8. mantiene la navegación Tab y Shift+Tab atrapada dentro del diálogo', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    await wrapper.vm.$nextTick();

    const initBtn = wrapper.find('[data-testid="initialize-audio-button"]');
    const silentBtn = wrapper.find('[data-testid="keep-silent-button"]');
    const backdrop = wrapper.find('.audio-modal-backdrop');

    // Inicialmente enfocado en initBtn
    expect(document.activeElement).toBe(initBtn.element);

    // Mover foco a silentBtn manualmente (o simular navegación)
    (silentBtn.element as HTMLElement).focus();
    expect(document.activeElement).toBe(silentBtn.element);

    // Al estar en el último elemento (silentBtn) y pulsar Tab, salta de vuelta al primero (initBtn)
    await backdrop.trigger('keydown', { key: 'Tab', shiftKey: false });
    expect(document.activeElement).toBe(initBtn.element);

    // Al estar en el primer elemento (initBtn) y pulsar Shift+Tab, salta al último (silentBtn)
    await backdrop.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(silentBtn.element);
  });

  it('9. previene que los eventos de teclado se propaguen a controles exteriores', async () => {
    const wrapper = mount(AudioActivationModal, { attachTo: container });
    const backdrop = wrapper.find('.audio-modal-backdrop');

    const keydownEvent = new KeyboardEvent('keydown', { key: 'Space', bubbles: true });
    const stopPropagationSpy = vi.spyOn(keydownEvent, 'stopPropagation');

    backdrop.element.dispatchEvent(keydownEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('10. deshabilita los botones y muestra estado de carga cuando isInitializing es true', async () => {
    const wrapper = mount(AudioActivationModal, {
      props: { isInitializing: true },
      attachTo: container,
    });

    const initBtn = wrapper.find<HTMLButtonElement>('[data-testid="initialize-audio-button"]');
    const silentBtn = wrapper.find<HTMLButtonElement>('[data-testid="keep-silent-button"]');

    expect(initBtn.element.disabled).toBe(true);
    expect(silentBtn.element.disabled).toBe(true);
    expect(initBtn.text()).toContain('INICIALIZANDO...');

    await initBtn.trigger('click');
    expect(wrapper.emitted('initialize')).toBeUndefined();
  });

  it('11. muestra una indicación discreta de error cuando la prop error está activa', () => {
    const wrapper = mount(AudioActivationModal, {
      props: { error: true },
      attachTo: container,
    });

    const errorIndicator = wrapper.find('[data-testid="audio-error-indicator"]');
    expect(errorIndicator.exists()).toBe(true);
    expect(errorIndicator.text()).toContain('AUDIO INIT FAILED // RETRY');
  });
});
