/**
 * Pruebas unitarias para la Pantalla/Modal de Resultados (ResultsModal.vue) con firma arcade integrada.
 */

// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ResultsModal from './ResultsModal.vue';
import type { GameResultSummary } from '../game/types';

describe('ResultsModal.vue', () => {
  const trainingResult: GameResultSummary = {
    mode: 'training',
    title: 'ENTRENAMIENTO FINALIZADO',
    subtitle: 'Sesión individual de práctica',
    score: 1250,
    linesCleared: 12,
    level: 2,
    elapsedMs: 85000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza la presentación de fin de partida y métricas principales antes de la firma', () => {
    const wrapper = mount(ResultsModal, {
      props: { result: trainingResult },
    });

    expect(wrapper.find('[data-testid="results-title"]').text()).toBe('ENTRENAMIENTO FINALIZADO');
    expect(wrapper.find('[data-testid="final-score"]').text()).toBe('1.250');
    expect(wrapper.find('[data-testid="final-level"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="final-time"]').text()).toBe('01:25');
    expect(wrapper.find('[data-testid="final-lines"]').text()).toBe('12');

    wrapper.unmount();
  });

  it('muestra celdas vacías [_] [_] [_] cuando no existe tag y mantiene deshabilitado CONFIRMAR RESULTADO', () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'awaitingTag',
        playerTag: null,
      },
    });

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('_');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('_');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('_');

    const confirmBtn = wrapper.find('[data-testid="confirm-save-button"]');
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(true);

    wrapper.unmount();
  });

  it('precarga un tag existente en las celdas [R] [A] [U] y habilita CONFIRMAR RESULTADO', () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'idle',
        playerTag: 'RAU',
      },
    });

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('A');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('U');

    const confirmBtn = wrapper.find('[data-testid="confirm-save-button"]');
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(false);

    wrapper.unmount();
  });

  it('one physical key press adds exactly one tag character', async () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'awaitingTag',
        playerTag: null,
      },
    });

    // Simular exactamente una pulsación física de 'r'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    await wrapper.vm.$nextTick();

    // Debe rellenarse EXACTAMENTE la primera celda con 'R' y dejar las demás vacías
    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('_');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('_');

    wrapper.unmount();
  });

  it('ignora event.repeat al mantener pulsada una tecla (no produce RRR)', async () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'awaitingTag',
        playerTag: null,
      },
    });

    // Primera pulsación normal
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', repeat: false }));
    await wrapper.vm.$nextTick();

    // Eventos autorepetidos del SO
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', repeat: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('_');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('_');

    wrapper.unmount();
  });

  it('permite ingresar 3 caracteres (R-A-U), normaliza a mayúsculas y habilita la confirmación', async () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'awaitingTag',
        playerTag: null,
      },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('A');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('U');

    const confirmBtn = wrapper.find('[data-testid="confirm-save-button"]');
    expect((confirmBtn.element as HTMLButtonElement).disabled).toBe(false);

    await confirmBtn.trigger('click');
    expect(wrapper.emitted('confirmSave')).toEqual([['RAU']]);

    wrapper.unmount();
  });

  it('Backspace elimina exactamente una celda por pulsación', async () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'idle',
        playerTag: 'RAU',
      },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('A');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('_');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(wrapper.find('[data-testid="tag-cell-char-1"]').text()).toBe('_');
    expect(wrapper.find('[data-testid="tag-cell-char-2"]').text()).toBe('_');

    wrapper.unmount();
  });

  it('Enter confirma el resultado si existen 3 caracteres válidos, e ignora con menos de 3', async () => {
    const wrapper = mount(ResultsModal, {
      props: {
        result: trainingResult,
        saveStatus: 'awaitingTag',
        playerTag: null,
      },
    });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    await wrapper.vm.$nextTick();

    // Enter con 1 carácter -> ignora
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('confirmSave')).toBeFalsy();

    // Escribir resto 'A', 'U'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    // Enter con 3 caracteres -> confirma
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('confirmSave')).toEqual([['RAU']]);

    wrapper.unmount();
  });

  it('emite evento replay al pulsar Volver a jugar', async () => {
    const wrapper = mount(ResultsModal, { props: { result: trainingResult } });
    await wrapper.find('[data-testid="replay-button"]').trigger('click');

    expect(wrapper.emitted('replay')).toBeTruthy();
    wrapper.unmount();
  });

  it('emite evento mainMenu al pulsar Menú principal', async () => {
    const wrapper = mount(ResultsModal, { props: { result: trainingResult } });
    await wrapper.find('[data-testid="main-menu-button"]').trigger('click');

    expect(wrapper.emitted('mainMenu')).toBeTruthy();
    wrapper.unmount();
  });
});
