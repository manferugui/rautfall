// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import DevDemoLauncher from './DevDemoLauncher.vue';
import { DEV_DEMOS } from '../dev/dev-demos';

// Nota: el botón "Volver al menú" y la cabecera de DEV Tools ya no viven
// aquí — DevDemoLauncher.vue es solo la rejilla de tarjetas (responsabilidad
// única, ver su propia cabecera). Esa navegación se prueba en
// DevLauncherScreen.test.ts, el contenedor de pantalla que la usa.
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

  it('renderiza el contenedor de la rejilla con data-testid="dev-demo-launcher"', () => {
    const wrapper = mount(DevDemoLauncher);
    expect(wrapper.find('[data-testid="dev-demo-launcher"]').exists()).toBe(true);
  });

  it('renderiza la lista completa de tarjetas de demos registradas', () => {
    const wrapper = mount(DevDemoLauncher);
    const cards = wrapper.findAll('.demo-card');
    expect(cards.length).toBe(DEV_DEMOS.length);
  });

  it('navega a la URL limpia de la demo elegida al hacer clic en Abrir', async () => {
    const wrapper = mount(DevDemoLauncher);

    const firstDemo = DEV_DEMOS[0]!;
    const launchBtn = wrapper.find(`[data-testid="launch-${firstDemo.id}"]`);
    expect(launchBtn.exists()).toBe(true);

    await launchBtn.trigger('click');
    expect(window.location.href).toBe('/?battle-demo=1');
  });
});
