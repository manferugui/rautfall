import { zipSync } from 'fflate';
import type { AudioSfxType } from './types';
import { getSfxMetadata, renderSyntheticSfx, SFX_ORDER } from './sfx-synth';

export interface GeneratedWavResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly arrayBuffer: ArrayBuffer;
}

export interface GeneratedZipResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly zipUint8Array: Uint8Array;
}

/**
 * Convierte un AudioBuffer de Web Audio API a un ArrayBuffer con formato PCM WAV de 16 bits.
 *
 * Aplica escalado únicamente si maxPeak > 1.0 para evitar clipping.
 */
export function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM sin compresión
  const bitDepth = 16;
  const numSamples = buffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // 1. Cabecera RIFF
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // 2. Sub-chunk 'fmt '
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // 3. Sub-chunk 'data'
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // 4. Determinar si existe clipping (maxPeak > 1.0)
  let maxPeak = 0;
  for (let c = 0; c < numChannels; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < channelData.length; i++) {
      const val = Math.abs(channelData[i]!);
      if (val > maxPeak) maxPeak = val;
    }
  }

  // Reducir amplitud exclusivamente si hay clipping (maxPeak > 1.0)
  const scale = maxPeak > 1.0 ? 0.99 / maxPeak : 1.0;

  // 5. Intercalar muestras y escribir enteros de 16 bits con signo (little-endian)
  let offset = headerSize;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const rawSample = buffer.getChannelData(c)[i]! * scale;
      const clampedSample = Math.max(-1, Math.min(1, rawSample));
      const int16Sample = clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff;
      view.setInt16(offset, Math.floor(int16Sample), true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Genera de forma síncrona/offline un archivo PCM WAV a 48 kHz mono de un SFX sintético.
 */
export async function generateSfxWav(
  type: AudioSfxType,
  sampleRate: number = 48000,
): Promise<GeneratedWavResult> {
  const meta = getSfxMetadata(type);
  const durationSec = (meta.durationMs + 100) / 1000; // 100 ms de cola/release para no cortar la señal
  const numSamples = Math.ceil(durationSec * sampleRate);

  const OfflineCtxClass =
    (typeof globalThis !== 'undefined' && (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext) ||
    (typeof window !== 'undefined' && ((window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext));

  if (!OfflineCtxClass) {
    throw new Error('OfflineAudioContext no está disponible en este entorno.');
  }

  const offlineCtx = new OfflineCtxClass(1, numSamples, sampleRate);
  renderSyntheticSfx(offlineCtx, offlineCtx.destination, type, 0);

  const renderedBuffer = await offlineCtx.startRendering();
  const arrayBuffer = audioBufferToWav(renderedBuffer);
  const blob = new Blob([arrayBuffer], { type: 'audio/wav' });

  return {
    blob,
    filename: meta.filename,
    arrayBuffer,
  };
}

/**
 * Genera un paquete ZIP conteniendo los parches sintetizados proceduralmente (fallbacks).
 */
export async function generateSyntheticSfxZip(
  onProgress?: (current: number, total: number) => void,
  sampleRate: number = 48000,
): Promise<GeneratedZipResult> {
  const zipFilesMap: Record<string, Uint8Array> = {};
  const total = SFX_ORDER.length;

  for (let i = 0; i < total; i++) {
    const type = SFX_ORDER[i]!;
    const meta = getSfxMetadata(type);
    onProgress?.(i + 1, total);

    const wavResult = await generateSfxWav(type, sampleRate);
    zipFilesMap[meta.filename] = new Uint8Array(wavResult.arrayBuffer);
  }

  const zipUint8Array = zipSync(zipFilesMap);
  const blob = new Blob([zipUint8Array.buffer], { type: 'application/zip' });

  return {
    blob,
    filename: 'rautfall-synthetic-sfx-pack.zip',
    zipUint8Array,
  };
}

/**
 * Alias de compatibilidad previa para fallbacks sintéticos.
 */
export const generateSfxZip = generateSyntheticSfxZip;

/**
 * Lista explícita de archivos binarios WAV reales de producción alojados en /audio/sfx/
 */
export const PRODUCTION_SFX_ASSET_FILES = [
  'ui-click.wav',
  'piece-locked.wav',
  'hard-drop.wav',
  'lines-cleared.wav',
  'residues-triggered.wav',
  'residues-received.wav',
  'overload-triggered.wav',
  'overload-received.wav',
  'reverse-polarity-triggered.wav',
  'reverse-polarity-received.wav',
  'sudden-death-started.wav',
  'game-over.wav',
  'victory-fallback.wav',
  'pause-shutter-close.wav',
  'pause-shutter-open.wav',
] as const;

/**
 * Descarga y empaqueta en ZIP los activos WAV binarios reales de producción actualmente en servidor public/audio/sfx/
 */
export async function generateProductionSfxZip(
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedZipResult> {
  const zipFilesMap: Record<string, Uint8Array> = {};
  const total = PRODUCTION_SFX_ASSET_FILES.length;

  for (let i = 0; i < total; i++) {
    const filename = PRODUCTION_SFX_ASSET_FILES[i]!;
    onProgress?.(i + 1, total);

    const url = `/audio/sfx/${filename}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`No se pudo cargar el activo real de producción ${filename} desde ${url} (HTTP ${res.status})`);
    }

    const arrayBuffer = await res.arrayBuffer();
    zipFilesMap[filename] = new Uint8Array(arrayBuffer);
  }

  const zipUint8Array = zipSync(zipFilesMap);
  const blob = new Blob([zipUint8Array.buffer], { type: 'application/zip' });

  return {
    blob,
    filename: 'rautfall-production-sfx-pack.zip',
    zipUint8Array,
  };
}
