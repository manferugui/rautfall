import type { PieceType } from '@rautfall/game-engine';
import type { BotHeuristicWeights } from './types.js';

export const DEFAULT_BOT_HEURISTIC_WEIGHTS: BotHeuristicWeights = Object.freeze({
  linesClearedWeight: 120,
  aggregateHeightWeight: 8,
  maxHeightWeight: 30,
  holesWeight: 70,
  newHolesWeight: 140,
  bumpinessWeight: 12,
  wellsWeight: 8,
  topOutRiskWeight: 200,
  hiddenRowOccupancyWeight: 300,
  gameOverWeight: 1_000_000,
});

export type BoardMetrics = Readonly<{
  linesCleared: number;
  aggregateHeight: number;
  maxHeight: number;
  holes: number;
  newHoles: number;
  bumpiness: number;
  wells: number;
  topOutRisk: number;
  hiddenRowOccupancy: number;
  isGameOver: boolean;
}>;

export type BoardCell = PieceType | 'garbage' | null;

/**
 * Calcula la altura de cada una de las 10 columnas en un tablero de 24x10.
 * La altura se mide como 24 - (menor índice de fila ocupada).
 */
export function computeColumnHeights(board: ReadonlyArray<ReadonlyArray<BoardCell>>): readonly number[] {
  const heights: number[] = new Array(10).fill(0);
  for (let col = 0; col < 10; col++) {
    for (let row = 0; row < 24; row++) {
      if (board[row]?.[col] !== null && board[row]?.[col] !== undefined) {
        heights[col] = 24 - row;
        break;
      }
    }
  }
  return Object.freeze(heights);
}

/**
 * Calcula el número de huecos cubiertos (celdas null con bloques por encima en la misma columna).
 */
export function computeHoles(
  board: ReadonlyArray<ReadonlyArray<BoardCell>>,
  columnHeights: readonly number[],
): number {
  let holes = 0;
  for (let col = 0; col < 10; col++) {
    const colHeight = columnHeights[col]!;
    if (colHeight === 0) continue;
    const startRow = 24 - colHeight;
    for (let row = startRow + 1; row < 24; row++) {
      if (board[row]?.[col] === null) {
        holes++;
      }
    }
  }
  return holes;
}

/**
 * Cuenta cuántas celdas ocupadas existen en las 4 filas ocultas del spawn (y = 0..3).
 */
export function computeHiddenRowOccupancy(board: ReadonlyArray<ReadonlyArray<BoardCell>>): number {
  let count = 0;
  for (let row = 0; row < 4; row++) {
    const r = board[row];
    if (!r) continue;
    for (let col = 0; col < 10; col++) {
      if (r[col] !== null && r[col] !== undefined) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Suma de diferencias absolutas de altura entre columnas adyacentes.
 */
export function computeBumpiness(columnHeights: readonly number[]): number {
  let bumpiness = 0;
  for (let col = 0; col < 9; col++) {
    bumpiness += Math.abs(columnHeights[col]! - columnHeights[col + 1]!);
  }
  return bumpiness;
}

/**
 * Calcula los pozos: suma de la profundidad de canales de 1 celda flanqueados por bloques o paredes.
 */
export function computeWells(columnHeights: readonly number[]): number {
  let wells = 0;
  for (let col = 0; col < 10; col++) {
    const leftHeight = col === 0 ? 24 : columnHeights[col - 1]!;
    const rightHeight = col === 9 ? 24 : columnHeights[col + 1]!;
    const currentHeight = columnHeights[col]!;
    const minNeighbor = Math.min(leftHeight, rightHeight);

    if (currentHeight < minNeighbor) {
      wells += minNeighbor - currentHeight;
    }
  }
  return wells;
}

/**
 * Penalización por riesgo de top-out cuando la altura máxima se acerca a las filas superiores.
 */
export function computeTopOutRisk(maxHeight: number): number {
  if (maxHeight >= 14) {
    let risk = maxHeight - 13;
    if (maxHeight >= 18) {
      risk += (maxHeight - 17) * 2;
    }
    return risk;
  }
  return 0;
}

/**
 * Evalúa todas las métricas de un tablero comparándolas opcionalmente con los huecos iniciales.
 */
export function evaluateBoardMetrics(
  board: ReadonlyArray<ReadonlyArray<BoardCell>>,
  linesCleared: number,
  initialHoles = 0,
  isGameOver = false,
): BoardMetrics {
  const columnHeights = computeColumnHeights(board);
  let aggregateHeight = 0;
  let maxHeight = 0;

  for (let c = 0; c < 10; c++) {
    const h = columnHeights[c]!;
    aggregateHeight += h;
    if (h > maxHeight) {
      maxHeight = h;
    }
  }

  const holes = computeHoles(board, columnHeights);
  const newHoles = Math.max(0, holes - initialHoles);
  const bumpiness = computeBumpiness(columnHeights);
  const wells = computeWells(columnHeights);
  const topOutRisk = computeTopOutRisk(maxHeight);
  const hiddenRowOccupancy = computeHiddenRowOccupancy(board);

  return Object.freeze({
    linesCleared,
    aggregateHeight,
    maxHeight,
    holes,
    newHoles,
    bumpiness,
    wells,
    topOutRisk,
    hiddenRowOccupancy,
    isGameOver,
  });
}

/**
 * Calcula la puntuación heurística a partir de las métricas del tablero y los pesos.
 * Las penalizaciones se restan siempre para castigar estructuras defectuosas o peligrosas.
 */
export function scoreBoardMetrics(
  metrics: BoardMetrics,
  weights: BotHeuristicWeights = DEFAULT_BOT_HEURISTIC_WEIGHTS,
): number {
  return (
    weights.linesClearedWeight * metrics.linesCleared -
    weights.aggregateHeightWeight * metrics.aggregateHeight -
    weights.maxHeightWeight * metrics.maxHeight -
    weights.holesWeight * metrics.holes -
    weights.newHolesWeight * metrics.newHoles -
    weights.bumpinessWeight * metrics.bumpiness -
    weights.wellsWeight * metrics.wells -
    weights.topOutRiskWeight * metrics.topOutRisk -
    weights.hiddenRowOccupancyWeight * metrics.hiddenRowOccupancy -
    (metrics.isGameOver ? weights.gameOverWeight : 0)
  );
}
