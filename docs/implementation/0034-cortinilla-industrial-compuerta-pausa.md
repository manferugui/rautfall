# 0034 — Cortinilla / Compuerta Industrial Animada de Pausa

## Resumen

Se ha implementado en Rautfall una **compuerta/blast shutter industrial animada de pausa** (`PauseShutter.vue`) que sella físicamente la ventana del tablero principal de juego cuando el usuario entra en estado de pausa (`Esc` o control de UI), reemplazando el antiguo overlay semitransparente web.

Asimismo, se ha realizado el rediseño estructural del **monitor rival (`OpponentMonitor.vue`)** bajo el sistema visual **Industrial Dramatic**, diferenciando su estado de pausa como una suspensión táctica de señal (`FEED HOLD // TACTICAL LINK SUSPENDED`) sin incorporar persiana hidráulica activa.

La solución cumple strictly con la dirección visual del proyecto, utiliza una arquitectura puramente presentacional basada en Vue 3 y CSS procedural (sin imágenes rasterizadas), optimiza el tiempo de reanudación con una apertura rápida (~240 ms) y se integra con la infraestructura preexistente de `AudioManager` mediante activos WAV de producción pre-generados.

---

## 1. Diagnóstico de la Implementación Previa

* `SessionStatus` gestionaba `running | paused | gameOver`.
* Al pulsar `Esc` o el botón de pausa, el motor se pausaba instantáneamente y se renderizaba un simple `<div class="pause-overlay">PAUSA</div>`.
* La representación visual no reflejaba la masa, tecnología ni sellado de maquinaria industrial característicos de la carcasa Tactical de Rautfall.
* El selector E2E `data-testid="pause-overlay"` estaba acoplado a esa implementación previa.

---

## 2. Decisiones Arquitectónicas y Estructura

### Componente Presentacional (`PauseShutter.vue`)
- Ubicación: `apps/web/src/components/PauseShutter.vue`.
- Responsabilidad: 100% presentación visual del DOM y transiciones CSS.
- Prop: `:status="gameState.status"`.
- Ausencia de acoplamiento de audio: No importa ni invoca `AudioManager`. Toda la reproducción sonora se orquesta desde `App.vue` al observar las transiciones de estado.
- Precedencia: No se renderiza cuando `status === 'gameOver'`, respetando que la pantalla de resultados prevalezca sobre la compuerta.

### Geometría y Estilos (`Vue + CSS`)
- Construido con 5 lamas metálicas horizontales (`.shutter-slat`), costillas estructurales (`.slat-rib`), remaches mecánicos (`.slat-rivet`) y guías mecánicas laterales (`.shutter-guide`).
- Placa central de señalética integrada:
  ```text
  SYSTEM HOLD
  PAUSED

  ESC — RESUME
  ```
- Paleta **Industrial Dramatic**: grafito (`#1c2026`), metal oscuro (`#0d0f12`), biseles metálicos, señalética en ámbar táctico (`#ffb700`) y sombras interiores profundas.

### Timings de Animación
- **Cierre (`running -> paused`)**: **500 ms** (`cubic-bezier(0.16, 1, 0.3, 1)`). Ocultamiento progresivo y sellado firme.
- **Apertura (`paused -> running`)**: **~240 ms** (`cubic-bezier(0.4, 0, 0.6, 1)`). Repliegue ultrarrápido para evitar que el tablero continúe cubierto mientras el motor ya se ejecuta.
- **Reduced Motion**: `@media (prefers-reduced-motion: reduce)` fuerza aperturas y cierres instantáneos (`0.001s step-end`), manteniendo la accesibilidad.

---

## 3. Rediseño Estructural de `OpponentMonitor.vue` y Estado de Pausa del Rival

### Arquitectura Visual del Chasis Rival
- Chasis reorganizado en **tres masas físicas con silueta escalonada no rectangular**:
  - *Cabecera superior*: Placa en voladizo con chaflán angular (`clip-path`), remaches laterales y señalética técnica (`TACTICAL MONITOR // SYS R-02`).
  - *Cuerpo central*: Viewport con encastre de 3 niveles de profundidad y reflejo de cristal protector estático.
  - *`TELEMETRY BAY`*: Submódulo físico atornillado en la base con junta mecánica superior.
- **Montantes laterales mecánicos**: Columnas estructurales de acero de aproximadamente **22 px** (`.opponent-side-post`) con canal central de 4px, pletinas y pernos hexagonales.
- **Jerarquía**: Se mantiene como monitor secundario y compacto frente a la ventana principal del jugador.

### Comportamiento del Rival durante la Pausa
```text
Jugador:
- PauseShutter funcional
- SYSTEM HOLD / PAUSED (compuerta sellada)

Rival:
- Sin shutter funcional (monitor abierto)
- FEED HOLD / TACTICAL LINK SUSPENDED (feed suspendido)
```
- **Señálica OSD**: Insignia ligera OSD `.pause-feed-badge` con texto `FEED HOLD` (ámbar de alto contraste) y `TACTICAL LINK SUSPENDED`.
- **Tratamiento visual del tablero**: Atenuación de brillo y contraste en el viewport rival, velo translúcido y scanlines procedimentales estáticas.
- **Diodo LED**: Conmuta a modo en espera (ámbar) durante la pausa (`.header-led--hold`).
- **Aislamiento**:
  - No importa ni utiliza `PauseShutter.vue`.
  - No utiliza `AudioManager` ni genera SFX propios al pausar.
  - No añade timers ni watchers JS.
  - No modifica la lógica ni la presentación del sabotaje de `Interferencia`.
  - No altera `packages/game-engine` ni `packages/battle-engine`.

---

## 4. Activos y Gestión de Audio

### Ficheros WAV Derivados
Se crearon y versionaron los activos WAV de producción a partir del procesamiento del sonido de escotilla hidráulica, almacenados en `apps/web/public/audio/sfx/`:
- `pause-shutter-close.wav`: Duración ~500 ms (48.044 bytes, 48 kHz mono 16-bit PCM). Ataque mecánico, deslizamiento hidráulico y golpe sordo final.
- `pause-shutter-open.wav`: Duración ~240 ms (23.084 bytes, 48 kHz mono 16-bit PCM). Descompresión hidráulica rápida y liberación.

### Integración con `AudioManager` y Microajuste de BGM
- Añadidos `pauseShutterClose` y `pauseShutterOpen` al tipo `AudioSfxType` en `apps/web/src/audio/types.ts`.
- Mapeadas las rutas en `SFX_ASSET_URL_MAP` en `apps/web/src/audio/audio-manager.ts`.
- Registradas las constantes en `PRODUCTION_SFX_ASSET_FILES` en `apps/web/src/audio/sfx-wav-export.ts`.
- **Microajuste de Transporte de Música (BGM)**:
  - Implementada semántica de transporte basada en offset en `AudioManager` (`pauseMusic()`, `resumeMusic()`, `isMusicPaused()`).
  - Al pausar la partida (`running -> paused`): `pauseMusic()` calcula el tiempo acumulado transcurrido (`currentTime - startedAt`), lo acumula en `musicPlaybackOffsetSeconds` aplicando el módulo respecto a la duración del buffer (`offset % duration`), programa un fade-out de ~150 ms sobre la ganancia del canal y detiene la fuente activa sin suspender el `AudioContext`.
  - Al reanudar (`paused -> running`): `resumeMusic()` crea un nuevo `AudioBufferSourceNode`, inicia la reproducción en `source.start(nowCtx, startOffset)` y aplica un fade-in suave de ~250 ms.
  - El `AudioContext` permanece `running`, permitiendo reproducir SFX durante la pausa (`pauseShutterClose`, `pauseShutterOpen`, UI clicks).
- Disparo mediante `watch` en `App.vue`:
  - `running -> paused` => `audioManager.playSfx('pauseShutterClose')` + `audioManager.pauseMusic()`.
  - `paused -> running` => `audioManager.playSfx('pauseShutterOpen')` + `audioManager.resumeMusic()`.
- Si el audio no está desbloqueado o el usuario activó mute, la compuerta y el transporte funcionan con coherencia sin arrojar excepciones.

---

## 5. Contrato E2E y Pruebas

- Selectores E2E actualizados: `data-testid="pause-shutter"` (jugador) y `data-testid="opponent-pause-overlay"` (rival).
- El selector previo `pause-overlay` se ha reemplazado limpiamente en las pruebas E2E `essential-flow.spec.ts`.
- Pruebas unitarias en `apps/web/src/components/PauseShutter.test.ts` (compuerta del jugador).
- Pruebas unitarias en `apps/web/src/components/OpponentMonitor.test.ts` (estado `FEED HOLD`, ausencia de persiana rival y preservación de interferencia).

---

## 6. Archivos Creados y Modificados

### Archivos Creados
- `apps/web/src/components/PauseShutter.vue`: Componente presentacional de compuerta industrial.
- `apps/web/src/components/PauseShutter.test.ts`: Pruebas unitarias de UI para la compuerta.
- `apps/web/public/audio/sfx/pause-shutter-close.wav`: Activo de audio WAV de cierre (~500 ms).
- `apps/web/public/audio/sfx/pause-shutter-open.wav`: Activo de audio WAV de apertura (~240 ms).
- `docs/tasks/0034-cortinilla-industrial-compuerta-pausa.md`: Especificación de tarea.
- `docs/implementation/0034-cortinilla-industrial-compuerta-pausa.md`: Informe de implementación.

### Archivos Modificados
- `apps/web/src/App.vue`: Integración de `PauseShutter` y watcher de audio para el cambio de estado.
- `apps/web/src/audio/types.ts`: Añadidos identificadores `pauseShutterClose` y `pauseShutterOpen`.
- `apps/web/src/audio/audio-manager.ts`: Mapeo de URLs en `SFX_ASSET_URL_MAP`.
- `apps/web/src/audio/sfx-synth.ts`: Registro de metadatos en `SFX_METADATA_MAP`.
- `apps/web/src/audio/sfx-wav-export.ts`: Añadidos archivos a `PRODUCTION_SFX_ASSET_FILES`.
- `apps/web/src/components/OpponentMonitor.vue`: Rediseño estructural en 3 masas y estado de pausa `FEED HOLD`.
- `apps/web/src/components/OpponentMonitor.test.ts`: Pruebas del estado `FEED HOLD` / `TACTICAL LINK SUSPENDED`.
- `apps/web/src/game/types.ts`: Exportación de `SessionStatus`.
- `apps/web/e2e/essential-flow.spec.ts`: Actualización de selectores y aserciones de pausa.
- `docs/project-status.md`: Actualización del registro global de tareas del proyecto.

---

## 7. Resultados de Validación

```bash
pnpm test
# PASS: 56 test files (935 tests)

pnpm lint
# PASS: 0 errors, 0 warnings

pnpm typecheck
# PASS: 6 packages checked

pnpm build
# PASS: dist/ build ok

git diff --check
# PASS: sin conflictos de espacios ni saltos de línea
```
