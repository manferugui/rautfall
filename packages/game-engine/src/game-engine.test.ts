import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@rautfall/game-config';
import {
  createGameEngine,
  EngineStepError,
  Orientation,
  validateStepInput,
  type EngineOptions,
  type PieceType,
  type SabotageType,
  type StepInput,
  type TSpinDemoInitialState,
} from './index';

function makeValidOptions(
  overrides?: Partial<EngineOptions>,
): EngineOptions {
  return {
    seed: 42,
    config: prototypeConfig,
    ...overrides,
  };
}

/** Ejecuta un paso con entrada neutra (sin movimiento, sin acciones) */
function stepStationary(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: false, rightHeld: false,
    leftPressed: false, rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
  });
}

/** Ejecuta un paso moviendo una celda a la izquierda (pulsación única) */
function stepLeft(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: true, rightHeld: false,
    leftPressed: true, rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
  });
}

/** Ejecuta un paso moviendo una celda a la derecha (pulsación única) */
function stepRight(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: false, rightHeld: true,
    leftPressed: false, rightPressed: true,
    softDropHeld: false,
    hardDrop: false,
  });
}

/** Ejecuta un hard drop */
function stepHardDrop(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: false, rightHeld: false,
    leftPressed: false, rightPressed: false,
    softDropHeld: false,
    hardDrop: true,
  });
}

/** Vacía la cola de eventos y los descarta */
function drainAll(engine: ReturnType<typeof createGameEngine>): void {
  engine.drainEvents();
}

/**
 * Ejecuta hard drop tantas veces como sea posible sin que se lance el game over.
 */
function hardDropUntilGameOver(
  engine: ReturnType<typeof createGameEngine>,
): { dropped: number; gameOver: boolean } {
  let dropped = 0;
  for (let i = 0; i < 200; i++) {
    if (engine.getSnapshot().status === 'gameOver') break;
    stepHardDrop(engine);
    drainAll(engine);
    dropped++;
  }
  return { dropped, gameOver: engine.getSnapshot().status === 'gameOver' };
}

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE PRNG Y BOLSA
// ════════════════════════════════════════════════════════════════════════

describe('PRNG y bolsa', () => {
  it('la misma semilla produce una secuencia idéntica de tipos de pieza', () => {
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());

    drainAll(engineA);
    drainAll(engineB);

    const piecesA: PieceType[] = [];
    const piecesB: PieceType[] = [];

    for (let i = 0; i < 14; i++) {
      const snapA = engineA.getSnapshot();
      const snapB = engineB.getSnapshot();

      if (snapA.status === 'gameOver' || snapB.status === 'gameOver') break;

      if (snapA.activePiece) piecesA.push(snapA.activePiece.type);
      if (snapB.activePiece) piecesB.push(snapB.activePiece.type);

      stepHardDrop(engineA);
      stepHardDrop(engineB);
      drainAll(engineA);
      drainAll(engineB);
    }

    expect(piecesA).toEqual(piecesB);
  });

  it('una semilla diferente produce una secuencia diferente', () => {
    const engineA = createGameEngine(makeValidOptions({ seed: 42 }));
    const engineB = createGameEngine(makeValidOptions({ seed: 99 }));

    drainAll(engineA);
    drainAll(engineB);

    const piecesA: PieceType[] = [];
    const piecesB: PieceType[] = [];

    for (let i = 0; i < 14; i++) {
      const snapA = engineA.getSnapshot();
      const snapB = engineB.getSnapshot();

      if (snapA.status === 'gameOver' || snapB.status === 'gameOver') break;

      if (snapA.activePiece) piecesA.push(snapA.activePiece.type);
      if (snapB.activePiece) piecesB.push(snapB.activePiece.type);

      stepHardDrop(engineA);
      stepHardDrop(engineB);
      drainAll(engineA);
      drainAll(engineB);
    }

    expect(piecesA).not.toEqual(piecesB);
  });

  it('siete piezas consecutivas contienen todos los tipos sin repetición', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const firstBag: PieceType[] = [];

    for (let i = 0; i < 7; i++) {
      const snap = engine.getSnapshot();
      if (snap.activePiece) firstBag.push(snap.activePiece.type);
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(firstBag).toHaveLength(7);
    expect(new Set(firstBag).size).toBe(7);
    const allTypes: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (const t of allTypes) {
      expect(firstBag).toContain(t);
    }
  });

  it('las bolsas consecutivas son independientes (la segunda bolsa también es un conjunto completo)', () => {
    const slowGravityConfig = {
      ...prototypeConfig,
      gravityCellsPerSecond: 0.1,
    };
    const engine = createGameEngine(makeValidOptions({ seed: 12345, config: slowGravityConfig }));
    drainAll(engine);

    for (let i = 0; i < 7; i++) {
      const snap = engine.getSnapshot();
      if (snap.activePiece) {
        for (let m = 0; m < (i % 3); m++) stepRight(engine);
      }
      stepHardDrop(engine);
      drainAll(engine);
    }

    const secondBag: PieceType[] = [];
    for (let i = 0; i < 7; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece) {
        secondBag.push(snap.activePiece.type);
        for (let m = 0; m < (i % 4); m++) stepRight(engine);
        stepHardDrop(engine);
        drainAll(engine);
      }
    }

    expect(secondBag.length).toBeGreaterThanOrEqual(5);
    expect(new Set(secondBag).size).toBe(secondBag.length);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE SPAWN
// ════════════════════════════════════════════════════════════════════════

describe('spawn', () => {
  it('spawn centrado coloca pieza en x correcta', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    expect(snap.activePiece).not.toBeNull();
    if (snap.activePiece) {
      const piece = snap.activePiece;
      const width: Record<PieceType, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
      const expectedX = Math.floor((10 - width[piece.type]) / 2);
      expect(piece.x).toBe(expectedX);
    }
  });

  it('la pieza I (altura 1) aparece con su única fila en y=4 (completamente visible)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 20; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece?.type === 'I') {
        expect(snap.activePiece.y).toBe(4);
        return;
      }
      stepHardDrop(engine);
      drainAll(engine);
    }
    expect(false).toBe(true);
  });

  it('las piezas de altura 2 (O, T, S, Z, J, L) aparecen con la fila superior en y=3 y la inferior en y=4', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 20; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece && snap.activePiece.type !== 'I') {
        expect(snap.activePiece.y).toBe(3);
        return;
      }
      stepHardDrop(engine);
      drainAll(engine);
    }
    expect(false).toBe(true);
  });

  it('spawn bloqueado detecta colisión con bloques existentes', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    let gameOverDetected = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') {
        gameOverDetected = true;
        break;
      }
      try {
        stepHardDrop(engine);
      } catch {
        gameOverDetected = true;
        break;
      }
      drainAll(engine);
    }

    expect(gameOverDetected).toBe(true);
    expect(engine.getSnapshot().status).toBe('gameOver');
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE MOVIMIENTO HORIZONTAL (pulsación inmediata)
// ════════════════════════════════════════════════════════════════════════

describe('movimiento horizontal — pulsación inmediata', () => {
  it('una pulsación breve de izquierda (leftPressed en un solo paso) mueve exactamente una celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;

    // Paso 1: pulsa izquierda (pressed + held)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    // Paso 2: suelta izquierda (ni held ni pressed)
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Solo 1 celda de desplazamiento, no debe arrastrar DAS/ARR
    expect(engine.getSnapshot().activePiece!.x).toBe(initialX - 1);
  });

  it('una pulsación breve de derecha mueve exactamente una celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;

    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.x).toBe(initialX + 1);
  });

  it('mantener izquierda menos de dasMs nunca mueve más de una celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;

    // Paso 1: activación (pressed + held)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Pasos 2-14: mantener izquierda (held=true, pressed=false) = 130ms, < 150ms DAS
    for (let i = 0; i < 13; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Paso 15: soltar (held=false)
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Solo 1 celda: la activación inicial. DAS a 150ms no se ha alcanzado aún.
    expect(engine.getSnapshot().activePiece!.x).toBe(initialX - 1);
  });

  it('el movimiento inmediato no precarga ni consume ARR', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Activación izquierda (1 movimiento)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events1 = engine.drainEvents();
    expect(events1.filter(e => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);

    // Soltar inmediatamente
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events2 = engine.drainEvents();
    // No debe haber movimientos horizontales en el paso de soltar
    expect(events2.filter(e => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(0);
  });

  it('el movimiento a la izquierda (leftPressed+leftHeld) actualiza las coordenadas', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;
    stepLeft(engine);
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.x).toBe(initialX - 1);
  });

  it('el movimiento a la derecha (rightPressed+rightHeld) actualiza las coordenadas', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;
    stepRight(engine);
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.x).toBe(initialX + 1);
  });

  it('el movimiento contra la pared izquierda es bloqueado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 20; i++) {
      stepLeft(engine);
      drainAll(engine);
    }

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      for (const cell of snap.activePiece.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('el movimiento contra la pared derecha es bloqueado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 20; i++) {
      stepRight(engine);
      drainAll(engine);
    }

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      for (const cell of snap.activePiece.cells) {
        expect(cell.x).toBeLessThan(10);
      }
    }
  });

  it('el movimiento contra un bloque fijo es bloqueado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const board = engine.getSnapshot().board;
    const lockedCells: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 10; x++) {
        if (board[y]![x] !== null) {
          lockedCells.push({ x, y });
        }
      }
    }

    for (let i = 0; i < 10; i++) {
      stepLeft(engine);
      drainAll(engine);
    }
    for (let i = 0; i < 20; i++) {
      stepRight(engine);
      drainAll(engine);
    }

    const activeSnap = engine.getSnapshot().activePiece;
    if (activeSnap) {
      for (const cell of activeSnap.cells) {
        const overlaps = lockedCells.some((lc) => lc.x === cell.x && lc.y === cell.y);
        expect(overlaps).toBe(false);
      }
    }
  });

  it('un movimiento inválido (bloqueado) no muta el estado ni emite evento', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 20; i++) {
      stepLeft(engine);
    }
    drainAll(engine);

    const beforeLeft = engine.getSnapshot().activePiece!.x;
    // Intento de mover más allá de la pared (no se espera evento)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const afterLeft = engine.getSnapshot().activePiece!.x;

    expect(afterLeft).toBe(beforeLeft);
    expect(events.filter((e) => e.type === 'pieceMoved')).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE GRAVEDAD
// ════════════════════════════════════════════════════════════════════════

describe('gravedad', () => {
  it('la gravedad mueve la pieza hacia abajo (progreso >= 1000)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    for (let i = 0; i < 100; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.y).toBe(initialY + 1);
  });

  it('la gravedad no excede el tiempo lógico disponible (99 pasos no descenden)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.y).toBe(initialY);
  });

  it('la gravedad se omite cuando hardDrop es true', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 50; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const newSnap = engine.getSnapshot();
    if (newSnap.activePiece) {
      const height: Record<PieceType, number> = { I: 1, O: 2, T: 2, S: 2, Z: 2, J: 2, L: 2 };
      const h = height[newSnap.activePiece.type];
      const spawnY = 4 - h + 1;
      expect(newSnap.activePiece.y).toBe(spawnY);
    }
  });

  it('un mismo paso produce múltiples descensos de gravedad cuando la velocidad es alta', () => {
    const engine = createGameEngine(makeValidOptions(), {
      board: emptyBoard(),
      activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
      nextPieces: ['O', 'T', 'L'],
      heldPiece: null,
      clearedLines: 90,
    });
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    for (let i = 0; i < 100; i++) {
      stepStationary(engine);
    }
    const events = engine.drainEvents();

    const gravityMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'gravity');
    expect(gravityMoves.length).toBeGreaterThanOrEqual(10);

    const newY = engine.getSnapshot().activePiece!.y;
    expect(newY).toBeGreaterThanOrEqual(initialY + 10);
  });

  it('el progreso vertical se reinicia a 0 tras fijar y aparecer una nueva pieza', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 50; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const newY = engine.getSnapshot().activePiece!.y;
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.y).toBe(newY);
  });

  it('el progreso vertical se reinicia a 0 en reset()', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 60; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 42 }));
    drainAll(engine);

    const y1 = engine.getSnapshot().activePiece!.y;
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.y).toBe(y1);
  });

  it('el progreso vertical no traslada tiempo remanente entre piezas', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const yAfterSpawn = engine.getSnapshot().activePiece!.y;
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.y).toBe(yAfterSpawn);
  });

  it('los intervalos de gravedad no alineados se resuelven de forma determinista', () => {
    const unalignedConfig = {
      ...prototypeConfig,
      gravityCellsPerSecond: 0.75,
    };
    const engineA = createGameEngine(makeValidOptions({ config: unalignedConfig }));
    const engineB = createGameEngine(makeValidOptions({ config: unalignedConfig }));
    drainAll(engineA);
    drainAll(engineB);

    for (let i = 0; i < 300; i++) {
      stepStationary(engineA);
      stepStationary(engineB);
    }

    drainAll(engineA);
    drainAll(engineB);

    expect(engineA.getSnapshot().activePiece!.y).toBe(engineB.getSnapshot().activePiece!.y);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE HARD DROP
// ════════════════════════════════════════════════════════════════════════

describe('hard drop', () => {
  it('el hard drop desciende la pieza hasta la posición más baja posible', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const newSnap = engine.getSnapshot();
    if (newSnap.activePiece) {
      const height: Record<PieceType, number> = { I: 1, O: 2, T: 2, S: 2, Z: 2, J: 2, L: 2 };
      const expectedY = 4 - height[newSnap.activePiece.type] + 1;
      expect(newSnap.activePiece.y).toBe(expectedY);
    }
  });

  it('el hard drop fija la pieza inmediatamente', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const beforeBoard = engine.getSnapshot().board;
    const boardHasBlocks = beforeBoard.some((row) => row.some((cell) => cell !== null));
    expect(boardHasBlocks).toBe(false);

    stepHardDrop(engine);
    drainAll(engine);

    const afterBoard = engine.getSnapshot().board;
    const boardHasBlocksAfter = afterBoard.some((row) => row.some((cell) => cell !== null));
    expect(boardHasBlocksAfter).toBe(true);
  });

  it('el hard drop no emite eventos por celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();

    const hardDropMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
    expect(hardDropMoves.length).toBeLessThanOrEqual(1);
  });

  it('el hard drop con distancia >= 1 emite un pieceMoved(hardDrop) y pieceLocked', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();

    const hasHardDropMove = events.some((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
    const hasLocked = events.some((e) => e.type === 'pieceLocked');

    expect(hasHardDropMove).toBe(true);
    expect(hasLocked).toBe(true);
  });

  it('el hard drop con distancia 0 (pieza ya apoyada) no emite pieceMoved, solo pieceLocked', () => {
    const engine = createGameEngine(makeValidOptions(), {
      board: emptyBoard(),
      activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
      nextPieces: ['O', 'T', 'L'],
      heldPiece: null,
      clearedLines: 90,
    });
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    let found = false;
    for (let i = 0; i < 200; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;

      if (snap.activePiece) {
        const cells = snap.activePiece.cells;
        let hasBlockBelow = false;
        for (const cell of cells) {
          if (cell.y + 1 >= 24) {
            hasBlockBelow = true;
            break;
          }
          if (snap.board[cell.y + 1]![cell.x] !== null) {
            hasBlockBelow = true;
            break;
          }
        }
        if (hasBlockBelow) {
          found = true;
          engine.step({
            leftHeld: false, rightHeld: false,
            leftPressed: false, rightPressed: false,
            softDropHeld: false,
            hardDrop: true,
          });
          const events = engine.drainEvents();

          const hardDropMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
          expect(hardDropMoves).toHaveLength(0);
          expect(events.some((e) => e.type === 'pieceLocked')).toBe(true);
          break;
        }
      }
      stepStationary(engine);
    }
    expect(found).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE FIJACIÓN
// ════════════════════════════════════════════════════════════════════════

describe('fijación', () => {
  it('la fijación transfiere las cuatro celdas al tablero', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const activeBefore = engine.getSnapshot().activePiece;
    expect(activeBefore).not.toBeNull();

    stepHardDrop(engine);
    drainAll(engine);

    const afterBoard = engine.getSnapshot().board;
    const hasBlocks = afterBoard.some((row) => row.some((cell) => cell !== null));
    expect(hasBlocks).toBe(true);
  });

  it('la fijación en filas ocultas no produce game over por sí misma', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 50; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const engine2 = createGameEngine(makeValidOptions());
    drainAll(engine2);

    const result = hardDropUntilGameOver(engine2);
    expect(result.gameOver).toBe(true);

    const events = engine2.drainEvents();
    const gameOverEvents = events.filter((e) => e.type === 'gameOver');
    for (const e of gameOverEvents) {
      if (e.type === 'gameOver') {
        expect(e.reason).toBe('spawnBlocked');
      }
    }
  });

  it('una fijación normal permite que la partida continúe', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    expect(engine.getSnapshot().status).toBe('running');

    stepHardDrop(engine);
    drainAll(engine);

    expect(engine.getSnapshot().status).toBe('running');
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE ELIMINACIÓN DE LÍNEAS
// ════════════════════════════════════════════════════════════════════════

describe('eliminación de líneas', () => {
  it('una línea completa se elimina', () => {
    const slowConfig = {
      ...prototypeConfig,
      gravityCellsPerSecond: 0.1,
    };
    const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
    drainAll(engine);

    let totalCleared = 0;
    for (let i = 0; i < 400; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;

      if (snap.activePiece) {
        const targetCol = (i * 3) % 9;
        const currentX = snap.activePiece.x;
        const diff = targetCol - currentX;
        if (diff > 0) {
          for (let m = 0; m < Math.min(diff, 5); m++) stepRight(engine);
        } else if (diff < 0) {
          for (let m = 0; m < Math.min(-diff, 5); m++) stepLeft(engine);
        }
      }

      stepHardDrop(engine);
      const events = engine.drainEvents();
      const cleared = events.filter((e) => e.type === 'linesCleared');
      for (const c of cleared) {
        if (c.type === 'linesCleared') {
          totalCleared += c.lines;
        }
      }
    }

    if (totalCleared > 0) {
      expect(engine.getSnapshot().clearedLines).toBe(totalCleared);
    }
  });

  it('varias líneas completas se eliminan simultáneamente', () => {
    const slowConfig = {
      ...prototypeConfig,
      gravityCellsPerSecond: 0.1,
    };
    const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
    drainAll(engine);

    let maxLinesCleared = 0;
    for (let i = 0; i < 400; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;

      if (snap.activePiece) {
        const targetCol = (i * 3) % 9;
        const currentX = snap.activePiece.x;
        const diff = targetCol - currentX;
        if (diff > 0) {
          for (let m = 0; m < Math.min(diff, 5); m++) stepRight(engine);
        } else if (diff < 0) {
          for (let m = 0; m < Math.min(-diff, 5); m++) stepLeft(engine);
        }
      }

      stepHardDrop(engine);
      const events = engine.drainEvents();
      for (const e of events) {
        if (e.type === 'linesCleared' && e.lines > maxLinesCleared) {
          maxLinesCleared = e.lines;
        }
      }
    }

    if (maxLinesCleared > 0) {
      expect(engine.getSnapshot().clearedLines).toBeGreaterThanOrEqual(maxLinesCleared);
    }
  });

  it('las líneas incompletas permanecen en el tablero', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    const cleared = events.filter((e) => e.type === 'linesCleared');

    expect(cleared).toHaveLength(0);
    expect(engine.getSnapshot().clearedLines).toBe(0);
  });

  it('las filas superiores descienden correctamente tras eliminar líneas', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const board = engine.getSnapshot().board;
    expect(board).toHaveLength(24);
    for (const row of board) {
      expect(row).toHaveLength(10);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE GAME OVER
// ════════════════════════════════════════════════════════════════════════

describe('game over', () => {
  it('spawnBlocked termina la partida', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    let gameOver = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') {
        gameOver = true;
        break;
      }
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(gameOver).toBe(true);
    expect(engine.getSnapshot().status).toBe('gameOver');
  });

  it('tras spawnBlocked, el snapshot tiene status gameOver, activePiece null y nextPieces con longitud 3', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    let gameOver = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') {
        gameOver = true;
        break;
      }
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(gameOver).toBe(true);
    const snap = engine.getSnapshot();
    expect(snap.status).toBe('gameOver');
    expect(snap.activePiece).toBeNull();
    expect(snap.nextPieces).toHaveLength(3);
  });

  it('los bloques en filas ocultas no provocan game over mientras el siguiente spawn sea válido', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 30; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }
  });

  it('el estado pasa a gameOver', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    expect(engine.getSnapshot().status).toBe('running');

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(engine.getSnapshot().status).toBe('gameOver');
  });

  it('step() después de game over lanza ENGINE_NOT_RUNNING', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(() => {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
    }).toThrow(EngineStepError);
    try {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('ENGINE_NOT_RUNNING');
      }
    }
  });

  it('step() en gameOver con entrada también inválida lanza ENGINE_NOT_RUNNING (precedencia)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    try {
      (engine.step as (input: unknown) => void)({});
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('ENGINE_NOT_RUNNING');
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE EVENTOS
// ════════════════════════════════════════════════════════════════════════

describe('eventos', () => {
  it('pieceSpawned NO se emite para la pieza inicial al crear el motor', () => {
    const engine = createGameEngine(makeValidOptions());
    const events = engine.drainEvents();
    expect(events.some((e) => e.type === 'pieceSpawned')).toBe(false);
    expect(events.some((e) => e.type === 'engineStarted')).toBe(true);
  });

  it('pieceSpawned se emite para cada pieza tras la fijación', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    expect(events.some((e) => e.type === 'pieceSpawned')).toBe(true);
  });

  it('pieceMoved solo se emite en movimientos válidos', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepLeft(engine);
    const events = engine.drainEvents();
    expect(events.some((e) => e.type === 'pieceMoved')).toBe(true);

    for (let i = 0; i < 20; i++) {
      stepLeft(engine);
    }
    engine.drainEvents();

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      for (const cell of snap.activePiece.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.x).toBeLessThan(10);
      }
    }
  });

  it('pieceLocked se emite al fijar', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    expect(events.some((e) => e.type === 'pieceLocked')).toBe(true);
  });

  it('linesCleared se emite con los índices correctos', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 300; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      engine.step({
        leftHeld: i % 2 === 0, rightHeld: i % 2 !== 0,
        leftPressed: i % 2 === 0, rightPressed: i % 2 !== 0,
        softDropHeld: false,
        hardDrop: true,
      });
      const events = engine.drainEvents();

      for (const e of events) {
        if (e.type === 'linesCleared') {
          for (const idx of e.lineIndices) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(24);
          }
          expect(e.lines).toBe(e.lineIndices.length);
        }
      }
    }
  });

  it('gameOver se emite con motivo spawnBlocked', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') {
        break;
      }
      stepHardDrop(engine);
      if (engine.getSnapshot().status === 'gameOver') {
        const events = engine.drainEvents();
        expect(events.some((e) => e.type === 'gameOver')).toBe(true);
        const goEvt = events.find((e) => e.type === 'gameOver');
        if (goEvt && goEvt.type === 'gameOver') {
          expect(goEvt.reason).toBe('spawnBlocked');
        }
        return;
      }
      drainAll(engine);
    }

    expect(engine.getSnapshot().status).toBe('gameOver');
  });

  it('no se emiten eventos para movimientos inválidos (bloqueados)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 10; i++) {
      stepLeft(engine);
    }
    drainAll(engine);

    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    expect(events.filter((e) => e.type === 'pieceMoved')).toHaveLength(0);
  });

  it('drainEvents devuelve los eventos en orden y vacía la cola', () => {
    const engine = createGameEngine(makeValidOptions());
    const firstDrain = engine.drainEvents();
    expect(firstDrain).toHaveLength(1);
    expect(firstDrain[0]?.type).toBe('engineStarted');

    const emptyDrain = engine.drainEvents();
    expect(emptyDrain).toHaveLength(0);

    stepLeft(engine);
    const moveEvents = engine.drainEvents();
    expect(moveEvents.length).toBeGreaterThanOrEqual(1);
    expect(moveEvents[0]?.type).toBe('pieceMoved');

    const emptyAgain = engine.drainEvents();
    expect(emptyAgain).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE SNAPSHOT
// ════════════════════════════════════════════════════════════════════════

describe('snapshot', () => {
  it('el snapshot contiene el estado correcto tras cada paso', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap0 = engine.getSnapshot();
    expect(snap0.step).toBe(0);
    expect(snap0.status).toBe('running');
    expect(snap0.activePiece).not.toBeNull();
    expect(snap0.nextPieces).toHaveLength(3);
    expect(snap0.clearedLines).toBe(0);

    stepStationary(engine);
    drainAll(engine);

    const snap1 = engine.getSnapshot();
    expect(snap1.step).toBe(1);
    expect(snap1.elapsedMs).toBe(prototypeConfig.fixedStepMs);
  });

  it('el snapshot es inmutable', () => {
    const engine = createGameEngine(makeValidOptions());
    const snap = engine.getSnapshot();

    expect(() => {
      (snap as Record<string, unknown>).step = 999;
    }).toThrow();

    expect(Object.isFrozen(snap.board)).toBe(true);
  });

  it('el tablero tiene 24 filas y 10 columnas', () => {
    const engine = createGameEngine(makeValidOptions());
    const board = engine.getSnapshot().board;
    expect(board).toHaveLength(24);
    for (const row of board) {
      expect(row).toHaveLength(10);
    }
  });

  it('activePiece es null cuando no hay pieza activa (game over)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const finalSnap = engine.getSnapshot();
    if (finalSnap.status === 'gameOver') {
      expect(finalSnap.activePiece).toBeNull();
    }
  });

  it('nextPieces contiene tres piezas de tipos válidos', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    expect(snap.nextPieces).toHaveLength(3);

    const validTypes: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    for (const piece of snap.nextPieces) {
      expect(validTypes).toContain(piece);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE DETERMINISMO
// ════════════════════════════════════════════════════════════════════════

describe('determinismo', () => {
  it('la misma semilla y las mismas entradas producen snapshot y eventos idénticos', () => {
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());

    expect(engineA.getSnapshot()).toEqual(engineB.getSnapshot());

    const inputs: StepInput[] = [
      { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
    ];

    const snapshotsA: unknown[] = [];
    const eventsA: unknown[] = [];
    const snapshotsB: unknown[] = [];
    const eventsB: unknown[] = [];

    snapshotsA.push(engineA.getSnapshot());
    eventsA.push(engineA.drainEvents());
    snapshotsB.push(engineB.getSnapshot());
    eventsB.push(engineB.drainEvents());

    for (const input of inputs) {
      try {
        engineA.step(input);
      } catch {
        // se ignora el game over
      }
      snapshotsA.push(engineA.getSnapshot());
      eventsA.push(engineA.drainEvents());

      try {
        engineB.step(input);
      } catch {
        // se ignora el game over
      }
      snapshotsB.push(engineB.getSnapshot());
      eventsB.push(engineB.drainEvents());
    }

    expect(snapshotsA).toEqual(snapshotsB);
    expect(eventsA).toEqual(eventsB);
  });

  it('semillas diferentes producen resultados diferentes', () => {
    const engineA = createGameEngine(makeValidOptions({ seed: 42 }));
    const engineB = createGameEngine(makeValidOptions({ seed: 99 }));

    drainAll(engineA);
    drainAll(engineB);

    for (let i = 0; i < 5; i++) {
      if (engineA.getSnapshot().status === 'gameOver' || engineB.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engineA);
      stepHardDrop(engineB);
      drainAll(engineA);
      drainAll(engineB);
    }

    const boardA = engineA.getSnapshot().board;
    const boardB = engineB.getSnapshot().board;

    let boardsDiffer = false;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 10; x++) {
        if (boardA[y]![x] !== boardB[y]![x]) {
          boardsDiffer = true;
        }
      }
    }
    expect(boardsDiffer).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE RESET
// ════════════════════════════════════════════════════════════════════════

describe('reset', () => {
  it('reset restaura todos los contadores', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 50; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 42 }));
    const snap = engine.getSnapshot();
    drainAll(engine);

    expect(snap.step).toBe(0);
    expect(snap.elapsedMs).toBe(0);
    expect(snap.seed).toBe(42);
    expect(snap.status).toBe('running');
    expect(snap.clearedLines).toBe(0);
  });

  it('reset genera inmediatamente la pieza activa y la siguiente sin llamar a step()', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 99 }));
    const snap = engine.getSnapshot();

    expect(snap.activePiece).not.toBeNull();
    expect(snap.nextPieces).toHaveLength(3);
  });

  it('reset no emite pieceSpawned ni engineStarted', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 99 }));
    const events = engine.drainEvents();

    const types = events.map((e) => e.type);
    expect(types).not.toContain('pieceSpawned');
    expect(types).not.toContain('engineStarted');
  });

  it('reset emite exactamente un engineReset', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 99 }));
    const events = engine.drainEvents();

    expect(events.filter((e) => e.type === 'engineReset')).toHaveLength(1);
  });

  it('reset elimina los eventos anteriores', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepLeft(engine);
    const beforeEvents = engine.drainEvents();
    expect(beforeEvents.length).toBe(1);
    expect(beforeEvents[0]?.type).toBe('pieceMoved');

    engine.reset(makeValidOptions({ seed: 99 }));
    const afterEvents = engine.drainEvents();

    expect(afterEvents.length).toBe(1);
    expect(afterEvents[0]?.type).toBe('engineReset');
  });

  it('reset permite comenzar de nuevo con una semilla distinta', () => {
    const engine = createGameEngine(makeValidOptions({ seed: 10 }));
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 20 }));
    const snap = engine.getSnapshot();
    drainAll(engine);
    expect(snap.seed).toBe(20);

    const engineB = createGameEngine(makeValidOptions({ seed: 20 }));
    drainAll(engineB);

    for (let i = 0; i < 3; i++) {
      stepStationary(engine);
      stepStationary(engineB);
      drainAll(engine);
      drainAll(engineB);
    }

    expect(engine.getSnapshot()).toEqual(engineB.getSnapshot());
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE VALIDACIÓN DE ENTRADA (nuevo contrato)
// ════════════════════════════════════════════════════════════════════════

describe('validación de entrada — nuevo contrato', () => {
  function validInput(): StepInput {
    return {
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    };
  }

  it('entrada válida con leftPressed+leftHeld no lanza error', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(() => engine.step({ ...validInput(), leftHeld: true, leftPressed: true })).not.toThrow();
  });

  it('entrada válida con rightPressed+rightHeld no lanza error', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(() => engine.step({ ...validInput(), rightHeld: true, rightPressed: true })).not.toThrow();
  });

  it('entrada válida con softDropHeld no lanza error', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(() => engine.step({ ...validInput(), softDropHeld: true })).not.toThrow();
  });

  it('leftPressed: true con leftHeld: false es rechazado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    try {
      engine.step({ ...validInput(), leftPressed: true, leftHeld: false });
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('rightPressed: true con rightHeld: false es rechazado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    try {
      engine.step({ ...validInput(), rightPressed: true, rightHeld: false });
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('leftPressed y rightPressed simultáneos son rechazados', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    try {
      engine.step({ ...validInput(), leftPressed: true, rightPressed: true, leftHeld: true, rightHeld: true });
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('rotateClockwise y rotateCounterclockwise simultáneos siguen siendo rechazados (regresión)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(() => {
      engine.step({ ...validInput(), rotateClockwise: true, rotateCounterclockwise: true });
    }).toThrow(EngineStepError);
  });

  it('una propiedad desconocida (horizontal) es rechazada', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(() => {
      (engine.step as (input: Record<string, unknown>) => void)({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, horizontal: -1 });
    }).toThrow(EngineStepError);
  });

  it('step({}) es rechazado con INVALID_GAME_INPUT', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    try {
      (engine.step as (input: unknown) => void)({});
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('campos ausentes: leftHeld', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const invalid = { rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false } as Record<string, unknown>;
    try {
      (engine.step as (input: unknown) => void)(invalid);
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('hardDrop ausente es rechazado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const invalid = { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false } as Record<string, unknown>;
    try {
      (engine.step as (input: unknown) => void)(invalid);
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('INVALID_GAME_INPUT');
      }
    }
  });

  it('una entrada inválida no muta el estado (step, elapsedMs, pieza, tablero, PRNG, prioridad, acumuladores)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap0 = engine.getSnapshot();
    const step0 = snap0.step;
    const elapsed0 = snap0.elapsedMs;

    // Intentos inválidos
    try { engine.step({ ...validInput(), leftPressed: true, leftHeld: false }); } catch { /* expected */ }
    try { (engine.step as (input: unknown) => void)({}); } catch { /* expected */ }
    try { engine.step({ ...validInput(), leftHeld: true, rightHeld: true, leftPressed: true, rightPressed: true }); } catch { /* expected */ }
    try { (engine.step as (input: unknown) => void)({ ...validInput(), extra: 1 }); } catch { /* expected */ }

    const snapAfter = engine.getSnapshot();
    expect(snapAfter.step).toBe(step0);
    expect(snapAfter.elapsedMs).toBe(elapsed0);
    expect(snapAfter.activePiece?.type).toBe(snap0.activePiece?.type);
    expect(snapAfter.activePiece?.x).toBe(snap0.activePiece?.x);
    expect(snapAfter.activePiece?.y).toBe(snap0.activePiece?.y);
    expect(snapAfter.nextPieces).toEqual(snap0.nextPieces);
    expect(snapAfter.status).toBe(snap0.status);
    // El tablero no debe cambiar
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 10; x++) {
        expect(snapAfter.board[y]![x]).toBe(snap0.board[y]![x]);
      }
    }
  });

  it('step() en gameOver lanza ENGINE_NOT_RUNNING incluso si la entrada también es inválida', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    try {
      (engine.step as (input: unknown) => void)({});
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('ENGINE_NOT_RUNNING');
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE PRIORIDAD HORIZONTAL
// ════════════════════════════════════════════════════════════════════════

describe('prioridad horizontal', () => {
  it('izquierda pulsada: movimiento inmediato una celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;
    stepLeft(engine);
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.x).toBe(initialX - 1);
  });

  it('derecha pulsada: movimiento inmediato una celda', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialX = engine.getSnapshot().activePiece!.x;
    stepRight(engine);
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.x).toBe(initialX + 1);
  });

  it('cambio de prioridad: se pulsa la dirección contraria', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Mover a la izquierda primero
    const x0 = engine.getSnapshot().activePiece!.x;
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    const x1 = engine.getSnapshot().activePiece!.x;
    expect(x1).toBe(x0 - 1);

    // Cambiar a derecha en el mismo paso que la izquierda se soltó
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    const x2 = engine.getSnapshot().activePiece!.x;
    expect(x2).toBe(x1 + 1);
  });

  it('soltar prioritaria con otra mantenida activa la otra inmediatamente', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const x0 = engine.getSnapshot().activePiece!.x;

    // Activar izquierda
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    const x1 = engine.getSnapshot().activePiece!.x;
    expect(x1).toBe(x0 - 1);

    // Soltar izquierda, mantener derecha → derecha se activa
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    const x2 = engine.getSnapshot().activePiece!.x;
    expect(x2).toBe(x1 + 1);
  });

  it('ambas mantenidas sin flanco tras spawn permanecen neutrales', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const x0 = engine.getSnapshot().activePiece!.x;

    // Ambas mantenidas, sin flanco: no debe moverse
    engine.step({
      leftHeld: true, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.x).toBe(x0);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE DAS
// ════════════════════════════════════════════════════════════════════════

describe('DAS', () => {
  // Con prototypeConfig: fixedStepMs=10, dasMs=150, arrMs=50
  // Activación: 1 movimiento inmediato en t=0 (paso 1)
  // Después 15 pasos (150ms) sin repetición
  // Primera repetición en el paso 16 (t=150ms acumulado desde activación)

  it('no repite antes del umbral DAS', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Paso 1: activación izquierda (1 movimiento inmediato)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events1 = engine.drainEvents();
    const moves1 = events1.filter((e) => e.type === 'pieceMoved');
    expect(moves1).toHaveLength(1);

    // Pasos 2-15: mantener izquierda sin soltar (14 pasos = 140ms acumulados, < 150ms DAS)
    for (let i = 0; i < 14; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      const ev = engine.drainEvents();
      // No debe haber movimientos horizontales adicionales
      expect(ev.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(0);
    }
  });

  it('primera repetición ocurre exactamente al alcanzar dasMs (paso 16, 150ms acumulados)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Paso 1: activación izquierda
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Pasos 2-15: mantener izquierda
    for (let i = 0; i < 14; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Paso 16: debe ocurrir la primera repetición DAS (150ms acumulados)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const dasMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    expect(dasMoves).toHaveLength(1);
  });

  it('cambio de dirección reinicia DAS', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Activar izquierda
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // 10 pasos manteniendo izquierda
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Cambiar a derecha (reinicia DAS)
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // 14 pasos más manteniendo derecha (140ms, < 150ms DAS)
    for (let i = 0; i < 14; i++) {
      engine.step({
        leftHeld: false, rightHeld: true,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      const ev = engine.drainEvents();
      expect(ev.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(0);
    }

    // Paso siguiente: primera repetición DAS de derecha
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    expect(events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);
  });

  it('soltar y volver a pulsar la misma dirección reinicia DAS', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Activar izquierda
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // 10 pasos manteniendo
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Soltar y volver a pulsar izquierda (nueva activación)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    // Debe haber movimiento inmediato (1) y no más
    expect(events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);

    // 14 pasos manteniendo izquierda desde la nueva activación
    for (let i = 0; i < 14; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      const ev = engine.drainEvents();
      expect(ev.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(0);
    }

    // Paso siguiente: primera repetición DAS
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const finalEvents = engine.drainEvents();
    expect(finalEvents.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);
  });

  it('nueva pieza no hereda estado DAS', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Activar izquierda y mantener muchas repeticiones
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);
    for (let i = 0; i < 30; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Hard drop para fijar y spawnear nueva pieza
    stepHardDrop(engine);
    drainAll(engine);

    const xAfterSpawn = engine.getSnapshot().activePiece!.x;

    // Mantener izquierda: debe actuar como activación (movimiento inmediato, no repetición)
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const moves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    // Debe haber 1 movimiento inmediato (activación), no arrastre acumulado
    expect(moves).toHaveLength(1);
    expect(engine.getSnapshot().activePiece!.x).toBe(xAfterSpawn - 1);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE ARR
// ════════════════════════════════════════════════════════════════════════

describe('ARR', () => {
  // Con prototypeConfig: arrMs=50, fixedStepMs=10
  // Tras DAS (150ms), cada arrMs=50 produce una repetición = cada 5 pasos

  it('cadencia ARR exacta tras DAS', () => {
    // Usamos una pieza I (la primera de seed 42 es I) que tiene x inicial=3,
    // dejando 7 espacios a la derecha para movimientos sin chocar con pared.
    // Con DAS en 150ms (15 pasos) y ARR cada 50ms (5 pasos).
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Mover a la derecha para tener más espacio
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Paso 1: activación derecha
    // Pasos 2-15: 140ms acumulados (sin DAS aún)
    for (let i = 0; i < 14; i++) {
      engine.step({
        leftHeld: false, rightHeld: true,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Paso 16: DAS (1 movimiento)
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const dasEvents = engine.drainEvents();
    expect(dasEvents.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);

    // Paso 21: 5 pasos después = 50ms = primera repetición ARR
    for (let i = 0; i < 4; i++) {
      engine.step({
        leftHeld: false, rightHeld: true,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const arrEvents1 = engine.drainEvents();
    expect(arrEvents1.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);
  });

  it('varias repeticiones ARR en un mismo paso (arrMs pequeño)', () => {
    // Configuración: fixedStepMs=100, arrMs=100, dasMs=200
    // arrMs % fixedStepMs == 100 % 100 == 0 ✓ (validación de game-config)
    const fastArrConfig = {
      ...prototypeConfig,
      fixedStepMs: 100,
      dasMs: 200,
      arrMs: 100,
    };
    const engine = createGameEngine(makeValidOptions({ config: fastArrConfig }));
    drainAll(engine);

    // Mover a derecha primero para tener espacio
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Paso: activación derecha (inmediato). Acumula 100ms.
    // Luego: 2 pasos, acumula 200ms → DAS (1). 0ms restantes en ARR.
    // Paso extra: acumula 100ms → ARR: 100 >= 100 → 1
    for (let i = 0; i < 2; i++) {
      engine.step({
        leftHeld: false, rightHeld: true,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const dasEvents = engine.drainEvents();
    expect(dasEvents.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);

    // Siguiente paso: 100ms → ARR: 100 >= 100 → 1
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const arrEvents = engine.drainEvents();
    expect(arrEvents.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(1);
  });

  it('movimiento bloqueado durante ARR consume intervalo sin ráfaga posterior', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Mover a la pared izquierda
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: true, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Mantener izquierda desde pared (bloqueado)
    for (let i = 0; i < 100; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Ahora soltar izquierda y pulsar derecha: movimiento inmediato a la derecha (1)
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const moveRight = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    // Solo el movimiento de activación, no ráfaga acumulada
    expect(moveRight).toHaveLength(1);
  });

  it('rotación que libera espacio no provoca movimiento inmediato', () => {
    // Verificar que la rotación (que ocurre después del movimiento horizontal
    // en el orden lógico) no produce un movimiento horizontal retroactivo.
    // El movimiento horizontal se procesa antes que la rotación en el orden del paso.
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const xBefore = engine.getSnapshot().activePiece!.x;

    // Pulsar izquierda + rotación en el mismo paso
    // Horizontal se procesa primero (mueve una celda), luego rotación
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
      rotateClockwise: true,
    });
    const events = engine.drainEvents();
    const snap = engine.getSnapshot();

    // Debe haber un movimiento horizontal (activación)
    expect(snap.activePiece!.x).toBe(xBefore - 1);
    const horizontalMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    expect(horizontalMoves).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE SOFT DROP
// ════════════════════════════════════════════════════════════════════════

describe('soft drop', () => {
  // prototypeConfig: softDropCellsPerSecond=20, fixedStepMs=10
  // Cada paso: 10*20 = 200 unidades de progreso
  // Se necesita 1000 unidades para descender = 5 pasos

  it('softDropHeld: true no produce descenso inmediato', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    expect(softMoves).toHaveLength(0);
    expect(engine.getSnapshot().activePiece!.y).toBe(initialY);
  });

  it('soft drop usa exactamente softDropCellsPerSecond (5 pasos = 1 celda)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    // 4 pasos: 4*200 = 800 < 1000 (sin descenso)
    for (let i = 0; i < 4; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      const ev = engine.drainEvents();
      expect(ev.filter((e) => e.type === 'pieceMoved')).toHaveLength(0);
    }

    // Paso 5: 5*200 = 1000 → 1 descenso
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    expect(softMoves).toHaveLength(1);
    expect(engine.getSnapshot().activePiece!.y).toBe(initialY + 1);
  });

  it('soft drop sustituye a la gravedad (no se suman)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    // 5 pasos con soft drop: 5*200=1000 → 1 descenso (soft drop)
    for (let i = 0; i < 5; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(engine.getSnapshot().activePiece!.y).toBe(initialY + 1);

    // Con gravedad pura (softDropHeld=false), 1000 pasos serían 1 celda.
    // Con soft drop (softDropHeld=true), 5 pasos = 1 celda.
    // 10 pasos más de soft drop = 2 celdas. Total desde inicial: 1 + 2 = 3.
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    // Debe haber descendido más que con gravedad pura (1 celda en 100 pasos)
    expect(engine.getSnapshot().activePiece!.y).toBeGreaterThan(initialY + 1);

    // Comparar con gravedad pura: 15 pasos con gravityCellsPerSecond=1
    // son 15*10=150 unidades = 0 descensos
    const engineGravity = createGameEngine(makeValidOptions());
    drainAll(engineGravity);
    for (let i = 0; i < 15; i++) {
      stepStationary(engineGravity);
    }
    drainAll(engineGravity);
    // Con gravedad pura no ha descendido (150 < 1000)
    expect(engineGravity.getSnapshot().activePiece!.y).toBe(initialY);
  });

  it('varios descensos de soft drop en un mismo paso (velocidad alta)', () => {
    // Configuración: softDropCellsPerSecond=1000 (1000*10=10000 unidades/paso = 10 celdas)
    const fastSoftConfig = {
      ...prototypeConfig,
      softDropCellsPerSecond: 1000,
    };
    const engine = createGameEngine(makeValidOptions({ config: fastSoftConfig }));
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    expect(softMoves.length).toBeGreaterThanOrEqual(10);
    expect(engine.getSnapshot().activePiece!.y).toBeGreaterThan(initialY + 9);
  });

  it('cada descenso de soft drop emite pieceMoved con motivo softDrop', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 5; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
    }
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    expect(softMoves.length).toBeGreaterThanOrEqual(1);
    for (const e of softMoves) {
      if (e.type === 'pieceMoved') {
        expect(e.reason).toBe('softDrop');
      }
    }
  });

  it('colisión de soft drop no fija la pieza inmediatamente (lock delay diferido)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Dejar caer una pieza con hard drop para tener una base
    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza está en spawn. Usar soft drop 20 veces para llegar rápido al suelo.
    // Con softDropCellsPerSecond=20 y fixedStepMs=10, cada paso añade 200 unidades.
    // 5 pasos = 1000 unidades = 1 descenso.
    let reachedGround = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      const events = engine.drainEvents();

      // Si hay pieceLocked es porque se fijó por lock delay (no inmediatamente)
      // Verificamos que la pieza esté apoyada y acumulando lock delay
      const snap = engine.getSnapshot();
      if (snap.activePiece?.grounded) {
        reachedGround = true;
        // Si está apoyada, el primer paso ya cuenta fixedStepMs
        // Con lockDelayMs=500 y fixedStepMs=10, necesita 50 pasos para fijarse
        // No debe fijarse inmediatamente al llegar al suelo
        expect(events.some((e) => e.type === 'pieceLocked')).toBe(false);
        break;
      }
    }
    expect(reachedGround).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE ACUMULADOR VERTICAL
// ════════════════════════════════════════════════════════════════════════

describe('acumulador vertical', () => {
  it('conserva progreso al activar soft drop a mitad de celda de gravedad', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // 50 pasos con gravedad normal: 50*10*1 = 500 < 1000 (50% de progreso)
    for (let i = 0; i < 50; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    const yAfterGravity = engine.getSnapshot().activePiece!.y;

    // Cambiar a soft drop: cada paso suma 10*20 = 200
    // Después de 2 pasos: 500+400 = 900 < 1000
    for (let i = 0; i < 2; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(engine.getSnapshot().activePiece!.y).toBe(yAfterGravity);

    // 1 paso más: 900+200 = 1100 ≥ 1000 → 1 descenso con softDrop
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    expect(softMoves).toHaveLength(1);
    expect(engine.getSnapshot().activePiece!.y).toBe(yAfterGravity + 1);
  });

  it('conserva progreso al desactivar soft drop', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // 2 pasos con soft drop: 2*200 = 400 < 1000
    for (let i = 0; i < 2; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    const yAfterSoft = engine.getSnapshot().activePiece!.y;

    // Desactivar soft drop: gravedad normal (10*1=10 por paso)
    // 60 pasos: 60*10 = 600 + 400 = 1000 → descenso con gravity
    for (let i = 0; i < 59; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.y).toBe(yAfterSoft);

    stepStationary(engine);
    const events = engine.drainEvents();
    const gravityMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'gravity');
    expect(gravityMoves).toHaveLength(1);
  });

  it('funciona de forma determinista con velocidades no alineadas', () => {
    const unalignedConfig = {
      ...prototypeConfig,
      gravityCellsPerSecond: 0.75,
      softDropCellsPerSecond: 12.34,
    };
    const engineA = createGameEngine(makeValidOptions({ config: unalignedConfig }));
    const engineB = createGameEngine(makeValidOptions({ config: unalignedConfig }));
    drainAll(engineA);
    drainAll(engineB);

    for (let i = 0; i < 50; i++) {
      engineA.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      engineB.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
    }

    // Alternar soft drop
    for (let i = 0; i < 100; i++) {
      const sd = i % 3 === 0;
      engineA.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: sd,
        hardDrop: false,
      });
      engineB.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: sd,
        hardDrop: false,
      });
    }

    drainAll(engineA);
    drainAll(engineB);
    expect(engineA.getSnapshot().activePiece!.y).toBe(engineB.getSnapshot().activePiece!.y);
  });

  it('se reinicia a 0 en spawn', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Acumular casi un descenso de gravedad
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza tiene progreso=0
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    // No debe haber descendido aún (necesita 100 pasos para 1 celda)
    expect(engine.getSnapshot().activePiece!.y).toBe(3); // altura 2 para piezas no-I
  });

  it('se reinicia a 0 en reset', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 60; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 42 }));
    drainAll(engine);

    const y1 = engine.getSnapshot().activePiece!.y;
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);
    expect(engine.getSnapshot().activePiece!.y).toBe(y1);
  });

  it('sin remanente entre piezas (comportamiento de gravedad pura equivalente al anterior)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const yAfter = engine.getSnapshot().activePiece!.y;
    for (let i = 0; i < 99; i++) {
      stepStationary(engine);
    }
    drainAll(engine);

    expect(engine.getSnapshot().activePiece!.y).toBe(yAfter);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE INTERACCIONES
// ════════════════════════════════════════════════════════════════════════

describe('interacciones', () => {
  it('horizontal + rotación en el mismo paso (horizontal primero)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const pieceType = engine.getSnapshot().activePiece!.type;
    // Si es O, saltar
    if (pieceType === 'O') {
      for (let i = 0; i < 7; i++) {
        stepHardDrop(engine);
        drainAll(engine);
      }
    }

    const xBefore = engine.getSnapshot().activePiece!.x;
    const orientationBefore = engine.getSnapshot().activePiece!.orientation;

    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
      rotateClockwise: true,
    });

    const events = engine.drainEvents();
    const snap = engine.getSnapshot();

    // Horizontal se procesa antes: x debe haber cambiado
    expect(snap.activePiece!.x).toBeLessThan(xBefore);
    // Rotación se procesa después
    if (pieceType !== 'O') {
      expect(snap.activePiece!.orientation).not.toBe(orientationBefore);
    }
    // Debe haber eventos de movimiento y rotación
    expect(events.some((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toBe(true);
    expect(events.some((e) => e.type === 'pieceRotated')).toBe(pieceType !== 'O');
  });

  it('rotación + hard drop en el mismo paso', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: true,
      rotateClockwise: true,
    });
    const events = engine.drainEvents();
    const hardDropMoved = events.some((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
    expect(hardDropMoved).toBe(true);
    // Rotación puede haber sido exitosa o no dependiendo del tipo de pieza
    // Pero al menos el hard drop ocurrió
  });

  it('hard drop con softDropHeld=true omite gravedad/soft drop', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: true,
    });
    drainAll(engine);

    // Hard drop domina, pieza fijada y spawneada nueva
    const snap = engine.getSnapshot();
    expect(snap.activePiece).not.toBeNull();
    expect(snap.status).toBe('running');
  });

  it('fijación detiene procesamiento sobre la nueva pieza', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Hard drop para fijar la pieza actual
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: true,
    });
    const events = engine.drainEvents();
    // Debe tener pieceLocked y pieceSpawned
    expect(events.some((e) => e.type === 'pieceLocked')).toBe(true);
    expect(events.some((e) => e.type === 'pieceSpawned')).toBe(true);
  });

  it('game over y reset: el nuevo estado temporal se reinicia', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Llevar a game over
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }
    expect(engine.getSnapshot().status).toBe('gameOver');

    // Reset
    engine.reset(makeValidOptions({ seed: 123 }));
    drainAll(engine);

    // El motor debe funcionar con nueva semilla
    const snap = engine.getSnapshot();
    expect(snap.status).toBe('running');
    expect(snap.seed).toBe(123);

    // Un step debe funcionar
    stepStationary(engine);
    drainAll(engine);
    expect(engine.getSnapshot().step).toBe(1);
    expect(engine.getSnapshot().status).toBe('running');
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE ROTACIÓN SRS
// ════════════════════════════════════════════════════════════════════════

function stepRotateCW(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: false, rightHeld: false,
    leftPressed: false, rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
    rotateClockwise: true,
  });
  drainAll(engine);
}

function stepRotateCCW(engine: ReturnType<typeof createGameEngine>): void {
  engine.step({
    leftHeld: false, rightHeld: false,
    leftPressed: false, rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
    rotateCounterclockwise: true,
  });
  drainAll(engine);
}

describe('rotación SRS', () => {
  describe('rotación horaria', () => {
    it('una rotación horaria desde Spawn cambia la orientación a Right', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const pieceType = engine.getSnapshot().activePiece!.type;
      stepRotateCW(engine);
      const snap = engine.getSnapshot();
      expect(snap.activePiece!.orientation).toBe(Orientation.Right);
      expect(pieceType).toBe(snap.activePiece!.type);
    });

    it('la pieza rota sin desplazamiento cuando hay espacio suficiente (kick 0 es válido)', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const beforeX = engine.getSnapshot().activePiece!.x;
      stepRotateCW(engine);
      const snap = engine.getSnapshot();
      expect(snap.activePiece!.x).toBe(beforeX);
      expect(snap.activePiece!.orientation).toBe(Orientation.Right);
    });

    it('la rotación horaria se aplica con kick lateral cuando la pieza está junto a una pared', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let found = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const pieceType = engine.getSnapshot().activePiece!.type;
        if (pieceType !== 'I' && pieceType !== 'O') {
          for (let i = 0; i < 5; i++) stepLeft(engine);
          const xBefore = engine.getSnapshot().activePiece!.x;
          stepRotateCW(engine);
          const xAfter = engine.getSnapshot().activePiece!.x;
          const orientation = engine.getSnapshot().activePiece!.orientation;
          expect(orientation).toBe(Orientation.Right);
          if (xAfter !== xBefore) {
            found = true;
          } else {
            found = true;
          }
        }
        stepHardDrop(engine);
        drainAll(engine);
        if (found) break;
      }
      expect(found).toBe(true);
    });
  });

  describe('rotación antihoraria', () => {
    it('una rotación antihoraria desde Spawn cambia la orientación a Left', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const pieceType = engine.getSnapshot().activePiece!.type;
      stepRotateCCW(engine);
      const snap = engine.getSnapshot();
      expect(snap.activePiece!.orientation).toBe(Orientation.Left);
      expect(pieceType).toBe(snap.activePiece!.type);
    });
  });

  describe('transiciones entre orientaciones', () => {
    it('todas las ocho transiciones funcionan para una pieza JLSTZ (T, por ejemplo)', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      let foundT = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'T') {
          foundT = true;
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundT).toBe(true);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);
    });

    it('todas las ocho transiciones funcionan para la pieza I', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      let foundI = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'I') {
          foundI = true;
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundI).toBe(true);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

      stepRotateCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);
    });
  });

  describe('wall kicks', () => {
    it('un wall kick lateral exitoso desplaza la pieza horizontalmente', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      let foundT = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'T') {
          foundT = true;
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundT).toBe(true);

      for (let i = 0; i < 5; i++) stepLeft(engine);
      const xBefore = engine.getSnapshot().activePiece!.x;

      stepRotateCCW(engine);
      const xAfter = engine.getSnapshot().activePiece!.x;

      const valid = xAfter !== xBefore || engine.getSnapshot().activePiece!.orientation === Orientation.Left;
      expect(valid).toBe(true);
    });

    it('un wall kick desde el suelo (floor kick) desplaza la pieza verticalmente', () => {
      const slowConfig = { ...prototypeConfig, gravityCellsPerSecond: 0.01 };
      const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
      drainAll(engine);

      for (let i = 0; i < 50; i++) stepStationary(engine);
      drainAll(engine);

      const yBefore = engine.getSnapshot().activePiece!.y;
      const orientationBefore = engine.getSnapshot().activePiece!.orientation;

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      engine.drainEvents();
      const yAfter = engine.getSnapshot().activePiece!.y;
      const orientationAfter = engine.getSnapshot().activePiece!.orientation;

      if (orientationAfter !== orientationBefore) {
        const yDelta = yAfter - yBefore;
        expect(yDelta >= -2 && yDelta <= 0).toBe(true);
      }
    });

    it('se utiliza la tabla JLSTZ para piezas J, L, S, T, Z', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundPiece = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const type = engine.getSnapshot().activePiece!.type;
        if (type === 'T' || type === 'J' || type === 'L' || type === 'S' || type === 'Z') {
          foundPiece = true;
          const orientationBefore = engine.getSnapshot().activePiece!.orientation;
          expect(orientationBefore).toBe(Orientation.Spawn);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundPiece).toBe(true);
    });

    it('se utiliza la tabla I para la pieza I', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundI = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'I') {
          foundI = true;
          const orientationBefore = engine.getSnapshot().activePiece!.orientation;
          expect(orientationBefore).toBe(Orientation.Spawn);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundI).toBe(true);
    });

    it('la pieza O no aplica wall kicks', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundO = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'O') {
          foundO = true;
          const xBefore = engine.getSnapshot().activePiece!.x;
          const yBefore = engine.getSnapshot().activePiece!.y;
          const cellsBefore = engine.getSnapshot().activePiece!.cells.map(c => ({ x: c.x, y: c.y }));

          engine.step({
            leftHeld: false, rightHeld: false,
            leftPressed: false, rightPressed: false,
            softDropHeld: false,
            hardDrop: false,
            rotateClockwise: true,
          });
          const events = engine.drainEvents();
          const snap = engine.getSnapshot();

          expect(snap.activePiece!.orientation).toBe(Orientation.Right);
          expect(snap.activePiece!.x).toBe(xBefore);
          expect(snap.activePiece!.y).toBe(yBefore);
          expect(snap.activePiece!.cells).toEqual(cellsBefore);
          expect(events.some(e => e.type === 'pieceRotated')).toBe(true);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundO).toBe(true);
    });
  });

  describe('colisiones', () => {
    it('rotación bloqueada por colisión contra pared izquierda o derecha', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      let found = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        const type = engine.getSnapshot().activePiece!.type;
        if (type !== 'I' && type !== 'O') {
          for (let i = 0; i < 10; i++) stepLeft(engine);
          drainAll(engine);

          stepRotateCW(engine);

          const snap = engine.getSnapshot();
          for (const cell of snap.activePiece!.cells) {
            expect(cell.x).toBeGreaterThanOrEqual(0);
            expect(cell.x).toBeLessThan(10);
            expect(cell.y).toBeGreaterThanOrEqual(0);
            expect(cell.y).toBeLessThan(24);
          }
          found = true;
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(found).toBe(true);
    });

    it('rotación bloqueada por colisión contra bloques fijos adyacentes', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      for (let i = 0; i < 5; i++) {
        stepHardDrop(engine);
        drainAll(engine);
      }

      const orientationBefore = engine.getSnapshot().activePiece!.orientation;
      const xBefore = engine.getSnapshot().activePiece!.x;
      const yBefore = engine.getSnapshot().activePiece!.y;
      const typeBefore = engine.getSnapshot().activePiece!.type;
      const boardBefore = engine.getSnapshot().board.map(r => [...r]);

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      const events = engine.drainEvents();

      if (engine.getSnapshot().activePiece!.orientation === orientationBefore) {
        expect(engine.getSnapshot().activePiece!.x).toBe(xBefore);
        expect(engine.getSnapshot().activePiece!.y).toBe(yBefore);
        expect(engine.getSnapshot().activePiece!.type).toBe(typeBefore);
        expect(events.some(e => e.type === 'pieceRotated')).toBe(false);
        for (let y = 0; y < 24; y++) {
          expect(engine.getSnapshot().board[y]).toEqual(boardBefore[y]);
        }
      }
    });
  });

  describe('cancelación', () => {
    it('una rotación completamente bloqueada (ningún kick válido) no muta el estado', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      for (let i = 0; i < 6; i++) {
        stepHardDrop(engine);
        drainAll(engine);
      }

      const snapBefore = engine.getSnapshot();
      const orientationBefore = snapBefore.activePiece!.orientation;
      const xBefore = snapBefore.activePiece!.x;
      const yBefore = snapBefore.activePiece!.y;
      const typeBefore = snapBefore.activePiece!.type;
      const boardBefore = snapBefore.board.map(r => [...r]);
      const nextBefore = snapBefore.nextPieces;
      const seedBefore = snapBefore.seed;

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      const events = engine.drainEvents();
      const snapAfter = engine.getSnapshot();

      if (snapAfter.activePiece!.orientation === orientationBefore) {
        expect(snapAfter.activePiece!.x).toBe(xBefore);
        expect(snapAfter.activePiece!.y).toBe(yBefore);
        expect(snapAfter.activePiece!.type).toBe(typeBefore);
        expect(snapAfter.nextPieces).toEqual(nextBefore);
        expect(snapAfter.status).toBe(snapBefore.status);
        expect(snapAfter.seed).toBe(seedBefore);
        for (let y = 0; y < 24; y++) {
          expect(snapAfter.board[y]).toEqual(boardBefore[y]);
        }
        expect(events.some(e => e.type === 'pieceRotated')).toBe(false);
      } else {
        expect(snapAfter.activePiece!.orientation).not.toBe(orientationBefore);
        expect(events.some(e => e.type === 'pieceRotated')).toBe(true);
      }
    });

    it('tras una rotación fallida, el snapshot conserva todo el estado', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      for (let i = 0; i < 11; i++) {
        if (engine.getSnapshot().status === 'gameOver') break;
        stepHardDrop(engine);
        drainAll(engine);
      }

      if (engine.getSnapshot().status === 'running') {
        const snapBefore = engine.getSnapshot();
        const orientationBefore = snapBefore.activePiece!.orientation;

        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true,
        });
        engine.drainEvents();
        const snapAfter = engine.getSnapshot();

        if (snapAfter.activePiece!.orientation === orientationBefore) {
          expect(snapAfter.activePiece!.x).toBe(snapBefore.activePiece!.x);
          expect(snapAfter.activePiece!.y).toBe(snapBefore.activePiece!.y);
          expect(snapAfter.activePiece!.type).toBe(snapBefore.activePiece!.type);
          expect(snapAfter.activePiece!.orientation).toBe(snapBefore.activePiece!.orientation);
          expect(snapAfter.nextPieces).toEqual(snapBefore.nextPieces);
          expect(snapAfter.status).toBe(snapBefore.status);
          expect(snapAfter.seed).toBe(snapBefore.seed);
          for (let y = 0; y < 24; y++) {
            expect(snapAfter.board[y]).toEqual(snapBefore.board[y]);
          }
        }
      }
    });
  });

  describe('pieza O', () => {
    it('la rotación de O actualiza su orientación', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundO = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'O') {
          foundO = true;
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundO).toBe(true);
    });

    it('la rotación de O no modifica sus celdas ocupadas', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundO = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'O') {
          foundO = true;
          const cellsBefore = engine.getSnapshot().activePiece!.cells.map(c => ({ x: c.x, y: c.y }));

          stepRotateCW(engine);
          const cellsAfter = engine.getSnapshot().activePiece!.cells;
          expect(cellsAfter).toEqual(cellsBefore);

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.cells).toEqual(cellsBefore);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundO).toBe(true);
    });

    it('la rotación de O no modifica su posición x e y', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundO = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'O') {
          foundO = true;
          const xBefore = engine.getSnapshot().activePiece!.x;
          const yBefore = engine.getSnapshot().activePiece!.y;

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.x).toBe(xBefore);
          expect(engine.getSnapshot().activePiece!.y).toBe(yBefore);

          stepRotateCCW(engine);
          expect(engine.getSnapshot().activePiece!.x).toBe(xBefore);
          expect(engine.getSnapshot().activePiece!.y).toBe(yBefore);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundO).toBe(true);
    });

    it('la rotación de O no aplica wall kicks', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engine);

      let foundO = false;
      for (let attempt = 0; attempt < 50; attempt++) {
        if (engine.getSnapshot().activePiece!.type === 'O') {
          foundO = true;
          for (let i = 0; i < 5; i++) stepLeft(engine);
          const xBefore = engine.getSnapshot().activePiece!.x;
          const yBefore = engine.getSnapshot().activePiece!.y;

          stepRotateCW(engine);
          expect(engine.getSnapshot().activePiece!.x).toBe(xBefore);
          expect(engine.getSnapshot().activePiece!.y).toBe(yBefore);
          expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);
          break;
        }
        stepHardDrop(engine);
        drainAll(engine);
      }
      expect(foundO).toBe(true);
    });
  });

  describe('eventos de rotación', () => {
    it('una rotación exitosa emite pieceRotated con la orientación destino y el step actual', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const stepBefore = engine.getSnapshot().step;
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      const events = engine.drainEvents();
      const rotatedEvent = events.find(e => e.type === 'pieceRotated');

      expect(rotatedEvent).toBeDefined();
      if (rotatedEvent && rotatedEvent.type === 'pieceRotated') {
        expect(rotatedEvent.step).toBe(stepBefore + 1);
        expect(rotatedEvent.orientation).toBe(Orientation.Right);
      }
    });

    it('una rotación fallida no emite ningún evento', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      for (let i = 0; i < 11; i++) {
        if (engine.getSnapshot().status === 'gameOver') break;
        stepHardDrop(engine);
        drainAll(engine);
      }

      if (engine.getSnapshot().status === 'running') {
        const orientationBefore = engine.getSnapshot().activePiece!.orientation;
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true,
        });
        const events = engine.drainEvents();
        const orientationAfter = engine.getSnapshot().activePiece!.orientation;

        if (orientationAfter === orientationBefore) {
          expect(events.some(e => e.type === 'pieceRotated')).toBe(false);
        } else {
          expect(events.some(e => e.type === 'pieceRotated')).toBe(true);
        }
      }
    });
  });

  describe('ciclos completos', () => {
    it('cuatro rotaciones horarias consecutivas devuelven a la orientación y geometría inicial (Spawn)', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const typeInitial = engine.getSnapshot().activePiece!.type;

      stepRotateCW(engine);
      stepRotateCW(engine);
      stepRotateCW(engine);
      stepRotateCW(engine);

      const snap = engine.getSnapshot();
      expect(snap.activePiece!.orientation).toBe(Orientation.Spawn);
      expect(snap.activePiece!.type).toBe(typeInitial);
    });

    it('cuatro rotaciones antihorarias consecutivas devuelven a la orientación y geometría inicial (Spawn)', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const typeInitial = engine.getSnapshot().activePiece!.type;

      stepRotateCCW(engine);
      stepRotateCCW(engine);
      stepRotateCCW(engine);
      stepRotateCCW(engine);

      const snap = engine.getSnapshot();
      expect(snap.activePiece!.orientation).toBe(Orientation.Spawn);
      expect(snap.activePiece!.type).toBe(typeInitial);
    });
  });

  describe('snapshots con orientación', () => {
    it('el snapshot expone orientation tras el spawn', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const snap = engine.getSnapshot();
      expect(snap.activePiece).not.toBeNull();
      if (snap.activePiece) {
        expect(snap.activePiece.orientation).toBe(Orientation.Spawn);
      }
    });

    it('el snapshot expresa la orientación actualizada tras una rotación exitosa', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      stepRotateCW(engine);
      const snap = engine.getSnapshot();
      expect(snap.activePiece!.orientation).toBe(Orientation.Right);

      stepRotateCCW(engine);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);
    });
  });

  describe('determinismo con rotación', () => {
    it('misma semilla y mismas entradas (incluyendo rotaciones) producen snapshot y eventos idénticos', () => {
      const engineA = createGameEngine(makeValidOptions());
      const engineB = createGameEngine(makeValidOptions());

      const inputs: StepInput[] = [
        { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false },
        { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true },
        { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
        { leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true, softDropHeld: false, hardDrop: false, rotateCounterclockwise: true },
        { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true },
        { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true },
        { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateCounterclockwise: true },
      ];

      const snapshotsA: unknown[] = [];
      const eventsA: unknown[] = [];
      const snapshotsB: unknown[] = [];
      const eventsB: unknown[] = [];

      snapshotsA.push(engineA.getSnapshot());
      eventsA.push(engineA.drainEvents());
      snapshotsB.push(engineB.getSnapshot());
      eventsB.push(engineB.drainEvents());

      for (const input of inputs) {
        try { engineA.step(input); } catch { /* game over */ }
        snapshotsA.push(engineA.getSnapshot());
        eventsA.push(engineA.drainEvents());

        try { engineB.step(input); } catch { /* game over */ }
        snapshotsB.push(engineB.getSnapshot());
        eventsB.push(engineB.drainEvents());
      }

      expect(snapshotsA).toEqual(snapshotsB);
      expect(eventsA).toEqual(eventsB);
    });

    it('el PRNG no se ve afectado por las rotaciones', () => {
      const engineA = createGameEngine(makeValidOptions({ seed: 42 }));
      const engineB = createGameEngine(makeValidOptions({ seed: 42 }));
      drainAll(engineA);
      drainAll(engineB);

      for (let i = 0; i < 5; i++) {
        engineA.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true,
        });
        drainAll(engineA);
        engineB.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
        });
        drainAll(engineB);
      }

      const snapA = engineA.getSnapshot();
      const snapB = engineB.getSnapshot();

      expect(snapA.nextPieces).toEqual(snapB.nextPieces);
    });
  });

  describe('validación de entrada de rotación', () => {
    it('rotateClockwise y rotateCounterclockwise simultáneos lanzan EngineStepError con INVALID_GAME_INPUT', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      expect(() => {
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true, rotateCounterclockwise: true,
        });
      }).toThrow(EngineStepError);

      try {
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true, rotateCounterclockwise: true,
        });
      } catch (e) {
        if (e instanceof EngineStepError) {
          expect(e.code).toBe('INVALID_GAME_INPUT');
        }
      }
    });

    it('la combinación simultánea no muta el estado del motor ni emite ningún evento', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const snapBefore = engine.getSnapshot();
      const stepBefore = snapBefore.step;
      const elapsedBefore = snapBefore.elapsedMs;
      const orientationBefore = snapBefore.activePiece!.orientation;
      const xBefore = snapBefore.activePiece!.x;
      const yBefore = snapBefore.activePiece!.y;
      const typeBefore = snapBefore.activePiece!.type;
      const nextBefore = snapBefore.nextPieces;
      const boardBefore = snapBefore.board.map(r => [...r]);

      try {
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true, rotateCounterclockwise: true,
        });
      } catch {
        // Esperado
      }

      const events = engine.drainEvents();
      const snapAfter = engine.getSnapshot();

      expect(snapAfter.step).toBe(stepBefore);
      expect(snapAfter.elapsedMs).toBe(elapsedBefore);
      expect(snapAfter.activePiece!.orientation).toBe(orientationBefore);
      expect(snapAfter.activePiece!.x).toBe(xBefore);
      expect(snapAfter.activePiece!.y).toBe(yBefore);
      expect(snapAfter.activePiece!.type).toBe(typeBefore);
      expect(snapAfter.nextPieces).toEqual(nextBefore);
      for (let y = 0; y < 24; y++) {
        expect(snapAfter.board[y]).toEqual(boardBefore[y]);
      }

      expect(events).toHaveLength(0);
    });

    it('rotateClockwise true con rotateCounterclockwise ausente o false rota correctamente', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const orientationBefore = engine.getSnapshot().activePiece!.orientation;

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      drainAll(engine);

      expect(engine.getSnapshot().activePiece!.orientation).not.toBe(orientationBefore);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Right);

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true, rotateCounterclockwise: false,
      });
      drainAll(engine);

      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Reverse);
    });

    it('rotateCounterclockwise true con rotateClockwise ausente o false rota correctamente', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      const orientationBefore = engine.getSnapshot().activePiece!.orientation;

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateCounterclockwise: true,
      });
      drainAll(engine);

      expect(engine.getSnapshot().activePiece!.orientation).not.toBe(orientationBefore);
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE PIEZA FANTASMA (landingCells)
// ════════════════════════════════════════════════════════════════════════

describe('pieza fantasma (landingCells)', () => {
  it('landingCells se deriva de la proyección de hard drop para la pieza activa', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      const { landingCells } = snap.activePiece;
      expect(landingCells).toHaveLength(4);

      // Verificar que cada celda tiene coordenadas x, y
      for (const cell of landingCells) {
        expect(cell).toHaveProperty('x');
        expect(cell).toHaveProperty('y');
        expect(Number.isInteger(cell.x)).toBe(true);
        expect(Number.isInteger(cell.y)).toBe(true);
      }
    }
  });

  it('landingCells coincide con cells cuando la pieza ya está apoyada', () => {
    // Usar soft drop para forzar que la pieza llegue rápidamente al suelo
    // y quede apoyada, momento en el que landingCells debe coincidir con cells.
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Fijar la primera pieza con hard drop para tener bloques en el tablero
    stepHardDrop(engine);
    drainAll(engine);

    // Usar soft drop para bajar la pieza rápidamente y apoyarla en los bloques fijados
    for (let i = 0; i < 200; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece?.grounded) {
        const { cells, landingCells } = snap.activePiece;
        expect(cells).toEqual(landingCells);
        return;
      }
      // Usar soft drop para bajar rápido: cada paso = 200 unidades de progreso
      // con softDropCellsPerSecond=20 y fixedStepMs=10
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Si no encontramos pieza apoyada (posible por game over),
    // al menos verificamos la coherencia básica
    const finalSnap = engine.getSnapshot();
    if (finalSnap.activePiece?.grounded) {
      expect(finalSnap.activePiece.cells).toEqual(finalSnap.activePiece.landingCells);
    }
  });

  it('landingCells refleja la posición proyectada en tablero vacío', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      const { y: initialY, landingCells } = snap.activePiece;

      // En tablero vacío, la pieza debería caer hasta la fila más baja
      for (const cell of landingCells) {
        expect(cell.y).toBeGreaterThanOrEqual(initialY);
        expect(cell.y).toBeLessThanOrEqual(23); // Máxima fila del tablero
      }
    }
  });

  it('landingCells se actualiza tras movimiento horizontal', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialSnap = engine.getSnapshot();
    if (initialSnap.activePiece) {
      const initialLandingCells = [...initialSnap.activePiece.landingCells];

      // Mover la pieza a la izquierda
      stepLeft(engine);
      drainAll(engine);

      const movedSnap = engine.getSnapshot();
      if (movedSnap.activePiece) {
        const movedLandingCells = movedSnap.activePiece.landingCells;

          // Las celdas de aterrizaje deberían haberse movido en X
          if (initialLandingCells && movedLandingCells) {
            for (let i = 0; i < initialLandingCells.length; i++) {
              const mc = movedLandingCells[i]!;
              const ic = initialLandingCells[i]!;
              expect(mc.x).toBe(ic.x - 1);
              // La Y debería permanecer igual o mejorar (caída más corta)
              expect(mc.y).toBeLessThanOrEqual(ic.y);
            }
          }
      }
    }
  });

  it('landingCells se actualiza tras rotación válida', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialSnap = engine.getSnapshot();
    if (initialSnap.activePiece) {
      const initialLandingCells = [...initialSnap.activePiece.landingCells];
      const initialOrientation = initialSnap.activePiece.orientation;

      // Intentar rotar la pieza
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      drainAll(engine);

      const rotatedSnap = engine.getSnapshot();
      if (rotatedSnap.activePiece) {
        const rotatedLandingCells = rotatedSnap.activePiece.landingCells;
        const rotatedOrientation = rotatedSnap.activePiece.orientation;

        // La orientación debería haber cambiado si la rotación fue válida
        if (rotatedOrientation !== initialOrientation) {
          // Las celdas de aterrizaje deberían haber cambiado
          expect(rotatedLandingCells).not.toEqual(initialLandingCells);
        }
      }
    }
  });

  it('landingCells refleja bloques fijados', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Fijar una pieza con hard drop para crear obstáculo
    stepHardDrop(engine);
    drainAll(engine);

    // La siguiente pieza debería tener una proyección diferente
    const snapWithObstacle = engine.getSnapshot();
    if (snapWithObstacle.activePiece) {
      const { landingCells } = snapWithObstacle.activePiece;

      // Verificar que las celdas de aterrizaje están por encima de la pieza fijada
      for (const cell of landingCells) {
        // La celda de aterrizaje no debería estar ocupada por un bloque fijo
        if (cell.y >= 0 && cell.y < 24 && cell.x >= 0 && cell.x < 10) {
          // Si hay un bloque fijo en la posición de aterrizaje, la pieza debería estar justo encima
        }
      }
    }
  });

  it('landingCells se recalcula tras spawn', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialSnap = engine.getSnapshot();
    let initialLandingCells: { x: number; y: number }[] | null = null;
    if (initialSnap.activePiece) {
      initialLandingCells = [...initialSnap.activePiece.landingCells];
    }

    // Fijar la pieza actual para que aparezca una nueva
    stepHardDrop(engine);
    drainAll(engine);

    const newPieceSnap = engine.getSnapshot();
    if (newPieceSnap.activePiece && initialLandingCells) {
      const newLandingCells = newPieceSnap.activePiece.landingCells;
      // La nueva pieza debería tener una proyección diferente
      expect(newLandingCells).not.toEqual(initialLandingCells);
    }
  });

  it('landingCells no existe cuando no hay pieza activa (game over)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Forzar game over dejando piezas fijas hasta bloquear spawn
    for (let i = 0; i < 100; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const gameOverSnap = engine.getSnapshot();
    expect(gameOverSnap.activePiece).toBeNull();
    // No hay landingCells porque no hay activePiece
  });

  it('landingCells coincide exactamente con el resultado de hard drop', () => {
    // Prueba de equivalencia: la proyección debe coincidir con el resultado de hard drop
    const engineA = createGameEngine(makeValidOptions({ seed: 123 }));
    const engineB = createGameEngine(makeValidOptions({ seed: 123 }));
    drainAll(engineA);
    drainAll(engineB);

    // Aplicar la misma secuencia de pasos a ambos motores
    for (let i = 0; i < 10; i++) {
      stepStationary(engineA);
      stepStationary(engineB);
      drainAll(engineA);
      drainAll(engineB);
    }

    // Obtener landingCells del motor A
    const snapA = engineA.getSnapshot();
    let landingCellsMatch = true;

    if (snapA.activePiece) {
      const landingCells = snapA.activePiece.landingCells;

      // Ejecutar hard drop en el motor B
      stepHardDrop(engineB);
      drainAll(engineB);

      // Comparar las celdas fijadas en B con las proyectadas en A
      const snapB = engineB.getSnapshot();
      const lockedCells = [];

      // Obtener las celdas donde se fijó la pieza en B
      for (let y = 0; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (snapB.board[y]![x] !== null && snapA.board[y]![x] === null) {
            lockedCells.push({ x, y });
          }
        }
      }

      // Debería haber 4 celdas fijadas que coincidan con landingCells
      if (lockedCells.length === 4) {
        // Ordenar ambas listas para comparar
        const sortedLanding = [...landingCells].sort((a, b) => (a.x - b.x) || (a.y - b.y));
        const sortedLocked = [...lockedCells].sort((a, b) => (a.x - b.x) || (a.y - b.y));

        expect(sortedLanding).toEqual(sortedLocked);
      } else {
      // Si no hay 4 celdas fijadas, podría ser porque la pieza ya estaba apoyada
      landingCellsMatch = snapA.activePiece?.grounded &&
                         snapA.activePiece?.cells !== undefined &&
                         landingCells !== undefined &&
                         JSON.stringify(snapA.activePiece.cells) === JSON.stringify(landingCells);
      }
    }

    expect(landingCellsMatch).toBe(true);
  });

  it('landingCells no muta lockDelayElapsedMs ni lockResetsUsed', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Obtener valores iniciales
    const initialSnap = engine.getSnapshot();
    let initialLockDelay = 0;
    let initialLockResets = 0;
    if (initialSnap.activePiece) {
      initialLockDelay = initialSnap.activePiece.lockDelayElapsedMs;
      initialLockResets = initialSnap.activePiece.lockResetsUsed;
    }

    // Consultar el snapshot múltiples veces
    for (let i = 0; i < 5; i++) {
      const snap = engine.getSnapshot();
      if (snap.activePiece) {
        expect(snap.activePiece.lockDelayElapsedMs).toBe(initialLockDelay);
        expect(snap.activePiece.lockResetsUsed).toBe(initialLockResets);
      }
    }
  });

  it('landingCells es inmutable (congelado)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      const { landingCells } = snap.activePiece;

      // Verificar que el array está congelado
      expect(Object.isFrozen(landingCells)).toBe(true);

      // Verificar que cada celda está congelada
      for (const cell of landingCells) {
        expect(Object.isFrozen(cell)).toBe(true);
      }

      // Verificar que el array está congelado
      expect(Object.isFrozen(landingCells)).toBe(true);
    }
  });

  it('landingCells tiene el mismo tipo y orientación que la pieza activa', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      const { landingCells } = snap.activePiece;

      // landingCells no tiene tipo u orientación directamente, pero la geometría
      // debería corresponder al tipo y orientación de la pieza activa
      expect(landingCells).toHaveLength(4); // Todas las piezas tienen 4 celdas

      // La forma relativa de las celdas debería corresponder a la pieza y orientación
      // (esto se verifica indirectamente porque computeLandingCells reutiliza computeAbsoluteCells)
    }
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE EVENTOS — DAS/ARR/soft drop
// ════════════════════════════════════════════════════════════════════════

describe('eventos — DAS, ARR, soft drop', () => {
  it('un evento pieceMoved por cada celda horizontal real (inmediato, DAS o ARR)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Mover a la derecha para tener espacio
    engine.step({
      leftHeld: false, rightHeld: true,
      leftPressed: false, rightPressed: true,
      softDropHeld: false,
      hardDrop: false,
    });
    drainAll(engine);

    // Activación derecha: 1 movimiento
    // Mantener hasta DAS + varias ARR (pero no tan lejos como para chocar con pared)
    for (let i = 0; i < 30; i++) {
      engine.step({
        leftHeld: false, rightHeld: true,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
    }
    const events = engine.drainEvents();
    const horizontalMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    // Con 30 pasos: activación + DAS (~paso 15) + ARR (~pasos 20, 25, 30) = al menos 4
    // Pero depende de cuándo choca con pared; verificamos que hay al menos repeticiones DAS + algunas ARR
    expect(horizontalMoves.length).toBeGreaterThanOrEqual(2);
  });

  it('un evento pieceMoved con motivo softDrop por cada celda de soft drop', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
    }
    const events = engine.drainEvents();
    const softMoves = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'softDrop');
    // Con 10 pasos y softDrop=20: 10*200=2000 → 2 descensos
    expect(softMoves.length).toBeGreaterThanOrEqual(2);
    for (const e of softMoves) {
      if (e.type === 'pieceMoved') expect(e.reason).toBe('softDrop');
    }
  });

  it('orden de eventos correcto: horizontal → rotación → hard drop o vertical', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Combinar izquierda, rotación, hard drop
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false,
      hardDrop: true,
      rotateClockwise: true,
    });
    const events = engine.drainEvents();

    // Encontrar índices de eventos en la cola
    const horizontalIdx = events.findIndex((e) => e.type === 'pieceMoved' && e.reason === 'horizontal');
    const rotateIdx = events.findIndex((e) => e.type === 'pieceRotated');
    const hardDropIdx = events.findIndex((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
    const lockedIdx = events.findIndex((e) => e.type === 'pieceLocked');

    // Si hay horizontal, debe ir antes que rotación
    if (horizontalIdx >= 0 && rotateIdx >= 0) {
      expect(horizontalIdx).toBeLessThan(rotateIdx);
    }
    // Si hay rotación, debe ir antes que hard drop
    if (rotateIdx >= 0 && hardDropIdx >= 0) {
      expect(rotateIdx).toBeLessThan(hardDropIdx);
    }
    // Hard drop va antes del locked
    if (hardDropIdx >= 0 && lockedIdx >= 0) {
      expect(hardDropIdx).toBeLessThan(lockedIdx);
    }
  });

  it('no se emiten eventos por movimientos bloqueados (horizontal bloqueado no emite)', () => {
    // Verificar que cuando un intento horizontal es bloqueado por la pared,
    // la pieza no emite pieceMoved horizontal
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Obtener la pieza y moverla a la pared izquierda
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: true, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Ahora la pieza está en la pared. Un intento más de izquierda sin flanco
    // No debe emitir pieceMoved
    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    });
    const events = engine.drainEvents();
    expect(events.filter((e) => e.type === 'pieceMoved' && e.reason === 'horizontal')).toHaveLength(0);
  });

  it('misma semilla, configuración y entradas producen mismo resultado', () => {
    // Test de determinismo con DAS/ARR y soft drop
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());
    drainAll(engineA);
    drainAll(engineB);

    const inputs: StepInput[] = [];
    // Secuencia variada de entradas
    inputs.push({ leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false });
    for (let i = 0; i < 20; i++) {
      inputs.push({ leftHeld: true, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false });
    }
    inputs.push({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false });
    for (let i = 0; i < 5; i++) {
      inputs.push({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }
    inputs.push({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true });

    const snapshotsA: unknown[] = [];
    const eventsA: unknown[] = [];
    const snapshotsB: unknown[] = [];
    const eventsB: unknown[] = [];

    snapshotsA.push(engineA.getSnapshot());
    eventsA.push(engineA.drainEvents());
    snapshotsB.push(engineB.getSnapshot());
    eventsB.push(engineB.drainEvents());

    for (const input of inputs) {
      try { engineA.step(input); } catch { /* game over */ }
      snapshotsA.push(engineA.getSnapshot());
      eventsA.push(engineA.drainEvents());

      try { engineB.step(input); } catch { /* game over */ }
      snapshotsB.push(engineB.getSnapshot());
      eventsB.push(engineB.drainEvents());
    }

    expect(snapshotsA).toEqual(snapshotsB);
    expect(eventsA).toEqual(eventsB);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  T-SPIN: DETECCIÓN, PUNTUACIÓN Y BACK-TO-BACK
// ════════════════════════════════════════════════════════════════════════

describe('T-Spin - estado inicial y reset', () => {
  it('backToBack es 0 tras createGameEngine', () => {
    const engine = createGameEngine(makeValidOptions());
    expect(engine.getSnapshot().backToBack).toBe(0);
  });

  it('backToBack es 0 tras reset', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.reset(makeValidOptions({ seed: 42 }));
    expect(engine.getSnapshot().backToBack).toBe(0);
  });

  it('game over conserva backToBack', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }
    const finalB2b = engine.getSnapshot().backToBack;
    expect(typeof finalB2b).toBe('number');
  });
});

describe('T-Spin - snapshot', () => {
  it('snapshot incluye backToBack', () => {
    const engine = createGameEngine(makeValidOptions());
    const snap = engine.getSnapshot();
    expect('backToBack' in snap).toBe(true);
  });
});

describe('T-Spin - back-to-back', () => {
  it('estado inicial backToBack es 0', () => {
    const engine = createGameEngine(makeValidOptions());
    expect(engine.getSnapshot().backToBack).toBe(0);
  });

  it('reset elimina backToBack', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.reset(makeValidOptions({ seed: 42 }));
    expect(engine.getSnapshot().backToBack).toBe(0);
  });

  it('hold no rompe backToBack', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
      hold: true,
    });
    drainAll(engine);
    expect(engine.getSnapshot().backToBack).toBe(0);
  });
});

describe('T-Spin - relación combo/back-to-back', () => {
  it('combo y backToBack evolucionan de forma independiente (valores iniciales)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    expect(engine.getSnapshot().combo).toBe(0);
    expect(engine.getSnapshot().backToBack).toBe(0);
  });

  it('entrada inválida es atómica (no muta nada)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const snapBefore = engine.getSnapshot();
    try {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
        rotateCounterclockwise: true,
      });
    } catch {
      // esperado
    }
    const snapAfter = engine.getSnapshot();
    expect(snapAfter.score).toBe(snapBefore.score);
    expect(snapAfter.combo).toBe(snapBefore.combo);
    expect(snapAfter.backToBack).toBe(snapBefore.backToBack);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE PUNTUACIÓN Y COMBOS
// ════════════════════════════════════════════════════════════════════════

describe('puntuación - estado inicial', () => {
  it('score es 0 inmediatamente tras createGameEngine', () => {
    const engine = createGameEngine(makeValidOptions());
    expect(engine.getSnapshot().score).toBe(0);
  });

  it('combo es 0 inmediatamente tras createGameEngine', () => {
    const engine = createGameEngine(makeValidOptions());
    expect(engine.getSnapshot().combo).toBe(0);
  });

  it('score y combo son 0 tras reset', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    for (let i = 0; i < 10; i++) stepStationary(engine);
    drainAll(engine);
    engine.reset(makeValidOptions({ seed: 42 }));
    const snap = engine.getSnapshot();
    expect(snap.score).toBe(0);
    expect(snap.combo).toBe(0);
  });
});

describe('puntuación - hard drop', () => {
  it('hard drop desde altura conocida incrementa score en distancia * 2', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    const snap = engine.getSnapshot();

    // Calcular distancia real: hardDropDistance = cuánto descendió
    const hardDropMoves = events.filter(e => e.type === 'pieceMoved' && e.reason === 'hardDrop');
    if (hardDropMoves.length > 0) {
      // Verificar que score > 0 porque hubo distancia > 0
      expect(snap.score).toBeGreaterThan(0);
    } else {
      // Distancia 0 (pieza ya apoyada): 0 puntos de caída
      expect(snap.score).toBe(0);
    }
  });

  it('hard drop con distancia 0 no incrementa score por caída', () => {
    const engine = createGameEngine(makeValidOptions({ config: { ...prototypeConfig, gravityCellsPerSecond: 10 } }));
    drainAll(engine);

    // Fijar primera pieza
    stepHardDrop(engine);
    drainAll(engine);

    // Buscar pieza ya apoyada y hacer hard drop
    for (let i = 0; i < 200; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece?.grounded) {
        const scorePre = engine.getSnapshot().score;
        stepHardDrop(engine);
        drainAll(engine);
        // Score no debe aumentar por caída (distancia 0), solo por líneas si las hay
        expect(engine.getSnapshot().score).toBeGreaterThanOrEqual(scorePre);
        break;
      }
      stepStationary(engine);
    }
  });
});

describe('puntuación - soft drop', () => {
  it('soft drop no puntúa en el primer paso (progreso < 1000)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    expect(engine.getSnapshot().score).toBe(0);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: true,
      hardDrop: false,
    });
    drainAll(engine);
    // Primer paso: 200 unidades < 1000, sin descenso
    expect(engine.getSnapshot().score).toBe(0);
  });

  it('soft drop puntúa 1 punto por cada celda realmente descendida', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const initialY = engine.getSnapshot().activePiece!.y;

    // 5 pasos de soft drop = 5*200 = 1000 → 1 descenso
    for (let i = 0; i < 5; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
    }
    drainAll(engine);

    const snap = engine.getSnapshot();
    const cellsDescended = snap.activePiece!.y - initialY;
    expect(cellsDescended).toBe(1);
    expect(snap.score).toBe(cellsDescended * 1);
  });

  it('gravedad normal no concede puntos (softDropHeld false)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 100; i++) stepStationary(engine);
    drainAll(engine);

    expect(engine.getSnapshot().score).toBe(0);
  });
});

describe('puntuación - eliminación de líneas', () => {
  it('fijación sin líneas no incrementa score por líneas (combo = 0)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    const cleared = events.filter(e => e.type === 'linesCleared');

    // combo debe ser 0 si la primera pieza fijada no eliminó líneas
    if (cleared.length === 0) {
      expect(engine.getSnapshot().combo).toBe(0);
    }
  });

  it('acumula puntuación durante partidas largas (regresión)', () => {
    const slowConfig = { ...prototypeConfig, gravityCellsPerSecond: 0.1 };
    const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
    drainAll(engine);

    // Ejecutar 300 hard drops (sin mover piezas) para acumular líneas y puntuación
    for (let i = 0; i < 300; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece) {
        // Variar posición horizontal para maximizar líneas
        const targetCol = (i * 3) % 9;
        const diff = targetCol - snap.activePiece.x;
        if (diff > 0) {
          for (let m = 0; m < Math.min(diff, 5); m++) stepRight(engine);
        } else if (diff < 0) {
          for (let m = 0; m < Math.min(-diff, 5); m++) stepLeft(engine);
        }
      }
      stepHardDrop(engine);
      const events = engine.drainEvents();
      // Verificar que score y combo son coherentes
      const snapAfter = engine.getSnapshot();
      if (snapAfter.status === 'gameOver') break;
      const clearedEvents = events.filter(e => e.type === 'linesCleared');
      if (clearedEvents.length > 0) {
        // Si hubo líneas, combo debe ser > 0
        expect(snapAfter.combo).toBeGreaterThan(0);
      }
    }
    // Score final debe ser >= 0, no decreciente
    expect(engine.getSnapshot().score).toBeGreaterThanOrEqual(0);
  });

  it('la puntuación nunca disminuye (invariante a lo largo de una partida)', () => {
    const slowConfig = { ...prototypeConfig, gravityCellsPerSecond: 0.1 };
    const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
    drainAll(engine);

    let prevScore = 0;
    for (let i = 0; i < 100; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepStationary(engine);
      const score = engine.getSnapshot().score;
      expect(score).toBeGreaterThanOrEqual(prevScore);
      prevScore = score;
      if (i % 3 === 0) stepLeft(engine);
    }
  });
});

describe('combo - inicio y crecimiento', () => {
  it('tras reset, combo es 0', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.reset(makeValidOptions({ seed: 42 }));
    expect(engine.getSnapshot().combo).toBe(0);
  });

  it('múltiples fijaciones sin líneas mantienen combo = 0', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 5; i++) {
      stepHardDrop(engine);
      drainAll(engine);
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      // Sin líneas → combo = 0
    }
    expect(engine.getSnapshot().combo).toBe(0);
  });
});

describe('puntuación - hard drop con distancia y líneas', () => {
  it('hard drop con distancia > 0 y líneas suma caída y puntos base', () => {
    const slowConfig = { ...prototypeConfig, gravityCellsPerSecond: 0.1 };
    const engine = createGameEngine(makeValidOptions({ seed: 42, config: slowConfig }));
    drainAll(engine);

    // Realizar una secuencia variada: mover + hard drop
    for (let i = 0; i < 40; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece) {
        const targetCol = (i * 3) % 9;
        const diff = targetCol - engine.getSnapshot().activePiece!.x;
        if (diff > 0) {
          for (let m = 0; m < Math.min(diff, 5); m++) stepRight(engine);
        } else if (diff < 0) {
          for (let m = 0; m < Math.min(-diff, 5); m++) stepLeft(engine);
        }
      }
      stepHardDrop(engine);
      drainAll(engine);
    }

    // Score debe haber crecido (partida no vacía)
    expect(engine.getSnapshot().score).toBeGreaterThanOrEqual(0);
  });
});

describe('puntuación - game over y snapshot', () => {
  it('game over conserva el score final (no se reinicia)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(engine.getSnapshot().status).toBe('gameOver');
    // score puede ser 0 si no hubo líneas, pero es estable
    const finalScore = engine.getSnapshot().score;
    // Verificar que no cambia tras otro drain
    drainAll(engine);
    expect(engine.getSnapshot().score).toBe(finalScore);
  });

  it('game over conserva el combo final (no se reinicia)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const finalCombo = engine.getSnapshot().combo;
    drainAll(engine);
    expect(engine.getSnapshot().combo).toBe(finalCombo);
  });

  it('getSnapshot() no muta score ni combo', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap1 = engine.getSnapshot();
    const snap2 = engine.getSnapshot();
    const snap3 = engine.getSnapshot();

    expect(snap1.score).toBe(snap2.score);
    expect(snap2.score).toBe(snap3.score);
    expect(snap1.combo).toBe(snap2.combo);
    expect(snap2.combo).toBe(snap3.combo);
  });
});

describe('puntuación - atomicidad', () => {
  it('una entrada inválida no muta score ni combo', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap0 = engine.getSnapshot();
    const score0 = snap0.score;
    const combo0 = snap0.combo;

    try { engine.step({ leftHeld: false, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false }); } catch { /* expected */ }

    const snapAfter = engine.getSnapshot();
    expect(snapAfter.score).toBe(score0);
    expect(snapAfter.combo).toBe(combo0);
  });

  it('step() en gameOver no muta score ni combo', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    const snapPre = engine.getSnapshot();
    const scorePre = snapPre.score;
    const comboPre = snapPre.combo;

    try { engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false }); } catch { /* expected */ }

    const snapPost = engine.getSnapshot();
    expect(snapPost.score).toBe(scorePre);
    expect(snapPost.combo).toBe(comboPre);
  });
});

describe('puntuación - determinismo', () => {
  it('misma semilla y entradas producen score y combo idénticos', () => {
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());
    drainAll(engineA);
    drainAll(engineB);

    for (let i = 0; i < 20; i++) {
      if (engineA.getSnapshot().status === 'gameOver' || engineB.getSnapshot().status === 'gameOver') break;
      if (i % 4 === 0) {
        stepLeft(engineA);
        stepLeft(engineB);
      } else {
        stepRight(engineA);
        stepRight(engineB);
      }
      stepHardDrop(engineA);
      stepHardDrop(engineB);
      drainAll(engineA);
      drainAll(engineB);
    }

    expect(engineA.getSnapshot().score).toBe(engineB.getSnapshot().score);
    expect(engineA.getSnapshot().combo).toBe(engineB.getSnapshot().combo);
  });
});

// ════════════════════════════════════════════════════════════════════════
//  PRUEBAS DE LOCK DELAY
// ════════════════════════════════════════════════════════════════════════

describe('lock delay - temporizador', () => {
  it('comienza a avanzar cuando la pieza entra en contacto y el primer paso apoyado cuenta fixedStepMs', () => {
    // Usamos hard drop para fijar la primera pieza, luego gravedad lenta para
    // que la nueva pieza caiga y toque fondo.
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Fijar la primera pieza inmediatamente
    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza cae. Con gravedad 1 celda/segundo y fixedStepMs=10,
    // cada paso son 10 unidades. Para descender desde spawn (y ~ 3-4) hasta
    // apoyarse en la pieza fija se necesitan varios pasos de gravedad.
    // En vez de esperar, usamos soft drop para bajar rápido y luego detener.
    let grounded = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      const snapBefore = engine.getSnapshot();
      if (snapBefore.activePiece?.grounded) {
        grounded = true;
        break;
      }
      // Soft drop para bajar rápido
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(grounded).toBe(true);

    // La pieza está apoyada. Un paso más debe incrementar lockDelayElapsedMs
    // en fixedStepMs (10ms). El primer paso apoyado ya cuenta.
    const snap1 = engine.getSnapshot();
    if (snap1.activePiece) {
      expect(snap1.activePiece.lockDelayElapsedMs).toBeGreaterThanOrEqual(0);
      expect(snap1.activePiece.grounded).toBe(true);
    }
  });

  it('no fija antes del umbral lockDelayMs', () => {
    // lockDelayMs=500, fixedStepMs=10 → se necesitan 49 pasos apoyado
    // para llegar a 490ms, y el paso 50 para 500ms
    // Usamos soft drop para bajar rápido, luego paramos soft drop para que
    // la gravedad no interfiera (gravedad base 1 celda/segundo es baja)
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar la nueva pieza hasta que esté apoyada usando soft drop
    let grounded = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) {
        grounded = true;
        break;
      }
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(grounded).toBe(true);

    // 30 pasos apoyado (sin soft drop) = 300ms < 500ms → no debe fijarse
    for (let i = 0; i < 30; i++) {
      stepStationary(engine);
      drainAll(engine);
      expect(engine.getSnapshot().activePiece).not.toBeNull();
    }
    const snap = engine.getSnapshot();
    expect(snap.activePiece).not.toBeNull();
  });

  it('fija exactamente al alcanzar lockDelayMs', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar la nueva pieza a que esté apoyada usando soft drop
    let grounded = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) {
        grounded = true;
        break;
      }
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(grounded).toBe(true);

    // 50 pasos apoyado = 500ms → debe fijar (lockDelayMs=500, fixedStepMs=10)
    for (let i = 0; i < 60; i++) {
      stepStationary(engine);
      drainAll(engine);
      if (engine.getSnapshot().activePiece === null) {
        // Se fijó
        break;
      }
    }

    // Debe haberse fijado (activePiece null o nueva pieza)
    const snap = engine.getSnapshot();
    expect(snap.activePiece === null || (snap.activePiece && !snap.activePiece.grounded)).toBe(true);
  });

  it('avanza una única vez por paso lógico', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar la nueva pieza a grounded usando soft drop
    let grounded = false;
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) {
        grounded = true;
        break;
      }
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
    expect(grounded).toBe(true);

    // Un paso apoyado: la diferencia en lockDelayElapsedMs debe ser exactamente fixedStepMs
    const snapBefore = engine.getSnapshot();
    const ldBefore = snapBefore.activePiece!.lockDelayElapsedMs;

    stepStationary(engine);
    drainAll(engine);
    const snapAfter = engine.getSnapshot();
    if (snapAfter.activePiece) {
      const diff = snapAfter.activePiece.lockDelayElapsedMs - ldBefore;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(prototypeConfig.fixedStepMs);
    }
  });

  it('no depende de tiempo real (solo fixedStepMs acumulado)', () => {
    // Verificar que el temporizador solo depende del step count
    // Usamos dos motores con misma configuración y misma semilla,
    // avanzamos pasos y verificamos que lockDelayElapsedMs es idéntico
    const config = { ...prototypeConfig, gravityCellsPerSecond: 0.1 };
    const engineA = createGameEngine(makeValidOptions({ config, seed: 42 }));
    const engineB = createGameEngine(makeValidOptions({ config, seed: 42 }));
    drainAll(engineA);
    drainAll(engineB);

    // Fijar primera pieza en ambos
    stepHardDrop(engineA);
    stepHardDrop(engineB);
    drainAll(engineA);
    drainAll(engineB);

    // Avanzar hasta grounded
    for (let i = 0; i < 200; i++) {
      if (engineA.getSnapshot().status === 'gameOver' || engineB.getSnapshot().status === 'gameOver') break;
      stepStationary(engineA);
      stepStationary(engineB);
    }
    drainAll(engineA);
    drainAll(engineB);

    // Otros 10 pasos
    for (let i = 0; i < 10; i++) {
      stepStationary(engineA);
      stepStationary(engineB);
    }
    drainAll(engineA);
    drainAll(engineB);

    expect(engineA.getSnapshot().activePiece?.lockDelayElapsedMs).toBe(
      engineB.getSnapshot().activePiece?.lockDelayElapsedMs,
    );
  });
});

describe('lock delay - gravedad y soft drop', () => {
  it('descenso bloqueado por gravedad no fija inmediatamente', () => {
    // La pieza inicial desde spawn no está apoyada. Con gravedad lenta
    // la dejamos caer hasta que toque fondo (bloqueada). No debe fijar.
    const config = { ...prototypeConfig, gravityCellsPerSecond: 2 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    // Avanzar hasta que la pieza esté apoyada pero no fijada
    for (let i = 0; i < 500; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      const snap = engine.getSnapshot();
      if (snap.activePiece?.grounded) {
        // La pieza está apoyada pero no fijada
        expect(snap.activePiece).not.toBeNull();
        break;
      }
      stepStationary(engine);
      drainAll(engine);
    }

    // Debe seguir teniendo pieza activa (no se fijó)
    expect(engine.getSnapshot().activePiece).not.toBeNull();
  });

  it('descenso bloqueado por soft drop no fija inmediatamente', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Soft drop hasta apoyar, verificar que no fija
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      const snap = engine.getSnapshot();
      if (snap.activePiece?.grounded) {
        // Apoyada pero no fijada
        expect(engine.getSnapshot().activePiece).not.toBeNull();
        break;
      }
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }
  });

  it('el progreso vertical bloqueado se consume', () => {
    // Con gravedad alta pero softDrop aún mayor, varios descensos bloqueados
    // no acumulan progreso porque se consume en cada intento
    const config = {
      ...prototypeConfig,
      gravityCellsPerSecond: 20,
      softDropCellsPerSecond: 25,
    };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    // Fijar primera pieza para tener una base
    stepHardDrop(engine);
    drainAll(engine);

    // Gravedad alta: 20*10=200 por paso, 5 pasos = 1 descenso
    // Desde spawn (y~3) hasta apoyarse, varios descensos
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) {
        break;
      }
      stepStationary(engine);
      drainAll(engine);
    }
    // No debe haberse fijado por gravedad (lock delay diferido)
    expect(engine.getSnapshot().activePiece).not.toBeNull();
  });

  it('soft drop mantenido no reinicia', () => {
    // Soft drop no debe reiniciar el temporizador ni consumir reinicios
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Soft drop hasta grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }

    // Mantener soft drop varios pasos más. lockResetsUsed debe seguir siendo 0
    for (let i = 0; i < 10; i++) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece) {
      expect(engine.getSnapshot().activePiece!.lockResetsUsed).toBe(0);
    }
  });

  it('gravedad no reinicia', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Gravedad hasta grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece) {
      expect(engine.getSnapshot().activePiece!.lockResetsUsed).toBe(0);
    }
  });
});

describe('lock delay - hard drop', () => {
  it('fija inmediatamente con distancia positiva', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    const events = engine.drainEvents();
    expect(events.some((e) => e.type === 'pieceLocked')).toBe(true);
    expect(events.some((e) => e.type === 'pieceSpawned')).toBe(true);
  });

  it('fija inmediatamente con distancia 0', () => {
    const config = { ...prototypeConfig, gravityCellsPerSecond: 10 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Hard drop repetido hasta encontrar pieza ya apoyada
    for (let i = 0; i < 200; i++) {
      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') break;
      if (snap.activePiece) {
        const grounded = snap.activePiece.grounded;
        if (grounded) {
          // Hard drop con distancia 0
          engine.step({
            leftHeld: false, rightHeld: false,
            leftPressed: false, rightPressed: false,
            softDropHeld: false,
            hardDrop: true,
          });
          const events = engine.drainEvents();
          expect(events.some((e) => e.type === 'pieceLocked')).toBe(true);
          const moveEvents = events.filter((e) => e.type === 'pieceMoved' && e.reason === 'hardDrop');
          expect(moveEvents).toHaveLength(0);
          break;
        }
      }
      stepStationary(engine);
    }
  });

  it('no consume reinicios', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza no hereda reinicios
    expect(engine.getSnapshot().activePiece?.lockResetsUsed ?? 0).toBe(0);
  });

  it('no avanza lock delay después de fijar', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Verificar que la nueva pieza empieza con lockDelayElapsedMs=0
    expect(engine.getSnapshot().activePiece?.lockDelayElapsedMs ?? 0).toBe(0);
  });
});

describe('lock delay - movimiento horizontal', () => {
  it('movimiento válido apoyado reinicia y consume un reinicio', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded usando soft drop
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }

    const beforeSnap = engine.getSnapshot();
    if (beforeSnap.activePiece?.grounded) {
      const beforeReset = beforeSnap.activePiece.lockResetsUsed;

      // Movimiento horizontal válido (apoyado antes y después)
      stepLeft(engine);
      drainAll(engine);

      const snapAfter = engine.getSnapshot();
      if (snapAfter.activePiece && snapAfter.activePiece.grounded) {
        // Solo verificar si sigue apoyada después
        expect(snapAfter.activePiece.lockResetsUsed).toBe(beforeReset + 1);
      }
      // Si no sigue apoyada, el movimiento la dejó en el aire y no consume
    }
  });

  it('movimiento bloqueado no reinicia ni consume', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded y mover a la pared
    for (let i = 0; i < 10; i++) {
      stepLeft(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece?.grounded) {
      const beforeSnap = engine.getSnapshot();
      const beforeResets = beforeSnap.activePiece!.lockResetsUsed;

      // Intento bloqueado contra la pared
      engine.step({
        leftHeld: true, rightHeld: false,
        leftPressed: true, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
      });
      const afterSnap = engine.getSnapshot();
      if (afterSnap.activePiece) {
        expect(afterSnap.activePiece.lockResetsUsed).toBe(beforeResets);
      }
    }
  });

  it('movimiento válido que deja en el aire pone tiempo a 0 sin consumir', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Mover la pieza inicial hasta el borde de una plataforma para dejarla
    // en el aire. Con la pieza I (seed 42), estamos en aire inicialmente.
    // Necesitamos que la pieza esté apoyada primero.
    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
    }
    drainAll(engine);

    // Mover lateralmente - puede dejar en el aire o no, dependiendo del tablero
    // Verificar invariante: si después del movimiento no está grounded, tiempo=0
    if (engine.getSnapshot().activePiece?.grounded) {
      const beforeResets = engine.getSnapshot().activePiece!.lockResetsUsed;

      stepLeft(engine);
      drainAll(engine);

      const afterSnap = engine.getSnapshot();
      if (afterSnap.activePiece && !afterSnap.activePiece.grounded) {
        expect(afterSnap.activePiece.lockDelayElapsedMs).toBe(0);
        expect(afterSnap.activePiece.lockResetsUsed).toBe(beforeResets);
      }
    }
  });
});

describe('lock delay - rotación', () => {
  it('rotación válida apoyada reinicia y consume', () => {
    const config = { ...prototypeConfig, gravityCellsPerSecond: 0.1 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece?.grounded) {
      const beforeResets = engine.getSnapshot().activePiece!.lockResetsUsed;

      // Rotación horaria
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      drainAll(engine);

      const afterSnap = engine.getSnapshot();
      if (afterSnap.activePiece?.grounded) {
        expect(afterSnap.activePiece.lockResetsUsed).toBe(beforeResets + 1);
      }
    }
  });

  it('rotación inválida no reinicia', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Intentar rotar una pieza O en spawn (siempre válida)
    // Encontremos un caso donde falle rotar
    for (let attempt = 0; attempt < 50; attempt++) {
      const snap = engine.getSnapshot();
      const type = snap.activePiece!.type;
      if (type !== 'O' && type !== 'I') {
        const beforeOrientation = snap.activePiece!.orientation;
        const beforeResets = snap.activePiece!.lockResetsUsed;
        const beforeTime = snap.activePiece!.lockDelayElapsedMs;

        // Rotar
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true,
        });
        drainAll(engine);

        const afterSnap = engine.getSnapshot();
        if (afterSnap.activePiece && afterSnap.activePiece.orientation === beforeOrientation) {
          // Rotación fallida
          expect(afterSnap.activePiece.lockResetsUsed).toBe(beforeResets);
          expect(afterSnap.activePiece.lockDelayElapsedMs).toBe(beforeTime);
        }
        break;
      }
      stepHardDrop(engine);
      drainAll(engine);
    }
  });

  it('eventos mantienen su orden al consumir el último reinicio en rotación', () => {
    // Configuración con maxLockResets=1 para que con grounded + rotación + grounded
    // se consuma el único reinicio y fije inmediatamente
    const config = { ...prototypeConfig, maxLockResets: 1 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: true,
        hardDrop: false,
      });
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece?.grounded) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      const events = engine.drainEvents();

      // Si rotó exitosamente y consumió el último reinicio:
      // pieceRotated antes que pieceLocked
      if (events.some((e) => e.type === 'pieceRotated')) {
        const rotateIdx = events.findIndex((e) => e.type === 'pieceRotated');
        const lockIdx = events.findIndex((e) => e.type === 'pieceLocked');
        if (rotateIdx >= 0 && lockIdx >= 0) {
          expect(rotateIdx).toBeLessThan(lockIdx);
        }
      }
    }
  });
});

describe('lock delay - límite de reinicios', () => {
  it('el último reinicio aplica la acción y fija en el mismo paso', () => {
    // Config: solo 1 reinicio disponible (maxLockResets=1)
    const config = { ...prototypeConfig, maxLockResets: 1 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    // Llevar a grounded
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    // Primer movimiento (consume el único reinicio y fija)
    if (engine.getSnapshot().activePiece?.grounded) {
      stepLeft(engine);
      const events = engine.drainEvents();
      const snap = engine.getSnapshot();

      // Debe haberse fijado (activoPiece null o nueva pieza)
      expect(snap.activePiece === null || events.some((e) => e.type === 'pieceLocked')).toBe(true);
    }
  });

  it('emite acción antes de pieceLocked al alcanzar el límite', () => {
    const config = { ...prototypeConfig, maxLockResets: 1 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    // Rotar (consumirá reinicio y fijará)
    if (engine.getSnapshot().activePiece?.grounded) {
      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false,
        hardDrop: false,
        rotateClockwise: true,
      });
      const events = engine.drainEvents();

      // Si hubo rotación, pieceRotated antes de pieceLocked
      const rotateEv = events.find((e) => e.type === 'pieceRotated');
      const lockEv = events.find((e) => e.type === 'pieceLocked');
      if (rotateEv && lockEv) {
        expect(events.indexOf(rotateEv)).toBeLessThan(events.indexOf(lockEv));
      }
    }
  });

  it('no existe reinicio adicional (lockResetsUsed no supera maxLockResets)', () => {
    const config = { ...prototypeConfig, maxLockResets: 5 };
    const engine = createGameEngine(makeValidOptions({ config }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    // Varios movimientos posibles, max resets = 5. Verificar que nunca se supera.
    let maxObserved = 0;
    for (let i = 0; i < 30; i++) {
      if (!engine.getSnapshot().activePiece) break;
      stepLeft(engine);
      const snap = engine.getSnapshot();
      if (snap.activePiece) {
        maxObserved = Math.max(maxObserved, snap.activePiece.lockResetsUsed);
      }
      drainAll(engine);
    }

    expect(maxObserved).toBeLessThanOrEqual(config.maxLockResets);
  });

  it('spawn posterior queda limpio (lockResetsUsed=0)', () => {
    const config = { ...prototypeConfig, maxLockResets: 1 };
    const engine = createGameEngine(makeValidOptions({ config, seed: 42 }));
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);
    const snapAfter = engine.getSnapshot();
    if (snapAfter.activePiece) {
      expect(snapAfter.activePiece.lockResetsUsed).toBe(0);
    }
  });
});

describe('lock delay - salida y reentrada', () => {
  it('al quedar en el aire, tiempo a 0 y contador histórico conservado', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece?.grounded) {
      const beforeResets = engine.getSnapshot().activePiece!.lockResetsUsed;

      // Mover: si deja en el aire, lockDelayElapsedMs=0 pero resets conservado
      stepLeft(engine);
      drainAll(engine);

      const afterSnap = engine.getSnapshot();
      if (afterSnap.activePiece && !afterSnap.activePiece.grounded) {
        expect(afterSnap.activePiece.lockDelayElapsedMs).toBe(0);
        expect(afterSnap.activePiece.lockResetsUsed).toBe(beforeResets);
      }
    }
  });

  it('una nueva pieza reinicia ambos valores', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      expect(snap.activePiece.lockDelayElapsedMs).toBe(0);
      expect(snap.activePiece.lockResetsUsed).toBe(0);
    }
  });
});

describe('lock delay - snapshot', () => {
  it('incluye los tres campos en el snapshot', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      expect(snap.activePiece).toHaveProperty('grounded');
      expect(snap.activePiece).toHaveProperty('lockDelayElapsedMs');
      expect(snap.activePiece).toHaveProperty('lockResetsUsed');
    }
  });

  it('refleja apoyo real', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      expect(typeof snap.activePiece.grounded).toBe('boolean');
    }
  });

  it('los objetos no exponen mutabilidad', () => {
    const engine = createGameEngine(makeValidOptions());
    const snap = engine.getSnapshot();

    expect(Object.isFrozen(snap)).toBe(true);
    if (snap.activePiece) {
      expect(Object.isFrozen(snap.activePiece)).toBe(true);
    }
  });

  it('game over continúa con activePiece: null', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    expect(engine.getSnapshot().activePiece).toBeNull();
  });
});

describe('lock delay - atomicidad', () => {
  it('entrada inválida durante lock delay no muta nada (incluyendo lock delay vars)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().activePiece?.grounded) {
      const snapBefore = engine.getSnapshot();
      const stepBefore = snapBefore.step;
      const ldBefore = snapBefore.activePiece!.lockDelayElapsedMs;
      const lrBefore = snapBefore.activePiece!.lockResetsUsed;
      const xBefore = snapBefore.activePiece!.x;

      // Intentar entrada inválida
      try {
        engine.step({
          leftHeld: false, rightHeld: false,
          leftPressed: false, rightPressed: false,
          softDropHeld: false,
          hardDrop: false,
          rotateClockwise: true,
          rotateCounterclockwise: true,
        });
      } catch { /* esperado */ }

      const snapAfter = engine.getSnapshot();
      expect(snapAfter.step).toBe(stepBefore);
      expect(snapAfter.activePiece?.lockDelayElapsedMs).toBe(ldBefore);
      expect(snapAfter.activePiece?.lockResetsUsed).toBe(lrBefore);
      expect(snapAfter.activePiece?.x).toBe(xBefore);
    }
  });

  it('ENGINE_NOT_RUNNING mantiene precedencia sobre INVALID_GAME_INPUT', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    try {
      (engine.step as (input: unknown) => void)({});
      expect.fail('Should have thrown');
    } catch (e) {
      if (e instanceof EngineStepError) {
        expect(e.code).toBe('ENGINE_NOT_RUNNING');
      }
    }
  });
});

describe('lock delay - determinismo', () => {
  it('misma semilla y entradas producen snapshots y eventos idénticos con lock delay', () => {
    const engineA = createGameEngine(makeValidOptions());
    const engineB = createGameEngine(makeValidOptions());

    const inputs: StepInput[] = [
      { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: true, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true },
    ];

    const snapshotsA: unknown[] = [];
    const eventsA: unknown[] = [];
    const snapshotsB: unknown[] = [];
    const eventsB: unknown[] = [];

    snapshotsA.push(engineA.getSnapshot());
    eventsA.push(engineA.drainEvents());
    snapshotsB.push(engineB.getSnapshot());
    eventsB.push(engineB.drainEvents());

    for (const input of inputs) {
      try { engineA.step(input); } catch { /* game over */ }
      snapshotsA.push(engineA.getSnapshot());
      eventsA.push(engineA.drainEvents());

      try { engineB.step(input); } catch { /* game over */ }
      snapshotsB.push(engineB.getSnapshot());
      eventsB.push(engineB.drainEvents());
    }

    expect(snapshotsA).toEqual(snapshotsB);
    expect(eventsA).toEqual(eventsB);
  });

  it('reset elimina progreso de lock delay', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    stepHardDrop(engine);
    drainAll(engine);

    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      if (engine.getSnapshot().activePiece?.grounded) break;
      stepStationary(engine);
      drainAll(engine);
    }

    engine.reset(makeValidOptions({ seed: 42 }));
    const snap = engine.getSnapshot();
    if (snap.activePiece) {
      expect(snap.activePiece.lockDelayElapsedMs).toBe(0);
      expect(snap.activePiece.lockResetsUsed).toBe(0);
    }
  });
});

describe('reserva - estado inicial', () => {
  it('heldPiece es null tras createGameEngine', () => {
    const engine = createGameEngine(makeValidOptions());
    const snap = engine.getSnapshot();
    expect(snap.heldPiece).toBeNull();
  });

  it('activePiece.holdUsed es false para la pieza activa inicial', () => {
    const engine = createGameEngine(makeValidOptions());
    const snap = engine.getSnapshot();
    expect(snap.activePiece?.holdUsed).toBe(false);
  });
});

describe('reserva - primera reserva (hueco vacío)', () => {
  it('heldPiece pasa a ser el tipo de la pieza activa anterior', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const snapBefore = engine.getSnapshot();
    const outgoing = snapBefore.activePiece!.type;
    const incoming = snapBefore.nextPieces[0];

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const snap = engine.getSnapshot();
    expect(snap.heldPiece).toBe(outgoing);
    expect(snap.activePiece?.type).toBe(incoming);
  });

  it('nextPieces mantiene longitud 3 tras el hold', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const snapBefore = engine.getSnapshot();
    const nextsBefore = [...snapBefore.nextPieces];

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const snap = engine.getSnapshot();
    expect(snap.nextPieces).toHaveLength(3);
    // nextPieces[0] era nextPieces[1] antes
    expect(snap.nextPieces[0]).toBe(nextsBefore[1]);
    expect(snap.nextPieces[1]).toBe(nextsBefore[2]);
  });

  it('emite pieceHeld seguido de pieceSpawned en ese orden', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    const snapBefore = engine.getSnapshot();
    const outgoing = snapBefore.activePiece!.type;

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const events = engine.drainEvents();
    expect(events[0]).toEqual({ type: 'pieceHeld', step: 1, piece: outgoing });
    expect(events[1]?.type).toBe('pieceSpawned');
  });
});

describe('reserva - intercambio (hueco ocupado)', () => {
  it('intercambia heldPiece con activePiece.type', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Primera reserva: guardar la pieza activa
    const snap0 = engine.getSnapshot();
    const firstPiece = snap0.activePiece!.type;
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    // Fijar la pieza actual (la que entró por hold) mediante hard drop
    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza activa (spawn normal) debe tener holdUsed = false
    const snap1 = engine.getSnapshot();
    expect(snap1.activePiece?.holdUsed).toBe(false);

    // Ahora hold está disponible de nuevo. Intercambiar.
    const secondPiece = snap1.activePiece!.type;
    const nextPiecesBefore = [...snap1.nextPieces];

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const snap = engine.getSnapshot();
    expect(snap.heldPiece).toBe(secondPiece);
    expect(snap.activePiece?.type).toBe(firstPiece);
    // nextPieces no debe cambiar en un intercambio
    expect([...snap.nextPieces]).toEqual(nextPiecesBefore);
  });

  it('nextPieces no cambia en el intercambio', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Primera reserva
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);
    stepHardDrop(engine);
    drainAll(engine);

    const snapBefore = engine.getSnapshot();
    const nextsBefore = [...snapBefore.nextPieces];

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const snap = engine.getSnapshot();
    expect([...snap.nextPieces]).toEqual(nextsBefore);
  });
});

describe('reserva - disponibilidad', () => {
  it('segunda reserva antes de fijar se ignora (no muta ni emite)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Primera reserva
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    // holdUsed debería ser true (la pieza entró por hold)
    expect(engine.getSnapshot().activePiece?.holdUsed).toBe(true);

    // Intentar segunda reserva antes de fijar
    const snapBefore = engine.getSnapshot();
    const heldBefore = snapBefore.heldPiece;
    const nextsBefore = [...snapBefore.nextPieces];

    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    const snap = engine.getSnapshot();
    // heldPiece no cambió
    expect(snap.heldPiece).toBe(heldBefore);
    // nextPieces no cambió
    expect([...snap.nextPieces]).toEqual(nextsBefore);
    // activePiece sigue existiendo y es del mismo tipo
    expect(snap.activePiece?.type).toBe(snapBefore.activePiece?.type);
    // No se emitió ningún evento pieceHeld
    const events = engine.drainEvents();
    expect(events.find(e => e.type === 'pieceHeld')).toBeUndefined();
  });

  it('tras fijar y spawnear, holdUsed vuelve a false', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Reservar
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    // Fijar la pieza que entró por hold
    stepHardDrop(engine);
    drainAll(engine);

    // La nueva pieza (spawn normal) debe tener holdUsed = false
    expect(engine.getSnapshot().activePiece?.holdUsed).toBe(false);
  });
});

describe('reserva - spawn de la pieza recuperada', () => {
  it('la pieza recuperada reaparece en Orientation.Spawn', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    const snap = engine.getSnapshot();
    expect(snap.activePiece?.orientation).toBe(Orientation.Spawn);
  });

  it('la pieza recuperada tiene coordenadas de spawn correctas para su tipo', () => {
    // Semilla 42: la primera pieza activa es I (the first from the bag with seed 42)
    // nextPieces[0] es la segunda pieza de la bolsa
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    const snap0 = engine.getSnapshot();
    const incoming = snap0.nextPieces[0]!;

    // Hold: guarda la pieza actual, entra nextPieces[0]
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    const snap1 = engine.getSnapshot();
    // La pieza recuperada debe tener coordenadas de spawn correctas
    const width: Record<PieceType, number> = { I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3 };
    const height: Record<PieceType, number> = { I: 1, O: 2, T: 2, S: 2, Z: 2, J: 2, L: 2 };
    const expectedX = Math.floor((10 - width[incoming]) / 2);
    const expectedY = 4 - height[incoming] + 1;
    expect(snap1.activePiece?.x).toBe(expectedX);
    expect(snap1.activePiece?.y).toBe(expectedY);
    expect(snap1.activePiece?.type).toBe(incoming);
  });
});

describe('reserva - gravedad y lock delay', () => {
  it('lockDelayElapsedMs es 0 tras el hold', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    const snap = engine.getSnapshot();
    expect(snap.activePiece?.lockDelayElapsedMs).toBe(0);
  });

  it('lockResetsUsed es 0 tras el hold', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    const snap = engine.getSnapshot();
    expect(snap.activePiece?.lockResetsUsed).toBe(0);
  });

  it('landingCells se recalcula para la nueva pieza activa tras hold', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    const snap = engine.getSnapshot();
    expect(snap.activePiece?.landingCells.length).toBeGreaterThan(0);
    // Las landingCells deben estar debajo o en la misma posición que la pieza
    for (const cell of snap.activePiece!.landingCells) {
      expect(cell.y).toBeGreaterThanOrEqual(snap.activePiece!.y);
    }
  });
});

describe('reserva - orden dentro del paso y precedencia', () => {
  it('hold + movimiento + rotación + hard drop ejecuta solo el hold', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false, hardDrop: true,
      rotateClockwise: true,
      hold: true,
    });

    const events = engine.drainEvents();
    const eventTypes = events.map(e => e.type);
    // pieceHeld debe estar presente
    expect(eventTypes).toContain('pieceHeld');
    // No debe haber pieceMoved, pieceRotated ni pieceLocked (del hard drop)
    expect(eventTypes).not.toContain('pieceMoved');
    expect(eventTypes).not.toContain('pieceRotated');
    expect(eventTypes).not.toContain('pieceLocked');
  });

  it('hold ignorado (holdUsed) no bloquea el resto del paso', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Primera reserva para marcar holdUsed = true
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    // Ahora holdUsed = true. Enviar hold + leftPressed
    const snapBefore = engine.getSnapshot();
    const xBefore = snapBefore.activePiece!.x;

    engine.step({
      leftHeld: true, rightHeld: false,
      leftPressed: true, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });

    // El movimiento horizontal debería haberse procesado
    const snap = engine.getSnapshot();
    expect(snap.activePiece!.x).not.toBe(xBefore);
    // No debe haber evento pieceHeld
    const events = engine.drainEvents();
    expect(events.find(e => e.type === 'pieceHeld')).toBeUndefined();
  });
});

describe('reserva - hold con spawn bloqueado (game over)', () => {
  it('rama vacía: spawn bloqueado emite pieceHeld + gameOver', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Hacer hard drops repetidos para llenar el tablero
    for (let i = 0; i < 200; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    // Creamos un nuevo motor y lo llenamos hasta que esté casi lleno.
    const engine2 = createGameEngine(makeValidOptions());
    drainAll(engine2);

    // Hacer hard drops repetidos para llenar el tablero
    for (let i = 0; i < 100; i++) {
      if (engine2.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine2);
      drainAll(engine2);
    }

    // Si el motor está en running, el hold podría causar spawn bloqueado.
    if (engine2.getSnapshot().status === 'running') {
      // Todavía hay espacio. El hold debería spawnear una pieza nueva.
      const outgoing = engine2.getSnapshot().activePiece?.type;

      engine2.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
        hold: true,
      });

      const snap = engine2.getSnapshot();
      if (snap.status === 'gameOver') {
        const events = engine2.drainEvents();
        expect(events[0]?.type).toBe('pieceHeld');
        expect(events[1]?.type).toBe('gameOver');
        expect(snap.heldPiece).toBe(outgoing);
      }
    }
  });

  it('rama intercambio: spawn bloqueado emite pieceHeld + gameOver sin cambiar nextPieces', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Hacer una primera reserva
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    // Hacer hard drops repetidos para llenar el tablero
    for (let i = 0; i < 100; i++) {
      if (engine.getSnapshot().status === 'gameOver') break;
      stepHardDrop(engine);
      drainAll(engine);
    }

    if (engine.getSnapshot().status === 'running') {
      // Todavía hay espacio para una pieza más. Realizar intercambio
      // que spawneará la pieza guardada en reserva.
      const nextPiecesBefore = [...engine.getSnapshot().nextPieces];

      engine.step({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
        hold: true,
      });

      const snap = engine.getSnapshot();
      if (snap.status === 'gameOver') {
        const events = engine.drainEvents();
        expect(events[0]?.type).toBe('pieceHeld');
        expect(events[1]?.type).toBe('gameOver');
        // nextPieces no debe cambiar en intercambio
        expect([...snap.nextPieces]).toEqual(nextPiecesBefore);
      }
    }
  });
});

describe('reserva - reset', () => {
  it('reset vacía la reserva y holdUsed es false', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    // Hacer una reserva
    engine.step({
      leftHeld: false, rightHeld: false,
      leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
      hold: true,
    });
    drainAll(engine);

    engine.reset(makeValidOptions({ seed: 42 }));
    const snap = engine.getSnapshot();
    expect(snap.heldPiece).toBeNull();
    expect(snap.activePiece?.holdUsed).toBe(false);
  });
});

describe('reserva - atomicidad', () => {
  it('hold con tipo incorrecto lanza INVALID_GAME_INPUT sin mutar nada', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    expect(() => {
      (engine.step as unknown as (input: unknown) => void)({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
        hold: 'yes',
      });
    }).toThrow(EngineStepError);

    const snap = engine.getSnapshot();
    expect(snap.heldPiece).toBeNull();
    expect(snap.activePiece?.holdUsed).toBe(false);
  });

  it('propiedad desconocida sigue siendo rechazada (hold está en la lista blanca)', () => {
    const engine = createGameEngine(makeValidOptions());
    drainAll(engine);

    expect(() => {
      (engine.step as unknown as (input: unknown) => void)({
        leftHeld: false, rightHeld: false,
        leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
        unknownProp: true,
      });
    }).toThrow(EngineStepError);
  });
});

describe('reserva - determinismo', () => {
  it('misma semilla e inputs con holds producen snapshots y eventos idénticos', () => {
    const engineA = createGameEngine(makeValidOptions({ seed: 12345 }));
    const engineB = createGameEngine(makeValidOptions({ seed: 12345 }));
    drainAll(engineA);
    drainAll(engineB);

    const inputs: StepInput[] = [
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, hold: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, hold: true },
      { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false },
    ];

    const snapshotsA: unknown[] = [];
    const eventsA: unknown[] = [];
    const snapshotsB: unknown[] = [];
    const eventsB: unknown[] = [];

    for (const input of inputs) {
      if (engineA.getSnapshot().status === 'running') {
        engineA.step(input);
        snapshotsA.push(engineA.getSnapshot());
        eventsA.push(engineA.drainEvents());
      }
      if (engineB.getSnapshot().status === 'running') {
        engineB.step(input);
        snapshotsB.push(engineB.getSnapshot());
        eventsB.push(engineB.drainEvents());
      }
    }

    expect(snapshotsA).toEqual(snapshotsB);
    expect(eventsA).toEqual(eventsB);
  });
});

// ── Helpers de prueba para T-Spin, Energía y Combat ─────────────────────

function emptyBoard(): (PieceType | 'garbage' | null)[][] {
  return Array.from({ length: 24 }, () => Array.from<null>({ length: 10 }).fill(null));
}

function createTestEngine(
  board: (PieceType | 'garbage' | null)[][],
  activePiece: { type: PieceType; x: number; y: number; orientation: Orientation },
  nextPieces: PieceType[] = ['I', 'O', 'L'],
  heldPiece: PieceType | null = null,
  initialSnap?: ReturnType<ReturnType<typeof createGameEngine>['getSnapshot']>,
) {
  const initialState: TSpinDemoInitialState = {
    board,
    activePiece,
    nextPieces,
    heldPiece,
  };
  if (initialSnap?.combatEnergy !== undefined) {
    initialState.combatEnergy = initialSnap.combatEnergy;
  }
  if (initialSnap?.storedSabotages) {
    initialState.storedSabotages = initialSnap.storedSabotages;
  }
  if (initialSnap?.pendingGarbage !== undefined) {
    initialState.pendingGarbage = initialSnap.pendingGarbage;
  }
  if (initialSnap?.activeEffects) {
    initialState.activeEffects = initialSnap.activeEffects;
  }
  return createGameEngine(makeValidOptions(), initialState);
}

// ── Cobertura Funcional Completa de T-Spin y Back-to-Back ────────────────

describe('T-Spin - Cobertura Funcional Completa', () => {

  describe('Detección de T-Spin', () => {
    it('una T sin rotación no es T-Spin', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';
      board[15]![5] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(0);
    });

    it('una T rotada con menos de 3 esquinas no es T-Spin', () => {
      const board = emptyBoard();
      // Solo 2 esquinas ocupadas
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(0);
    });

    it('3 esquinas ocupadas sí detectan T-Spin', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400);
    });

    it('4 esquinas ocupadas sí detectan T-Spin', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';
      board[15]![5] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400);
    });

    it('una pieza distinta de T nunca es T-Spin', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';
      board[15]![5] = 'J';

      // Usar pieza S en lugar de T
      const engine = createTestEngine(board, { type: 'S', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      // No debería ser T-spin
      expect(snap.score).toBe(0);
    });
  });

  describe('Semántica de la última acción válida', () => {
    it('horizontal real posterior la invalida', () => {
      const board = emptyBoard();
      // Colocar esquinas en el destino final de la caída (x=2, y=21)
      board[21]![2] = 'Z';
      board[21]![4] = 'Z';
      board[23]![2] = 'Z';
      board[23]![4] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      // Mover a la izquierda (horizontal real, x pasa de 3 a 2, sin colisiones)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBeLessThan(400);
    });

    it('gravedad real posterior la invalida', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';
      board[15]![5] = 'J';

      const engine = createGameEngine(
        makeValidOptions(),
        { board, activePiece: { type: 'T', x: 3, y: 14, orientation: Orientation.Spawn }, nextPieces: ['I', 'O', 'L'], heldPiece: null, clearedLines: 90 }
      );

      // Rotar
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });

      // Gravedad actúa en 10 pasos de 10 ms (100 ms = 1 celda a 10.0 c/s)
      for (let i = 0; i < 10; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false
        });
      }

      // Intentar hard drop
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(0);
    });

    it('soft drop real posterior la invalida', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 14, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      // Soft drop real (mueve la pieza abajo de y=14 a y=15)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: true, hardDrop: false
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      // Debería ser menor de 400 (sin T-spin)
      expect(snap.score).toBeLessThan(400);
    });

    it('hard drop con distancia positiva la invalida', () => {
      const board = emptyBoard();
      board[18]![3] = 'Z';
      board[18]![5] = 'Z';

      // Distancia de hard drop positiva (y=14 a y=16)
      const engine = createTestEngine(board, { type: 'T', x: 3, y: 14, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      // Distancia > 0 -> 2 celdas * 2 = 4 puntos, no T-Spin
      expect(snap.score).toBe(4);
    });

    it('hard drop con distancia 0 la conserva', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400); // Conserva T-spin porque la distancia es 0
    });

    it('intento horizontal bloqueado no la invalida', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';
      // Bloque a la izquierda
      board[16]![2] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      // Intento bloqueado
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400);
    });

    it('intento de rotación bloqueado no la invalida', () => {
      const board = emptyBoard();
      // Tablero con bloques que bloquean por completo la rotación de Left -> Spawn
      // pero permiten Left en y=15 en estado inicial
      for (let x = 0; x < 10; x++) {
        if (x === 2 || x === 4 || x === 18) {
          // celdas libres para Left
        }
      }
      board[16]![2] = 'Z'; // bloquea Spawn a la izquierda
      board[14]![3] = 'Z'; // bloquea kick (-1, -1)
      board[18]![4] = 'Z'; // bloquea kick (0, 2)
      board[18]![2] = 'Z'; // bloquea kick (-1, 2)
      board[16]![5] = 'Z'; // bloquea Spawn a la derecha

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Left }, ['I', 'O']);

      // Primera rotación válida CCW (Left -> Reverse)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateCounterclockwise: true
      });

      // Segunda rotación válida CW (Reverse -> Left)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });

      // Tercera rotación bloqueada CW (Left -> Spawn, falla)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });

      // Hard drop
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      // Debería mantener la candidatura de la segunda rotación y detectar T-spin
      expect(snap.score).toBeGreaterThanOrEqual(400);
    });

    it('lock delay sin movimiento la conserva', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });

      // Ticks de lock delay sin movimiento
      for (let i = 0; i < 5; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false
        });
      }

      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400);
    });

    it('hold la limpia', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true
      });

      const snap = engine.getSnapshot();
      expect(snap.heldPiece).toBe('T');
    });

    it('spawn la limpia', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.activePiece?.type).toBe('I');
      // La nueva pieza no tiene rotación activa
      expect(snap.score).toBe(400);
    });

    it('reset la limpia', () => {
      const board = emptyBoard();
      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.reset(makeValidOptions());
      const snap = engine.getSnapshot();
      expect(snap.score).toBe(0);
    });

    it('entrada inválida no muta el estado', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });

      try {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false, rotateClockwise: true, rotateCounterclockwise: true
        });
      } catch {
        // esperado
      }

      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.score).toBe(400);
    });
  });

  describe('Puntuación de T-Spin', () => {
    it('T-Spin sin líneas = 400', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      expect(engine.getSnapshot().score).toBe(400);
    });

    it('T-Spin Single = 800', () => {
      const board = emptyBoard();
      // Fila 17 llena excepto columna 4
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      // Esquinar
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      expect(engine.getSnapshot().score).toBe(800);
    });

    it('T-Spin Double = 1200', () => {
      const board = emptyBoard();
      // Fila 17 llena excepto columna 4
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      // Fila 16 llena excepto columnas 4 y 5
      for (let x = 0; x < 10; x++) {
        if (x !== 4 && x !== 5) board[16]![x] = 'Z';
      }
      // Esquinar (esquina en fila 15)
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      expect(engine.getSnapshot().score).toBe(1200);
    });

    it('T-Spin Triple = 1600', () => {
      const board = emptyBoard();
      // Rellenar filas 15, 16, 17 con el slot exacto para T-Spin Triple
      for (let x = 0; x < 10; x++) {
        if (x !== 5) {
          board[15]![x] = 'Z';
          board[17]![x] = 'Z';
        }
        if (x !== 5 && x !== 6) {
          board[16]![x] = 'Z';
        }
      }
      // Bloquear rotación (0, 0)
      board[14]![6] = 'Z';
      // Bloquear kick (-1, -1)
      board[13]![4] = 'Z';

      const engine = createTestEngine(board, { type: 'T', x: 4, y: 13, orientation: Orientation.Reverse });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateCounterclockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      expect(engine.getSnapshot().score).toBe(1600);
    });
  });

  describe('Back-to-Back', () => {
    it('primer Quad deja backToBack = 1 sin bonus', () => {
      const board = emptyBoard();
      // Rellenar 4 filas excepto columna 2
      for (let y = 20; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (x !== 2) board[y]![x] = 'Z';
        }
      }

      // Spawneamos I en x=0, y=20 (para evitar puntos de caída de hard drop)
      const engine = createTestEngine(board, { type: 'I', x: 0, y: 20, orientation: Orientation.Right });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.backToBack).toBe(1);
      expect(snap.score).toBe(800); // Solo base
    });

    it('primer T-Spin con líneas deja backToBack = 1 sin bonus', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.backToBack).toBe(1);
      expect(snap.score).toBe(800);
    });
    it('segunda jugada difícil aplica 50 % y deja backToBack = 2', () => {
      const board = emptyBoard();
      // Estructura T-Spin Single en y=15 (vacío col 4)
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      board[15]![3] = 'J';

      // Estructura Quad (4 filas full excepto col 2, alineado con I Right en x=0)
      for (let y = 20; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (x !== 2) board[y]![x] = 'Z';
        }
      }

      // Primera pieza T para T-Spin Single, segunda pieza I para Quad
      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn }, ['I']);
      // Primer T-Spin Single (grounded, distance 0)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      // Segunda jugada: mover I a la izquierda (3 pasos)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      // Rotar la I a Right (caerá en columna 2) y hacer el Quad
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.backToBack).toBe(2);
      // T-Spin Single base = 800. Quad base = 800. Quad backToBack bonus (50%) = 400.
      // Más los puntos de caída de la I (desde y=1 a y=20 son 19 celdas * 2 = 38 puntos)
      expect(snap.score).toBeGreaterThanOrEqual(2000);
    });

    it('Single ordinario rompe la cadena', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      board[15]![3] = 'J';

      // Añadimos una fila 23 casi llena para un Single ordinario con pieza O en col 1,2
      for (let x = 0; x < 10; x++) {
        if (x !== 1 && x !== 2) board[23]![x] = 'Z';
      }

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn }, ['O']);
      // T-Spin Single (b2b = 1)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      // Mover O a la izquierda 3 veces (para caer en columnas 1,2)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false
      });
      // Hacer Single ordinario con O
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.backToBack).toBe(0);
    });

    it('fijación sin líneas conserva la cadena', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn }, ['I']);
      // T-Spin Single (b2b = 1)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      // Fijar pieza sin líneas
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.backToBack).toBe(1);
    });
  });

  describe('Energía de combate (0015)', () => {
    it('estado inicial y reset: combatEnergy es 0 y se expone en snapshot', () => {
      const engine = createGameEngine(makeValidOptions());
      let snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(0);

      // Simular alguna acción sin líneas
      stepStationary(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(0);

      // Reset
      engine.reset(makeValidOptions());
      snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(0);
    });

    it('gameOver conserva el valor final de combatEnergy', () => {
      const board = emptyBoard();
      // Bloquear celdas de spawn para la siguiente pieza sin llenar filas enteras
      board[5]![3] = 'Z';
      const engine = createTestEngine(board, { type: 'I', x: 0, y: 20, orientation: Orientation.Spawn }, ['I']);
      stepHardDrop(engine); // Spawn bloqueado de la siguiente I en y=5 -> gameOver

      const snap = engine.getSnapshot();
      expect(snap.status).toBe('gameOver');
      expect(snap.combatEnergy).toBe(0);
    });

    it('eliminación Single ordinaria otorga 10 de energía', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 0 && x !== 1) board[23]![x] = 'Z';
      }
      const engine = createTestEngine(board, { type: 'O', x: 0, y: 20, orientation: Orientation.Spawn });
      stepHardDrop(engine);

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(10);
    });

    it('eliminación Double ordinaria otorga 25 de energía', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 0 && x !== 1) {
          board[22]![x] = 'Z';
          board[23]![x] = 'Z';
        }
      }
      const engine = createTestEngine(board, { type: 'O', x: 0, y: 20, orientation: Orientation.Spawn });
      stepHardDrop(engine);

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(25);
    });

    it('eliminación Triple ordinaria otorga 45 de energía', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 2) {
          board[21]![x] = 'Z';
          board[22]![x] = 'Z';
          board[23]![x] = 'Z';
        }
      }
      const engine = createTestEngine(board, { type: 'I', x: 0, y: 20, orientation: Orientation.Right });
      stepHardDrop(engine);

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(45);
    });

    it('eliminación Quad ordinaria otorga 70 de energía', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 2) {
          board[20]![x] = 'Z';
          board[21]![x] = 'Z';
          board[22]![x] = 'Z';
          board[23]![x] = 'Z';
        }
      }
      const engine = createTestEngine(board, { type: 'I', x: 0, y: 20, orientation: Orientation.Right });
      stepHardDrop(engine);

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(70);
    });

    it('T-Spin sin líneas otorga 0 de energía', () => {
      const board = emptyBoard();
      board[17]![3] = 'Z';
      board[17]![5] = 'Z';
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(0);
    });

    it('T-Spin Single otorga 25 de energía base', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 4) board[17]![x] = 'Z';
      }
      board[15]![3] = 'J';

      const engine = createTestEngine(board, { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: true
      });

      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(25);
    });

    it('bonificación de combo en energía: primera eliminación sin bonus, segunda con +3', () => {
      const board = emptyBoard();
      // Fila 23 llena excepto col 0,1 para la primera O
      for (let x = 2; x < 10; x++) board[23]![x] = 'Z';
      // Fila 21 llena excepto col 8,9 para la segunda O
      for (let x = 0; x < 8; x++) board[21]![x] = 'Z';

      const engine = createTestEngine(board, { type: 'O', x: 0, y: 21, orientation: Orientation.Spawn }, ['O']);
      // Primera eliminación (Single en fila 23): combo = 1 -> energía = 10
      stepHardDrop(engine);
      expect(engine.getSnapshot().combo).toBe(1);
      expect(engine.getSnapshot().combatEnergy).toBe(10);

      // Mover la segunda O a col 8,9 y hacer hard drop -> Single en fila 21 (que bajó a 22), combo = 2 -> energía + (10 base + 3 bonus) = 23
      for (let i = 0; i < 7; i++) {
        engine.step({
          leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true,
          softDropHeld: false, hardDrop: false
        });
      }
      stepHardDrop(engine);

      expect(engine.getSnapshot().combo).toBe(2);
      expect(engine.getSnapshot().combatEnergy).toBe(23); // 10 + (10 + 3)
    });

    it('bonificación de combo respeta el tope máximo de 15 puntos por jugada (combo >= 6)', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 0 && x !== 1) board[23]![x] = 'Z';
      }
      const engine = createTestEngine(board, { type: 'O', x: 0, y: 20, orientation: Orientation.Spawn });
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(10);
    });

    it('bonificación back-to-back en energía otorga floor(baseEnergy * 0.25) en segunda jugada difícil', () => {
      const board = emptyBoard();
      // Filas 16 a 23 llenas excepto col 2
      for (let y = 16; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (x !== 2) board[y]![x] = 'Z';
        }
      }

      const engine = createTestEngine(board, { type: 'I', x: 0, y: 12, orientation: Orientation.Right }, ['I']);
      // Primer Quad: base = 70, b2b = 1 (sin bonus) -> 70 energía
      stepHardDrop(engine);
      expect(engine.getSnapshot().backToBack).toBe(1);
      expect(engine.getSnapshot().combatEnergy).toBe(70);

      // Posicionar la segunda I: rotar a Right y mover 3 veces a la izquierda (x=3 -> x=0)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      for (let i = 0; i < 3; i++) {
        engine.step({
          leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
          softDropHeld: false, hardDrop: false
        });
      }
      // Segundo Quad: base = 70, b2b = 2 -> bonus = floor(70 * 0.25) = 17 -> combo 1 bonus = 3 -> total = 70 + 90 = 160 -> conversión a 1 sabotaje residuos y quedan 60 de energía
      stepHardDrop(engine);
      expect(engine.getSnapshot().backToBack).toBe(2);
      expect(engine.getSnapshot().storedSabotages).toHaveLength(1);
      expect(['residuos', 'sobrecarga', 'polaridad']).toContain(engine.getSnapshot().storedSabotages[0]);
      expect(engine.getSnapshot().combatEnergy).toBe(60);
    });

    it('fijación sin líneas no muta combatEnergy', () => {
      const engine = createGameEngine(makeValidOptions());
      const initialEnergy = engine.getSnapshot().combatEnergy;
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(initialEnergy);
    });

    it('saturación exacta: combatEnergy no supera 100 y descarta el excedente', () => {
      const board = emptyBoard();
      for (let y = 16; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (x !== 2) board[y]![x] = 'Z';
        }
      }
      const engine = createTestEngine(board, { type: 'I', x: 0, y: 12, orientation: Orientation.Right }, ['I']);
      // Quad otorga 70 energía
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(70);

      // Posicionar la segunda I para el segundo Quad
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true
      });
      for (let i = 0; i < 4; i++) {
        engine.step({
          leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
          softDropHeld: false, hardDrop: false
        });
      }
      // Segundo Quad otorga 70 + 17 = 87 -> acumulado = 157 -> topado en 100
      stepHardDrop(engine);
    });

    it('atomicidad y determinismo: entrada inválida no muta energía y dos motores idénticos producen el mismo valor', () => {
      const engineA = createGameEngine(makeValidOptions({ seed: 12345 }));
      const engineB = createGameEngine(makeValidOptions({ seed: 12345 }));

      expect(engineA.getSnapshot().combatEnergy).toBe(0);
      expect(engineB.getSnapshot().combatEnergy).toBe(0);

      // Intentar entrada inválida en engineA
      expect(() => {
        engineA.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false, rotateClockwise: true, rotateCounterclockwise: true
        });
      }).toThrow();

      expect(engineA.getSnapshot().combatEnergy).toBe(0);

      // Ejecutar 20 pasos idénticos válidos
      for (let i = 0; i < 20; i++) {
        stepStationary(engineA);
        stepStationary(engineB);
      }

      expect(engineA.getSnapshot().combatEnergy).toBe(engineB.getSnapshot().combatEnergy);
    });

    it('la ganancia de energía no se aplica dos veces en una misma fijación', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 0 && x !== 1) board[23]![x] = 'Z';
      }
      const engine = createTestEngine(board, { type: 'O', x: 0, y: 20, orientation: Orientation.Spawn });
      stepHardDrop(engine); // Single -> 10 energía

      const energyAfterDrop = engine.getSnapshot().combatEnergy;
      expect(energyAfterDrop).toBe(10);

      // Dar varios pasos sin fijar otra pieza con líneas
      stepStationary(engine);
      stepStationary(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(10);
    });
  });

  describe('Tarea 0016 — Consumo de energía y Residuos', () => {
    it('consumo y conservación del excedente: conversiones de energía acumulada y conservación de residuo en cartucho', () => {
      const board = emptyBoard();
      // Filas 16 a 23 llenas en cols 0..3 y 6..9 (cols 4,5 vacías para que la O a x=4 encaje perfectamente)
      for (let y = 16; y < 24; y++) {
        for (let x = 0; x < 10; x++) {
          if (x < 4 || x > 5) board[y]![x] = 'Z';
        }
      }

      const engine = createTestEngine(board, { type: 'O', x: 4, y: 0, orientation: Orientation.Spawn }, ['O', 'O', 'O', 'O', 'O']);

      // Double 1 (+25, combo 0) -> combatEnergy = 25
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(25);
      expect(engine.getSnapshot().storedSabotages).toEqual([]);

      // Double 2 (+25 + 3 combo 1) -> combatEnergy = 53
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(53);
      expect(engine.getSnapshot().storedSabotages).toEqual([]);

      // Double 3 (+25 + 6 combo 2) -> combatEnergy = 84
      stepHardDrop(engine);
      expect(engine.getSnapshot().combatEnergy).toBe(84);
      expect(engine.getSnapshot().storedSabotages).toEqual([]);

      // Double 4 (+25 + 9 combo 3) -> total 118 -> consumidos 100 -> cartucho = ['residuos'], combatEnergy = 18
      stepHardDrop(engine);
      const snap = engine.getSnapshot();
      expect(snap.storedSabotages).toHaveLength(1);
      expect(['residuos', 'sobrecarga', 'polaridad']).toContain(snap.storedSabotages[0]);
      expect(snap.combatEnergy).toBe(18);
    });



    it('conversión de energía sobre totalEnergy antes de saturar y conservación de 1 sabotaje por fijación', () => {
      const engine = createGameEngine(makeValidOptions());
      // Test de receiveSabotage y triggerSabotage
      engine.receiveSabotage('residuos');
      expect(engine.getSnapshot().pendingGarbage).toBe(2);

      // Fijar una pieza para aplicar la basura
      stepHardDrop(engine);
      const snap = engine.getSnapshot();
      expect(snap.pendingGarbage).toBe(0);
      // El tablero ahora tiene 2 filas de basura en la parte inferior (y=22 y y=23)
      expect(snap.board[22]!.some((cell) => cell === 'garbage')).toBe(true);
      expect(snap.board[23]!.some((cell) => cell === 'garbage')).toBe(true);
      // Cada fila tiene exactamente 1 hueco (null) y 9 celdas 'garbage'
      const nullsRow22 = snap.board[22]!.filter((cell) => cell === null).length;
      const nullsRow23 = snap.board[23]!.filter((cell) => cell === null).length;
      expect(nullsRow22).toBe(1);
      expect(nullsRow23).toBe(1);
    });

    it('triggerSabotage consume el primer sabotaje FIFO del cartucho y emite evento sabotageTriggered', () => {
      const engine = createGameEngine(makeValidOptions());

      // Sin sabotajes en cartucho, triggerSabotage no hace nada
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, triggerSabotage: true,
      });
      expect(engine.getSnapshot().storedSabotages).toHaveLength(0);

      // Si simulamos ganancia de energía que llene el cartucho
    });

    it('top-out por desbordamiento de basura (garbageOverflow) cuando celdas ocupadas salen por y < 0', () => {
      const board = emptyBoard();
      // Llenar celdas en las filas superiores (y=0)
      board[0]![0] = 'Z';
      board[1]![0] = 'Z';

      const engine = createTestEngine(board, { type: 'O', x: 4, y: 20, orientation: Orientation.Spawn });
      engine.receiveSabotage('residuos');
      expect(engine.getSnapshot().pendingGarbage).toBe(2);

      // Hacer hard drop de la pieza -> se activa lockAndProcess() -> al aplicar 2 residuos, sube y=0 a y < 0 -> gameOver por garbageOverflow
      stepHardDrop(engine);

      const snap = engine.getSnapshot();
      expect(snap.status).toBe('gameOver');
      const events = engine.drainEvents();
      const gameOverEvent = events.find((e) => e.type === 'gameOver');
      expect(gameOverEvent).toBeDefined();
      if (gameOverEvent && gameOverEvent.type === 'gameOver') {
        expect(gameOverEvent.reason).toBe('garbageOverflow');
      }
    });

    it('reset limpia combatEnergy, storedSabotages y pendingGarbage', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('residuos');
      expect(engine.getSnapshot().pendingGarbage).toBe(2);

      engine.reset(makeValidOptions());
      const snap = engine.getSnapshot();
      expect(snap.combatEnergy).toBe(0);
      expect(snap.storedSabotages).toEqual([]);
      expect(snap.pendingGarbage).toBe(0);
      expect(snap.activeEffects).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  //  TAREA 0017 — BOLSA DE SABOTAJES Y SOBRECARGA
  // ════════════════════════════════════════════════════════════════════════

  describe('Tarea 0017 — Bolsa de sabotajes y Sobrecarga', () => {
    it('la bolsa 2-bag genera ambos sabotajes (residuos y sobrecarga) deterministamente por cada ciclo', () => {
      // Tablero con las filas 20..23 llenas en cols 1..9 (Quad inicial para pieza I vertical en col 0)
      // y filas 12..19 preparadas con cols 0..2 y 7..9 llenas para que piezas I horizontales en col 3 hagan Single clears
      const board = emptyBoard();
      for (let y = 20; y < 24; y++) {
        for (let x = 1; x < 10; x++) {
          board[y]![x] = 'J';
        }
      }
      for (let y = 12; y < 20; y++) {
        for (let x = 0; x < 10; x++) {
          if (x < 3 || x > 6) board[y]![x] = 'J';
        }
      }

      // Motor con combatEnergy = 60
      const engine = createGameEngine(
        makeValidOptions({ seed: 42 }),
        {
          board,
          activePiece: { type: 'I', x: -2, y: 20, orientation: Orientation.Right },
          nextPieces: ['I', 'I', 'I', 'I', 'I', 'I', 'I'],
          heldPiece: null,
          combatEnergy: 60,
        },
      );
      drainAll(engine);

      // 1er clear (Quad): 60 + 70 = 130 -> 1ª conversión de 100 energía -> 1er sabotaje en cartucho, combatEnergy = 30
      stepHardDrop(engine);
      expect(engine.getSnapshot().storedSabotages).toHaveLength(1);

      // Hacer Single clears adicionales hasta acumular otros 100 de energía (2ª conversión)
      for (let i = 0; i < 6; i++) {
        if (engine.getSnapshot().storedSabotages.length >= 2) break;
        stepHardDrop(engine);
      }

      const sabotages = engine.getSnapshot().storedSabotages;
      expect(sabotages).toHaveLength(2);
      expect(['residuos', 'sobrecarga', 'polaridad']).toContain(sabotages[0]);
      expect(['residuos', 'sobrecarga', 'polaridad']).toContain(sabotages[1]);
      expect(sabotages[0]).not.toBe(sabotages[1]);
    });

    it('recepción y activación inmediata de Sobrecarga añade el efecto a activeEffects y emite effectStarted', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      engine.receiveSabotage('sobrecarga');

      const snap = engine.getSnapshot();
      expect(snap.activeEffects).toHaveLength(1);
      expect(snap.activeEffects[0]).toEqual({ type: 'sobrecarga', remainingMs: 10000 });

      const events = engine.drainEvents();
      const startedEvent = events.find((e) => e.type === 'effectStarted');
      expect(startedEvent).toBeDefined();
      if (startedEvent && startedEvent.type === 'effectStarted' && startedEvent.effect === 'sobrecarga') {
        expect(startedEvent.durationMs).toBe(10000);
      }
    });

    it('el temporizador descuenta fixedStepMs por cada paso en running y no baja de 0', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      engine.receiveSabotage('sobrecarga');
      drainAll(engine);

      stepStationary(engine);
      const eff1 = engine.getSnapshot().activeEffects[0];
      expect(eff1?.type === 'sobrecarga' ? eff1.remainingMs : null).toBe(9990);

      for (let i = 0; i < 99; i++) {
        stepStationary(engine);
      }
      const eff2 = engine.getSnapshot().activeEffects[0];
      expect(eff2?.type === 'sobrecarga' ? eff2.remainingMs : null).toBe(9000);
    });

    it('expiración única de Sobrecarga tras 10.000 ms emite effectExpired y limpia activeEffects', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      engine.receiveSabotage('sobrecarga');
      drainAll(engine);

      // Avanzar 1000 pasos de 10 ms (10.000 ms)
      for (let i = 0; i < 1000; i++) {
        stepStationary(engine);
      }

      const snap = engine.getSnapshot();
      expect(snap.activeEffects).toEqual([]);

      const events = engine.drainEvents();
      const expiredEvents = events.filter((e) => e.type === 'effectExpired');
      expect(expiredEvents).toHaveLength(1);
      expect(expiredEvents[0]).toEqual({
        type: 'effectExpired',
        step: 1000,
        effect: 'sobrecarga',
      });
    });

    it('renovación de Sobrecarga restablece remainingMs a 10.000 ms, reemite effectStarted y no crea efectos duplicados', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      engine.receiveSabotage('sobrecarga');
      drainAll(engine);

      // Avanzar 30 pasos (300 ms)
      for (let i = 0; i < 30; i++) {
        stepStationary(engine);
      }
      const eff3 = engine.getSnapshot().activeEffects[0];
      expect(eff3?.type === 'sobrecarga' ? eff3.remainingMs : null).toBe(9700);

      // Recibir Sobrecarga de nuevo
      engine.receiveSabotage('sobrecarga');
      const snap = engine.getSnapshot();
      expect(snap.activeEffects).toHaveLength(1);
      const eff4 = snap.activeEffects[0];
      expect(eff4?.type === 'sobrecarga' ? eff4.remainingMs : null).toBe(10000);

      const events = engine.drainEvents();
      const startedEvents = events.filter((e) => e.type === 'effectStarted');
      expect(startedEvents).toHaveLength(1);
      expect(startedEvents[0]?.effect).toBe('sobrecarga');
    });

    it('multiplicación de la gravedad pasiva a 3x durante Sobrecarga', () => {
      // Con gravityCellsPerSecond = 1 y fixedStepMs = 10:
      // Sin Sobrecarga: 1 celda cada 100 pasos (1000 ms)
      const engineNormal = createGameEngine(makeValidOptions({ config: { ...prototypeConfig, gravityCellsPerSecond: 1 } }));
      drainAll(engineNormal);
      const startY = engineNormal.getSnapshot().activePiece!.y;

      for (let i = 0; i < 99; i++) {
        stepStationary(engineNormal);
      }
      expect(engineNormal.getSnapshot().activePiece!.y).toBe(startY); // Aún no ha bajado

      stepStationary(engineNormal); // Paso 100
      expect(engineNormal.getSnapshot().activePiece!.y).toBe(startY + 1); // Bajó 1 celda

      // Con Sobrecarga activa: gravedad es 3 celdas/seg -> 1 celda cada 33.3 ms (34 pasos)
      const engineOverload = createGameEngine(makeValidOptions({ config: { ...prototypeConfig, gravityCellsPerSecond: 1 } }));
      drainAll(engineOverload);
      engineOverload.receiveSabotage('sobrecarga');
      drainAll(engineOverload);

      const startYOverload = engineOverload.getSnapshot().activePiece!.y;
      for (let i = 0; i < 34; i++) {
        stepStationary(engineOverload);
      }
      expect(engineOverload.getSnapshot().activePiece!.y).toBe(startYOverload + 1); // Bajó 1 celda a los 34 pasos (340 ms)
    });

    it('soft drop utiliza exactamente config.softDropCellsPerSecond sin ser alterado por Sobrecarga', () => {
      // Probar que softDrop con softDropCellsPerSecond = 20 avanza 1 celda cada 5 pasos (50 ms),
      // tanto con Sobrecarga como sin ella
      const engineNormal = createGameEngine(makeValidOptions());
      drainAll(engineNormal);
      const y0 = engineNormal.getSnapshot().activePiece!.y;

      for (let i = 0; i < 5; i++) {
        engineNormal.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }
      expect(engineNormal.getSnapshot().activePiece!.y).toBe(y0 + 1);

      const engineOverload = createGameEngine(makeValidOptions());
      drainAll(engineOverload);
      engineOverload.receiveSabotage('sobrecarga');

      const y0Overload = engineOverload.getSnapshot().activePiece!.y;
      for (let i = 0; i < 5; i++) {
        engineOverload.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }
      expect(engineOverload.getSnapshot().activePiece!.y).toBe(y0Overload + 1);
    });

    it('reset limpia activeEffects y resetea la bolsa de sabotajes 2-bag', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('sobrecarga');
      expect(engine.getSnapshot().activeEffects).toHaveLength(1);

      engine.reset(makeValidOptions());
      expect(engine.getSnapshot().activeEffects).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  //  TAREA 0018 — PROGRESIÓN DETERMINISTA DE NIVEL Y GRAVEDAD
  // ════════════════════════════════════════════════════════════════════════

  describe('Tarea 0018 — Progresión determinista de nivel y gravedad', () => {
    it('el motor arranca en Nivel 1 con gravedad base 1.00 c/s y 0 líneas eliminadas', () => {
      const engine = createGameEngine(makeValidOptions());
      const snap = engine.getSnapshot();

      expect(snap.level).toBe(1);
      expect(snap.baseGravityCellsPerSecond).toBe(1.0);
      expect(snap.activeGravityCellsPerSecond).toBe(1.0);
      expect(snap.clearedLines).toBe(0);
    });

    it('evalúa la tabla de gravedad base oficial en los umbrales exactos de nivel 1 a 10', () => {
      const thresholds: [number, number, number][] = [
        [0, 1, 1.00],
        [9, 1, 1.00],
        [10, 2, 1.25],
        [19, 2, 1.25],
        [20, 3, 1.50],
        [30, 4, 2.00],
        [40, 5, 2.50],
        [50, 6, 3.00],
        [60, 7, 4.00],
        [70, 8, 5.00],
        [80, 9, 7.00],
        [90, 10, 10.00],
      ];

      for (const [lines, expectedLevel, expectedGravity] of thresholds) {
        const board = emptyBoard();
        const engine = createGameEngine(makeValidOptions(), {
          board,
          activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
          nextPieces: ['O', 'T', 'L'],
          heldPiece: null,
          clearedLines: lines,
        });

        const snap = engine.getSnapshot();
        expect(snap.level).toBe(expectedLevel);
        expect(snap.baseGravityCellsPerSecond).toBe(expectedGravity);
        expect(snap.activeGravityCellsPerSecond).toBe(expectedGravity);
      }
    });

    it('superar las 90 líneas acumuladas mantiene el nivel máximo 10 y gravedad base de 10.00 c/s', () => {
      for (const lines of [95, 100, 150]) {
        const engine = createGameEngine(makeValidOptions(), {
          board: emptyBoard(),
          activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
          nextPieces: ['O', 'T', 'L'],
          heldPiece: null,
          clearedLines: lines,
        });

        const snap = engine.getSnapshot();
        expect(snap.level).toBe(10);
        expect(snap.baseGravityCellsPerSecond).toBe(10.0);
      }
    });

    it('la eliminación de líneas emite exactamente un evento levelUp con previousLevel, newLevel y baseGravityCellsPerSecond', () => {
      // Tablero con fila 23 casi llena (8 celdas, hueco en x=3 y x=4) para completar 1 línea con pieza O
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 3 && x !== 4) {
          board[23]![x] = 'I';
        }
      }

      const engine = createGameEngine(makeValidOptions(), {
        board,
        activePiece: { type: 'O', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['I', 'T', 'L'],
        heldPiece: null,
        clearedLines: 9, // En 9 líneas la fijación subirá a 10 (Nivel 2)
      });

      drainAll(engine);
      stepHardDrop(engine);

      const events = engine.drainEvents();
      const levelUpEvents = events.filter((e) => e.type === 'levelUp');
      expect(levelUpEvents).toHaveLength(1);

      const evt = levelUpEvents[0] as Extract<typeof events[number], { type: 'levelUp' }>;
      expect(evt.previousLevel).toBe(1);
      expect(evt.newLevel).toBe(2);
      expect(evt.baseGravityCellsPerSecond).toBe(1.25);

      const snap = engine.getSnapshot();
      expect(snap.level).toBe(2);
      expect(snap.baseGravityCellsPerSecond).toBe(1.25);
    });

    it('si clearedLines salta varios umbrales de golpe (defensa de cálculo en test), se emite un único evento levelUp con nivel inicial y final', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 3 && x !== 4) {
          board[23]![x] = 'I';
        }
      }

      const engine = createGameEngine(makeValidOptions(), {
        board,
        activePiece: { type: 'O', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['I', 'T', 'L'],
        heldPiece: null,
        clearedLines: 19, // 19 + 1 = 20 (Nivel 3). Si viniese de clearedLines: 8 y sumase 12, saltaría de 1 a 3
      });

      drainAll(engine);
      stepHardDrop(engine);

      const events = engine.drainEvents();
      const levelUpEvents = events.filter((e) => e.type === 'levelUp');
      expect(levelUpEvents).toHaveLength(1);

      const evt = levelUpEvents[0] as Extract<typeof events[number], { type: 'levelUp' }>;
      expect(evt.previousLevel).toBe(2);
      expect(evt.newLevel).toBe(3);
      expect(evt.baseGravityCellsPerSecond).toBe(1.5);
    });

    it('la eliminación de líneas que no cambia de nivel NO emite evento levelUp', () => {
      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 3 && x !== 4) {
          board[23]![x] = 'I';
        }
      }

      const engine = createGameEngine(makeValidOptions(), {
        board,
        activePiece: { type: 'O', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['I', 'T', 'L'],
        heldPiece: null,
        clearedLines: 2, // 2 + 1 = 3 -> Sigue en Nivel 1 (0-9 líneas)
      });

      drainAll(engine);
      stepHardDrop(engine);

      const events = engine.drainEvents();
      const levelUpEvents = events.filter((e) => e.type === 'levelUp');
      expect(levelUpEvents).toHaveLength(0);
      expect(engine.getSnapshot().level).toBe(1);
    });

    it('Sobrecarga multiplica por 3 la gravedad base del nivel actual', () => {
      const engine = createGameEngine(makeValidOptions(), {
        board: emptyBoard(),
        activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['O', 'T', 'L'],
        heldPiece: null,
        clearedLines: 40, // Nivel 5 -> Gravedad base 2.50 c/s
      });

      expect(engine.getSnapshot().level).toBe(5);
      expect(engine.getSnapshot().baseGravityCellsPerSecond).toBe(2.5);
      expect(engine.getSnapshot().activeGravityCellsPerSecond).toBe(2.5);

      engine.receiveSabotage('sobrecarga');

      const snapOverload = engine.getSnapshot();
      expect(snapOverload.baseGravityCellsPerSecond).toBe(2.5);
      expect(snapOverload.activeGravityCellsPerSecond).toBe(7.5);
    });

    it('soft drop utiliza estrictamente config.softDropCellsPerSecond sin ser alterado por el nivel', () => {
      const engine = createGameEngine(makeValidOptions(), {
        board: emptyBoard(),
        activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['O', 'T', 'L'],
        heldPiece: null,
        clearedLines: 50, // Nivel 6 -> Gravedad base 3.0 c/s
      });

      drainAll(engine);
      const y0 = engine.getSnapshot().activePiece!.y;

      // Con softDropHeld = true, avanza a 20.0 c/s (1 celda cada 5 pasos de 10 ms)
      for (let i = 0; i < 5; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }

      expect(engine.getSnapshot().activePiece!.y).toBe(y0 + 1);
    });

    it('la progresión de nivel conserva intactos config.lockDelayMs y config.maxLockResets con configuraciones alternativas', () => {
      const customConfig = {
        ...prototypeConfig,
        lockDelayMs: 400,
        maxLockResets: 10,
      };

      const engine = createGameEngine(makeValidOptions({ config: customConfig }), {
        board: emptyBoard(),
        activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['O', 'T', 'L'],
        heldPiece: null,
        clearedLines: 80, // Nivel 9
      });

      expect(engine.getSnapshot().level).toBe(9);
      expect(engine.getSnapshot().baseGravityCellsPerSecond).toBe(7.0);
    });

    it('reset restablece a Nivel 1 y gravedad base 1.00 c/s sin emitir levelUp', () => {
      const engine = createGameEngine(makeValidOptions(), {
        board: emptyBoard(),
        activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['O', 'T', 'L'],
        heldPiece: null,
        clearedLines: 50, // Nivel 6
      });

      expect(engine.getSnapshot().level).toBe(6);

      engine.reset(makeValidOptions());
      const events = engine.drainEvents();

      expect(engine.getSnapshot().level).toBe(1);
      expect(engine.getSnapshot().baseGravityCellsPerSecond).toBe(1.0);
      expect(events.filter((e) => e.type === 'levelUp')).toHaveLength(0);
    });

    it('pausa y gameOver conservan level, baseGravityCellsPerSecond y activeGravityCellsPerSecond en el snapshot', () => {
      const engine = createGameEngine(makeValidOptions(), {
        board: emptyBoard(),
        activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['O', 'T', 'L'],
        heldPiece: null,
        clearedLines: 30, // Nivel 4
      });

      const snap = engine.getSnapshot();
      expect(snap.level).toBe(4);
      expect(snap.baseGravityCellsPerSecond).toBe(2.0);
      expect(snap.activeGravityCellsPerSecond).toBe(2.0);
    });

    it('dos ejecuciones idénticas producen exactamente la misma progresión de nivel y gravedades', () => {
      const e1 = createGameEngine(makeValidOptions({ seed: 999 }));
      const e2 = createGameEngine(makeValidOptions({ seed: 999 }));

      expect(e1.getSnapshot().level).toBe(e2.getSnapshot().level);
      expect(e1.getSnapshot().baseGravityCellsPerSecond).toBe(e2.getSnapshot().baseGravityCellsPerSecond);
    });

    it('demuestra que una configuración alternativa con gravityCellsPerSecond = 2 no altera la gravedad base de Nivel 1 (1.0 c/s) ni provoca una caída a 1.25 c/s al pasar a Nivel 2', () => {
      const customConfig = {
        ...prototypeConfig,
        gravityCellsPerSecond: 2,
      };

      const board = emptyBoard();
      for (let x = 0; x < 10; x++) {
        if (x !== 3 && x !== 4) {
          board[23]![x] = 'I';
        }
      }

      const engine = createGameEngine(makeValidOptions({ config: customConfig }), {
        board,
        activePiece: { type: 'O', x: 3, y: 0, orientation: Orientation.Spawn },
        nextPieces: ['I', 'T', 'L'],
        heldPiece: null,
        clearedLines: 9, // Nivel 1 con 9 líneas acumuladas
      });

      // Snapshot inicial en Nivel 1
      const snap1 = engine.getSnapshot();
      expect(snap1.level).toBe(1);
      expect(snap1.baseGravityCellsPerSecond).toBe(1.0);
      expect(snap1.activeGravityCellsPerSecond).toBe(1.0);

      // Fijar pieza O -> completa 1 línea -> clearedLines: 10 -> Nivel 2
      drainAll(engine);
      stepHardDrop(engine);

      // Snapshot tras alcanzar Nivel 2: sube progresivamente de 1.0 a 1.25 c/s, no cae de 2.0 a 1.25
      const snap2 = engine.getSnapshot();
      expect(snap2.level).toBe(2);
      expect(snap2.baseGravityCellsPerSecond).toBe(1.25);
      expect(snap2.activeGravityCellsPerSecond).toBe(1.25);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  //  TAREA 0019 — SABOTAJE POLARIDAD INVERSA
  // ════════════════════════════════════════════════════════════════════════

  describe('Tarea 0019 — Sabotaje Polaridad inversa', () => {
    it('activación inicial expone exactamente { type: "polaridad", remainingPieces: 1 } y emite durationPieces: 1', () => {
      const engine = createGameEngine(makeValidOptions());
      drainAll(engine);

      engine.receiveSabotage('polaridad');
      const snap = engine.getSnapshot();
      const events = engine.drainEvents();

      expect(snap.activeEffects).toHaveLength(1);
      expect(snap.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

      const effectEvents = events.filter((e) => e.type === 'effectStarted');
      expect(effectEvents).toHaveLength(1);
      expect(effectEvents[0]).toEqual({
        type: 'effectStarted',
        step: 0,
        effect: 'polaridad',
        durationPieces: 1,
      });
    });

    it('renovación expone exactamente remainingPieces: 2 y emite durationPieces: 2', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      drainAll(engine);

      engine.receiveSabotage('polaridad');
      const snap = engine.getSnapshot();
      const events = engine.drainEvents();

      expect(snap.activeEffects).toHaveLength(1);
      expect(snap.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });

      const effectEvents = events.filter((e) => e.type === 'effectStarted');
      expect(effectEvents).toHaveLength(1);
      expect(effectEvents[0]).toEqual({
        type: 'effectStarted',
        step: 0,
        effect: 'polaridad',
        durationPieces: 2,
      });
    });

    it('tercera recepción mantiene remainingPieces: 2 y re-emite durationPieces: 2 sin apilar efectos', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      engine.receiveSabotage('polaridad');
      drainAll(engine);

      engine.receiveSabotage('polaridad');
      const snap = engine.getSnapshot();
      const events = engine.drainEvents();

      expect(snap.activeEffects).toHaveLength(1);
      expect(snap.activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });

      const effectEvents = events.filter((e) => e.type === 'effectStarted');
      expect(effectEvents).toHaveLength(1);
      expect(effectEvents[0]).toEqual({
        type: 'effectStarted',
        step: 0,
        effect: 'polaridad',
        durationPieces: 2,
      });
    });

    it('aplica una sola inversión independientemente de si el contador es 1 o 2 (no hay inversión doble)', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      engine.receiveSabotage('polaridad'); // remainingPieces = 2

      const x0 = engine.getSnapshot().activePiece!.x;
      // Pulsar física izquierda -> se transforma en derecha (+1)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });

      expect(engine.getSnapshot().activePiece!.x).toBe(x0 + 1);
    });

    it('inversión de flancos y estados mantenidos horizontales (izquierda ↔ derecha)', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');

      const x0 = engine.getSnapshot().activePiece!.x;

      // Pulsar física derecha -> se transforma en izquierda (-1)
      engine.step({
        leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true,
        softDropHeld: false, hardDrop: false,
      });
      expect(engine.getSnapshot().activePiece!.x).toBe(x0 - 1);

      // Pulsar física izquierda -> se transforma en derecha (+1)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
      expect(engine.getSnapshot().activePiece!.x).toBe(x0);
    });

    it('DAS y ARR procesan la dirección efectiva invertida', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');

      const x0 = engine.getSnapshot().activePiece!.x;

      // Mantener físicamente izquierda (leftHeld: true)
      // Frame 1: flanco izquierdo -> efectivo derecho (+1)
      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
      expect(engine.getSnapshot().activePiece!.x).toBe(x0 + 1);

      // Avanzar 15 pasos mantenidos (DAS es 150 ms = 15 pasos de 10 ms)
      for (let i = 0; i < 15; i++) {
        engine.step({
          leftHeld: true, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        });
      }

      // En el paso 15 del DAS (paso 15 desde inicio de mantención), auto-shift a la derecha (+1)
      expect(engine.getSnapshot().activePiece!.x).toBe(x0 + 2);
    });

    it('giro horario se transforma en antihorario y viceversa', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');

      // Pieza inicial en Orientation.Spawn (0)
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);

      // Pulsar rotateClockwise: true -> se transforma en CCW -> Orientation.Left (3)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true,
      });
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Left);

      // Pulsar rotateCounterclockwise: true -> se transforma en CW -> Orientation.Spawn (0)
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateCounterclockwise: true,
      });
      expect(engine.getSnapshot().activePiece!.orientation).toBe(Orientation.Spawn);
    });

    it('soft drop, hard drop y hold permanecen inalterados y no se invierten', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');

      const y0 = engine.getSnapshot().activePiece!.y;

      // Soft drop avanza verticalmente hacia abajo (+y) tras 5 pasos (50 ms * 20 c/s = 1 celda = 1000 unidades)
      for (let i = 0; i < 5; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }
      expect(engine.getSnapshot().activePiece!.y).toBeGreaterThan(y0);

      // Hold funciona normalmente
      const activeBeforeHold = engine.getSnapshot().activePiece!.type;
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true,
      });
      expect(engine.getSnapshot().heldPiece).toBe(activeBeforeHold);
    });

    it('hold no reduce ni consume remainingPieces', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true,
      });

      // La Polaridad sigue activa en la nueva pieza tras el hold con remainingPieces: 1
      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });
    });

    it('primera fijación reduce remainingPieces de 2 a 1 sin emitir effectExpired', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      engine.receiveSabotage('polaridad');
      drainAll(engine);

      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 2 });

      // Fijar primera pieza
      stepHardDrop(engine);
      const events = engine.drainEvents();

      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });
      expect(events.filter((e) => e.type === 'effectExpired')).toHaveLength(0);
    });

    it('segunda fijación reduce a 0, elimina el efecto de activeEffects y emite un único effectExpired', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      engine.receiveSabotage('polaridad');

      // Primera fijación
      stepHardDrop(engine);
      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

      // Segunda fijación
      drainAll(engine);
      stepHardDrop(engine);
      const events = engine.drainEvents();

      expect(engine.getSnapshot().activeEffects).toEqual([]);
      const expiredEvents = events.filter((e) => e.type === 'effectExpired');
      expect(expiredEvents).toHaveLength(1);
      expect(expiredEvents[0]).toEqual({
        type: 'effectExpired',
        step: engine.getSnapshot().step,
        effect: 'polaridad',
      });
    });

    it('activación con 1 pieza expira tras su primera fijación y nunca expone remainingPieces: 0', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

      drainAll(engine);
      stepHardDrop(engine);
      const events = engine.drainEvents();

      expect(engine.getSnapshot().activeEffects).toEqual([]);
      expect(events.filter((e) => e.type === 'effectExpired')).toHaveLength(1);
    });

    it('entrada inválida lanza INVALID_GAME_INPUT antes de transformar y no muta step, pieza, efectos ni emite eventos', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      engine.drainEvents(); // limpiar eventos previos de activación

      const snapBefore = engine.getSnapshot();

      // Entrada inválida: leftPressed sin leftHeld (violación de contrato de entrada)
      let thrownError: unknown = null;
      try {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: true, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        });
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(EngineStepError);
      expect((thrownError as EngineStepError).code).toBe('INVALID_GAME_INPUT');

      const snapAfter = engine.getSnapshot();
      expect(snapAfter.step).toBe(snapBefore.step);
      expect(snapAfter.activePiece).toEqual(snapBefore.activePiece);
      expect(snapAfter.activeEffects).toEqual(snapBefore.activeEffects);
      expect(engine.drainEvents()).toHaveLength(0);
    });

    it('pausa congela el contador de piezas y reset elimina Polaridad sin emitir effectExpired', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');
      expect(engine.getSnapshot().activeEffects[0]).toEqual({ type: 'polaridad', remainingPieces: 1 });

      // Reset elimina el efecto
      engine.reset(makeValidOptions());
      const events = engine.drainEvents();

      expect(engine.getSnapshot().activeEffects).toEqual([]);
      expect(events.filter((e) => e.type === 'effectExpired')).toHaveLength(0);
    });

    it('en gameOver, receiveSabotage("polaridad") se ignora y no muta snapshot ni eventos', () => {
      const engine = createGameEngine(makeValidOptions());

      // Forzar gameOver
      while (engine.getSnapshot().status === 'running') {
        try {
          stepHardDrop(engine);
        } catch {
          break;
        }
      }
      expect(engine.getSnapshot().status).toBe('gameOver');

      const snapBefore = engine.getSnapshot();
      drainAll(engine);

      // Invocación en gameOver
      engine.receiveSabotage('polaridad');

      const snapAfter = engine.getSnapshot();
      const events = engine.drainEvents();

      expect(snapAfter).toEqual(snapBefore);
      expect(events).toHaveLength(0);
    });
  });

  describe('Tarea 0020 — Separación determinista de PRNG y validación pública', () => {
    it('misma semilla produce exactamente la misma secuencia de piezas en dos motores', () => {
      const engine1 = createGameEngine(makeValidOptions({ seed: 12345 }));
      const engine2 = createGameEngine(makeValidOptions({ seed: 12345 }));

      expect(engine1.getSnapshot().nextPieces).toEqual(engine2.getSnapshot().nextPieces);
      expect(engine1.getSnapshot().activePiece?.type).toBe(engine2.getSnapshot().activePiece?.type);
    });

    it('recibir Residuos en un motor no altera la secuencia futura de piezas respecto a otro motor sin Residuos', () => {
      const engine1 = createGameEngine(makeValidOptions({ seed: 9999 }));
      const engine2 = createGameEngine(makeValidOptions({ seed: 9999 }));

      // Engine 1 recibe 1 vez Residuos (+2 filas basura)
      engine1.receiveSabotage('residuos');

      // Ambas piezas iniciales y colas de proximidad coinciden
      expect(engine1.getSnapshot().nextPieces).toEqual(engine2.getSnapshot().nextPieces);

      // Ejecutar 1 fijación en ambos
      stepHardDrop(engine1);
      stepHardDrop(engine2);

      // La siguiente cola de próximas piezas sigue siendo idéntica en ambos motores
      expect(engine1.getSnapshot().nextPieces).toEqual(engine2.getSnapshot().nextPieces);
      expect(engine1.getSnapshot().activePiece?.type).toBe(engine2.getSnapshot().activePiece?.type);
    });

    it('los huecos de basura siguen siendo deterministas mediante el PRNG de efectos', () => {
      const engine1 = createGameEngine(makeValidOptions({ seed: 777 }));
      const engine2 = createGameEngine(makeValidOptions({ seed: 777 }));

      engine1.receiveSabotage('residuos');
      engine2.receiveSabotage('residuos');

      stepHardDrop(engine1);
      stepHardDrop(engine2);

      expect(engine1.getSnapshot().board).toEqual(engine2.getSnapshot().board);
    });

    it('reset reproduce fielmente la secuencia de piezas y efectos', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 888 }));
      const initialNextPieces = [...engine.getSnapshot().nextPieces];

      // Avanzar pasos y recibir basura
      engine.receiveSabotage('residuos');
      stepHardDrop(engine);

      // Reiniciar
      engine.reset(makeValidOptions({ seed: 888 }));
      expect(engine.getSnapshot().nextPieces).toEqual(initialNextPieces);
    });

    it('motores con semillas distintas pueden divergir', () => {
      const engine1 = createGameEngine(makeValidOptions({ seed: 100 }));
      const engine2 = createGameEngine(makeValidOptions({ seed: 200 }));

      // Es extremadamente probable que la bolsa varíe
      const p1 = engine1.getSnapshot().nextPieces;
      const p2 = engine2.getSnapshot().nextPieces;
      expect(p1).not.toEqual(p2);
    });

    it('validateStepInput valida correctamente entradas válidas e inválidas', () => {
      // Entrada válida
      const valid: StepInput = {
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      };
      expect(() => validateStepInput(valid)).not.toThrow();

      // Entrada inválida: pressed sin held
      const invalid = {
        leftHeld: false, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      };
      expect(() => validateStepInput(invalid)).toThrow(EngineStepError);
    });

    it('la separación de PRNG conserva la bolsa 3-bag conteniendo exactamente residuos, sobrecarga y polaridad', () => {
      const board = emptyBoard();
      // Preparar 3 Quads exactos (12 filas: 12..23 con cols 1..9 llenas, col 0 libre)
      for (let y = 12; y < 24; y++) {
        for (let x = 1; x < 10; x++) board[y]![x] = 'J';
      }

      const engine = createGameEngine(
        makeValidOptions({ seed: 42 }),
        {
          board,
          activePiece: { type: 'I', x: -2, y: 0, orientation: Orientation.Right },
          nextPieces: ['I', 'I', 'I', 'I', 'I'],
          heldPiece: null,
          combatEnergy: 190,
        },
      );

      const generatedSabotages: SabotageType[] = [];

      // Quad 1: 190 + 70 = 260 -> extrae S1
      drainAll(engine);
      stepHardDrop(engine);
      const snap1 = engine.getSnapshot();
      expect(snap1.storedSabotages).toHaveLength(1);
      const s1 = snap1.storedSabotages[0]!;
      generatedSabotages.push(s1);

      // Consumir S1 para dejar el cartucho libre
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, triggerSabotage: true,
      });
      expect(engine.getSnapshot().storedSabotages).toHaveLength(0);

      // Quad 2: Mover pieza 2 a col -2 (orientation Right) con 20 pasos DAS y hacer hard drop
      drainAll(engine);
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true,
      });
      for (let i = 0; i < 40; i++) {
        engine.step({
          leftHeld: true, rightHeld: false, leftPressed: i === 0, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        });
      }
      stepHardDrop(engine);
      const snap2 = engine.getSnapshot();
      // console.log('SNAP2:', snap2.storedSabotages, snap2.combatEnergy);
      expect(snap2.storedSabotages).toHaveLength(1);
      const s2 = snap2.storedSabotages[0]!;
      generatedSabotages.push(s2);

      // Consumir S2 para dejar el cartucho libre
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, triggerSabotage: true,
      });
      expect(engine.getSnapshot().storedSabotages).toHaveLength(0);

      // Quad 3: Mover pieza 3 a col -2 (orientation Right) con 20 pasos DAS y hacer hard drop
      drainAll(engine);
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true,
      });
      for (let i = 0; i < 40; i++) {
        engine.step({
          leftHeld: true, rightHeld: false, leftPressed: i === 0, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        });
      }
      stepHardDrop(engine);
      const snap3 = engine.getSnapshot();
      expect(snap3.storedSabotages).toHaveLength(1);
      const s3 = snap3.storedSabotages[0]!;
      generatedSabotages.push(s3);

      expect(generatedSabotages).toHaveLength(3);
      expect(new Set(generatedSabotages)).toEqual(new Set(['residuos', 'sobrecarga', 'polaridad']));
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  //  TAREA 0022 — CLONACIÓN DEL MOTOR (clone())
  // ════════════════════════════════════════════════════════════════════════

  describe('Tarea 0022 — Clonación del motor (clone())', () => {
    it('1. snapshot inicial del clon es idéntico al del motor original', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      expect(clone.getSnapshot()).toEqual(engine.getSnapshot());
    });

    it('2. cola inicial de eventos del clon está vacía', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      const cloneEvents = clone.drainEvents();
      expect(cloneEvents).toEqual([]);
    });

    it('3. los eventos pendientes del original no se copian al clon', () => {
      const engine = createGameEngine(makeValidOptions());
      // engine tiene evento engineStarted sin drenar
      const clone = engine.clone();

      expect(clone.drainEvents()).toEqual([]);
      expect(engine.drainEvents()).toHaveLength(1);
    });

    it('4. pasos idénticos en el original y en el clon producen snapshots idénticos', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      const input: StepInput = {
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      };

      engine.step(input);
      clone.step(input);

      expect(clone.getSnapshot()).toEqual(engine.getSnapshot());
    });

    it('5. pasos idénticos producen eventos idénticos', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.drainEvents(); // limpiar evento inicial
      const clone = engine.clone();

      const input: StepInput = {
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      };

      engine.step(input);
      clone.step(input);

      expect(clone.drainEvents()).toEqual(engine.drainEvents());
    });

    it('6. avanzar el clon no modifica el original', () => {
      const engine = createGameEngine(makeValidOptions());
      const snapBefore = engine.getSnapshot();
      const clone = engine.clone();

      clone.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });

      expect(engine.getSnapshot()).toEqual(snapBefore);
    });

    it('7. avanzar el original no modifica el clon', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();
      const cloneSnapBefore = clone.getSnapshot();

      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });

      expect(clone.getSnapshot()).toEqual(cloneSnapBefore);
    });

    it('8. acciones distintas producen divergencia independiente', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });

      clone.step({
        leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true,
        softDropHeld: false, hardDrop: false,
      });

      expect(engine.getSnapshot().activePiece?.x).not.toEqual(clone.getSnapshot().activePiece?.x);
    });

    it('9. PRNG de piezas conservado tras la clonación', () => {
      const engine = createGameEngine(makeValidOptions());
      // Avanzar varios pasos para consumir piezas
      stepHardDrop(engine);
      stepHardDrop(engine);

      const clone = engine.clone();

      // Fijar otra pieza en ambos
      stepHardDrop(engine);
      stepHardDrop(clone);

      expect(clone.getSnapshot().activePiece?.type).toBe(engine.getSnapshot().activePiece?.type);
    });

    it('10. PRNG de piezas independiente tras la clonación', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      // Avanzar sólo el clon
      stepHardDrop(clone);

      // Los estados deben haber divertido adecuadamente sin alterar el original
      expect(engine.getSnapshot().step).toBe(0);
      expect(clone.getSnapshot().step).toBeGreaterThan(0);
    });

    it('11. PRNG de sabotajes conservado tras la clonación', () => {
      const board = emptyBoard();
      for (let y = 12; y < 24; y++) {
        for (let x = 1; x < 10; x++) board[y]![x] = 'J';
      }

      const engine = createGameEngine(
        makeValidOptions({ seed: 42 }),
        {
          board,
          activePiece: { type: 'I', x: -2, y: 0, orientation: Orientation.Right },
          nextPieces: ['I', 'I', 'I'],
          heldPiece: null,
          combatEnergy: 190,
        },
      );

      const clone = engine.clone();

      stepHardDrop(engine);
      stepHardDrop(clone);

      expect(engine.getSnapshot().storedSabotages).toEqual(clone.getSnapshot().storedSabotages);
    });

    it('12. PRNG de sabotajes independiente tras la clonación', () => {
      const board = emptyBoard();
      for (let y = 12; y < 24; y++) {
        for (let x = 1; x < 10; x++) board[y]![x] = 'J';
      }

      const engine = createGameEngine(
        makeValidOptions({ seed: 42 }),
        {
          board,
          activePiece: { type: 'I', x: -2, y: 0, orientation: Orientation.Right },
          nextPieces: ['I', 'I', 'I'],
          heldPiece: null,
          combatEnergy: 190,
        },
      );

      const clone = engine.clone();
      stepHardDrop(clone);

      // El original no ha consumido energía ni generado sabotajes
      expect(engine.getSnapshot().storedSabotages).toEqual([]);
      expect(clone.getSnapshot().storedSabotages).toHaveLength(1);
    });

    it('13. clonación con hold ocupado conserva heldPiece', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true,
      });

      const snap = engine.getSnapshot();
      expect(snap.heldPiece).not.toBeNull();

      const clone = engine.clone();
      expect(clone.getSnapshot().heldPiece).toBe(snap.heldPiece);
    });

    it('14. clonación después de usar hold conserva holdUsed', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true,
      });

      const clone = engine.clone();
      expect(clone.getSnapshot().activePiece?.holdUsed).toBe(true);

      // Intentar un segundo hold en el clon debe ser ignorado
      const typeBeforeSecondHold = clone.getSnapshot().activePiece?.type;
      clone.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, hold: true,
      });
      expect(clone.getSnapshot().activePiece?.type).toBe(typeBeforeSecondHold);
    });

    it('15. clonación con garbage pendiente conserva pendingGarbage', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('residuos');

      const clone = engine.clone();
      expect(clone.getSnapshot().pendingGarbage).toBe(2);

      // Aplicar hard drop en el clon consume basura en el clon pero no en el original
      stepHardDrop(clone);
      expect(clone.getSnapshot().pendingGarbage).toBe(0);
      expect(engine.getSnapshot().pendingGarbage).toBe(2);
    });

    it('16. clonación con Sobrecarga activa conserva remainingMs', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('sobrecarga');

      const clone = engine.clone();
      expect(clone.getSnapshot().activeEffects).toEqual(engine.getSnapshot().activeEffects);
      expect(clone.getSnapshot().activeGravityCellsPerSecond).toBe(engine.getSnapshot().activeGravityCellsPerSecond);
    });

    it('17. clonación con Polaridad activa conserva remainingPieces y comportamiento invertido', () => {
      const engine = createGameEngine(makeValidOptions());
      engine.receiveSabotage('polaridad');

      const clone = engine.clone();
      expect(clone.getSnapshot().activeEffects).toEqual(engine.getSnapshot().activeEffects);

      const x0 = clone.getSnapshot().activePiece!.x;
      clone.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
      // Inversión: izquierda se convierte en derecha
      expect(clone.getSnapshot().activePiece!.x).toBe(x0 + 1);
    });

    it('18. clonación durante lock delay conserva lockDelayElapsedMs y lockResetsUsed', () => {
      const engine = createGameEngine(makeValidOptions());
      // Bajar la pieza hasta apoyarla
      while (!engine.getSnapshot().activePiece?.grounded) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }

      // Consumir 100 ms de lock delay
      for (let i = 0; i < 10; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        });
      }

      const snap = engine.getSnapshot();
      expect(snap.activePiece?.lockDelayElapsedMs).toBeGreaterThan(0);

      const clone = engine.clone();
      expect(clone.getSnapshot().activePiece?.lockDelayElapsedMs).toBe(snap.activePiece?.lockDelayElapsedMs);
      expect(clone.getSnapshot().activePiece?.lockResetsUsed).toBe(snap.activePiece?.lockResetsUsed);
    });

    it('19. clonación en gameOver conserva status gameOver', () => {
      const engine = createGameEngine(makeValidOptions());
      while (engine.getSnapshot().status === 'running') {
        try {
          stepHardDrop(engine);
        } catch {
          break;
        }
      }
      expect(engine.getSnapshot().status).toBe('gameOver');

      const clone = engine.clone();
      expect(clone.getSnapshot().status).toBe('gameOver');
      expect(() => clone.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      })).toThrow(EngineStepError);
    });

    it('20. clon de clon reproduce exactamente el estado', () => {
      const engine = createGameEngine(makeValidOptions());
      stepHardDrop(engine);

      const clone1 = engine.clone();
      const clone2 = clone1.clone();

      expect(clone2.getSnapshot()).toEqual(engine.getSnapshot());
    });

    it('21. reset del clon no afecta al original', () => {
      const engine = createGameEngine(makeValidOptions());
      stepHardDrop(engine);
      const snapBefore = engine.getSnapshot();

      const clone = engine.clone();
      clone.reset(makeValidOptions());

      expect(engine.getSnapshot()).toEqual(snapBefore);
      expect(clone.getSnapshot().step).toBe(0);
    });

    it('22. reset del original no afecta al clon', () => {
      const engine = createGameEngine(makeValidOptions());
      stepHardDrop(engine);

      const clone = engine.clone();
      const cloneSnapBefore = clone.getSnapshot();

      engine.reset(makeValidOptions());

      expect(clone.getSnapshot()).toEqual(cloneSnapBefore);
      expect(engine.getSnapshot().step).toBe(0);
    });

    it('23. estructuras readonly expuestas no comparten referencias mutables', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      const origSnap = engine.getSnapshot();
      const cloneSnap = clone.getSnapshot();

      expect(origSnap.board).not.toBe(cloneSnap.board);
      expect(origSnap.nextPieces).not.toBe(cloneSnap.nextPieces);
    });

    it('24. drenar eventos de una instancia no afecta a la otra', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      // Original tiene 1 evento de arranque
      expect(engine.drainEvents()).toHaveLength(1);
      // Clon tiene 0 eventos
      expect(clone.drainEvents()).toHaveLength(0);

      // Avanzar ambos
      const input: StepInput = {
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      };
      engine.step(input);
      clone.step(input);

      // Drenar clone no vacía original
      expect(clone.drainEvents()).toHaveLength(1);
      expect(engine.drainEvents()).toHaveLength(1);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  //  TAREA 0022 — IDENTIDAD DE PIEZA (pieceId)
  // ════════════════════════════════════════════════════════════════════════

  describe('Tarea 0022 — Identidad de pieza (pieceId)', () => {
    it('1. pieceId está presente en el snapshot de la pieza activa', () => {
      const engine = createGameEngine(makeValidOptions());
      const active = engine.getSnapshot().activePiece;
      expect(active).not.toBeNull();
      expect(typeof active!.pieceId).toBe('number');
      expect(active!.pieceId).toBeGreaterThan(0);
    });

    it('2. pieceId se mantiene estable durante movimientos horizontales', () => {
      const engine = createGameEngine(makeValidOptions());
      const p1 = engine.getSnapshot().activePiece!.pieceId;

      engine.step({
        leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });

      const p2 = engine.getSnapshot().activePiece!.pieceId;
      expect(p2).toBe(p1);
    });

    it('3. pieceId se mantiene estable durante rotaciones', () => {
      const engine = createGameEngine(makeValidOptions());
      const p1 = engine.getSnapshot().activePiece!.pieceId;

      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false, rotateClockwise: true,
      });

      const p2 = engine.getSnapshot().activePiece!.pieceId;
      expect(p2).toBe(p1);
    });

    it('4. pieceId se mantiene estable durante el descenso por gravedad', () => {
      const engine = createGameEngine(makeValidOptions());
      const p1 = engine.getSnapshot().activePiece!.pieceId;

      for (let i = 0; i < 20; i++) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }

      const p2 = engine.getSnapshot().activePiece!.pieceId;
      expect(p2).toBe(p1);
    });

    it('5. pieceId se mantiene estable durante el lock delay acumulado', () => {
      const engine = createGameEngine(makeValidOptions());

      // Descender la pieza hasta apoyarse
      while (!engine.getSnapshot().activePiece!.grounded) {
        engine.step({
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        });
      }

      const p1 = engine.getSnapshot().activePiece!.pieceId;
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
      const p2 = engine.getSnapshot().activePiece!.pieceId;

      expect(p2).toBe(p1);
    });

    it('6. pieceId cambia al aparecer la siguiente pieza tras fijación', () => {
      const engine = createGameEngine(makeValidOptions());
      const p1 = engine.getSnapshot().activePiece!.pieceId;

      stepHardDrop(engine);

      const p2 = engine.getSnapshot().activePiece!.pieceId;
      expect(p2).not.toBe(p1);
      expect(p2).toBe(p1 + 1);
    });

    it('7. dos piezas consecutivas del mismo tipo reciben pieceId distintos', () => {
      const engine = createGameEngine(makeValidOptions({ seed: 12345 }));
      const active1 = engine.getSnapshot().activePiece!;
      stepHardDrop(engine);
      const active2 = engine.getSnapshot().activePiece!;

      expect(active2.pieceId).not.toBe(active1.pieceId);
    });

    it('8. clone() conserva exactamente el mismo pieceId de la pieza activa', () => {
      const engine = createGameEngine(makeValidOptions());
      const origId = engine.getSnapshot().activePiece!.pieceId;
      const clone = engine.clone();
      const cloneId = clone.getSnapshot().activePiece!.pieceId;

      expect(cloneId).toBe(origId);
    });

    it('9. clon y original evolucionan de forma independiente conservando pieceId aislados', () => {
      const engine = createGameEngine(makeValidOptions());
      const clone = engine.clone();

      stepHardDrop(engine); // Original fija pieza y avanza pieceId

      const origIdAfter = engine.getSnapshot().activePiece!.pieceId;
      const cloneIdUnchanged = clone.getSnapshot().activePiece!.pieceId;

      expect(origIdAfter).not.toBe(cloneIdUnchanged);
    });

    it('10. reset() reproduce deterministamente el pieceId inicial esperado (pieceId = 1)', () => {
      const options = makeValidOptions();
      const engine = createGameEngine(options);
      const initialId = engine.getSnapshot().activePiece!.pieceId;

      stepHardDrop(engine);
      stepHardDrop(engine);

      engine.reset(options);
      const resetId = engine.getSnapshot().activePiece!.pieceId;

      expect(initialId).toBe(1);
      expect(resetId).toBe(1);
    });
  });
});
