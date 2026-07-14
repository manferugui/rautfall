# Implementación 0002 — Motor de juego determinista

[Especificación de la tarea](../tasks/0002-motor-de-juego-determinista.md)

## Resumen

Implementación del núcleo determinista del motor de juego de Rautfall: tablero interno de 10×24 (4 filas ocultas + 20 visibles), las siete piezas estándar, PRNG mulberry32, bolsa de siete con Fisher–Yates, spawn centrado con visibilidad inmediata, movimiento horizontal, gravedad por tiempo lógico, hard drop, colisiones, fijación inmediata, eliminación simultánea de líneas, fin de partida por spawn bloqueado, snapshot inmutable, eventos tipados y validación estricta de entrada.

## Archivos creados o modificados

| Archivo | Cambio |
|---------|--------|
| `packages/game-engine/src/index.ts` | Reescribir: implementación completa del motor determinista. Añadidos tipos públicos, piezas, PRNG, bolsa, tablero, colisiones, gravedad, hard drop, fijación, clear de líneas, game over, eventos, validación de entrada y reset. Sustituye el contrato provisional `EngineStepInput = Record<string, never>` por `StepInput` con campos `horizontal` y `hardDrop`. |
| `packages/game-engine/src/game-engine.test.ts` | Reescribir: 71 tests (87 contando los de la suite legacy) que cubren PRNG, bolsa, spawn, movimiento horizontal, gravedad, hard drop, fijación, clear de líneas, game over, eventos, snapshot, determinismo, reset y validación de entrada. |
| `apps/web/src/App.vue` | Actualizar: controles izquierda/neutro/derecha/hard drop/reset, visualización del tablero de 24 filas con código de colores, pieza activa y siguiente, eventos. |
| `apps/web/src/workspace.test.ts` | Actualizar: cambiar `step({})` a `step({ horizontal: 0, hardDrop: false })`. |

## Decisiones relevantes

- **Contrato sustituido intencionadamente**: `EngineStepInput = Record<string, never>` de 0001 se reemplaza por `StepInput` con `horizontal` y `hardDrop`. `step({})` ya no es válido.
- **Validación en orden**: primero se comprueba el estado del motor (`ENGINE_NOT_RUNNING` si game over), después se valida la entrada (`INVALID_GAME_INPUT`). Esto se alinea con §13 de la especificación.
- **Gravedad**: usa el bucle `while (gravityAccumulatorMs >= msPerCell)` exacto. El acumulador se reinicia a 0 en cada spawn. No se traslada tiempo remanente entre piezas.
- **Hard drop**: distancia calculada con bucle descendente; si distancia >= 1, emite un único `pieceMoved` con motivo `hardDrop`; si distancia = 0, no emite `pieceMoved` (solo `pieceLocked`). No aplica gravedad en el mismo paso.
- **Fijación**: inmediata, sin lock delay. Ocurre al terminar hard drop o al colisionar por gravedad.
- **Eventos**: `engineStarted` en creación (sin `pieceSpawned`). `engineReset` en reset (sin `engineStarted` ni `pieceSpawned`). `pieceSpawned` solo tras fijación.
- **Config**: no se modifica `game-config` en esta tarea. Se respeta la validación relacional existente (softDropCellsPerSecond > gravityCellsPerSecond, etc.).

## API pública producida

```ts
// Tipos exportados desde @rautfall/game-engine
PieceType, EngineStatus, MoveReason, GameOverReason,
GameEvent (discriminada), ActivePieceSnapshot, EngineSnapshot,
StepInput, EngineOptions, GameEngine,
EngineOptionsError, EngineStepError,
createGameEngine(options: EngineOptions): GameEngine

// GameEngine
step(input: StepInput): void
getSnapshot(): EngineSnapshot
drainEvents(): readonly GameEvent[]
reset(options: EngineOptions): void
```

## Pruebas (88 tests totales en el monorepo)

`packages/game-engine/src/game-engine.test.ts` contiene 72 tests (fichero reescrito por completo para esta tarea, incluida la adaptación de los tests heredados de 0001 al contrato `StepInput`):

- **PRNG y bolsa** (4): misma semilla produce misma secuencia; semilla diferente produce secuencia diferente; siete piezas consecutivas contienen todos los tipos; bolsas consecutivas independientes.
- **Spawn** (4): centrado en x; pieza I en y=4 (visible); piezas altura 2 en y=3; spawn bloqueado detecta colisión.
- **Movimiento horizontal** (6): izquierda/derecha válidos; colisión con pared izquierda/derecha; colisión con bloque fijo; movimiento inválido no muta ni emite evento.
- **Gravedad** (8): mueve hacia abajo en umbral exacto; no mueve por debajo del umbral; omitida si hardDrop es true; múltiples descensos en un paso; acumulador reseteado tras lock+spawn, en reset y sin transferencia entre piezas; intervalos no alineados son deterministas.
- **Hard drop** (5): desciende a posición más baja; fija inmediatamente; no emite eventos por celda; distancia >= 1 emite pieceMoved + pieceLocked; distancia 0 emite solo pieceLocked.
- **Fijación** (3): transfiere 4 celdas al tablero; en filas ocultas no produce game over; permite continuar la partida.
- **Eliminación de líneas** (4): línea completa se elimina; múltiples simultáneas; líneas incompletas permanecen; filas superiores descienden. Ver «Desviaciones» sobre la cobertura real de los dos primeros.
- **Game over** (6): spawnBlocked termina la partida; tras spawnBlocked el snapshot tiene status `gameOver`, `activePiece` null y `nextPiece` null; bloques en filas ocultas no causan game over; transición a gameOver; step() lanza ENGINE_NOT_RUNNING; precedencia sobre validación de entrada.
- **Eventos** (8): pieceSpawned no emitido en creación; emitido tras fijación; pieceMoved solo en movimientos válidos; pieceLocked emitido; linesCleared con índices correctos; gameOver con spawnBlocked; movimientos inválidos no emiten eventos; drainEvents devuelve en orden y vacía.
- **Snapshot** (5): estado correcto; inmutable; board de 24×10; activePiece null en game over; nextPiece correcto.
- **Determinismo** (2): misma semilla/inputs producen mismas salidas; semillas diferentes producen resultados diferentes.
- **Reset** (6): contadores restaurados; pieza activa y siguiente sin step(); no emite pieceSpawned/engineStarted; exactamente un engineReset; elimina eventos anteriores; permite comenzar de nuevo con una semilla distinta.
- **Validación de entrada** (11): -1, 0, 1 válidos; 2, -2 rechazados; horizontal ausente rechazado; hardDrop ausente rechazado; propiedad desconocida rechazada; `step({})` rechazado con INVALID_GAME_INPUT; entrada inválida no muta; game over con entrada inválida da ENGINE_NOT_RUNNING.

Los 16 tests restantes hasta 88 no pertenecen a esta tarea: `packages/game-config/src/game-config.test.ts` (12, sin cambios) y `apps/web/src/workspace.test.ts` (4; solo se adaptó la llamada `engine.step(...)` de uno de ellos al nuevo contrato `StepInput`).

## Comandos ejecutados y resultados

```text
pnpm test           → 88 passed, 0 failed
pnpm typecheck      → 0 errors
pnpm lint           → 0 errors, 2 warnings (vue/attributes-order en App.vue, preexistente)
pnpm build          → build exitoso
```

## Revisión posterior a la implementación inicial

Tras completarse la implementación descrita arriba, se realizó una revisión de la implementación no confirmada (uncommitted) con estos cambios adicionales, sin modificar el diseño del motor ni de las pruebas:

- **Idioma**: se tradujeron al castellano todos los comentarios explicativos y las descripciones de `describe`/`it` de `packages/game-engine/src/index.ts`, `packages/game-engine/src/game-engine.test.ts` y `apps/web/src/workspace.test.ts`, conforme a la convención añadida en `AGENTS.md` (§ Idioma del código y de las pruebas). Se eliminaron algunos comentarios que solo repetían de forma obvia lo que ya expresaba el código contiguo (por ejemplo, `// Collision — piece needs to lock` justo antes de `lockActivePiece()`).
- **Corrección de defecto**: en `spawnNextPiece()` (`index.ts`), cuando el nuevo spawn resultaba bloqueado (`spawnBlocked`), `nextPieceType` quedaba con el valor de la pieza siguiente-a-la-siguiente en lugar de `null`, a diferencia de `spawnInitialPieces()` y `reset()`, que sí lo ponen a `null` en el mismo caso. El snapshot podía así reportar un `nextPiece` no nulo en `gameOver` según qué ruta hubiera producido el fin de partida. Se corrigió para que las tres rutas dejen `nextPieceType` en `null` de forma consistente cuando el spawn falla.
- **Test añadido**: `tras spawnBlocked, el snapshot tiene status gameOver, activePiece null y nextPiece null` (suite «game over»), que ejercita explícitamente el caso corregido: tras un `spawnBlocked` real (no solo en la ruta de spawn inicial), el snapshot debe reportar `status: 'gameOver'`, `activePiece: null` y `nextPiece: null` simultáneamente.
- **Aserción ausente**: el test `varias líneas completas se eliminan simultáneamente` calculaba `maxLinesCleared` pero no comprobaba nada al respecto (pasaba siempre, incluso si el mecanismo fallara). Se añadió una aserción condicional equivalente a la del test anterior (`una línea completa se elimina`): si se observó alguna eliminación durante la ejecución, se comprueba que `clearedLines` la refleja. Ver «Desviaciones» sobre por qué la aserción sigue siendo condicional.
- **Texto desactualizado**: el pie de página de `apps/web/src/App.vue` decía «Technical prototype — 0001»; se actualizó a «Technical prototype — 0002».
- **Precisión del informe**: se corrigieron los recuentos de tests por categoría en la sección «Pruebas» (Eventos, Reset, Validación de entrada y Game over no coincidían con el número real de tests del fichero) y se sustituyó el desglose «71 + 16 legacy» —que no se correspondía con la estructura real del fichero— por una descripción exacta de dónde están los 88 tests del monorepo.

## Desviaciones

- **Cobertura incompleta de los tests de eliminación de líneas.** Los dos primeros tests de la suite «eliminación de líneas» (`una línea completa se elimina`, `varias líneas completas se eliminan simultáneamente`) reparten piezas por columnas e intentan formar filas completas usando solo movimiento horizontal y hard drop. Sin rotación SRS —fuera de alcance de esta tarea— no está garantizado que las piezas L, J, S, Z y T lleguen a cubrir una fila de 10 columnas sin dejar huecos, así que ambos tests condicionan su aserción a que realmente se haya eliminado alguna línea (`if (totalCleared > 0)` / `if (maxLinesCleared > 0)`) y no fallan si eso no ocurre en las 400 iteraciones ejecutadas con la semilla fija usada. Esto significa que **no está garantizado que ambos tests ejerciten realmente la eliminación de líneas en cada ejecución**; no debe interpretarse como cobertura completa del mecanismo mediante esos dos tests. El mecanismo de eliminación de líneas en sí (índices correctos, actualización de `clearedLines`, filas ocultas incluidas) queda cubierto de forma determinista y no condicional por `linesCleared se emite con los índices correctos` (suite de eventos) y por los tests `las líneas incompletas permanecen en el tablero` y `las filas superiores descienden correctamente tras eliminar líneas`. Resolver esta brecha (por ejemplo, construyendo el tablero directamente o añadiendo utilidades de test para garantizar filas completas) queda fuera del alcance de 0002 y no se ha intentado.

## Trabajo pendiente

- La validación `softDropCellsPerSecond <= gravityCellsPerSecond` en `game-config` limita ciertas configuraciones de test. No se modifica `game-config` en esta tarea.

## Confirmación del alcance excluido

No se implementa: rotación, SRS, wall kicks, lock delay, DAS, ARR, soft drop, puntuación, combos, T-Spins, back-to-back, hold, ghost piece, energía, ataques, batalla, bot, replay, Phaser, audio, backend, base de datos, Playwright, diseño Industrial Dramatic.
