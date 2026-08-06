import type { AudioSfxType } from './types';

/**
 * Sintetizador de efectos de sonido basados en Web Audio API pura.
 * Genera tonos e impactos limpios de baja latencia sin depender de ficheros de audio externos.
 */

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
    switch (type) {
      case 'hardDrop':
        createHardDropSfx(ctx, destinationNode, now);
        break;
      case 'pieceLocked':
        createPieceLockedSfx(ctx, destinationNode, now);
        break;
      case 'linesCleared':
        createLinesClearedSfx(ctx, destinationNode, now);
        break;
      case 'quadOrTSpin':
        createQuadOrTSpinSfx(ctx, destinationNode, now);
        break;
      case 'sabotageTriggered':
        createSabotageSfx(ctx, destinationNode, now);
        break;
      case 'suddenDeathWarning':
        createSuddenDeathWarningSfx(ctx, destinationNode, now);
        break;
      case 'suddenDeathStarted':
        createSuddenDeathStartedSfx(ctx, destinationNode, now);
        break;
      case 'gameOver':
        createGameOverSfx(ctx, destinationNode, now);
        break;
      case 'victory':
        createVictorySfx(ctx, destinationNode, now);
        break;
      case 'uiClick':
        createUiClickSfx(ctx, destinationNode, now);
        break;
    }
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

/** Impacto de caída instantánea: barrido de frecuencia grave descendente con decaimiento rápido */
function createHardDropSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(240, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.08);
}

/** Fijación de pieza: pulso corto y limpio de triángulo */
function createPieceLockedSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.03);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.03);
}

/** Eliminación de 1-3 líneas: acorde consonante brillante de dos tonos (E5 + G#5) */
function createLinesClearedSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const freqs = [659.25, 830.61]; // E5, G#5
  const duration = 0.22;

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

/** Quad (4 líneas) o T-Spin: arpegio ascendente brillante (E5 -> G#5 -> B5 -> E6) */
function createQuadOrTSpinSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
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
}

/** Sabotaje activado/recibido: pulso eléctrico rudo con diente de sierra */
function createSabotageSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.linearRampToValueAtTime(140, now + 0.16);

  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.16);
}

/** Aviso de Muerte Súbita: tono de alarma de dos pulsos */
function createSuddenDeathWarningSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
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
function createSuddenDeathStartedSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
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

/** Fin de partida / Derrota: tono descendente melancólico */
function createGameOverSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.linearRampToValueAtTime(70, now + 0.45);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.45);
}

/** Victoria: acorde mayor brillante de cierre (C5 -> E5 -> G5 -> C6) */
function createVictorySfx(ctx: AudioContext, dest: AudioNode, now: number): void {
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

/** Clic de interfaz UI: pulso suave ultra-corto */
function createUiClickSfx(ctx: AudioContext, dest: AudioNode, now: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(750, now);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);

  connectAndAutoDisconnect(osc, gain, dest);

  osc.start(now);
  osc.stop(now + 0.015);
}
