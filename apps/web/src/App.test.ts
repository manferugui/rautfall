// @vitest-environment jsdom
/**
 * Pruebas de integración de App.vue con controlador Phaser simulado.
 *
 * Se mockea createPhaserGame para evitar arrancar WebGL real en Vitest.
 * El controlador simulado expone reset, togglePause y destroy.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §21.4.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';
import type { GamePresentationState } from './game/types';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  togglePause: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('./game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

describe('App.vue — pausa, reanudación y reinicio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mountApp(): ReturnType<typeof mount> {
    return mount(App, {
      global: {
        stubs: {
          NextPiecesPreview: true,
          ScorePanel: true,
          OpponentMonitor: true,
          CombatStatusPanel: true,
        },
      },
    });
  }

  it('muestra "Pausar" cuando el estado es running', () => {
    const wrapper = mountApp();
    const pauseButton = wrapper.find('[data-testid="pause-toggle"]');
    expect(pauseButton.text()).toBe('Pausar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();
    wrapper.unmount();
  });

  it('al simular paused, el botón muestra "Reanudar" y aparece el overlay', async () => {
    const wrapper = mountApp();

    // Obtener el callback onStateUpdate desde el mock de createPhaserGame
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // Simular transición a paused
    const pausedState: GamePresentationState = {
      status: 'paused',
      step: 50,
      elapsedMs: 2500,
      nextPieces: ['S', 'Z', 'J'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
    };
    stateUpdateCallback(pausedState);
    await wrapper.vm.$nextTick();

    const pauseButton = wrapper.find('[data-testid="pause-toggle"]');
    expect(pauseButton.text()).toBe('Reanudar');
    expect(pauseButton.attributes('disabled')).toBeUndefined();

    // Verificar overlay
    const overlay = wrapper.find('.pause-overlay');
    expect(overlay.exists()).toBe(true);
    expect(overlay.text()).toBe('PAUSA');

    wrapper.unmount();
  });

  it('al pulsar el botón de pausa/reanudación se invoca controller.togglePause() una vez', async () => {
    const wrapper = mountApp();

    // No está pulsado aún
    expect(mockController.togglePause).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="pause-toggle"]').trigger('click');
    expect(mockController.togglePause).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('con gameOver el botón de pausa/reanudación está disabled y muestra "Pausar"', async () => {
    const wrapper = mountApp();

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const gameOverState: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
      score: 0,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
    };
    stateUpdateCallback(gameOverState);
    await wrapper.vm.$nextTick();

    const pauseButton = wrapper.find('[data-testid="pause-toggle"]');
    expect(pauseButton.text()).toBe('Pausar');
    expect(pauseButton.attributes('disabled')).toBeDefined();

    wrapper.unmount();
  });

  it('el botón "Reiniciar" está presente y habilitado en los tres estados', async () => {
    const wrapper = mountApp();

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // Verificar en running (estado inicial)
    const resetButton = wrapper.find('[data-testid="reset-button"]');
    expect(resetButton.text()).toBe('Reiniciar');
    expect(resetButton.attributes('disabled')).toBeUndefined();

    // Verificar en paused
    stateUpdateCallback({ status: 'paused', step: 50, elapsedMs: 2500, nextPieces: ['S', 'Z', 'J'], heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0 });
    await wrapper.vm.$nextTick();
    expect(resetButton.attributes('disabled')).toBeUndefined();

    // Verificar en gameOver
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'], heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0 });
    await wrapper.vm.$nextTick();
    expect(resetButton.attributes('disabled')).toBeUndefined();

    wrapper.unmount();
  });

  it('al pulsar "Reiniciar" se invoca controller.reset()', async () => {
    const wrapper = mountApp();

    expect(mockController.reset).not.toHaveBeenCalled();
    await wrapper.find('[data-testid="reset-button"]').trigger('click');
    expect(mockController.reset).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('el overlay PAUSA no aparece con status running o gameOver', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    // running — sin overlay
    expect(wrapper.find('.pause-overlay').exists()).toBe(false);

    // gameOver — sin overlay
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'], heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0 });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.pause-overlay').exists()).toBe(false);

    wrapper.unmount();
  });

  it('NextPiecesPreview recibe nextPieces desde App', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const state: GamePresentationState = {
      status: 'running',
      step: 10,
      elapsedMs: 500,
      nextPieces: ['T', 'L', 'J'],
      heldPiece: null,
      score: 100,
      combo: 1,
      backToBack: 0,
      combatEnergy: 0,
    };
    stateUpdateCallback(state);
    await wrapper.vm.$nextTick();

    // Verificar que la prop se pasa al componente NextPiecesPreview
    const preview = wrapper.findComponent({ name: 'NextPiecesPreview' });
    expect(preview.exists()).toBe(true);
    expect(preview.props('nextPieces')).toEqual(['T', 'L', 'J']);

    wrapper.unmount();
  });

  it('ScorePanel recibe score y combo desde App', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const state: GamePresentationState = {
      status: 'running',
      step: 10,
      elapsedMs: 500,
      nextPieces: ['T', 'L', 'J'],
      heldPiece: null,
      score: 450,
      combo: 3,
      backToBack: 2,
      combatEnergy: 25,
    };
    stateUpdateCallback(state);
    await wrapper.vm.$nextTick();

    const scorePanel = wrapper.findComponent({ name: 'ScorePanel' });
    expect(scorePanel.exists()).toBe(true);
    expect(scorePanel.props('score')).toBe(450);
    expect(scorePanel.props('combo')).toBe(3);
    expect(scorePanel.props('backToBack')).toBe(2);
    expect(scorePanel.props('combatEnergy')).toBe(25);

    wrapper.unmount();
  });

  // === Nuevas pruebas de layout Tactical ===

  it('existen las tres zonas del layout Tactical', () => {
    const wrapper = mountApp();
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tactical-column"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="opponent-column"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('OpponentMonitor está presente dentro de la columna de monitor rival', () => {
    const wrapper = mountApp();
    const opponentColumn = wrapper.find('[data-testid="opponent-column"]');
    const opponentMonitor = opponentColumn.findComponent({ name: 'OpponentMonitor' });
    expect(opponentMonitor.exists()).toBe(true);
    wrapper.unmount();
  });

  it('CombatStatusPanel está presente dentro de la columna táctica', () => {
    const wrapper = mountApp();
    const tacticalColumn = wrapper.find('[data-testid="tactical-column"]');
    const combatPanel = tacticalColumn.findComponent({ name: 'CombatStatusPanel' });
    expect(combatPanel.exists()).toBe(true);
    wrapper.unmount();
  });

  it('CombatStatusPanel aparece después de NextPiecesPreview en la columna táctica', () => {
    const wrapper = mountApp();
    const tacticalColumn = wrapper.find('[data-testid="tactical-column"]');

    // Verificar que ambos componentes existen en la columna
    const preview = tacticalColumn.findComponent({ name: 'NextPiecesPreview' });
    const combatPanel = tacticalColumn.findComponent({ name: 'CombatStatusPanel' });
    expect(preview.exists()).toBe(true);
    expect(combatPanel.exists()).toBe(true);

    // Verificar el orden DOM: el elemento NextPiecesPreview debe aparecer antes
    // que CombatStatusPanel en el árbol DOM de la columna táctica
    const previewEl = preview.element;
    const combatEl = combatPanel.element;

    // Usamos compareDocumentPosition para verificar el orden
    const position = previewEl.compareDocumentPosition(combatEl);
    // DOCUMENT_POSITION_FOLLOWING = 4 significa que preview está antes que combatEl
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    wrapper.unmount();
  });

  it('el elemento width-warning existe en el DOM', () => {
    const wrapper = mountApp();
    const warning = wrapper.find('[data-testid="width-warning"]');
    expect(warning.exists()).toBe(true);
    wrapper.unmount();
  });

  // === Nuevas pruebas de la revisión visual 0009b ===

  it('existe una carcasa Tactical que agrupa cabecera y las tres zonas', () => {
    const wrapper = mountApp();
    const chassis = wrapper.find('.tactical-chassis');
    expect(chassis.exists()).toBe(true);
    expect(chassis.find('.app-header').exists()).toBe(true);
    expect(chassis.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(chassis.find('[data-testid="tactical-column"]').exists()).toBe(true);
    expect(chassis.find('[data-testid="opponent-column"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('el marco del tablero propio refleja el estado de sesión real', async () => {
    const wrapper = mountApp();
    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    expect(wrapper.find('.board-bezel--running').exists()).toBe(true);

    stateUpdateCallback({ status: 'paused', step: 50, elapsedMs: 2500, nextPieces: ['S', 'Z', 'J'], heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0 });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.board-bezel--paused').exists()).toBe(true);

    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O', 'T', 'I'], heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0 });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.board-bezel--gameOver').exists()).toBe(true);

    wrapper.unmount();
  });
});
