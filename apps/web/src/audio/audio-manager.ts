import type { EngineEvent } from '@rautfall/game-engine';
import type { BattleEvent } from '@rautfall/battle-engine';
import type { AudioService, AudioSfxPriority, AudioSfxType, MusicTrack } from './types';
import { getSfxMetadata, renderSyntheticSfx } from './sfx-synth';

const MUSIC_STORAGE_KEY = 'rautfall_audio_music_enabled';
const SFX_STORAGE_KEY = 'rautfall_audio_sfx_enabled';
const MUTE_STORAGE_KEY = 'rautfall_audio_muted';
const DEDUPLICATION_WINDOW_MS = 40;

const SFX_ASSET_URL_MAP: Partial<Record<AudioSfxType, string>> = {
  uiClick: '/audio/sfx/ui-click.wav',
  pieceLocked: '/audio/sfx/piece-locked.wav',
  hardDrop: '/audio/sfx/hard-drop.wav',
  linesCleared: '/audio/sfx/lines-cleared.wav',
  residuesTriggered: '/audio/sfx/residues-triggered.wav',
  residuesReceived: '/audio/sfx/residues-received.wav',
  overloadTriggered: '/audio/sfx/overload-triggered.wav',
  overloadReceived: '/audio/sfx/overload-received.wav',
  reversePolarityTriggered: '/audio/sfx/reverse-polarity-triggered.wav',
  reversePolarityReceived: '/audio/sfx/reverse-polarity-received.wav',
  suddenDeathStarted: '/audio/sfx/sudden-death-started.wav',
  gameOver: '/audio/sfx/game-over.wav',
  victoryFallback: '/audio/sfx/victory-fallback.wav',
  pauseShutterClose: '/audio/sfx/pause-shutter-close.wav',
  pauseShutterOpen: '/audio/sfx/pause-shutter-open.wav',
};

const MUSIC_ASSET_URL_MAP: Partial<Record<MusicTrack, string>> = {
  menu: '/audio/music/menu.wav',
  gameplay: '/audio/music/gameplay.wav',
  suddenDeath: '/audio/music/sudden-death.wav',
  victory: '/audio/music/victory.wav',
};

interface ActiveDuckingRequest {
  id: string;
  targetAttenuation: number;
  releaseSec: number;
  expiresAtMs: number;
}

export class AudioManager implements AudioService {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private unlocked = false;
  private musicEnabled = true;
  private sfxEnabled = true;
  private desiredMusicTrack: MusicTrack | null = null;
  private sfxBusVolume = 1.0;
  private musicBusVolume = 1.0;

  // Muestras de audio SFX procesadas cargadas en memoria, promesas en vuelo y registro de fallos permanentes
  private sfxAudioBufferMap = new Map<AudioSfxType, AudioBuffer>();
  private assetLoadingPromises = new Map<AudioSfxType, Promise<AudioBuffer | null>>();
  private failedAssetSet = new Set<AudioSfxType>();

  // Muestras de música BGM procesadas cargadas en memoria, promesas en vuelo y registro de fallos permanentes
  private musicAudioBufferMap = new Map<MusicTrack, AudioBuffer>();
  private musicLoadingPromises = new Map<MusicTrack, Promise<AudioBuffer | null>>();
  private failedMusicAssetSet = new Set<MusicTrack>();
  private currentMusicSource: AudioBufferSourceNode | null = null;
  private currentTrackGainNode: GainNode | null = null;

  // Guarda de reproducción activa para evitar superposiciones concurrentes del mismo SFX
  private activePlayingTypes = new Set<AudioSfxType>();

  // Política de Ducking composable multi-solicitud
  private activeDuckingRequests = new Map<string, ActiveDuckingRequest>();
  private duckUntilMs = 0;
  private activeDuckingPriority: AudioSfxPriority | null = null;
  private duckingTimerId: number | null = null;
  private lastDuckingReleaseSec = 0.35;

  private lastSfxTimeMap = new Map<AudioSfxType, number>();

  private currentMusicTrack: MusicTrack | null = null;
  private musicIntensity = 1.0;

  // Estado de transporte musical (offset, pausado)
  private musicStartedAtContextTime = 0;
  private musicPlaybackOffsetSeconds = 0;
  private isMusicPausedState = false;
  private pausedMusicTrack: MusicTrack | null = null;

  constructor() {
    const prefs = this.readPreferencesFromStorage();
    this.musicEnabled = prefs.musicEnabled;
    this.sfxEnabled = prefs.sfxEnabled;
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

  private readPreferencesFromStorage(): { musicEnabled: boolean; sfxEnabled: boolean } {
    if (typeof localStorage === 'undefined') {
      return { musicEnabled: true, sfxEnabled: true };
    }
    try {
      const rawMusic = localStorage.getItem(MUSIC_STORAGE_KEY);
      const rawSfx = localStorage.getItem(SFX_STORAGE_KEY);

      const hasMusicKey = rawMusic !== null;
      const hasSfxKey = rawSfx !== null;

      if (!hasMusicKey && !hasSfxKey) {
        const rawLegacyMuted = localStorage.getItem(MUTE_STORAGE_KEY);
        if (rawLegacyMuted === 'true') {
          return { musicEnabled: false, sfxEnabled: false };
        } else if (rawLegacyMuted === 'false') {
          return { musicEnabled: true, sfxEnabled: true };
        }
        return { musicEnabled: true, sfxEnabled: true };
      }

      const musicEnabled = hasMusicKey ? rawMusic !== 'false' : true;
      const sfxEnabled = hasSfxKey ? rawSfx !== 'false' : true;

      return { musicEnabled, sfxEnabled };
    } catch {
      return { musicEnabled: true, sfxEnabled: true };
    }
  }

  private writePreferencesToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(MUSIC_STORAGE_KEY, String(this.musicEnabled));
      localStorage.setItem(SFX_STORAGE_KEY, String(this.sfxEnabled));
      localStorage.setItem(MUTE_STORAGE_KEY, String(this.isMuted()));
    } catch {
      // Ignorar errores defensivamente si localStorage no está disponible
    }
  }

  private updateMasterGain(): void {
    if (this.masterGain && this.ctx) {
      try {
        const targetGain = this.isMuted() ? 0 : 1;
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(targetGain, this.ctx.currentTime);
      } catch {
        // Ignorar defensivamente
      }
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
      masterGain.gain.setValueAtTime(this.isMuted() ? 0 : 1, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const musicGain = ctx.createGain();
      musicGain.gain.setValueAtTime(this.musicBusVolume, ctx.currentTime);
      musicGain.connect(masterGain);

      const sfxGain = ctx.createGain();
      sfxGain.gain.setValueAtTime(this.sfxBusVolume, ctx.currentTime);
      sfxGain.connect(masterGain);

      this.ctx = ctx;
      this.masterGain = masterGain;
      this.musicGain = musicGain;
      this.sfxGain = sfxGain;
      this.updateMasterGain();
    } catch {
      this.ctx = null;
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;
    }
  }

  public async unlock(): Promise<void> {
    if (!this.ctx) {
      this.initAudioContext();
    }
    if (!this.ctx) {
      return;
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.ctx.state === 'running') {
      this.unlocked = true;
    } else {
      throw new Error(`AudioContext en estado no activo: ${this.ctx.state}`);
    }

    this.updateMasterGain();

    if (this.musicEnabled && (this.desiredMusicTrack || this.currentMusicTrack) && !this.currentMusicSource) {
      const trackToPlay = this.desiredMusicTrack || this.currentMusicTrack;
      if (trackToPlay) {
        this.playMusic(trackToPlay);
      }
    }

    // Precargar asíncronamente activos de audio registrados sin bloquear la reanudación del contexto
    void this.preloadAssets();
  }

  public isUnlocked(): boolean {
    return this.unlocked;
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    this.writePreferencesToStorage();
    this.updateMasterGain();

    if (!this.musicEnabled) {
      this.stopActiveMusicSource({ fadeOutDurationMs: 0 });
    } else if (this.unlocked && this.desiredMusicTrack && !this.currentMusicSource) {
      this.playMusic(this.desiredMusicTrack);
    }
  }

  public toggleMusic(): boolean {
    this.setMusicEnabled(!this.musicEnabled);
    return this.musicEnabled;
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    this.writePreferencesToStorage();
    this.updateMasterGain();
  }

  public toggleSfx(): boolean {
    this.setSfxEnabled(!this.sfxEnabled);
    return this.sfxEnabled;
  }

  public isMuted(): boolean {
    return !this.musicEnabled && !this.sfxEnabled;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted());
    return this.isMuted();
  }

  public setMuted(muted: boolean): void {
    this.setMusicEnabled(!muted);
    this.setSfxEnabled(!muted);
  }


  /**
   * Precarga de forma asíncrona todos los activos binarios de SFX y BGM registrados.
   */
  public async preloadAssets(): Promise<void> {
    const sfxPromises = (Object.keys(SFX_ASSET_URL_MAP) as AudioSfxType[]).map((type) =>
      this.loadAudioBufferAsset(type)
    );
    const musicPromises = (Object.keys(MUSIC_ASSET_URL_MAP) as MusicTrack[]).map((track) =>
      this.loadMusicBufferAsset(track)
    );
    await Promise.allSettled([...sfxPromises, ...musicPromises]);
  }

  /**
   * Carga y decodifica una muestra binaria WAV para un tipo de SFX.
   */
  public async loadAudioBufferAsset(type: AudioSfxType): Promise<AudioBuffer | null> {
    if (this.sfxAudioBufferMap.has(type)) {
      return this.sfxAudioBufferMap.get(type) ?? null;
    }
    if (this.failedAssetSet.has(type)) {
      return null;
    }
    if (this.assetLoadingPromises.has(type)) {
      return this.assetLoadingPromises.get(type) ?? null;
    }

    const url = SFX_ASSET_URL_MAP[type];
    if (!url || typeof fetch === 'undefined') return null;

    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          this.failedAssetSet.add(type);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();

        if (!this.ctx) {
          this.initAudioContext();
        }
        if (!this.ctx) {
          return null;
        }

        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.sfxAudioBufferMap.set(type, audioBuffer);
        return audioBuffer;
      } catch {
        this.failedAssetSet.add(type);
        return null;
      } finally {
        this.assetLoadingPromises.delete(type);
      }
    })();

    this.assetLoadingPromises.set(type, promise);
    return promise;
  }

  /**
   * Carga y decodifica una muestra binaria WAV para una pista BGM.
   */
  public async loadMusicBufferAsset(track: MusicTrack): Promise<AudioBuffer | null> {
    if (this.musicAudioBufferMap.has(track)) {
      return this.musicAudioBufferMap.get(track) ?? null;
    }
    if (this.failedMusicAssetSet.has(track)) {
      return null;
    }
    if (this.musicLoadingPromises.has(track)) {
      return this.musicLoadingPromises.get(track) ?? null;
    }

    const url = MUSIC_ASSET_URL_MAP[track];
    if (!url || typeof fetch === 'undefined') return null;

    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          this.failedMusicAssetSet.add(track);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();

        if (!this.ctx) {
          this.initAudioContext();
        }
        if (!this.ctx) {
          return null;
        }

        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.musicAudioBufferMap.set(track, audioBuffer);
        return audioBuffer;
      } catch {
        this.failedMusicAssetSet.add(track);
        return null;
      } finally {
        this.musicLoadingPromises.delete(track);
      }
    })();

    this.musicLoadingPromises.set(track, promise);
    return promise;
  }

  public isAssetLoaded(type: AudioSfxType): boolean {
    return this.sfxAudioBufferMap.has(type);
  }

  public isMusicLoaded(track: MusicTrack): boolean {
    return this.musicAudioBufferMap.has(track);
  }

  public registerAudioBuffer(type: AudioSfxType, buffer: AudioBuffer): void {
    this.sfxAudioBufferMap.set(type, buffer);
  }

  public registerMusicBuffer(track: MusicTrack, buffer: AudioBuffer): void {
    this.musicAudioBufferMap.set(track, buffer);
  }

  /**
   * Ejecuta la política de Ducking composable atenuando temporalmente el canal musical ante eventos prioritarios.
   * La ganancia activa equivale a la solicitud más fuerte (menor factor de ganancia / menor dB).
   * Solicitudes más débiles extienden el horizonte sin degradar la profundidad de atenuación existente.
   */
  private triggerDucking(priority: AudioSfxPriority, durationMs: number, type?: AudioSfxType): void {
    if (priority !== 'high' && priority !== 'terminal') return;
    if (!this.ctx || !this.musicGain) return;

    const isEasAlarm = type === 'suddenDeathStarted' || durationMs >= 5000;
    const reqId = type || (priority === 'terminal' ? 'terminal' : `sfx-${priority}`);
    // Atenuación: -10 dB (~0.3162) para alarma EAS de Muerte Súbita, -8 dB (~0.398) para Terminal, -6 dB (~0.501) para Alta
    const targetAttenuation = isEasAlarm ? 0.3162 : priority === 'terminal' ? 0.398 : 0.501;
    const attackSec = 0.03; // Ataque rápido de 30 ms
    const releaseSec = isEasAlarm ? 0.80 : 0.35; // Recuperación suave de 800 ms para alarma EAS, 350 ms para SFX

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const expiresAtMs = nowMs + durationMs;

    this.activeDuckingRequests.set(reqId, {
      id: reqId,
      targetAttenuation,
      releaseSec,
      expiresAtMs,
    });

    this.evaluateActiveDucking(attackSec);
  }

  private evaluateActiveDucking(rampSec?: number): void {
    if (!this.ctx || !this.musicGain) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. Limpiar solicitudes expiradas
    for (const [id, req] of this.activeDuckingRequests.entries()) {
      if (req.expiresAtMs <= nowMs) {
        this.activeDuckingRequests.delete(id);
      }
    }

    if (this.duckingTimerId !== null) {
      clearTimeout(this.duckingTimerId);
      this.duckingTimerId = null;
    }

    // 2. Si no hay solicitudes activas, liberar ducking
    if (this.activeDuckingRequests.size === 0) {
      this.releaseDucking(this.lastDuckingReleaseSec);
      return;
    }

    // 3. Determinar la atenuación más fuerte (menor factor de ganancia)
    let minAttenuation = 1.0;
    let maxReleaseSec = 0.35;
    let nextExpirationMs = Infinity;

    for (const req of this.activeDuckingRequests.values()) {
      if (req.targetAttenuation < minAttenuation) {
        minAttenuation = req.targetAttenuation;
      }
      if (req.releaseSec > maxReleaseSec) {
        maxReleaseSec = req.releaseSec;
      }
      if (req.expiresAtMs < nextExpirationMs) {
        nextExpirationMs = req.expiresAtMs;
      }
    }

    this.lastDuckingReleaseSec = maxReleaseSec;
    this.duckUntilMs = nextExpirationMs;

    const nowCtx = this.ctx.currentTime;
    const transitionSec = rampSec ?? 0.03;

    try {
      this.musicGain.gain.cancelScheduledValues(nowCtx);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, nowCtx);
      this.musicGain.gain.linearRampToValueAtTime(minAttenuation * this.musicBusVolume, nowCtx + transitionSec);
    } catch {
      // Ignorar defensivamente
    }

    const remainingMs = Math.max(0, nextExpirationMs - nowMs);
    this.duckingTimerId = window.setTimeout(() => {
      this.evaluateActiveDucking();
    }, remainingMs);
  }

  private releaseDucking(releaseSec = 0.35): void {
    if (this.duckingTimerId !== null) {
      clearTimeout(this.duckingTimerId);
      this.duckingTimerId = null;
    }
    this.activeDuckingRequests.clear();
    this.duckUntilMs = 0;
    this.activeDuckingPriority = null;

    if (!this.ctx || !this.musicGain) return;

    const nowCtx = this.ctx.currentTime;

    try {
      this.musicGain.gain.cancelScheduledValues(nowCtx);
      this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, nowCtx);
      this.musicGain.gain.linearRampToValueAtTime(this.musicBusVolume, nowCtx + releaseSec);
    } catch {
      // Ignorar defensivamente
    }
  }

  /**
   * Resetea explícitamente cualquier estado activo de ducking (útil en teardown del laboratorio DEV).
   */
  public resetDucking(): void {
    if (this.duckingTimerId !== null) {
      clearTimeout(this.duckingTimerId);
      this.duckingTimerId = null;
    }
    this.activeDuckingRequests.clear();
    this.duckUntilMs = 0;
    this.activeDuckingPriority = null;

    if (this.ctx && this.musicGain) {
      try {
        const nowCtx = this.ctx.currentTime;
        this.musicGain.gain.cancelScheduledValues(nowCtx);
        this.musicGain.gain.setValueAtTime(this.musicBusVolume, nowCtx);
      } catch {
        // Ignorar
      }
    }
  }

  public playSfx(type: AudioSfxType, options?: { forceSynthetic?: boolean }): void {
    if (!this.sfxEnabled || !this.ctx || this.ctx.state !== 'running') return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const lastTime = this.lastSfxTimeMap.get(type) ?? 0;

    if (now - lastTime < DEDUPLICATION_WINDOW_MS) {
      return; // Deduplicación síncrona
    }

    if (this.activePlayingTypes.has(type)) {
      return;
    }

    this.lastSfxTimeMap.set(type, now);
    this.activePlayingTypes.add(type);

    const sfxNow = this.ctx.currentTime;
    const meta = getSfxMetadata(type);
    const audioBuffer = !options?.forceSynthetic ? this.sfxAudioBufferMap.get(type) : null;
    const effectiveDurationMs = audioBuffer ? Math.ceil(audioBuffer.duration * 1000) : meta.durationMs;

    const presetNode = this.ctx.createGain();
    presetNode.gain.setValueAtTime(meta.presetGain, sfxNow);

    if (this.sfxGain) {
      presetNode.connect(this.sfxGain);
    } else if (this.masterGain) {
      presetNode.connect(this.masterGain);
    } else {
      presetNode.connect(this.ctx.destination);
    }

    if (audioBuffer && !options?.forceSynthetic) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(presetNode);
        source.start(sfxNow);
      } catch {
        renderSyntheticSfx(this.ctx, presetNode, type, sfxNow);
      }
    } else {
      if (!options?.forceSynthetic && SFX_ASSET_URL_MAP[type] && !this.failedAssetSet.has(type)) {
        void this.loadAudioBufferAsset(type);
      }
      renderSyntheticSfx(this.ctx, presetNode, type, sfxNow);
    }

    // Disparar Ducking si el SFX posee prioridad Alta o Terminal con su duración real
    this.triggerDucking(meta.priority, effectiveDurationMs, type);

    const durationSec = (effectiveDurationMs + 100) / 1000;
    window.setTimeout(() => {
      this.activePlayingTypes.delete(type);
      try {
        presetNode.disconnect();
      } catch {
        // Ignorar
      }
    }, Math.ceil(durationSec * 1000));
  }

  public handleEngineEvent(event: EngineEvent): void {
    if (!this.sfxEnabled || !this.ctx || this.ctx.state !== 'running') return;

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
    if (!this.ctx || this.ctx.state !== 'running') return;
    switch (event.type) {
      case 'participantEvent':
        if (event.participant === 'playerOne') {
          if (event.event.type === 'sabotageTriggered' || event.event.type === 'gameOver') {
            return;
          }
          this.handleEngineEvent(event.event);
        }
        break;

      case 'sabotageRouted': {
        const isTriggered = event.source === 'playerOne';
        const isTargetPlayerOne = event.target === 'playerOne';

        if (!isTriggered && !isTargetPlayerOne) return;

        let sfxType: AudioSfxType = 'sabotageTriggered';
        switch (event.sabotage) {
          case 'residuos':
            sfxType = isTriggered ? 'residuesTriggered' : 'residuesReceived';
            break;
          case 'sobrecarga':
            sfxType = isTriggered ? 'overloadTriggered' : 'overloadReceived';
            break;
          case 'polaridad':
            sfxType = isTriggered ? 'reversePolarityTriggered' : 'reversePolarityReceived';
            break;
        }

        this.playSfx(sfxType);
        break;
      }

      case 'suddenDeathWarning':
        this.playSfx('suddenDeathWarning');
        break;

      case 'suddenDeathStarted':
        // Transición de Gameplay BGM -> Sudden Death BGM y disparo de la alarma EAS con ducking
        this.playMusic('suddenDeath', { fadeOutDurationMs: 600 });
        this.playSfx('suddenDeathStarted');
        break;

      case 'battleEnded':
        this.resetDucking();
        if (event.winner === 'playerOne') {
          this.playMusic('victory', { fadeOutDurationMs: 600 });
          if (!this.isMusicLoaded('victory')) {
            if (this.isAssetLoaded('victoryFallback')) {
              this.playSfx('victoryFallback');
            } else {
              this.playSfx('victory', { forceSynthetic: true });
            }
          }
        } else {
          this.stopMusic({ fadeOutDurationMs: 600 });
          this.playSfx('gameOver');
        }
        break;
    }
  }

  public playMusic(track: MusicTrack, options?: { fadeOutDurationMs?: number }): void {
    this.desiredMusicTrack = track;

    if (this.isMusicPausedState && (this.pausedMusicTrack === track || this.currentMusicTrack === track)) {
      if (!this.musicEnabled) {
        this.stopActiveMusicSource(options);
        return;
      }
      this.resumeMusic();
      return;
    }

    if (this.currentMusicTrack === track && this.currentMusicSource && !this.isMusicPausedState) {
      if (!this.musicEnabled) {
        this.stopActiveMusicSource(options);
      }
      return; // Pista ya activa sonando en loop: se mantiene sin reiniciar
    }

    this.isMusicPausedState = false;
    this.pausedMusicTrack = null;
    this.musicPlaybackOffsetSeconds = 0;

    const previousTrackGain = this.currentTrackGainNode;
    const previousSource = this.currentMusicSource;
    this.currentMusicTrack = track;

    if (!this.musicEnabled) {
      this.stopActiveMusicSource(options);
      return;
    }

    if (!this.ctx || !this.musicGain) {
      if (!this.failedMusicAssetSet.has(track) && MUSIC_ASSET_URL_MAP[track]) {
        void this.loadMusicBufferAsset(track);
      }
      return;
    }

    const fadeDurationMs = options?.fadeOutDurationMs ?? 400;
    const nowCtx = this.ctx.currentTime;

    if (previousTrackGain && previousSource) {
      try {
        const fadeSec = fadeDurationMs / 1000;
        previousTrackGain.gain.cancelScheduledValues(nowCtx);
        previousTrackGain.gain.setValueAtTime(previousTrackGain.gain.value, nowCtx);
        previousTrackGain.gain.linearRampToValueAtTime(0.0001, nowCtx + fadeSec);
        window.setTimeout(() => {
          try {
            previousSource.stop();
            previousSource.disconnect();
            previousTrackGain.disconnect();
          } catch {
            // Ignorar
          }
        }, fadeDurationMs + 50);
      } catch {
        // Ignorar
      }
    }

    const audioBuffer = this.musicAudioBufferMap.get(track);
    if (!audioBuffer) {
      this.currentMusicSource = null;
      this.currentTrackGainNode = null;
      if (!this.failedMusicAssetSet.has(track) && MUSIC_ASSET_URL_MAP[track]) {
        void this.loadMusicBufferAsset(track).then((loadedBuffer) => {
          if (loadedBuffer && this.currentMusicTrack === track && !this.currentMusicSource) {
            this.playMusic(track);
          }
        });
      }
      return;
    }

    try {
      const trackGain = this.ctx.createGain();
      trackGain.gain.setValueAtTime(0.0001, nowCtx);
      trackGain.gain.exponentialRampToValueAtTime(1.0, nowCtx + 0.05);
      trackGain.connect(this.musicGain);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(trackGain);
      source.start(nowCtx, 0);

      this.currentMusicSource = source;
      this.currentTrackGainNode = trackGain;
      this.musicStartedAtContextTime = nowCtx;
    } catch {
      this.currentMusicSource = null;
      this.currentTrackGainNode = null;
    }
  }

  public pauseMusic(options?: { fadeOutDurationMs?: number }): void {
    if (this.isMusicPausedState || !this.ctx || !this.currentMusicTrack) {
      return;
    }

    const nowCtx = this.ctx.currentTime;
    const elapsed = Math.max(0, nowCtx - this.musicStartedAtContextTime);
    const audioBuffer = this.musicAudioBufferMap.get(this.currentMusicTrack);
    const bufferDuration = audioBuffer ? audioBuffer.duration : 0;

    let newOffset = this.musicPlaybackOffsetSeconds + elapsed;
    if (bufferDuration > 0) {
      newOffset = newOffset % bufferDuration;
    }

    this.musicPlaybackOffsetSeconds = newOffset;
    this.isMusicPausedState = true;
    this.pausedMusicTrack = this.currentMusicTrack;

    const fadeDurationMs = options?.fadeOutDurationMs ?? 150;
    const sourceToStop = this.currentMusicSource;
    const gainToStop = this.currentTrackGainNode;

    this.currentMusicSource = null;
    this.currentTrackGainNode = null;

    if (gainToStop && sourceToStop) {
      try {
        const fadeSec = fadeDurationMs / 1000;
        gainToStop.gain.cancelScheduledValues(nowCtx);
        gainToStop.gain.setValueAtTime(gainToStop.gain.value, nowCtx);
        gainToStop.gain.linearRampToValueAtTime(0.0001, nowCtx + fadeSec);
        window.setTimeout(() => {
          try {
            sourceToStop.stop();
            sourceToStop.disconnect();
            gainToStop.disconnect();
          } catch {
            // Ignorar
          }
        }, fadeDurationMs + 20);
      } catch {
        // Ignorar
      }
    }
  }

  public resumeMusic(options?: { fadeInDurationMs?: number }): void {
    if (!this.musicEnabled) {
      return;
    }

    if (!this.isMusicPausedState && this.currentMusicSource) {
      return; // Ya está sonando activamente
    }

    const trackToResume = this.pausedMusicTrack || this.currentMusicTrack;
    if (!trackToResume) {
      return;
    }

    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') {
      return;
    }

    const audioBuffer = this.musicAudioBufferMap.get(trackToResume);
    if (!audioBuffer) {
      if (!this.failedMusicAssetSet.has(trackToResume) && MUSIC_ASSET_URL_MAP[trackToResume]) {
        void this.loadMusicBufferAsset(trackToResume).then((loadedBuffer) => {
          if (loadedBuffer && this.isMusicPausedState) {
            this.resumeMusic(options);
          }
        });
      }
      return;
    }

    if (this.currentMusicSource && this.currentTrackGainNode) {
      try {
        this.currentMusicSource.stop();
        this.currentMusicSource.disconnect();
        this.currentTrackGainNode.disconnect();
      } catch {
        // Ignorar
      }
      this.currentMusicSource = null;
      this.currentTrackGainNode = null;
    }

    const bufferDuration = audioBuffer.duration;
    let startOffset = this.musicPlaybackOffsetSeconds;
    if (bufferDuration > 0) {
      startOffset = startOffset % bufferDuration;
    }

    const fadeInMs = options?.fadeInDurationMs ?? 250;
    const nowCtx = this.ctx.currentTime;

    try {
      const trackGain = this.ctx.createGain();
      const fadeInSec = fadeInMs / 1000;
      trackGain.gain.setValueAtTime(0.0001, nowCtx);
      trackGain.gain.linearRampToValueAtTime(1.0, nowCtx + fadeInSec);
      trackGain.connect(this.musicGain);

      const source = this.ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(trackGain);
      source.start(nowCtx, startOffset);

      this.currentMusicTrack = trackToResume;
      this.currentMusicSource = source;
      this.currentTrackGainNode = trackGain;
      this.musicStartedAtContextTime = nowCtx;
      this.isMusicPausedState = false;
      this.pausedMusicTrack = null;
    } catch {
      this.currentMusicSource = null;
      this.currentTrackGainNode = null;
    }
  }

  public isMusicPaused(): boolean {
    return this.isMusicPausedState;
  }

  public restartMusic(track: MusicTrack): void {
    this.resetDucking();
    this.stopMusic({ fadeOutDurationMs: 0 });
    this.playMusic(track, { fadeOutDurationMs: 0 });
  }

  public stopMusic(options?: { fadeOutDurationMs?: number }): void {
    this.isMusicPausedState = false;
    this.pausedMusicTrack = null;
    this.musicPlaybackOffsetSeconds = 0;
    this.musicStartedAtContextTime = 0;
    this.currentMusicTrack = null;
    this.desiredMusicTrack = null;

    this.stopActiveMusicSource(options);
  }

  private stopActiveMusicSource(options?: { fadeOutDurationMs?: number }): void {
    if (!this.ctx || !this.currentMusicSource || !this.currentTrackGainNode) {
      this.currentMusicSource = null;
      this.currentTrackGainNode = null;
      return;
    }

    const fadeDurationMs = options?.fadeOutDurationMs ?? 400;
    const nowCtx = this.ctx.currentTime;
    const sourceToStop = this.currentMusicSource;
    const gainToStop = this.currentTrackGainNode;

    this.currentMusicSource = null;
    this.currentTrackGainNode = null;

    try {
      const fadeSec = fadeDurationMs / 1000;
      gainToStop.gain.cancelScheduledValues(nowCtx);
      gainToStop.gain.setValueAtTime(gainToStop.gain.value, nowCtx);
      gainToStop.gain.linearRampToValueAtTime(0.0001, nowCtx + fadeSec);
      window.setTimeout(() => {
        try {
          sourceToStop.stop();
          sourceToStop.disconnect();
          gainToStop.disconnect();
        } catch {
          // Ignorar
        }
      }, fadeDurationMs + 50);
    } catch {
      // Ignorar defensivamente
    }
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

  public getMasterGainNode(): GainNode | null {
    return this.masterGain;
  }

  public getMusicGainNode(): GainNode | null {
    return this.musicGain;
  }

  public getSfxGainNode(): GainNode | null {
    return this.sfxGain;
  }

  public getAudioContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public getActiveDuckingPriority(): AudioSfxPriority | null {
    if (this.activeDuckingRequests.size === 0) return null;
    if (this.activeDuckingRequests.has('suddenDeathStarted')) return 'high';
    if (this.activeDuckingRequests.has('terminal')) return 'terminal';
    return 'high';
  }

  public destroy(): void {
    if (this.currentMusicSource) {
      try {
        this.currentMusicSource.stop();
        this.currentMusicSource.disconnect();
      } catch {
        // Ignorar
      }
      this.currentMusicSource = null;
    }
    if (this.currentTrackGainNode) {
      try {
        this.currentTrackGainNode.disconnect();
      } catch {
        // Ignorar
      }
      this.currentTrackGainNode = null;
    }
    if (this.duckingTimerId !== null) {
      clearTimeout(this.duckingTimerId);
      this.duckingTimerId = null;
    }
    this.activeDuckingRequests.clear();

    if (this.ctx) {
      try {
        if (this.ctx.state !== 'closed') {
          this.ctx.close();
        }
      } catch {
        // Ignorar
      }
      this.ctx = null;
    }
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.desiredMusicTrack = null;
    this.lastSfxTimeMap.clear();
    this.sfxAudioBufferMap.clear();
    this.musicAudioBufferMap.clear();
    this.assetLoadingPromises.clear();
    this.musicLoadingPromises.clear();
    this.failedAssetSet.clear();
    this.failedMusicAssetSet.clear();
    this.activePlayingTypes.clear();
    this.currentMusicTrack = null;
    this.musicStartedAtContextTime = 0;
    this.musicPlaybackOffsetSeconds = 0;
    this.isMusicPausedState = false;
    this.pausedMusicTrack = null;
  }

}

/**
 * Acceso directo para obtener la instancia singleton del servicio de audio.
 */
export function getAudioManager(): AudioManager {
  return AudioManager.getInstance();
}
