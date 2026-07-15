import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@rautfall/game-config';
import { createGameEngine, Orientation, type EngineSnapshot, type PieceType } from '@rautfall/game-engine';

import { composeBoardForRendering } from './board-composition';

function emptyBoard(): (PieceType | null)[][] {
  return Array.from({ length: 24 }, () => Array.from({ length: 10 }, () => null));
}

describe('composeBoardForRendering', () => {
  it('representa la pieza activa en el tablero compuesto', () => {
    const board = emptyBoard();
    const activePiece = {
      type: 'O' as const,
      x: 4,
      y: 10,
      orientation: Orientation.Spawn,
      cells: [
        { x: 4, y: 10 },
        { x: 5, y: 10 },
        { x: 4, y: 11 },
        { x: 5, y: 11 },
      ],
    };

    const composed = composeBoardForRendering(board, activePiece);

    for (const cell of activePiece.cells) {
      expect(composed[cell.y]![cell.x]).toBe('O');
    }
  });

  it('conserva las celdas fijas del tablero', () => {
    const board = emptyBoard();
    board[20]![3] = 'T';
    board[20]![4] = 'T';

    const composed = composeBoardForRendering(board, null);

    expect(composed[20]![3]).toBe('T');
    expect(composed[20]![4]).toBe('T');
  });

  it('no renderiza las celdas de la pieza activa ubicadas en filas ocultas', () => {
    const board = emptyBoard();
    const activePiece = {
      type: 'T' as const,
      x: 4,
      y: 3,
      orientation: Orientation.Spawn,
      cells: [
        { x: 5, y: 3 }, // fila oculta (y < 4)
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 6, y: 4 },
      ],
    };

    const composed = composeBoardForRendering(board, activePiece);

    expect(composed[3]![5]).toBeNull();
    expect(composed[4]![4]).toBe('T');
    expect(composed[4]![5]).toBe('T');
    expect(composed[4]![6]).toBe('T');
  });

  it('coloca las celdas visibles de la pieza activa en las coordenadas correctas', () => {
    const board = emptyBoard();
    const activePiece = {
      type: 'I' as const,
      x: 2,
      y: 15,
      orientation: Orientation.Right,
      cells: [
        { x: 4, y: 15 },
        { x: 4, y: 16 },
        { x: 4, y: 17 },
        { x: 4, y: 18 },
      ],
    };

    const composed = composeBoardForRendering(board, activePiece);

    for (const cell of activePiece.cells) {
      expect(composed[cell.y]![cell.x]).toBe('I');
    }
    // Ninguna otra celda de la columna se ve afectada.
    expect(composed[19]![4]).toBeNull();
  });

  it('la rotación cambia las celdas de la pieza activa que se renderizan', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    engine.drainEvents();

    const before = engine.getSnapshot();
    const composedBefore = composeBoardForRendering(before.board, before.activePiece);

    engine.step({ horizontal: 0, hardDrop: false, rotateClockwise: true });
    engine.drainEvents();

    const after = engine.getSnapshot();
    const composedAfter = composeBoardForRendering(after.board, after.activePiece);

    expect(composedAfter).not.toEqual(composedBefore);
  });

  it('el hard drop no produce celdas duplicadas tras fijar la pieza', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    engine.drainEvents();

    engine.step({ horizontal: 0, hardDrop: true });
    engine.drainEvents();

    const snap = engine.getSnapshot();
    const composed = composeBoardForRendering(snap.board, snap.activePiece);

    const lockedCellCount = snap.board.flat().filter((cell) => cell !== null).length;
    const visibleActiveCellCount = snap.activePiece
      ? snap.activePiece.cells.filter((cell) => cell.y >= 4).length
      : 0;
    const composedFilledCount = composed.flat().filter((cell) => cell !== null).length;

    expect(composedFilledCount).toBe(lockedCellCount + visibleActiveCellCount);
  });

  it('no muta el snapshot ni el tablero original al componer el renderizado', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    engine.drainEvents();

    const snap: EngineSnapshot = engine.getSnapshot();
    const boardBefore = snap.board.map((row) => [...row]);
    const activePieceBefore = snap.activePiece ? { ...snap.activePiece } : null;

    composeBoardForRendering(snap.board, snap.activePiece);

    expect(snap.board).toEqual(boardBefore);
    expect(snap.activePiece).toEqual(activePieceBefore);
    expect(Object.isFrozen(snap.board)).toBe(true);
  });
});
