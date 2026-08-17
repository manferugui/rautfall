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
import type { SabotageType } from '@rautfall/game-engine';

export const BATTLE_DEMO_INITIAL_SABOTAGES: readonly SabotageType[] = Object.freeze([
  'residuos',
  'sobrecarga',
  'polaridad',
  'interferencia',
]);

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
 * Determina si el panel de telemetría técnica DEV está activo.
 * Requiere: entorno de desarrollo + parámetro `?debug-panel=1`.
 */
export function isDebugPanelActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(search).get('debug-panel') === '1';
}

/**
 * Determina si el escenario de demostración de Muerte Súbita está activo.
 * Requiere: entorno de desarrollo + parámetros `?battle-demo=1&sudden-death-demo=1`.
 */
export function isSuddenDeathDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  return params.get('battle-demo') === '1' && params.get('sudden-death-demo') === '1';
}

/**
 * Determina si el escenario de demostración de Interferencia está activo.
 * Requiere: entorno de desarrollo + parámetro `?battle-demo=1` y (`?interference-demo=1` o `?bot-sabotage=interferencia`).
 */
export function isInterferenceDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(search);
  const battleDemo = params.get('battle-demo') === '1';
  const interferenceParam = params.get('interference-demo') === '1';
  const botSabotageParam = params.get('bot-sabotage') === 'interferencia';
  return battleDemo && (interferenceParam || botSabotageParam);
}

/**
 * Crea la sesión de batalla del escenario de demostración.
 * Solo debe llamarse cuando `isBattleDemoActive()` devuelve true.
 */
export function createBattleDemoSession(
  options?: Partial<BattleSessionOptions>,
  searchOverride?: string,
): BattleSession {
  const search = searchOverride ?? (typeof window !== 'undefined' && window.location.search ? window.location.search : '?battle-demo=1');
  const params = new URLSearchParams(search);
  const botSabotageParam = params.get('bot-sabotage');

  let playerOneInitialState = options?.playerOneInitialState;
  let playerTwoInitialState = options?.playerTwoInitialState;

  if (import.meta.env.DEV && isInterferenceDemoActive(search)) {
    playerOneInitialState = {
      storedSabotages: ['interferencia', 'interferencia'],
      ...playerOneInitialState,
    };
  } else if (import.meta.env.DEV && botSabotageParam) {
    playerTwoInitialState = {
      storedSabotages: ['residuos'],
      ...playerTwoInitialState,
    };

    if (botSabotageParam === 'high') {
      const board = Array.from({ length: 24 }, () => new Array(10).fill(null));
      for (let r = 16; r < 24; r++) {
        board[r]![0] = 'garbage';
      }
      playerOneInitialState = {
        board,
        ...playerOneInitialState,
      };
    }
  } else if (import.meta.env.DEV && isBattleDemoActive(search)) {
    playerOneInitialState = {
      storedSabotages: [...BATTLE_DEMO_INITIAL_SABOTAGES],
      ...playerOneInitialState,
    };
  }

  const isSuddenDeathDemo = import.meta.env.DEV && isSuddenDeathDemoActive(search);

  const sessionOptions: BattleSessionOptions = {
    seed: options?.seed ?? 42,
    config: options?.config ?? prototypeConfig,
    ...(playerOneInitialState ? { playerOneInitialState } : {}),
    ...(playerTwoInitialState ? { playerTwoInitialState } : {}),
    ...(isSuddenDeathDemo ? { initialElapsedMs: 293_000 } : {}),
  };

  return createBattleSession(sessionOptions);
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
  3. Pulsar A → P1 dispara sabotaje cargado (RESIDUOS, SOBRECARGA, POLARIDAD, INTERFERENCIA) mediante el flujo real.
  4. Pulsar 0 → Recargar inventario DEV inicial de sabotajes en P1.
  5. Comprobar panel técnico DEV de P2 → status, energía, nivel, sabotajes recibidos y efectos en P2.
  6. Pulsar Esc → pausar/reanudar sesión.
  7. Pulsar R → reinicio coordinado de la sesión de batalla.
=====================================================================
`;
