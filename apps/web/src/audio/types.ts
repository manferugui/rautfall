import type { EngineEvent } from '@rautfall/game-engine';
import type { BattleEvent } from '@rautfall/battle-engine';

/**
 * Niveles de prioridad jerárquicos de mezcla para los efectos de sonido.
 */
export type AudioSfxPriority = 'low' | 'medium' | 'high' | 'terminal';

/**
 * Identificadores de efectos de sonido sintéticos esenciales (SFX).
 */
export type AudioSfxType =
  | 'hardDrop'
  | 'pieceLocked'
  | 'linesCleared'
  | 'quadOrTSpin'
  | 'sabotageTriggered'
  | 'residuesTriggered'
  | 'residuesReceived'
  | 'overloadTriggered'
  | 'overloadReceived'
  | 'reversePolarityTriggered'
  | 'reversePolarityReceived'
  | 'suddenDeathWarning'
  | 'suddenDeathStarted'
  | 'gameOver'
  | 'victory'
  | 'victoryFallback'
  | 'uiClick';

/**
 * Pistas de música ambiental previstas para el sistema.
 */
export type MusicTrack = 'menu' | 'gameplay' | 'suddenDeath' | 'victory';

/**
 * Preferencias de audio persistidas.
 */
export interface AudioPreferences {
  muted: boolean;
}

/**
 * Contrato público del servicio de audio de Rautfall.
 */
export interface AudioService {
  /** Desbloquea e inicializa el AudioContext tras una interacción del usuario. */
  unlock(): Promise<void>;
  /** Indica si el sistema de audio está desbloqueado y activo (AudioContext en ejecución). */
  isUnlocked(): boolean;
  /** Indica si el audio global está silenciado. */
  isMuted(): boolean;
  /** Alterna el silencio global y devuelve el nuevo estado de mute. */
  toggleMute(): boolean;
  /** Establece explícitamente el estado de silencio global. */
  setMuted(muted: boolean): void;
  /** Reproduce un efecto de sonido (muestra o fallback sintético). */
  playSfx(type: AudioSfxType, options?: { forceSynthetic?: boolean }): void;
  /** Procesa un evento de motor de juego e invoca el SFX correspondiente. */
  handleEngineEvent(event: EngineEvent): void;
  /** Procesa un evento de motor de batalla e invoca el SFX correspondiente. */
  handleBattleEvent(event: BattleEvent): void;
  /** Prepara/reproduce una pista de música ambiental (preparado para activos futuros). */
  playMusic(track: MusicTrack): void;
  /** Reinicia la reproducción musical seleccionando la pista indicada desde el segundo 0. */
  restartMusic(track: MusicTrack): void;
  /** Detiene la música ambiental actual. */
  stopMusic(): void;
  /** Ajusta la intensidad de la música ambiental actual. */
  setMusicIntensity(intensity: number): void;
  /** Libera recursos y cierra el AudioContext de forma limpia. */
  destroy(): void;
}
