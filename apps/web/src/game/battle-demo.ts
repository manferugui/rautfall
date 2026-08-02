/**
 * Escenario de desarrollo para la validación manual de la Capa de Batalla Local (Battle Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?battle-demo=1`.
 */

import { prototypeConfig } from '@rautfall/game-config';
import {
  createBattleSession,
  type BattleSession,
  type BattleSessionOptions,
} from '@rautfall/battle-engine';

/**
 * Determina si el modo de demostración de desarrollo de Batalla Local está activo.
 * Requiere: entorno de desarrollo + parámetro `?battle-demo=1`.
 */
export function isBattleDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(search).get('battle-demo') === '1';
}

/**
 * Crea la sesión de batalla del escenario de demostración.
 * Solo debe llamarse cuando `isBattleDemoActive()` devuelve true.
 */
export function createBattleDemoSession(
  options: BattleSessionOptions = { seed: 42, config: prototypeConfig },
): BattleSession {
  return createBattleSession(options);
}

/**
 * Mensaje de ayuda del escenario de demostración de Batalla Local.
 */
export const BATTLE_DEMO_HELP = `
=== Battle Demo (Capa de Batalla Local Determinista 2P) activado ===
Jugador 1: Controles de teclado humano.
Jugador 2: Rival autónomo controlado por DeterministicBot.
Semilla compartida: 42
Comprobaciones:
  1. Pulsar Flecha Izquierda / Derecha / Z / Space → P1 avanza y realiza acciones.
  2. Observar P2 → el bot heurístico evalúa tableros y coloca piezas de forma autónoma.
  3. Acumular energía y pulsar A → P1 lanza sabotaje que el orquestador enruta realmente a P2.
  4. Comprobar panel técnico DEV de P2 → se muestra status, energía, nivel, sabotajes recibidos y efectos en P2.
  5. Pulsar Esc → la aplicación web deja de llamar a battleSession.step() y congela ambos motores y el bot.
  6. Pulsar R → reinicio coordinado de la sesión de batalla y el bot.
=====================================================================
`;
