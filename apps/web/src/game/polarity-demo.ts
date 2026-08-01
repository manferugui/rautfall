/**
 * Escenario de desarrollo para la validación manual de Polaridad inversa (Polarity Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?polarity-demo=1`.
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
 * Determina si el modo de demostración de desarrollo de Polaridad inversa está activo.
 * Requiere: entorno de desarrollo + parámetro `?polarity-demo=1`.
 */
export function isPolarityDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const search = searchOverride ?? window.location.search;
  return new URLSearchParams(search).get('polarity-demo') === '1';
}

/**
 * Estado inicial exacto del escenario cerrado de Polaridad inversa.
 * Arranca con Polaridad activa a 1 pieza y cartucho cargado con 'polaridad'.
 */
export function getPolarityDemoState(): TSpinDemoInitialState {
  const board: (PieceType | 'garbage' | null)[][] = Array.from({ length: 24 }, () =>
    Array.from<null>({ length: 10 }).fill(null),
  );
  return {
    board,
    activePiece: { type: 'I', x: 3, y: 0, orientation: Orientation.Spawn },
    nextPieces: ['O', 'T', 'L'],
    heldPiece: null,
    storedSabotages: ['polaridad', 'polaridad'],
    pendingGarbage: 0,
    activeEffects: [{ type: 'polaridad', remainingPieces: 1 }],
  };
}

/**
 * Crea el motor del escenario de demostración de Polaridad inversa.
 * Solo debe llamarse cuando `isPolarityDemoActive()` devuelve true.
 */
export function createPolarityDemoEngine(options: EngineOptions = { seed: 42, config: prototypeConfig }): GameEngine {
  return createGameEngine(options, getPolarityDemoState());
}

/**
 * Mensaje de ayuda del escenario de demostración de Polaridad inversa.
 */
export const POLARITY_DEMO_HELP = `
=== Polarity Demo (Polaridad inversa) activado ===
Efectos activos: POLARIDAD · 1 PIEZA - Controles horizontales y giros invertidos
Cartucho cargado: ['polaridad', 'polaridad']
Secuencia manual:
  1. Pulsar Flecha Izquierda / Derecha → movimiento en sentido inverso.
  2. Pulsar ArrowUp / Z → giros en sentido opuesto.
  3. Comprobar DAS/ARR en sentido invertido.
  4. Comprobar soft drop / hard drop / hold sin inversión.
  5. Pulsar A → consume 'polaridad' y renueva remainingPieces a 2.
  6. Fijar la pieza actual → remainingPieces pasa de 2 a 1.
  7. Fijar la siguiente pieza → el efecto expira y desaparece de EFECTOS ACTIVOS.
  8. Pulsar Esc → pausa la simulación y mantiene remainingPieces sin cambios.
  9. Pulsar R (Reiniciar) → reinicia el escenario demo.
===================================================
`;
