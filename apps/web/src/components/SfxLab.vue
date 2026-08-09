<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';
import { getAudioManager, getSfxMetadata, type AudioSfxType } from '../audio';
import {
  generateSfxWav,
  generateSyntheticSfxZip,
  generateProductionSfxZip,
} from '../audio/sfx-wav-export';

const audioManager = getAudioManager();
const isMuted = ref(audioManager.isMuted());
const audioContextState = ref<ReturnType<typeof audioManager.getAudioContextState>>(audioManager.getAudioContextState());

const isPlayingSequence = ref(false);
const activeSequenceType = ref<AudioSfxType | null>(null);
let sequenceTimers: number[] = [];

const isTestBgmActive = ref(false);
let testBgmOsc: OscillatorNode | null = null;
let testBgmGain: GainNode | null = null;

const isExportingZip = ref(false);
const zipProgressStatus = ref<string | null>(null);
const exportError = ref<string | null>(null);

// Registro de URLs de Blob creadas por tipo de SFX
const sfxObjectUrls = ref<Partial<Record<AudioSfxType, string>>>({});
const zipObjectUrl = ref<string | null>(null);

// Estado de reproducción de pistas BGM
const isVictoryBgmPlaying = ref(false);
const isMenuBgmPlaying = ref(false);
const isGameplayBgmPlaying = ref(false);
const isSuddenDeathBgmPlaying = ref(false);
const isSuddenDeathTransitionActive = ref(false);

interface SfxFamilyGroup {
  readonly title: string;
  readonly description: string;
  readonly items: readonly AudioSfxType[];
}

const SFX_FAMILIES: readonly SfxFamilyGroup[] = [
  {
    title: 'UI Y GAMEPLAY',
    description: 'Interacciones de interfaz, movimiento, encajes de piezas e impactos de caída.',
    items: ['uiClick', 'pieceLocked', 'hardDrop', 'linesCleared', 'quadOrTSpin'],
  },
  {
    title: 'SABOTAJES',
    description: 'Efectos sonoros tácticos de ataque y defensa entre jugadores.',
    items: [
      'sabotageTriggered',
      'residuesTriggered',
      'residuesReceived',
      'overloadTriggered',
      'overloadReceived',
      'reversePolarityTriggered',
      'reversePolarityReceived',
    ],
  },
  {
    title: 'MUERTE SÚBITA',
    description: 'Eventos de tensión máxima y aceleración de partida.',
    items: ['suddenDeathWarning', 'suddenDeathStarted'],
  },
  {
    title: 'FIN DE PARTIDA',
    description: 'Resolución de batalla (derrota o victoria).',
    items: ['gameOver', 'victoryFallback', 'victory'],
  },
] as const;

// Lista ordenada continua para "Escuchar Todos"
const ALL_SFX_IN_ORDER: readonly AudioSfxType[] = [
  'uiClick',
  'pieceLocked',
  'hardDrop',
  'linesCleared',
  'quadOrTSpin',
  'sabotageTriggered',
  'residuesTriggered',
  'residuesReceived',
  'overloadTriggered',
  'overloadReceived',
  'reversePolarityTriggered',
  'reversePolarityReceived',
  'suddenDeathWarning',
  'suddenDeathStarted',
  'gameOver',
  'victoryFallback',
  'victory',
];

function playMenuBgm(): void {
  void unlockAudio();
  audioManager.playMusic('menu');
  isMenuBgmPlaying.value = true;
  isVictoryBgmPlaying.value = false;
}

function stopMenuBgm(): void {
  audioManager.stopMusic({ fadeOutDurationMs: 600 });
  isMenuBgmPlaying.value = false;
}

function playVictoryBgm(): void {
  void unlockAudio();
  audioManager.playMusic('victory');
  isVictoryBgmPlaying.value = true;
  isMenuBgmPlaying.value = false;
}

function stopVictoryBgm(): void {
  audioManager.stopMusic({ fadeOutDurationMs: 600 });
  isVictoryBgmPlaying.value = false;
}

async function testVictoryLoop(): Promise<void> {
  await unlockAudio();
  audioManager.resetDucking();
  isMenuBgmPlaying.value = false;
  isGameplayBgmPlaying.value = false;
  isSuddenDeathBgmPlaying.value = false;
  isSuddenDeathTransitionActive.value = false;
  audioManager.playMusic('victory');
  isVictoryBgmPlaying.value = true;
}

async function playGameplayBgm(): Promise<void> {
  await unlockAudio();
  audioManager.resetDucking();
  isMenuBgmPlaying.value = false;
  isVictoryBgmPlaying.value = false;
  isSuddenDeathBgmPlaying.value = false;
  isSuddenDeathTransitionActive.value = false;
  audioManager.playMusic('gameplay');
  isGameplayBgmPlaying.value = true;
}

function stopGameplayBgm(): void {
  audioManager.stopMusic({ fadeOutDurationMs: 600 });
  isGameplayBgmPlaying.value = false;
}

async function playSuddenDeathBgm(): Promise<void> {
  await unlockAudio();
  audioManager.resetDucking();
  isMenuBgmPlaying.value = false;
  isVictoryBgmPlaying.value = false;
  isGameplayBgmPlaying.value = false;
  isSuddenDeathTransitionActive.value = false;
  audioManager.playMusic('suddenDeath');
  isSuddenDeathBgmPlaying.value = true;
}

function stopSuddenDeathBgm(): void {
  stopSuddenDeathTransition();
}

async function testSuddenDeathTransition(): Promise<void> {
  await unlockAudio();
  audioManager.resetDucking();
  isMenuBgmPlaying.value = false;
  isVictoryBgmPlaying.value = false;
  isGameplayBgmPlaying.value = false;
  isSuddenDeathBgmPlaying.value = false;
  isSuddenDeathTransitionActive.value = true;

  // 1. Iniciar Gameplay BGM
  audioManager.playMusic('gameplay');

  // 2. Transición a Sudden Death con alarma EAS ducked tras 2,5 segundos
  const timerId = window.setTimeout(() => {
    if (!isSuddenDeathTransitionActive.value) return;
    audioManager.handleBattleEvent({
      type: 'suddenDeathStarted',
      step: 1000,
    });
    isSuddenDeathBgmPlaying.value = true;
  }, 2500);

  sequenceTimers.push(timerId);
}

function stopSuddenDeathTransition(): void {
  isSuddenDeathTransitionActive.value = false;
  isSuddenDeathBgmPlaying.value = false;
  audioManager.resetDucking();
  audioManager.stopMusic({ fadeOutDurationMs: 600 });
}

function updateAudioState(): void {
  audioContextState.value = audioManager.getAudioContextState();
}

async function unlockAudio(): Promise<void> {
  await audioManager.unlock();
  updateAudioState();
}

function toggleMute(): void {
  void unlockAudio();
  audioManager.playSfx('uiClick');
  isMuted.value = audioManager.toggleMute();
}

async function toggleTestBgm(): Promise<void> {
  await unlockAudio();
  if (isTestBgmActive.value) {
    stopTestBgm();
  } else {
    startTestBgm();
  }
}

function startTestBgm(): void {
  stopTestBgm();
  isTestBgmActive.value = true;

  const musicGain = audioManager.getMusicGainNode();
  const ctx = audioManager.getAudioContext();
  if (!ctx || !musicGain) return;

  try {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, ctx.currentTime);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicGain);

    osc.start();

    testBgmOsc = osc;
    testBgmGain = gain;
  } catch {
    isTestBgmActive.value = false;
  }
}

function stopTestBgm(): void {
  if (testBgmOsc) {
    try {
      testBgmOsc.stop();
      testBgmOsc.disconnect();
    } catch {
      // Ignorar
    }
    testBgmOsc = null;
  }
  if (testBgmGain) {
    try {
      testBgmGain.disconnect();
    } catch {
      // Ignorar
    }
    testBgmGain = null;
  }
  isTestBgmActive.value = false;
}

async function playSingleSfx(type: AudioSfxType, forceSynthetic = false): Promise<void> {
  await unlockAudio();
  audioManager.playSfx(type, { forceSynthetic });
}

function stopSequence(): void {
  sequenceTimers.forEach((timerId) => clearTimeout(timerId));
  sequenceTimers = [];
  isPlayingSequence.value = false;
  activeSequenceType.value = null;
}

async function playAllSequence(): Promise<void> {
  if (isPlayingSequence.value) return;

  await unlockAudio();
  isPlayingSequence.value = true;
  activeSequenceType.value = ALL_SFX_IN_ORDER[0]!;

  ALL_SFX_IN_ORDER.forEach((type, index) => {
    const delay = index * 900;
    const timerId = window.setTimeout(() => {
      if (!isPlayingSequence.value) return;
      activeSequenceType.value = type;
      audioManager.playSfx(type);

      if (index === ALL_SFX_IN_ORDER.length - 1) {
        const endTimer = window.setTimeout(() => {
          isPlayingSequence.value = false;
          activeSequenceType.value = null;
        }, 900);
        sequenceTimers.push(endTimer);
      }
    }, delay);

    sequenceTimers.push(timerId);
  });
}

function revokeSfxObjectUrl(type: AudioSfxType): void {
  const existingUrl = sfxObjectUrls.value[type];
  if (existingUrl) {
    try {
      URL.revokeObjectURL(existingUrl);
    } catch {
      // Ignorar
    }
    delete sfxObjectUrls.value[type];
  }
}

function revokeZipObjectUrl(): void {
  if (zipObjectUrl.value) {
    try {
      URL.revokeObjectURL(zipObjectUrl.value);
    } catch {
      // Ignorar
    }
    zipObjectUrl.value = null;
  }
}

function revokeAllObjectUrls(): void {
  (Object.keys(sfxObjectUrls.value) as AudioSfxType[]).forEach((type) => {
    revokeSfxObjectUrl(type);
  });
  revokeZipObjectUrl();
}

async function downloadSingleWav(type: AudioSfxType): Promise<void> {
  exportError.value = null;
  revokeSfxObjectUrl(type);

  try {
    const result = await generateSfxWav(type);
    const objectUrl = URL.createObjectURL(result.blob);
    sfxObjectUrls.value[type] = objectUrl;

    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  } catch (err) {
    exportError.value = `Error al exportar WAV para ${type}: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function downloadProductionZipPack(): Promise<void> {
  if (isExportingZip.value) return;
  isExportingZip.value = true;
  exportError.value = null;
  revokeZipObjectUrl();

  try {
    const result = await generateProductionSfxZip((current, total) => {
      zipProgressStatus.value = `Descargando reales ${current}/${total}...`;
    });

    zipProgressStatus.value = 'ZIP real listo. Descargando...';

    const url = URL.createObjectURL(result.blob);
    zipObjectUrl.value = url;

    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  } catch (err) {
    revokeZipObjectUrl();
    exportError.value = `Error al descargar los activos reales de producción: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isExportingZip.value = false;
  }
}

async function downloadSyntheticZipPack(): Promise<void> {
  if (isExportingZip.value) return;
  isExportingZip.value = true;
  exportError.value = null;
  revokeZipObjectUrl();

  try {
    const result = await generateSyntheticSfxZip((current, total) => {
      zipProgressStatus.value = `Sintetizando ${current}/${total}...`;
    });

    zipProgressStatus.value = 'ZIP sintético listo. Descargando...';

    const url = URL.createObjectURL(result.blob);
    zipObjectUrl.value = url;

    if (typeof document !== 'undefined') {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  } catch (err) {
    revokeZipObjectUrl();
    exportError.value = `Error al generar los fallbacks sintéticos: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    isExportingZip.value = false;
  }
}

const VICTORY_FALLBACK_META = {
  type: 'victoryFallback' as AudioSfxType,
  label: 'Victoria — Fallback real',
  priority: 'terminal' as const,
  presetGain: 1.0,
  waveShape: 'muestra procesada WAV / Level Up Mission Complete CC0',
  frequencyRange: 'Beetlemuse CC0 (48 kHz estéreo)',
  durationMs: 1800,
  envelope: 'Fade-in 3 ms, fade-out 250 ms',
  intention: 'Fallback real de victoria si la música principal Sector Secured no se puede cargar',
  filename: 'victory-fallback.wav',
};

function safeGetSfxMetadata(type: AudioSfxType) {
  if (type === 'victoryFallback') return VICTORY_FALLBACK_META;
  const meta = getSfxMetadata(type);
  if (meta) return meta;
  return {
    type,
    label: type,
    priority: 'low' as const,
    presetGain: 1.0,
    waveShape: 'muestra procesada / fallback',
    frequencyRange: '48 kHz',
    durationMs: 200,
    envelope: 'Fade-in / fade-out',
    intention: 'Evento sonoro de Rautfall',
    filename: `${type}.wav`,
  };
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'low':
      return 'LOW (Interfaz / Eventos discretos)';
    case 'medium':
      return 'MEDIUM (Gameplay estándar / Movimientos)';
    case 'high':
      return 'HIGH (Sabotajes tácticos / Eventos de peligro)';
    case 'terminal':
      return 'TERMINAL (Fin de partida / Muerte Súbita)';
    default:
      return priority.toUpperCase();
  }
}

function getDisplayTitle(type: AudioSfxType): string {
  if (type === 'victory') return 'Victoria — Último fallback sintético';
  if (type === 'victoryFallback') return 'Victoria — Fallback real';
  return safeGetSfxMetadata(type).label;
}

onBeforeUnmount(() => {
  stopSequence();
  stopTestBgm();
  stopVictoryBgm();
  audioManager.resetDucking();
  revokeAllObjectUrls();
});
</script>

<template>
  <div class="sfx-lab-container panel-riveted" data-testid="sfx-lab-panel">
    <!-- Cabecera del Laboratorio -->
    <header class="sfx-lab-header">
      <div class="title-tag">
        <h1 class="sfx-lab-title" data-testid="sfx-lab-title">SFX LAB</h1>
      </div>
      <div class="audio-context-status" data-testid="audio-context-status">
        <span class="status-label">AudioContext:</span>
        <span
          class="status-value"
          :class="audioContextState"
          data-testid="audio-context-state-value"
        >
          {{
            audioContextState === 'running'
              ? 'ACTIVO'
              : audioContextState === 'suspended'
              ? 'BLOQUEADO'
              : 'NO INICIALIZADO'
          }}
        </span>
      </div>
      <button
        type="button"
        class="lab-btn"
        data-testid="unlock-audio-button"
        @click="unlockAudio"
      >
        🔓 Desbloquear Audio
      </button>
      <button
        type="button"
        class="lab-btn"
        data-testid="audio-mute-button"
        :data-audio-muted="isMuted"
        @click="toggleMute"
      >
        {{ isMuted ? '🔇 AUDIO SILENCIADO' : '🔊 AUDIO ACTIVO' }}
      </button>
      <button
        type="button"
        class="lab-btn"
        :class="{ 'lab-btn--active': isTestBgmActive }"
        data-testid="toggle-test-bgm-button"
        @click="toggleTestBgm"
      >
        {{ isTestBgmActive ? '🛑 DETENER FONDO PRUEBA DEV' : '🎵 FONDO PRUEBA DEV (MEZCLA/DUCKING)' }}
      </button>
    </header>

    <!-- Nota auditiva DEV obligatoria -->
    <div class="sfx-dev-note" data-testid="sfx-dev-note" role="note">
      <span class="note-badge">DEV NOTE</span>
      Escucha cada efecto con y sin el fondo de prueba DEV. Audita ducking y jerarquía sonora.
    </div>

    <!-- Explicación de Prioridad en Leyenda General -->
    <details class="priority-legend-panel">
      <summary class="legend-summary">
        💡 ¿Qué significa Prioridad en Rautfall?
      </summary>
      <div class="legend-content">
        <p>La prioridad no determina volumen ni calidad; rige la jerarquía de mezcla, la supresión de ducking y la concurrencia en la Web Audio API:</p>
        <ul>
          <li><strong>LOW:</strong> Interfaz de usuario (clics) y micro-eventos discretos.</li>
          <li><strong>MEDIUM:</strong> Gameplay normal (movimiento, caída de piezas, bloqueos y líneas simples).</li>
          <li><strong>HIGH:</strong> Eventos tácticos importantes (sabotajes, quads, t-spins y aviso de muerte súbita).</li>
          <li><strong>TERMINAL:</strong> Cierre de partida (Game Over, Victoria, inicio de Muerte Súbita) con máxima prioridad sobre la mezcla.</li>
        </ul>
      </div>
    </details>

    <!-- Barra de Controles Principales -->
    <div class="sfx-controls-bar">
      <button
        type="button"
        class="lab-btn lab-btn--primary"
        data-testid="play-all-sfx-button"
        :disabled="isPlayingSequence"
        @click="playAllSequence"
      >
        ▶ ESCUCHAR TODOS
      </button>
      <button
        type="button"
        class="lab-btn lab-btn--danger"
        data-testid="stop-sequence-button"
        :disabled="!isPlayingSequence"
        @click="stopSequence"
      >
        ■ DETENER
      </button>
      <button
        type="button"
        class="lab-btn lab-btn--accent"
        data-testid="download-production-zip-button"
        :disabled="isExportingZip"
        @click="downloadProductionZipPack"
      >
        {{ isExportingZip ? (zipProgressStatus || '⏳ Descargando...') : '⬇ DESCARGAR ASSETS REALES' }}
      </button>
      <button
        type="button"
        class="lab-btn lab-btn--outline"
        data-testid="download-synthetic-zip-button"
        :disabled="isExportingZip"
        @click="downloadSyntheticZipPack"
      >
        ⚡ DESCARGAR FALLBACKS SINTÉTICOS
      </button>
    </div>

    <div v-if="exportError" class="sfx-error-banner" data-testid="sfx-export-error">
      {{ exportError }}
    </div>

    <!-- Secciones de Familias de SFX -->
    <section v-for="family in SFX_FAMILIES" :key="family.title" class="sfx-family-section">
      <div class="family-header">
        <h2 class="family-title">{{ family.title }}</h2>
        <p class="family-description">{{ family.description }}</p>
      </div>

      <div class="sfx-grid">
        <div
          v-for="type in family.items"
          :key="type"
          class="sfx-card"
          :class="{ 'sfx-card--active': activeSequenceType === type }"
          :data-testid="`sfx-card-${type}`"
        >
          <!-- Frontal Despejado de la Tarjeta -->
          <div class="sfx-card-header">
            <h3 class="sfx-card-title">{{ getDisplayTitle(type) }}</h3>
            <span class="sfx-filename">{{ safeGetSfxMetadata(type).filename }}</span>
            <div class="sfx-badges">
              <span
                v-if="audioManager.isAssetLoaded(type)"
                class="asset-badge asset-badge--real"
              >
                ASSET REAL · {{ safeGetSfxMetadata(type).durationMs }} ms
              </span>
              <span v-else class="asset-badge asset-badge--fallback">
                FALLBACK SINTÉTICO · {{ safeGetSfxMetadata(type).durationMs }} ms
              </span>
            </div>
          </div>

          <!-- Acciones Principales -->
          <div class="sfx-card-actions">
            <button
              type="button"
              class="lab-btn lab-btn--sm"
              :data-testid="`play-sfx-${type}`"
              @click="playSingleSfx(type, false)"
            >
              ▶ {{ audioManager.isAssetLoaded(type) ? 'ESCUCHAR MUESTRA' : 'ESCUCHAR' }}
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--outline"
              :data-testid="`play-synthetic-${type}`"
              @click="playSingleSfx(type, true)"
            >
              ⚡ ESCUCHAR FALLBACK
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--outline"
              :data-testid="`download-wav-${type}`"
              @click="downloadSingleWav(type)"
            >
              💾 DESCARGAR WAV
            </button>
          </div>

          <!-- Detalles Técnicos Colapsables -->
          <details class="technical-details">
            <summary class="details-summary">Detalles técnicos</summary>
            <div class="details-body">
              <div class="detail-row">
                <span class="detail-label">Tipo:</span>
                <span class="detail-value">
                  {{ audioManager.isAssetLoaded(type) ? 'Asset real de producción' : 'Fallback sintético procedural' }}
                </span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Prioridad:</span>
                <span class="detail-value">{{ getPriorityLabel(safeGetSfxMetadata(type).priority) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Preset Gain:</span>
                <span class="detail-value">{{ Math.round(safeGetSfxMetadata(type).presetGain * 100) }}% (Bus SFX master)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duración:</span>
                <span class="detail-value">{{ safeGetSfxMetadata(type).durationMs }} ms</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Forma de onda:</span>
                <span class="detail-value">{{ safeGetSfxMetadata(type).waveShape }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Frecuencia:</span>
                <span class="detail-value">{{ safeGetSfxMetadata(type).frequencyRange }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Envolvente:</span>
                <span class="detail-value">{{ safeGetSfxMetadata(type).envelope }}</span>
              </div>
              <div class="detail-row detail-row--full">
                <span class="detail-label">Intención sonora:</span>
                <span class="detail-value">{{ safeGetSfxMetadata(type).intention }}</span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- Sección de Música (BGM) -->
    <section class="sfx-family-section music-section">
      <div class="family-header">
        <h2 class="family-title">MÚSICA</h2>
        <p class="family-description">Pistas de fondo ambiental (BGM) para menús, partida y pantalla de resultados.</p>
      </div>

      <div class="sfx-grid">


        <div class="sfx-card sfx-card--music">
          <div class="sfx-card-header">
            <h3 class="sfx-card-title">Menú BGM</h3>
            <span class="sfx-filename">apps/web/public/audio/music/menu.wav</span>
            <div class="sfx-badges">
              <span class="asset-badge asset-badge--music">MÚSICA BGM</span>
            </div>
          </div>
          <p class="placeholder-text">
            Pista musical real de Menú Principal (Terminal Pulse Loop v01) procesada e integrada en producción.
          </p>
          <div class="sfx-card-actions">
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--accent"
              data-testid="play-menu-bgm"
              @click="playMenuBgm"
            >
              ▶ ESCUCHAR MÚSICA
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--danger"
              data-testid="stop-menu-bgm"
              :disabled="!isMenuBgmPlaying"
              @click="stopMenuBgm"
            >
              ■ DETENER MÚSICA
            </button>
          </div>
          <details class="technical-details">
            <summary class="details-summary">Detalles técnicos</summary>
            <div class="details-body">
              <div class="detail-row">
                <span class="detail-label">Ruta:</span>
                <span class="detail-value">apps/web/public/audio/music/menu.wav</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado de carga:</span>
                <span class="detail-value">{{ audioManager.isMusicLoaded('menu') ? 'Cargado en memoria' : 'Listo para precarga' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duración:</span>
                <span class="detail-value">31.500 s</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Formato:</span>
                <span class="detail-value">PCM 16-bit Estéreo 48 kHz (6.048.044 bytes)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Niveles:</span>
                <span class="detail-value">Peak -6.83 dBFS / RMS -23.50 dBFS</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Looping:</span>
                <span class="detail-value">Sí (source.loop = true, bucle continuo completo de 31.5 s)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Bus:</span>
                <span class="detail-value">source → trackGain → musicGain → masterGain</span>
              </div>
            </div>
          </details>
        </div>

        <div class="sfx-card sfx-card--music">
          <div class="sfx-card-header">
            <h3 class="sfx-card-title">Gameplay BGM</h3>
            <span class="sfx-filename">apps/web/public/audio/music/gameplay.wav</span>
            <div class="sfx-badges">
              <span class="asset-badge asset-badge--music">MÚSICA BGM</span>
            </div>
          </div>
          <p class="placeholder-text">
            Pista de combate rítmico acelerado (Breach Protocol Loop v04) procesada e integrada para la partida activa.
          </p>
          <div class="sfx-card-actions">
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--accent"
              data-testid="play-gameplay-bgm"
              @click="playGameplayBgm"
            >
              ▶ ESCUCHAR MÚSICA
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--danger"
              data-testid="stop-gameplay-bgm"
              :disabled="!isGameplayBgmPlaying"
              @click="stopGameplayBgm"
            >
              ■ DETENER MÚSICA
            </button>
          </div>
          <details class="technical-details">
            <summary class="details-summary">Detalles técnicos</summary>
            <div class="details-body">
              <div class="detail-row">
                <span class="detail-label">Ruta:</span>
                <span class="detail-value">apps/web/public/audio/music/gameplay.wav</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado de carga:</span>
                <span class="detail-value">{{ audioManager.isMusicLoaded('gameplay') ? 'Cargado en memoria' : 'Listo para precarga' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duración:</span>
                <span class="detail-value">126,095 s</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Formato:</span>
                <span class="detail-value">PCM 16-bit Estéreo 48 kHz (24.210.372 bytes)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Niveles:</span>
                <span class="detail-value">Peak -6.41 dBFS / RMS -24.11 dBFS</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Looping:</span>
                <span class="detail-value">Sí (source.loop = true, bucle continuo de 126.1 s)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Bus:</span>
                <span class="detail-value">source → trackGain → musicGain → masterGain</span>
              </div>
            </div>
          </details>
        </div>

        <div class="sfx-card sfx-card--music">
          <div class="sfx-card-header">
            <h3 class="sfx-card-title">Sudden Death BGM</h3>
            <span class="sfx-filename">apps/web/public/audio/music/sudden-death.wav</span>
            <div class="sfx-badges">
              <span class="asset-badge asset-badge--music">MÚSICA BGM</span>
            </div>
          </div>
          <p class="placeholder-text">
            Pista musical de máxima presión (Breach Protocol 138 BPM Loop v01) procesada e integrada para la fase final.
          </p>
          <div class="sfx-card-actions">
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--accent"
              data-testid="play-sudden-death-bgm"
              @click="playSuddenDeathBgm"
            >
              ▶ ESCUCHAR MÚSICA
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--warning"
              data-testid="test-sudden-death-transition"
              @click="testSuddenDeathTransition"
            >
              ▶ PROBAR TRANSICIÓN + ALARMA
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--danger"
              data-testid="stop-sudden-death-bgm"
              :disabled="!isSuddenDeathBgmPlaying && !isSuddenDeathTransitionActive"
              @click="stopSuddenDeathBgm"
            >
              ■ DETENER MÚSICA
            </button>
          </div>
          <details class="technical-details">
            <summary class="details-summary">Detalles técnicos</summary>
            <div class="details-body">
              <div class="detail-row">
                <span class="detail-label">Ruta:</span>
                <span class="detail-value">apps/web/public/audio/music/sudden-death.wav</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado de carga:</span>
                <span class="detail-value">{{ audioManager.isMusicLoaded('suddenDeath') ? 'Cargado en memoria' : 'Listo para precarga' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duración / Tempo:</span>
                <span class="detail-value">100,515 s / 138 BPM</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Formato:</span>
                <span class="detail-value">PCM 16-bit Estéreo 48 kHz (19.299.012 bytes)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Niveles:</span>
                <span class="detail-value">Peak -6.42 dBFS / RMS -24.30 dBFS</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ducking EAS:</span>
                <span class="detail-value">-10 dB atenuado durante suddenDeathStarted (10.0 s) + rampa de recuperación de 800 ms</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Looping:</span>
                <span class="detail-value">Sí (source.loop = true, bucle continuo de 100.5 s)</span>
              </div>
            </div>
          </details>
        </div>

        <div class="sfx-card sfx-card--music">
          <div class="sfx-card-header">
            <h3 class="sfx-card-title">Victory / Results BGM</h3>
            <span class="sfx-filename">apps/web/public/audio/music/victory.wav</span>
            <div class="sfx-badges">
              <span class="asset-badge asset-badge--music">MÚSICA BGM</span>
            </div>
          </div>
          <p class="placeholder-text">
            Pista musical de victoria (Sector Secured - Option 2) con entrada directa y loop fluido para la pantalla de Resultados.
          </p>
          <div class="sfx-card-actions">
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--accent"
              data-testid="play-victory-bgm"
              @click="playVictoryBgm"
            >
              ▶ ESCUCHAR MÚSICA
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--warning"
              data-testid="test-victory-loop"
              @click="testVictoryLoop"
            >
              ▶ PROBAR LOOP
            </button>
            <button
              type="button"
              class="lab-btn lab-btn--sm lab-btn--danger"
              data-testid="stop-victory-bgm"
              :disabled="!isVictoryBgmPlaying"
              @click="stopVictoryBgm"
            >
              ■ DETENER MÚSICA
            </button>
          </div>
          <details class="technical-details">
            <summary class="details-summary">Detalles técnicos</summary>
            <div class="details-body">
              <div class="detail-row">
                <span class="detail-label">Ruta:</span>
                <span class="detail-value">apps/web/public/audio/music/victory.wav</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fuente origen:</span>
                <span class="detail-value">Sector Secured (Loop) - Option 2.wav</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado de carga:</span>
                <span class="detail-value">{{ audioManager.isMusicLoaded('victory') ? 'Cargado en memoria' : 'Listo para precarga' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Duración / Seam:</span>
                <span class="detail-value">42.000 s (loopStart: 0s, loopEnd: 42.000s)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Formato:</span>
                <span class="detail-value">PCM 16-bit Estéreo 48 kHz (8.064.044 bytes)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Niveles:</span>
                <span class="detail-value">Peak -7.40 dBFS / RMS -25.75 dBFS (Crossfade: 150 ms)</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Looping:</span>
                <span class="detail-value">Sí (source.loop = true, bucle continuo de 42.0 s)</span>
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.sfx-lab-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  color: #e0e6ed;
  background-color: #121820;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.sfx-lab-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #2a3442;
}

.sfx-lab-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 2.2rem;
  font-weight: 700;
  letter-spacing: 2px;
  color: #00f0ff;
  margin: 0;
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
}

.audio-context-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  background: #1a2330;
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
}

.status-value.running {
  color: #00ff88;
}

.status-value.blocked {
  color: #ffaa00;
}

.status-value.unavailable {
  color: #ff4444;
}

.priority-legend-panel {
  background-color: #16202c;
  border: 1px solid #2a384a;
  border-radius: 6px;
  padding: 0.6rem 1rem;
}

.legend-summary {
  font-weight: 700;
  color: #00f0ff;
  cursor: pointer;
  font-size: 0.95rem;
}

.legend-content {
  margin-top: 0.8rem;
  font-size: 0.9rem;
  color: #cad6e2;
  line-height: 1.5;
}

.legend-content ul {
  margin: 0.5rem 0 0 1.2rem;
  padding: 0;
}

.sfx-controls-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem;
  background-color: #16202c;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #243242;
}

.sfx-family-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: #161e27;
  padding: 1.2rem;
  border-radius: 8px;
  border: 1px solid #232f3e;
}

.family-header {
  border-bottom: 1px solid #2c3c4e;
  padding-bottom: 0.5rem;
}

.family-title {
  font-family: 'Rajdhani', sans-serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #00f0ff;
  margin: 0;
  letter-spacing: 1px;
}

.family-description {
  font-size: 0.88rem;
  color: #8c9dae;
  margin: 0.2rem 0 0 0;
}

.sfx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 1.2rem;
}

.sfx-card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  background-color: #1c2633;
  border: 1px solid #2a384a;
  border-radius: 6px;
  padding: 1rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sfx-card--active {
  border-color: #00f0ff;
  box-shadow: 0 0 12px rgba(0, 240, 255, 0.25);
}

.sfx-card--music {
  border-color: #9d4edd;
}

.sfx-card--placeholder {
  opacity: 0.75;
  border-dash: 1px dashed #4a5a6e;
}

.sfx-card-header {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.sfx-card-title {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
}

.sfx-filename {
  font-family: monospace;
  font-size: 0.82rem;
  color: #7a8b9e;
}

.sfx-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.2rem;
}

.asset-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.asset-badge--real {
  background-color: #004d61;
  color: #00f0ff;
  border: 1px solid #00f0ff;
}

.asset-badge--fallback {
  background-color: #5c3c00;
  color: #ffb700;
  border: 1px solid #ffb700;
}

.asset-badge--music {
  background-color: #4a154b;
  color: #e0aaff;
  border: 1px solid #c77dff;
}

.asset-badge--pending {
  background-color: #2b3542;
  color: #9aa8b8;
  border: 1px solid #4a5a6e;
}

.sfx-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.technical-details {
  background-color: #141b24;
  border: 1px solid #222d3a;
  border-radius: 4px;
  padding: 0.4rem 0.6rem;
  font-size: 0.85rem;
}

.details-summary {
  font-weight: 600;
  color: #8c9dae;
  cursor: pointer;
}

.details-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #1c2633;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.82rem;
}

.detail-row--full {
  flex-direction: column;
  gap: 0.1rem;
}

.detail-label {
  color: #6b7c90;
  font-weight: 600;
}

.detail-value {
  color: #d0dce8;
}

.placeholder-text {
  font-size: 0.85rem;
  color: #7a8b9e;
  margin: 0;
  line-height: 1.4;
}

.sfx-error-banner {
  background-color: #4a1515;
  border: 1px solid #ff4444;
  color: #ffaaaa;
  padding: 0.8rem 1.2rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.lab-btn {
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  border: 1px solid #3a4a5e;
  border-radius: 4px;
  background-color: #222d3c;
  color: #e0e6ed;
  cursor: pointer;
  transition: all 0.15s ease;
}

.lab-btn:hover:not(:disabled) {
  background-color: #2c3a4e;
  border-color: #00f0ff;
  color: #ffffff;
}

.lab-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lab-btn--sm {
  font-size: 0.8rem;
  padding: 0.35rem 0.65rem;
}

.lab-btn--primary {
  background-color: #005580;
  border-color: #0088cc;
  color: #ffffff;
}

.lab-btn--primary:hover:not(:disabled) {
  background-color: #0077b3;
  border-color: #00f0ff;
}

.lab-btn--accent {
  background-color: #006655;
  border-color: #009980;
  color: #ffffff;
}

.lab-btn--accent:hover:not(:disabled) {
  background-color: #008870;
  border-color: #00ffcc;
}

.lab-btn--danger {
  background-color: #661111;
  border-color: #992222;
  color: #ffffff;
}

.lab-btn--danger:hover:not(:disabled) {
  background-color: #881515;
  border-color: #ff4444;
}

.lab-btn--outline {
  background-color: transparent;
  border-color: #3a4a5e;
}

.lab-btn--active {
  background-color: #00f0ff;
  color: #0d1117;
  border-color: #00f0ff;
  font-weight: 700;
}
</style>
