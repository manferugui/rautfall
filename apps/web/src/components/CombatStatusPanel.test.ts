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
  SIMULATED_ENERGY_ACTIVE,
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

  it('los valores mostrados coinciden con las constantes de simulated-tactical-data', () => {
    const wrapper = mount(CombatStatusPanel);

    // Energía: segmentos activos
    const energySegments = wrapper.findAll('.energy-segment');
    expect(energySegments.length).toBe(SIMULATED_ENERGY_SEGMENTS);
    const activeSegments = energySegments.filter((s) => s.classes().includes('active'));
    expect(activeSegments.length).toBe(SIMULATED_ENERGY_ACTIVE);

    // Cartucho
    expect(wrapper.text()).toContain(SIMULATED_CARTRIDGE_LABEL);

    // Residuos
    expect(wrapper.text()).toContain(`Residuos: ${SIMULATED_RESIDUES_COUNT}`);

    wrapper.unmount();
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
