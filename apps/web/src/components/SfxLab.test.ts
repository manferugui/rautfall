// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SfxLab from './SfxLab.vue';
import { AudioManager, getAudioManager, SFX_ORDER } from '../audio';

describe('SfxLab.vue', () => {
  let originalOfflineCtx: unknown;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:http://localhost/mock-uuid'),
      revokeObjectURL: vi.fn(),
    });

    originalOfflineCtx = (globalThis as Record<string, unknown>).OfflineAudioContext;

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    (globalThis as Record<string, unknown>).OfflineAudioContext = originalOfflineCtx;
    AudioManager.resetInstance();
  });

  it('renderiza la cabecera, la nota DEV obligatoria y las tarjetas de los 16 SFX', () => {
    const wrapper = mount(SfxLab);

    expect(wrapper.find('[data-testid="sfx-lab-title"]').text()).toBe('SFX LAB');
    expect(wrapper.find('[data-testid="sfx-dev-note"]').text()).toContain(
      'Escucha cada efecto con y sin el fondo de prueba DEV.',
    );

    expect(SFX_ORDER).toHaveLength(16);

    SFX_ORDER.forEach((type) => {
      const card = wrapper.find(`[data-testid="sfx-card-${type}"]`);
      if (!card.exists()) {
        console.error(`Falta la tarjeta para el tipo: ${type}`);
      }
      expect(card.exists()).toBe(true);
      expect(wrapper.find(`[data-testid="play-sfx-${type}"]`).exists()).toBe(true);
      expect(wrapper.find(`[data-testid="download-wav-${type}"]`).exists()).toBe(true);
    });
  });

  it('conmuta la reproducción del Fondo de Prueba DEV sintético', async () => {
    const manager = getAudioManager();
    await manager.unlock();

    const wrapper = mount(SfxLab);
    const toggleBgmBtn = wrapper.find('[data-testid="toggle-test-bgm-button"]');

    expect(toggleBgmBtn.exists()).toBe(true);
    expect(toggleBgmBtn.text()).toContain('FONDO PRUEBA DEV');

    await toggleBgmBtn.trigger('click');
    await flushPromises();

    expect(toggleBgmBtn.text()).toContain('DETENER FONDO PRUEBA DEV');

    wrapper.unmount();
  });

  it('ejecuta unlock() y playSfx() al hacer clic en un botón de SFX individual', async () => {
    const manager = getAudioManager();
    const unlockSpy = vi.spyOn(manager, 'unlock').mockResolvedValue();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const wrapper = mount(SfxLab);
    const playButton = wrapper.find('[data-testid="play-sfx-hardDrop"]');

    await playButton.trigger('click');
    await flushPromises();

    expect(unlockSpy).toHaveBeenCalled();
    expect(playSfxSpy).toHaveBeenCalledWith('hardDrop', expect.objectContaining({ forceSynthetic: false }));
  });

  it('alterna el estado de mute al hacer clic en el botón Mute', async () => {
    const manager = getAudioManager();
    const toggleSpy = vi.spyOn(manager, 'toggleMute');

    const wrapper = mount(SfxLab);
    const muteButton = wrapper.find('[data-testid="audio-mute-button"]');

    await muteButton.trigger('click');
    await flushPromises();

    expect(toggleSpy).toHaveBeenCalled();
  });

  it('reproduce los 10 SFX en orden fijo dejando tiempo entre ellos y permite cancelación', async () => {
    const manager = getAudioManager();
    vi.spyOn(manager, 'unlock').mockResolvedValue();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const wrapper = mount(SfxLab);
    const playAllButton = wrapper.find('[data-testid="play-all-sfx-button"]');
    const stopButton = wrapper.find('[data-testid="stop-sequence-button"]');

    // Estado inicial: Reproducir todos habilitado, Detener deshabilitado
    expect(playAllButton.attributes('disabled')).toBeUndefined();
    expect(stopButton.attributes('disabled')).toBeDefined();

    await playAllButton.trigger('click');
    await flushPromises();
    vi.advanceTimersByTime(0);

    // Inmediatamente se reproduce el primer SFX ('uiClick')
    expect(playSfxSpy).toHaveBeenCalledWith('uiClick');

    // Avanzar 900 ms -> segundo SFX ('pieceLocked')
    vi.advanceTimersByTime(900);
    expect(playSfxSpy).toHaveBeenCalledWith('pieceLocked');

    // Hacer clic en Detener secuencia
    await stopButton.trigger('click');
    await flushPromises();

    playSfxSpy.mockClear();

    // Avanzar tiempo adicional y verificar que no se reproducen más SFX
    vi.advanceTimersByTime(5000);
    expect(playSfxSpy).not.toHaveBeenCalled();
  });

  it('limpia todos los temporizadores de secuencia al desmontar el componente', async () => {
    const manager = getAudioManager();
    vi.spyOn(manager, 'unlock').mockResolvedValue();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const wrapper = mount(SfxLab);
    await wrapper.find('[data-testid="play-all-sfx-button"]').trigger('click');
    await flushPromises();

    playSfxSpy.mockClear();

    // Desmontar el componente
    wrapper.unmount();

    // Avanzar temporizadores y confirmar que no se emiten nuevos SFX
    vi.advanceTimersByTime(10000);
    expect(playSfxSpy).not.toHaveBeenCalled();
  });

  it('revoca los ObjectURLs creados al regenerar, al descargar o al desmontar', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    const wrapper = mount(SfxLab);
    const downloadButton = wrapper.find('[data-testid="download-wav-uiClick"]');

    // Primera generación
    await downloadButton.trigger('click');
    await flushPromises();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Segunda generación sobre el mismo tipo (debe revocar la URL previa)
    await downloadButton.trigger('click');
    await flushPromises();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');

    // Desmontar componente debe revocar todas las URLs registradas
    wrapper.unmount();
    expect(revokeSpy).toHaveBeenCalled();
  });

  it('maneja un fallo de OfflineAudioContext sin romper la interfaz gráfica', async () => {
    const wrapper = mount(SfxLab);

    // Mock temporal de URL.createObjectURL que lance un error
    vi.spyOn(URL, 'createObjectURL').mockImplementationOnce(() => {
      throw new Error('Fallo simulado de Blob/Context');
    });

    const downloadButton = wrapper.find('[data-testid="download-wav-uiClick"]');
    await downloadButton.trigger('click');
    await flushPromises();

    // Debe mostrar el error en el banner sin crashear el componente
    expect(wrapper.find('[data-testid="sfx-export-error"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="sfx-export-error"]').text()).toContain('Fallo simulado');
  });

  it('genera y descarga un paquete ZIP único al pulsar Descargar fallbacks sintéticos', async () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const wrapper = mount(SfxLab);
    const downloadZipBtn = wrapper.find('[data-testid="download-synthetic-zip-button"]');

    expect(downloadZipBtn.exists()).toBe(true);
    await downloadZipBtn.trigger('click');
    await flushPromises();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Desmontar el componente debe revocar el ObjectURL del ZIP
    wrapper.unmount();
    expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/mock-uuid');
  });

  it('permite audicionar el fallback sintético para suddenDeathStarted en SFX LAB', async () => {
    const manager = getAudioManager();
    const playSfxSpy = vi.spyOn(manager, 'playSfx');

    const wrapper = mount(SfxLab);
    const syntheticBtn = wrapper.find('[data-testid="play-synthetic-suddenDeathStarted"]');

    expect(syntheticBtn.exists()).toBe(true);
    await syntheticBtn.trigger('click');
    await flushPromises();

    expect(playSfxSpy).toHaveBeenCalledWith('suddenDeathStarted', { forceSynthetic: true });
  });
});
