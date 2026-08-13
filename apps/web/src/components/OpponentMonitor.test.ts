/**
 * Pruebas del monitor rival (simulado y real).
 */

// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import OpponentMonitor from './OpponentMonitor.vue';
import type { ActiveEffectSnapshot, SabotageType } from '@rautfall/game-engine';
import type { CellPresentation, OpponentPresentationState } from '../game/types';
import {
  OPPONENT_STATIC_BOARD,
  SIMULATED_OPPONENT_LINK_STATUS,
  SIMULATED_OPPONENT_SECTOR,
  SIMULATED_OPPONENT_CHANNEL,
} from '../presentation/simulated-tactical-data';

const mockOpponentState: OpponentPresentationState = Object.freeze({
  status: 'running',
  level: 3,
  combatEnergy: 75,
  storedSabotages: Object.freeze(['residuos' as SabotageType, 'sobrecarga' as SabotageType]),
  activeEffects: Object.freeze([{ type: 'sobrecarga', remainingMs: 8000 } as ActiveEffectSnapshot]),
  pendingGarbage: 2,
  visibleCells: Object.freeze([
    { x: 0, y: 19, type: 'garbage', appearance: 'fixed', color: '#555555' } as CellPresentation,
    { x: 4, y: 10, type: 'T', appearance: 'active', color: '#9b59b6' } as CellPresentation,
    { x: 4, y: 18, type: 'T', appearance: 'ghost', color: '#9b59b6' } as CellPresentation,
  ]),
});

describe('OpponentMonitor.vue', () => {
  describe('Modo Entrenamiento (1P)', () => {
    // La cabecera ya no tiene badges de estado (standby/simulado/real) — es
    // un título fijo "OPPONENT" en los 3 modos. El estado se distingue por
    // el contenido del tablero y la telemetría, no por un badge.
    it('no muestra celdas ficticias y renderiza el overlay STANDBY con su telemetría', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { mode: 'training' },
      });
      expect(wrapper.findAll('[data-testid="opponent-cell"]').length).toBe(0);
      expect(wrapper.find('[data-testid="standby-board-overlay"]').text()).toBe('STANDBY');
      expect(wrapper.find('[data-testid="training-telemetry"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('ENTRENAMIENTO');
      wrapper.unmount();
    });
  });

  describe('Modo Simulado (1P legacy demo)', () => {
    it('no muestra el overlay STANDBY ni la telemetría de entrenamiento', () => {
      const wrapper = mount(OpponentMonitor);
      expect(wrapper.find('[data-testid="standby-board-overlay"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="training-telemetry"]').exists()).toBe(false);
      wrapper.unmount();
    });

    it('renderiza el número esperado de celdas estáticas', () => {
      const wrapper = mount(OpponentMonitor);
      const cells = wrapper.findAll('[data-testid="opponent-cell"]');
      expect(cells.length).toBe(OPPONENT_STATIC_BOARD.length);
      wrapper.unmount();
    });

    it('muestra la señalética secundaria simulada', () => {
      const wrapper = mount(OpponentMonitor);
      expect(wrapper.text()).toContain(SIMULATED_OPPONENT_LINK_STATUS);
      expect(wrapper.text()).toContain(SIMULATED_OPPONENT_SECTOR);
      expect(wrapper.text()).toContain(SIMULATED_OPPONENT_CHANNEL);
      wrapper.unmount();
    });

    it('el contenido no cambia tras avanzar temporizadores', () => {
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

  describe('Modo Real (2P Battle)', () => {
    it('cambia a la telemetría real (nivel de P2) cuando recibe playerTwo', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState },
      });
      expect(wrapper.find('[data-testid="training-telemetry"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="opponent-level"]').text()).toBe('3');
      wrapper.unmount();
    });

    it('renderiza las celdas visibles reales con sus clases de apariencia', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState },
      });
      const cells = wrapper.findAll('[data-testid="opponent-cell"]');
      expect(cells.length).toBe(3);

      expect(cells[0]!.classes()).toContain('opponent-cell--fixed');
      expect(cells[1]!.classes()).toContain('opponent-cell--active');
      expect(cells[2]!.classes()).toContain('opponent-cell--ghost');
      wrapper.unmount();
    });

    it('muestra la telemetría táctica real de P2', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState },
      });
      expect(wrapper.find('[data-testid="opponent-level"]').text()).toBe('3');
      expect(wrapper.find('[data-testid="opponent-energy"]').text()).toBe('75 / 100');
      expect(wrapper.find('[data-testid="opponent-sabotages"]').text()).toBe('residuos, sobrecarga');
      expect(wrapper.find('[data-testid="opponent-effects"]').text()).toBe('SOBRECARGA 8s');
      expect(wrapper.find('[data-testid="opponent-pending-garbage"]').text()).toBe('+2 filas');
      wrapper.unmount();
    });

    it('muestra el estado técnico de señal suspendida FEED HOLD cuando isPaused es true', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState, isPaused: true },
      });
      const pauseOverlay = wrapper.find('[data-testid="opponent-pause-overlay"]');
      expect(pauseOverlay.exists()).toBe(true);
      expect(pauseOverlay.text()).toContain('FEED HOLD');
      expect(pauseOverlay.text()).toContain('TACTICAL LINK SUSPENDED');
      expect(pauseOverlay.text()).not.toContain('PAUSA');
      wrapper.unmount();
    });

    it('muestra los indicadores terminales según battleStatus y winner', async () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState, battleStatus: 'playerOneWon', winner: 'playerOne' },
      });
      let banner = wrapper.find('[data-testid="opponent-terminal-banner"]');
      expect(banner.exists()).toBe(true);
      expect(banner.text()).toBe('DERROTA RIVAL');

      await wrapper.setProps({ battleStatus: 'playerTwoWon', winner: 'playerTwo' } as Record<string, unknown>);
      banner = wrapper.find('[data-testid="opponent-terminal-banner"]');
      expect(banner.text()).toBe('VICTORIA RIVAL');

      await wrapper.setProps({ battleStatus: 'draw', winner: 'draw' } as Record<string, unknown>);
      banner = wrapper.find('[data-testid="opponent-terminal-banner"]');
      expect(banner.text()).toBe('EMPATE');

      wrapper.unmount();
    });

    it('permite cambiar props / resetear sin resolver reglas de dominio en el componente', async () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState, battleStatus: 'running' },
      });

      expect(wrapper.findAll('[data-testid="opponent-cell"]').length).toBe(3);

      const emptyState: OpponentPresentationState = {
        ...mockOpponentState,
        visibleCells: [],
        pendingGarbage: 0,
      };

      await wrapper.setProps({ playerTwo: emptyState } as Record<string, unknown>);
      expect(wrapper.findAll('[data-testid="opponent-cell"]').length).toBe(0);
      expect(wrapper.find('[data-testid="opponent-pending-garbage"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('muestra el velo de SEÑAL INTERFERIDA cuando isInterfered es true en playerTwo', () => {
      const interferedState: OpponentPresentationState = {
        ...mockOpponentState,
        isInterfered: true,
        interferenciaRemainingMs: 5000,
      };
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: interferedState },
      });
      const overlay = wrapper.find('[data-testid="interferencia-overlay"]');
      expect(overlay.exists()).toBe(true);
      expect(overlay.text()).toBe('SEÑAL INTERFERIDA');
      wrapper.unmount();
    });

    it('protege el comportamiento observable: no renderiza compuerta de pausa ni lamas animadas al pausar', () => {
      const wrapper = mount(OpponentMonitor, {
        props: { playerTwo: mockOpponentState, isPaused: true },
      });
      expect(wrapper.find('[data-testid="pause-shutter"]').exists()).toBe(false);
      expect(wrapper.find('.rf-pause-shutter').exists()).toBe(false);
      expect(wrapper.find('.shutter-slat').exists()).toBe(false);
      expect(wrapper.find('[data-testid="opponent-pause-overlay"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="opponent-board"]').exists()).toBe(true);
      wrapper.unmount();
    });
  });
});
