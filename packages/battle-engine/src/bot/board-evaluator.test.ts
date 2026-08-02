import { describe, expect, it } from 'vitest';
import {
  evaluateBoardMetrics,
  scoreBoardMetrics,
  computeColumnHeights,
  computeHiddenRowOccupancy,
  computeBumpiness,
  computeWells,
  computeTopOutRisk,
  DEFAULT_BOT_HEURISTIC_WEIGHTS,
  type BoardCell,
} from './board-evaluator';

function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: 24 }, () => Array.from({ length: 10 }, () => null));
}

describe('board-evaluator', () => {
  it('evalúa un tablero completamente vacío', () => {
    const board = createEmptyBoard();
    const metrics = evaluateBoardMetrics(board, 0);

    expect(metrics).toEqual({
      linesCleared: 0,
      aggregateHeight: 0,
      maxHeight: 0,
      holes: 0,
      newHoles: 0,
      bumpiness: 0,
      wells: 0,
      topOutRisk: 0,
      hiddenRowOccupancy: 0,
      isGameOver: false,
    });
  });

  it('calcula correctamente la altura agregada y la altura máxima', () => {
    const board = createEmptyBoard();
    board[23]![0] = 'I'; // col 0 -> altura 1
    board[22]![1] = 'O'; // col 1 -> altura 2
    board[23]![1] = 'O';
    board[20]![5] = 'T'; // col 5 -> altura 4

    const heights = computeColumnHeights(board);
    expect(heights[0]).toBe(1);
    expect(heights[1]).toBe(2);
    expect(heights[5]).toBe(4);

    const metrics = evaluateBoardMetrics(board, 0);
    expect(metrics.aggregateHeight).toBe(7);
    expect(metrics.maxHeight).toBe(4);
  });

  it('calcula bumpiness correctamente entre columnas adyacentes', () => {
    const columnHeights = [3, 1, 4, 0, 0, 0, 0, 0, 0, 0];
    const bumpiness = computeBumpiness(columnHeights);
    // |3-1| + |1-4| + |4-0| + 0 = 2 + 3 + 4 = 9
    expect(bumpiness).toBe(9);
  });

  it('aplica penalización topOutRisk exacta y determinista según la altura máxima', () => {
    expect(computeTopOutRisk(13)).toBe(0);
    expect(computeTopOutRisk(14)).toBe(1);
    expect(computeTopOutRisk(17)).toBe(4);
    expect(computeTopOutRisk(18)).toBe(7);
    expect(computeTopOutRisk(20)).toBe(13);
    expect(computeTopOutRisk(24)).toBe(25);
  });

  it('calcula correctamente la ocupación de filas ocultas (y = 0..3)', () => {
    const board = createEmptyBoard();
    board[2]![3] = 'I';
    board[3]![4] = 'garbage';
    board[4]![4] = 'O'; // y=4 está en zona visible, no debe contarse como fila oculta

    const hiddenOccupancy = computeHiddenRowOccupancy(board);
    expect(hiddenOccupancy).toBe(2);
  });

  it('calcula newHoles como max(0, resultingHoles - initialHoles)', () => {
    const board = createEmptyBoard();
    board[20]![0] = 'J';
    board[21]![0] = null;
    board[22]![0] = null;
    board[23]![0] = 'J'; // 2 huecos resultantes

    const metrics1 = evaluateBoardMetrics(board, 0, 0);
    expect(metrics1.holes).toBe(2);
    expect(metrics1.newHoles).toBe(2);

    const metrics2 = evaluateBoardMetrics(board, 0, 2);
    expect(metrics2.newHoles).toBe(0);
  });

  it('penaliza severamente un tablero con isGameOver en scoreBoardMetrics', () => {
    const board = createEmptyBoard();
    const metricsSurvive = evaluateBoardMetrics(board, 0, 0, false);
    const metricsDead = evaluateBoardMetrics(board, 2, 0, true); // limpia 2 líneas pero muere

    const scoreSurvive = scoreBoardMetrics(metricsSurvive);
    const scoreDead = scoreBoardMetrics(metricsDead);

    expect(scoreSurvive).toBeGreaterThan(scoreDead);
    expect(scoreSurvive - scoreDead).toBeGreaterThan(900_000);
  });

  it('penaliza la creación de un hueco nuevo frente a una colocación más alta pero limpia', () => {
    // Tablero con 1 hueco en la fila 22 por debajo de un bloque en la fila 21
    const boardHole = createEmptyBoard();
    boardHole[23]![0] = 'I';
    boardHole[21]![0] = 'I'; // row 22 es null -> 1 hueco (altura 3)

    // Tablero limpio apilado desde abajo sin huecos pero más alto (altura 4)
    const boardClean = createEmptyBoard();
    boardClean[23]![0] = 'I';
    boardClean[22]![0] = 'I';
    boardClean[21]![0] = 'I';
    boardClean[20]![0] = 'I'; // 0 huecos (altura 4)

    const metricsHole = evaluateBoardMetrics(boardHole, 0, 0);
    const metricsClean = evaluateBoardMetrics(boardClean, 0, 0);

    const scoreHole = scoreBoardMetrics(metricsHole);
    const scoreClean = scoreBoardMetrics(metricsClean);

    expect(scoreClean).toBeGreaterThan(scoreHole);
  });

  it('penaliza los pozos profundos restando puntos', () => {
    const heightsWithDeepWell = [0, 8, 8, 8, 8, 8, 8, 8, 8, 8];
    const wells = computeWells(heightsWithDeepWell);
    expect(wells).toBe(8);

    const metricsDeepWell = {
      linesCleared: 0,
      aggregateHeight: 72,
      maxHeight: 8,
      holes: 0,
      newHoles: 0,
      bumpiness: 8,
      wells: 8,
      topOutRisk: 0,
      hiddenRowOccupancy: 0,
      isGameOver: false,
    };

    const score = scoreBoardMetrics(metricsDeepWell, DEFAULT_BOT_HEURISTIC_WEIGHTS);
    expect(score).toBeLessThan(0);
  });
});
