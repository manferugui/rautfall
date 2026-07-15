import type { ActivePieceSnapshot, EngineSnapshot, PieceType } from '@rautfall/game-engine';

// El motor no expone el número de filas ocultas como contrato público; se
// reutiliza la misma asunción (4) ya reflejada en el título del tablero.
const HIDDEN_ROWS = 4;

/**
 * Compone, solo para renderizado, un tablero que combina las celdas fijas de
 * `board` con las celdas ocupadas por la pieza activa. No muta ni `board` ni
 * `activePiece`: siempre trabaja sobre una copia.
 *
 * Las celdas de la pieza activa ubicadas en filas ocultas (y < HIDDEN_ROWS)
 * se descartan y no aparecen en el tablero compuesto.
 */
export function composeBoardForRendering(
  board: EngineSnapshot['board'],
  activePiece: ActivePieceSnapshot | null,
): (PieceType | null)[][] {
  const composed = board.map((row) => [...row]);

  if (!activePiece) return composed;

  for (const cell of activePiece.cells) {
    if (cell.y < HIDDEN_ROWS) continue;
    composed[cell.y]![cell.x] = activePiece.type;
  }

  return composed;
}
