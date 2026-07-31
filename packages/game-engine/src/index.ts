import { type GameConfig, parseGameConfig } from '@rautfall/game-config';

// ── Tipos públicos ──────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type SabotageType = 'residuos';

export type EngineStatus = 'running' | 'gameOver';

export type MoveReason = 'horizontal' | 'gravity' | 'hardDrop' | 'softDrop';

export type GameOverReason = 'spawnBlocked' | 'garbageOverflow';

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
  | { type: 'pieceRotated'; step: number; orientation: Orientation }
  | { type: 'pieceHeld'; step: number; piece: PieceType }
  | { type: 'sabotageTriggered'; step: number; sabotage: SabotageType }
  | { type: 'garbageApplied'; step: number; linesCount: number };

/**
 * Estado inmutable de la pieza activa en un instante dado.
 *
 * `x` e `y` son el origen de su bounding box en coordenadas del motor
 * (x→derecha, y→abajo). `cells` son las celdas que ocupa ya resueltas a
 * coordenadas absolutas del tablero (no relativas al origen), listas para
 * componerse directamente sobre `EngineSnapshot['board']`.
 *
 * `grounded` indica si la pieza no puede descender una fila en el estado
 * actual. `lockDelayElapsedMs` es el tiempo lógico acumulado en que la pieza
 * ha estado apoyada. `lockResetsUsed` es el número de reinicios de lock delay
 * consumidos por acciones válidas desde que esta pieza se generó.
 * `holdUsed` indica si esta pieza activa ya ha consumido su única reserva.
 */
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;
  lockDelayElapsedMs: number;
  lockResetsUsed: number;
  landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  holdUsed: boolean;
}>;

/**
 * Geometría pública de una pieza en su orientación inicial (Spawn).
 * Celdas normalizadas (mínimo x e y son 0) y bounding box.
 */
export type PieceShape = Readonly<{
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  width: number;
  height: number;
}>;

export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | 'garbage' | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;
  score: number;
  combo: number;
  backToBack: number;
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  pendingGarbage: number;
}>;

/**
 * Entrada de un paso lógico del motor.
 *
 * `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld`
 * y `hardDrop` son obligatorios y deben ser boolean.
 *
 * `rotateClockwise`, `rotateCounterclockwise` y `hold` son opcionales (por
 * defecto `false`) y no pueden ser `true` a la vez: esa combinación es entrada
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
  hold?: boolean;
  triggerSabotage?: boolean;
};

export type EngineOptions = {
  seed: number;
  config: GameConfig;
};

export type GameEngine = {
  /**
   * Procesa un paso lógico fijo (hold → horizontal → rotación → hard drop/gravedad
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
   * Encola un sabotaje entrante en el motor para su posterior aplicación
   * determinista en la siguiente fijación de pieza.
   */
  receiveSabotage(sabotage: SabotageType): void;
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

// ── Constantes de puntuación ────────────────────────────────────────────

const LINE_CLEAR_POINTS: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 100,
  2: 300,
  3: 500,
  4: 800,
});

const SOFT_DROP_POINTS_PER_CELL = 1;
const HARD_DROP_POINTS_PER_CELL = 2;

// ── Constantes de T-Spin ────────────────────────────────────────────────

const T_SPIN_POINTS: Readonly<Record<0 | 1 | 2 | 3, number>> = Object.freeze({
  0: 400,
  1: 800,
  2: 1200,
  3: 1600,
});

const BACK_TO_BACK_BONUS_RATIO = 0.5;

// ── Constantes de energía de combate ────────────────────────────────────

const COMBAT_ENERGY_MAX = 100;

const LINE_CLEAR_ENERGY: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 10,
  2: 25,
  3: 45,
  4: 70,
});

const T_SPIN_ENERGY: Readonly<Record<0 | 1 | 2 | 3, number>> = Object.freeze({
  0: 0,
  1: 25,
  2: 50,
  3: 75,
});

const COMBO_ENERGY_BONUS_PER_STEP = 3;
const COMBO_ENERGY_BONUS_CAP = 5;
const BACK_TO_BACK_ENERGY_BONUS_RATIO = 0.25;

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

function createEmptyBoard(): (PieceType | 'garbage' | null)[][] {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => null),
  );
}

function boardToReadonly(board: (PieceType | 'garbage' | null)[][]): ReadonlyArray<ReadonlyArray<PieceType | 'garbage' | null>> {
  return Object.freeze(board.map((row) => Object.freeze([...row])));
}

function cloneBoard(board: (PieceType | 'garbage' | null)[][]): (PieceType | 'garbage' | null)[][] {
  return board.map((row) => [...row]);
}

// ── Comprobación de colisiones ──────────────────────────────────────────

function isCollision(
  board: (PieceType | 'garbage' | null)[][],
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

// ── Funciones de detección de T-Spin ────────────────────────────────────

/**
 * Cuenta cuántas de las cuatro esquinas alrededor del centro de rotación
 * de la pieza `T` están ocupadas (bloque fijo, pared lateral, suelo o
 * límite superior).
 *
 * El centro de rotación de la T es siempre `(piece.x + 1, piece.y + 1)`
 * con independencia de la orientación.
 */
function countOccupiedCorners(
  board: (PieceType | 'garbage' | null)[][],
  piece: { x: number; y: number },
): number {
  const cx = piece.x + 1;
  const cy = piece.y + 1;
  const corners: Cell[] = [
    { x: cx - 1, y: cy - 1 },
    { x: cx + 1, y: cy - 1 },
    { x: cx - 1, y: cy + 1 },
    { x: cx + 1, y: cy + 1 },
  ];
  return corners.filter((c) => isCornerOccupied(board, c)).length;
}

/**
 * Determina si una celda de esquina está ocupada.
 * Reutiliza la misma semántica de límites que `isCollision`:
 * pared lateral, suelo, límite superior o bloque fijo.
 */
function isCornerOccupied(
  board: (PieceType | 'garbage' | null)[][],
  cell: Cell,
): boolean {
  if (cell.x < 0 || cell.x >= BOARD_COLS) return true;
  if (cell.y < 0 || cell.y >= BOARD_ROWS) return true;
  return board[cell.y]![cell.x] !== null;
}

/**
 * Determina si la fijación actual constituye un T-Spin.
 * La detección se evalúa antes de escribir la pieza en el tablero
 * y antes de eliminar líneas.
 */
function isTSpin(
  board: (PieceType | 'garbage' | null)[][],
  activePiece: { type: PieceType; x: number; y: number },
  lastActionWasRotation: boolean,
): boolean {
  if (activePiece.type !== 'T') return false;
  if (!lastActionWasRotation) return false;
  return countOccupiedCorners(board, activePiece) >= 3;
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

/**
 * Determina si la pieza activa está apoyada: no puede descender una fila
 * en su posición y orientación actuales.
 * Función pura: deriva el resultado del tablero y la posición/orientación
 * actuales, sin efectos secundarios.
 */
function isGrounded(
  board: (PieceType | 'garbage' | null)[][],
  activePiece: ActivePiece | null,
): boolean {
  if (!activePiece) return false;
  const candidateCells = computeAbsoluteCells(
    activePiece.type,
    activePiece.x,
    activePiece.y + 1,
    activePiece.orientation,
  );
  return isCollision(board, candidateCells);
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

function hardDropDistance(board: (PieceType | 'garbage' | null)[][], piece: ActivePiece): number {
  const cells = activePieceCells(piece);
  let distance = 0;
  while (true) {
    const nextCells = cells.map((c) => ({ x: c.x, y: c.y + distance + 1 }));
    if (isCollision(board, nextCells)) break;
    distance++;
  }
  return distance;
}

function computeLandingCells(board: (PieceType | 'garbage' | null)[][], activePiece: ActivePiece): Cell[] {
  const distance = hardDropDistance(board, activePiece);
  return computeAbsoluteCells(
    activePiece.type,
    activePiece.x,
    activePiece.y + distance,
    activePiece.orientation,
  );
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
  board: (PieceType | 'garbage' | null)[][],
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

// ── Función pública de geometría ────────────────────────────────────────

/**
 * Devuelve la geometría de una pieza en su orientación inicial (Spawn),
 * con celdas normalizadas a partir de (0, 0).
 */
export function getPieceShape(type: PieceType): PieceShape {
  const rawCells = PIECE_ORIENTATION_CELLS[type][Orientation.Spawn];
  const minX = Math.min(...rawCells.map((c) => c.x));
  const minY = Math.min(...rawCells.map((c) => c.y));
  const cells = rawCells.map((c) => Object.freeze({ x: c.x - minX, y: c.y - minY }));
  return Object.freeze({
    cells: Object.freeze(cells),
    width: PIECE_WIDTH[type],
    height: PIECE_HEIGHT[type],
  });
}

// ── Creación del motor ──────────────────────────────────────────────────

/**
 * Estado inicial opcional para el motor, usado únicamente por el escenario
 * cerrado de T-Spin (dev). No permite cargar ni editar tableros arbitrarios:
 * solo el escenario nominado `tspin-demo` construye este estado y lo consume
 * mediante `createGameEngine(options, state)`. El tipo es el contrato mínimo
 * para que el escenario dev de `apps/web` pueda preparar el tablero cerrado.
 * @internal
 */
export type TSpinDemoInitialState = {
  board: (PieceType | 'garbage' | null)[][];
  activePiece: ActivePiece;
  nextPieces: PieceType[];
  heldPiece: PieceType | null;
  storedSabotages?: readonly SabotageType[];
  pendingGarbage?: number;
};

export function createGameEngine(
  options: EngineOptions,
  initialState?: TSpinDemoInitialState,
): GameEngine {
  validateSeed(options.seed);
  parseGameConfig(options.config);

  const config = options.config;
  let currentStep = 0;
  let currentElapsedMs = 0;
  let currentSeed = options.seed;
  let status: 'running' | 'gameOver' = 'running';
  // Si se proporciona un estado inicial (solo escenario dev nominado), se
  // usa sin validación adicional: es responsabilidad del escenario.
  let board = initialState ? cloneBoard(initialState.board) : createEmptyBoard();
  let prng = createPrng(currentSeed);
  let bagState = createBag(prng);
  let activePiece: ActivePiece | null = initialState
    ? { ...initialState.activePiece }
    : null;
  /** Cola mutable interna de próximas piezas (longitud siempre 3 tras la creación). */
  let nextPiecesQueue: PieceType[] = initialState
    ? [...initialState.nextPieces]
    : [];
  let verticalProgress = 0;
  let clearedLines = 0;
  let lockDelayElapsedMs = 0;
  let lockResetsUsed = 0;
  let heldPiece: PieceType | null = initialState ? initialState.heldPiece : null;
  let holdUsed = false;
  let score = 0;
  let combo = 0;
  let lastActionWasRotation = false;
  let backToBack = 0;
  let combatEnergy = 0;
  let storedSabotages: SabotageType[] = initialState?.storedSabotages
    ? [...initialState.storedSabotages]
    : [];
  let pendingGarbage = initialState?.pendingGarbage ?? 0;
  const eventQueue: GameEvent[] = [{ type: 'engineStarted', step: 0 }];

  // Estado de temporización horizontal
  const horizontalState = createHorizontalState();

  /** Reinicia los contadores de estado por pieza (spawn, hold entrante, reset). */
  function resetPieceState(): void {
    lockDelayElapsedMs = 0;
    lockResetsUsed = 0;
    holdUsed = false;
    lastActionWasRotation = false;
  }

  /** Genera la pieza activa y rellena la cola con tres próximas piezas. */
  function spawnInitialPieces(): void {
    const firstType = nextFromBag(bagState, prng);
    // Consumir tres piezas adicionales para la cola
    const queuePieces = [
      nextFromBag(bagState, prng),
      nextFromBag(bagState, prng),
      nextFromBag(bagState, prng),
    ];
    const spawnX = calculateSpawnX(firstType);
    const spawnY = calculateSpawnY(firstType);
    const cells = computeAbsoluteCells(firstType, spawnX, spawnY, Orientation.Spawn);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      activePiece = null;
      nextPiecesQueue = queuePieces;
      return;
    }

    activePiece = { type: firstType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    nextPiecesQueue = queuePieces;
    resetHorizontalState(horizontalState);
    verticalProgress = 0;
    resetPieceState();
  }

  function lockActivePiece(): void {
    if (!activePiece) return;
    const cells = activePieceCells(activePiece);
    for (const cell of cells) {
      board[cell.y]![cell.x] = activePiece.type;
    }
    eventQueue.push({ type: 'pieceLocked', step: currentStep, piece: activePiece.type });
  }

  /**
   * Secuencia completa de fijación: evalúa T-Spin, escribe la pieza en el
   * tablero, emite `pieceLocked`, elimina líneas, clasifica la jugada,
   * actualiza combo y back-to-back, calcula puntuación y energía, aplica basura
   * pendiente (Residuos), spawn de la siguiente pieza o game over. Todo ello una sola vez por fijación.
   */
  function lockAndProcess(): void {
    if (!activePiece) return;

    // 1. Evaluar T-Spin antes de escribir la pieza y antes de eliminar líneas
    const tSpinDetected = isTSpin(board, activePiece, lastActionWasRotation);

    // 2. Escribir la pieza en el tablero
    lockActivePiece();

    // 4. Detectar y eliminar líneas
    const lineIndices = clearLines();
    const linesCount = lineIndices.length as 0 | 1 | 2 | 3 | 4;

    // Variables de clasificación
    const hasLines = lineIndices.length > 0;
    let isDifficult = false;

    // 5. Clasificar la jugada
    if (tSpinDetected) {
      const tSpinLines = Math.min(linesCount, 3) as 0 | 1 | 2 | 3;
      const basePoints = T_SPIN_POINTS[tSpinLines];

      if (hasLines) {
        combo += 1;
        isDifficult = true;
      } else {
        combo = 0;
      }

      if (isDifficult) {
        backToBack += 1;
      }

      const comboBonus = combo >= 2 ? 50 * (combo - 1) : 0;
      const backToBackBonus = isDifficult && backToBack >= 2
        ? Math.floor(basePoints * BACK_TO_BACK_BONUS_RATIO)
        : 0;

      const baseEnergy = T_SPIN_ENERGY[tSpinLines];
      const comboEnergyBonus = (hasLines && combo >= 2)
        ? Math.min(combo - 1, COMBO_ENERGY_BONUS_CAP) * COMBO_ENERGY_BONUS_PER_STEP
        : 0;
      const backToBackEnergyBonus = (isDifficult && backToBack >= 2)
        ? Math.floor(baseEnergy * BACK_TO_BACK_ENERGY_BONUS_RATIO)
        : 0;
      const generatedEnergy = baseEnergy + comboEnergyBonus + backToBackEnergyBonus;

      score += basePoints + comboBonus + backToBackBonus;

      const totalEnergy = combatEnergy + generatedEnergy;
      if (storedSabotages.length < 2 && totalEnergy >= 100) {
        storedSabotages.push('residuos');
        combatEnergy = Math.min(COMBAT_ENERGY_MAX, totalEnergy - 100);
      } else {
        combatEnergy = Math.min(COMBAT_ENERGY_MAX, totalEnergy);
      }
    } else {
      if (hasLines) {
        const ordLines = linesCount as 1 | 2 | 3 | 4;
        const basePoints = LINE_CLEAR_POINTS[ordLines];

        combo += 1;

        if (ordLines === 4) {
          isDifficult = true;
          backToBack += 1;
        } else {
          backToBack = 0;
        }

        const comboBonus = combo >= 2 ? 50 * (combo - 1) : 0;
        const backToBackBonus = isDifficult && backToBack >= 2
          ? Math.floor(basePoints * BACK_TO_BACK_BONUS_RATIO)
          : 0;

        const baseEnergy = LINE_CLEAR_ENERGY[ordLines];
        const comboEnergyBonus = combo >= 2
          ? Math.min(combo - 1, COMBO_ENERGY_BONUS_CAP) * COMBO_ENERGY_BONUS_PER_STEP
          : 0;
        const backToBackEnergyBonus = (isDifficult && backToBack >= 2)
          ? Math.floor(baseEnergy * BACK_TO_BACK_ENERGY_BONUS_RATIO)
          : 0;
        const generatedEnergy = baseEnergy + comboEnergyBonus + backToBackEnergyBonus;

        score += basePoints + comboBonus + backToBackBonus;

        const totalEnergy = combatEnergy + generatedEnergy;
        if (storedSabotages.length < 2 && totalEnergy >= 100) {
          storedSabotages.push('residuos');
          combatEnergy = Math.min(COMBAT_ENERGY_MAX, totalEnergy - 100);
        } else {
          combatEnergy = Math.min(COMBAT_ENERGY_MAX, totalEnergy);
        }
      } else {
        combo = 0;
      }
    }

    // 8. Emitir linesCleared si corresponde
    if (hasLines) {
      eventQueue.push({
        type: 'linesCleared',
        step: currentStep,
        lines: lineIndices.length,
        lineIndices: Object.freeze([...lineIndices]),
      });
    }

    // 9. Aplicar basura pendiente (Residuos)
    if (pendingGarbage > 0) {
      const linesToApply = Math.min(pendingGarbage, 2);

      let overflow = false;
      for (let y = 0; y < linesToApply; y++) {
        if (board[y]!.some((cell) => cell !== null)) {
          overflow = true;
          break;
        }
      }

      if (overflow) {
        status = 'gameOver';
        activePiece = null;
        eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'garbageOverflow' });
        return;
      }

      const newBoard = createEmptyBoard();
      for (let y = linesToApply; y < BOARD_ROWS; y++) {
        newBoard[y - linesToApply] = [...board[y]!];
      }

      for (let r = 0; r < linesToApply; r++) {
        const rowY = BOARD_ROWS - linesToApply + r;
        const holeCol = Math.floor(prng() * 10);
        const garbageRow = Array.from({ length: 10 }, (_, col) =>
          col === holeCol ? null : ('garbage' as const),
        );
        newBoard[rowY] = garbageRow;
      }

      board = newBoard;
      pendingGarbage -= linesToApply;
      eventQueue.push({
        type: 'garbageApplied',
        step: currentStep,
        linesCount: linesToApply,
      });
    }

    // 10. Spawn de la siguiente pieza
    spawnNextPiece();
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
    const candidate = nextPiecesQueue.shift()!;
    nextPiecesQueue.push(nextFromBag(bagState, prng));

    const spawnX = calculateSpawnX(candidate);
    const spawnY = calculateSpawnY(candidate);
    const cells = computeAbsoluteCells(candidate, spawnX, spawnY, Orientation.Spawn);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      activePiece = null;
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      return;
    }

    activePiece = { type: candidate, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    resetHorizontalState(horizontalState);
    verticalProgress = 0;
    resetPieceState();
    eventQueue.push({ type: 'pieceSpawned', step: currentStep, piece: candidate });
  }

  function attemptIncomingSpawn(incoming: PieceType): void {
    const spawnX = calculateSpawnX(incoming);
    const spawnY = calculateSpawnY(incoming);
    const cells = computeAbsoluteCells(incoming, spawnX, spawnY, Orientation.Spawn);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      activePiece = null;
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      return;
    }

    activePiece = { type: incoming, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    resetHorizontalState(horizontalState);
    verticalProgress = 0;
    resetPieceState();
    holdUsed = true;
    eventQueue.push({ type: 'pieceSpawned', step: currentStep, piece: incoming });
  }

  function tryMoveHorizontal(dir: -1 | 1): boolean {
    if (!activePiece) return false;

    const groundedBefore = isGrounded(board, activePiece);

    const newX = activePiece.x + dir;
    const cells = computeAbsoluteCells(activePiece.type, newX, activePiece.y, activePiece.orientation);
    if (!isCollision(board, cells)) {
      activePiece.x = newX;
      eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'horizontal' });
      lastActionWasRotation = false;

      if (groundedBefore) {
        const groundedAfter = isGrounded(board, activePiece);
        if (groundedAfter) {
          lockDelayElapsedMs = 0;
          lockResetsUsed += 1;

          if (lockResetsUsed >= config.maxLockResets) {
            lockAndProcess();
            return true;
          }
        } else {
          lockDelayElapsedMs = 0;
        }
      }
      return true;
    }

    return false;
  }

  function activateDirection(dir: 'left' | 'right'): void {
    horizontalState.priority = dir;
    horizontalState.accumulatorMs = 0;
    horizontalState.hasReachedDas = false;
    tryMoveHorizontal(dir === 'left' ? -1 : 1);
  }

  function clearPriority(): void {
    horizontalState.priority = null;
    horizontalState.accumulatorMs = 0;
    horizontalState.hasReachedDas = false;
  }

  function continueIfActive(): boolean {
    return activePiece !== null && status !== 'gameOver';
  }

  function processHorizontal(input: StepInput): void {
    if (input.leftPressed) {
      activateDirection('left');
      return;
    }

    if (input.rightPressed) {
      activateDirection('right');
      return;
    }

    if (horizontalState.priority === 'left' && !input.leftHeld) {
      if (input.rightHeld) {
        activateDirection('right');
      } else {
        clearPriority();
      }
      return;
    }

    if (horizontalState.priority === 'right' && !input.rightHeld) {
      if (input.leftHeld) {
        activateDirection('left');
      } else {
        clearPriority();
      }
      return;
    }

    if (horizontalState.priority === null) {
      if (input.leftHeld && !input.rightHeld) {
        activateDirection('left');
        return;
      }
      if (input.rightHeld && !input.leftHeld) {
        activateDirection('right');
        return;
      }
      return;
    }

    if (horizontalState.priority !== null) {
      horizontalState.accumulatorMs += config.fixedStepMs;

      const dir = horizontalState.priority === 'left' ? -1 : 1;

      if (!horizontalState.hasReachedDas && horizontalState.accumulatorMs >= config.dasMs) {
        horizontalState.accumulatorMs -= config.dasMs;
        horizontalState.hasReachedDas = true;
        tryMoveHorizontal(dir);
      }

      if (horizontalState.hasReachedDas && activePiece) {
        while (horizontalState.accumulatorMs >= config.arrMs) {
          horizontalState.accumulatorMs -= config.arrMs;
          tryMoveHorizontal(dir);
          if (!activePiece) break;
        }
      }
    }
  }

  function processVertical(input: StepInput): void {
    if (!activePiece) return;

    const activeCellsPerSecond = input.softDropHeld
      ? config.softDropCellsPerSecond
      : config.gravityCellsPerSecond;

    verticalProgress += config.fixedStepMs * activeCellsPerSecond;

    while (verticalProgress >= VERTICAL_CELL_UNIT) {
      if (!activePiece) break;
      const nextY = activePiece.y + 1;
      const cells = computeAbsoluteCells(activePiece.type, activePiece.x, nextY, activePiece.orientation);

      verticalProgress -= VERTICAL_CELL_UNIT;

      if (!isCollision(board, cells)) {
        activePiece.y = nextY;
        const reason = input.softDropHeld ? 'softDrop' : 'gravity';
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason });
        if (reason === 'softDrop') {
          score += SOFT_DROP_POINTS_PER_CELL;
        }
        lastActionWasRotation = false;
      }
    }
  }

  function processStep(input: StepInput): void {
    if (input.hold === true && activePiece) {
      if (!holdUsed) {
        const outgoing = activePiece.type;

        if (heldPiece === null) {
          const incoming = nextPiecesQueue.shift()!;
          nextPiecesQueue.push(nextFromBag(bagState, prng));
          heldPiece = outgoing;
          eventQueue.push({ type: 'pieceHeld', step: currentStep, piece: outgoing });
          attemptIncomingSpawn(incoming);
        } else {
          const incoming = heldPiece;
          heldPiece = outgoing;
          eventQueue.push({ type: 'pieceHeld', step: currentStep, piece: outgoing });
          attemptIncomingSpawn(incoming);
        }
        return;
      }
    }

    processHorizontal(input);
    if (!continueIfActive()) return;

    if (activePiece) {
      const rotateCW = input.rotateClockwise === true;
      const rotateCCW = input.rotateCounterclockwise === true;

      if (rotateCW || rotateCCW) {
        const groundedBefore = isGrounded(board, activePiece);

        const rotated = tryRotate(board, activePiece, rotateCW);
        if (rotated) {
          eventQueue.push({ type: 'pieceRotated', step: currentStep, orientation: activePiece.orientation });
          lastActionWasRotation = true;

          if (groundedBefore) {
            const groundedAfter = isGrounded(board, activePiece);
            if (groundedAfter) {
              lockDelayElapsedMs = 0;
              lockResetsUsed += 1;

              if (lockResetsUsed >= config.maxLockResets) {
                lockAndProcess();
                return;
              }
            } else {
              lockDelayElapsedMs = 0;
            }
          }
        }
      }
    }
    if (!continueIfActive()) return;

    if (input.hardDrop && activePiece) {
      const distance = hardDropDistance(board, activePiece);
      if (distance >= 1) {
        activePiece.y += distance;
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'hardDrop' });
        score += distance * HARD_DROP_POINTS_PER_CELL;
        lastActionWasRotation = false;
      }
      lockAndProcess();
      return;
    }

    processVertical(input);
    if (!continueIfActive()) return;

    if (activePiece) {
      const groundedAtEndOfStep = isGrounded(board, activePiece);

      if (groundedAtEndOfStep) {
        lockDelayElapsedMs += config.fixedStepMs;

        if (lockDelayElapsedMs >= config.lockDelayMs) {
          lockAndProcess();
          return;
        }
      } else {
        lockDelayElapsedMs = 0;
      }
    }
  }

  if (!initialState) {
    spawnInitialPieces();
  }

  return {
    step(input: StepInput): void {
      if (status === 'gameOver') {
        throw new EngineStepError(
          'ENGINE_NOT_RUNNING',
          'Engine is not running (game over)',
        );
      }

      validateInput(input);

      currentStep++;
      currentElapsedMs += config.fixedStepMs;

      if (input.triggerSabotage === true && storedSabotages.length > 0) {
        const sabotage = storedSabotages.shift()!;
        eventQueue.push({ type: 'sabotageTriggered', step: currentStep, sabotage });
      }

      processStep(input);
    },

    getSnapshot(): EngineSnapshot {
      const boardReadonly = boardToReadonly(board);
      const grounded = isGrounded(board, activePiece);
      const activePieceSnap: ActivePieceSnapshot | null = activePiece
        ? Object.freeze({
            type: activePiece.type,
            x: activePiece.x,
            y: activePiece.y,
            orientation: activePiece.orientation,
            cells: Object.freeze(
              activePieceCells(activePiece).map((c) => Object.freeze({ x: c.x, y: c.y })),
            ),
            grounded,
            lockDelayElapsedMs,
            lockResetsUsed,
            landingCells: Object.freeze(
              computeLandingCells(board, activePiece).map((c) => Object.freeze({ x: c.x, y: c.y })),
            ),
            holdUsed,
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
        nextPieces: Object.freeze([...nextPiecesQueue]),
        clearedLines,
        heldPiece,
        score,
        combo,
        backToBack,
        combatEnergy,
        storedSabotages: Object.freeze([...storedSabotages]),
        pendingGarbage,
      });
    },

    drainEvents(): readonly GameEvent[] {
      const events = eventQueue.slice();
      eventQueue.length = 0;
      return Object.freeze(events);
    },

    receiveSabotage(sabotage: SabotageType): void {
      if (sabotage === 'residuos') {
        pendingGarbage += 2;
      }
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
      nextPiecesQueue = [];
      verticalProgress = 0;
      clearedLines = 0;
      lockDelayElapsedMs = 0;
      lockResetsUsed = 0;
      heldPiece = null;
      holdUsed = false;
      score = 0;
      combo = 0;
      lastActionWasRotation = false;
      backToBack = 0;
      combatEnergy = 0;
      storedSabotages = [];
      pendingGarbage = 0;
      resetHorizontalState(horizontalState);
      eventQueue.length = 0;

      const firstType = nextFromBag(bagState, prng);
      const secondType = nextFromBag(bagState, prng);
      const thirdType = nextFromBag(bagState, prng);
      const fourthType = nextFromBag(bagState, prng);
      const spawnX = calculateSpawnX(firstType);
      const spawnY = calculateSpawnY(firstType);
      const cells = computeAbsoluteCells(firstType, spawnX, spawnY, Orientation.Spawn);

      if (isCollision(board, cells)) {
        status = 'gameOver';
        eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
        activePiece = null;
        nextPiecesQueue = [secondType, thirdType, fourthType];
      } else {
        activePiece = { type: firstType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
        nextPiecesQueue = [secondType, thirdType, fourthType];
        resetHorizontalState(horizontalState);
        verticalProgress = 0;
        resetPieceState();
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
  const allowedKeys = [
    'leftHeld', 'rightHeld', 'leftPressed', 'rightPressed',
    'softDropHeld', 'hardDrop', 'rotateClockwise', 'rotateCounterclockwise',
    'hold', 'triggerSabotage',
  ];
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

  // Comprobar hold si está presente
  if ('hold' in obj && typeof obj.hold !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `hold must be boolean, got ${typeof obj.hold}`);
  }

  // Comprobar triggerSabotage si está presente
  if ('triggerSabotage' in obj && typeof obj.triggerSabotage !== 'boolean') {
    throw new EngineStepError('INVALID_GAME_INPUT', `triggerSabotage must be boolean, got ${typeof obj.triggerSabotage}`);
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
