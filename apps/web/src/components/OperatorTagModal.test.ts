// @vitest-environment jsdom
import { describe, beforeEach, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OperatorTagModal from './OperatorTagModal.vue';

describe('OperatorTagModal.vue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('no renderiza contenido cuando isOpen es false', () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: false },
    });
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
  });

  it('renderiza título REGISTRO DE OPERADOR y celdas cuando isOpen es true', () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: 'MNL' },
    });
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-title"]').text()).toBe('REGISTRO DE OPERADOR');
    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('M');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('N');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('L');
  });

  it('deshabilita el botón de confirmación si no hay 3 caracteres válidos', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: '' },
    });

    const confirmBtn = wrapper.find('[data-testid="confirm-tag-button"]');
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(true);
  });

  it('acepta entrada por teclado A-Z0-9, normaliza a mayúsculas y habilita la confirmación con 3 caracteres', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: '' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('A');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('U');

    const confirmBtn = wrapper.find('[data-testid="confirm-tag-button"]');
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(false);
  });

  it('ignora símbolos, espacios y guiones en la entrada', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: '' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '@' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '_' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('');
    expect((wrapper.find('[data-testid="confirm-tag-button"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('permite borrar caracteres con Backspace', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: 'RAU' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('');
    expect((wrapper.find('[data-testid="confirm-tag-button"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('emite confirm al pulsar Enter con 3 caracteres válidos', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: 'RAU' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('confirm')).toBeTruthy();
    expect(wrapper.emitted('confirm')![0]).toEqual(['RAU']);
  });

  it('no emite confirm al pulsar Enter con menos de 3 caracteres', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, initialTag: 'RA' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('confirm')).toBeFalsy();
  });

  it('emite cancel al pulsar Escape si canCancel es true y NO altera localStorage', async () => {
    const wrapper = mount(OperatorTagModal, {
      props: { isOpen: true, canCancel: true, initialTag: 'RAU' },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('cancel')).toBeTruthy();
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();
  });
});
