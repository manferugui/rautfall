// @vitest-environment jsdom
/**
 * Pruebas de los estados de pre-aviso (Warning 750 ms) de sabotajes en el marco del tablero (board-bezel).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../App.vue';
import type { GamePresentationState } from '../game/types';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  togglePause: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('../game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

describe('Board Bezel Sabotage Warnings (Fase 1: 750 ms Pre-aviso)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  async function mountAppInBattle(): Promise<{ wrapper: ReturnType<typeof mount>; emitState: (state: Partial<GamePresentationState>) => void }> {
    const wrapper = mount(App, {
      global: {
        stubs: {
          NextPiecesPreview: true,
          ScorePanel: true,
          OpponentMonitor: true,
          CombatStatusPanel: true,
          AttackSlotsPanel: true,
        },
      },
    });

      const battleBtn = wrapper.find('[data-testid="start-battle-button"]');
      if (battleBtn.exists()) {
        await battleBtn.trigger('click');
        await wrapper.vm.$nextTick();
        const operatorBtn = wrapper.find('[data-testid="bot-profile-operator"]');
        if (operatorBtn.exists()) {
          await operatorBtn.trigger('click');
          await wrapper.vm.$nextTick();
        }
        await flushPromises();
      }

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const baseState: GamePresentationState = {
      status: 'running',
      step: 10,
      elapsedMs: 500,
      nextPieces: ['I', 'O', 'T'],
      heldPiece: null,
      score: 100,
      clearedLines: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 20,
      storedSabotages: [],
      pendingGarbage: 0,
      activeEffects: [],
      level: 1,
      baseGravityCellsPerSecond: 1.0,
      activeGravityCellsPerSecond: 1.0,
    };

    const emitState = (customState: Partial<GamePresentationState>): void => {
      stateUpdateCallback({
        ...baseState,
        ...customState,
      });
    };

    return { wrapper, emitState };
  }

  it('1. warning de Sobrecarga activa la clase/estado visual correcto en el bezel local', async () => {
    const { wrapper, emitState } = await mountAppInBattle();

    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 15,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [{ sabotage: 'sobrecarga', remainingMs: 750 }],
          immunities: [],
          activeEffects: [],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bezel = wrapper.find('[data-testid="board-bezel"]');
    expect(bezel.exists()).toBe(true);
    expect(bezel.classes()).toContain('board-bezel--warning-sobrecarga');
    expect(bezel.attributes('data-warning-sobrecarga')).toBe('true');

    wrapper.unmount();
  });

  it('2. warning de Polaridad activa el estado correcto y el indicador de inversión lateral', async () => {
    const { wrapper, emitState } = await mountAppInBattle();

    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 20,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [{ sabotage: 'polaridad', remainingMs: 750 }],
          immunities: [],
          activeEffects: [],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bezel = wrapper.find('[data-testid="board-bezel"]');
    expect(bezel.classes()).toContain('board-bezel--warning-polaridad');
    expect(bezel.attributes('data-warning-polaridad')).toBe('true');
    expect(wrapper.find('[data-testid="polarity-warning-indicator"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('3. warning de Interferencia activa el estado correcto', async () => {
    const { wrapper, emitState } = await mountAppInBattle();

    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 25,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [{ sabotage: 'interferencia', remainingMs: 750 }],
          immunities: [],
          activeEffects: [],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bezel = wrapper.find('[data-testid="board-bezel"]');
    expect(bezel.classes()).toContain('board-bezel--warning-interferencia');
    expect(bezel.attributes('data-warning-interferencia')).toBe('true');

    wrapper.unmount();
  });

  it('4. al expirar/desaparecer el warning, el bezel vuelve a estado neutro', async () => {
    const { wrapper, emitState } = await mountAppInBattle();

    // Estado 1: Warning activo
    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 30,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [{ sabotage: 'sobrecarga', remainingMs: 500 }],
          immunities: [],
          activeEffects: [],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bezel = wrapper.find('[data-testid="board-bezel"]');
    expect(bezel.classes()).toContain('board-bezel--warning-sobrecarga');

    // Estado 2: Expirado / warnings vacíos
    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 45,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [],
          immunities: [],
          activeEffects: [{ type: 'interferencia', remainingMs: 5000 }],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
        },
      },
    });
    await wrapper.vm.$nextTick();

    expect(bezel.classes()).not.toContain('board-bezel--warning-sobrecarga');
    expect(bezel.attributes('data-warning-sobrecarga')).toBe('false');

    wrapper.unmount();
  });

  it('5. warnings del rival no activan el bezel del jugador local', async () => {
    const { wrapper, emitState } = await mountAppInBattle();

    emitState({
      battleState: {
        status: 'running',
        winner: null,
        step: 50,
        lastSabotageRouted: null,
        playerOneState: {
          warnings: [], // Jugador local SIN warnings
          immunities: [],
          activeEffects: [],
          isInterfered: false,
          interferenciaRemainingMs: 0,
        },
        playerTwo: {
          status: 'running',
          level: 1,
          combatEnergy: 0,
          storedSabotages: [],
          activeEffects: [],
          pendingGarbage: 0,
          visibleCells: [],
          warnings: [{ sabotage: 'sobrecarga', remainingMs: 750 }], // Rival TIENE warning
        },
      },
    });
    await wrapper.vm.$nextTick();

    const bezel = wrapper.find('[data-testid="board-bezel"]');
    expect(bezel.classes()).not.toContain('board-bezel--warning-sobrecarga');
    expect(bezel.attributes('data-warning-sobrecarga')).toBe('false');
    expect(bezel.attributes('data-warning-polaridad')).toBe('false');
    expect(bezel.attributes('data-warning-interferencia')).toBe('false');

    wrapper.unmount();
  });

  describe('FX de Estado ACTIVO de Polaridad', () => {
    it('1. Polaridad activa aplica el estado visual, la microplaca y los brackets laterales en el bezel', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 2 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-polaridad');
      expect(bezel.attributes('data-active-polaridad')).toBe('true');

      const indicator = wrapper.find('[data-testid="polarity-active-indicator"]');
      expect(indicator.exists()).toBe(true);
      expect(indicator.text()).toContain('POLARIDAD · 2 PIEZAS');

      expect(wrapper.find('[data-testid="polarity-left-bracket"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="polarity-right-bracket"]').exists()).toBe(true);

      wrapper.unmount();
    });

    it('2. el contador refleja el plural y singular de remainingPieces correctamente', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      // Plural: 2 PIEZAS
      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 2 }],
      });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[data-testid="polarity-active-indicator"]').text()).toContain('POLARIDAD · 2 PIEZAS');

      // Singular: 1 PIEZA
      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 1 }],
      });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('[data-testid="polarity-active-indicator"]').text()).toContain('POLARIDAD · 1 PIEZA');

      wrapper.unmount();
    });

    it('3. el warning de 750ms INVERSIÓN HZ se oculta cuando el efecto pasa a estar ACTIVO', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 2 }],
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [{ sabotage: 'polaridad', remainingMs: 50 }],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-polaridad');
      expect(bezel.classes()).not.toContain('board-bezel--warning-polaridad');
      expect(wrapper.find('[data-testid="polarity-warning-indicator"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="polarity-active-indicator"]').exists()).toBe(true);

      wrapper.unmount();
    });

    it('4. el decremento de remainingPieces activa la clase de pulso mecánico en los brackets laterales', async () => {
      vi.useFakeTimers();
      const { wrapper, emitState } = await mountAppInBattle();

      // Estado 1: 2 piezas
      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 2 }],
      });
      await wrapper.vm.$nextTick();

      const leftBracket = wrapper.find('[data-testid="polarity-left-bracket"]');
      expect(leftBracket.classes()).not.toContain('polarity-bracket--pulse');

      // Estado 2: Decremento a 1 pieza
      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 1 }],
      });
      await wrapper.vm.$nextTick();

      expect(leftBracket.classes()).toContain('polarity-bracket--pulse');

      // Avanzar temporizador del pulso (100ms)
      vi.advanceTimersByTime(110);
      await wrapper.vm.$nextTick();

      expect(leftBracket.classes()).not.toContain('polarity-bracket--pulse');

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('5. al expirar polaridad, se eliminan los elementos de polaridad y el bezel vuelve a neutro', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 1 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-polaridad');

      // Expiración
      emitState({
        activeEffects: [],
      });
      await wrapper.vm.$nextTick();

      expect(bezel.classes()).not.toContain('board-bezel--active-polaridad');
      expect(bezel.attributes('data-active-polaridad')).toBe('false');
      expect(wrapper.find('[data-testid="polarity-active-indicator"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="polarity-left-bracket"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('6. otros efectos (ej. sobrecarga) no activan los estilos ni brackets de Polaridad activa', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 5000 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).not.toContain('board-bezel--active-polaridad');
      expect(bezel.attributes('data-active-polaridad')).toBe('false');
      expect(wrapper.find('[data-testid="polarity-active-indicator"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="polarity-left-bracket"]').exists()).toBe(false);

      wrapper.unmount();
    });
  });

  describe('FX de Estado ACTIVO de Sobrecarga', () => {
    it('1. Sobrecarga activa aplica el estado visual y la microplaca activa con countdown en el bezel', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 4800 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-sobrecarga');
      expect(bezel.attributes('data-active-sobrecarga')).toBe('true');

      const indicator = wrapper.find('[data-testid="sobrecarga-active-indicator"]');
      expect(indicator.exists()).toBe(true);
      expect(indicator.text()).toBe('SOBRECARGA 4.8s');

      wrapper.unmount();
    });

    it('2. el countdown deriva directamente de remainingMs del snapshot con 1 decimal', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 3250 }],
      });
      await wrapper.vm.$nextTick();

      const indicator = wrapper.find('[data-testid="sobrecarga-active-indicator"]');
      expect(indicator.text()).toBe('SOBRECARGA 3.3s');

      wrapper.unmount();
    });

    it('3. la microplaca de warning de 750ms desaparece inmediatamente al activarse el efecto', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      // Estado con warning y active efecto al mismo tiempo (transición)
      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 5000 }],
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [{ sabotage: 'sobrecarga', remainingMs: 50 }],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-sobrecarga');
      expect(bezel.classes()).not.toContain('board-bezel--warning-sobrecarga');
      expect(wrapper.find('[data-testid="sabotage-warning-plate"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="sobrecarga-active-indicator"]').exists()).toBe(true);

      wrapper.unmount();
    });

    it('4. al desaparecer sobrecarga de activeEffects, el bezel vuelve inmediatamente a neutro', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      // Estado 1: Sobrecarga activa
      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 1000 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-sobrecarga');

      // Estado 2: Efectos vacíos
      emitState({
        activeEffects: [],
      });
      await wrapper.vm.$nextTick();

      expect(bezel.classes()).not.toContain('board-bezel--active-sobrecarga');
      expect(bezel.attributes('data-active-sobrecarga')).toBe('false');
      expect(wrapper.find('[data-testid="sobrecarga-active-indicator"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('5. otros efectos activos (ej. polaridad o interferencia) no activan los estilos de Sobrecarga activa', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'polaridad', remainingPieces: 2 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).not.toContain('board-bezel--active-sobrecarga');
      expect(bezel.attributes('data-active-sobrecarga')).toBe('false');
      expect(wrapper.find('[data-testid="sobrecarga-active-indicator"]').exists()).toBe(false);

      wrapper.unmount();
    });
  });

  describe('FX de Estado ACTIVO de Interferencia', () => {
    it('1. Interferencia activa aplica el tratamiento visual frío y la microplaca activa en el bezel', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [{ type: 'interferencia', remainingMs: 4800 }],
            isInterfered: true,
            interferenciaRemainingMs: 4800,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-interferencia');
      expect(bezel.attributes('data-active-interferencia')).toBe('true');

      const indicator = wrapper.find('[data-testid="interferencia-active-indicator"]');
      expect(indicator.exists()).toBe(true);
      expect(indicator.text()).toBe('INTERFERENCIA · 4.8s');

      wrapper.unmount();
    });

    it('2. el countdown deriva de interferenciaRemainingMs con 1 decimal', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [{ type: 'interferencia', remainingMs: 3200 }],
            isInterfered: true,
            interferenciaRemainingMs: 3200,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const indicator = wrapper.find('[data-testid="interferencia-active-indicator"]');
      expect(indicator.text()).toBe('INTERFERENCIA · 3.2s');

      wrapper.unmount();
    });

    it('3. el warning de 750ms se oculta inmediatamente cuando la interferencia pasa a estado ACTIVO', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [{ sabotage: 'interferencia', remainingMs: 50 }],
            immunities: [],
            activeEffects: [{ type: 'interferencia', remainingMs: 5000 }],
            isInterfered: true,
            interferenciaRemainingMs: 5000,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-interferencia');
      expect(bezel.classes()).not.toContain('board-bezel--warning-interferencia');
      expect(wrapper.find('[data-testid="sabotage-warning-plate"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="interferencia-active-indicator"]').exists()).toBe(true);

      wrapper.unmount();
    });

    it('4. OpponentMonitor recibe playerTwo.isInterfered true cuando playerTwo está interferido', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
            isInterfered: true,
            interferenciaRemainingMs: 5000,
          },
        },
      });
      await wrapper.vm.$nextTick();

      const opponentMonitor = wrapper.findComponent({ name: 'OpponentMonitor' });
      expect(opponentMonitor.exists()).toBe(true);
      expect((opponentMonitor.props('playerTwo') as { isInterfered?: boolean })?.isInterfered).toBe(true);

      wrapper.unmount();
    });

    it('5. al expirar la interferencia (isInterfered false / 0 ms), el bezel y monitor vuelven a neutro', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 30,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [{ type: 'interferencia', remainingMs: 1000 }],
            isInterfered: true,
            interferenciaRemainingMs: 1000,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--active-interferencia');

      // Expiración
      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 50,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
        },
      });
      await wrapper.vm.$nextTick();

      expect(bezel.classes()).not.toContain('board-bezel--active-interferencia');
      expect(bezel.attributes('data-active-interferencia')).toBe('false');
      expect(wrapper.find('[data-testid="interferencia-active-indicator"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('6. Sobrecarga o Polaridad activas no activan los estilos de Interferencia activa', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        activeEffects: [{ type: 'sobrecarga', remainingMs: 5000 }],
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).not.toContain('board-bezel--active-interferencia');
      expect(bezel.attributes('data-active-interferencia')).toBe('false');
      expect(wrapper.find('[data-testid="interferencia-active-indicator"]').exists()).toBe(false);

      wrapper.unmount();
    });
  });

  describe('FX de SABOTAJE BLOQUEADO e INMUNIDAD ACTIVA', () => {
    it('1. sabotageBlocked dirigido a playerOne muestra el feedback puntual y el subtítulo según reason', async () => {
      vi.useFakeTimers();
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 100,
          lastSabotageRouted: null,
          lastSabotageBlocked: 'sobrecarga -> playerOne (immunity)',
          lastSabotageBlockedDetails: {
            target: 'playerOne',
            source: 'playerTwo',
            sabotage: 'sobrecarga',
            reason: 'immunity',
            id: 1,
          },
          playerOneState: {
            warnings: [],
            immunities: [{ sabotage: 'sobrecarga', remainingMs: 3800 }],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--sabotage-blocked');

      const indicator = wrapper.find('[data-testid="sabotage-blocked-indicator"]');
      expect(indicator.exists()).toBe(true);
      expect(indicator.text()).toContain('SABOTAJE BLOQUEADO');
      expect(indicator.text()).toContain('INMUNIDAD');

      // Avanzar temporizador del feedback puntual (350 ms)
      vi.advanceTimersByTime(360);
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="sabotage-blocked-indicator"]').exists()).toBe(false);

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('2. sabotageBlocked dirigido al rival (playerTwo) no genera feedback visual local', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 100,
          lastSabotageRouted: null,
          lastSabotageBlocked: 'sobrecarga -> playerTwo (immunity)',
          lastSabotageBlockedDetails: {
            target: 'playerTwo',
            source: 'playerOne',
            sabotage: 'sobrecarga',
            reason: 'immunity',
            id: 2,
          },
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="sabotage-blocked-indicator"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('3. Inmunidad activa en playerOneState muestra el indicador compacto y countdown en vivo', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 100,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [{ sabotage: 'sobrecarga', remainingMs: 3800 }],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).toContain('board-bezel--immunity-active');
      expect(bezel.attributes('data-immunity-active')).toBe('true');

      const indicator = wrapper.find('[data-testid="immunity-active-indicator"]');
      expect(indicator.exists()).toBe(true);
      expect(indicator.text()).toContain('INMUNIDAD SOBRECARGA · 3.8s');

      wrapper.unmount();
    });

    it('4. al expirar la inmunidad (immunities vacías), el indicador desaparece inmediatamente', async () => {
      const { wrapper, emitState } = await mountAppInBattle();

      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 100,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [{ sabotage: 'polaridad', remainingMs: 1500 }],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="immunity-active-indicator"]').exists()).toBe(true);

      // Expiración
      emitState({
        battleState: {
          status: 'running',
          winner: null,
          step: 120,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
          },
        },
      });
      await wrapper.vm.$nextTick();

      const bezel = wrapper.find('[data-testid="board-bezel"]');
      expect(bezel.classes()).not.toContain('board-bezel--immunity-active');
      expect(bezel.attributes('data-immunity-active')).toBe('false');
      wrapper.unmount();
    });
  });

  describe('FX de ATAQUE LANZADO por el jugador local', () => {
    async function mountFullAppInBattle(): Promise<{ wrapper: ReturnType<typeof mount>; emitState: (state: Partial<GamePresentationState>) => void }> {
      const wrapper = mount(App, {
        global: {
          stubs: {
            NextPiecesPreview: true,
            ScorePanel: true,
            CombatStatusPanel: true,
          },
        },
      });

      const battleBtn = wrapper.find('[data-testid="start-battle-button"]');
      if (battleBtn.exists()) {
        await battleBtn.trigger('click');
        await wrapper.vm.$nextTick();
        const operatorBtn = wrapper.find('[data-testid="bot-profile-operator"]');
        if (operatorBtn.exists()) {
          await operatorBtn.trigger('click');
          await wrapper.vm.$nextTick();
        }
        await flushPromises();
      }

      const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

      const baseState: GamePresentationState = {
        status: 'running',
        step: 10,
        elapsedMs: 500,
        nextPieces: ['I', 'O', 'T'],
        heldPiece: null,
        score: 100,
        clearedLines: 0,
        combo: 0,
        backToBack: 0,
        combatEnergy: 20,
        storedSabotages: ['sobrecarga'],
        pendingGarbage: 0,
        activeEffects: [],
        level: 1,
        baseGravityCellsPerSecond: 1,
        activeGravityCellsPerSecond: 1,
        battleState: {
          status: 'running',
          winner: null,
          step: 10,
          lastSabotageRouted: null,
          playerOneState: {
            warnings: [],
            immunities: [],
            activeEffects: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
          playerTwo: {
            status: 'running',
            level: 1,
            combatEnergy: 0,
            storedSabotages: [],
            activeEffects: [],
            pendingGarbage: 0,
            visibleCells: [],
            isInterfered: false,
            interferenciaRemainingMs: 0,
          },
        },
      };

      const emitState = (newState: Partial<GamePresentationState>) => {
        stateUpdateCallback({ ...baseState, ...newState });
      };

      emitState({});
      await wrapper.vm.$nextTick();

      return { wrapper, emitState };
    }

    it('1. lastSabotageLaunchedDetails con source playerOne dispara pulso en cartucho, texto de confirmación y pulso en monitor rival', async () => {
      vi.useFakeTimers();
      const { wrapper, emitState } = await mountFullAppInBattle();

      emitState({
        lastSabotageLaunchedDetails: {
          source: 'playerOne',
          target: 'playerTwo',
          sabotage: 'sobrecarga',
          id: 1,
        },
      });
      await wrapper.vm.$nextTick();

      // Slot compresión/descarga activa
      const cartridgeSlot = wrapper.find('[data-testid="simulated-cartridge"]');
      expect(cartridgeSlot.exists()).toBe(true);
      expect(cartridgeSlot.classes()).toContain('slot-tile--discharge');

      // Texto de confirmación
      const confirmation = wrapper.find('[data-testid="attack-sent-confirmation"]');
      expect(confirmation.exists()).toBe(true);
      expect(confirmation.text()).toBe('SOBRECARGA ENVIADA');

      // Pulso en OpponentMonitor
      const monitorFrame = wrapper.find('.opponent-board-frame');
      expect(monitorFrame.exists()).toBe(true);
      expect(monitorFrame.classes()).toContain('opponent-board-frame--transmission-sent');

      // Avanzar temporizador (420 ms)
      vi.advanceTimersByTime(420);
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="attack-sent-confirmation"]').exists()).toBe(false);
      expect(cartridgeSlot.classes()).not.toContain('slot-tile--discharge');

      wrapper.unmount();
      vi.useRealTimers();
    });

    it('2. lastSabotageLaunchedDetails con source playerTwo (rival) NO dispara feedback local de lanzamiento', async () => {
      const { wrapper, emitState } = await mountFullAppInBattle();

      emitState({
        lastSabotageLaunchedDetails: {
          source: 'playerTwo',
          target: 'playerOne',
          sabotage: 'residuos',
          id: 2,
        },
      });
      await wrapper.vm.$nextTick();

      const cartridgeSlot = wrapper.find('[data-testid="simulated-cartridge"]');
      expect(cartridgeSlot.exists()).toBe(true);
      expect(cartridgeSlot.classes()).not.toContain('slot-tile--discharge');
      expect(wrapper.find('[data-testid="attack-sent-confirmation"]').exists()).toBe(false);

      wrapper.unmount();
    });

    it('3. formatea el texto de confirmación según el tipo de sabotaje enviado', async () => {
      const { wrapper, emitState } = await mountFullAppInBattle();

      emitState({
        lastSabotageLaunchedDetails: {
          source: 'playerOne',
          target: 'playerTwo',
          sabotage: 'polaridad',
          id: 3,
        },
      });
      await wrapper.vm.$nextTick();

      const confirmation = wrapper.find('[data-testid="attack-sent-confirmation"]');
      expect(confirmation.exists()).toBe(true);
      expect(confirmation.text()).toBe('POLARIDAD ENVIADA');

      wrapper.unmount();
    });

    it('4. si no hay evento confirmado (lastSabotageLaunchedDetails es null/undefined), no se muestra confirmación ni pulso', async () => {
      const { wrapper, emitState } = await mountFullAppInBattle();

      emitState({
        lastSabotageLaunchedDetails: null,
      });
      await wrapper.vm.$nextTick();

      expect(wrapper.find('[data-testid="attack-sent-confirmation"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="simulated-cartridge"]').classes()).not.toContain('slot-tile--discharge');

      wrapper.unmount();
    });
  });
});
