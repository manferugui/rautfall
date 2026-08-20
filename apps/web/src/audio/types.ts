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
  | 'uiClick'
  | 'pauseShutterClose'
  | 'pauseShutterOpen';

/**
 * Pistas de música ambiental previstas para el sistema.
 */
export type MusicTrack = 'menu' | 'gameplay' | 'suddenDeath' | 'victory';

/**
 * Preferencias de audio persistidas.
 */
export interface AudioPreferences {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

/**
 * Identificadores de las 13 reacciones vocales del operador para PvP online.
 */
export type OperatorReactionType =
  | 'cabron'
  | 'no_me_jodas'
  | 'pero_que_coño'
  | 'hijo_puta'
  | 'me_cago_en_todo'
  | 'joder'
  | 'mierda'
  | 'eso_es_todo'
  | 'toma'
  | 'no_no_no'
  | 'hostia_hostia'
  | 'jooooder'
  | 'a_tomar_por_culo';

/**
 * Contrato público del servicio de audio de Rautfall.
 */
export interface AudioService {
  /** Desbloquea e inicializa el AudioContext tras una interacción del usuario. */
  unlock(): Promise<void>;
  /** Indica si el sistema de audio está desbloqueado y activo (AudioContext en ejecución). */
  isUnlocked(): boolean;
  /** Indica si la música de fondo está habilitada. */
  isMusicEnabled(): boolean;
  /** Establece la preferencia de activación de la música de fondo. */
  setMusicEnabled(enabled: boolean): void;
  /** Alterna la activación de la música de fondo y devuelve el nuevo estado. */
  toggleMusic(): boolean;
  /** Indica si los efectos de sonido sintéticos/muestras están habilitados. */
  isSfxEnabled(): boolean;
  /** Establece la preferencia de activación de efectos de sonido. */
  setSfxEnabled(enabled: boolean): void;
  /** Alterna la activación de efectos de sonido y devuelve el nuevo estado. */
  toggleSfx(): boolean;
  /** Indica si el audio global está silenciado (ambos canales deshabilitados). */
  isMuted(): boolean;
  /** Alterna el silencio global y devuelve el nuevo estado de mute. */
  toggleMute(): boolean;
  /** Establece explícitamente el estado de ambos canales de audio. */
  setMuted(muted: boolean): void;
  /** Reproduce un efecto de sonido (muestra o fallback sintético). */
  playSfx(type: AudioSfxType, options?: { forceSynthetic?: boolean }): void;
  /** Reproduce una reacción vocal del operador en PvP online. */
  playOperatorReaction(type: OperatorReactionType): void;
  /** Procesa un evento de motor de juego e invoca el SFX correspondiente. */
  handleEngineEvent(event: EngineEvent): void;
  /** Procesa un evento de motor de batalla e invoca el SFX correspondiente. */
  handleBattleEvent(event: BattleEvent): void;
  /** Prepara/reproduce una pista de música ambiental (preparado para activos futuros). */
  playMusic(track: MusicTrack, options?: { fadeOutDurationMs?: number }): void;
  /** Pausa la música de fondo conservando la posición temporal exacta (offset) mediante fade-out. */
  pauseMusic(options?: { fadeOutDurationMs?: number }): void;
  /** Reanuda la música de fondo desde el offset guardado con fade-in. */
  resumeMusic(options?: { fadeInDurationMs?: number }): void;
  /** Indica si la música de fondo se encuentra en estado pausado. */
  isMusicPaused(): boolean;
  /** Reinicia la reproducción musical seleccionando la pista indicada desde el segundo 0. */
  restartMusic(track: MusicTrack): void;
  /** Detiene la música ambiental actual. */
  stopMusic(): void;
  /** Ajusta la intensidad de la música ambiental actual. */
  setMusicIntensity(intensity: number): void;
  /** Libera recursos y cierra el AudioContext de forma limpia. */
  destroy(): void;
}
