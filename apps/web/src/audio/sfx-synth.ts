import type { AudioSfxType, AudioSfxPriority } from './types';

/**
 * Sintetizador de efectos de sonido basados en Web Audio API pura.
 * Genera tonos e impactos limpios de baja latencia sin depender de ficheros de audio externos.
 */

/**
 * Metadatos contractuales de un efecto de sonido sintético para diagnóstico y laboratorio DEV.
 */
export interface SfxMetadata {
  readonly type: AudioSfxType;
  readonly label: string;
  readonly priority: AudioSfxPriority;
  readonly presetGain: number;
  readonly waveShape: string;
  readonly frequencyRange: string;
  readonly durationMs: number;
  readonly envelope: string;
  readonly intention: string;
  readonly filename: string;
}

export const SFX_METADATA_MAP: Record<AudioSfxType, SfxMetadata> = {
  // PRIORIDAD BAJA
  uiClick: {
    type: 'uiClick',
    label: 'Clic de UI',
    priority: 'low',
    presetGain: 0.85,
    waveShape: 'muestra procesada WAV / Industrial Switch With Spring CC0',
    frequencyRange: 'cookies+policy CC0 (48 kHz mono / 1 kHz–5 kHz)',
    durationMs: 80,
    envelope: 'Fade-in 1 ms, fade-out 25 ms (80 ms total)',
    intention: 'Clic de interfaz UI: respuesta mecánica discreta de interruptor industrial con fallback sintético',
    filename: 'ui-click.wav',
  },
  pieceLocked: {
    type: 'pieceLocked',
    label: 'Fijación de Pieza',
    priority: 'low',
    presetGain: 0.85,
    waveShape: 'muestra procesada WAV / Mechanical switch (latch) 02 CC0',
    frequencyRange: 'xkeril CC0 (48 kHz mono / 300 Hz–3.5 kHz)',
    durationMs: 130,
    envelope: 'Fade-in 2 ms, fade-out 35 ms (130 ms total)',
    intention: 'Fijación de pieza: encaje/cierre mecánico firme de cerrojo (clack industrial)',
    filename: 'piece-locked.wav',
  },

  // PRIORIDAD MEDIA
  hardDrop: {
    type: 'hardDrop',
    label: 'Hard Drop',
    priority: 'medium',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / Kitchen Dish Clank CC0',
    frequencyRange: 'OwlStorm CC0 (48 kHz mono / 150 Hz–2.5 kHz)',
    durationMs: 180,
    envelope: 'Fade-in 1 ms, fade-out 45 ms (180 ms total)',
    intention: 'Hard Drop: clunk mecánico seco de asentamiento de pieza pesada en la cuadrícula',
    filename: 'hard-drop.wav',
  },
  linesCleared: {
    type: 'linesCleared',
    label: 'Eliminación de Líneas',
    priority: 'medium',
    presetGain: 0.85,
    waveShape: 'muestra procesada WAV / Short Muddy Sweep CC0',
    frequencyRange: 'D_Yonqui CC0 (48 kHz estéreo / 1.5 kHz–6 kHz)',
    durationMs: 280,
    envelope: 'Fade-in 2 ms, fade-out 45 ms (280 ms total)',
    intention: 'Eliminación de 1-3 líneas: barrido espectral tecnológico con fallback sintético',
    filename: 'lines-cleared.wav',
  },

  // PRIORIDAD ALTA
  quadOrTSpin: {
    type: 'quadOrTSpin',
    label: 'Quad / T-Spin',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'triangle (arpegio de 4 notas)',
    frequencyRange: '659.25 Hz → 1318.51 Hz (E5, G#5, B5, E6)',
    durationMs: 370,
    envelope: 'Exponencial (0.2 → 0.001 en 250 ms por nota, paso 40 ms)',
    intention: 'Quad (4 líneas) o T-Spin: arpegio ascendente brillante (E5 → G#5 → B5 → E6)',
    filename: 'rautfall-quad-or-tspin.wav',
  },
  sabotageTriggered: {
    type: 'sabotageTriggered',
    label: 'Sabotaje Genérico',
    priority: 'high',
    presetGain: 0.9,
    waveShape: 'sawtooth (pulso doble 720→480Hz / 620→360Hz) + ruido filtrado',
    frequencyRange: '720→480 Hz y 620→360 Hz (pulsos) + 3.5 kHz (estática)',
    durationMs: 165,
    envelope: 'Ataque eléctrico + pulso doble + cola estática (165 ms total)',
    intention: 'Alerta táctica genérica: pulso digital doble e interferencia electrónica industrial (fallback)',
    filename: 'rautfall-sabotage-triggered.wav',
  },
  residuesTriggered: {
    type: 'residuesTriggered',
    label: 'Sabotaje Residuos (Enviado)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / microimpactos fallback',
    frequencyRange: 'Scrap Metal Crash (48 kHz estéreo / 180→420 Hz)',
    durationMs: 380,
    envelope: 'Fade-in 3 ms, fade-out 60 ms (380 ms total)',
    intention: 'Envío de residuos: choque metálico seco y limpio en estéreo',
    filename: 'residues-triggered.wav',
  },
  residuesReceived: {
    type: 'residuesReceived',
    label: 'Sabotaje Residuos (Recibido)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / microimpactos descendentes fallback',
    frequencyRange: 'Scrap Metal Crash (48 kHz estéreo / 450→160 Hz)',
    durationMs: 900,
    envelope: 'Fade-in 4 ms, fade-out 120 ms (900 ms total)',
    intention: 'Recepción de residuos: caída caótica pesada de escombros metálicos',
    filename: 'residues-received.wav',
  },
  overloadTriggered: {
    type: 'overloadTriggered',
    label: 'Sabotaje Sobrecarga (Enviado)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / sawtooth ascendente fallback',
    frequencyRange: 'Electric Arc 01 (48 kHz estéreo / 1–12 kHz)',
    durationMs: 350,
    envelope: 'Fade-in 2 ms, fade-out 50 ms (350 ms total)',
    intention: 'Envío de sobrecarga: descarga eléctrica breve, seca y agresiva',
    filename: 'overload-triggered.wav',
  },
  overloadReceived: {
    type: 'overloadReceived',
    label: 'Sabotaje Sobrecarga (Recibido)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / sawtooth+alarma fallback',
    frequencyRange: 'Electric Arc 01 (48 kHz estéreo / 1–12 kHz)',
    durationMs: 850,
    envelope: 'Fade-in 3 ms, fade-out 140 ms (850 ms total)',
    intention: 'Recepción de sobrecarga: arco eléctrico denso, caótico y sostenido',
    filename: 'overload-received.wav',
  },
  reversePolarityTriggered: {
    type: 'reversePolarityTriggered',
    label: 'Sabotaje Polaridad (Enviado)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / square sweep CC0',
    frequencyRange: 'Blackie666 CC0 (48 kHz mono / 700 Hz–6 kHz)',
    durationMs: 380,
    envelope: 'Fade-in 2 ms, fade-out 60 ms (380 ms total)',
    intention: 'Envío de polaridad inversa: ráfaga digital ofensiva de onda cuadrada con ataque seco y respuesta inmediata',
    filename: 'reverse-polarity-triggered.wav',
  },
  reversePolarityReceived: {
    type: 'reversePolarityReceived',
    label: 'Sabotaje Polaridad (Recibido)',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / barrido inverso fallback',
    frequencyRange: 'Noisevember Skrewell Sweeps (48 kHz estéreo / 500 Hz–8 kHz)',
    durationMs: 850,
    envelope: 'Fade-in 3 ms, fade-out 130 ms (850 ms total)',
    intention: 'Recepción de polaridad inversa: sweep robótico modulado, caótico y desconcertante',
    filename: 'reverse-polarity-received.wav',
  },
  suddenDeathWarning: {
    type: 'suddenDeathWarning',
    label: 'Aviso Muerte Súbita',
    priority: 'high',
    presetGain: 0.9,
    waveShape: 'square (dos pulsos)',
    frequencyRange: '880 Hz',
    durationMs: 270,
    envelope: 'Exponencial (0.15 → 0.001 en 150 ms por pulso)',
    intention: 'Aviso de Muerte Súbita: tono de alarma de dos pulsos',
    filename: 'rautfall-sudden-death-warning.wav',
  },
  suddenDeathStarted: {
    type: 'suddenDeathStarted',
    label: 'Inicio Muerte Súbita',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / sawtooth fallback',
    frequencyRange: 'Alarma EAS Mayotte (48 kHz mono / 220→440→110 Hz)',
    durationMs: 10000,
    envelope: 'Fade-in 30 ms, fade-out 500 ms (10,0 s total)',
    intention: 'Inicio de Muerte Súbita: muestra procesada Mayotte EAS Alarm de 10,0s con fallback sintético',
    filename: 'rautfall-sudden-death-started.wav',
  },

  // PRIORIDAD TERMINAL
  gameOver: {
    type: 'gameOver',
    label: 'Fin de Partida (Derrota)',
    priority: 'terminal',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / Electric Failure High Voltage Power Down',
    frequencyRange: 'Electric Failure #2 ATP2 CC0 (48 kHz estéreo)',
    durationMs: 2050,
    envelope: 'Fade-in 3 ms, fade-out 250 ms (2,05 s total)',
    intention: 'Fin de partida / Derrota: fallo eléctrico, inestabilidad de alto voltaje y power-down',
    filename: 'game-over.wav',
  },
  victory: {
    type: 'victory',
    label: 'Victoria (Último Fallback Sintético)',
    priority: 'terminal',
    presetGain: 1.0,
    waveShape: 'triangle (arpegio de 4 notas)',
    frequencyRange: '523.25 Hz → 1046.5 Hz (C5, E5, G5, C6)',
    durationMs: 530,
    envelope: 'Exponencial (0.2 → 0.001 en 350 ms por nota, paso 60 ms)',
    intention: 'Último fallback sintético defensivo de victoria: acorde mayor brillante de cierre',
    filename: 'rautfall-victory.wav',
  },
  victoryFallback: {
    type: 'victoryFallback',
    label: 'Victoria (Fallback Real)',
    priority: 'terminal',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / Level Up Mission Complete CC0',
    frequencyRange: 'Beetlemuse CC0 (48 kHz estéreo)',
    durationMs: 1800,
    envelope: 'Fade-in 3 ms, fade-out 250 ms (1,8 s total)',
    intention: 'Fallback real de victoria: fanfarria corta de éxito cuando la música de resultados no está disponible',
    filename: 'victory-fallback.wav',
  },
  pauseShutterClose: {
    type: 'pauseShutterClose',
    label: 'Cierre Compuerta Pausa',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / Hydraulic hatch closure',
    frequencyRange: '48 kHz mono / 60 Hz–3.5 kHz',
    durationMs: 500,
    envelope: 'Fade-in 1 ms, masa hidráulica 420 ms, golpe final 80 ms (500 ms total)',
    intention: 'Cierre de compuerta industrial de pausa: sellado mecánico con masa hidráulica e impacto sordo',
    filename: 'pause-shutter-close.wav',
  },
  pauseShutterOpen: {
    type: 'pauseShutterOpen',
    label: 'Apertura Compuerta Pausa',
    priority: 'high',
    presetGain: 1.0,
    waveShape: 'muestra procesada WAV / Hydraulic hatch release',
    frequencyRange: '48 kHz mono / 100 Hz–4 kHz',
    durationMs: 240,
    envelope: 'Descompresión 60 ms, deslizamiento rápido 180 ms (240 ms total)',
    intention: 'Apertura rápida de compuerta industrial de pausa: descompresión hidráulica y repliegue',
    filename: 'pause-shutter-open.wav',
  },
};

export const SFX_ORDER: readonly AudioSfxType[] = [
  // Prioridad Baja
  'uiClick',
  'pieceLocked',
  // Prioridad Media
  'hardDrop',
  'linesCleared',
  // Prioridad Alta
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
  // Prioridad Terminal
  'gameOver',
  'victory',
];

/**
 * Obtiene los metadatos contractuales de un SFX determinado.
 */
export function getSfxMetadata(type: AudioSfxType): SfxMetadata {
  return SFX_METADATA_MAP[type];
}

/**
 * Renderiza los nodos de un SFX sobre cualquier BaseAudioContext (AudioContext u OfflineAudioContext).
 */
export function renderSyntheticSfx(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: AudioSfxType,
  now: number = 0,
): void {
  switch (type) {
    case 'hardDrop':
      createHardDropSfx(ctx, dest, now);
      break;
    case 'pieceLocked':
      createPieceLockedSfx(ctx, dest, now);
      break;
    case 'linesCleared':
      createLinesClearedSfx(ctx, dest, now);
      break;
    case 'quadOrTSpin':
      createQuadOrTSpinSfx(ctx, dest, now);
      break;
    case 'sabotageTriggered':
      createSabotageSfx(ctx, dest, now);
      break;
    case 'residuesTriggered':
      createResiduesTriggeredSfx(ctx, dest, now);
      break;
    case 'residuesReceived':
      createResiduesReceivedSfx(ctx, dest, now);
      break;
    case 'overloadTriggered':
      createOverloadTriggeredSfx(ctx, dest, now);
      break;
    case 'overloadReceived':
      createOverloadReceivedSfx(ctx, dest, now);
      break;
    case 'reversePolarityTriggered':
      createReversePolarityTriggeredSfx(ctx, dest, now);
      break;
    case 'reversePolarityReceived':
      createReversePolarityReceivedSfx(ctx, dest, now);
      break;
    case 'suddenDeathWarning':
      createSuddenDeathWarningSfx(ctx, dest, now);
      break;
    case 'suddenDeathStarted':
      createSuddenDeathStartedSfx(ctx, dest, now);
      break;
    case 'gameOver':
      createGameOverSfx(ctx, dest, now);
      break;
    case 'victory':
      createVictorySfx(ctx, dest, now);
      break;
    case 'uiClick':
      createUiClickSfx(ctx, dest, now);
      break;
  }
}

/**
 * Reproduce un SFX sintético mediante Web Audio API si el contexto está activo.
 */
export function playSyntheticSfx(
  ctx: AudioContext | null,
  destinationNode: AudioNode | null,
  type: AudioSfxType,
): void {
  if (!ctx || !destinationNode) return;
  if (ctx.state !== 'running') return;

  const now = ctx.currentTime;

  try {
    renderSyntheticSfx(ctx, destinationNode, type, now);
  } catch {
    // Ignorar errores defensivamente si los nodos de audio fallan en navegadores restringidos
  }
}

/** Conecta el oscilador y el gain a su destino y asegura su desconexión al finalizar */
function connectAndAutoDisconnect(osc: OscillatorNode, gain: GainNode, dest: AudioNode): void {
  osc.connect(gain);
  gain.connect(dest);
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // Ignorar defensivamente
    }
  };
}

/** Genera una ráfaga de ruido blanco sintético filtrado mediante BiquadFilterNode */
function createFilteredNoiseBurst(
  ctx: BaseAudioContext,
  dest: AudioNode,
  now: number,
  durationSec: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  gainVal: number,
  Q: number = 1.0,
): void {
  try {
    const sampleRate = ctx.sampleRate || 48000;
    const bufferSize = Math.max(1, Math.ceil(sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(Q, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gainVal, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(dest);

    noiseSource.onended = () => {
      try {
        noiseSource.disconnect();
        filter.disconnect();
        gainNode.disconnect();
      } catch {
        // Ignorar defensivamente
      }
    };

    noiseSource.start(now);
    noiseSource.stop(now + durationSec);
  } catch {
    // Ignorar defensivamente si el entorno de ejecución no soporta AudioBuffer
  }
}

/** Clic de UI: pulso suave y nítido (18 ms) */
function createUiClickSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(950, now);

  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.018);
}

/** Fijación de pieza: pulso corto y limpio de triángulo (25 ms) */
function createPieceLockedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(580, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.025);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.025);
}

/** Impacto mecánico seco: pieza pesada golpeando estructura metálica (60 ms total) */
function createHardDropSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  // 1. Transitorio de ruido metálico filtrado (12 ms)
  createFilteredNoiseBurst(ctx, dest, now, 0.012, 'bandpass', 2500, 0.25, 2.0);

  // 2. Componente grave de impacto mecánico (200 Hz -> 90 Hz, 50 ms)
  const oscSub = ctx.createOscillator();
  const gainSub = ctx.createGain();
  oscSub.type = 'sine';
  oscSub.frequency.setValueAtTime(200, now);
  oscSub.frequency.exponentialRampToValueAtTime(90, now + 0.05);

  gainSub.gain.setValueAtTime(0.35, now);
  gainSub.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  connectAndAutoDisconnect(oscSub, gainSub, dest);
  oscSub.start(now);
  oscSub.stop(now + 0.05);

  // 3. Resonancia metálica secundaria (1200 Hz -> 600 Hz, 25 ms)
  const oscMetal = ctx.createOscillator();
  const gainMetal = ctx.createGain();
  oscMetal.type = 'triangle';
  oscMetal.frequency.setValueAtTime(1200, now);
  oscMetal.frequency.exponentialRampToValueAtTime(600, now + 0.025);

  gainMetal.gain.setValueAtTime(0.15, now);
  gainMetal.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  connectAndAutoDisconnect(oscMetal, gainMetal, dest);
  oscMetal.start(now);
  oscMetal.stop(now + 0.025);
}

/** Eliminación de 1-3 líneas: acorde consonante brillante de dos tonos (E5 + G#5) (200 ms) */
function createLinesClearedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const freqs = [659.25, 830.61]; // E5, G#5
  const duration = 0.2;

  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    connectAndAutoDisconnect(osc, gain, dest);

    osc.start(now);
    osc.stop(now + duration);
  });
}

/** Quad (4 líneas) o T-Spin: arpegio ascendente brillante (E5 -> G#5 -> B5 -> E6) (370 ms) */
function createQuadOrTSpinSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const freqs = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
  const noteStep = 0.04;
  const noteDuration = 0.25;

  freqs.forEach((freq, idx) => {
    const startTime = now + idx * noteStep;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

    connectAndAutoDisconnect(osc, gain, dest);

    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });

  // Brillo armónico superior en 2.5 kHz (15 ms)
  createFilteredNoiseBurst(ctx, dest, now, 0.015, 'highpass', 2500, 0.15, 2.5);
}

/** Sabotaje genérico (fallback): pulso digital doble e interferencia (165 ms) */
function createSabotageSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  createFilteredNoiseBurst(ctx, dest, now, 0.012, 'bandpass', 3500, 0.25, 1.5);

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(720, now);
  osc1.frequency.exponentialRampToValueAtTime(480, now + 0.035);

  gain1.gain.setValueAtTime(0.18, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  connectAndAutoDisconnect(osc1, gain1, dest);
  osc1.start(now);
  osc1.stop(now + 0.035);

  const startTime2 = now + 0.06;
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(620, startTime2);
  osc2.frequency.exponentialRampToValueAtTime(360, startTime2 + 0.045);

  gain2.gain.setValueAtTime(0.18, startTime2);
  gain2.gain.exponentialRampToValueAtTime(0.001, startTime2 + 0.045);
  connectAndAutoDisconnect(osc2, gain2, dest);
  osc2.start(startTime2);
  osc2.stop(startTime2 + 0.045);

  createFilteredNoiseBurst(ctx, dest, now + 0.1, 0.065, 'bandpass', 2000, 0.12, 1.0);
}

/** Sabotaje Residuos (Enviado): microimpactos granulares + ruido metálico (120 ms) */
function createResiduesTriggeredSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  createFilteredNoiseBurst(ctx, dest, now, 0.03, 'bandpass', 1800, 0.22, 1.5);

  const freqs = [180, 280, 420];
  freqs.forEach((freq, idx) => {
    const startTime = now + idx * 0.025;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.16, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.035);

    connectAndAutoDisconnect(osc, gain, dest);
    osc.start(startTime);
    osc.stop(startTime + 0.035);
  });
}

/** Sabotaje Residuos (Recibido): microimpactos granulares + ruido metálico descendente (130 ms) */
function createResiduesReceivedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  createFilteredNoiseBurst(ctx, dest, now, 0.04, 'bandpass', 1400, 0.25, 1.2);

  const freqs = [450, 290, 160];
  freqs.forEach((freq, idx) => {
    const startTime = now + idx * 0.03;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, startTime + 0.04);

    gain.gain.setValueAtTime(0.18, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

    connectAndAutoDisconnect(osc, gain, dest);
    osc.start(startTime);
    osc.stop(startTime + 0.04);
  });
}

/** Sabotaje Sobrecarga (Enviado): tensión eléctrica ascendente de alta frecuencia (120 ms) */
function createOverloadTriggeredSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(1100, now + 0.12);

  filter.type = 'highpass';
  filter.frequency.setValueAtTime(600, now);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);

  osc.start(now);
  osc.stop(now + 0.12);
}

/** Sabotaje Sobrecarga (Recibido): tensión eléctrica ascendente + alarma descendente (140 ms) */
function createOverloadReceivedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  createOverloadTriggeredSfx(ctx, dest, now);

  const startTime = now + 0.05;
  const oscAlarm = ctx.createOscillator();
  const gainAlarm = ctx.createGain();

  oscAlarm.type = 'sawtooth';
  oscAlarm.frequency.setValueAtTime(900, startTime);
  oscAlarm.frequency.exponentialRampToValueAtTime(300, startTime + 0.08);

  gainAlarm.gain.setValueAtTime(0.18, startTime);
  gainAlarm.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

  connectAndAutoDisconnect(oscAlarm, gainAlarm, dest);
  oscAlarm.start(startTime);
  oscAlarm.stop(startTime + 0.08);
}

/** Sabotaje Polaridad Inversa (Enviado): barrido cruzado contrapuesto (150 ms) */
function createReversePolarityTriggeredSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  // Tono 1 ascendente
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(350, now);
  osc1.frequency.exponentialRampToValueAtTime(850, now + 0.15);

  gain1.gain.setValueAtTime(0.16, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  connectAndAutoDisconnect(osc1, gain1, dest);
  osc1.start(now);
  osc1.stop(now + 0.15);

  // Tono 2 descendente
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(850, now);
  osc2.frequency.exponentialRampToValueAtTime(350, now + 0.15);

  gain2.gain.setValueAtTime(0.14, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  connectAndAutoDisconnect(osc2, gain2, dest);
  osc2.start(now);
  osc2.stop(now + 0.15);
}

/** Sabotaje Polaridad Inversa (Recibido): barrido cruzado inverso + aviso agudo (160 ms) */
function createReversePolarityReceivedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  // Tono 1 descendente
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(900, now);
  osc1.frequency.exponentialRampToValueAtTime(250, now + 0.16);

  gain1.gain.setValueAtTime(0.18, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  connectAndAutoDisconnect(osc1, gain1, dest);
  osc1.start(now);
  osc1.stop(now + 0.16);

  // Tono 2 ascendente
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(250, now);
  osc2.frequency.exponentialRampToValueAtTime(900, now + 0.16);

  gain2.gain.setValueAtTime(0.14, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  connectAndAutoDisconnect(osc2, gain2, dest);
  osc2.start(now);
  osc2.stop(now + 0.16);

  createFilteredNoiseBurst(ctx, dest, now, 0.015, 'highpass', 3000, 0.15, 2.0);
}

/** Aviso de Muerte Súbita: tono de alarma de dos pulsos */
function createSuddenDeathWarningSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const duration = 0.15;
  [0, 0.12].forEach((offset) => {
    const startTime = now + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, startTime);

    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    connectAndAutoDisconnect(osc, gain, dest);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}

/** Inicio de Muerte Súbita: sirena industrial de barrido grave */
function createSuddenDeathStartedSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.4);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.4);
}

/** Fin de partida / Derrota: tono industrial pesado descendente sin sub-sine 60Hz (450 ms) */
function createGameOverSfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  // 1. Oscilador principal diente de sierra filtrado (240 Hz -> 110 Hz, 450 ms, energía >= 100 Hz)
  const osc1 = ctx.createOscillator();
  const filter1 = ctx.createBiquadFilter();
  const gain1 = ctx.createGain();

  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(240, now);
  osc1.frequency.exponentialRampToValueAtTime(110, now + 0.45);

  filter1.type = 'lowpass';
  filter1.frequency.setValueAtTime(800, now);

  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc1.connect(filter1);
  filter1.connect(gain1);
  gain1.connect(dest);

  osc1.start(now);
  osc1.stop(now + 0.45);

  // 2. Resonancia en medios (triángulo 480 Hz -> 220 Hz, 350 ms)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(480, now);
  osc2.frequency.exponentialRampToValueAtTime(220, now + 0.35);

  gain2.gain.setValueAtTime(0.12, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  connectAndAutoDisconnect(osc2, gain2, dest);
  osc2.start(now);
  osc2.stop(now + 0.35);
}

/** Victoria: acorde mayor brillante de cierre (C5 -> E5 -> G5 -> C6) */
function createVictorySfx(ctx: BaseAudioContext, dest: AudioNode, now: number): void {
  const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  const noteStep = 0.06;
  const noteDuration = 0.35;

  freqs.forEach((freq, idx) => {
    const startTime = now + idx * noteStep;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.2, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration);

    connectAndAutoDisconnect(osc, gain, dest);

    osc.start(startTime);
    osc.stop(startTime + noteDuration);
  });
}
