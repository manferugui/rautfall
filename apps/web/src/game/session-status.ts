import type { EngineStatus } from '@rautfall/game-engine';

/** Estado de sesión observable por Vue: superconjunto del estado del motor con `paused`. */
export type SessionStatus = 'running' | 'paused' | 'gameOver';

/**
 * Precedencia determinista: `gameOver` (del motor) siempre prevalece sobre
 * `paused` (de la sesión web); `paused` prevalece sobre `running` cuando no
 * hay game over. No existen dos estados independientes que puedan divergir:
 * `SessionStatus` se deriva siempre de `(engineStatus, isPaused)`, nunca se
 * almacena por separado.
 */
export function computeSessionStatus(engineStatus: EngineStatus, isPaused: boolean): SessionStatus {
  if (engineStatus === 'gameOver') return 'gameOver';
  return isPaused ? 'paused' : 'running';
}

/** `Escape` y el botón de pausa solo tienen efecto mientras el motor no está en game over. */
export function canTogglePause(engineStatus: EngineStatus): boolean {
  return engineStatus !== 'gameOver';
}
