/**
 * Pruebas del monitor rival simulado.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §21.1.
 */

// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OpponentMonitor from './OpponentMonitor.vue';
import {
  OPPONENT_STATIC_BOARD,
  SIMULATED_OPPONENT_LINK_STATUS,
  SIMULATED_OPPONENT_SECTOR,
  SIMULATED_OPPONENT_CHANNEL,
} from '../presentation/simulated-tactical-data';

describe('OpponentMonitor.vue', () => {
  it('renderiza la etiqueta "SIMULADO"', () => {
    const wrapper = mount(OpponentMonitor);
    expect(wrapper.text()).toContain('SIMULADO');
    wrapper.unmount();
  });

  it('renderiza el número esperado de celdas ocupadas', () => {
    const wrapper = mount(OpponentMonitor);
    const cells = wrapper.findAll('.opponent-cell');
    expect(cells.length).toBe(OPPONENT_STATIC_BOARD.length);
    wrapper.unmount();
  });

  it('no contiene ninguna pieza activa distinguible (solo celdas del patrón estático)', () => {
    const wrapper = mount(OpponentMonitor);
    // Solo debe haber .opponent-cell, sin elementos adicionales dentro del tablero
    const board = wrapper.find('.opponent-board');
    const children = board.findAll('div');
    expect(children.length).toBe(OPPONENT_STATIC_BOARD.length);
    wrapper.unmount();
  });

  it('muestra la señalética secundaria simulada (enlace, sector, canal)', () => {
    const wrapper = mount(OpponentMonitor);
    expect(wrapper.text()).toContain(SIMULATED_OPPONENT_LINK_STATUS);
    expect(wrapper.text()).toContain(SIMULATED_OPPONENT_SECTOR);
    expect(wrapper.text()).toContain(SIMULATED_OPPONENT_CHANNEL);
    wrapper.unmount();
  });

  it('el contenido no cambia tras avanzar temporizadores simulados', () => {
    vi.useFakeTimers();
    const wrapper = mount(OpponentMonitor);
    const htmlBefore = wrapper.html();

    vi.advanceTimersByTime(5000);

    const htmlAfter = wrapper.html();
    expect(htmlAfter).toBe(htmlBefore);

    vi.useRealTimers();
    wrapper.unmount();
  });
});
