import type { EngineSnapshot, PieceType } from '@rautfall/game-engine';
import type { CellPresentation, OpponentPresentationState } from './types';

const HIDDEN_ROWS_OFFSET = 4;

export const PIECE_COLOR_HEX: Record<PieceType | 'garbage', string> = Object.freeze({
  I: '#00d4ff',
  O: '#ffd700',
  T: '#9b59b6',
  S: '#2ecc71',
  Z: '#e74c3c',
  J: '#3498db',
  L: '#f39c12',
  garbage: '#555555',
});

/**
 * Transforma un EngineSnapshot de Player 2 en OpponentPresentationState.
 *
 * Reglas de mapeo:
 * 1. Proyección 10×24 -> 10×20 descartando filas ocultas con yEngine < 4.
 * 2. yVisual = yEngine - 4 (rango 0..19).
 * 3. Resolución previa de prioridad estricta por coordenada (x, yVisual):
 *    activePiece > landingCells (ghost) > board (fixed/garbage).
 * 4. La pieza fantasma conserva el color base del tipo de pieza activa.
 * 5. Cada coordenada visual aparece a lo sumo una vez.
 * 6. Ordenación determinista: primero por yVisual creciente, luego por x creciente.
 * 7. Estructura inmutable.
 */
import type { BattleParticipantStateSnapshot } from '@rautfall/battle-engine';

export function mapEngineToOpponentPresentation(
  snapshot: EngineSnapshot,
  participantState?: BattleParticipantStateSnapshot,
): OpponentPresentationState {
  const cellMap = new Map<string, CellPresentation>();

  // 1. Celdas del tablero (prioridad más baja)
  for (let yEngine = HIDDEN_ROWS_OFFSET; yEngine < 24; yEngine++) {
    const row = snapshot.board[yEngine];
    if (!row) continue;
    for (let x = 0; x < 10; x++) {
      const cell = row[x];
      if (cell === null) continue;
      const yVisual = yEngine - HIDDEN_ROWS_OFFSET;
      const key = `${x}-${yVisual}`;
      const color = PIECE_COLOR_HEX[cell as PieceType | 'garbage'] ?? '#555555';
      cellMap.set(key, {
        x,
        y: yVisual,
        type: cell as PieceType | 'garbage',
        appearance: 'fixed',
        color,
      });
    }
  }

  // 2. Pieza fantasma (prioridad intermedia)
  if (snapshot.activePiece) {
    const activeType = snapshot.activePiece.type as PieceType;
    const ghostColor = PIECE_COLOR_HEX[activeType] ?? '#00d4ff';

    for (const cell of snapshot.activePiece.landingCells) {
      if (cell.y < HIDDEN_ROWS_OFFSET || cell.y >= 24) continue;
      const yVisual = cell.y - HIDDEN_ROWS_OFFSET;
      const key = `${cell.x}-${yVisual}`;
      cellMap.set(key, {
        x: cell.x,
        y: yVisual,
        type: activeType,
        appearance: 'ghost',
        color: ghostColor,
      });
    }
  }

  // 3. Pieza activa (prioridad superior)
  if (snapshot.activePiece) {
    const activeType = snapshot.activePiece.type as PieceType;
    const activeColor = PIECE_COLOR_HEX[activeType] ?? '#00d4ff';

    for (const cell of snapshot.activePiece.cells) {
      if (cell.y < HIDDEN_ROWS_OFFSET || cell.y >= 24) continue;
      const yVisual = cell.y - HIDDEN_ROWS_OFFSET;
      const key = `${cell.x}-${yVisual}`;
      cellMap.set(key, {
        x: cell.x,
        y: yVisual,
        type: activeType,
        appearance: 'active',
        color: activeColor,
      });
    }
  }

  // Ordenación determinista por y creciente y luego x creciente
  const visibleCells = Array.from(cellMap.values()).sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return Object.freeze({
    status: snapshot.status,
    level: snapshot.level,
    combatEnergy: snapshot.combatEnergy,
    storedSabotages: Object.freeze([...snapshot.storedSabotages]),
    activeEffects: Object.freeze([...snapshot.activeEffects]),
    pendingGarbage: snapshot.pendingGarbage,
    visibleCells: Object.freeze(visibleCells),
    isInterfered: participantState?.isInterfered ?? false,
    interferenciaRemainingMs: participantState?.interferenciaRemainingMs ?? 0,
    warnings: participantState?.warnings ?? Object.freeze([]),
    immunities: participantState?.immunities ?? Object.freeze([]),
  });
}
