/**
 * Pruebas unitarias para el Modal de Controles de Teclado (ControlsModal.vue).
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ControlsModal from './ControlsModal.vue';

describe('ControlsModal.vue', () => {
  it('no renderiza nada cuando isOpen es false', () => {
    const wrapper = mount(ControlsModal, {
      props: { isOpen: false },
    });
    expect(wrapper.find('[data-testid="controls-modal"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('renderiza el modal cuando isOpen es true', () => {
    const wrapper = mount(ControlsModal, {
      props: { isOpen: true },
    });
    expect(wrapper.find('[data-testid="controls-modal"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('CONTROLES DE MANDOS');
    expect(wrapper.text()).toContain('MOVIMIENTO');
    expect(wrapper.text()).toContain('ACCIONES DE PIEZA Y COMBATE');
    expect(wrapper.text()).toContain('SISTEMA');
    wrapper.unmount();
  });

  it('incluye la aclaración sobre la pausa en PvP online', () => {
    const wrapper = mount(ControlsModal, {
      props: { isOpen: true },
    });
    expect(wrapper.text()).toContain('en PvP Online la partida no se detiene');
    wrapper.unmount();
  });

  it('emite el evento close al hacer clic en el botón CERRAR', async () => {
    const wrapper = mount(ControlsModal, {
      props: { isOpen: true },
    });
    await wrapper.find('[data-testid="close-controls-modal-button"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });

  it('emite el evento close al hacer clic en el backdrop', async () => {
    const wrapper = mount(ControlsModal, {
      props: { isOpen: true },
    });
    await wrapper.find('[data-testid="controls-modal"]').trigger('click');
    expect(wrapper.emitted('close')).toBeTruthy();
    wrapper.unmount();
  });
});
