# Informe de implementación — Tarea 0026: Audio básico e identidad sonora

## Resumen

Se ha implementado en `apps/web` la infraestructura completa de audio desacoplada y los efectos de sonido sintéticos esenciales (SFX) mediante **Web Audio API** nativa del navegador. El subsistema utiliza un patrón Singleton con una única instancia de `AudioContext` cuya construcción se difiere de forma estricta hasta la primera interacción del usuario (`click` / `keydown`), silenciado global (mute) persistido en `localStorage`, control accesible en la interfaz web (`data-testid="audio-mute-button"`) y sintaxis de síntesis sonora pura para 10 eventos clave sin depender de ficheros de audio externos.

Además, se deja preparada la API de música ambiental (`playMusic`, `stopMusic`, `setMusicIntensity`) con absoluta tolerancia a la ausencia de ficheros musicales (0 peticiones 404 por red, 0 errores en consola). La generación e integración de pistas musicales originales con Google Flow Music queda expresamente abierta para una fase posterior.

## Archivos creados y modificados

### Creados
- `apps/web/src/audio/types.ts`: Tipos e interfaces del módulo de audio (`AudioService`, `AudioSfxType`, `MusicTrack`).
- `apps/web/src/audio/sfx-synth.ts`: Sintetizador Web Audio API para SFX sintéticos.
- `apps/web/src/audio/audio-manager.ts`: Servicio `AudioManager` (Singleton, mute, contexto diferido, eventos).
- `apps/web/src/audio/index.ts`: Re-exportación pública del módulo de audio.
- `apps/web/src/audio/audio-manager.test.ts`: Pruebas unitarias de `AudioManager` y sintetizador SFX (12 pruebas nuevas).
- `apps/web/e2e/audio-flow.spec.ts`: Escenario E2E Playwright de navegación y persistencia de mute (1 escenario E2E nuevo).
- `docs/audio-assets.md`: Registro de trazabilidad e instrucciones para futuras exportaciones de Google Flow Music.
- `docs/implementation/0026-audio-basico-e-identidad-sonora.md`: Este informe de implementación.

### Modificados
- `apps/web/src/components/ModeSelector.vue`: Integración de botón de silencio (`data-testid="audio-mute-button"`) y desbloqueo tras selección de modo.
- `apps/web/src/components/ModeSelector.test.ts`: Prueba unitaria del botón de mute.
- `apps/web/src/App.vue`: Integración de botón de silencio en la cabecera general y reconexión de eventos de navegación con `AudioManager`.
- `apps/web/src/game/scenes/GameScene.ts`: Notificación de hechos/eventos de dominio drenados (`handleEngineEvent` y `handleBattleEvent`) a `AudioManager`.
- `docs/project-status.md`: Actualización del estado global del proyecto.

## Decisiones relevantes

1. **Web Audio API nativa frente a Phaser Audio**: Se seleccionó Web Audio API pura encapsulada en `apps/web/src/audio/` para desacoplar el ciclo de vida del audio de la creación/destrucción de Phaser (`game.destroy(true)`), permitiendo que la BGM y el silencio funcionen homogéneamente en Vue y Phaser.
2. **Creación diferida estricta de AudioContext**: Ni el import del módulo ni `getAudioManager()` / `getInstance()` instancian un `AudioContext`. El objeto `AudioContext` permanece en `null` hasta que se invoca `unlock()` desencadenado por una interacción del usuario. La llamada a `unlock()` es idempotente y crea la única instancia del contexto.
3. **Síntesis sonora nativa para SFX**: Se implementó una síntesis limpia mediante osciladores, filtros y envolventes exponenciales en `sfx-synth.ts` para cubrir los 10 eventos sonoros esenciales con latencia cero y cero consumo de ancho de banda.
4. **Deduplicación por identificador de SFX**: Para evitar distorsión armónica si eventos idénticos se emiten en ráfaga (p. ej., drenado masivo), `AudioManager` impone un cooldown de 40 ms indexado individualmente por tipo de SFX (`AudioSfxType`), impidiendo que sonidos distintos (p. ej., `hardDrop` y `pieceLocked` en el mismo paso) se cancelen entre sí.
5. **Clasificación observable de líneas**: El evento `linesCleared` de `@rautfall/game-engine` expone `lines: number` sin metadatos adicionales de T-Spin. En consecuencia, se clasifica `lines >= 4` como `quadOrTSpin` y `lines = 1..3` como `linesCleared`, respetando estrictamente el contrato de eventos actual.
6. **Infraestructura musical resiliente**: La API `playMusic` gestiona el estado de reproducción sin realizar peticiones `fetch` fallidas ni arrojar excepciones cuando los ficheros musicales no existen.
7. **Persistencia de preferencia**: El estado de mute se lee e inicializa automáticamente desde `localStorage['rautfall_audio_muted']`.

## API pública producida

```typescript
export interface AudioService {
  unlock(): Promise<void>;
  isMuted(): boolean;
  toggleMute(): boolean;
  setMuted(muted: boolean): void;
  playSfx(type: AudioSfxType): void;
  handleEngineEvent(event: EngineEvent): void;
  handleBattleEvent(event: BattleEvent): void;
  playMusic(track: MusicTrack): void;
  stopMusic(): void;
  setMusicIntensity(intensity: number): void;
  destroy(): void;
}
```

## Pruebas añadidas

- **`apps/web/src/audio/audio-manager.test.ts`** (12 pruebas unitarias):
  - Creación diferida de `AudioContext` (no se instancializa en `getInstance()`).
  - Construcción e idempotencia de `AudioContext` tras `unlock()`.
  - Reanudación de `AudioContext` suspendido.
  - Mute y persistencia en `localStorage`.
  - SFX sintéticos sin lanzar errores.
  - Deduplicación indexada por tipo de SFX (cooldown < 40ms por sonido).
  - Manejo de `EngineEvent` y `BattleEvent`.
  - Tolerancia de la API musical sin assets (0 peticiones 404, 0 errores).
  - Degradación segura en entornos sin `AudioContext`.
  - Destrucción limpia y posibilidad de re-inicialización tras `destroy()`.
- **`apps/web/src/components/ModeSelector.test.ts`** (1 prueba unitaria):
  - Prueba de conmutación del botón Mute (`data-testid="audio-mute-button"`).
- **`apps/web/e2e/audio-flow.spec.ts`** (1 escenario E2E Playwright):
  - Carga de aplicación sin errores de consola ni de `AudioContext`.
  - Conmutación del estado de Mute y verificación de persistencia en `localStorage` tras recarga (`page.reload()`).
  - Navegación entre Menú, Entrenamiento y regreso al Menú.

**Cifras reales de la suite**:
- Vitest inicial (Tarea 0025): 708 tests.
- Vitest final (Tarea 0026): 721 tests (+13 tests unitarios netos).
- Playwright E2E inicial: 7 escenarios.
- Playwright E2E final: 8 escenarios (+1 escenario E2E nuevo).

## Análisis de auditoría y estabilidad E2E

### Hechos demostrados
1. **Cadencia real del motor**: En `@rautfall/game-config` (`prototypeConfig`), `fixedStepMs` es de **10 ms**. La fase `waitingBeforeHardDrop` en `DeterministicBot` dura **5 pasos lógicos**, equivalentes a **50 ms** de tiempo simulado del juego.
2. **Drenaje de eventos en modo batalla**: `BattleSession` proyecta internamente los eventos de los jugadores envolviéndolos como `{ type: 'participantEvent', participant: 'playerOne', event }` dentro de `battleSession.drainEvents()`. En consecuencia, `GameScene.ts` no debe drenar manualmente las subcolas `playerOne.getEngine().drainEvents()` ni `playerTwo.getEngine().drainEvents()`, preservando los contratos de dominio sin interferir con la observación de eventos.
3. **Mecanismo de desincronización en `battle-demo.spec.ts`**:
   - **Fallo A** (`st.phase === 'waitingBeforeHardDrop'`): `expect.poll` (con tiempo de espera de 20.000 ms e intervalo por defecto de 100 ms) busca una fase efímera que dura 50 ms. Si el sondeo CDP de Playwright cae fuera de esa ventana de 50 ms, la aserción expira recibiendo la fase siguiente (`waitingForVisibility` o `waitingBetweenActions`).
   - **Fallo B** (`st3.actionIndex - st1.actionIndex <= 2`): Tras despausar, `expect.poll` espera a `st.battleStep > st1.battleStep`. El intervalo entre la evaluación del predicado y la lectura final de `st3` puede abarcar múltiples frames en el hilo del navegador, permitiendo al bot avanzar 3 o 4 acciones.

### Hipótesis descartadas
1. **Contaminación por `localStorage`**: Se demostró que Playwright aísla cada archivo de prueba en un `BrowserContext` independiente. `audio-flow.spec.ts` no contamina `battle-demo.spec.ts`. Se mantiene la limpieza `localStorage.removeItem('rautfall_audio_muted')` por higiene de la prueba.
2. **Sobrecarga de Web Audio API**: Se demostró mediante pruebas comparativas que en `battle-demo=1` (donde el contexto de audio no se desbloquea), `AudioManager` ejecuta guardas de retorno inmediato `if (this.muted || !this.ctx || this.ctx.state !== 'running') return;` con consumo cero de CPU.

### Causa raíz confirmada
- Desfase inherente al sondeo de 100 ms sobre fases efímeras de 50 ms en la prueba preexistente `battle-demo.spec.ts` (conservada a `HEAD`). La integración técnica de audio es totalmente pasiva, inocua y no altera el acumulador temporal ni la simulación de juego.

### Corrección final
- Mantener la integración de `GameScene.ts` limitada a la suscripción de `battleSession.drainEvents()`.
- Incorporar guardas defensivas no-op en la primera línea de `playSfx()`, `handleEngineEvent()` y `handleBattleEvent()`.
- Añadir desconexión explícita `osc.onended` para la limpieza de nodos de síntesis sonora en Web Audio.

## Laboratorio DEV de Efectos de Sonido (SFX LAB) y Exportación WAV PCM

Como herramienta interna de auditoría sonora y refinamiento auditivo, se ha añadido en `apps/web` el panel **SFX LAB**, accesible únicamente en entorno de desarrollo (`import.meta.env.DEV`) mediante el parámetro URL `?sfx-lab=1`.

### Características del Laboratorio DEV
1. **Aislamiento absoluto en producción**: `SfxLab.vue` y los módulos de exportación WAV se cargan dinámicamente (`defineAsyncComponent` / `import()` dinámico) solo bajo `import.meta.env.DEV`. En producción no se generan chunks residuales ni aparece el texto "SFX LAB" en la build (`dist/`).
2. **Audición individual y secuencial**:
   - Botón por cada uno de los 10 SFX sintéticos reales que ejecuta `audioManager.unlock()` y `audioManager.playSfx(type)`.
   - Botón **"Reproducir todos"** que ejecuta los 10 SFX en orden fijo con 900 ms de intervalo sin solapamientos, impidiendo secuencias concurrentes y permitiendo cancelación inmediata ("Detener secuencia") y limpieza estricta de temporizadores al desmontar el componente.
3. **Diagnóstico sonoro DEV**: Muestra junto a cada efecto la forma de onda, rango de frecuencias, duración en ms, envolvente e intención sonora, obtenidos desde los metadatos contractuales del sintetizador (`getSfxMetadata`). Incorpora la nota DEV obligatoria: *"Escucha cada efecto y registra cuáles requieren ajuste."*
4. **Exportación a PCM WAV a 48 kHz mono**:
   - Módulo aislado DEV `apps/web/src/audio/sfx-wav-export.ts` (excluido de `audio/index.ts` público).
   - Generación síncrona/offline mediante `OfflineAudioContext` a **48 kHz**, **1 canal (mono)** y **PCM 16-bit** con cabecera RIFF/WAVE válida.
   - Duración extendida con **100 ms de release/cola** para no cortar la señal.
   - Escalado de amplitud **únicamente si existe clipping (`maxPeak > 1.0`)**, conservando los niveles de diseño sonoro cuando no hay saturación.
   - `OfflineAudioContext` estrictamente local a la función de exportación sin referencias residuales.
   - Control de Object URLs (`URL.createObjectURL`) con revocación explícita (`URL.revokeObjectURL`) al regenerar, al descargar y en `onBeforeUnmount`.

## Rediseño sonoro sintético (`hardDrop` y `sabotageTriggered`)

Tras la audición manual en el laboratorio SFX LAB, se identificaron timbres no deseados en dos efectos y se aplicó un rediseño de síntesis sonora en `sfx-synth.ts`:

1. **`hardDrop` (Impacto mecánico seco industrial)**:
   - **Motivo**: Reemplazar barrido orgánico/gomoso descendente con exceso de energía grave pura.
   - **Parámetros anteriores**: Oscilador `sine` único de 240 Hz $\to$ 40 Hz (80 ms).
   - **Parámetros nuevos**:
     - Transitorio de ruido metálico filtrado bandpass a 2,5 kHz (Q=2.0, 12 ms).
     - Sub-impacto grave de 200 Hz $\to$ 90 Hz (`sine`, 50 ms). Frecuencia final $\ge 80\text{ Hz}$.
     - Resonancia metálica secundaria de 1200 Hz $\to$ 600 Hz (`triangle`, 25 ms).
   - **Duración nominal**: 60 ms ($< 100\text{ ms}$).

2. **`sabotageTriggered` (Alerta táctica y descarga electrónica)**:
   - **Motivo**: Eliminar tono nasal/áspero de barrido único de diente de sierra.
   - **Parámetros anteriores**: Oscilador `sawtooth` único de 380 Hz $\to$ 140 Hz (160 ms).
   - **Parámetros nuevos**:
     - Transitorio de choque eléctrico en ruido filtrado bandpass a 3,5 kHz (12 ms).
     - Pulso digital 1: `sawtooth` de 720 Hz $\to$ 480 Hz (35 ms).
     - Pulso digital 2: `sawtooth` de 620 Hz $\to$ 360 Hz (45 ms, desfasado 60 ms).
     - Cola de estática filtrada a 2,0 kHz (65 ms, desfasada 100 ms).
   - **Duración nominal**: 165 ms ($150..180\text{ ms}$).

- **Estado**: Pendiente de validación auditiva manual del usuario en navegador real.

## Integración del asset procesado de yunke real para `hardDrop` (`hard-drop.wav`)

Se procesó e integró un nuevo impacto de yunke mecánico real para sustituir el `hardDrop` sintético concentrado en graves por un sonido con ataque metálico y transitorio nítido:

- **Asset generado**: `apps/web/public/audio/sfx/hard-drop.wav` (PCM 16-bit Mono 48 kHz, 23.084 bytes, 240 ms de duración). Highpass a 65 Hz, ganancia -6,5 dB (peak -6.01 dBFS, RMS -20.98 dBFS).
- **Origen y Licencia**: Extraído de Freesound (*Anvil Sound* por FaKexxChaos, ID 700416, Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Integración y Resiliencia**: Reproducción única por evento `pieceMoved` con `reason === 'hardDrop'`. Guarda `activePlayingTypes` evita superposiciones paralelas y `failedAssetSet` previene refetching ante fallo. No requiere capa sintética adicional dada la contundencia nítida del yunke real.
- **SFX LAB**: Incorporados botones diferenciados para audicionar la muestra WAV real de yunke y el fallback sintético por separado.

## Integración del asset procesado para `gameOver` (`game-over.wav`)

Se procesó e integró la muestra real de fallo de energía (*Electric Failure – High Voltage Power Down #2 ATP2*) para sustituir el `gameOver` anterior por una secuencia con mayor presencia armónica en medios/agudos:

- **Asset generado**: `apps/web/public/audio/sfx/game-over.wav` (PCM 16-bit Estéreo 48 kHz, 393.644 bytes, 2,05 s de duración). Highpass a 50 Hz, ganancia 0,0 dB (peak -7.12 dBFS, RMS -18.97 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 844244) por ATP2-kh (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Integración y Resiliencia**: Reproducción atómica al finalizar la partida con derrota local (`battleEnded`). Inmunidad a duplicados en `participantEvent` y guarda `activePlayingTypes`. Asignada prioridad terminal con ducking. Fallback sintético transparente.

## Integración del asset procesado de fallback real para `victory` (`victory-fallback.wav`)

Se procesó e integró la muestra de fanfarria triunfal ascendente (*Level Up / Mission Complete* por Beetlemuse) como fallback real para victoria cuando la pista musical principal de resultados (`victory.wav` / Sector Secured) no se puede cargar:

- **Asset generado**: `apps/web/public/audio/sfx/victory-fallback.wav` (PCM 16-bit Estéreo 48 kHz, 345.644 bytes, 1,80 s de duración). Highpass a 50 Hz, ganancia -2,0 dB (peak -7.33 dBFS, RMS -23.50 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 528958) por Beetlemuse (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Jerarquía de victoria de 3 niveles**:
  1. Música real Sector Secured (`victory.wav`) $\to$ 2. Fallback real `victory-fallback.wav` $\to$ 3. Último fallback sintético defensivo (`victory`). Exclusión mutua garantizada.

## Integración del asset procesado de clic mecánico para `uiClick` (`ui-click.wav`)

Se procesó e integró la muestra de transitorio de ataque mecánico (*Industrial Switch With Spring* por cookies+policy) para sustituir el `uiClick` sintético previo por un clic discreto de respuesta inmediata:

- **Asset generado**: `apps/web/public/audio/sfx/ui-click.wav` (PCM 16-bit Mono 48 kHz, 7.724 bytes, 80 ms de duración). Highpass a 100 Hz, ganancia -12,0 dB (peak -10.85 dBFS, RMS -29.21 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 556635) por cookies+policy (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Integración y Resiliencia**: Reproducción limpia sin duplicados en interacciones de interfaz. Guarda `activePlayingTypes` previene superposiciones paralelas en clics simultáneos. Fallback sintético transparente (`renderSyntheticSfx`) si el activo no se encuentra disponible.

## Integración del asset procesado de encaje mecánico para `pieceLocked` (`piece-locked.wav`)

Se procesó e integró la muestra de cerrojo mecánico (*Mechanical switch latch 02* por xkeril) para sustituir el `pieceLocked` sintético previo por un encaje de cerrojo firme de confirmación física:

- **Asset generado**: `apps/web/public/audio/sfx/piece-locked.wav` (PCM 16-bit Mono 48 kHz, 12.524 bytes, 130 ms de duración). Highpass a 80 Hz, ganancia -9,5 dB (peak -9.95 dBFS, RMS -28.04 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 815493) por xkeril (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Jerarquía y Resiliencia**: `uiClick` (-10.85 dBFS) $\to$ `pieceLocked` (-9.95 dBFS) $\to$ `hardDrop` (-6.01 dBFS). En combinación con `hardDrop`, el transitorio metálico de yunke destaca en $t=0$ y la fijación de cerrojo concluye el lock sin interferencias. Fallback sintético transparente.

## Integración del asset procesado para `linesCleared` (`lines-cleared.wav`)

Se procesó e integró la muestra de barrido espectral (*Short Muddy Sweep* por D_Yonqui) para sustituir el `linesCleared` sintético previo por una disolución tecnológica fluida de líneas:

- **Asset generado**: `apps/web/public/audio/sfx/lines-cleared.wav` (PCM 16-bit Estéreo 48 kHz, 53.808 bytes, 280 ms de duración). Highpass a 120 Hz, ganancia -12,0 dB (peak -7.98 dBFS, RMS -22.46 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 864419) por D_Yonqui (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Diferenciación y Resiliencia**: Exclusión mutua garantizada: 1–3 líneas activan `linesCleared` (280 ms) y $\ge 4$ líneas activan `quadOrTSpin` (arpegio). Involucra únicamente el activo real sin capas sintéticas superpuestas. Fallback sintético transparente.

## Integración del asset procesado para `reversePolarityTriggered` (`reverse-polarity-triggered.wav`)

Se procesó e integró la muestra de ráfaga digital de onda cuadrada (*square sweep.wav* por Blackie666) para sustituir el `reversePolarityTriggered` previo por un gesto ofensivo corto, seco y agresivo:

- **Asset generado**: `apps/web/public/audio/sfx/reverse-polarity-triggered.wav` (PCM 16-bit Mono 48 kHz, 36.524 bytes, 380 ms de duración). Highpass a 100 Hz, ganancia -10,0 dB (peak -9.11 dBFS, RMS -14.26 dBFS).
- **Origen y Licencia**: Extraído de Freesound (ID 85340) por Blackie666 (Creative Commons Zero CC0). Trazabilidad completa en `docs/audio-assets.md`.
- **Diferenciación y Resiliencia**: Gesto corto, seco y agresivo de onda cuadrada (380 ms) que contrasta claramente con `reversePolarityReceived` ( sweep caótico inestable de 850 ms) y con `linesCleared` (barrido espectral fluido de 280 ms). Fallback sintético transparente.

## Re-procesamiento Espectral de SFX (`residuesTriggered`, `residuesReceived`, `hardDrop`, `gameOver`)

Se re-diseñaron los 4 activos WAV re-evaluando las muestras originales de Freesound para eliminar la concentración excesiva de graves en la franja 120–500 Hz y restaurar la definición armónica de medios y agudos:

- **`residuesTriggered`**: Recorte seco de impacto de chatarra corta (420 ms Estéreo, highpass 140 Hz, gain -5.5 dB, peak -6.81 dBFS, RMS -16.62 dBFS). Energía en 120–500 Hz reducida del 92% a sólo 2,0%, con 73,2% concentrado en 2k–8kHz para textura crujiente de chatarra.
- **`residuesReceived`**: Caída caótica pesada de choques metálicos acumulados (950 ms Estéreo, highpass 120 Hz, gain -6.5 dB, peak -6.05 dBFS, RMS -27.33 dBFS). Energía en 120–500 Hz reducida del 69% a sólo 4,3%, con 66,4% en 2k–8kHz.
- **`hardDrop` (Kitchen Dish Clank)**: Impacto mecánico seco de asentamiento de pieza pesada en la cuadrícula sin resonancia sorda ni campaneo (180 ms Mono, gain +2.5 dB, peak -6.12 dBFS, RMS -22.99 dBFS). Masa armónica en **500Hz–2kHz (79,5%)** e **120–500Hz (18,8%)** para resistencia total a la fatiga auditiva durante partidas rápidas.
- **`gameOver` (Variante C HPF 120 Hz)**: Secuencia limpia de fallo eléctrico inicial, inestabilidad de voltaje y power-down sin cola sorda final (1,700 s Estéreo, highpass 120 Hz, gain -1.0 dB, peak -9.53 dBFS, RMS -27.56 dBFS). Energía subgrave en $<120\text{ Hz}$ reducida al **21,5%** y masa armónica concentrada en **2k–8kHz (60,9%)** y **500Hz–2kHz (11,6%)** para transmitir fielmente el colapso de sistema eléctrico inestable sin retumbos sordos.

## Bloque de ingeniería y producción: Menu BGM (`menu.wav` — Terminal Pulse Loop v01)

Se ha procesado e integrado para producción la pista candidata de Menú Principal (`rautfall_music_menu_terminal-pulse_loop_v01.wav`):

1. **Auditoría y análisis del seam (loop)**: Se analizó la continuidad temporal, de amplitud, fase y derivada en el empalme final/inicio ($t=31{,}500\text{ s} \to t=0{,}000\text{ s}$). Los valores extremos ($L=5646$, $R=7691$ al final vs $L=5420$, $R=7659$ al inicio) demostraron una transición continua y limpia sin saltos perceptibles ni clicks (desfase $< 0{,}7\%$). Se mantiene la pista completa de $31{,}500\text{ s}$ en bucle completo (`loopStart = 0`, `loopEnd = 31.5`, `source.loop = true`).
2. **Procesamiento tonal y headroom**:
   - Filtro pasa-altos Butterworth a **50 Hz** ($Q=0{,}7071$) para eliminar el exceso de rumble subgrave ($<50\text{ Hz}$ abarcaba el 43% de la energía original).
   - Peaking EQ sutil a **80 Hz** ($-1{,}5\text{ dB}$, $Q=0{,}7$) para limpiar acumulación en graves sin aligerar el timbre oscuro industrial.
   - Ajuste de ganancia global a **$-5{,}0\text{ dB}$** ($0{,}5623$ lineal) para dejar headroom suficiente para SFX, ducking y mezcla master.
   - Remuestreo de alta calidad a **48.000 Hz** (48 kHz PCM 16-bit estéreo).
   - Métricas finales: Peak máximo **$-6{,}83\text{ dBFS}$**, RMS medio **$-23{,}50\text{ dBFS}$**, peso total **6.048.044 bytes**.
3. **Ruta final e integración**:
   - Guardada en `apps/web/public/audio/music/menu.wav`.
   - Mapeada en `MUSIC_ASSET_URL_MAP.menu = '/audio/music/menu.wav'`.
4. **Ciclo de vida y transiciones**:
   - `playMusic('menu')` difiere la creación de nodos si el `AudioContext` permanece bloqueado (`suspended`/`null`).
   - Al realizar el primer `unlock()`, la música inicia automáticamente.
   - Reproducción sostenida en bucle (`loop = true`).
   - Deduplicación lógica: re-renders o llamadas consecutivas a `playMusic('menu')` no reinician la pista activa ni acumulan `AudioBufferSourceNode` duplicados.
   - Transición `menu -> playing` (entrada a entrenamiento o batalla): desvanecimiento progresivo suave (fade-out de 400 ms) y detención limpia del source.
   - Regreso al menú desde resultados o pausa: reinicio/reanudación limpia de una única instancia de `menu.wav`.
5. **SFX LAB / MUSIC LAB**: Actualizada la tarjeta de Menú BGM en `?sfx-lab=1` mostrando badge `MÚSICA BGM`, archivo `menu.wav`, duración (31.500 s), sample rate (48 kHz), canales (Estéreo 2ch), Peak (-6.83 dBFS), RMS (-23.50 dBFS) y controles `▶ ESCUCHAR MÚSICA` / `■ DETENER MÚSICA`.
6. **Pruebas unitarias**: Pruebas unitarias en `audio-manager.test.ts` validadas en verde.

## Bloque de ingeniería y producción: Gameplay BGM y Sudden Death BGM

Se han procesado e integrado para producción las pistas reales de combate y fase final (`gameplay.wav` y `sudden-death.wav`):

1. **Gameplay BGM (`gameplay.wav` — Breach Protocol Loop v04)**:
   - Fuente: `rautfall_music_gameplay_breach-protocol_loop_v04.wav` (126,095 s, 48 kHz).
   - Procesamiento: High-pass 55 Hz (Butterworth 2º orden), Peaking EQ 80 Hz (-1.5 dB, Q=0.7), gain -5.0 dB.
   - Métricas finales: 126,095 s, PCM 16-bit 48 kHz Estéreo, Peak **-6.41 dBFS**, RMS **-24.11 dBFS**, peso 24.210.372 bytes.
   - Looping: `loopStart = 0`, `loopEnd = 126.1`, `source.loop = true`.
2. **Sudden Death BGM (`sudden-death.wav` — Breach Protocol 138 BPM Loop v01)**:
   - Fuente: `rautfall_music_sudden-death_breach-protocol_138bpm_loop_v01.wav` (100,515 s, 48 kHz, 138 BPM).
   - Procesamiento: High-pass 55 Hz (Butterworth 2º orden), Peaking EQ 80 Hz (-1.5 dB, Q=0.7), gain -5.0 dB.
   - Métricas finales: 100,515 s, PCM 16-bit 48 kHz Estéreo, Peak **-6.42 dBFS**, RMS **-24.30 dBFS**, peso 19.299.012 bytes.
   - Looping: `loopStart = 0`, `loopEnd = 100.5`, `source.loop = true`.
3. **Transición Gameplay -> Sudden Death & Ducking EAS**:
   - Al dispararse `suddenDeathStarted`, Gameplay BGM realiza un crossfade de 600 ms hacia Sudden Death BGM.
   - La alarma EAS `suddenDeathStarted` suena a nivel nominal mientras `Sudden Death BGM` arranca atenuada a **-10 dB** (`0.3162` lineal) durante la duración real de la alarma (10,0 s).
   - Al finalizar la alarma, `releaseDucking` ejecuta una rampa de recuperación progresiva de **800 ms** que eleva Sudden Death BGM a su volumen completo en el bus musical.
4. **Laboratorio DEV (SFX LAB / MUSIC LAB)**:
   - Actualizadas las tarjetas de Gameplay BGM y Sudden Death BGM con badge `MÚSICA BGM`, información detallada y controles `▶ ESCUCHAR MÚSICA`, `■ DETENER MÚSICA` y `▶ PROBAR TRANSICIÓN + ALARMA`.
5. **Pruebas unitarias**: Pruebas unitarias de AudioManager en `audio-manager.test.ts` actualizadas y validadas en verde.

## Estado y clasificación final de la tarea

- **Clasificación**: **COMPLETADA** — Subsistema de audio básico, 13 muestras SFX de producción, sintetizador de respaldo para 16 eventos y arquitectura BGM completa (Menu, Gameplay, Sudden Death, Victory Option 2) procesados, integrados y validados auditivamente por el usuario.
- **Infraestructura de audio**: ✅ Implementada (Web Audio API Singleton, creación diferida, ganancia por pista `trackGain`, bus `musicGain`, degradación segura).
- **Efectos sonoros sintéticos (SFX)**: ✅ Implementados y refinados (16 eventos esenciales sintetizados, 6 variantes tácticas de sabotaje).
- **Assets sonoros procesados**: ✅ Muestras procesadas de `suddenDeathStarted` (10,0s WAV), `gameOver` (1,70s WAV), `victory.wav` (Option 2, 42,0s estéreo), `victoryFallback` (1,80s estéreo WAV), `linesCleared` (280ms estéreo WAV), `uiClick` (80ms mono WAV), `pieceLocked` (130ms mono WAV), `hardDrop` (180ms mono WAV), sabotajes Residuos, Sobrecarga y Polaridad Inversa con fallback sintético resiliente.
- **Arquitectura BGM de producción**: ✅ 4 pistas reales procesadas e integradas (`menu.wav` 31,5s, `gameplay.wav` 126,1s, `sudden-death.wav` 100,5s y `victory.wav` *Option 2* 42,0s) con bucle continuo, desvanecimientos cruzados, ducking composable de alarma EAS (-10 dB) y silent fallback defensivo.
- **Laboratorio DEV (SFX LAB)**: ✅ Implementado (`?sfx-lab=1` en DEV, audición de tarjetas SFX/BGM con badge MÚSICA BGM para todas las pistas, controles independientes, prueba de transición a Muerte Súbita con alarma EAS ducked, prueba de loop de victoria y exportación WAV PCM).

### Estado tras cierre formal de la Tarea 0026

- **Pack de SFX reales auditado**: 13 activos binarios WAV de producción auditados y validados individualmente en tiempo de ejecución.
- **Pistas BGM reales de producción**: 4 piezas musicales de producción integradas (`menu.wav`, `gameplay.wav`, `sudden-death.wav` y `victory.wav`).
- **Validaciones de ingeniería**: `pnpm test` (753 tests pasados en 37 archivos), `pnpm lint` (0 errores/warnings), `pnpm typecheck` (4 proyectos TypeScript limpios), `pnpm build` (build Vite exitoso) y `pnpm test:e2e` (9 escenarios Playwright pasados).

La Tarea 0026 queda declarada formalmente como **COMPLETADA**.

## Confirmación de alcance excluido

No se introdujeron dependencias de audio en `@rautfall/game-engine` ni `@rautfall/battle-engine`. No se conservaron los archivos M4A originales completos en el repositorio. No se modificaron los contratos de resultado de victoria/empate. `apps/web/e2e/battle-demo.spec.ts` permanece intacto e inalterado en `HEAD`.
