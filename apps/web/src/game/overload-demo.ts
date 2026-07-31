/**
 * Escenario de desarrollo para la validación manual de Sobrecarga (Overload Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?overload-demo=1`.
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
 * Determina si el modo de demostración de desarrollo de Sobrecarga está activo.
 * Requiere: entorno de desarrollo + parámetro `?overload-demo=1`.
 */
export function isOverloadDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const search = searchOverride ?? window.location.search;
  return new URLSearchParams(search).get('overload-demo') === '1';
}

/**
 * Estado inicial exacto del escenario cerrado de Sobrecarga.
 * Arranca con Sobrecarga activa a 10.000 ms y cartucho cargado con 'sobrecarga'.
 */
export function getOverloadDemoState(): TSpinDemoInitialState {
  const board: (PieceType | 'garbage' | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );
  return {
    board,
    activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
    nextPieces: ['O', 'T', 'L'],
    heldPiece: null,
    storedSabotages: ['sobrecarga', 'sobrecarga'],
    pendingGarbage: 0,
    activeEffects: [{ type: 'sobrecarga', remainingMs: 10000 }],
  };
}

/**
 * Crea el motor del escenario de demostración de Sobrecarga.
 * Solo debe llamarse cuando `isOverloadDemoActive()` devuelve true.
 */
export function createOverloadDemoEngine(options: EngineOptions = { seed: 42, config: prototypeConfig }): GameEngine {
  return createGameEngine(options, getOverloadDemoState());
}

/**
 * Mensaje de ayuda del escenario de demostración de Sobrecarga.
 */
export const OVERLOAD_DEMO_HELP = `
=== Overload Demo (Sobrecarga) activado ===
Efectos activos: SOBRECARGA (10.000 ms) - Gravedad pasiva 3x
Cartucho cargado: ['sobrecarga', 'sobrecarga']
Secuencia manual:
  1. Observar caída pasiva acelerada a 3x.
  2. Pulsar A → consume 'sobrecarga' y renueva el efecto a 10.000 ms.
  3. Pulsar Esc → pausa el juego y congela el temporizador.
  4. Dejar transcurrir 10s → el efecto expira y desaparece de EFECTOS ACTIVOS.
  5. Pulsar R (Reiniciar) → elimina el efecto activo transcurrido y reinicia la demo.
===========================================
`;
