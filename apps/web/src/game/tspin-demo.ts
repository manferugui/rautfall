/**
 * Escenario de desarrollo para validación manual de T-Spin.
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con el parámetro
 * `?tspin-demo=1`.
 *
 * No forma parte de la API pública normal: no permite editar ni cargar
 * tableros arbitrarios. Prepara únicamente un escenario cerrado y nominado.
 *
 * No calcula T-Spins, puntuación, combo ni back-to-back: esas reglas las
 * ejecuta el motor real a partir del estado inicial que este módulo prepara.
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
 * Determina si el escenario de validación de T-Spin está activo.
 * Requiere: entorno de desarrollo + parámetro `?tspin-demo=1`.
 */
export function isTSpinDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const search = searchOverride ?? window.location.search;
  return new URLSearchParams(search).get('tspin-demo') === '1';
}

/**
 * Estado inicial exacto del escenario cerrado.
 *
 * - Tablero: bloques en (3,17), (5,17), (3,15) y (5,15) — dejando libres
 *   las celdas de la pieza T.
 * - Pieza activa: T en (3,15), orientación Spawn.
 *   Celdas: (4,15), (3,16), (4,16), (5,16).
 *   Centro de rotación: (4,16).
 *   Esquinas: (3,15) ocupada, (5,15) ocupada, (3,17) ocupada, (5,17) ocupada
 *   → 4 esquinas ocupadas.
 * - nextPieces: ['I', 'O', 'L'] (longitud 3).
 * - heldPiece: null.
 * - score = 0, combo = 0, backToBack = 0.
 */
export function getTSpinDemoState(): TSpinDemoInitialState {
  const board: (PieceType | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );
  // Esquinas ocupadas (no coinciden con las celdas de la T en Spawn)
  board[17]![3] = 'Z';
  board[17]![5] = 'Z';
  board[15]![3] = 'J';
  board[15]![5] = 'J';
  return {
    board,
    activePiece: { type: 'T', x: 3, y: 15, orientation: Orientation.Spawn },
    nextPieces: ['I', 'O', 'L'],
    heldPiece: null,
  };
}

/**
 * Crea el motor del escenario de T-Spin.
 * Solo debe llamarse cuando `isTSpinDemoActive()` devuelve true.
 */
export function createTSpinDemoEngine(options: EngineOptions = { seed: 42, config: prototypeConfig }): GameEngine {
  const demoConfig = {
    ...options.config,
    lockDelayMs: 1000000,
  };
  return createGameEngine({ ...options, config: demoConfig }, getTSpinDemoState());
}

/**
 * Mensaje de ayuda del escenario.
 * Secuencia manual: pulsar ↑ (rotación) y luego Space (hard drop).
 */
export const TSPIN_DEMO_HELP = `
=== T-Spin Demo activado ===
Semilla: 42 | Config: prototypeConfig
Tablero preparado con pieza T en (3,15), 4 esquinas ocupadas.
Estado inicial: score=0, combo=0, backToBack=0.
Secuencia manual:
  1. Pulsar ↑ (rotación horaria) → activa candidatura.
  2. Pulsar Space (hard drop distancia 0) → fija la T.
Resultado esperado (T-Spin sin líneas):
  - T-Spin sin líneas: base 400
  - combo bonus: 0
  - back-to-back bonus: 0
  - delta total: 400
  - score final: 400
  - combo final: 0
  - backToBack final: 0
=============================
`;
