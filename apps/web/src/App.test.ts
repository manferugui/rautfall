// @vitest-environment jsdom
/**
 * Pruebas de integración de App.vue con controlador Phaser simulado y flujo unificado de ResultsModal + Firma arcade.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from './App.vue';
import type { GamePresentationState } from './game/types';
import * as clientModule from './api/client';

const mockController = vi.hoisted(() => ({
  reset: vi.fn(),
  togglePause: vi.fn(),
  destroy: vi.fn(),
}));

const mockCreatePhaserGame = vi.hoisted(() => vi.fn().mockReturnValue(mockController));

vi.mock('./game/create-phaser-game', () => ({
  createPhaserGame: mockCreatePhaserGame,
}));

describe('App.vue — flujo web de modos, resultados, firma arcade unificada e idempotencia', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('arranca por defecto en la pantalla de Menú Principal (ModeSelector)', () => {
    const wrapper = mountApp();
    expect(wrapper.find('[data-testid="mode-selector"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('permite navegar libremente a Batalla, Entrenamiento, Historial y Ranking sin solicitar tag previo', async () => {
    vi.spyOn(clientModule, 'getMatchHistory').mockResolvedValue([]);
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);

    const wrapper = mountApp();

    // 1. Abrir Historial sin tag
    await wrapper.find('[data-testid="open-history-button"]').trigger('click');
    expect(wrapper.find('[data-testid="history-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    await wrapper.find('[data-testid="history-back-button"]').trigger('click');

    // 2. Abrir Ranking sin tag
    await wrapper.find('[data-testid="open-ranking-button"]').trigger('click');
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    await wrapper.find('[data-testid="ranking-back-button"]').trigger('click');

    // 3. Iniciar Batalla sin tag
    await wrapper.find('[data-testid="start-battle-button"]').trigger('click');
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it('al terminar partida muestra ResultsModal con iniciales integradas y nunca abre un segundo popup', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;

    const gameOverState: GamePresentationState = {
      status: 'gameOver',
      step: 100,
      elapsedMs: 5000,
      nextPieces: ['O', 'T', 'I'],
      heldPiece: null,
      score: 850,
      clearedLines: 8,
      combo: 0,
      backToBack: 0,
      combatEnergy: 0,
      storedSabotages: [],
      pendingGarbage: 0,
      activeEffects: [],
      level: 2,
      baseGravityCellsPerSecond: 1.25,
      activeGravityCellsPerSecond: 1.25,
    };
    stateUpdateCallback(gameOverState);
    await wrapper.vm.$nextTick();

    // Muestra pantalla de resultados con la firma de operador integrada en el propio modal
    expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-signature-block"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="operator-tag-modal"]').exists()).toBe(false);
    expect(submitSpy).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('escribir en Results no altera localStorage de inmediato y confirma el POST guardando el tag solo si la API responde OK', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    vi.spyOn(clientModule, 'getRanking').mockResolvedValue([]);

    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await wrapper.vm.$nextTick();

    // Escribir iniciales 'RAU' en la pantalla de Results
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    // Comprobar que localStorage aún NO se ha actualizado
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();

    // Confirmar resultado
    await wrapper.find('[data-testid="confirm-save-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        playerName: 'RAU',
        score: 850,
        linesCleared: 8,
      }),
    );

    // Tras el POST exitoso, el tag local se guarda y navega automáticamente a Ranking
    expect(localStorage.getItem('rautfall_player_tag')).toBe('RAU');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it('si la API falla, el tag persistente no cambia, las iniciales editadas se conservan y no abre Ranking', async () => {
    vi.spyOn(clientModule, 'submitMatch').mockRejectedValue(new Error('Network error'));

    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await wrapper.vm.$nextTick();

    // Escribir 'RAU'
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    await wrapper.vm.$nextTick();

    // Intentar guardar
    await wrapper.find('[data-testid="confirm-save-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    // Results permanece abierto en estado de error
    expect(wrapper.find('[data-testid="results-modal"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="ranking-screen"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="save-status-tag"]').text()).toContain('ERROR AL PERSISTIR');

    // Las iniciales editadas 'RAU' se conservan en pantalla pero localStorage no se ha alterado
    expect(wrapper.find('[data-testid="tag-cell-char-0"]').text()).toBe('R');
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();

    wrapper.unmount();
  });

  it('abandonar Results mediante Volver a jugar limpia pendingMatchResult y no arrastra datos a la siguiente partida', async () => {
    const submitSpy = vi.spyOn(clientModule, 'submitMatch').mockResolvedValue({} as unknown as Awaited<ReturnType<typeof clientModule.submitMatch>>);
    const wrapper = mountApp();
    await wrapper.find('[data-testid="start-training-button"]').trigger('click');

    const stateUpdateCallback = mockCreatePhaserGame.mock.calls[0]![0].onStateUpdate as (state: GamePresentationState) => void;
    stateUpdateCallback({ status: 'gameOver', step: 100, elapsedMs: 5000, nextPieces: ['O'], heldPiece: null, score: 850, clearedLines: 8, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 2, baseGravityCellsPerSecond: 1.25, activeGravityCellsPerSecond: 1.25 });
    await wrapper.vm.$nextTick();

    // Pulsar 'Volver a jugar' sin confirmar
    await wrapper.find('[data-testid="replay-button"]').trigger('click');
    await wrapper.vm.$nextTick();

    expect(submitSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('rautfall_player_tag')).toBeNull();
    expect(wrapper.find('[data-testid="own-board-column"]').exists()).toBe(true);

    wrapper.unmount();
  });
});
