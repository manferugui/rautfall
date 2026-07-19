import { type GameConfig, parseGameConfig } from '@rautfall/game-config';

// ── Tipos públicos ──────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type EngineStatus = 'running' | 'gameOver';

export type MoveReason = 'horizontal' | 'gravity' | 'hardDrop' | 'softDrop';

export type GameOverReason = 'spawnBlocked';

/**
 * Orientación de rotación SRS de la pieza activa (los cuatro estados 0/R/2/L
 * del Super Rotation System). El valor determina qué entrada de
 * `PIECE_ORIENTATION_CELLS` y qué transición de las tablas de wall kicks se
 * aplica en una rotación.
 */
export enum Orientation {
  Spawn = 0,
  Right = 1,
  Reverse = 2,
  Left = 3,
}

export type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | {
      type: 'linesCleared';
      step: number;
      lines: number;
      lineIndices: readonly number[];
    }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation };

/**
 * Estado inmutable de la pieza activa en un instante dado.
 *
 * `x` e `y` son el origen de su bounding box en coordenadas del motor
 * (x→derecha, y→abajo). `cells` son las celdas que ocupa ya resueltas a
 * coordenadas absolutas del tablero (no relativas al origen), listas para
 * componerse directamente sobre `EngineSnapshot['board']`.
 */
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;

export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPiece: PieceType | null;
  clearedLines: number;
}>;

/**
 * Entrada de un paso lógico del motor.
 *
 * `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld`
 * y `hardDrop` son obligatorios y deben ser boolean.
 *
 * `rotateClockwise` y `rotateCounterclockwise` son opcionales (por defecto
 * `false`) y no pueden ser `true` a la vez: esa combinación es entrada
 * inválida y `step()` la rechaza con `EngineStepError`
 * (`code: 'INVALID_GAME_INPUT'`) sin mutar el estado del motor.
 *
 * Reglas de validación adicionales:
 * - `leftPressed === true` requiere `leftHeld === true`
 * - `rightPressed === true` requiere `rightHeld === true`
 * - `leftPressed === true` y `rightPressed === true` simultáneos son inválidos
 */
export type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};

export type EngineOptions = {
  seed: number;
  config: GameConfig;
};

export type GameEngine = {
  /**
   * Procesa un paso lógico fijo (horizontal → rotación → hard drop/gravedad
   * o soft drop, fijación, clear de líneas y spawn de la siguiente pieza).
   * Muta el estado interno del motor y encola los eventos resultantes,
   * recuperables con `drainEvents`.
   *
   * @throws {EngineStepError} con `code: 'ENGINE_NOT_RUNNING'` si el motor ya
   *   está en game over, o `code: 'INVALID_GAME_INPUT'` si `input` no cumple
   *   el contrato de `StepInput`. En ambos casos no se muta el estado ni se
   *   emite ningún evento.
   */
  step(input: StepInput): void;
  /**
   * Devuelve una fotografía inmutable (`Object.freeze` profundo) del estado
   * actual. No muta el motor ni comparte estructuras mutables con su estado
   * interno.
   */
  getSnapshot(): EngineSnapshot;
  /**
   * Vacía la cola interna de eventos y devuelve los emitidos desde la última
   * llamada (o desde la creación o el último `reset()`). Cada llamada
   * consume la cola: una llamada inmediatamente posterior devuelve vacío.
   */
  drainEvents(): readonly GameEvent[];
  /**
   * Reinicia el motor a un estado limpio (tablero vacío, contador de paso a
   * 0, nueva bolsa) con la semilla y configuración indicadas. Válido incluso
   * si el motor estaba en game over.
   *
   * @throws {EngineOptionsError} si `options.seed` o `options.config` no
   *   cumplen su contrato.
   */
  reset(options: EngineOptions): void;
};

// ── Tipos de error ──────────────────────────────────────────────────────

/** Error de opciones inválidas al crear o reiniciar el motor (semilla o configuración fuera de contrato). */
export class EngineOptionsError extends Error {
  readonly code = 'INVALID_ENGINE_OPTIONS';

  constructor(message: string) {
    super(message);
    this.name = 'EngineOptionsError';
  }
}

/**
 * Error al procesar un paso del motor.
 *
 * `code` es `'ENGINE_NOT_RUNNING'` si el motor ya terminó (game over), o
 * `'INVALID_GAME_INPUT'` si `input` no cumple el contrato de `StepInput`
 * (propiedad desconocida, tipo incorrecto, rotación simultánea en ambos
 * sentidos, pressed sin held, o ambos flancos horizontales simultáneos).
 */
export class EngineStepError extends Error {
  readonly code: 'INVALID_GAME_INPUT' | 'ENGINE_NOT_RUNNING';

  constructor(code: 'INVALID_GAME_INPUT' | 'ENGINE_NOT_RUNNING', message: string) {
    super(message);
    this.name = 'EngineStepError';
    this.code = code;
  }
}

// ── Constantes ──────────────────────────────────────────────────────────

const UINT32_MAX = 4_294_967_295;
const BOARD_COLS = 10;
const BOARD_ROWS = 24;
const HIDDEN_ROWS = 4;
const VERTICAL_CELL_UNIT = 1000;

// ── Definición de piezas ────────────────────────────────────────────────

type Cell = { x: number; y: number };

// Celdas relativas por pieza y orientación (coordenadas del motor: x→derecha, y→abajo)
const PIECE_ORIENTATION_CELLS: Record<PieceType, Record<Orientation, readonly Cell[]>> = {
  I: {
    [Orientation.Spawn]: Object.freeze([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]),
  },
  O: {
    [Orientation.Spawn]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
    [Orientation.Left]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
  },
  T: {
    [Orientation.Spawn]: Object.freeze([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]),
  },
  S: {
    [Orientation.Spawn]: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }]),
  },
  Z: {
    [Orientation.Spawn]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }]),
  },
  J: {
    [Orientation.Spawn]: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]),
  },
  L: {
    [Orientation.Spawn]: Object.freeze([{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
    [Orientation.Right]: Object.freeze([{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]),
    [Orientation.Reverse]: Object.freeze([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }]),
    [Orientation.Left]: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }]),
  },
};

const PIECE_WIDTH: Record<PieceType, number> = {
  I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3,
};

const PIECE_HEIGHT: Record<PieceType, number> = {
  I: 1, O: 2, T: 2, S: 2, Z: 2, J: 2, L: 2,
};

const ALL_TYPES: readonly PieceType[] = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

// ── Tablas SRS de wall kicks ────────────────────────────────────────────
// Coordenadas del motor: x→derecha, y→abajo.
// Los valores están convertidos del sistema SRS (y↑) al sistema del motor (y↓):
//   engineX = srsX
//   engineY = -srsY

type KickTable = Record<string, readonly Cell[]>;

// Tabla JLSTZ
const JLSTZ_KICKS: KickTable = {
  '0>1': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }]),
  '1>0': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]),
  '1>2': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }]),
  '2>1': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }]),
  '2>3': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: -1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]),
  '3>2': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: -2 }, { x: -1, y: -2 }]),
  '3>0': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: 2 }, { x: -1, y: 2 }]),
  '0>3': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: -2 }, { x: 1, y: -2 }]),
};

// Tabla I
const I_KICKS: KickTable = {
  '0>1': Object.freeze([{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }]),
  '1>0': Object.freeze([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }]),
  '1>2': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }]),
  '2>1': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }]),
  '2>3': Object.freeze([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 1 }, { x: -1, y: -2 }]),
  '3>2': Object.freeze([{ x: 0, y: 0 }, { x: -2, y: 0 }, { x: 1, y: 0 }, { x: -2, y: -1 }, { x: 1, y: 2 }]),
  '3>0': Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -2, y: 0 }, { x: 1, y: -2 }, { x: -2, y: 1 }]),
  '0>3': Object.freeze([{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 2, y: 0 }, { x: -1, y: 2 }, { x: 2, y: -1 }]),
};

// ── PRNG: mulberry32 ────────────────────────────────────────────────────

function createPrng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Bolsa de siete (seven-bag) ──────────────────────────────────────────

function shuffleBag(prng: () => number): PieceType[] {
  const bag = [...ALL_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    const tmp = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = tmp;
  }
  return bag;
}

function createBag(prng: () => number): { bag: PieceType[]; index: number } {
  return { bag: shuffleBag(prng), index: 0 };
}

function nextFromBag(state: { bag: PieceType[]; index: number }, prng: () => number): PieceType {
  if (state.index >= state.bag.length) {
    state.bag = shuffleBag(prng);
    state.index = 0;
  }
  const piece = state.bag[state.index]!;
  state.index++;
  return piece;
}

// ── Funciones auxiliares del tablero ────────────────────────────────────

function createEmptyBoard(): (PieceType | null)[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null),
  );
}

function boardToReadonly(board: (PieceType | null)[][]): ReadonlyArray<ReadonlyArray<PieceType | null>> {
  return Object.freeze(board.map((row) => Object.freeze([...row])));
}

// ── Comprobación de colisiones ──────────────────────────────────────────

function isCollision(
  board: (PieceType | null)[][],
  cells: Cell[],
): boolean {
  for (const cell of cells) {
    if (cell.x < 0 || cell.x >= BOARD_COLS) return true;
    if (cell.y < 0 || cell.y >= BOARD_ROWS) return true;
    if (board[cell.y]![cell.x] !== null) return true;
  }
  return false;
}

function computeAbsoluteCells(pieceType: PieceType, originX: number, originY: number, orientation: Orientation): Cell[] {
  return PIECE_ORIENTATION_CELLS[pieceType][orientation].map((c) => ({ x: originX + c.x, y: originY + c.y }));
}

// ── Tipo de pieza activa ────────────────────────────────────────────────

type ActivePiece = {
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
};

function activePieceCells(piece: ActivePiece): Cell[] {
  return computeAbsoluteCells(piece.type, piece.x, piece.y, piece.orientation);
}

// ── Estado de temporización horizontal ──────────────────────────────────

type HorizontalPriority = 'left' | 'right' | null;

type HorizontalState = {
  priority: HorizontalPriority;
  accumulatorMs: number;
  hasReachedDas: boolean;
};

function createHorizontalState(): HorizontalState {
  return { priority: null, accumulatorMs: 0, hasReachedDas: false };
}

function resetHorizontalState(state: HorizontalState): void {
  state.priority = null;
  state.accumulatorMs = 0;
  state.hasReachedDas = false;
}

// ── Cálculo del spawn ───────────────────────────────────────────────────

function calculateSpawnX(pieceType: PieceType): number {
  return Math.floor((BOARD_COLS - PIECE_WIDTH[pieceType]) / 2);
}

function calculateSpawnY(pieceType: PieceType): number {
  return HIDDEN_ROWS - PIECE_HEIGHT[pieceType] + 1;
}

// ── Funciones auxiliares ────────────────────────────────────────────────

function hardDropDistance(board: (PieceType | null)[][], piece: ActivePiece): number {
  const cells = activePieceCells(piece);
  let distance = 0;
  while (true) {
    const nextCells = cells.map((c) => ({ x: c.x, y: c.y + distance + 1 }));
    if (isCollision(board, nextCells)) break;
    distance++;
  }
  return distance;
}

// ── Rotación SRS ────────────────────────────────────────────────────────

function getKickTable(pieceType: PieceType): KickTable {
  if (pieceType === 'I') return I_KICKS;
  if (pieceType === 'O') return {};
  return JLSTZ_KICKS;
}

function getTransitionKey(from: Orientation, to: Orientation): string {
  return `${from}>${to}`;
}

function tryRotate(
  board: (PieceType | null)[][],
  activePiece: ActivePiece,
  clockwise: boolean,
): boolean {
  const pieceType = activePiece.type;

  let targetOrientation: Orientation;
  if (clockwise) {
    targetOrientation = ((activePiece.orientation + 1) % 4) as Orientation;
  } else {
    targetOrientation = ((activePiece.orientation + 3) % 4) as Orientation;
  }

  if (pieceType === 'O') {
    const targetCells = computeAbsoluteCells(pieceType, activePiece.x, activePiece.y, targetOrientation);
    if (!isCollision(board, targetCells)) {
      activePiece.orientation = targetOrientation;
      return true;
    }
    return false;
  }

  const transitionKey = getTransitionKey(activePiece.orientation, targetOrientation);
  const kickTable = getKickTable(pieceType);
  const kicks = kickTable[transitionKey];

  if (!kicks) return false;

  for (const kick of kicks) {
    const candidateX = activePiece.x + kick.x;
    const candidateY = activePiece.y + kick.y;
    const candidateCells = computeAbsoluteCells(pieceType, candidateX, candidateY, targetOrientation);

    if (!isCollision(board, candidateCells)) {
      activePiece.x = candidateX;
      activePiece.y = candidateY;
      activePiece.orientation = targetOrientation;
      return true;
    }
  }

  return false;
}

// ── Creación del motor ──────────────────────────────────────────────────

export function createGameEngine(options: EngineOptions): GameEngine {
  validateSeed(options.seed);
  parseGameConfig(options.config);

  const config = options.config;
  let currentStep = 0;
  let currentElapsedMs = 0;
  let currentSeed = options.seed;
  let status: EngineStatus = 'running';
  let board = createEmptyBoard();
  let prng = createPrng(currentSeed);
  let bagState = createBag(prng);
  let activePiece: ActivePiece | null = null;
  let nextPieceType: PieceType | null = null;
  let verticalProgress = 0;
  let clearedLines = 0;
  const eventQueue: GameEvent[] = [{ type: 'engineStarted', step: 0 }];

  // Estado de temporización horizontal
  const horizontalState = createHorizontalState();

  function spawnInitialPieces(): void {
    const firstType = nextFromBag(bagState, prng);
    const secondType = nextFromBag(bagState, prng);
    const spawnX = calculateSpawnX(firstType);
    const spawnY = calculateSpawnY(firstType);
    const cells = computeAbsoluteCells(firstType, spawnX, spawnY, Orientation.Spawn);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      activePiece = null;
      nextPieceType = null;
      return;
    }

    activePiece = { type: firstType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    nextPieceType = secondType;
    resetHorizontalState(horizontalState);
    verticalProgress = 0;
  }

  function lockActivePiece(): void {
    if (!activePiece) return;
    const cells = activePieceCells(activePiece);
    for (const cell of cells) {
      board[cell.y]![cell.x] = activePiece.type;
    }
    eventQueue.push({ type: 'pieceLocked', step: currentStep, piece: activePiece.type });
  }

  function clearLines(): number[] {
    const completeLineIndices: number[] = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      if (board[y]!.every((cell) => cell !== null)) {
        completeLineIndices.push(y);
      }
    }

    if (completeLineIndices.length === 0) return [];

    const newBoard = createEmptyBoard();
    let writeRow = BOARD_ROWS - 1;
    for (let y = BOARD_ROWS - 1; y >= 0; y--) {
      if (!completeLineIndices.includes(y)) {
        newBoard[writeRow] = [...board[y]!];
        writeRow--;
      }
    }
    board = newBoard;

    clearedLines += completeLineIndices.length;
    return completeLineIndices;
  }

  function spawnNextPiece(): void {
    if (!nextPieceType) return;
    const pieceType = nextPieceType;
    const spawnX = calculateSpawnX(pieceType);
    const spawnY = calculateSpawnY(pieceType);
    const cells = computeAbsoluteCells(pieceType, spawnX, spawnY, Orientation.Spawn);

    const nextNext = nextFromBag(bagState, prng);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      activePiece = null;
      nextPieceType = null;
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      return;
    }

    nextPieceType = nextNext;

    activePiece = { type: pieceType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    resetHorizontalState(horizontalState);
    verticalProgress = 0;
    eventQueue.push({ type: 'pieceSpawned', step: currentStep, piece: pieceType });
  }

  /**
   * Intenta mover la pieza activa una celda en la dirección `dir` (-1 = izquierda, +1 = derecha).
   * Si el movimiento es válido, lo aplica y emite `pieceMoved` con motivo `'horizontal'`.
   * Devuelve `true` si el movimiento tuvo éxito, `false` si fue bloqueado.
   */
  function tryMoveHorizontal(dir: -1 | 1): boolean {
    if (!activePiece) return false;
    const newX = activePiece.x + dir;
    const cells = computeAbsoluteCells(activePiece.type, newX, activePiece.y, activePiece.orientation);
    if (!isCollision(board, cells)) {
      activePiece.x = newX;
      eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'horizontal' });
      return true;
    }
    return false;
  }

  /**
   * Activa una dirección horizontal como prioritaria:
   * establece la prioridad, reinicia acumuladores e intenta un movimiento inmediato.
   */
  function activateDirection(dir: 'left' | 'right'): void {
    horizontalState.priority = dir;
    horizontalState.accumulatorMs = 0;
    horizontalState.hasReachedDas = false;
    // Movimiento inmediato
    tryMoveHorizontal(dir === 'left' ? -1 : 1);
  }

  /**
   * Limpia la prioridad horizontal y sus acumuladores.
   */
  function clearPriority(): void {
    horizontalState.priority = null;
    horizontalState.accumulatorMs = 0;
    horizontalState.hasReachedDas = false;
  }

  /**
   * Resuelve la dirección horizontal efectiva del paso y ejecuta las acciones
   * correspondientes (activación, DAS, ARR). Paso 5 del orden lógico.
   */
  function processHorizontal(input: StepInput): void {
    // Reglas 1-6 del §9.1 de la especificación

    // 1. Flanco izquierdo
    if (input.leftPressed) {
      activateDirection('left');
      return;
    }

    // 2. Flanco derecho
    if (input.rightPressed) {
      activateDirection('right');
      return;
    }

    // 3. Prioridad izquierda pero left ya no está mantenida
    if (horizontalState.priority === 'left' && !input.leftHeld) {
      if (input.rightHeld) {
        activateDirection('right');
      } else {
        clearPriority();
      }
      return;
    }

    // 4. Prioridad derecha pero right ya no está mantenida
    if (horizontalState.priority === 'right' && !input.rightHeld) {
      if (input.leftHeld) {
        activateDirection('left');
      } else {
        clearPriority();
      }
      return;
    }

    // 5. Sin prioridad: evaluar estado mantenido
    if (horizontalState.priority === null) {
      if (input.leftHeld && !input.rightHeld) {
        activateDirection('left');
        return;
      }
      if (input.rightHeld && !input.leftHeld) {
        activateDirection('right');
        return;
      }
      // Ninguna mantenida, o ambas sin flanco: no hacer nada
      return;
    }

    // 6. Continuar la secuencia DAS/ARR en curso
    // (la prioridad actual sigue manteniéndose, sin flanco de cambio)
    if (horizontalState.priority !== null) {
      horizontalState.accumulatorMs += config.fixedStepMs;

      const dir = horizontalState.priority === 'left' ? -1 : 1;

      if (!horizontalState.hasReachedDas && horizontalState.accumulatorMs >= config.dasMs) {
        horizontalState.accumulatorMs -= config.dasMs;
        horizontalState.hasReachedDas = true;
        tryMoveHorizontal(dir);
      }

      if (horizontalState.hasReachedDas) {
        while (horizontalState.accumulatorMs >= config.arrMs) {
          horizontalState.accumulatorMs -= config.arrMs;
          tryMoveHorizontal(dir);
        }
      }
    }
  }

  /**
   * Procesa el descenso vertical (gravedad o soft drop). Paso 8 del orden lógico.
   */
  function processVertical(input: StepInput): void {
    if (!activePiece) return;

    const activeCellsPerSecond = input.softDropHeld
      ? config.softDropCellsPerSecond
      : config.gravityCellsPerSecond;

    verticalProgress += config.fixedStepMs * activeCellsPerSecond;

    while (verticalProgress >= VERTICAL_CELL_UNIT) {
      if (!activePiece) break; // Seguridad por si se fijó en la iteración anterior
      const nextY = activePiece.y + 1;
      const cells = computeAbsoluteCells(activePiece.type, activePiece.x, nextY, activePiece.orientation);

      if (!isCollision(board, cells)) {
        activePiece.y = nextY;
        verticalProgress -= VERTICAL_CELL_UNIT;
        const reason = input.softDropHeld ? 'softDrop' : 'gravity';
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason });
      } else {
        // Colisión: fijar la pieza inmediatamente
        lockActivePiece();

        // 9. Eliminación de líneas
        const lineIndices = clearLines();
        if (lineIndices.length > 0) {
          eventQueue.push({
            type: 'linesCleared',
            step: currentStep,
            lines: lineIndices.length,
            lineIndices: Object.freeze([...lineIndices]),
          });
        }

        // 10. Spawn de la siguiente pieza
        spawnNextPiece();
        break; // Detener procesamiento vertical
      }
    }
  }

  function processStep(input: StepInput): void {
    // 5. Movimiento horizontal
    processHorizontal(input);

    // 6. Rotación
    if (activePiece) {
      const rotateCW = input.rotateClockwise === true;
      const rotateCCW = input.rotateCounterclockwise === true;

      if (rotateCW || rotateCCW) {
        const rotated = tryRotate(board, activePiece, rotateCW);
        if (rotated) {
          eventQueue.push({ type: 'pieceRotated', step: currentStep, orientation: activePiece.orientation });
        }
      }
    }

    // 7. Hard drop
    if (input.hardDrop && activePiece) {
      const distance = hardDropDistance(board, activePiece);
      if (distance >= 1) {
        activePiece.y += distance;
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'hardDrop' });
      }
      lockActivePiece();
      const lineIndices = clearLines();
      if (lineIndices.length > 0) {
        eventQueue.push({
          type: 'linesCleared',
          step: currentStep,
          lines: lineIndices.length,
          lineIndices: Object.freeze([...lineIndices]),
        });
      }
      spawnNextPiece();
      return; // Hard drop completa el procesamiento del paso
    }

    // 8. Gravedad o soft drop (solo si no hubo hard drop)
    processVertical(input);
  }

  spawnInitialPieces();

  return {
    step(input: StepInput): void {
      // 1. Comprobar el estado del motor
      if (status === 'gameOver') {
        throw new EngineStepError(
          'ENGINE_NOT_RUNNING',
          'Engine is not running (game over)',
        );
      }

      // 2. Validar la entrada
      validateInput(input);

      // 3. Incrementar el contador de paso
      currentStep++;

      // 4. Incrementar el tiempo lógico
      currentElapsedMs += config.fixedStepMs;

      processStep(input);
    },

    getSnapshot(): EngineSnapshot {
      const boardReadonly = boardToReadonly(board);
      const activePieceSnap: ActivePieceSnapshot | null = activePiece
        ? Object.freeze({
            type: activePiece.type,
            x: activePiece.x,
            y: activePiece.y,
            orientation: activePiece.orientation,
            cells: Object.freeze(
              activePieceCells(activePiece).map((c) => Object.freeze({ x: c.x, y: c.y })),
            ),
          })
        : null;

      return Object.freeze({
        step: currentStep,
        elapsedMs: currentElapsedMs,
        status,
        seed: currentSeed,
        configVersion: config.version,
        board: boardReadonly,
        activePiece: activePieceSnap,
        nextPiece: nextPieceType,
        clearedLines,
      });
    },

    drainEvents(): readonly GameEvent[] {
      const events = eventQueue.slice();
      eventQueue.length = 0;
      return Object.freeze(events);
    },

    reset(options: EngineOptions): void {
      validateSeed(options.seed);
      parseGameConfig(options.config);

      currentStep = 0;
      currentElapsedMs = 0;
      currentSeed = options.seed;
      status = 'running';
      board = createEmptyBoard();
      prng = createPrng(currentSeed);
      bagState = createBag(prng);
      activePiece = null;
      nextPieceType = null;
      verticalProgress = 0;
      clearedLines = 0;
      resetHorizontalState(horizontalState);
      eventQueue.length = 0;

      const firstType = nextFromBag(bagState, prng);
      const secondType = nextFromBag(bagState, prng);
      const spawnX = calculateSpawnX(firstType);
      const spawnY = calculateSpawnY(firstType);
      const cells = computeAbsoluteCells(firstType, spawnX, spawnY, Orientation.Spawn);

      if (isCollision(board, cells)) {
        status = 'gameOver';
        eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
        activePiece = null;
        nextPieceType = null;
      } else {
        activePiece = { type: firstType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
        nextPieceType = secondType;
        resetHorizontalState(horizontalState);
        verticalProgress = 0;
      }

      eventQueue.push({ type: 'engineReset', step: 0 });
    },
  };
}

// ── Validación de entrada ───────────────────────────────────────────────

function validateInput(input: unknown): asserts input is StepInput {
  if (typeof input !== 'object' || input === null) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      'Input must be an object',
    );
  }

  const obj = input as Record<string, unknown>;

  // Comprobar propiedades desconocidas
  const allowedKeys = ['leftHeld', 'rightHeld', 'leftPressed', 'rightPressed', 'softDropHeld', 'hardDrop', 'rotateClockwise', 'rotateCounterclockwise'];
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new EngineStepError(
        'INVALID_GAME_INPUT',
        `Unknown property: ${key}`,
      );
    }
  }

  // Comprobar leftHeld
  if (!('leftHeld' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: leftHeld');
  }
  if (typeof obj.leftHeld !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `leftHeld must be boolean, got ${typeof obj.leftHeld}`);
  }

  // Comprobar rightHeld
  if (!('rightHeld' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: rightHeld');
  }
  if (typeof obj.rightHeld !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `rightHeld must be boolean, got ${typeof obj.rightHeld}`);
  }

  // Comprobar leftPressed
  if (!('leftPressed' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: leftPressed');
  }
  if (typeof obj.leftPressed !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `leftPressed must be boolean, got ${typeof obj.leftPressed}`);
  }

  // Comprobar rightPressed
  if (!('rightPressed' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: rightPressed');
  }
  if (typeof obj.rightPressed !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `rightPressed must be boolean, got ${typeof obj.rightPressed}`);
  }

  // Comprobar softDropHeld
  if (!('softDropHeld' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: softDropHeld');
  }
  if (typeof obj.softDropHeld !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `softDropHeld must be boolean, got ${typeof obj.softDropHeld}`);
  }

  // Comprobar hardDrop
  if (!('hardDrop' in obj)) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Missing required field: hardDrop');
  }
  if (typeof obj.hardDrop !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `hardDrop must be boolean, got ${typeof obj.hardDrop}`);
  }

  // Comprobar rotateClockwise si está presente
  if ('rotateClockwise' in obj && typeof obj.rotateClockwise !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `rotateClockwise must be boolean, got ${typeof obj.rotateClockwise}`);
  }

  // Comprobar rotateCounterclockwise si está presente
  if ('rotateCounterclockwise' in obj && typeof obj.rotateCounterclockwise !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `rotateCounterclockwise must be boolean, got ${typeof obj.rotateCounterclockwise}`);
  }

  // pressed sin held
  if (obj.leftPressed === true && obj.leftHeld === false) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'leftPressed requires leftHeld to be true');
  }
  if (obj.rightPressed === true && obj.rightHeld === false) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'rightPressed requires rightHeld to be true');
  }

  // Ambos flancos simultáneos
  if (obj.leftPressed === true && obj.rightPressed === true) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Cannot have both leftPressed and rightPressed simultaneously');
  }

  // Rotaciones simultáneas
  if (obj.rotateClockwise === true && obj.rotateCounterclockwise === true) {
    throw new EngineStepError('INVALID_GAME_INPUT', 'Cannot rotate both clockwise and counterclockwise simultaneously');
  }
}

// ── Validación de la semilla ────────────────────────────────────────────

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed)) {
    throw new EngineOptionsError(`Seed must be an integer, got ${seed}`);
  }

  if (seed < 0) {
    throw new EngineOptionsError(`Seed must be >= 0, got ${seed}`);
  }

  if (seed > UINT32_MAX) {
    throw new EngineOptionsError(
      `Seed must be <= ${UINT32_MAX}, got ${seed}`,
    );
  }
}
