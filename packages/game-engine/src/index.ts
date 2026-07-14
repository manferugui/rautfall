import { type GameConfig, parseGameConfig } from '@rautfall/game-config';

// ── Tipos públicos ──────────────────────────────────────────────────────

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type EngineStatus = 'running' | 'gameOver';

export type MoveReason = 'horizontal' | 'gravity' | 'hardDrop';

export type GameOverReason = 'spawnBlocked';

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
  | { type: 'gameOver'; step: number; reason: GameOverReason };

export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
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

export type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
};

export type EngineOptions = {
  seed: number;
  config: GameConfig;
};

export type GameEngine = {
  step(input: StepInput): void;
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  reset(options: EngineOptions): void;
};

// ── Tipos de error ──────────────────────────────────────────────────────

export class EngineOptionsError extends Error {
  readonly code = 'INVALID_ENGINE_OPTIONS';

  constructor(message: string) {
    super(message);
    this.name = 'EngineOptionsError';
  }
}

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

const PIECE_CELLS: Record<PieceType, readonly Cell[]> = {
  I: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]),
  O: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
  T: Object.freeze([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
  S: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
  Z: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
  J: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
  L: Object.freeze([{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
};

const PIECE_WIDTH: Record<PieceType, number> = {
  I: 4, O: 2, T: 3, S: 3, Z: 3, J: 3, L: 3,
};

const PIECE_HEIGHT: Record<PieceType, number> = {
  I: 1, O: 2, T: 2, S: 2, Z: 2, J: 2, L: 2,
};

const ALL_TYPES: readonly PieceType[] = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);

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


function computeAbsoluteCells(pieceType: PieceType, originX: number, originY: number): Cell[] {
  return PIECE_CELLS[pieceType].map((c) => ({ x: originX + c.x, y: originY + c.y }));
}

// ── Tipo de pieza activa ────────────────────────────────────────────────

type ActivePiece = {
  type: PieceType;
  x: number;
  y: number;
};

function activePieceCells(piece: ActivePiece): Cell[] {
  return computeAbsoluteCells(piece.type, piece.x, piece.y);
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
  let gravityAccumulatorMs = 0;
  let clearedLines = 0;
  const eventQueue: GameEvent[] = [{ type: 'engineStarted', step: 0 }];

  function spawnInitialPieces(): void {
    const firstType = nextFromBag(bagState, prng);
    const secondType = nextFromBag(bagState, prng);
    const spawnX = calculateSpawnX(firstType);
    const spawnY = calculateSpawnY(firstType);
    const cells = computeAbsoluteCells(firstType, spawnX, spawnY);

    // Si el spawn inicial está bloqueado (no debería ocurrir con el tablero vacío), fin de partida
    if (isCollision(board, cells)) {
      status = 'gameOver';
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      activePiece = null;
      nextPieceType = null;
      return;
    }

    activePiece = { type: firstType, x: spawnX, y: spawnY };
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
    const cells = computeAbsoluteCells(pieceType, spawnX, spawnY);

    const nextNext = nextFromBag(bagState, prng);

    if (isCollision(board, cells)) {
      status = 'gameOver';
      activePiece = null;
      nextPieceType = null;
      eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
      return;
    }

    nextPieceType = nextNext;

    activePiece = { type: pieceType, x: spawnX, y: spawnY };
    gravityAccumulatorMs = 0;
    eventQueue.push({ type: 'pieceSpawned', step: currentStep, piece: pieceType });
  }

  // Procesamiento interno del paso (pasos 5-10 del orden lógico, §14)
  function processStep(input: StepInput): void {
    // 5. Movimiento horizontal
    if (input.horizontal !== 0 && activePiece) {
      const newX = activePiece.x + input.horizontal;
      const cells = computeAbsoluteCells(activePiece.type, newX, activePiece.y);
      if (!isCollision(board, cells)) {
        activePiece.x = newX;
        eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'horizontal' });
      }
    }

    // 6. Hard drop
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

    // 7. Gravedad (solo si hardDrop es false)
    if (activePiece) {
      const msPerCell = msPerCellFromConfig(config);
      gravityAccumulatorMs += config.fixedStepMs;

      while (gravityAccumulatorMs >= msPerCell) {
        const nextY = activePiece.y + 1;
        const cells = computeAbsoluteCells(activePiece.type, activePiece.x, nextY);
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
      const cells = computeAbsoluteCells(firstType, spawnX, spawnY);

      if (isCollision(board, cells)) {
        status = 'gameOver';
        eventQueue.push({ type: 'gameOver', step: currentStep, reason: 'spawnBlocked' });
        activePiece = null;
        nextPieceType = null;
      } else {
        activePiece = { type: firstType, x: spawnX, y: spawnY };
        nextPieceType = secondType;
        gravityAccumulatorMs = 0;
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
  const allowedKeys = ['horizontal', 'hardDrop'];
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
