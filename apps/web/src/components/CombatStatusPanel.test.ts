/**
 * Pruebas del panel de combate simulado.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §21.2.
 */

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CombatStatusPanel from './CombatStatusPanel.vue';
import {
  SIMULATED_ENERGY_SEGMENTS,
  SIMULATED_CARTRIDGE_LABEL,
  SIMULATED_RESIDUES_COUNT,
} from '../presentation/simulated-tactical-data';

describe('CombatStatusPanel.vue', () => {
  it('renderiza los tres bloques con sus data-testid', () => {
    const wrapper = mount(CombatStatusPanel);
    expect(wrapper.find('[data-testid="simulated-energy"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="simulated-cartridge"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="simulated-residues"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('muestra una identificación general de módulo prototipo, distinta de los badges por bloque', () => {
    const wrapper = mount(CombatStatusPanel);
    const moduleBadge = wrapper.find('.module-badge');
    expect(moduleBadge.exists()).toBe(true);
    expect(moduleBadge.text()).toBe('PROTOTIPO');
    // El badge general no debe contarse como uno de los tres badges SIMULADO por bloque
    expect(wrapper.findAll('.simulated-badge')).toHaveLength(3);
    wrapper.unmount();
  });

  it('cada bloque muestra su badge SIMULADO', () => {
    const wrapper = mount(CombatStatusPanel);
    const badges = wrapper.findAll('.simulated-badge');
    expect(badges.length).toBe(3);
    for (const badge of badges) {
      expect(badge.text()).toBe('SIMULADO');
    }
    wrapper.unmount();
  });

  it('los valores mostrados coinciden con las constantes simuladas y la prop combatEnergy', () => {
    const wrapper = mount(CombatStatusPanel, {
      props: { combatEnergy: 50 },
    });

    // Energía: segmentos activos con 50 puntos = 10 de 20
    const energySegments = wrapper.findAll('.energy-segment');
    expect(energySegments.length).toBe(SIMULATED_ENERGY_SEGMENTS);
    const activeSegments = energySegments.filter((s) => s.classes().includes('active'));
    expect(activeSegments.length).toBe(10);

    // Cartucho
    expect(wrapper.text()).toContain(SIMULATED_CARTRIDGE_LABEL);

    // Residuos
    expect(wrapper.text()).toContain(`Residuos: ${SIMULATED_RESIDUES_COUNT}`);

    wrapper.unmount();
  });

  it('calcula exactamente los segmentos y estados de nivel visual (0, 10, 25, 45, 50, 75, 100)', () => {
    // 0 energía -> 0 segmentos, normal
    const wrapper0 = mount(CombatStatusPanel, { props: { combatEnergy: 0 } });
    expect(wrapper0.findAll('.energy-segment.active').length).toBe(0);
    expect(wrapper0.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper0.unmount();

    // 10 energía -> 2 segmentos, normal
    const wrapper10 = mount(CombatStatusPanel, { props: { combatEnergy: 10 } });
    expect(wrapper10.findAll('.energy-segment.active').length).toBe(2);
    expect(wrapper10.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper10.unmount();

    // 25 energía -> 5 segmentos, normal
    const wrapper25 = mount(CombatStatusPanel, { props: { combatEnergy: 25 } });
    expect(wrapper25.findAll('.energy-segment.active').length).toBe(5);
    expect(wrapper25.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper25.unmount();

    // 45 energía -> 9 segmentos, normal
    const wrapper45 = mount(CombatStatusPanel, { props: { combatEnergy: 45 } });
    expect(wrapper45.findAll('.energy-segment.active').length).toBe(9);
    expect(wrapper45.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('normal');
    wrapper45.unmount();

    // 50 energía -> 10 segmentos, azul/cian intenso
    const wrapper50 = mount(CombatStatusPanel, { props: { combatEnergy: 50 } });
    expect(wrapper50.findAll('.energy-segment.active').length).toBe(10);
    expect(wrapper50.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('intense');
    wrapper50.unmount();

    // 75 energía -> 15 segmentos, ámbar
    const wrapper75 = mount(CombatStatusPanel, { props: { combatEnergy: 75 } });
    expect(wrapper75.findAll('.energy-segment.active').length).toBe(15);
    expect(wrapper75.find('[data-testid="simulated-energy"]').attributes('data-energy-tier')).toBe('amber');
    wrapper75.unmount();

    // 100 energía -> 20 segmentos, READY
    const wrapper100 = mount(CombatStatusPanel, { props: { combatEnergy: 100 } });
    expect(wrapper100.findAll('.energy-segment.active').length).toBe(20);
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
