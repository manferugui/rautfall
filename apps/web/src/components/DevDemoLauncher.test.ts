// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import DevDemoLauncher from './DevDemoLauncher.vue';
import { DEV_DEMOS } from '../dev/dev-demos';

describe('DevDemoLauncher.vue', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: Location }).location = {
      pathname: '/',
      href: 'http://localhost/',
    } as unknown as Location;
  });

  afterEach(() => {
    (window as unknown as { location: Location }).location = originalLocation;
  });

  it('renderiza el contenedor del lanzador DEV y el título principal', () => {
    const wrapper = mount(DevDemoLauncher);
    expect(wrapper.find('[data-testid="dev-demo-launcher"]').exists()).toBe(true);
    expect(wrapper.find('.launcher-title').text()).toMatch(/DEV Demo Launcher/i);
  });

  it('renderiza la lista completa de tarjetas de demos registradas', () => {
    const wrapper = mount(DevDemoLauncher);
    const cards = wrapper.findAll('.demo-card');
    expect(cards.length).toBe(DEV_DEMOS.length);
  });

  it('ofrece el botón Volver al menú', () => {
    const wrapper = mount(DevDemoLauncher);
    const returnBtn = wrapper.find('[data-testid="return-to-menu-button"]');
    expect(returnBtn.exists()).toBe(true);
    expect(returnBtn.text()).toBe('Volver al menú');
  });

  it('navega a la URL limpia de la demo elegida al hacer clic en Abrir', async () => {
    const wrapper = mount(DevDemoLauncher);

    const firstDemo = DEV_DEMOS[0]!;
    const launchBtn = wrapper.find(`[data-testid="launch-${firstDemo.id}"]`);
    expect(launchBtn.exists()).toBe(true);

    await launchBtn.trigger('click');
    expect(window.location.href).toBe('/?battle-demo=1');
  });

  it('navega a la URL sin query params al hacer clic en Volver al menú', async () => {
    const wrapper = mount(DevDemoLauncher);

    const returnBtn = wrapper.find('[data-testid="return-to-menu-button"]');
    await returnBtn.trigger('click');
    expect(window.location.href).toBe('/');
  });
});
