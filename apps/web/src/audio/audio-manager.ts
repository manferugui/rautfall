import type { EngineEvent } from '@rautfall/game-engine';
import type { BattleEvent } from '@rautfall/battle-engine';
import type { AudioService, AudioSfxType, MusicTrack } from './types';
import { playSyntheticSfx } from './sfx-synth';

const MUTE_STORAGE_KEY = 'rautfall_audio_muted';
const DEDUPLICATION_WINDOW_MS = 40;

export class AudioManager implements AudioService {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;

  private lastSfxTimeMap = new Map<AudioSfxType, number>();

  private currentMusicTrack: MusicTrack | null = null;
  private musicIntensity = 1.0;

  constructor() {
    this.muted = this.readMutedFromStorage();
  }

  /**
   * Obtiene la instancia singleton de AudioManager.
   */
  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  /**
   * Reinicia la instancia singleton (útil en pruebas y teardown completo).
   */
  public static resetInstance(): void {
    if (AudioManager.instance) {
      AudioManager.instance.destroy();
      AudioManager.instance = null;
    }
  }

  private readMutedFromStorage(): boolean {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeMutedToStorage(muted: boolean): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, String(muted));
    } catch {
      // Ignorar errores defensivamente si localStorage no está disponible
    }
  }

  private initAudioContext(): void {
    const AudioCtxClass =
      (typeof globalThis !== 'undefined' && (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext) ||
      (typeof window !== 'undefined' && ((window as unknown as { AudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext));

    if (!AudioCtxClass) return;

    try {
      const ctx = new AudioCtxClass();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.muted ? 0 : 1, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.ctx = ctx;
      this.masterGain = masterGain;
    } catch {
      this.ctx = null;
      this.masterGain = null;
    }
  }

  public async unlock(): Promise<void> {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Ignorar si el navegador bloquea la reanudación
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.writeMutedToStorage(muted);

    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
      } catch {
        // Ignorar si el contexto ya no está activo
      }
    }
  }

  public playSfx(type: AudioSfxType): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastTime = this.lastSfxTimeMap.get(type) ?? 0;

    if (now - lastTime < DEDUPLICATION_WINDOW_MS) {
      return; // Deduplicación: evitar saturación si el mismo evento se dispara múltiples veces en la misma ventana
    }

    this.lastSfxTimeMap.set(type, now);
    playSyntheticSfx(this.ctx, this.masterGain, type);
  }

  public handleEngineEvent(event: EngineEvent): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;

    switch (event.type) {
      case 'pieceMoved':
        if (event.reason === 'hardDrop') {
          this.playSfx('hardDrop');
        }
        break;

      case 'pieceLocked':
        this.playSfx('pieceLocked');
        break;

      case 'linesCleared':
        if (event.lines >= 4) {
          this.playSfx('quadOrTSpin');
        } else if (event.lines >= 1) {
          this.playSfx('linesCleared');
        }
        break;

      case 'sabotageTriggered':
        this.playSfx('sabotageTriggered');
        break;

      case 'gameOver':
        this.playSfx('gameOver');
        break;
    }
  }

  public handleBattleEvent(event: BattleEvent): void {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    switch (event.type) {
      case 'participantEvent':
        // Procesar eventos del jugador local (playerOne)
        if (event.participant === 'playerOne') {
          this.handleEngineEvent(event.event);
        }
        break;

      case 'sabotageRouted':
        this.playSfx('sabotageTriggered');
        break;

      case 'suddenDeathWarning':
        this.playSfx('suddenDeathWarning');
        break;

      case 'suddenDeathStarted':
        this.playSfx('suddenDeathStarted');
        break;

      case 'battleEnded':
        if (event.winner === 'playerOne') {
          this.playSfx('victory');
        } else {
          this.playSfx('gameOver');
        }
        break;
    }
  }

  public playMusic(track: MusicTrack): void {
    this.currentMusicTrack = track;
    // Infraestructura preparada para música futura.
    // Tolerancia completa a la ausencia de ficheros musicales:
    // No realiza peticiones fetch ni 404, ni emite errores por consola.
  }

  public stopMusic(): void {
    this.currentMusicTrack = null;
  }

  public setMusicIntensity(intensity: number): void {
    this.musicIntensity = Math.max(0, Math.min(1, intensity));
  }

  public getCurrentMusicTrack(): MusicTrack | null {
    return this.currentMusicTrack;
  }

  public getMusicIntensity(): number {
    return this.musicIntensity;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public destroy(): void {
    if (this.ctx) {
      try {
        if (this.ctx.state !== 'closed') {
          this.ctx.close();
        }
      } catch {
        // Ignorar si ya está cerrado
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.lastSfxTimeMap.clear();
    this.currentMusicTrack = null;
  }
}

/**
 * Acceso directo para obtener la instancia singleton del servicio de audio.
 */
export function getAudioManager(): AudioManager {
  return AudioManager.getInstance();
}
