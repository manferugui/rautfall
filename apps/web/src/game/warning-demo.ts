/**
 * Escenario de desarrollo para la validación visual y de ciclo de vida de los warnings de sabotaje (Warning Demo).
 *
 * Solo disponible en desarrollo (`import.meta.env.DEV`) con la query parameter `?warning-demo=1`.
 */

import { prototypeConfig } from '@rautfall/game-config';
import {
  createBattleSession,
  type BattleSession,
  type BattleSessionOptions,
} from '@rautfall/battle-engine';
import type { SabotageType } from '@rautfall/game-engine';

/**
 * Determina si el modo de demostración de desarrollo de Warning FX está activo.
 * Requiere: entorno de desarrollo + parámetro `?warning-demo=1`.
 */
export function isWarningDemoActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(search).get('warning-demo') === '1';
}

/**
 * Crea la sesión de batalla del escenario de demostración de warnings.
 * Solo debe llamarse cuando `isWarningDemoActive()` devuelve true.
 *
 * Configura un rival pasivo/standby (P2) y una semilla fija reproducible (42 por defecto).
 */
export function createWarningDemoSession(
  options?: Partial<BattleSessionOptions>,
): BattleSession {
  const sessionOptions: BattleSessionOptions = {
    seed: options?.seed ?? 42,
    config: options?.config ?? prototypeConfig,
    ...(options?.playerOneInitialState ? { playerOneInitialState: options.playerOneInitialState } : {}),
    ...(options?.playerTwoInitialState ? { playerTwoInitialState: options.playerTwoInitialState } : {}),
  };

  return createBattleSession(sessionOptions);
}

/**
 * Helper de preparación DEV exclusivo para la demo `?warning-demo=1`.
 *
 * Prepara únicamente `storedSabotages` en P2 (rival pasivo) con el sabotaje solicitado,
 * preservando el snapshot y semilla de P2 sin alterar a P1 ni el estado global de la sesión.
 */
export function prepareWarningDemoSabotage(
  session: BattleSession,
  sabotage: SabotageType,
): void {
  const p2Engine = session.getEngine('playerTwo');
  const snap = p2Engine.getSnapshot();
  p2Engine.reset(
    { seed: snap.seed, config: prototypeConfig },
    { storedSabotages: [sabotage] },
  );
}

/**
 * Mensaje de ayuda del escenario de demostración de Warning FX.
 */
export const WARNING_DEMO_HELP = `
=== Warning FX Demo (Validación de Warnings de Sabotaje) activado ===
Jugador 1: Jugador local con controles tácticos.
Jugador 2: Rival en reposo / standby.
Semilla compartida: 42
Controles DEV:
  Tecla 1 → SOBRECARGA contra P1
  Tecla 2 → POLARIDAD contra P1
  Tecla 3 → INTERFERENCIA contra P1
  Tecla 0 → RESET DEV de la demo
=====================================================================
`;
