# Tarea 0026 — Audio básico e identidad sonora

## 1. Contexto

La Tarea 0025 consolidó la navegación web completa (`menu` $\to$ `playing` $\to$ `results`), el ciclo de vida estricto de Phaser con `game.destroy(true)`, el Menú Principal Industrial Dramatic y el modal de resultados con estadísticas oficiales. Sin embargo, la aplicación web actual carece por completo de infraestructura de audio, reproduciéndose en silencio absoluto.

Para alcanzar una experiencia de juego web inmersiva, cohesiva con la dirección artística *Industrial Dramatic* y adecuada para la defensa del TFM, es necesario incorporar un subsistema de audio desacoplado que proporcione feedback sonoro esencial y música ambiental, aprovechando la disponibilidad de la herramienta **Google Flow Music** para la generación de temas originales.

## 2. Objetivo

Diseñar e implementar en `apps/web` un subsistema de audio desacoplado que gestione de forma limpia la música ambiental y los efectos de sonido esenciales (SFX), inicializado tras interacción del usuario, persistiendo el estado de silencio (mute) y respetando el ciclo de vida de Vue y Phaser sin introducir acoplamiento, duplicación de contextos ni dependencias de audio en `@rautfall/game-engine` ni `@rautfall/battle-engine`.

## 3. Estado previo

- **Infraestructura de audio**: Inexistente (0% de código o assets de audio en `apps/web`).
- **Lógica de juego**: Motores independientes (`@rautfall/game-engine`, `@rautfall/battle-engine`) que emiten eventos de dominio en cada paso lógico (`pieceLocked`, `linesCleared`, `sabotageTriggered`, `suddenDeathStarted`, etc.).
- **Navegación**: `App.vue` orquesta las pantallas `'menu' | 'playing' | 'results'`. Phaser se destruye y vuelve a crear al iniciar cada partida.
- **Teclado e interacción**: `ModeSelector.vue` y `App.vue` reciben los primeros clics/pulsaciones del usuario antes o durante la partida.

## 4. Alcance

### 4.1. Servicio centralizado de audio (`AudioManager`)
- Crear un servicio singleton/módulo en `apps/web/src/audio/audio-manager.ts`.
- Encapsular la inicialización y desbloqueo del `AudioContext` de la Web Audio API tras el primer gesto explícito del usuario (`click` o `keydown`).
- Gestionar dos canales independientes: **Música (BGM)** y **Efectos (SFX)** conectados a un nodo principal `MasterGainNode`.
- Soportar alternancia de silencio global (mute), silenciando la salida master sin pausar el tiempo lógico del juego.
- Garantizar que la aplicación funcione al 100% de forma limpia si Web Audio API no estuviera disponible o si el navegador bloquea el autoplay.

### 4.2. Música ambiental (BGM)
- Soporte para reproducción en bucle (`loop: true`) y transiciones suaves (`crossfade` / `fadeTimeMs: 500`).
- Cobertura inicial de 2 pistas principales de producción:
  1. `menu.mp3`: Pista atmosférica para el Menú Principal (`AppScreen === 'menu'`).
  2. `gameplay.mp3`: Pista rítmica industrial para partida (`AppScreen === 'playing'`), compartida entre entrenamiento y batalla.
- Transición en Muerte Súbita (`suddenDeathPhase !== 'inactive'`):
  - Aumento de intensidad o volumen en la pista `gameplay.mp3`, o sustitución por `sudden-death.mp3` si el asset original de Google Flow Music está disponible y su integración es directa.

### 4.3. SFX esenciales
Disparar efectos de sonido efímeros consumiendo exclusivamente hechos/eventos de dominio drenados:
1. `hardDrop`: Impacto metálico seco al realizar caída instantánea.
2. `pieceLocked`: Sonido sutil de encaje/fijación de pieza sobre el tablero.
3. `linesCleared`: Impacto resonante al eliminar de 1 a 3 líneas.
4. `quadOrTSpin`: Acento armónico industrial al realizar un Quad (4 líneas) o T-Spin.
5. `sabotageTriggered`: Pulso eléctrico / señal de aviso al activar o recibir un sabotaje.
6. `suddenDeathWarning`: Alarma contenida de emergencia al activarse el aviso o inicio de Muerte Súbita.
7. `gameOver`: Tono descendente de colapso al perder o empatar la partida.
8. `victory`: Tono triunfal industrial al ganar la batalla local.
9. `uiClick`: Feedback sutil al pulsar botones de la interfaz web (Menú, Reanudar, Reiniciar).

### 4.4. Controles e interfaz
- Botón toggle de Mute/Unmute accesible en el Menú Principal (`ModeSelector.vue`) y en la cabecera/consola de `App.vue`.
- Indicador visual claro del estado (icono/texto con `aria-label` descriptivo).
- Persistencia del estado de silencio en `localStorage` bajo la clave `rautfall_audio_muted`.

### 4.5. Assets y trazabilidad
- Ubicación de assets en `apps/web/public/audio/music/` y `apps/web/public/audio/sfx/`.
- Creación de `docs/audio-assets.md` registrando la procedencia, prompt de Google Flow Music, fecha de generación, transformaciones y condiciones de licencia de cada recurso.

## 5. Exclusiones

Queda explícitamente fuera del alcance de esta tarea:
- Modificaciones en `@rautfall/game-engine`, `@rautfall/game-config` o `@rautfall/battle-engine`.
- Lógica o llamadas a APIs de audio dentro del dominio o dentro de clases puras de simulación.
- SFX por cada movimiento horizontal (DAS/ARR), soft drop continuo o tick individual de lock delay.
- Panel completo de ajustes (Settings) con sliders independientes para Master/Música/SFX o ecualizador.
- Audio posicional 3D, efectos ambientales por convolución o sintetizador de voz (TTS).
- Música generativa en tiempo real o descarga de assets por red en streaming.
- Modificación del remapeo de teclas o controles de teclado.

## 6. Arquitectura de audio

### 6.1. Elección de tecnología: Web Audio API pura
Se selecciona **Web Audio API** nativa del navegador encapsulada en `apps/web/src/audio/` en lugar de Phaser Audio.

**Justificación:**
1. **Desacoplamiento de la escena Phaser**: La música de menú debe sonar en `ModeSelector.vue` antes de que Phaser exista. Phaser se crea al pulsar "Iniciar" y se destruye con `game.destroy(true)` al volver al menú o reiniciar. Si la música dependiera del SoundManager de Phaser, la destrucción de la escena interrumpiría o duplicaría las pistas BGM.
2. **Control estricto del `AudioContext`**: Web Audio API directa permite mantener una única instancia singleton de `AudioContext` asociada al ciclo de vida de la SPA web.
3. **SFX sintéticos de baja latencia**: Permite combinar reproducibilidad de ficheros `.mp3` para BGM con nodos de osciladores/ganancia sintéticos ultra-ligeros para SFX secos (como `pieceLocked` o `hardDrop`) sin depender de assets pesados.

### 6.2. Diagrama de arquitectura
```text
[ Eventos de Dominio ] ----> [ GameScene / Vue ]
                                    |
                                    v (notifica hechos)
                          [ AudioManager Singleton ]
                                    |
                       +------------+------------+
                       |                         |
               [ BGM Channel ]           [ SFX Channel ]
                       |                         |
                       +------------+------------+
                                    |
                           [ MasterGainNode ]
                                    |
                           [ AudioContext ]
```

## 7. Música

### 7.1. Pistas y comportamiento
| Identificador | Fichero | Pantalla / Momento | Loop | Descripción / Estilo |
|---|---|---|---|---|
| `menu` | `public/audio/music/menu.mp3` | `AppScreen === 'menu'` | Sí | Atmosférico, industrial, grafito |
| `gameplay` | `public/audio/music/gameplay.mp3` | `AppScreen === 'playing'` | Sí | Rítmico, tensión constante |
| `suddenDeath` | `public/audio/music/sudden-death.mp3` *(Opcional)* | Muerte Súbita activada | Sí | Acelerado, dramático (si está disponible) |

### 7.2. Reglas de transición
- **Menú $\to$ Partida**: Al hacer clic en "Iniciar Partida", `menu.mp3` realiza un desvanecimiento suave (`fadeOut` 300 ms) y comienza `gameplay.mp3` (`fadeIn` 300 ms).
- **Pausa**: Al pausar la partida (`SessionStatus === 'paused'`), la música de partida reduce su volumen al 40% o aplica un filtro pasa-bajo sutil, restaurándose de inmediato al reanudar.
- **Fin de partida**: Al pasar a `results`, la BGM atenúa su volumen y se reproduce el SFX terminal de Victoria/Derrota/Empate.

## 8. SFX (Efectos de sonido)

### 8.1. Tabla de eventos y sonidos
| Evento de dominio / UI | Identificador SFX | Origen del sonido | Prioridad |
|---|---|---|---|
| Pulsar botón en UI | `uiClick` | Sintético / Clic seco | Baja |
| `hardDrop` | `hardDrop` | Fichero / Golpe metálico | Media |
| `pieceLocked` | `pieceLocked` | Sintético / Pulso de fijación | Baja |
| `linesCleared` (1-3 líneas) | `lineClear` | Fichero / Resonancia grave | Alta |
| `linesCleared` (4 líneas / T-Spin) | `quadOrTSpin` | Fichero / Impacto armónico | Alta |
| `sabotageTriggered` / `sabotageRouted` | `sabotage` | Fichero / Pulso eléctrico | Alta |
| `suddenDeathWarning` / `Started` | `suddenDeath` | Fichero / Alarma industrial | Alta |
| `gameOver` (Derrota/Empate) | `defeat` | Fichero / Caída de tono | Alta |
| Victoria de batalla | `victory` | Fichero / Acorde triunfal industrial | Alta |

### 8.2. Filtrado y desduplicación
- Para evitar saturación sonora cuando se procesan múltiples eventos en un mismo paso o frame, el `AudioManager` impondrá una ventana mínima de guardia (cooldown de 40 ms) por tipo de SFX.
- Un evento transitorio drenado producirá como máximo una reproducción de SFX.

## 9. Controles

- **Componente visual**: Botón Mute integrado en `ModeSelector.vue` y en la cabecera de `App.vue`.
- **Atributos de accesibilidad**:
  - `aria-label="Silenciar audio"` / `aria-label="Activar audio"`.
  - `role="button"`.
  - `data-testid="audio-mute-button"`.
- **Persistencia**:
  - Al hacer clic, se invoca `audioManager.toggleMute()`.
  - El valor booleano se guarda en `localStorage.setItem('rautfall_audio_muted', 'true' | 'false')`.
  - Al iniciar la aplicación, `AudioManager` lee el valor almacenado e inicializa la ganancia master en 0 si estaba silenciado.

## 10. Ciclo de vida

1. **Carga inicial SPA**:
   - `AudioManager` se crea en estado *standby* (`AudioContext` en estado `suspended` hasta gesto de usuario).
   - Se lee el estado de mute persistido desde `localStorage`.
2. **Primer clic o pulsación de tecla**:
   - Se invoca `audioManager.unlock()`.
   - Se reanuda el `AudioContext` (`ctx.resume()`).
   - Se inicia la BGM `menu.mp3` si la pantalla es `'menu'`.
3. **Selección de modo (`selectMode`)**:
   - Transición de BGM `menu` $\to$ `gameplay`.
4. **Bucle de juego (`playing`)**:
   - `GameScene` drena eventos del motor en cada frame y notifica los hechos al `AudioManager`.
   - `AudioManager` reproduce los SFX correspondientes si el audio no está en mute.
5. **Pausa (`togglePause`)**:
   - La música disminuye de intensidad (attenuation/filter). No se detienen los contextos.
6. **Reanudación**:
   - La música recupera su nivel normal sin duplicar la pista.
7. **Fin de partida (`results`)**:
   - Se atenúa la BGM de partida y se emite el SFX de Victoria o Derrota.
8. **Regreso al Menú (`goToMenu`)**:
   - Transición de BGM `gameplay` $\to$ `menu`.
9. **Destrucción de componentes / SPA (`onBeforeUnmount`)**:
   - Se detienen las fuentes activas y se cierran o suspenden los nodos de ganancia de forma limpia.

## 11. Assets y trazabilidad (`docs/audio-assets.md`)

Todos los archivos generados u obtenidos para la Tarea 0026 deben documentarse obligatoriamente en `docs/audio-assets.md` con la siguiente estructura:

### Plantilla de registro de assets
```markdown
# Registro de Assets de Audio — Rautfall

## Música BGM

### `public/audio/music/menu.mp3`
- **Herramienta de generación**: Google Flow Music
- **Prompt utilizado**: "Industrial dark ambient soundtrack, graphite metallic texture, slow atmospheric pulse, 90 bpm, continuous loop"
- **Fecha de generación**: [YYYY-MM-DD]
- **Versión seleccionada**: v1.0
- **Transformaciones**: Normalización de volumen a -14 LUFS, fade in/out ajustado en exportación.
- **Condiciones de uso y licencia**: Licencia de uso Google Flow Music para proyecto académico TFM.
- **Atribución**: Generado con Google Flow Music para el TFM Rautfall.

### `public/audio/music/gameplay.mp3`
- **Herramienta de generación**: Google Flow Music
- **Prompt utilizado**: "Driving industrial electronic rhythm, dark synth bassline, fast tactical pulse, 130 bpm, loopable"
- ...
```

*Nota: No se afirmará en la especificación ni en la documentación que los assets carecen de restricciones sin haber verificado sus términos reales.*

## 12. Contratos afectados

### 12.1. `apps/web/src/audio/audio-manager.ts` [NEW]
```typescript
export interface AudioService {
  unlock(): Promise<void>;
  isMuted(): boolean;
  toggleMute(): boolean;
  playBgm(track: 'menu' | 'gameplay' | 'suddenDeath'): void;
  stopBgm(): void;
  playSfx(event: AudioSfxEvent): void;
  destroy(): void;
}
```

### 12.2. Modificación en `App.vue` y `ModeSelector.vue` [MODIFY]
- Incorporación del botón de control de mute y vinculación con `AudioManager`.
- Invocación de `audioManager.unlock()` en los controladores de eventos de inicio.

### 12.3. Modificación en `GameScene.ts` [MODIFY]
- Notificación de hechos/eventos drenados (`frameEvents`, `battleEvents`) hacia la capa de presentación/audio sin alterar la lógica de cálculo lúdico.

## 13. Invariantes

1. **Determinismo intacto**: La presencia, ausencia, fallo o retardo del sistema de audio jamás afectará al paso lógico, semilla, snapshots ni resultados de los motores de juego.
2. **Unicidad de `AudioContext`**: Existirá como máximo una instancia activa de `AudioContext` en la aplicación web.
3. **Ausencia de reproducciones duplicadas**: Un evento de dominio drenado producirá como máximo un efecto de sonido.
4. **Independencia funcional**: Si el navegador bloquea la reproducción de audio o el usuario lo silencia, la aplicación seguirá siendo 100% jugable sin arrojar excepciones no controladas.
5. **Persistencia de preferencia**: El estado de mute perdura entre recargas del navegador mediante `localStorage`.
6. **Equivalencia visual**: Todo evento que dispare un SFX crítico (Muerte Súbita, sabotajes, fin de partida) conservará su representación visual en el DOM/Phaser.

## 14. Pruebas requeridas

### 14.1. Unitarias (`vitest`)
- **`audio-manager.test.ts`**:
  - Inicialización limpia en estado suspendido.
  - Alternancia de mute (`toggleMute`) y persistencia en `localStorage`.
  - Verificación de que en estado `muted === true` la ganancia efectiva es 0.
  - Control de ventanas de guardia (cooldown) para evitar ráfagas desordenadas de SFX.
  - Destrucción limpia sin dejar listeners colgados.

### 14.2. Pruebas de componentes Vue
- **`ModeSelector.test.ts` / `App.test.ts`**:
  - Renderizado del botón de mute con atributo `data-testid="audio-mute-button"`.
  - Verificación del cambio de estado visual y `aria-label` al hacer clic.
  - Comprobación de que la navegación entre pantallas (`menu` $\to$ `playing` $\to$ `results`) no duplica los elementos de control ni reinicia de forma anómala el servicio de audio.

### 14.3. Integración
- Verificación del mapeo de eventos drenados en `GameScene.ts` hacia `audioManager.playSfx()`.
- Comprobación de que las pausas y reanudaciones ajustan la BGM sin detener la sesión.

## 15. Pruebas E2E (Playwright)

- **Navegación sin errores de consola**: Comprobar que la navegación completa (Menú $\to$ Entrenamiento/Batalla $\to$ Pausa $\to$ Resultados $\to$ Menú) no produce `console.error` ni `pageerror` relacionados con `AudioContext` o promesas de reproducción automáticas rechazadas.
- **Persistencia de Mute**: Activar el botón de silencio en el Menú Principal, recargar la página (`page.reload()`) y verificar que el estado de silencio se mantiene activo (`data-audio-muted="true"`).
- **Jugabilidad con audio bloqueado**: Simular un entorno con políticas estrictas de autoplay y comprobar que la partida puede iniciarse, jugarse y completarse sin bloqueos de interfaz.

*Nota: Las pruebas E2E verificarán el estado de los componentes y la ausencia de errores en consola, sin intentar auditar perceptualmente la onda de sonido.*

## 16. Validaciones obligatorias

Antes de declarar completada la Tarea 0026, se deberán ejecutar desde la raíz del monorepo los siguientes comandos, los cuales deben finalizar sin errores ni avisos:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`
- `git diff --check`
- `git status --short`

### Validación manual complementaria
- Comprobar que el volumen del audio sea equilibrado y agradable.
- Confirmar que los bucles de música (`loop`) no presentan chasquidos ni cortes bruscos.
- Verificar la coherencia estética del audio con la dirección *Industrial Dramatic*.

## 17. Criterios de aceptación

1. La aplicación web arranca en el Menú Principal sin arrojar errores de consola relacionados con autoplay o `AudioContext`.
2. Al interactuar con la interfaz por primera vez, el sistema de audio se inicializa/desbloquea de forma transparente.
3. La música de menú se reproduce en bucle en `appScreen === 'menu'` y transiciona a la música de partida al iniciar la sesión.
4. Los eventos de dominio principales (caída instantánea, fijación, líneas eliminadas, sabotajes, Muerte Súbita, resultado) disparan sus correspondientes SFX sin latencia perceptible.
5. El botón de Mute permite silenciar y activar todo el sonido de la aplicación, y su valor persiste en `localStorage`.
6. Al pausar la partida, la música se atenúa o ajusta, recuperando su nivel al reanudar.
7. Al navegar repetidamente entre el Menú y las Partidas, no se duplican pistas de música ni instancias de `AudioContext`.
8. Se ha creado el archivo `docs/audio-assets.md` registrando la trazabilidad, prompts y licencias de los recursos musicales generados.
9. Todas las validaciones automáticas (`test`, `lint`, `typecheck`, `build`, `test:e2e`, `git diff --check`) finalizan en verde.

## 18. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Bloqueo de autoplay por políticas del navegador | Medio | Encapsular `.play()` y `ctx.resume()` en bloques `catch` silenciosos y diferir la activación a la primera interacción del usuario (`click`/`keydown`). |
| Fugas de nodos de audio o listeners en navegaciones | Alto | Diseñar `AudioManager` como un singleton desacoplado con métodos explícitos de limpieza y suscripción limpia a eventos. |
| Saturación de sonido por eventos simultáneos | Medio | Aplicar un temporizador de guardia (cooldown de 40 ms) por tipo de SFX en el `AudioManager`. |
| Falta de licencias claras en assets | Alto | Documentar exhaustivamente cada prompt y término de uso en `docs/audio-assets.md`. |

## 19. Archivos previstos

- **Especificación (este documento)**: `docs/tasks/0026-audio-basico-e-identidad-sonora.md`
- **Informe de implementación (al completar)**: `docs/implementation/0026-audio-basico-e-identidad-sonora.md`
- **Registro de trazabilidad de assets**: `docs/audio-assets.md`
- **Código fuente previsto**:
  - `apps/web/src/audio/audio-manager.ts` [NEW]
  - `apps/web/src/audio/audio-manager.test.ts` [NEW]
  - `apps/web/src/audio/sfx-synth.ts` [NEW] (opcional para SFX sintéticos)
  - `apps/web/public/audio/music/menu.mp3` [NEW]
  - `apps/web/public/audio/music/gameplay.mp3` [NEW]
  - `apps/web/public/audio/sfx/...` [NEW]
  - `apps/web/src/App.vue` [MODIFY]
  - `apps/web/src/components/ModeSelector.vue` [MODIFY]
  - `apps/web/src/game/scenes/GameScene.ts` [MODIFY]
- **Documento de estado**: `docs/project-status.md` [MODIFY] (al finalizar la implementación)
