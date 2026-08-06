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

## Estado y clasificación final de la tarea

- **Clasificación**: **Primera fase técnica completada; integración musical pendiente**.
- **Infraestructura de audio**: ✅ Implementada (Web Audio API Singleton, creación diferida, degradación segura).
- **Efectos sonoros sintéticos (SFX)**: ✅ Implementados (10 eventos esenciales sintetizados, deduplicación indexada por SFX).
- **Controles e interfaz (Mute)**: ✅ Implementados y persistidos (`rautfall_audio_muted`).
- **Música ambiental (BGM)**: ⏳ Pendiente de generación, exportación e integración de los ficheros `menu.mp3` y `gameplay.mp3` producidos con Google Flow Music.
- **Validación auditiva humana**: ⏳ Pendiente de comprobación manual por el usuario en navegador real.

La Tarea 0026 no se declara cerrada al 100% hasta completar la incorporación de las pistas musicales binarias exigidas por los criterios de aceptación de la especificación.

## Confirmación de alcance excluido

No se introdujeron dependencias de audio en `@rautfall/game-engine` ni `@rautfall/battle-engine`. No se crearon ni añadieron ficheros binarios ficticios `.mp3`. No se modificaron los controles de teclado ni se creó un panel completo de Settings. `apps/web/e2e/battle-demo.spec.ts` permanece intacto e inalterado en `HEAD`.

