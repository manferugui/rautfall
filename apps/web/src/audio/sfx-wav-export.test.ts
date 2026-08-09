// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateSfxWav, generateSfxZip, audioBufferToWav } from './sfx-wav-export';
import { SFX_ORDER, getSfxMetadata } from './sfx-synth';
import * as audioIndex from './index';

describe('sfx-wav-export', () => {
  let originalOfflineCtx: unknown;

  beforeEach(() => {
    originalOfflineCtx = (globalThis as Record<string, unknown>).OfflineAudioContext;

    // Class Mock para OfflineAudioContext en jsdom
    class MockOfflineAudioContext {
      public numberOfChannels: number;
      public length: number;
      public sampleRate: number;
      public destination = {};

      constructor(numberOfChannels: number, length: number, sampleRate: number) {
        this.numberOfChannels = numberOfChannels;
        this.length = length;
        this.sampleRate = sampleRate;
      }

      public createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
        return {
          numberOfChannels,
          length,
          sampleRate,
          getChannelData: () => new Float32Array(length),
        };
      }

      public createBufferSource() {
        return {
          buffer: null,
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
      }

      public createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: {
            setValueAtTime: vi.fn(),
          },
          Q: {
            setValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }

      public createOscillator() {
        return {
          type: 'sine',
          frequency: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
      }

      public createGain() {
        return {
          gain: {
            value: 1,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }

      public async startRendering() {
        const channelData = new Float32Array(this.length).fill(0.1);
        return {
          numberOfChannels: this.numberOfChannels,
          sampleRate: this.sampleRate,
          length: this.length,
          getChannelData: () => channelData,
        } as unknown as AudioBuffer;
      }
    }

    (globalThis as Record<string, unknown>).OfflineAudioContext = MockOfflineAudioContext;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).OfflineAudioContext = originalOfflineCtx;
  });

  it('no reexporta generateSfxWav en el índice público normal de audio', () => {
    expect((audioIndex as Record<string, unknown>).generateSfxWav).toBeUndefined();
  });

  it('genera un archivo PCM WAV válido a 48 kHz mono para cada uno de los 16 SFX', async () => {
    for (const type of SFX_ORDER) {
      const meta = getSfxMetadata(type);
      const result = await generateSfxWav(type, 48000);

      expect(result.filename).toBe(meta.filename);
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('audio/wav');
      expect(result.arrayBuffer.byteLength).toBeGreaterThan(44);

      // Comprobar la cabecera RIFF del ArrayBuffer
      const view = new DataView(result.arrayBuffer);
      const riffHeader = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
      const waveHeader = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
      const fmtHeader = String.fromCharCode(view.getUint8(12), view.getUint8(13), view.getUint8(14), view.getUint8(15));
      const dataHeader = String.fromCharCode(view.getUint8(36), view.getUint8(37), view.getUint8(38), view.getUint8(39));

      expect(riffHeader).toBe('RIFF');
      expect(waveHeader).toBe('WAVE');
      expect(fmtHeader).toBe('fmt ');
      expect(dataHeader).toBe('data');

      // Formato PCM (1) y Canales Mono (1)
      expect(view.getUint16(20, true)).toBe(1);
      expect(view.getUint16(22, true)).toBe(1);
      // Sample rate = 48000 Hz
      expect(view.getUint32(24, true)).toBe(48000);
      // Bit depth = 16 bits
      expect(view.getUint16(34, true)).toBe(16);

      // Comprobar que la duración incluye al menos 100 ms de release adicional
      const dataSize = view.getUint32(40, true);
      const sampleCount = dataSize / 2;
      const expectedMinSamples = Math.ceil(((meta.durationMs + 100) / 1000) * 48000);
      expect(sampleCount).toBeGreaterThanOrEqual(expectedMinSamples);
    }
  });

  it('preserva la amplitud original cuando maxPeak <= 1.0 y escala solo cuando maxPeak > 1.0', () => {
    // Caso 1: Sin clipping (maxPeak = 0.5)
    const mockBufferNoClip = {
      numberOfChannels: 1,
      sampleRate: 48000,
      length: 100,
      getChannelData: () => new Float32Array(100).fill(0.5),
    } as unknown as AudioBuffer;

    const wavNoClip = audioBufferToWav(mockBufferNoClip);
    const viewNoClip = new DataView(wavNoClip);
    // 0.5 * 0x7fff = 16383
    expect(viewNoClip.getInt16(44, true)).toBe(16383);

    // Caso 2: Con clipping (maxPeak = 2.0 -> escala 0.99 / 2.0 = 0.495)
    const mockBufferClip = {
      numberOfChannels: 1,
      sampleRate: 48000,
      length: 100,
      getChannelData: () => new Float32Array(100).fill(2.0),
    } as unknown as AudioBuffer;

    const wavClip = audioBufferToWav(mockBufferClip);
    const viewClip = new DataView(wavClip);
    // sample rescalado = 2.0 * (0.99 / 2.0) = 0.99
    // 0.99 * 0x7fff = 32447
    expect(viewClip.getInt16(44, true)).toBeLessThan(32767);
  });

  it('lanza un error manejable si OfflineAudioContext no está disponible', async () => {
    (globalThis as Record<string, unknown>).OfflineAudioContext = undefined;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).OfflineAudioContext = undefined;
      (window as unknown as Record<string, unknown>).webkitOfflineAudioContext = undefined;
    }

    await expect(generateSfxWav('uiClick')).rejects.toThrow('OfflineAudioContext no está disponible');
  });

  it('genera un paquete ZIP único con exactamente 16 WAVs válidos que empiezan por RIFF/WAVE', async () => {
    const { unzipSync } = await import('fflate');
    const progressSpy = vi.fn();

    const zipResult = await generateSfxZip(progressSpy, 48000);

    expect(zipResult.filename).toBe('rautfall-synthetic-sfx-pack.zip');
    expect(zipResult.blob.type).toBe('application/zip');
    expect(progressSpy).toHaveBeenCalledTimes(16);
    expect(progressSpy).toHaveBeenLastCalledWith(16, 16);

    const unzipped = unzipSync(zipResult.zipUint8Array);
    const filenames = Object.keys(unzipped);

    expect(filenames).toHaveLength(16);

    SFX_ORDER.forEach((type) => {
      const meta = getSfxMetadata(type);
      expect(filenames).toContain(meta.filename);

      const entryBytes = unzipped[meta.filename]!;
      expect(entryBytes.byteLength).toBeGreaterThan(44);

      // Comprobar cabecera RIFF/WAVE de cada entrada del ZIP
      const riffHeader = String.fromCharCode(entryBytes[0]!, entryBytes[1]!, entryBytes[2]!, entryBytes[3]!);
      const waveHeader = String.fromCharCode(entryBytes[8]!, entryBytes[9]!, entryBytes[10]!, entryBytes[11]!);

      expect(riffHeader).toBe('RIFF');
      expect(waveHeader).toBe('WAVE');
    });
  });

  it('cancela la generación del ZIP y no devuelve ZIP parcial si falla la generación de un WAV', async () => {
    (globalThis as Record<string, unknown>).OfflineAudioContext = undefined;
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).OfflineAudioContext = undefined;
    }

    await expect(generateSfxZip()).rejects.toThrow('OfflineAudioContext no está disponible');
  });

  it('cumple los criterios de diseño específicos para el activo hardDrop', async () => {
    const meta = getSfxMetadata('hardDrop');
    expect(meta.durationMs).toBe(180);
    expect(meta.filename).toBe('hard-drop.wav');
    expect(meta.waveShape).toContain('Kitchen Dish Clank');

    const result = await generateSfxWav('hardDrop');
    expect(result.filename).toBe('hard-drop.wav');
    expect(result.blob.type).toBe('audio/wav');
  });

  it('cumple los criterios de diseño específicos para el rediseño de sabotageTriggered', async () => {
    const meta = getSfxMetadata('sabotageTriggered');
    expect(meta.durationMs).toBeGreaterThanOrEqual(150);
    expect(meta.durationMs).toBeLessThanOrEqual(180);
    expect(meta.durationMs).toBe(165);
    expect(meta.waveShape).toContain('pulso doble');
    expect(meta.waveShape).toContain('ruido filtrado');

    const result = await generateSfxWav('sabotageTriggered');
    expect(result.filename).toBe('rautfall-sabotage-triggered.wav');
    expect(result.blob.type).toBe('audio/wav');
  });
});
