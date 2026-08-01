/**
 * Escenarios de desarrollo para la validación manual de la progresión de nivel y gravedad.
 *
 * Soporta `?level-demo=1` y `?level-demo=10` (solo en entorno DEV).
 */

import {
  createGameEngine,
  Orientation,
  type EngineOptions,
  type GameEngine,
  type PieceType,
  type TSpinDemoInitialState,
} from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';

/**
 * Determina si un modo de demostración de desarrollo de Nivel está activo.
 */
export function isLevelDemoActive(searchOverride?: string): boolean {
  return getLevelDemoTarget(searchOverride) !== null;
}

/**
 * Retorna el nivel objetivo del modo demo (1 o 10), o null si no está activo.
 */
export function getLevelDemoTarget(searchOverride?: string): number | null {
  if (typeof import.meta === 'undefined') return null;
  if (!import.meta.env) return null;
  if (!import.meta.env.DEV) return null;
  if (typeof window === 'undefined' && searchOverride === undefined) return null;
  const search = searchOverride ?? window.location.search;
  const param = new URLSearchParams(search).get('level-demo');
  if (param === '1') return 1;
  if (param === '10') return 10;
  return null;
}

/**
 * Genera el estado inicial del escenario demo de Nivel.
 */
export function getLevelDemoState(targetLevel: number): TSpinDemoInitialState {
  const board: (PieceType | 'garbage' | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );

  if (targetLevel === 1) {
    // Fila 23 casi completa (9 celdas ocupadas, hueco en x=3) para permitir limpiar 1 línea al fijar I
    for (let x = 0; x < 10; x++) {
      if (x !== 3) {
        board[23]![x] = 'I';
      }
    }
    return {
      board,
      activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
      nextPieces: ['O', 'T', 'L'],
      heldPiece: null,
      clearedLines: 9,
    };
  }

  // Nivel 10: 90 líneas acumuladas, tablero jugable y gravedad a 10.0 c/s
  return {
    board,
    activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
    nextPieces: ['O', 'T', 'L'],
    heldPiece: null,
    clearedLines: 90,
  };
}

/**
 * Crea el motor del escenario de demostración de Nivel.
 */
export function createLevelDemoEngine(
  targetLevel: number,
  options: EngineOptions = { seed: 42, config: prototypeConfig },
): GameEngine {
  return createGameEngine(options, getLevelDemoState(targetLevel));
}

/**
 * Mensaje de ayuda para la consola dev.
 */
export const LEVEL_DEMO_HELP = `
=== Level Demo (Progresión de Nivel) activado ===
Demostración de nivel e incremento de gravedad pasiva.
Contrato:
  - ?level-demo=1: Arranca en Nivel 1 con 9 líneas acumuladas. Al fijar 1 línea, sube a Nivel 2 y emite levelUp.
  - ?level-demo=10: Arranca en Nivel 10 con 90 líneas acumuladas y gravedad base de 10.0 c/s.
=================================================
`;
