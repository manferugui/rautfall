/**
 * Escenario de desarrollo para la validación manual de Residuos (Sabotage Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?sabotage-demo=1`.
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
 * Requiere: entorno de desarrollo + parámetro `?sabotage-demo=1`.
 */
export function isSabotageDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const search = searchOverride ?? window.location.search;
  return new URLSearchParams(search).get('sabotage-demo') === '1';
}

/**
 * Estado inicial exacto del escenario cerrado de Residuos.
 * Cartucho cargado con 2 sabotajes de residuos para probar el lanzamiento inmediato con la tecla A.
 */
export function getSabotageDemoState(): TSpinDemoInitialState {
  const board: (PieceType | 'garbage' | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );
  return {
    board,
    activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
    nextPieces: ['O', 'T', 'L'],
    heldPiece: null,
    storedSabotages: ['residuos', 'residuos'],
    pendingGarbage: 0,
  };
}

/**
 * Crea el motor del escenario de demostración de Residuos.
 * Solo debe llamarse cuando `isSabotageDemoActive()` devuelve true.
 */
export function createSabotageDemoEngine(options: EngineOptions = { seed: 42, config: prototypeConfig }): GameEngine {
  return createGameEngine(options, getSabotageDemoState());
}

/**
 * Mensaje de ayuda del escenario de demostración de Residuos.
 */
export const SABOTAGE_DEMO_HELP = `
=== Sabotage Demo (Residuos) activado ===
Cartucho cargado: ['residuos', 'residuos']
Secuencia manual:
  1. Pulsar A → consume 1 residuos del cartucho y encola 2 filas de basura.
  2. Pulsar Space (hard drop) → fija la pieza e inserta 2 filas de basura en la parte inferior.
=========================================
`;
