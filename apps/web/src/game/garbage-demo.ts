/**
 * Escenario de desarrollo para la validación manual de Residuos (Garbage Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?garbage-demo=1`.
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
 * Determina si el modo de demostración de desarrollo de Residuos está activo.
 * Requiere: entorno de desarrollo + parámetro `?garbage-demo=1`.
 */
export function isGarbageDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const search = searchOverride ?? window.location.search;
  return new URLSearchParams(search).get('garbage-demo') === '1';
}

/**
 * Estado inicial exacto del escenario cerrado de Residuos.
 *
 * - Tablero preparado con celdas en las filas 22 y 23 para apreciar el desplazamiento vertical.
 * - pendingGarbage: 2 (2 filas de basura encoladas por aplicar en la 1ª fijación).
 * - storedSabotages: ['residuos', 'residuos'] (cartucho cargado).
 * - El tablero no contiene celdas 'garbage' antes de la primera fijación.
 */
export function getGarbageDemoState(): TSpinDemoInitialState {
  const board: (PieceType | 'garbage' | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );

  // Colocar algunas celdas preparadas en filas 22 y 23 (celdas J y L)
  board[22]![2] = 'J';
  board[22]![3] = 'J';
  board[22]![4] = 'J';
  board[23]![2] = 'L';
  board[23]![3] = 'L';
  board[23]![4] = 'L';

  return {
    board,
    activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
    nextPieces: ['O', 'T', 'L'],
    heldPiece: null,
    storedSabotages: ['residuos', 'residuos'],
    pendingGarbage: 2,
  };
}

/**
 * Crea el motor del escenario de demostración de Residuos.
 * Solo debe llamarse cuando `isGarbageDemoActive()` devuelve true.
 */
export function createGarbageDemoEngine(options: EngineOptions = { seed: 42, config: prototypeConfig }): GameEngine {
  return createGameEngine(options, getGarbageDemoState());
}

/**
 * Mensaje de ayuda del escenario de demostración de Residuos.
 */
export const GARBAGE_DEMO_HELP = `
=== Garbage Demo (Residuos) activado ===
Basura pendiente inicial: 2 filas
Cartucho cargado: ['residuos', 'residuos']
Secuencia manual:
  1. Pulsar Space (hard drop) → fija la pieza, inserta 2 filas de basura abajo y desplaza las celdas preparadas 2 filas arriba.
  2. Pulsar A → consume 1 'residuos' del cartucho y vuelve a encolar 2 filas de basura pendiente.
  3. Pulsar Space → inserta de nuevo 2 filas de basura desplazando todo hacia arriba.
  4. Pulsar R (Reiniciar) → restaura el escenario inicial completo.
========================================
`;
