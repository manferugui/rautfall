import {
  Orientation,
  type GameEngine,
  type StepInput,
} from '@rautfall/game-engine';
import {
  evaluateBoardMetrics,
  scoreBoardMetrics,
  computeHoles,
  computeColumnHeights,
  type BoardCell,
} from './board-evaluator';
import type {
  BotAction,
  BotConfig,
  PlacementCandidate,
} from './types';

export const BOT_MAX_SEARCH_NODES = 500;

export type SearchMetrics = Readonly<{
  nodesExplored: number;
  nodesDeduplicated: number;
  candidatesFound: number;
  nonTerminalCandidateCount: number;
  reachedNodeLimit: boolean;
}>;

export type SearchResult = Readonly<{
  bestCandidate: PlacementCandidate | null;
  allCandidates: readonly PlacementCandidate[];
  nonTerminalCandidates: readonly PlacementCandidate[];
  searchMetrics: SearchMetrics;
}>;

const ORIENTATION_ORDER: Record<Orientation, number> = {
  [Orientation.Spawn]: 0,
  [Orientation.Right]: 1,
  [Orientation.Reverse]: 2,
  [Orientation.Left]: 3,
};

/**
 * Genera una huella digital determinista del tablero visible (filas 4 a 23).
 */
export function computeBoardFingerprint(board: ReadonlyArray<ReadonlyArray<BoardCell>>): string {
  let fp = '';
  for (let y = 4; y < 24; y++) {
    const row = board[y];
    if (!row) continue;
    for (let x = 0; x < 10; x++) {
      const cell = row[x];
      if (cell === null || cell === undefined) {
        fp += '.';
      } else if (cell === 'garbage') {
        fp += 'G';
      } else {
        fp += cell[0];
      }
    }
  }
  return fp;
}

const STEP_INPUT_MAP: Record<Exclude<BotAction, 'hardDrop' | 'wait' | 'softDrop'>, StepInput> = {
  rotateClockwise: {
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: false, hardDrop: false, rotateClockwise: true,
  },
  rotateCounterClockwise: {
    leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
    softDropHeld: false, hardDrop: false, rotateCounterclockwise: true,
  },
  left: {
    leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
    softDropHeld: false, hardDrop: false,
  },
  right: {
    leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true,
    softDropHeld: false, hardDrop: false,
  },
};

const HARD_DROP_INPUT: StepInput = {
  leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
  softDropHeld: false, hardDrop: true,
};

const EXPANSION_ACTIONS: readonly Exclude<BotAction, 'hardDrop' | 'wait' | 'softDrop'>[] = [
  'rotateClockwise',
  'rotateCounterClockwise',
  'left',
  'right',
];

/**
 * Criterio de desempate canónico de 7 niveles con filtro estricto de supervivencia
 * y penalización por longitud de plan.
 */
export function compareCandidates(a: PlacementCandidate, b: PlacementCandidate): number {
  // 1. Supervivencia estricta (no terminal > terminal)
  if (a.isGameOver !== b.isGameOver) {
    return a.isGameOver ? 1 : -1;
  }

  // 2. Mayor puntuación heurística
  if (Math.abs(a.heuristicScore - b.heuristicScore) > 1e-6) {
    return b.heuristicScore - a.heuristicScore;
  }

  // 3. Más líneas eliminadas
  if (a.linesCleared !== b.linesCleared) {
    return b.linesCleared - a.linesCleared;
  }

  // 4. Menos huecos nuevos, luego menos huecos resultantes
  if (a.newHoles !== b.newHoles) {
    return a.newHoles - b.newHoles;
  }
  if (a.resultingHoles !== b.resultingHoles) {
    return a.resultingHoles - b.resultingHoles;
  }

  // 5. Menos ocupación de filas ocultas, menor altura máxima y menor riesgo de top-out
  if (a.hiddenRowOccupancy !== b.hiddenRowOccupancy) {
    return a.hiddenRowOccupancy - b.hiddenRowOccupancy;
  }
  if (a.maxHeight !== b.maxHeight) {
    return a.maxHeight - b.maxHeight;
  }
  if (a.topOutRisk !== b.topOutRisk) {
    return a.topOutRisk - b.topOutRisk;
  }

  // 6. Plan más corto (menor número de acciones)
  if (a.actions.length !== b.actions.length) {
    return a.actions.length - b.actions.length;
  }

  // 7. Orden canónico de orientación, menor X y ruta lexicográfica
  const orientA = ORIENTATION_ORDER[a.targetPlacement.orientation];
  const orientB = ORIENTATION_ORDER[b.targetPlacement.orientation];
  if (orientA !== orientB) {
    return orientA - orientB;
  }

  if (a.targetPlacement.x !== b.targetPlacement.x) {
    return a.targetPlacement.x - b.targetPlacement.x;
  }

  const pathA = a.actions.join(',');
  const pathB = b.actions.join(',');
  return pathA.localeCompare(pathB);
}

/**
 * Busca deterministamente las mejores colocaciones alcanzables mediante simulación
 * aislada sobre clones de GameEngine.
 */
export function searchPlacements(
  engine: GameEngine,
  config?: Partial<BotConfig>,
): SearchResult {
  const rootSnap = engine.getSnapshot();
  if (!rootSnap.activePiece || rootSnap.status !== 'running') {
    return Object.freeze({
      bestCandidate: null,
      allCandidates: Object.freeze([]),
      nonTerminalCandidates: Object.freeze([]),
      searchMetrics: Object.freeze({
        nodesExplored: 0,
        nodesDeduplicated: 0,
        candidatesFound: 0,
        nonTerminalCandidateCount: 0,
        reachedNodeLimit: false,
      }),
    });
  }

  const maxNodes = config?.maxSearchNodes ?? BOT_MAX_SEARCH_NODES;
  const weights = config?.heuristicWeights;

  const targetPieceType = rootSnap.activePiece.type;
  const initialHoles = computeHoles(rootSnap.board, computeColumnHeights(rootSnap.board));

  type QueueNode = {
    engineClone: GameEngine;
    path: BotAction[];
  };

  const visitedKeys = new Set<string>();
  const candidatesMap = new Map<string, PlacementCandidate>();

  const queue: QueueNode[] = [
    {
      engineClone: engine.clone(),
      path: [],
    },
  ];

  let nodesExplored = 0;
  let nodesDeduplicated = 0;
  let reachedNodeLimit = false;

  while (queue.length > 0) {
    if (nodesExplored >= maxNodes) {
      reachedNodeLimit = true;
      break;
    }

    const current = queue.shift()!;
    nodesExplored++;

    const snap = current.engineClone.getSnapshot();
    if (!snap.activePiece || snap.activePiece.type !== targetPieceType || snap.status !== 'running') {
      continue;
    }

    const stateKey = `${targetPieceType}:${snap.activePiece.x}:${snap.activePiece.y}:${snap.activePiece.orientation}:${snap.activePiece.grounded}`;
    if (visitedKeys.has(stateKey)) {
      nodesDeduplicated++;
      continue;
    }
    visitedKeys.add(stateKey);

    // Evaluar la colocación mediante hardDrop en un clon dedicado
    const hardDropClone = current.engineClone.clone();
    const snapBeforeHardDrop = hardDropClone.getSnapshot();
    const clearedBefore = snapBeforeHardDrop.clearedLines;

    let isGameOver = false;
    let gameOverReason: 'spawnBlocked' | 'garbageOverflow' | 'outOfBounds' | null = null;

    try {
      hardDropClone.step(HARD_DROP_INPUT);
      const snapAfterHardDrop = hardDropClone.getSnapshot();
      if (snapAfterHardDrop.status === 'gameOver') {
        isGameOver = true;
        gameOverReason = 'spawnBlocked';
      }

      const linesCleared = snapAfterHardDrop.clearedLines - clearedBefore;
      const boardFingerprint = computeBoardFingerprint(snapAfterHardDrop.board);

      const metrics = evaluateBoardMetrics(
        snapAfterHardDrop.board,
        linesCleared,
        initialHoles,
        isGameOver,
      );
      const score = scoreBoardMetrics(metrics, weights);

      const candidateKey = `${snap.activePiece.x}:${snap.activePiece.y}:${snap.activePiece.orientation}:${boardFingerprint}`;

      const candidate: PlacementCandidate = Object.freeze({
        targetPlacement: Object.freeze({
          x: snap.activePiece.x,
          y: snap.activePiece.y,
          orientation: snap.activePiece.orientation,
        }),
        actions: Object.freeze([...current.path, 'hardDrop' as BotAction]),
        heuristicScore: score,
        linesCleared,
        resultingHoles: metrics.holes,
        newHoles: metrics.newHoles,
        maxHeight: metrics.maxHeight,
        topOutRisk: metrics.topOutRisk,
        hiddenRowOccupancy: metrics.hiddenRowOccupancy,
        isGameOver,
        gameOverReason,
        boardFingerprint,
      });

      const existingCandidate = candidatesMap.get(candidateKey);
      if (!existingCandidate || compareCandidates(candidate, existingCandidate) < 0) {
        candidatesMap.set(candidateKey, candidate);
      }
    } catch {
      // Si hardDrop lanza excepción (p. ej. gameOver), la rama se omite
    }

    // Expansión BFS de acciones navegables (rotaciones y desplazamientos horizontales)
    for (const action of EXPANSION_ACTIONS) {
      const nextEngine = current.engineClone.clone();
      const stepInput = STEP_INPUT_MAP[action];

      try {
        nextEngine.step(stepInput);
        const nextSnap = nextEngine.getSnapshot();

        if (
          nextSnap.status === 'running' &&
          nextSnap.activePiece &&
          nextSnap.activePiece.type === targetPieceType
        ) {
          const nextStateKey = `${targetPieceType}:${nextSnap.activePiece.x}:${nextSnap.activePiece.y}:${nextSnap.activePiece.orientation}:${nextSnap.activePiece.grounded}`;
          if (!visitedKeys.has(nextStateKey)) {
            queue.push({
              engineClone: nextEngine,
              path: [...current.path, action],
            });
          } else {
            nodesDeduplicated++;
          }
        }
      } catch {
        // Movimiento inválido ignorado
      }
    }
  }

  const allCandidates = Array.from(candidatesMap.values()).sort(compareCandidates);
  const nonTerminalCandidates = allCandidates.filter((c) => !c.isGameOver);

  // REGLA OBLIGATORIA: Si existe al menos un candidato no terminal, descartar todos los terminales
  const validCandidates =
    nonTerminalCandidates.length > 0 ? nonTerminalCandidates : allCandidates;
  const bestCandidate = validCandidates.length > 0 ? validCandidates[0]! : null;

  return Object.freeze({
    bestCandidate,
    allCandidates: Object.freeze(allCandidates),
    nonTerminalCandidates: Object.freeze(nonTerminalCandidates),
    searchMetrics: Object.freeze({
      nodesExplored,
      nodesDeduplicated,
      candidatesFound: allCandidates.length,
      nonTerminalCandidateCount: nonTerminalCandidates.length,
      reachedNodeLimit,
    }),
  });
}
