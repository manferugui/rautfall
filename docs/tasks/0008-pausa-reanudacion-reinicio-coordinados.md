# 0008 — Pausa, reanudación y reinicio coordinados

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0008 — Pausa, reanudación y reinicio coordinados
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0008`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el HUD Tactical, la batalla o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0008-pausa-reanudacion-reinicio-coordinados.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0008-pausa-reanudacion-reinicio-coordinados.md) (ver §29), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Coordinar tres operaciones de sesión en la capa web —**pausa**, **reanudación** y **reinicio**— sin incorporar ningún concepto de pausa al motor determinista, sin duplicar reglas entre teclado y controles Vue, y sin permitir que una tecla mantenida antes o durante la pausa produzca una acción fantasma al reanudar.

Al terminar la tarea:

- `Escape` alterna `running ⇄ paused` mediante flanco real, sin afectar a `gameOver`;
- existe un botón Vue «Pausar/Reanudar» que invoca exactamente la misma operación que `Escape`;
- existe un botón Vue «Reiniciar» disponible en los tres estados de sesión, que reutiliza la semilla y configuración actuales;
- ninguna tecla mantenida antes de pausar, o pulsada durante la pausa, produce una acción al reanudar: el jugador debe soltar y volver a pulsar;
- el acumulador temporal se descarta al pausar y no genera una ráfaga de pasos al reanudar;
- `game-engine` no cambia: sigue sin conocer la pausa, sin métodos `pause()`/`resume()`, sin configuración de pausa;
- `apps/web` expone un estado de sesión (`SessionStatus`) con una regla de precedencia explícita (`gameOver` > `paused` > `running`), sin dos estados independientes que puedan divergir.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo                                      ✅ Completada
0002 — Motor de juego determinista                              ✅ Completada
0003 — Rotación SRS                                              ✅ Completada
0004 — Integración de Phaser                                     ✅ Completada
0005 — DAS, ARR y soft drop                                       ✅ Completada
0006 — Lock delay y fijación diferida                             ✅ Completada
0007 — Cola de próximas piezas y preview técnico provisional      ✅ Completada
0008 — Pausa, reanudación y reinicio coordinados                ← Esta tarea
```

Esta tarea no incluye: hold, ghost piece, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, batalla, bot, audio, HUD Tactical definitivo, Industrial Dramatic definitivo, Pinia, Vue Router, backend, Playwright, CI/CD, code splitting, ni corrección del aviso de chunk de Phaser. Ver §22 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — MVP («Pausa y reinicio» listados como funcionalidad base) y arquitectura Vue/Phaser (Vue gestiona «Pausa, resultados, errores y estados de conexión»).
- [docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md) — adaptador temporal (acumulador, tope 250 ms, 25 pasos), estructura `GameCanvas.vue`/`create-phaser-game.ts`/`GameScene.ts`, contrato `PhaserGameController`/`GamePresentationState` original.
- [docs/tasks/0005-das-arr-soft-drop.md](0005-das-arr-soft-drop.md) y [docs/implementation/0005-das-arr-soft-drop.md](../implementation/0005-das-arr-soft-drop.md) — contrato `StepInput` con `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld`, estado interno `horizontalState` del motor (prioridad, acumulador DAS, `hasReachedDas`), corrección de rearme de `consumedThisFrame` documentada en el informe de `0004`.
- [docs/tasks/0006-lock-delay-fijacion-diferida.md](0006-lock-delay-fijacion-diferida.md) — `lockDelayElapsedMs`, `lockResetsUsed`, orden del paso lógico.
- [docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md](0007-cola-proximas-piezas-preview-tecnico.md) y su informe — `nextPieces`, `getPieceShape`, `GamePresentationState` actual, patrón de extracción de funciones puras testeables (`computeSteps`, `buildStepInput`, `getPieceShape`) frente a la decisión ya aceptada de no probar `GameScene` directamente.
- `packages/game-engine/src/index.ts` — implementación real íntegra tras `0007` (leída completa, ver §4).
- `packages/game-config/src/index.ts` — `GameConfig`, `prototypeConfig`, sin ninguna propiedad de pausa.
- `apps/web/src/App.vue`, `apps/web/src/components/GameCanvas.vue`, `apps/web/src/components/GameCanvas.test.ts`, `apps/web/src/components/NextPiecesPreview.vue`, `apps/web/src/game/types.ts`, `apps/web/src/game/types.test.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/input-buffer.test.ts`, `apps/web/src/game/input-debug.ts`, `apps/web/src/game/input-debug.test.ts`, `apps/web/src/game/time-adapter.ts`, `apps/web/src/game/coordinates.ts` — implementación web real tras `0007` (todos leídos íntegros, ver §4).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto (276 tests, siguiente tarea abierta a decisión).

No existe `apps/web/src/App.test.ts` en el repositorio actual (confirmado por listado de archivos): esta tarea lo crea (§25).

## 4. Inspección previa (confirmada por lectura directa del código real)

### 4.1 El motor no tiene, y esta tarea no le añade, concepto de pausa

`EngineStatus = 'running' | 'gameOver'` (`packages/game-engine/src/index.ts`). No existe `paused` en ningún tipo público ni interno. `GameConfig` no tiene ninguna propiedad relativa a pausa. Ninguna búsqueda de `pause`, `paused`, `Escape`, `sessionStatus` en `packages/game-engine` ni `packages/game-config` produce resultados: el terreno está completamente libre en el motor.

### 4.2 Estado interno del motor que persiste entre llamadas a `step()` y que NO se puede tocar desde fuera

Confirmado en `packages/game-engine/src/index.ts`:

- `horizontalState: { priority: 'left' | 'right' | null; accumulatorMs: number; hasReachedDas: boolean }` — gobierna DAS/ARR (§9.1 de `0005`). Solo se reinicia mediante `resetHorizontalState()`, invocada internamente por el motor en `spawnInitialPieces()`, `spawnNextPiece()` y `reset()`. **No existe ninguna API pública para reiniciarla de forma aislada.**
- `verticalProgress`, `lockDelayElapsedMs`, `lockResetsUsed` — todos privados, solo tocados por el propio motor durante `step()`/`reset()`.
- Consecuencia directa: mientras la capa web no llame a `step()`, todo este estado permanece **congelado exactamente como estaba**. Esto es justo lo que se necesita para pausar (§7): no llamar a `step()` ya congela DAS, lock delay, gravedad, soft drop y bolsa sin ningún cambio en el motor.
- Consecuencia peligrosa detectada: si, tras una pausa, se reanuda y se vuelve a llamar a `step()` con `leftHeld: true` (porque el jugador seguía pulsando `ArrowLeft` físicamente), `processHorizontal` encuentra `horizontalState.priority === 'left'` todavía activo desde antes de la pausa y ejecuta la rama «6. Continuar la secuencia DAS/ARR en curso» (`packages/game-engine/src/index.ts:781-803`): suma `fixedStepMs` al acumulador y, si ya se había alcanzado el DAS antes de pausar, puede disparar un movimiento ARR **en el primer paso lógico tras reanudar**, sin que haya habido ninguna pulsación nueva. Esto viola directamente el requisito cerrado «ninguna tecla mantenida... puede mover la pieza automáticamente al reanudar» (§11 de esta especificación). La solución no puede tocar el motor (alcance excluido); debe resolverse exclusivamente en la entrada que la capa web construye y envía (§11).
- Un comportamiento análogo, ya existente y **fuera de alcance de esta tarea**, ocurre hoy en cada `spawnNextPiece()`: si el jugador mantiene una dirección mientras se fija una pieza, la nueva pieza se desplaza inmediatamente en el primer paso tras el spawn (`resetHorizontalState` deja `priority = null`, y `processHorizontal` interpreta `leftHeld && priority === null` como una activación nueva, rama «5. Sin prioridad»). Esta tarea **no cambia** ese comportamiento entre piezas; solo introduce una barrera equivalente y más estricta específicamente en los bordes de pausa/reanudación y de reinicio (§11), porque el enunciado de esta tarea lo exige explícitamente para esos dos bordes y no para el spawn ordinario.

### 4.3 Ciclo de frame real de `GameScene.update()`

Confirmado en `apps/web/src/game/scenes/GameScene.ts` (íntegro, 442 líneas):

1. `this.consumedThisFrame` se reinicia incondicionalmente al principio de cada `update()`.
2. Si `JustDown(R)`: `resetEngine()` + `notifyState()` + `return` (el reset tiene prioridad máxima, se comprueba antes que cualquier otra cosa, incluso antes de leer `status`).
3. Se lee `status = engine.getSnapshot().status`. Si `gameOver`: se renderiza, se drenan eventos, y se retorna **sin leer teclado** (`readKeys()` no se llama en absoluto durante `gameOver`).
4. En caso contrario (`running`): se calculan los pasos a ejecutar con `computeSteps(accumulator, delta, fixedStepMs)`, se llama `readKeys()` una vez, y se itera `stepsToExecute` veces construyendo `StepInput` con `buildStepInput`; el primer paso del frame usa `keys` reales, los pasos adicionales usan `emptyInput()` (que preserva `leftHeld`/`rightHeld`/`softDropHeld` reales pero fuerza `horizontalPressed: null` y no vuelve a leer flancos de rotación/hard drop).
5. Tras el bucle: `renderFrame()`, `drainEvents()` (con logging condicional de diagnóstico), `notifyState()`.

Hecho crítico para el diseño de pausa: **mientras `status === 'gameOver'`, no se llama a `readKeys()`**, por lo que cualquier `Phaser.Input.Keyboard.JustDown()` pendiente (rotación, hard drop) **no se consume** durante ese estado. Esto ya es así desde `0004` y no es un defecto introducido por esta tarea, pero esta tarea debe evitar reproducir el mismo problema para `paused`: si `paused` tampoco drenara esos flancos, una tecla pulsada durante la pausa se ejecutaría en cuanto se reanudase. La solución se detalla en §11.4.

### 4.4 Orden real de inicialización en `create()` — conflicto detectado

`create()` invoca `this.resetEngine()` **antes** de construir `this.cursors` (`apps/web/src/game/scenes/GameScene.ts:97-112`). Esta tarea necesita que `resetEngine()` arme el mecanismo de «rearme por liberación» (§11.3) leyendo el estado físico actual de las teclas (`this.cursors.left.isDown`, etc.), lo cual **no es posible si `this.cursors` todavía no existe**. Es una contradicción real entre el orden actual del código y un requisito nuevo de esta tarea, resuelta con el cambio mínimo: **reordenar `create()` para construir `this.cursors` (incluida la nueva tecla `Escape`) antes de la primera llamada a `resetEngine()`**. Ningún otro cambio de orden es necesario; el resto de `create()` (gráficos, suscripciones de lifecycle, listeners de teclado) conserva su posición relativa.

### 4.5 `consumedThisFrame`, `pendingHorizontal` y los listeners de teclado

- `pendingHorizontal: 'left' | 'right' | null` — poblado por un listener `keydown` real (filtrando `event.repeat`) suscrito una única vez en `create()` y retirado en `shutdown()`. Es completamente independiente del bucle `update()`: se actualiza en cuanto llega el evento DOM, exista o no un frame de Phaser en curso, **y exista o no pausa**. Esto significa que una pulsación de `ArrowLeft` durante la pausa deja `pendingHorizontal = 'left'` de todas formas, y si nadie lo drena antes de reanudar, se consumiría como un flanco nuevo nada más reanudar aunque el jugador ya no tenga la tecla pulsada.
- `consumedThisFrame` (banderas `horizontal`/`clockwise`/`counterclockwise`/`hardDrop`) se reinicia incondicionalmente al principio de cada `update()` (línea 191): no persiste entre frames, no requiere tratamiento especial de pausa más allá de lo que ya hace.
- El listener `keyup` (líneas 146-158) ya existe para `ArrowLeft`/`ArrowRight`/`ArrowDown`, pero hoy **solo emite un registro de diagnóstico**; no tiene ningún efecto funcional. Esta tarea reutiliza y amplía este mismo listener para limpiar el mecanismo de rearme por liberación (§11.3), en vez de crear un listener nuevo.
- `this.horizontalListeners` ya centraliza la retirada de ambos listeners (`keydown`/`keyup`) en `shutdown()`, suscrito una única vez mediante `this.events.once(...)` sobre `SHUTDOWN`/`DESTROY`. Esta tarea no necesita añadir ni retirar ningún listener adicional: todo el nuevo comportamiento (pausa, rearme) se implementa con estado interno de `GameScene` y con la tecla `Escape` ya gestionada por el mismo mecanismo `cursors`/`JustDown` que ya usan `R`, `ArrowUp`, `Z` y `Space`.

### 4.6 Adaptador temporal real

`apps/web/src/game/time-adapter.ts` expone `computeSteps(accumulator, deltaMs, fixedStepMs): [steps, newAccumulator]`, función pura ya probada (9 tests). No mantiene ningún reloj propio: el `delta` que recibe en cada `update()` proviene directamente de Phaser (tiempo real transcurrido desde el `update()` anterior). Como esta tarea decide **no usar `scene.pause()`** (§16), el bucle de Phaser sigue llamando a `update()` a ritmo normal durante toda la pausa; el `delta` que Phaser reporta en cualquier frame, incluidos los de pausa y el primero tras reanudar, es siempre el intervalo real entre frames consecutivos (típicamente ~16 ms), **nunca** la duración completa de la pausa. Esto es un hecho verificable en el código, no una suposición: no existe ninguna marca de tiempo absoluta (`performance.now()`, `Date.now()`) almacenada por el adaptador o por `GameScene` para calcular el `delta`; el único dato temporal que consume `computeSteps` es el `delta` que Phaser ya calculó internamente. Consecuencia directa: **no hay ningún «delta artificialmente grande» que gestionar al reanudar**, siempre que la capa de pausa nunca acumule ni intente recuperar el tiempo real transcurrido durante la pausa (§12).

### 4.7 `GamePresentationState` y `PhaserGameController` reales

```ts
// apps/web/src/game/types.ts (estado tras 0007)
export type GamePresentationState = Readonly<{
  status: 'running' | 'gameOver';
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
}>;

export type PhaserGameController = Readonly<{
  reset(): void;
  destroy(): void;
}>;
```

`GameCanvas.vue` es agnóstico al contenido de `PhaserGameController`: solo lo recibe de `createPhaserGame()` y lo reemite via `controllerReady` (`apps/web/src/components/GameCanvas.vue:29-40`). No necesita ningún cambio para que `PhaserGameController` gane un método nuevo.

`create-phaser-game.ts` obtiene la instancia de la escena mediante `game.scene.getScene('GameScene') as GameScene | null` y comprueba `null` antes de invocar cualquier método (`apps/web/src/game/create-phaser-game.ts:53-58`); este patrón defensivo ya existente se reutiliza para el nuevo método de pausa (§20).

`App.vue` mantiene `gameState` como único `ref` reactivo alimentado por `onStateUpdate`, un botón «Reset» que llama a `controller.reset()`, una tabla de ayuda de controles, y un banner condicionado a `gameState.status === 'gameOver'`. No existe hoy ningún overlay, ni ningún segundo botón, ni `apps/web/src/App.test.ts`.

### 4.8 Patrón de pruebas ya establecido para lógica sin Phaser real

`apps/web/src/game/time-adapter.ts`, `input-buffer.ts` y `packages/game-engine`'s `getPieceShape` son funciones puras extraídas exactamente para poder probarlas con Vitest sin arrancar Phaser ni WebGL. `GameCanvas.test.ts` monta el componente Vue real con `@vue/test-utils` y `jsdom`, mockeando únicamente `create-phaser-game.ts` (`vi.mock('../game/create-phaser-game', ...)`) para evitar instanciar `Phaser.Game`. **`GameScene` en sí misma no tiene pruebas unitarias** — confirmado también por el informe de `0004`, que documenta explícitamente esta ausencia como deuda técnica aceptada («requeriría mock complejo de Phaser o integración con navegador»). Esta tarea respeta y continúa ese mismo límite (§17, §23).

## 5. Alcance incluido

- Estado de sesión `SessionStatus = 'running' | 'paused' | 'gameOver'`, calculado con precedencia determinista (`gameOver` > `paused` > `running`), mantenido por `GameScene` y expuesto a Vue mediante `GamePresentationState.status` (§8).
- Alternancia `running ⇄ paused` mediante `Escape`, detectada por flanco (`Phaser.Input.Keyboard.JustDown`), sin efecto en `gameOver` (§9).
- Botón Vue «Pausar/Reanudar» que invoca la misma operación de sesión que `Escape`, sin duplicar reglas (§10).
- Mecanismo de neutralización y rearme de entrada por liberación de tecla (`input-release-guard.ts`), aplicado en la transición a `paused`, en la transición a `running` (tanto por reanudación como por reinicio) y en el drenaje continuo de flancos durante los frames pausados (§11).
- Tratamiento explícito del acumulador temporal: se descarta al pausar, no se recupera al reanudar, sin ráfaga de pasos (§12).
- Orden exacto, documentado y verificable, de las transiciones de pausa, reanudación, game over y reinicio (§13, §14, §15).
- Botón Vue «Reiniciar» disponible en los tres estados de sesión, reutilizando semilla y configuración (§15).
- Overlay técnico provisional en Vue («PAUSA») sobre el área del canvas, sin ocultar controles (§18).
- Ampliación mínima de `GamePresentationState.status` y de `PhaserGameController` con `togglePause()` (§19, §20).
- Reordenación mínima de `create()` para resolver el conflicto de inicialización de §4.4.
- Nuevos módulos puros y testeables: `apps/web/src/game/session-status.ts` e `apps/web/src/game/input-release-guard.ts` (§11, §19).
- Nuevo archivo de pruebas de integración `apps/web/src/App.test.ts` (§25).
- Pruebas mínimas de los módulos puros nuevos y ampliación de `types.test.ts` (§23, §24, §25).

## 6. Alcance explícitamente excluido

No pertenece a `0008` (ver también §22 para el listado exhaustivo):

- Estado `paused` dentro de `game-engine`; métodos `pause()`/`resume()` del motor; configuración de pausa en `game-config`.
- Nueva semilla al reiniciar; botón «Nueva partida»; selector de semilla; historial de reinicios.
- Modal de confirmación de reinicio; cuenta atrás al reanudar.
- Pausa automática por pérdida de foco, cambio de pestaña o visibilidad del documento (`visibilitychange`).
- Guardado de partida, persistencia de sesión, replays.
- Ghost piece, hold, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, batalla, bot, audio.
- Animaciones complejas, HUD Tactical, Industrial Dramatic definitivo, pantalla final definitiva.
- Pinia, Vue Router, backend, Playwright, CI/CD, code splitting.
- Corrección del aviso de chunk de Phaser (deuda técnica aceptada desde `0004`, se mantiene).
- Refactor general del motor o de `GameScene` ajeno a esta tarea.
- Controles táctiles, gamepad, remapeo de teclas.

## 7. Decisión: la pausa no pertenece al motor

Confirmado y cerrado (§4.1, §4.2): `game-engine` continúa exponiendo únicamente `EngineStatus = 'running' | 'gameOver'`. La pausa se implementa en la capa web dejando de invocar `engine.step()`; todo el estado interno del motor (tablero, pieza activa, DAS/ARR, lock delay, bolsa, PRNG) permanece congelado por la simple ausencia de llamadas, sin necesidad de ningún mecanismo de pausa interno. `game-config` no gana ninguna propiedad nueva. Ningún test de `packages/game-engine/src/game-engine.test.ts` se modifica por esta tarea.

## 8. Estado de sesión: `SessionStatus`

### 8.1 Nombre y ubicación del tipo

Se introduce, en `apps/web/src/game/session-status.ts` (nuevo archivo, función pura sin Phaser):

```ts
import type { EngineStatus } from '@rautfall/game-engine';

/** Estado de sesión observable por Vue: superconjunto del estado del motor con `paused`. */
export type SessionStatus = 'running' | 'paused' | 'gameOver';

/**
 * Precedencia determinista: `gameOver` (del motor) siempre prevalece sobre
 * `paused` (de la sesión web); `paused` prevalece sobre `running` cuando no
 * hay game over. No existen dos estados independientes que puedan divergir:
 * `SessionStatus` se deriva siempre de `(engineStatus, isPaused)`, nunca se
 * almacena por separado.
 */
export function computeSessionStatus(engineStatus: EngineStatus, isPaused: boolean): SessionStatus {
  if (engineStatus === 'gameOver') return 'gameOver';
  return isPaused ? 'paused' : 'running';
}

/** `Escape` y el botón de pausa solo tienen efecto mientras el motor no está en game over. */
export function canTogglePause(engineStatus: EngineStatus): boolean {
  return engineStatus !== 'gameOver';
}
```

### 8.2 Integración en `GamePresentationState`

No se añade un campo `sessionStatus` separado junto al `status` ya existente: eso crearía exactamente los «dos estados independientes susceptibles de divergir» que el enunciado prohíbe. En su lugar, se **amplía el tipo del campo `status` ya existente**, de `'running' | 'gameOver'` a `SessionStatus`:

```ts
// apps/web/src/game/types.ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
}>;
```

Este es el cambio mínimo: `GamePresentationState` conserva exactamente sus cuatro campos (ninguno nuevo), solo se ensancha el conjunto de valores válidos de uno de ellos. Todo el código que ya compara `status === 'gameOver'` (el banner de `App.vue`) sigue siendo válido sin cambios; el código nuevo compara además `status === 'paused'`.

### 8.3 Capa que mantiene el estado

`GameScene` es la única capa que mantiene el booleano `isPaused` (nuevo campo privado, inicializado a `false`), exactamente igual que ya es la única capa que mantiene `accumulator`, `pendingHorizontal` y `consumedThisFrame`. No se introduce Pinia ni ningún store: el estado de sesión vive donde ya vive todo el estado de presentación equivalente (§16 justifica por qué no se extrae a un controlador aparte).

`notifyState()` calcula el campo `status` con `computeSessionStatus(snap.status, this.isPaused)` en vez de copiar `snap.status` directamente. Esta es la única línea que cambia en `notifyState()` más allá de lo ya existente para `nextPieces` (`0007`).

### 8.4 Notificación a Vue

Sin cambios en el canal: sigue siendo el callback `onStateUpdate(state: GamePresentationState)` ya existente, invocado por `notifyState()` con la misma deduplicación por contenido ya vigente (comparación campo a campo contra `this.lastState`), ampliada para comparar también el nuevo rango de valores de `status` (la comparación `===` ya cubre esto sin cambios: `'paused' !== 'running'` se detecta igual que `'gameOver' !== 'running'` hoy).

## 9. Pausa mediante teclado: `Escape`

### 9.1 Mecanismo de detección

Se añade `esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)` al objeto `this.cursors`, exactamente con el mismo patrón ya usado para `r`, `up`, `z`, `space` (§4.5). La detección de flanco usa `Phaser.Input.Keyboard.JustDown(this.cursors.esc)`, evaluada una vez por frame real de `update()` (no por paso lógico): esto es correcto porque alternar pausa es una operación de UI de una sola vez por pulsación física, no una acción de dominio que deba repetirse por cada paso lógico recuperado en un frame con `delta` grande.

Se descarta explícitamente:
- **Listener DOM `keydown` global adicional**: ya existe un listener `keydown` para las teclas horizontales (§4.5); añadir un segundo mecanismo distinto para `Escape` introduciría dos formas distintas de detectar flancos en la misma escena sin necesidad. `JustDown` ya resuelve correctamente el flanco real (una sola vez por pulsación, sin repetición automática del navegador) para `R`, `ArrowUp`, `Z` y `Space` desde `0004`; no hay ninguna razón para tratar `Escape` de otro modo.
- **Repetición automática del navegador/teclado**: `Phaser.Input.Keyboard.JustDown` se basa en el estado interno de `Key` (marca de tiempo de la última pulsación real, gestionada por el propio Phaser), no en el evento DOM `keydown` con `repeat: true`; el auto-repeat del sistema operativo no genera nuevos flancos para `JustDown`. No se necesita ningún filtro adicional de `event.repeat` para `Escape` (a diferencia del listener DOM manual usado para las teclas horizontales, que sí necesita ese filtro porque no usa `JustDown`).

### 9.2 Reglas de efecto

- Con el motor en `running` (`engineStatus !== 'gameOver'`): `JustDown(esc)` invoca `this.togglePause()` (§13), que alterna `isPaused`.
- Con el motor en `gameOver`: `JustDown(esc)` se **consume** (se lee, drenando el flanco interno de Phaser) pero no produce ningún cambio de estado. Esto evita que una pulsación de `Escape` justo antes o durante el `gameOver` quede pendiente y se interprete como un flanco nuevo en el primer frame tras un reinicio posterior.
- El evento no llega nunca al motor: no se construye ningún `StepInput` a partir de `Escape`, no se añade ninguna propiedad de pausa a `StepInput`, y `Escape` no se mezcla con la construcción de `buildStepInput`/`KeyState` en ningún punto.
- Mantener pulsada `Escape` no alterna varias veces: `JustDown` solo es verdadero en el frame de la transición físisca de liberado→pulsado; el resto de frames con la tecla mantenida, `JustDown` devuelve `false` (comportamiento nativo de Phaser, idéntico al ya validado para `R` desde `0004`).

## 10. Botón de pausa y reanudación en Vue

Se añade en `apps/web/src/App.vue`, junto al botón «Reset» ya existente dentro de `.actions`:

```html
<button type="button" :disabled="gameState.status === 'gameOver'" @click="doTogglePause">
  {{ gameState.status === 'paused' ? 'Reanudar' : 'Pausar' }}
</button>
```

```ts
function doTogglePause(): void {
  controller?.togglePause();
}
```

Reglas:

- El texto cambia según `gameState.status`: «Pausar» mientras no está pausado (incluye `running`; también se muestra «Pausar» —nunca «Reanudar»— durante `gameOver`, para no sugerir una reanudación real que no existe), «Reanudar» exactamente cuando `status === 'paused'`.
- El botón se deshabilita (`disabled`) durante `gameOver`: no ofrece una reanudación falsa y no es interactuable, aunque sigue siendo un elemento `<button>` semántico y accesible (foco/tab, lectura por lector de pantalla vía `disabled`).
- El botón invoca `controller.togglePause()`, que delega en `GameScene.togglePause()` (§13, §20): **la misma operación exacta** que ejecuta la rama de `Escape` en `update()`. No existe ninguna lógica de pausa duplicada en Vue: el componente solo reenvía la intención.
- No se añaden atajos de teclado adicionales para el botón (por ejemplo, `Enter` sobre el botón ya funciona de forma nativa por ser un `<button>`; no se cablea nada extra).

## 11. Neutralización de entrada al pausar y rearme al reanudar

### 11.1 Inventario exacto de estructuras a limpiar (inspección de §4.2/§4.5)

| Estructura | Ubicación | Tratamiento |
| --- | --- | --- |
| `horizontalState` (`priority`, `accumulatorMs`, `hasReachedDas`) | Interna al motor, no accesible desde fuera | No se toca directamente (no se puede); se neutraliza indirectamente forzando `leftHeld`/`rightHeld` a `false` en el primer `StepInput` real tras la transición, lo que dispara la propia lógica de limpieza del motor (`clearPriority()`, rama 3/4 de `processHorizontal`) sin mutación externa. |
| `pendingHorizontal` (`GameScene`) | Privado a `GameScene` | Se pone a `null` en el instante de pausar y en el instante de reanudar/reiniciar; además se drena en cada frame pausado (§11.4). |
| `leftHeld`/`rightHeld` reales (`cursors.left/right.isDown`) | Estado físico de Phaser `Key`, no almacenado | No se puede «limpiar» (refleja hardware); se **enmascara** mediante el guardián de liberación (§11.3) mientras la tecla siga físicamente pulsada desde antes de la transición. |
| `softDropHeld` real (`cursors.down.isDown`) | Idéntico al anterior | Mismo tratamiento que `leftHeld`/`rightHeld` (§11.3). |
| Rotación horaria/antihoraria pendiente (`JustDown(up)`/`JustDown(z)`) | Estado interno de `Phaser.Input.Keyboard.Key`, edge-triggered | No hay estado persistente que limpiar entre pasos (ya se consume en el mismo frame en que se lee, desde `0004`); solo hay que **drenarlo** si quedó sin leer durante la pausa (§11.4), para que no se interprete como flanco nuevo al reanudar. |
| Hard drop pendiente (`JustDown(space)`) | Igual que rotación | Igual tratamiento: drenaje, no persistencia. |
| `consumedThisFrame` | Privado a `GameScene` | Ya se reinicia incondicionalmente al principio de cada `update()` (comportamiento existente desde la corrección de `0004`); no requiere cambio. |
| `verticalProgress`, `lockDelayElapsedMs`, `lockResetsUsed` | Internos al motor | Se congelan automáticamente por la ausencia de `step()` durante la pausa; no requieren ninguna acción de la capa web. |
| Cola de eventos del motor (`eventQueue`) | Interna al motor | No crece durante la pausa (no hay `step()`); `drainEvents()` seguirá devolviendo vacío en cada frame pausado, sin necesidad de tratamiento especial. |

### 11.2 Módulo `input-release-guard.ts` (nuevo, función pura)

```ts
// apps/web/src/game/input-release-guard.ts
export type ReleaseGuardKey = 'left' | 'right' | 'softDrop';

/** Bandera por tecla: true mientras la tecla debe ignorarse hasta observar su keyup real. */
export type ReleaseGuard = Readonly<{
  left: boolean;
  right: boolean;
  softDrop: boolean;
}>;

export const NO_RELEASE_GUARD: ReleaseGuard = Object.freeze({ left: false, right: false, softDrop: false });

/** Arma el guardián a partir del estado físico ("isDown") observado en el instante de la transición. */
export function armReleaseGuard(currentlyHeld: { left: boolean; right: boolean; softDrop: boolean }): ReleaseGuard {
  return Object.freeze({ ...currentlyHeld });
}

/** Limpia la bandera de una tecla concreta (se invoca desde el listener real de `keyup`). */
export function clearReleaseGuardKey(guard: ReleaseGuard, key: ReleaseGuardKey): ReleaseGuard {
  if (!guard[key]) return guard;
  return Object.freeze({ ...guard, [key]: false });
}

/** Valor efectivo de "held" que debe llegar al motor: `false` mientras la tecla esté bloqueada. */
export function resolveHeld(guard: ReleaseGuard, key: ReleaseGuardKey, isDown: boolean): boolean {
  return guard[key] ? false : isDown;
}
```

Es una función pura sin Phaser, sin motor, sin DOM: recibe y devuelve datos planos. Se prueba de forma aislada (§24).

### 11.3 Cuándo se arma y se limpia el guardián

- **Al pausar**: no es necesario armar el guardián (no hay ningún `step()` que ejecutar mientras `isPaused === true`; la protección solo importa en el momento de volver a `step()`).
- **Al reanudar** (`togglePause()` pasando de `paused` a `running`) y **al reiniciar** (`resetEngine()`, tanto la primera vez en `create()` como en cualquier reset posterior): se arma el guardián con el estado físico exacto de las teclas en ese instante:

  ```ts
  this.releaseGuard = armReleaseGuard({
    left: this.cursors.left.isDown,
    right: this.cursors.right.isDown,
    softDrop: this.cursors.down.isDown,
  });
  ```

  Si una tecla no está pulsada en ese instante, su bandera queda `false` y no tiene ningún efecto (una pulsación futura funciona con normalidad). Si está pulsada, su bandera queda `true` y el motor recibirá `false` para esa tecla hasta que se observe su liberación real.

- **Liberación real**: el listener `keyup` ya existente (§4.5), ampliado:

  ```ts
  const onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'ArrowLeft') this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'left');
    if (event.code === 'ArrowRight') this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'right');
    if (event.code === 'ArrowDown') this.releaseGuard = clearReleaseGuardKey(this.releaseGuard, 'softDrop');
    // ... logDebug ya existente, sin cambios de forma ...
  };
  ```

  En cuanto el jugador suelta físicamente la tecla, su bandera se limpia; una pulsación posterior (incluso inmediata) se trata como flanco legítimo nuevo, exactamente lo que exige «soltar y volver a pulsar».

- `readKeys()` y `emptyInput()` (los dos puntos donde `GameScene` construye un `KeyState` a partir de `this.cursors`) aplican `resolveHeld(this.releaseGuard, key, cursors.X.isDown)` en vez de leer `isDown` directamente para `left`, `right` y `softDrop`. Rotación, hard drop y reset no necesitan guardián: son edge-triggered y ya se resuelven por drenaje (§11.4).

- Por qué esto basta para el requisito de DAS/ARR (§4.2): mientras el guardián bloquea `left`/`right`, `processHorizontal` recibe `leftHeld: false`/`rightHeld: false` aunque la tecla siga físicamente pulsada. Si `horizontalState.priority` seguía activo desde antes de la transición, la propia rama 3/4 del motor (`priority === 'left' && !leftHeld` → `clearPriority()`) lo limpia de forma natural en ese primer paso, sin mover la pieza y sin que la capa web tenga que tocar el estado interno del motor. Ninguna acción nueva se genera hasta que el jugador suelte y vuelva a pulsar.

### 11.4 Drenaje durante los frames pausados

Mientras `isPaused === true`, `GameScene.update()` sigue llamando a `this.readKeys()` una vez por frame **y descarta el resultado** (no lo pasa a `buildStepInput` ni a `engine.step()`). Esto consume, en cada frame real:

- `this.pendingHorizontal`, que `readKeys()` ya vacía como efecto colateral tras leerlo;
- los flancos `JustDown` de `up`, `z`, `space` (Phaser los marca como leídos al invocar `JustDown`, y no vuelven a dispararse hasta la siguiente pulsación física real).

De este modo, cualquier tecla pulsada mientras la partida está pausada queda drenada frame a frame y no se acumula ni se reproduce al reanudar. No se necesita ningún buffer ni cola adicional: drenar y descartar en cada frame pausado es suficiente y es el cambio mínimo (reutiliza `readKeys()` tal cual, sin crear un método nuevo).

`togglePause()` también invoca `this.readKeys()` (descartando el resultado) en el instante exacto de pausar y en el instante exacto de reanudar, para cubrir el frame de la propia transición sin depender de que el siguiente `update()` lo haga primero.

## 12. Acumulador temporal y frame de transición

- **Al pausar**: `this.accumulator = 0`. Cualquier fracción de paso pendiente en el momento de pausar se descarta; no se conserva para aplicarla al reanudar.
- **Mientras está pausado**: `computeSteps()` no se invoca en absoluto (el bucle de pasos lógicos de `update()` no se ejecuta); el acumulador permanece en `0` durante toda la pausa, sin importar cuánto dure en tiempo real.
- **Al reanudar**: `this.accumulator = 0` de nuevo (defensivo; ya vale `0` desde que se pausó, pero se reafirma explícitamente en `togglePause()` para que la operación sea autocontenida y no dependa de invariantes externas).
- **Referencia de tiempo real**: tal como se documenta en §4.6, el adaptador no mantiene ninguna marca de tiempo absoluta propia; consume directamente el `delta` que Phaser calcula internamente entre `update()` consecutivos. Como esta tarea decide no usar `scene.pause()`/`game.pause()` (§16), Phaser sigue invocando `update()` a ritmo normal durante la pausa, de modo que el `delta` del primer frame tras reanudar es el intervalo real desde el frame anterior (típicamente ~16 ms), **nunca** la duración de la pausa. No hay ninguna «referencia de tiempo real» adicional que reiniciar más allá de poner el acumulador a `0`: no existe otro estado temporal que limpiar.
- **Consecuencia**: no hay catch-up, no hay ráfaga de pasos, y el primer frame tras reanudar ejecuta como máximo los mismos 0–1 pasos lógicos que ejecutaría cualquier frame normal a la misma tasa de refresco, porque el acumulador parte de `0` y el `delta` es el de un frame ordinario.
- **Corte del frame de transición**: no es necesario "cortar" nada a media ejecución, porque la comprobación de `Escape`/pausa ocurre **antes** de cualquier llamada a `computeSteps()`/`engine.step()` dentro del mismo `update()` (§13): al pausar, el bucle de pasos ni siquiera llega a evaluarse ese frame; al reanudar, el bucle se evalúa con acumulador `0` y `delta` normal, sin resto de ningún tipo pendiente de un frame anterior.

## 13. Orden exacto de la transición de pausa/reanudación

### 13.1 `GameScene.togglePause()` (nuevo método público)

```ts
togglePause(): void {
  const engineStatus = this.engine.getSnapshot().status;
  if (!canTogglePause(engineStatus)) return; // 1. no-op durante gameOver

  this.isPaused = !this.isPaused;             // 2. cambiar estado de sesión

  this.pendingHorizontal = null;              // 3. limpiar entrada pendiente
  this.readKeys();                            // 3. drenar flancos residuales del instante de la transición

  if (this.isPaused) {
    this.accumulator = 0;                     // 4. limpiar acumulador temporal
    logDebug({ source: 'lifecycle', event: 'pause' });
  } else {
    this.releaseGuard = armReleaseGuard({      // arma el rearme por liberación (§11.3)
      left: this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      softDrop: this.cursors.down.isDown,
    });
    this.accumulator = 0;                     // establecer la nueva referencia temporal (§12)
    logDebug({ source: 'lifecycle', event: 'resume' });
  }

  this.renderFrame();                         // notificar el nuevo estado (render inmediato)
  this.notifyState();                         // 6. notificar el nuevo estado a Vue
}
```

Este método es la **única** implementación de la operación de alternar pausa: tanto la rama de `Escape` dentro de `update()` como `PhaserGameController.togglePause()` (invocado por el botón Vue) llaman exactamente a este método, sin ninguna lógica adicional en ninguno de los dos sitios de invocación. Esto satisface literalmente «no duplicar reglas entre teclado y botón» (§10).

Orden observable, tal como exige el enunciado:

**Al pausar**, como mínimo: (1) detectar solicitud (`JustDown(esc)` o clic del botón) → (2) cambiar estado de sesión a `paused` → (3) limpiar entrada pendiente y mantenida (mediante drenaje; el mantenimiento físico se neutraliza en la siguiente transición a `running`, no aquí, porque mientras se permanece en pausa no hay ningún `step()` al que proteger) → (4) limpiar acumulador temporal → (5) impedir nuevas llamadas a `engine.step()` (se logra en `update()`, §13.2, no llamando al bucle de pasos mientras `isPaused`) → (6) notificar el nuevo estado a Vue.

**Al reanudar**, como mínimo: (1) detectar solicitud → (2) limpiar de nuevo entrada y acumulador temporal → (3) establecer la nueva referencia temporal (acumulador a `0`; no existe otra referencia que fijar, §12) y armar el rearme por liberación → (4) cambiar estado de sesión a `running` → (5) notificar a Vue → (6) no ejecutar pasos atrasados en esa misma transición (se logra por construcción: acumulador `0` + `delta` normal de Phaser, §12).

El orden interno exacto entre los pasos 2-3-4 dentro de `togglePause()` (mostrado arriba) es una implementación válida de esa secuencia observable; es aceptable reordenar ligeramente sub-pasos no observables (por ejemplo, armar el guardián antes o después de poner el acumulador a `0`) siempre que el resultado final coincida: sesión en el estado correcto, entrada neutralizada, acumulador en `0`, Vue notificada exactamente una vez con el estado final.

### 13.2 Orden dentro de `update()`

```ts
update(_time: number, delta: number): void {
  this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };

  if (Phaser.Input.Keyboard.JustDown(this.cursors.r)) {
    this.resetGame();
    return;
  }

  const engineStatus = this.engine.getSnapshot().status;

  if (engineStatus === 'gameOver') {
    if (this.isPaused) this.isPaused = false;              // precedencia defensiva (§14)
    Phaser.Input.Keyboard.JustDown(this.cursors.esc);       // drenar sin efecto
    this.renderFrame();
    this.engine.drainEvents();
    this.notifyState();
    return;
  }

  if (Phaser.Input.Keyboard.JustDown(this.cursors.esc)) {
    this.togglePause();
    return;
  }

  if (this.isPaused) {
    this.readKeys();               // drenar entrada durante la pausa (§11.4)
    this.renderFrame();
    this.notifyState();
    return;
  }

  // ... bucle de pasos lógicos existente desde 0004/0005/0006, sin cambios de orden,
  // salvo que readKeys()/emptyInput() ahora aplican resolveHeld() con this.releaseGuard ...
}
```

`R` conserva la prioridad máxima ya vigente desde `0004` (funciona en cualquier estado, incluida la pausa: §15). La comprobación de `gameOver` precede a la de `Escape`, de modo que un `gameOver` ya vigente nunca compite con un flanco de pausa: `Escape` solo se evalúa cuando el motor no está en `gameOver`. El bucle de pasos lógicos original no se toca salvo por la fuente de `leftHeld`/`rightHeld`/`softDropHeld` dentro de `readKeys()`/`emptyInput()` (§11.3).

## 14. Game over y precedencia sobre pausa

- `computeSessionStatus` hace que `gameOver` prevalezca sobre `paused` de forma pura e incondicional (§8.1): si el motor está en `gameOver`, el `SessionStatus` presentado es siempre `'gameOver'`, exista o no `isPaused === true` en ese instante.
- Defensa adicional en `update()` (§13.2): en cuanto se detecta `engineStatus === 'gameOver'`, `isPaused` se fuerza a `false` inmediatamente. Esto es puramente defensivo: dado que ningún `step()` se ejecuta mientras `isPaused === true` (§7), y `gameOver` solo puede producirse dentro de `step()`, no existe ningún camino real por el que el motor entre en `gameOver` mientras `isPaused` sea `true` en el mismo `GameScene`. La comprobación se mantiene de todos modos para blindar el invariante ante cualquier reordenación futura del código y para dejar sin ambigüedad el criterio de precedencia exigido.
- Colisión en el mismo frame lógico: como `Escape` se comprueba **antes** de cualquier `step()` dentro de `update()` (§13.2), un `Escape` detectado en un frame en el que el motor todavía está `running` simplemente pausa la partida ese frame (el bucle de pasos no llega a ejecutarse, por lo que ese frame no puede producir `gameOver`). Un `gameOver` producido en un frame anterior siempre es visible en el frame siguiente antes de evaluar `Escape` (la comprobación de `gameOver` precede a la de `Escape` en el propio `update()`). No existe, por tanto, ningún frame en el que ambos eventos compitan de verdad; la regla «`gameOver` prevalece sobre `paused`» queda garantizada tanto por construcción del orden como por la defensa explícita del párrafo anterior.
- `Escape` no cambia un `gameOver`: cubierto por §9.2 y por la rama dedicada de `update()` que ni siquiera evalúa `togglePause()` mientras `engineStatus === 'gameOver'`.
- El botón de pausa/reanudación se deshabilita durante `gameOver` (§10); el botón de reinicio permanece disponible (§15, §17).
- No se añade ninguna pantalla final definitiva: el único indicador de `gameOver` sigue siendo el banner técnico ya existente desde `0002`/`0004` (`.game-over-banner` en `App.vue`), sin cambios de contenido ni de estilo en esta tarea.

## 15. Reinicio

### 15.1 Contrato

El botón «Reiniciar» y la tecla `R` invocan la misma operación ya existente desde `0004` (`PhaserGameController.reset()` → `GameScene.resetGame()` → `resetEngine()`), ampliada en esta tarea para neutralizar también la sesión:

```ts
private resetEngine(): void {
  this.engine = createGameEngine({ seed: FIXED_SEED, config: prototypeConfig });
  this.engine.drainEvents();
  this.accumulator = 0;
  this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
  this.pendingHorizontal = null;
  this.isPaused = false;                       // el reinicio siempre deja la sesión en running
  this.releaseGuard = armReleaseGuard({
    left: this.cursors.left.isDown,
    right: this.cursors.right.isDown,
    softDrop: this.cursors.down.isDown,
  });
  this.readKeys();                             // drena cualquier flanco pendiente antes del reinicio
  logDebug({ source: 'lifecycle', event: 'reset – engine' });
}
```

(`resetGame()`, invocado por el controlador y por `JustDown(r)`, sigue llamando a `resetEngine()` y a `notifyState()` exactamente igual que hoy; no hay cambios de forma en `resetGame()` más allá de heredar el nuevo comportamiento de `resetEngine()`.)

- Funciona desde `running`, `paused` y `gameOver` (ya era así desde `0004` para `running`/`gameOver`; esta tarea añade `paused` por construcción, ya que el reinicio no comprueba `isPaused` en ningún punto antes de proceder).
- Conserva la semilla actual (`FIXED_SEED`, constante ya existente) y reutiliza `prototypeConfig`: no se crea una semilla nueva, no se cambia la configuración.
- Llama al `reset()`/`createGameEngine()` público del motor tal como ya hace hoy; esta tarea no modifica ese contrato ni `EngineOptions`.
- No recrea Phaser ni la escena: `resetEngine()` sigue operando sobre la instancia y la escena ya existentes.

### 15.2 Estado resultante (heredado íntegro de `0002`/`0005`/`0006`/`0007`, sin cambios de motor)

Tras reiniciar: estado de sesión `running`; motor en estado inicial; `step = 0`; `elapsedMs = 0`; tablero vacío; misma pieza activa inicial y mismas tres próximas piezas para la semilla fija; `clearedLines = 0`; lock delay, DAS/ARR, gravedad y soft drop reiniciados (todo esto ya es responsabilidad exclusiva de `createGameEngine`/`reset()`, sin cambios en esta tarea); entrada neutralizada (nuevo en esta tarea, §15.1); acumulador temporal limpio; referencia de tiempo real renovada (§12); presentación actualizada inmediatamente mediante la llamada a `notifyState()` ya existente en `resetGame()`.

## 16. Reinicio y eventos

Se mantiene íntegro el contrato ya vigente desde `0002`/`0007`: `reset()` del motor emite exactamente `engineReset`, no emite `engineStarted` ni `pieceSpawned`. Esta tarea no modifica `GameEvent` ni la lógica de emisión del motor.

`resetEngine()` ya llama a `this.engine.drainEvents()` inmediatamente después de crear el motor (línea ya existente desde `0004`, conservada sin cambios), consumiendo el `engineStarted`/`engineReset` inicial en el mismo ciclo del reinicio, antes de que `update()` vuelva a drenar eventos en el siguiente frame normal. Esta tarea no introduce un segundo flujo de reset ni un doble drenaje: el mismo punto de drenaje ya existente sigue siendo el único. `notifyState()`, llamada al final de `resetGame()`, actualiza snapshot y estado de presentación (incluido `nextPieces` y el nuevo `status` derivado) de forma inmediata, sin esperar al siguiente `update()` del bucle de Phaser. El diagnóstico opt-in (`input-debug.ts`) permanece estable: no se modifica su condición de activación ni su prefijo.

## 17. Botón de reinicio

Se conserva el botón «Reset» ya existente en `App.vue` (`apps/web/src/App.vue:61`), renombrado a «Reiniciar» para alinear el texto con el resto de esta especificación en castellano (cambio puramente textual, sin cambio de comportamiento):

```html
<button type="button" @click="doReset">Reiniciar</button>
```

- Sin modal de confirmación, sin deshacer: reinicia inmediatamente al pulsarlo, igual que hoy.
- Disponible durante `running`, `paused` y `gameOver`: no se añade ningún `:disabled` a este botón (a diferencia del de pausa/reanudación).
- No se añade «Nueva partida» con semilla distinta, ni selector de semilla, ni historial de reinicios.

## 18. Overlay técnico provisional

### 18.1 Decisión: Vue, no Phaser

Se adopta **Vue + CSS** para el overlay de pausa, por los mismos criterios ya aplicados y documentados en `0007` §20 para la preview de próximas piezas (coherencia con «Responsabilidades de Vue» en `docs/rautfall.md`, mínima complejidad, ausencia de duplicación, testabilidad con `@vue/test-utils`/`jsdom`, accesibilidad básica con HTML nativo, facilidad de sustitución futura por el HUD Tactical definitivo). Phaser sigue representando exclusivamente el tablero (§4.7, sin cambios de responsabilidad).

No se aparta de esta preferencia porque no existe ninguna razón técnica real que lo justifique: `GameScene` no necesita dibujar texto de overlay (ya delega todo el texto e indicadores de estado a Vue desde `0004`), y crear el overlay en Phaser obligaría a mezclar texto renderizado por `Graphics`/`Text` de Phaser con el resto de la interfaz ya construida en Vue/CSS, sin ninguna ventaja.

### 18.2 Implementación

En `apps/web/src/App.vue`, dentro de `.canvas-wrapper` (que gana `position: relative` en su CSS), junto a `<GameCanvas>`:

```html
<div class="canvas-wrapper">
  <GameCanvas :on-state-update="onStateUpdate" @controller-ready="onControllerReady" />
  <div v-if="gameState.status === 'paused'" class="pause-overlay" role="status" aria-live="polite">
    PAUSA
  </div>
</div>
```

```css
.canvas-wrapper {
  flex-shrink: 0;
  position: relative;
}

.pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 20, 0.6);
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: bold;
  letter-spacing: 0.2em;
  pointer-events: none;
}
```

- `pointer-events: none` asegura que el overlay nunca bloquea nada (el canvas no necesita ratón para jugar, y los botones de pausa/reinicio están fuera de `.canvas-wrapper`, en `.info-panel`), cumpliendo «permitir usar el botón de reanudación y reinicio».
- No oculta permanentemente la interfaz: solo se superpone al área del canvas, y únicamente mientras `status === 'paused'`.
- No se construye el layout Tactical definitivo, ni efectos visuales avanzados, ni audio, ni animaciones complejas, ni la estética Industrial Dramatic definitiva: es texto estático con un fondo semitransparente, coherente con el resto de la interfaz técnica provisional ya existente (`.info-item`, `.game-over-banner`).
- No se requiere ningún overlay adicional para `gameOver`: el banner técnico ya existente (`.game-over-banner`, sin cambios) cumple ya ese papel; esta tarea no lo convierte en una pantalla de resultados completa.

## 19. Estado presentado a Vue: resumen de cambios en `GamePresentationState`

```ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;              // ← ensanchado: antes 'running' | 'gameOver'
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
}>;
```

No se incorporan preventivamente: duplicado del snapshot del motor, referencias al motor, acumuladores temporales, input interno, flags de Phaser, lógica de dominio, estado de modal, ni información visual derivable (por ejemplo, no se añade un campo `isPauseButtonDisabled`: Vue lo calcula directamente de `status === 'gameOver'`, exactamente igual que ya deriva el texto del botón y la visibilidad del overlay a partir del mismo campo). La presentación sigue recibiendo exactamente lo mismo que antes (próximas piezas, paso, tiempo lógico) más el ensanchamiento mínimo de `status` ya descrito.

## 20. Canal de comandos Vue → Phaser: `PhaserGameController`

```ts
export type PhaserGameController = Readonly<{
  reset(): void;
  togglePause(): void;   // ← nuevo
  destroy(): void;
}>;
```

En `create-phaser-game.ts`, siguiendo exactamente el mismo patrón defensivo ya usado por `reset()`:

```ts
return {
  reset(): void {
    const scene = game.scene.getScene('GameScene') as GameScene | null;
    if (scene) scene.resetGame();
  },
  togglePause(): void {
    const scene = game.scene.getScene('GameScene') as GameScene | null;
    if (scene) scene.togglePause();
  },
  destroy(): void {
    game.destroy(true);
  },
};
```

### Alternativas evaluadas

- **Ampliar el objeto/callback existente de `GameCanvas` (elegida)**: `PhaserGameController` ya es exactamente el mecanismo mínimo por el que Vue le pide operaciones a Phaser (`reset()` desde `0004`); añadirle un método más (`togglePause()`) es el cambio de menor superficie, reutiliza el patrón defensivo ya probado, y no requiere tocar `GameCanvas.vue` en absoluto (que ya reenvía el controlador completo a `App.vue` sin conocer su forma exacta).
- **Bus de eventos genérico / Pinia / referencias de componente explícitas hacia `GameScene`**: descartadas explícitamente por el enunciado y por `AGENTS.md` (no anticipar arquitectura, no introducir Pinia sin necesidad demostrada). No hay ninguna necesidad real que un objeto de tres métodos no resuelva ya.
- **Nuevos eventos tipados Vue→Phaser (por ejemplo, `emit('pause-requested')` desde `GameCanvas.vue` hacia arriba y una prop de comando hacia abajo)**: añadiría una capa de indirección sin beneficio, ya que `GameCanvas.vue` no necesita saber nada sobre pausa: el controlador ya fluye de Phaser hacia Vue (`controllerReady`) y los comandos fluyen de Vue hacia Phaser exactamente por el mismo objeto, en la dirección contraria, sin necesidad de un canal de eventos adicional.

No se introduce ningún bus de eventos global, ninguna dependencia de Pinia, ningún acceso de Vue al motor, ninguna mutación directa de `GameScene`, ni ninguna búsqueda de la escena mediante APIs globales de Phaser desde `App.vue` (siempre pasa por el `PhaserGameController` ya intermediado por `create-phaser-game.ts`).

## 21. `GameScene` frente a `GameSessionController`: decisión

### Alternativas

**A. Mantener pausa, tiempo, entrada y reset en `GameScene` mediante campos y métodos privados pequeños** (`isPaused`, `releaseGuard`, `togglePause()`), delegando la lógica de decisión pura a `session-status.ts` e `input-release-guard.ts`.

**B. Extraer un `GameSessionController` explícito** que envuelva el motor, el acumulador, el guardián de entrada y el estado de pausa, y que `GameScene` solo orqueste.

### Decisión: A, con extracción de las dos piezas de lógica pura ya descritas

Justificación, aplicando los criterios que el propio enunciado exige verificar:

- **Responsabilidad coherente**: `GameScene` ya es, desde `0004`, la única responsable de traducir tiempo real y teclado en llamadas al motor y en snapshots renderizados; pausar/reanudar/reiniciar son variaciones de esa misma responsabilidad («¿debo llamar a `step()` este frame, y con qué entrada?»), no una responsabilidad nueva y separable.
- **Estado con comportamiento propio**: el único estado verdaderamente nuevo (`isPaused`, `releaseGuard`) está indisolublemente ligado a los campos que `GameScene` ya posee en privado (`accumulator`, `pendingHorizontal`, `cursors`, `consumedThisFrame`); extraerlo a una clase aparte obligaría a exponer esos campos privados existentes (o a duplicarlos), lo cual es estrictamente peor que mantenerlos juntos.
- **Pruebas más simples**: la extracción de la lógica de decisión pura (`computeSessionStatus`, `canTogglePause`, `armReleaseGuard`, `clearReleaseGuardKey`, `resolveHeld`) ya proporciona los puntos testeables sin Phaser que un `GameSessionController` prometería; envolverlos en una clase adicional no añade ninguna prueba nueva posible, solo ceremonia.
- **Evita duplicación**: no hay ninguna otra escena ni ningún otro consumidor de esta lógica; `GameScene` es la única escena de la aplicación (decisión ya cerrada desde `0004`, sin cambios).
- **Dependencia explícita del motor y adaptadores**: ya existe (`this.engine`, `computeSteps`, `buildStepInput`); un controlador nuevo tendría que recibir exactamente las mismas dependencias, sin ganar nada.
- **No crea una capa sin valor**: un `GameSessionController` en este punto sería, literalmemte, un objeto con `isPaused` y tres métodos delgados que llaman a las mismas funciones puras que `GameScene` ya puede llamar directamente — la definición de capa ceremonial que `AGENTS.md` pide evitar.

Se documenta explícitamente, como pide el enunciado: la decisión es **A**, sin interfaces artificiales ni contenedores de dependencias, apoyada en la extracción de dos módulos puros y pequeños (`session-status.ts`, `input-release-guard.ts`) que ya cubren toda la lógica de decisión no trivial.

## 22. Lifecycle de Phaser

### Decisión: no usar `Scene.pause()`

Se descarta explícitamente usar `this.scene.pause()` (o `game.pause()`) para implementar la pausa de sesión, por las razones que el propio enunciado anticipa y que la inspección confirma:

- `Scene.pause()` detiene la invocación de `update()` por completo. Esto impediría que la propia escena siguiera escuchando `Escape` para la reanudación (el mecanismo de detección vive dentro de `update()`, §9.1), obligando a un mecanismo de entrada completamente distinto y externo solo para poder salir de la pausa — complejidad innecesaria frente a simplemente no llamar a `engine.step()` dentro de un `update()` que sigue ejecutándose con normalidad.
- Detener el lifecycle de Phaser también complicaría la recepción de comandos desde Vue (`togglePause()`/`reset()` necesitan que la escena exista y pueda reaccionar) y el renderizado continuo del overlay externo (aunque el overlay es de Vue, el canvas de Phaser con el tablero congelado debe seguir visible y renderizado detrás de él).
- No se oculta el canvas ni se destruye la escena al pausar: el tablero permanece visible (congelado) exactamente como pide el enunciado («comprobar que la pieza queda completamente congelada»), lo cual requiere que `renderFrame()` se siga invocando (con el mismo snapshot, sin cambios) en cada frame pausado.

En consecuencia: la «pausa» de esta tarea es un concepto puramente de `GameScene` (no llamar a `engine.step()` mientras `isPaused === true`), nunca una pausa del propio lifecycle de Phaser. La escena permanece activa durante toda la partida, incluida la pausa, exactamente como ya lo está durante `gameOver` desde `0004` (que tampoco detiene el lifecycle de Phaser, solo deja de llamar a `step()`).

## 23. Reinicio de estructuras de input: confirmación de cobertura completa

Repasando el listado del enunciado contra la inspección real (§4, §11):

- `InputBuffer`/`input-buffer.ts`: es una función pura sin estado propio (`buildStepInput`); no tiene nada que "reiniciar" — recibe siempre el estado externo (`KeyState`, banderas `consumed`) como parámetros. No requiere cambios.
- `pendingHorizontal`: cubierto en §11.1/§11.4.
- Direcciones mantenidas (`leftHeld`/`rightHeld`/`softDropHeld`): cubiertas por el guardián de liberación (§11.3).
- Listeners de `keydown`/`keyup`: no se duplican; se reutilizan los ya existentes, ampliando su cuerpo (§11.3) sin registrar ninguna suscripción adicional. `this.horizontalListeners` sigue siendo el único punto de retirada, sin cambios de forma.
- Banderas de flanco (`consumedThisFrame`): ya se reinician cada frame (sin cambios).
- Estados de rearme: el nuevo `releaseGuard` es precisamente el estado de rearme que introduce esta tarea (§11.2/§11.3).
- `consumedThisFrame`: cubierto arriba.
- Datos usados por `inputDebug`: no cambian de forma; se añaden dos eventos de `lifecycle` nuevos (`'pause'`, `'resume'`), reutilizando el tipo `InputDebugLifecycleEvent` ya existente sin modificarlo (§24).

No se duplican listeners al reiniciar: `resetEngine()` no toca ningún listener de teclado (los listeners se registran una única vez en `create()` y se retiran una única vez en `shutdown()`, ciclo de vida ya establecido desde `0004` y no alterado por esta tarea). No quedan callbacks `once` registrados repetidamente: las únicas suscripciones `once` (`SHUTDOWN`/`DESTROY` → `shutdown`) ya existen y no se tocan.

## 24. Diagnóstico de entrada (`input-debug.ts`)

No se modifica el tipo `DebugLogEntry` ni sus variantes existentes. Se reutiliza `InputDebugLifecycleEvent` (`{ source: 'lifecycle'; event: string; detail?: string }`, ya definido de forma genérica) para dos eventos discretos nuevos:

- `logDebug({ source: 'lifecycle', event: 'pause' })` — emitido una vez, exactamente en la transición a `paused` dentro de `togglePause()`.
- `logDebug({ source: 'lifecycle', event: 'resume' })` — emitido una vez, exactamente en la transición a `running` (por reanudación) dentro de `togglePause()`.

No se añade ninguna fuente nueva de diagnóstico (se reutiliza `'lifecycle'`, ya usada para `create`, `shutdown` y las dos variantes de `reset`). No se registra ningún log por cada frame pausado (los frames de drenaje durante la pausa no generan ninguna entrada de diagnóstico: `readKeys()` descartado no invoca `logDebug` para ese propósito). No se añade ruido de teclas ignoradas durante la pausa: no es imprescindible para depuración (el estado `paused` ya es observable en Vue y en el propio evento `'pause'`/`'resume'`), y el enunciado solo lo permite si fuese imprescindible.

`isInputDebugActive()`, la condición de activación (`?inputDebug=1` + `import.meta.env.DEV`) y el prefijo `[Rautfall input]` no cambian.

## 25. Estrategia de pruebas

### 25.1 Módulos puros nuevos (TDD directo, sin Phaser)

`apps/web/src/game/session-status.test.ts` (nuevo):

- `computeSessionStatus('gameOver', false)` → `'gameOver'`.
- `computeSessionStatus('gameOver', true)` → `'gameOver'` (precedencia: game over prevalece sobre pausa incluso si `isPaused` quedara `true` por error).
- `computeSessionStatus('running', true)` → `'paused'`.
- `computeSessionStatus('running', false)` → `'running'`.
- `canTogglePause('running')` → `true`.
- `canTogglePause('gameOver')` → `false`.

`apps/web/src/game/input-release-guard.test.ts` (nuevo):

- `armReleaseGuard({ left: true, right: false, softDrop: false })` produce un guardián con `left: true` y el resto `false`.
- `resolveHeld(guard, 'left', true)` con `guard.left = true` → `false` (bloqueado aunque `isDown` sea `true`).
- `resolveHeld(guard, 'left', true)` con `guard.left = false` → `true` (sin bloqueo, refleja el estado real).
- `resolveHeld(NO_RELEASE_GUARD, 'right', false)` → `false`.
- `clearReleaseGuardKey(guard, 'left')` con `guard.left = true` limpia solo esa tecla, conservando las demás intactas.
- `clearReleaseGuardKey(guard, 'left')` con `guard.left = false` es un no-op (mismo contenido).
- Tras `armReleaseGuard` + `resolveHeld` con la tecla bloqueada, y después `clearReleaseGuardKey` para esa tecla, `resolveHeld` vuelve a reflejar el `isDown` real.

### 25.2 `apps/web/src/game/types.test.ts` (ampliación)

- `GamePresentationState` acepta `status: 'paused'` sin error de tipos.
- Un estado con `status: 'paused'` sigue teniendo exactamente 4 claves (`status`, `step`, `elapsedMs`, `nextPieces`).
- Las aserciones ya existentes (`'nextPiece' in state === false`, ausencia de `board`/`activePiece`/`clearedLines`) se conservan sin cambios de fondo.

### 25.3 `apps/web/src/App.test.ts` (nuevo, integración Vue)

Montado con `@vue/test-utils` y `jsdom`, mockeando `create-phaser-game.ts` con el mismo patrón ya probado en `GameCanvas.test.ts` (`vi.mock('./game/create-phaser-game', ...)` con un controlador simulado que expone `reset`, `togglePause`, `destroy` como `vi.fn()`), de modo que `App.vue` se monta con el `GameCanvas` real pero sin arrancar Phaser/WebGL:

- El botón de pausa muestra «Pausar» cuando el estado simulado es `running`.
- Tras simular `onStateUpdate({ status: 'paused', ... })`, el botón muestra «Reanudar» y aparece el overlay «PAUSA».
- Al pulsar el botón de pausa/reanudación, se invoca `controller.togglePause()` exactamente una vez.
- Con `status: 'gameOver'`, el botón de pausa/reanudación está `disabled` y muestra «Pausar» (nunca «Reanudar»).
- El botón «Reiniciar» está presente y habilitado en los tres estados (`running`, `paused`, `gameOver`); al pulsarlo se invoca `controller.reset()`.
- El overlay «PAUSA» no aparece mientras `status` es `running` o `gameOver`.
- `NextPiecesPreview` sigue recibiendo y mostrando `nextPieces` sin regresión (montaje básico, ya cubierto indirectamente por sus propias pruebas, pero se verifica que `App.vue` sigue pasando la prop correctamente).
- No se accede al motor ni a Phaser directamente desde el test de `App.vue`: solo se interactúa con el controlador simulado y el DOM.

### 25.4 `GameCanvas.test.ts` (revisión, sin cambios funcionales esperados)

No se prevé ningún cambio necesario: `GameCanvas.vue` no cambia (§4.7), por lo que sus pruebas de ciclo de vida ya existentes deben seguir pasando sin modificación. Se revisa únicamente que ningún test asuma la forma exacta de `PhaserGameController` de forma que rompa al añadir `togglePause()` (los tests actuales usan `expect.objectContaining(...)` y mocks propios, no deberían verse afectados).

### 25.5 Decisión explícita sobre pruebas de `GameScene`

Continuando el precedente ya aceptado desde `0004` (§4.8, documentado también como deuda técnica en su informe de implementación): **no se crea un archivo de pruebas unitarias para `GameScene`**. Mockear fielmente `Phaser.Scene`, `Phaser.Input.Keyboard.Key` y la semántica exacta de `JustDown` (que depende del reloj interno del juego) sin un `Phaser.Game` real añadiría una cantidad de infraestructura de prueba desproporcionada para esta tarea, y el propio informe de `0004` ya identificó este límite («requeriría mock complejo de Phaser o integración con navegador»). En su lugar, la corrección de la orquestación dentro de `GameScene` (orden exacto de `update()`, no invocar `engine.step()` mientras `isPaused`, no duplicar listeners) se respalda en:

1. las pruebas exhaustivas de la lógica de decisión pura ya extraída (`session-status.ts`, `input-release-guard.ts`, §25.1);
2. las pruebas de integración Vue (§25.3), que verifican que los comandos correctos llegan al controlador;
3. la validación manual obligatoria (§27), que es la única vía realista de verificar el comportamiento sentido en el navegador (congelación visual, ausencia de ráfaga, exigencia de soltar y repulsar).

Esta decisión se documenta explícitamente, tal como exige el enunciado, para que no se interprete como un olvido: es una continuación deliberada de un límite ya aceptado por el proyecto, no una nueva pieza de deuda técnica sin justificar.

### 25.6 Correspondencia con las pruebas solicitadas en el encargo

Las pruebas de pausa, tiempo, entrada, game over y reinicio enumeradas en el encargo original se cubren así:

- **Pausa** (`running→paused`, `paused→running`, flanco único, `Escape` no altera `gameOver`, botón y teclado ejecutan la misma operación): cubiertas por `session-status.test.ts` (la parte de decisión pura) y por `App.test.ts` (la parte de comando/UI). La ausencia de llamadas a `engine.step()` mientras `isPaused` se garantiza por construcción del código de `update()` (§13.2, revisable en el diff) y se confirma manualmente (§27).
- **Tiempo** (acumulador limpio, sin catch-up, sin ráfaga): garantizado por construcción (§12: el bucle de pasos no se evalúa mientras `isPaused`, y el acumulador se pone a `0` en la transición) y confirmado manualmente (§27); no se introducen temporizadores reales en ningún test.
- **Entrada** (acciones pendientes eliminadas, teclas mantenidas no actúan al reanudar, hay que soltar y repulsar, DAS/ARR se reinician): cubierto por `input-release-guard.test.ts` para la lógica de bloqueo, y por la explicación causal de §4.2/§11.3 sobre por qué esto neutraliza también el estado interno de DAS del motor sin tocarlo.
- **Game over** (prevalece sobre pausa, no se puede reanudar, reinicio sigue disponible): cubierto por `session-status.test.ts` (precedencia pura) y por `App.test.ts` (botón deshabilitado, botón de reinicio siempre presente).
- **Reinicio** (funciona desde los tres estados, conserva semilla, limpia input/acumulador, no duplica listeners, no aplica acciones pendientes): la parte de motor (semilla, cola, tablero, contadores) ya está cubierta por las pruebas existentes de `0002`/`0006`/`0007`, no modificadas por esta tarea; la parte nueva (neutralización de sesión e input) se cubre por `input-release-guard.test.ts` más la revisión de código de `resetEngine()` (§15.1) y la validación manual (§27).

## 26. Validación manual requerida

A ejecutar con `pnpm dev`, documentando el resultado en el informe final ([docs/implementation/0008-pausa-reanudacion-reinicio-coordinados.md](../implementation/0008-pausa-reanudacion-reinicio-coordinados.md)):

**Pausa:**
- Pulsar `Escape` y comprobar que aparece el overlay «PAUSA».
- Comprobar que la pieza activa y el tablero quedan completamente congelados (sin caída, sin cambios) mientras dura la pausa.
- Esperar varios segundos en pausa y reanudar: comprobar que la pieza no cae de golpe ni salta varias filas.
- Mantener `ArrowLeft`/`ArrowRight` antes de pausar y comprobar que el movimiento no continúa automáticamente al reanudar mientras la tecla se mantenga pulsada desde antes.
- Mantener `ArrowDown` (soft drop) antes de pausar y comprobar que queda neutralizado al reanudar hasta soltar y volver a pulsar.
- Pulsar teclas de juego (`ArrowUp`, `Z`, `Space`, direcciones) mientras está pausado y comprobar que no se ejecutan de golpe al reanudar.
- Confirmar que hay que soltar y volver a pulsar cada tecla para que vuelva a producir efecto.

**Controles:**
- Usar el botón «Pausar»/«Reanudar» y comprobar que su comportamiento es idéntico al de `Escape`.
- Alternar varias veces seguidas (tecla y botón, combinados) sin observar dobles cambios ni desincronización entre el texto del botón y el overlay.

**Game over:**
- Provocar un `gameOver` y comprobar que `Escape` no reanuda nada.
- Comprobar que el botón de pausa/reanudación aparece deshabilitado.
- Comprobar que el botón «Reiniciar» sigue funcionando con normalidad.

**Reinicio:**
- Reiniciar mientras la partida corre.
- Reiniciar mientras está en pausa (comprobar que el overlay desaparece y la sesión queda en `running`).
- Reiniciar tras un `gameOver`.
- Comprobar en los tres casos que vuelve la misma pieza activa y la misma cola de próximas piezas iniciales.
- Comprobar que ninguna tecla mantenida antes del reinicio mueve la nueva pieza automáticamente.

**General:**
- Comprobar que DAS/ARR siguen sintiéndose fluidos tras varias pausas/reanudaciones.
- Comprobar que soft drop y hard drop siguen funcionando con normalidad.
- Comprobar que el lock delay no se ve alterado por pausar/reanudar (una pieza apoyada antes de pausar sigue con el mismo margen al reanudar).
- Comprobar que no aparecen errores ni avisos nuevos en la consola del navegador.
- Comprobar que no se duplican acciones ni listeners tras varios ciclos de pausa/reinicio.
- Detener el servidor de desarrollo al finalizar (no dejar procesos activos), conforme a `AGENTS.md`.

## 27. Reproducibilidad

Al reiniciar con la misma semilla y configuración: misma pieza activa, mismas tres próximas piezas, mismo tablero vacío, mismos contadores, mismo estado de lock delay, misma secuencia posterior para las mismas entradas — todo ello ya garantizado por el motor sin cambios de esta tarea (`0002`/`0006`/`0007`).

La pausa no forma parte del tiempo lógico ni de ninguna secuencia de acciones del motor: como no se llama a `step()` mientras `isPaused === true`, la pausa no consume `step`, no consume `elapsedMs`, no consume PRNG ni bolsa, y no aparece en ningún evento del motor. La duración real de una pausa (medio segundo o media hora) no puede alterar el resultado determinista de la partida, porque el motor simplemente no se entera de que ha existido: no recibe ninguna llamada durante ese intervalo.

## 28. Configuración y dependencias

- `packages/game-config` no se modifica: ninguna propiedad de pausa, ningún parámetro nuevo.
- No se añade ninguna dependencia nueva en ningún paquete. No se modifica `pnpm-lock.yaml`.
- No se introduce Pinia, Vue Router, ni ninguna librería de UI adicional para el overlay o los botones: se usan exclusivamente plantillas Vue y CSS ya soportados por el stack actual, igual que en `0007`.

## 29. Documentación futura

Al finalizar la implementación, Cline debe crear:

- [docs/implementation/0008-pausa-reanudacion-reinicio-coordinados.md](../implementation/0008-pausa-reanudacion-reinicio-coordinados.md)

Y actualizar:

- [docs/project-status.md](../project-status.md)

El informe de implementación debe incluir, como mínimo:

- estado inicial (tests en verde, working tree);
- archivos inspeccionados, modificados y creados;
- decisión final sobre mantener la lógica en `GameScene` frente a extraer un controlador, con su justificación (§21);
- contrato final de `SessionStatus` y de `GamePresentationState`;
- canal de comandos Vue → Phaser (`PhaserGameController.togglePause()`) y su cableado real;
- semántica final de `Escape` (incluida cualquier desviación respecto a esta especificación, si la hubo);
- estrategia final de neutralización y rearme de teclas (`input-release-guard.ts`), incluida cualquier ambigüedad resuelta durante la implementación;
- tratamiento final del acumulador temporal y del frame de transición;
- orden final de pausa, reanudación y reinicio, con confirmación de que coincide con §13/§15 o documentación de cualquier desviación;
- precedencia de `gameOver` sobre `paused`, confirmada con los tests correspondientes;
- lifecycle y listeners: confirmación de que no se duplicó ningún listener y de que no se usó `scene.pause()`;
- pruebas añadidas, con su ubicación exacta;
- número final de tests (partiendo de los 276 actuales);
- comandos ejecutados (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check`) y sus resultados;
- desviaciones respecto a esta especificación, si las hubo, y su justificación;
- deuda técnica (incluida la ya aceptada de no probar `GameScene` directamente, §25.5, y el aviso de chunk de Phaser, ya aceptado desde `0004`);
- validación manual (§26) documentada punto por punto;
- confirmación explícita de que no se implementó nada del alcance excluido (§6, §22 del encargo original);
- confirmación explícita de que no se hicieron commits.

## 30. Puertas de calidad

La futura implementación deberá dejar correctos, ejecutados desde la raíz del monorepo:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `git diff --check`

El aviso conocido de chunk grande de Phaser (`>500 kB`, documentado como deuda técnica desde `0004`) continúa aceptado y fuera de alcance. También debe validarse manualmente con `pnpm dev` (§26), deteniendo el servidor al finalizar.

## 31. Siguiente tarea

No se fija una `0009` definitiva: el roadmap y el estado real del proyecto no permiten asegurar su alcance todavía. La siguiente tarea se decidirá después de:

- validar en el navegador la pausa, la reanudación y el reinicio de esta tarea (§26);
- revisar la sensación de control resultante (si la neutralización de entrada se siente natural o entorpece el juego);
- decidir, a la vista de `docs/rautfall.md` y del estado real, entre candidatas razonables como hold, ghost piece, puntuación/combos, o una consolidación visual del HUD.

Ninguna de esas candidatas se asume automáticamente como alcance de `0009` hasta que se redacte su propia especificación inmutable.
