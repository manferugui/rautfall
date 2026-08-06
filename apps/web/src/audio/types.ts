import type { EngineEvent } from '@rautfall/game-engine';
import type { BattleEvent } from '@rautfall/battle-engine';

/**
 * Identificadores de efectos de sonido sintéticos esenciales (SFX).
 */
export type AudioSfxType =
  | 'hardDrop'
  | 'pieceLocked'
  | 'linesCleared'
  | 'quadOrTSpin'
  | 'sabotageTriggered'
  | 'suddenDeathWarning'
  | 'suddenDeathStarted'
  | 'gameOver'
  | 'victory'
  | 'uiClick';

/**
 * Pistas de música ambiental previstas para el sistema.
 */
export type MusicTrack = 'menu' | 'gameplay' | 'suddenDeath';

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
  /** Indica si el audio global está silenciado. */
  isMuted(): boolean;
  /** Alterna el silencio global y devuelve el nuevo estado de mute. */
  toggleMute(): boolean;
  /** Establece explícitamente el estado de silencio global. */
  setMuted(muted: boolean): void;
  /** Reproduce un efecto de sonido sintético. */
  playSfx(type: AudioSfxType): void;
  /** Procesa un evento de motor de juego e invoca el SFX correspondiente. */
  handleEngineEvent(event: EngineEvent): void;
  /** Procesa un evento de motor de batalla e invoca el SFX correspondiente. */
  handleBattleEvent(event: BattleEvent): void;
  /** Prepara/reproduce una pista de música ambiental (preparado para activos futuros). */
  playMusic(track: MusicTrack): void;
  /** Detiene la música ambiental actual. */
  stopMusic(): void;
  /** Ajusta la intensidad de la música ambiental actual. */
  setMusicIntensity(intensity: number): void;
  /** Libera recursos y cierra el AudioContext de forma limpia. */
  destroy(): void;
}
