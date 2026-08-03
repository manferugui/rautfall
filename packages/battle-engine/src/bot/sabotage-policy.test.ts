import { prototypeConfig } from '@rautfall/game-config';
import { createGameEngine, type EngineSnapshot } from '@rautfall/game-engine';
import { describe, expect, it } from 'vitest';
import {
  evaluateSabotageDecision,
  getOpponentMaxHeight,
  getOpponentPieceWallDistance,
  isOpponentPieceFullyVisible,
  normalizeBotSabotageConfig,
} from './sabotage-policy';


function createMockSnapshot(overrides?: Partial<EngineSnapshot>): EngineSnapshot {
  const engine = createGameEngine({ seed: 12345, config: prototypeConfig });
  const snap = engine.getSnapshot();
  return {
    ...snap,
    ...overrides,
  };
}

describe('sabotage-policy', () => {
  describe('guardas y orden de precedencia', () => {
    it('1. conserva si no hay sabotajes (noStoredSabotage)', () => {
      const own = createMockSnapshot({ storedSabotages: [] });
      const opp = createMockSnapshot();
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'noStoredSabotage' });
    });

    it('2. conserva si el propio jugador es terminal (ownTerminal)', () => {
      const own = createMockSnapshot({ status: 'gameOver', storedSabotages: ['residuos'] });
      const opp = createMockSnapshot();
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'ownTerminal' });
    });

    it('3. conserva si el rival es terminal (opponentTerminal)', () => {
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot({ status: 'gameOver' });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'opponentTerminal' });
    });

    it('4. conserva durante cooldown (cooldownActive)', () => {
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot();
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 10,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'cooldownActive' });
    });

    it('5. conserva durante decision interval (decisionIntervalActive)', () => {
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot();
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 5,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'decisionIntervalActive' });
    });

    it('6. solo inspecciona storedSabotages[0] y 7. nunca selecciona storedSabotages[1]', () => {
      const own = createMockSnapshot({ storedSabotages: ['sobrecarga', 'residuos'] });
      const opp = createMockSnapshot({ activeEffects: [{ type: 'sobrecarga', remainingMs: 5000 }] });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      // Debería evaluar 'sobrecarga' (frente FIFO) y conservar por efecto activo
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
      expect(res.sabotage).not.toBe('residuos');
    });

    it('respeta strictly storedSabotages[0]: no activa polaridad en [1] aun cuando sea aplicable si residuos en [0] conserva por altura baja', () => {
      const own = createMockSnapshot({ storedSabotages: ['residuos', 'polaridad'] });
      const baseSnap = createMockSnapshot();
      // Rival con altura 0 (< 8), pero con pieza activa visible pegada a la pared (que activaría polaridad si fuera frente)
      const opp = createMockSnapshot({
        activePiece: {
          ...baseSnap.activePiece!,
          pieceId: 10,
          type: 'I',
          x: 0,
          y: 10,
          orientation: 0,
          cells: [
            { x: 0, y: 10 },
            { x: 0, y: 11 },
            { x: 0, y: 12 },
            { x: 0, y: 13 },
          ],
        },
      });

      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });

      // Debe evaluar 'residuos' (storedSabotages[0]) -> altura rival 0 < 8 -> conserva por opponentTooLow
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'opponentTooLow' });
      expect(res.shouldTrigger).toBe(false);
      expect(res.sabotage).toBeNull();
    });
  });

  describe('reglas de residuos', () => {
    it('8. residuos se activa contra rival alto', () => {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      // Construir tablero con altura = 8 (filas 16..23 ocupadas)
      for (let r = 16; r < 24; r++) {
        board[r]![0] = 'I';
      }
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot({ board, pendingGarbage: 0 });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: true, sabotage: 'residuos', reason: 'triggerGarbage' });
    });

    it('9. residuos se conserva contra rival bajo', () => {
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot({ pendingGarbage: 0 }); // Tablero vacío por defecto
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'opponentTooLow' });
    });

    it('10. residuos se conserva si ya hay suficiente pendingGarbage', () => {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      for (let r = 14; r < 24; r++) board[r]![0] = 'I'; // Altura = 10
      const own = createMockSnapshot({ storedSabotages: ['residuos'] });
      const opp = createMockSnapshot({ board, pendingGarbage: 2 });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    });
  });

  describe('reglas de sobrecarga', () => {
    it('11. sobrecarga se activa contra rival medio/alto con pieza activa', () => {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      for (let r = 19; r < 24; r++) board[r]![0] = 'I'; // Altura = 5
      const own = createMockSnapshot({ storedSabotages: ['sobrecarga'] });
      const opp = createMockSnapshot({ board, activeEffects: [] });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: true, sabotage: 'sobrecarga', reason: 'triggerOverload' });
    });

    it('12. sobrecarga se conserva si ya está activa', () => {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      for (let r = 19; r < 24; r++) board[r]![0] = 'I';
      const own = createMockSnapshot({ storedSabotages: ['sobrecarga'] });
      const opp = createMockSnapshot({
        board,
        activeEffects: [{ type: 'sobrecarga', remainingMs: 8000 }],
      });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    });

    it('13. sobrecarga se conserva sin pieza activa', () => {
      const own = createMockSnapshot({ storedSabotages: ['sobrecarga'] });
      const opp = createMockSnapshot({ activePiece: null });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'noActiveOpponentPiece' });
    });
  });

  describe('reglas de polaridad', () => {
    it('14. polaridad se activa con pieza visible cerca de pared', () => {
      const own = createMockSnapshot({ storedSabotages: ['polaridad'] });
      const opp = createMockSnapshot({
        activePiece: {
          type: 'O' as const,
          x: 0, // Cerca de pared izquierda (columna 0)
          y: 4, // Completamente visible
          orientation: 0,
          cells: [
            { x: 0, y: 4 },
            { x: 1, y: 4 },
            { x: 0, y: 5 },
            { x: 1, y: 5 },
          ],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        },
        activeEffects: [],
      });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: true, sabotage: 'polaridad', reason: 'triggerPolarity' });
    });

    it('15. polaridad se conserva con pieza oculta', () => {
      const own = createMockSnapshot({ storedSabotages: ['polaridad'] });
      const opp = createMockSnapshot({
        activePiece: {
          type: 'O' as const,
          x: 0,
          y: 2, // Parte oculta (y < 4)
          orientation: 0,
          cells: [
            { x: 0, y: 2 },
            { x: 1, y: 2 },
            { x: 0, y: 3 },
            { x: 1, y: 3 },
          ],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        },
      });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'opponentPieceNotVisible' });
    });

    it('16. polaridad se conserva sin pieza', () => {
      const own = createMockSnapshot({ storedSabotages: ['polaridad'] });
      const opp = createMockSnapshot({ activePiece: null });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'noActiveOpponentPiece' });
    });

    it('17. polaridad se conserva si ya está activa', () => {
      const own = createMockSnapshot({ storedSabotages: ['polaridad'] });
      const opp = createMockSnapshot({
        activePiece: {
          type: 'O' as const,
          x: 0,
          y: 4,
          orientation: 0,
          cells: [
            { x: 0, y: 4 },
            { x: 1, y: 4 },
          ],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        },
        activeEffects: [{ type: 'polaridad', remainingPieces: 1 }],
      });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'equivalentPressureAlreadyActive' });
    });

    it('18. polaridad se conserva en ventana táctica pobre (pieza centrada sin riesgo alto)', () => {
      const own = createMockSnapshot({ storedSabotages: ['polaridad'] });
      const opp = createMockSnapshot({
        activePiece: {
          type: 'O' as const,
          x: 4, // Pieza en columnas 4,5 (distancia a paredes = 4)
          y: 4,
          orientation: 0,
          cells: [
            { x: 4, y: 4 },
            { x: 5, y: 4 },
          ],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        },
      });
      const res = evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      expect(res).toEqual({ shouldTrigger: false, sabotage: null, reason: 'poorTacticalWindow' });
    });
  });

  describe('propiedades puras e inmutabilidad', () => {
    it('19. mismo input produce exactamente la misma decisión', () => {
      const own = Object.freeze(createMockSnapshot({ storedSabotages: ['residuos'] }));
      const opp = Object.freeze(createMockSnapshot());
      const input = Object.freeze({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });
      const r1 = evaluateSabotageDecision(input);
      const r2 = evaluateSabotageDecision(input);
      expect(r1).toEqual(r2);
    });

    it('20 y 21. no muta ownSnapshot ni opponentSnapshot', () => {
      const own = Object.freeze(createMockSnapshot({ storedSabotages: ['residuos'] }));
      const opp = Object.freeze(createMockSnapshot());
      const ownJson = JSON.stringify(own);
      const oppJson = JSON.stringify(opp);

      evaluateSabotageDecision({
        ownSnapshot: own,
        opponentSnapshot: opp,
        cooldownStepsRemaining: 0,
        decisionIntervalStepsRemaining: 0,
      });

      expect(JSON.stringify(own)).toBe(ownJson);
      expect(JSON.stringify(opp)).toBe(oppJson);
    });

    it('24. configuración inválida falla de forma explícita', () => {
      expect(() => normalizeBotSabotageConfig({ cooldownSteps: -5 })).toThrow(/Invalid sabotage config/);
      expect(() => normalizeBotSabotageConfig({ minimumOpponentHeightForGarbage: NaN })).toThrow(
        /Invalid sabotage config/,
      );
    });
  });

  describe('funciones de percepción auxiliares', () => {
    it('calcula la altura máxima del rival correctamente', () => {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      board[10]![5] = 'T'; // Fila 10 ocupada -> Altura 24 - 10 = 14
      expect(getOpponentMaxHeight(board)).toBe(14);
    });

    it('calcula visibilidad completa de pieza rival', () => {
      expect(isOpponentPieceFullyVisible(null)).toBe(false);
      expect(
        isOpponentPieceFullyVisible({
          type: 'I' as const,
          x: 3,
          y: 3,
          orientation: 0,
          cells: [{ x: 3, y: 3 }],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        }),
      ).toBe(false);
      expect(
        isOpponentPieceFullyVisible({
          type: 'I' as const,
          x: 3,
          y: 4,
          orientation: 0,
          cells: [{ x: 3, y: 4 }],
          grounded: false,
          lockDelayElapsedMs: 0,
          lockResetsUsed: 0,
          landingCells: [],
          holdUsed: false,
          pieceId: 1,
        }),
      ).toBe(true);
    });

    it('calcula distancia a pared correctamente', () => {
      const pieceNearLeft = {
        type: 'I' as const,
        x: 1,
        y: 4,
        orientation: 0,
        cells: [
          { x: 1, y: 4 },
          { x: 2, y: 4 },
        ],
        grounded: false,
        lockDelayElapsedMs: 0,
        lockResetsUsed: 0,
        landingCells: [],
        holdUsed: false,
        pieceId: 1,
      };
      expect(getOpponentPieceWallDistance(pieceNearLeft)).toBe(1);

      const pieceNearRight = {
        type: 'I' as const,
        x: 7,
        y: 4,
        orientation: 0,
        cells: [
          { x: 7, y: 4 },
          { x: 8, y: 4 },
        ],
        grounded: false,
        lockDelayElapsedMs: 0,
        lockResetsUsed: 0,
        landingCells: [],
        holdUsed: false,
        pieceId: 1,
      };
      expect(getOpponentPieceWallDistance(pieceNearRight)).toBe(1);
    });
  });
});
