/**
 * Pruebas del módulo ENERGY (CombatStatusPanel.vue).
 *
 * CARTUCHO, RESIDUOS y EFECTOS ACTIVOS ya no viven aquí: se extrajeron a
 * AttackSlotsPanel.vue en la Tarea 0031 (ver cabecera de CombatStatusPanel.vue
 * — "ATTACK SLOTS vive en AttackSlotsPanel.vue"), así que ya no se prueban
 * en este archivo.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §21.2.
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CombatStatusPanel from './CombatStatusPanel.vue';
import { SIMULATED_ENERGY_SEGMENTS } from '../presentation/simulated-tactical-data';

describe('CombatStatusPanel.vue', () => {
  it('renderiza el bloque ENERGY con su data-testid y el total de segmentos', () => {
    const wrapper = mount(CombatStatusPanel);
    expect(wrapper.find('[data-testid="simulated-energy"]').exists()).toBe(true);
    expect(wrapper.findAll('.energy-segment-block').length).toBe(SIMULATED_ENERGY_SEGMENTS);
    wrapper.unmount();
  });

  it('calcula exactamente los segmentos y estados de nivel visual (0, 10, 25, 45, 50, 75, 100)', () => {
    // 0 energía -> 0 segmentos, normal
    const wrapper0 = mount(CombatStatusPanel, { props: { combatEnergy: 0 } });
    expect(wrapper0.findAll('.energy-segment-block.active').length).toBe(0);
    expect(wrapper0.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper0.unmount();

    // 10 energía -> 2 segmentos, normal
    const wrapper10 = mount(CombatStatusPanel, { props: { combatEnergy: 10 } });
    expect(wrapper10.findAll('.energy-segment-block.active').length).toBe(2);
    expect(wrapper10.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper10.unmount();

    // 25 energía -> 5 segmentos, normal
    const wrapper25 = mount(CombatStatusPanel, { props: { combatEnergy: 25 } });
    expect(wrapper25.findAll('.energy-segment-block.active').length).toBe(5);
    expect(wrapper25.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper25.unmount();

    // 45 energía -> 9 segmentos, normal
    const wrapper45 = mount(CombatStatusPanel, { props: { combatEnergy: 45 } });
    expect(wrapper45.findAll('.energy-segment-block.active').length).toBe(9);
    expect(wrapper45.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper45.unmount();

    // 50 energía -> 10 segmentos, cian intenso
    const wrapper50 = mount(CombatStatusPanel, { props: { combatEnergy: 50 } });
    expect(wrapper50.findAll('.energy-segment-block.active').length).toBe(10);
    expect(wrapper50.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('intense');
    wrapper50.unmount();

    // 75 energía -> 15 segmentos, ámbar
    const wrapper75 = mount(CombatStatusPanel, { props: { combatEnergy: 75 } });
    expect(wrapper75.findAll('.energy-segment-block.active').length).toBe(15);
    expect(wrapper75.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('amber');
    wrapper75.unmount();

    // 100 energía -> 20 segmentos, READY
    const wrapper100 = mount(CombatStatusPanel, { props: { combatEnergy: 100 } });
    expect(wrapper100.findAll('.energy-segment-block.active').length).toBe(20);
    expect(wrapper100.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('ready');
    expect(wrapper100.find('[data-testid="energy-ready-badge"]').text()).toBe('READY');
    wrapper100.unmount();
  });

  it('el contenido no cambia tras remontar el componente dos veces', () => {
    const wrapper1 = mount(CombatStatusPanel);
    const html1 = wrapper1.html();
    wrapper1.unmount();

    const wrapper2 = mount(CombatStatusPanel);
    const html2 = wrapper2.html();
    wrapper2.unmount();

    expect(html2).toBe(html1);
  });
});
