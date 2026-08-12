// @vitest-environment jsdom
/**
 * Pruebas mínimas de DevLauncherScreen.vue.
 *
 * Pantalla contenedora que añade la cabecera de DEV Tools y el botón de
 * volver al menú alrededor de DevDemoLauncher.vue (que ya no los tiene,
 * ver DevDemoLauncher.test.ts). Cobertura acotada a lo que aporta esta
 * pantalla: cabecera, presencia del launcher y navegación de vuelta.
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DevLauncherScreen from './DevLauncherScreen.vue';

describe('DevLauncherScreen.vue', () => {
  it('renderiza la cabecera de herramientas DEV', () => {
    const wrapper = mount(DevLauncherScreen);
    expect(wrapper.find('[data-testid="dev-launcher-screen"]').exists()).toBe(true);
    expect(wrapper.find('.dev-title').text()).toBe('DEV TOOLS · DEMO LAUNCHER');
    wrapper.unmount();
  });

  it('renderiza el lanzador de demos DEV', () => {
    const wrapper = mount(DevLauncherScreen);
    expect(wrapper.find('[data-testid="dev-demo-launcher"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('ofrece el botón Volver al menú y emite backToMenu al pulsarlo', async () => {
    const wrapper = mount(DevLauncherScreen);
    const backBtn = wrapper.find('[data-testid="dev-back-to-menu-button"]');
    expect(backBtn.exists()).toBe(true);
    expect(backBtn.text()).toBe('Volver al menú');

    await backBtn.trigger('click');
    expect(wrapper.emitted('backToMenu')).toBeTruthy();

    wrapper.unmount();
  });
});
