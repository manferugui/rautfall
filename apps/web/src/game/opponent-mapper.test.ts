import { describe, expect, it } from 'vitest';
import { createGameEngine, type EngineSnapshot } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import { mapEngineToOpponentPresentation, PIECE_COLOR_HEX } from './opponent-mapper';

describe('mapEngineToOpponentPresentation', () => {
  it('mapea correctamente un snapshot inicial vacio sin celdas bloqueadas', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    const presentation = mapEngineToOpponentPresentation(snap);

    expect(presentation.status).toBe('running');
    expect(presentation.level).toBe(1);
    expect(presentation.combatEnergy).toBe(0);
    expect(presentation.storedSabotages).toEqual([]);
    expect(presentation.activeEffects).toEqual([]);
    expect(presentation.pendingGarbage).toBe(0);
    expect(Array.isArray(presentation.visibleCells)).toBe(true);
  });

  it('descarta filas ocultas (yEngine < 4) y proyecta yVisual = yEngine - 4', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    // Crear un snapshot simulado con celdas en la zona oculta (y=0,1,2,3) y visible (y=4, 10)
    const boardCopy = snap.board.map((row) => [...row]);
    boardCopy[0]![0] = 'I'; // Fila oculta
    boardCopy[3]![5] = 'O'; // Fila oculta
    boardCopy[4]![0] = 'T'; // Fila visible -> yVisual 0
    boardCopy[14]![2] = 'garbage'; // Fila visible -> yVisual 10

    const mockSnap: EngineSnapshot = {
      ...snap,
      board: boardCopy,
      activePiece: null,
    };

    const presentation = mapEngineToOpponentPresentation(mockSnap);

    // No debe haber celdas con yEngine < 4 en la proyección
    const hiddenCells = presentation.visibleCells.filter((c) => c.y < 0 || c.y > 19);
    expect(hiddenCells).toEqual([]);

    // Debe contener las celdas visibles
    expect(presentation.visibleCells).toEqual([
      { x: 0, y: 0, type: 'T', appearance: 'fixed', color: PIECE_COLOR_HEX.T },
      { x: 2, y: 10, type: 'garbage', appearance: 'fixed', color: PIECE_COLOR_HEX.garbage },
    ]);
  });

  it('respeta la prioridad estricta activePiece > landingCells (ghost) > board', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    const boardCopy = snap.board.map((row) => [...row]);
    boardCopy[10]![5] = 'Z'; // Fija en (5, 10) -> (5, 6 visual)

    const mockSnap: EngineSnapshot = {
      ...snap,
      board: boardCopy,
      activePiece: {
        type: 'I',
        orientation: 0,
        x: 5,
        y: 10,
        cells: [{ x: 5, y: 10 }], // Coincide con la fija
        landingCells: [{ x: 5, y: 10 }, { x: 6, y: 10 }], // Coincide con fija y otra fantasma
        grounded: false,
        lockDelayElapsedMs: 0,
        lockResetsUsed: 0,
        holdUsed: false,
      },
    };

    const presentation = mapEngineToOpponentPresentation(mockSnap);

    // En (5, 6 visual), debe ganar activePiece ('active')
    const activeCell = presentation.visibleCells.find((c) => c.x === 5 && c.y === 6);
    expect(activeCell).toEqual({
      x: 5,
      y: 6,
      type: 'I',
      appearance: 'active',
      color: PIECE_COLOR_HEX.I,
    });

    // En (6, 6 visual), debe estar landingCells ('ghost')
    const ghostCell = presentation.visibleCells.find((c) => c.x === 6 && c.y === 6);
    expect(ghostCell).toEqual({
      x: 6,
      y: 6,
      type: 'I',
      appearance: 'ghost',
      color: PIECE_COLOR_HEX.I,
    });

    // No debe haber coordenadas duplicadas
    const keys = presentation.visibleCells.map((c) => `${c.x}-${c.y}`);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('asigna el color de la pieza activa a la pieza fantasma', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    const mockSnap: EngineSnapshot = {
      ...snap,
      activePiece: {
        type: 'T',
        orientation: 0,
        x: 4,
        y: 4,
        cells: [{ x: 4, y: 4 }],
        landingCells: [{ x: 4, y: 14 }], // Fantasma en y=14 -> yVisual=10
        grounded: false,
        lockDelayElapsedMs: 0,
        lockResetsUsed: 0,
        holdUsed: false,
      },
    };

    const presentation = mapEngineToOpponentPresentation(mockSnap);
    const ghostCell = presentation.visibleCells.find((c) => c.appearance === 'ghost');

    expect(ghostCell).toBeDefined();
    expect(ghostCell?.type).toBe('T');
    expect(ghostCell?.color).toBe(PIECE_COLOR_HEX.T);
  });

  it('ordena las celdas de forma determinista por y creciente y luego x creciente', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    const boardCopy = snap.board.map((row) => [...row]);
    boardCopy[8]![3] = 'J'; // yVisual 4, x 3
    boardCopy[8]![1] = 'S'; // yVisual 4, x 1
    boardCopy[5]![7] = 'L'; // yVisual 1, x 7

    const mockSnap: EngineSnapshot = {
      ...snap,
      board: boardCopy,
      activePiece: null,
    };

    const presentation = mapEngineToOpponentPresentation(mockSnap);

    expect(presentation.visibleCells.map((c) => `${c.x},${c.y}`)).toEqual([
      '7,1',
      '1,4',
      '3,4',
    ]);
  });

  it('mapea un estado gameOver correctamente sin activePiece', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const snap = engine.getSnapshot();

    const mockSnap: EngineSnapshot = {
      ...snap,
      status: 'gameOver',
      activePiece: null,
    };

    const presentation = mapEngineToOpponentPresentation(mockSnap);
    expect(presentation.status).toBe('gameOver');
    expect(presentation.visibleCells).toEqual([]);
  });

  it('devuelve una estructura de solo lectura e inmutable', () => {
    const engine = createGameEngine({ seed: 42, config: prototypeConfig });
    const presentation = mapEngineToOpponentPresentation(engine.getSnapshot());

    expect(Object.isFrozen(presentation)).toBe(true);
    expect(Object.isFrozen(presentation.storedSabotages)).toBe(true);
    expect(Object.isFrozen(presentation.activeEffects)).toBe(true);
    expect(Object.isFrozen(presentation.visibleCells)).toBe(true);
  });
});
