import { type GameConfig, parseGameConfig } from '@rautfall/game-config';

// ── Tipos públicos ──────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type EngineStatus = 'running' | 'gameOver';

export type MoveReason = 'horizontal' | 'gravity' | 'hardDrop';

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
 * `rotateClockwise` y `rotateCounterclockwise` son opcionales (por defecto
 * `false`) y no pueden ser `true` a la vez: esa combinación es entrada
 * inválida y `step()` la rechaza con `EngineStepError`
 * (`code: 'INVALID_GAME_INPUT'`) sin mutar el estado del motor.
 */
export type StepInput = {
  horizontal: -1 | 0 | 1;
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
   * Procesa un paso lógico fijo (horizontal → rotación → hard drop/gravedad,
   * fijación, clear de líneas y spawn de la siguiente pieza). Muta el estado
   * interno del motor y encola los eventos resultantes, recuperables con
   * `drainEvents`.
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
 * (propiedad desconocida, tipo incorrecto o rotación simultánea en ambos
 * sentidos).
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

/**
 * PRNG mulberry32: determinista y reproducible a partir de una semilla
 * uint32. La misma semilla produce siempre la misma secuencia de valores en
 * [0, 1), lo que sostiene el determinismo de la bolsa de siete piezas.
 */
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
  // Barajado Fisher–Yates
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

/**
 * Indica si alguna celda de `cells` es inválida: fuera de los límites del
 * tablero (x fuera de [0, BOARD_COLS) o y fuera de [0, BOARD_ROWS)), o
 * superpuesta a una celda ya ocupada en `board`. No muta `board`.
 */
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

/**
 * Convierte las celdas relativas de una pieza y orientación (definidas en
 * `PIECE_ORIENTATION_CELLS`) a coordenadas absolutas del tablero, sumando el
 * origen (`originX`, `originY`) de la pieza a cada celda relativa.
 */
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

// ── Cálculo del spawn ───────────────────────────────────────────────────

function calculateSpawnX(pieceType: PieceType): number {
  return Math.floor((BOARD_COLS - PIECE_WIDTH[pieceType]) / 2);
}

function calculateSpawnY(pieceType: PieceType): number {
  return HIDDEN_ROWS - PIECE_HEIGHT[pieceType] + 1;
}

// ── Funciones auxiliares de gravedad ────────────────────────────────────

function msPerCellFromConfig(config: GameConfig): number {
  return 1000 / config.gravityCellsPerSecond;
}

/**
 * Distancia máxima (número de celdas) que `piece` puede caer verticalmente
 * antes de colisionar. No muta `board` ni `piece`.
 */
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
  // O usa una tabla vacía
  if (pieceType === 'O') return {};
  return JLSTZ_KICKS;
}

function getTransitionKey(from: Orientation, to: Orientation): string {
  return `${from}>${to}`;
}

/**
 * Intenta rotar `activePiece` en el sentido indicado siguiendo el algoritmo
 * SRS: calcula la orientación destino, obtiene la tabla de wall kicks de la
 * pieza y prueba cada kick en el orden oficial, aplicando el primero cuyas
 * celdas resultantes no colisionen (`isCollision`). La pieza O no usa kicks:
 * solo se comprueba el desplazamiento (0, 0).
 *
 * Si algún candidato es válido, muta `activePiece` (x, y, orientation) in
 * situ y devuelve `true`. Si ninguno lo es, no muta nada y devuelve `false`.
 *
 * @param board celdas fijas del tablero, usadas solo para comprobar colisiones.
 * @param activePiece pieza a rotar; se muta directamente solo si la rotación tiene éxito.
 * @param clockwise `true` para rotación horaria, `false` para antihoraria.
 */
function tryRotate(
  board: (PieceType | null)[][],
  activePiece: ActivePiece,
  clockwise: boolean,
): boolean {
  const pieceType = activePiece.type;

  // Determinar orientación destino
  let targetOrientation: Orientation;
  if (clockwise) {
    targetOrientation = ((activePiece.orientation + 1) % 4) as Orientation;
  } else {
    targetOrientation = ((activePiece.orientation + 3) % 4) as Orientation;
  }

  // Para pieza O: solo actualizar orientación, no hay desplazamiento
  if (pieceType === 'O') {
    const targetCells = computeAbsoluteCells(pieceType, activePiece.x, activePiece.y, targetOrientation);
    if (!isCollision(board, targetCells)) {
      activePiece.orientation = targetOrientation;
      return true;
    }
    return false;
  }

  // Obtener la secuencia de kicks para esta transición
  const transitionKey = getTransitionKey(activePiece.orientation, targetOrientation);
  const kickTable = getKickTable(pieceType);
  const kicks = kickTable[transitionKey];

  // Si no hay tabla de kicks definida para esta transición (no debería ocurrir), fallar
  if (!kicks) return false;

  // Probar cada kick en orden
  for (const kick of kicks) {
    const candidateX = activePiece.x + kick.x;
    const candidateY = activePiece.y + kick.y;
    const candidateCells = computeAbsoluteCells(pieceType, candidateX, candidateY, targetOrientation);

    if (!isCollision(board, candidateCells)) {
      // Aplicar la rotación
      activePiece.x = candidateX;
      activePiece.y = candidateY;
      activePiece.orientation = targetOrientation;
      return true;
    }
  }

  // Ningún kick válido: no mutar
  return false;
}

// ── Creación del motor ──────────────────────────────────────────────────

/**
 * Crea una instancia del motor determinista. Valida `options.seed` (entero
 * en [0, UINT32_MAX]) y `options.config` antes de inicializar el estado, y
 * genera la pieza activa inicial y la siguiente a partir del PRNG sembrado
 * con `options.seed`.
 *
 * Dada la misma semilla, configuración y secuencia de llamadas a `step()`,
 * el motor produce siempre el mismo snapshot y la misma secuencia de
 * eventos.
 *
 * @throws {EngineOptionsError} si `options.seed` o `options.config` no
 *   cumplen su contrato.
 */
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
  let gravityAccumulatorMs = 0;
  let clearedLines = 0;
  const eventQueue: GameEvent[] = [{ type: 'engineStarted', step: 0 }];

  function spawnInitialPieces(): void {
    const firstType = nextFromBag(bagState, prng);
    const secondType = nextFromBag(bagState, prng);
    const spawnX = calculateSpawnX(firstType);
    const spawnY = calculateSpawnY(firstType);
    const cells = computeAbsoluteCells(firstType, spawnX, spawnY, Orientation.Spawn);

    // Si el spawn inicial está bloqueado (no debería ocurrir con el tablero vacío), fin de partida
    if (isCollision(board, cells)) {
      status = 'gameOver';
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      activePiece = null;
      nextPieceType = null;
      return;
    }

    activePiece = { type: firstType, x: spawnX, y: spawnY, orientation: Orientation.Spawn };
    nextPieceType = secondType;
    gravityAccumulatorMs = 0;
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
   * Elimina las filas completas del tablero, desplaza hacia abajo las filas
   * restantes y añade filas vacías en la parte superior. Devuelve los
   * índices (previos al desplazamiento) de las filas eliminadas; vacío si
   * ninguna fila estaba completa.
   */
  function clearLines(): number[] {
    const completeLineIndices: number[] = [];
    for (let y = 0; y < BOARD_ROWS; y++) {
      if (board[y]!.every((cell) => cell !== null)) {
        completeLineIndices.push(y);
      }
    }

    if (completeLineIndices.length === 0) return [];

    // Eliminar las líneas completas y añadir filas vacías en la parte superior
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
    gravityAccumulatorMs = 0;
    eventQueue.push({ type: 'pieceSpawned', step: currentStep, piece: pieceType });
  }

  // Procesamiento interno del paso (pasos 5-12 del orden lógico, §14 de 0002 + §13 de 0003)
  function processStep(input: StepInput): void {
    // 5. Movimiento horizontal
    if (input.horizontal !== 0 && activePiece) {
      const newX = activePiece.x + input.horizontal;
      const cells = computeAbsoluteCells(activePiece.type, newX, activePiece.y, activePiece.orientation);
      if (!isCollision(board, cells)) {
        activePiece.x = newX;
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'horizontal' });
      }
    }

    // 6. Rotación
    if (activePiece) {
      const rotateCW = input.rotateClockwise === true;
      const rotateCCW = input.rotateCounterclockwise === true;

      if (rotateCW || rotateCCW) {
        // rotateClockwise tiene prioridad si ambos son true (nunca debería ocurrir tras la validación)
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
      // Fijación inmediata (distancia 0 -> sin pieceMoved, solo pieceLocked)
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
      return; // El hard drop completa el procesamiento del paso; se omite la gravedad
    }

    // 8. Gravedad (solo si hardDrop es false)
    if (activePiece) {
      const msPerCell = msPerCellFromConfig(config);
      gravityAccumulatorMs += config.fixedStepMs;

      while (gravityAccumulatorMs >= msPerCell) {
        const nextY = activePiece.y + 1;
        const cells = computeAbsoluteCells(activePiece.type, activePiece.x, nextY, activePiece.orientation);
        if (!isCollision(board, cells)) {
          activePiece.y = nextY;
          gravityAccumulatorMs -= msPerCell;
          eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'gravity' });
        } else {
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
          break; // Se detiene el procesamiento de gravedad para este paso
        }
      }
    }
  }

  spawnInitialPieces();

  return {
    step(input: StepInput): void {
      // 1. Comprobar el estado del motor (antes de validar la entrada, según §13)
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
      gravityAccumulatorMs = 0;
      clearedLines = 0;
      eventQueue.length = 0;

      // Genera la pieza activa inicial y la siguiente (igual que en el constructor)
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
        gravityAccumulatorMs = 0;
      }

      eventQueue.push({ type: 'engineReset', step: 0 });
    },
  };
}

// ── Validación de entrada ───────────────────────────────────────────────

/**
 * Valida la forma de `input` contra el contrato de `StepInput`: rechaza
 * propiedades desconocidas, campos ausentes o de tipo incorrecto, y la
 * combinación simultánea de `rotateClockwise` y `rotateCounterclockwise`.
 * No muta `input` ni el estado del motor.
 *
 * @throws {EngineStepError} con `code: 'INVALID_GAME_INPUT'` ante cualquier
 *   incumplimiento del contrato.
 */
function validateInput(input: unknown): asserts input is StepInput {
  if (typeof input !== 'object' || input === null) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      'Input must be an object',
    );
  }

  const obj = input as Record<string, unknown>;

  // Comprobar propiedades desconocidas
  const allowedKeys = ['horizontal', 'hardDrop', 'rotateClockwise', 'rotateCounterclockwise'];
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.includes(key)) {
      throw new EngineStepError(
        'INVALID_GAME_INPUT',
        `Unknown property: ${key}`,
      );
    }
  }

  // Comprobar horizontal
  if (!('horizontal' in obj)) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      'Missing required field: horizontal',
    );
  }

  if (obj.horizontal !== -1 && obj.horizontal !== 0 && obj.horizontal !== 1) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      `horizontal must be -1, 0, or 1, got ${obj.horizontal}`,
    );
  }

  // Comprobar hardDrop
  if (!('hardDrop' in obj)) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      'Missing required field: hardDrop',
    );
  }

  if (typeof obj.hardDrop !== 'boolean') {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      `hardDrop must be boolean, got ${typeof obj.hardDrop}`,
    );
  }

  // Comprobar rotateClockwise si está presente
  if ('rotateClockwise' in obj && typeof obj.rotateClockwise !== 'boolean') {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      `rotateClockwise must be boolean, got ${typeof obj.rotateClockwise}`,
    );
  }

  // Comprobar rotateCounterclockwise si está presente
  if ('rotateCounterclockwise' in obj && typeof obj.rotateCounterclockwise !== 'boolean') {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      `rotateCounterclockwise must be boolean, got ${typeof obj.rotateCounterclockwise}`,
    );
  }

  // Comprobar simultaneidad
  if (obj.rotateClockwise === true && obj.rotateCounterclockwise === true) {
    throw new EngineStepError(
      'INVALID_GAME_INPUT',
      'Cannot rotate both clockwise and counterclockwise simultaneously',
    );
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
