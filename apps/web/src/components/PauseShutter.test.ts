// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PauseShutter from './PauseShutter.vue';

describe('PauseShutter.vue', () => {
  it('renderiza la compuerta con data-testid="pause-shutter" y señalética cuando está pausado', () => {
    const wrapper = mount(PauseShutter, {
      props: {
        status: 'paused',
      },
    });

    const shutter = wrapper.find('[data-testid="pause-shutter"]');
    expect(shutter.exists()).toBe(true);
    expect(shutter.classes()).toContain('rf-pause-shutter--sealed');
    expect(shutter.text()).toContain('SYSTEM HOLD');
    expect(shutter.text()).toContain('PAUSED');
    expect(shutter.text()).toContain('ESC — RESUME');
  });

  it('no incluye la clase sealed cuando status es running', () => {
    const wrapper = mount(PauseShutter, {
      props: {
        status: 'running',
      },
    });

    const shutter = wrapper.find('[data-testid="pause-shutter"]');
    expect(shutter.exists()).toBe(true);
    expect(shutter.classes()).not.toContain('rf-pause-shutter--sealed');
  });

  it('no renderiza la compuerta cuando status es gameOver', () => {
    const wrapper = mount(PauseShutter, {
      props: {
        status: 'gameOver',
      },
    });

    const shutter = wrapper.find('[data-testid="pause-shutter"]');
    expect(shutter.exists()).toBe(false);
  });
});
