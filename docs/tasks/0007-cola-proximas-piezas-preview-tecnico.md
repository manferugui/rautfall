# 0007 — Cola determinista de tres próximas piezas y preview técnico provisional

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0007 — Cola determinista de tres próximas piezas y preview técnico provisional
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0007`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, el HUD Tactical o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0007-cola-proximas-piezas-preview-tecnico.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0007-cola-proximas-piezas-preview-tecnico.md) (ver §29), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Sustituir el contrato actual de una única «siguiente pieza» (`nextPiece: PieceType | null`) por una **cola determinista de exactamente tres próximas piezas** (`nextPieces: readonly PieceType[]`), manteniendo la misma bolsa de siete y el mismo PRNG ya existentes, sin introducir una segunda fuente de aleatoriedad ni una cola paralela.

Además, esta tarea añade una **preview técnica provisional** en `apps/web` que muestre las tres próximas piezas, apoyada en una nueva API pública y mínima de geometría de piezas expuesta por `packages/game-engine`, evitando que `apps/web` duplique las tablas de celdas de las siete piezas.

Al terminar la tarea:

- `EngineSnapshot` expone `nextPieces: readonly PieceType[]` en lugar de `nextPiece: PieceType | null`; no existen ambos campos a la vez ni un alias de compatibilidad;
- mientras el motor está `running`, `nextPieces.length === 3` siempre;
- `packages/game-engine` expone una función pura `getPieceShape(type: PieceType)` que permite a cualquier consumidor (web, futuro bot, futuras previews) conocer la geometría de una pieza en su orientación inicial sin acceder a tablas internas;
- `apps/web` muestra tres piezas próximas, en orden, mediante un componente Vue pequeño, sin generar piezas, sin avanzar la bolsa y sin mantener una cola paralela.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo                                    ✅ Completada
0002 — Motor de juego determinista                            ✅ Completada
0003 — Rotación SRS                                            ✅ Completada
0004 — Integración de Phaser                                   ✅ Completada
0005 — DAS, ARR y soft drop                                     ✅ Completada
0006 — Lock delay y fijación diferida                           ✅ Completada
0007 — Cola de próximas piezas y preview técnico provisional   ← Esta tarea
```

Esta tarea no incluye: hold, pieza fantasma, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, batalla, bot, pausa, audio, layout Tactical o Industrial Dramatic definitivo, HUD definitivo, más de tres próximas piezas, tamaño de cola configurable, Pinia, Vue Router, backend, Playwright, ni ningún cambio de CI/CD o de code splitting. Ver §6 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — sección «Decisión funcional: generación y secuencia de piezas» (bolsa de siete compartida y determinista) y «Reserva y vista previa» («la interfaz mostrará inicialmente tres piezas próximas»). Esta sección ya describe la intención de producto; esta tarea es su primera implementación real en el motor y en la web.
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) — contrato original `nextPiece: PieceType | null` (§21) y semántica de spawn (§9, §14, §20), que esta tarea sustituye para la cola y conserva sin cambios para el resto (colisión, gravedad, fijación, líneas).
- [docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md) — orientaciones, tablas de wall kicks y `PIECE_ORIENTATION_CELLS`, que esta tarea no modifica; solo lee la entrada `Orientation.Spawn` de esas tablas para construir la nueva API de geometría (§19).
- [docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md) — decisión de que Phaser renderiza el tablero y la pieza activa desde `getSnapshot()`, y de que el puente Vue↔Phaser (`GamePresentationState`) se mantiene deliberadamente mínimo («únicamente `status`, `step` y `elapsedMs`, sin campos adicionales del snapshot del motor», ver §407 de ese documento). Esa minimalidad fue una decisión de alcance de `0004`, no una invariante permanente; esta tarea la amplía de forma justificada (§20).
- [docs/tasks/0006-lock-delay-fijacion-diferida.md](0006-lock-delay-fijacion-diferida.md) — orden del paso lógico vigente (§14 de ese documento) y forma final de `ActivePieceSnapshot`, que esta tarea no modifica ni reordena; la cola de próximas piezas es ortogonal al lock delay.
- `packages/game-engine/src/index.ts` — implementación real tras `0006` (ver §4). Se amplía, no se reescribe desde cero.
- `packages/game-engine/src/game-engine.test.ts` — 179 `it` en 31 bloques `describe` (PRNG y bolsa, spawn, movimiento horizontal, gravedad, hard drop, fijación, líneas, game over, eventos, snapshot, determinismo, reset, validación, prioridad horizontal, DAS, ARR, soft drop, acumulador vertical, interacciones, rotación SRS, eventos DAS/ARR/soft drop, y diez bloques de lock delay). Ninguna de estas pruebas debe romperse por esta tarea salvo las que dependan explícitamente del contrato singular `nextPiece` (ver §22).
- `packages/game-config/src/index.ts` — `GameConfig`, `prototypeConfig` y `parseGameConfig` reales. **No se modifican en esta tarea** (ver §23): no se añade ninguna propiedad de tamaño de cola ni de geometría.
- `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/types.test.ts`, `apps/web/src/game/coordinates.ts`, `apps/web/src/components/GameCanvas.vue`, `apps/web/src/components/GameCanvas.test.ts`, `apps/web/src/App.vue` — integración web real tras `0006` (ver §4.3 y §22).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto.

## 4. Inspección previa (confirmada por lectura directa del código real)

### 4.1 Contrato actual del motor relativo a la siguiente pieza

`packages/game-engine/src/index.ts` expone hoy:

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPiece: PieceType | null;      // ← este campo se sustituye por completo (§7)
  clearedLines: number;
}>;
```

Internamente, el motor mantiene una única variable `nextPieceType: PieceType | null` (no una cola), rellenada así:

- `spawnInitialPieces()` extrae dos piezas de la bolsa: la primera pasa a `activePiece`, la segunda pasa a `nextPieceType`.
- `spawnNextPiece()` promueve `nextPieceType` a `activePiece` y extrae exactamente **una** pieza nueva de la bolsa para el nuevo `nextPieceType`.
- En `spawnBlocked` (tanto en la creación inicial como tras una fijación), `nextPieceType` se pone a `null`.
- `reset()` reproduce la misma secuencia que la creación inicial con la nueva semilla.

No existe ninguna cola de más de un elemento en el código actual: `nextPiece` es siempre `PieceType | null`, nunca un array.

### 4.2 Referencias reales a `nextPiece` en el repositorio (búsqueda exhaustiva)

Búsqueda realizada con `grep -rn "nextPiece" --include="*.ts" --include="*.vue" .` (excluyendo `node_modules`). Resultado completo:

| Archivo | Naturaleza de la referencia |
| --- | --- |
| `packages/game-engine/src/index.ts` | Definición del campo en `EngineSnapshot`, variable interna `nextPieceType`, y su asignación/lectura en `spawnInitialPieces`, `spawnNextPiece` y `reset()`. |
| `packages/game-engine/src/game-engine.test.ts` | 12 aserciones sobre `snap.nextPiece` en los bloques `game over`, `snapshot`, `determinismo`, `interacciones` y `eventos — DAS, ARR, soft drop` (comprobación de tipo válido, de persistencia entre pasos sin fijación, de igualdad entre semillas iguales, y de valor `null` tras `spawnBlocked`). |
| `apps/web/src/game/types.test.ts` | Una única aserción negativa: `expect('nextPiece' in state).toBe(false)`, que documenta que `GamePresentationState` (0004) **no** incluye `nextPiece`. Esta aserción sigue siendo cierta tras esta tarea (el campo singular no existe; el nuevo campo se llama `nextPieces`, en plural), pero el test debe ampliarse para reflejar el nuevo campo (§22.3). |

No existe ninguna otra referencia a `nextPiece` en `apps/web` (ni en `GameScene.ts`, ni en `create-phaser-game.ts`, ni en `types.ts`, ni en ningún renderer, helper o componente de tablero/piezas/HUD). Confirmado también que ningún informe de implementación (`docs/implementation/`) ni ninguna especificación de tarea histórica (`docs/tasks/0001` a `0006`) debe modificarse: son documentos inmutables y su mención de `nextPiece` describe fielmente el contrato vigente en el momento en que se escribieron (§22.4).

### 4.3 Puente Vue↔Phaser actual (relevante para la decisión de preview, §20)

Confirmado por lectura de `apps/web/src/game/types.ts`, `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/components/GameCanvas.vue` y `apps/web/src/App.vue`:

- Vue **no** llama a `engine.getSnapshot()` en ningún punto. Toda lectura del snapshot ocurre dentro de `GameScene.ts` (una escena Phaser).
- El único canal Phaser→Vue es `GamePresentationState`, deliberadamente mínimo desde `0004`:

  ```ts
  export type GamePresentationState = Readonly<{
    status: 'running' | 'gameOver';
    step: number;
    elapsedMs: number;
  }>;
  ```

- `GameScene.notifyState()` construye este objeto en cada `update()` y solo invoca `callbacks.onStateUpdate(newState)` cuando alguno de los tres campos cambia respecto del último valor notificado (deduplicación por comparación de primitivos).
- Todo el renderizado del tablero y de la pieza activa ocurre con `Phaser.GameObjects.Graphics` dentro de `GameScene.renderFrame()`, usando un mapa privado `PIECE_COLORS: Record<PieceType, number>` y las utilidades de `coordinates.ts` (`CELL_SIZE`, `boardXToCanvas`, `boardYToCanvas`, `isRowVisible`). Ninguna de estas utilidades ni el mapa de color están exportados fuera de `apps/web/src/game/`.
- `GameCanvas.vue` mide `320px × 640px` en CSS, coincidiendo exactamente con `CANVAS_WIDTH`/`CANVAS_HEIGHT` de `coordinates.ts` (10 columnas y 20 filas visibles × `CELL_SIZE = 32`). No existe hoy ningún espacio reservado en el canvas ni en el layout de `App.vue` para una previsualización de piezas.
- `App.vue` ya tiene un `info-panel` (a la derecha del canvas) con tarjetas técnicas (`status`, `step`, `elapsedMs`), ayuda de controles y botón de reset, todo con CSS propio, sin Pinia ni componentes adicionales.
- No existe ninguna tabla de geometría de piezas (`PIECE_ORIENTATION_CELLS`, anchura/altura) en `apps/web`. Toda la geometría vive exclusivamente en `packages/game-engine/src/index.ts`.

Estos hechos determinan las decisiones de §19 y §20.

## 5. Alcance incluido

- Sustitución completa de `nextPiece: PieceType | null` por `nextPieces: readonly PieceType[]` en `EngineSnapshot` (§7, §16).
- Cola interna de longitud fija 3 mientras el motor está `running`, alimentada exclusivamente por la misma bolsa de siete y el mismo PRNG ya existentes (§8, §9, §14, §15).
- Orden de operaciones explícito para el spawn tras fijación: extraer candidata, reponer cola, intentar spawn, activar o finalizar partida, emitir eventos (§10).
- Tratamiento explícito de `spawnBlocked` con la cola (§11, §12).
- `reset()` determinista con la nueva cola (§13).
- Ninguna ampliación de `GameEvent` ni de `MoveReason` (§17).
- Nueva función pura y mínima `getPieceShape(type: PieceType)` exportada por `packages/game-engine`, que expone la geometría de una pieza en su orientación inicial (celdas normalizadas, anchura, altura) sin exponer tablas internas mutables ni estado de pieza activa (§19).
- Ampliación justificada de `GamePresentationState` (`apps/web/src/game/types.ts`) con `nextPieces: readonly PieceType[]`, poblada por `GameScene.ts` desde el snapshot (§20, §21).
- Nuevo componente Vue pequeño y provisional que muestra las tres próximas piezas usando `getPieceShape`, integrado en el `info-panel` ya existente de `App.vue` (§20, §21).
- Migración completa de los consumidores reales de `nextPiece` identificados en §4.2 (§22).
- Pruebas del motor (TDD pragmático) que cubren creación, consumo, cruce de bolsa, game over, reset, inmutabilidad, atomicidad y regresión (§24).
- Pruebas de la web para la nueva preview técnica (§25).

## 6. Alcance explícitamente excluido

No pertenece a `0007`:

- Hold / reserva de pieza.
- Intercambio de pieza y restricción de uso de hold por pieza.
- Pieza fantasma (`ghost piece`).
- Puntuación, combos, T-Spins, `back-to-back`.
- Energía de combate y sabotajes.
- Batalla y bot.
- Pausa.
- Audio.
- Animaciones, partículas o transiciones complejas en la preview.
- Layout Tactical, Duel o Industrial Dramatic definitivo.
- HUD definitivo (la preview de esta tarea es explícitamente provisional, ver §20).
- Más de tres próximas piezas.
- Configuración dinámica del tamaño de la cola: la longitud 3 es una constante fija del motor, no una propiedad de `GameConfig`.
- Responsive avanzado de la preview (más allá de encajar razonablemente en el `info-panel` existente).
- Nuevos modos de juego.
- Pinia.
- Vue Router.
- Backend, persistencia, autenticación, ranking, historial.
- Playwright.
- Cambios de CI/CD.
- Code splitting o cualquier reestructuración de build orientada a reducir el tamaño de chunk.
- Subida artificial del límite de aviso de tamaño de chunk de Vite/Rollup. El aviso de chunk superior a 500 kB (atribuible principalmente a Phaser, documentado como deuda técnica desde `0004`/`0005`) permanece sin resolver en esta tarea.
- Refactor general del motor o de `GameScene.ts` ajeno a esta tarea (no se reescriben rotación SRS, DAS/ARR, lock delay, ni el bucle de renderizado del tablero/pieza activa).
- Nueva arquitectura de renderizado no necesaria para mostrar tres piezas próximas.
- Nuevos eventos públicos (`nextPiecesChanged`, `previewRefilled`, `pieceQueued`, `bagRefilled` u otros): el motor sigue comunicando su ciclo de vida exclusivamente con los eventos ya existentes (§17).
- Nuevas propiedades de configuración en `packages/game-config` (ni tamaño de cola, ni geometría, ver §23).
- Dependencias nuevas, salvo necesidad técnica imprescindible y justificada (no se anticipa ninguna).
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §5.

## 7. Migración del contrato: de `nextPiece` a `nextPieces`

- `EngineSnapshot.nextPiece: PieceType | null` se elimina por completo.
- Se sustituye por `EngineSnapshot.nextPieces: readonly PieceType[]`.
- No existen ambos campos a la vez, ni durante la implementación ni en el resultado final.
- No se introduce ningún alias de compatibilidad temporal (por ejemplo, un getter `nextPiece` que delegue en `nextPieces[0]`).
- La migración es explícita y completa: todo consumidor real identificado en §4.2 se actualiza en la misma tarea (§22). No queda ninguna referencia funcional a `nextPiece` en el código de producción ni en las pruebas al finalizar la tarea.
- A diferencia de `nextPiece` (que podía ser `null` en `gameOver`), `nextPieces` **nunca** es `null` ni contiene huecos: mientras el motor exista (`running` o `gameOver`), `nextPieces` es siempre un array de longitud exactamente 3 (§8, §12). Esto simplifica el contrato: no hace falta un caso `null` porque la cola siempre se repone (§10, §11).

## 8. Cola determinista: longitud y semántica

Mientras el motor está en estado `running`:

- `nextPieces.length === 3` en todo momento observable (tras la creación, tras cada `step()`, antes y después de cualquier operación).
- `nextPieces[0]` es la pieza que se convertirá en `activePiece` en el próximo spawn (tras la próxima fijación).
- `nextPieces[1]` y `nextPieces[2]` son las dos piezas siguientes, en el mismo orden en que se consumirán de la bolsa.
- El orden de la cola es estable: `nextPieces[0]` de un snapshot es siempre, salvo que haya ocurrido un spawn entre medias, el mismo valor que `nextPieces[0]` del snapshot anterior.
- La cola no contiene `null`, huecos, ni referencias mutables internas (ver §16 para la garantía de copia defensiva).
- La longitud de la cola (3) es una constante fija del motor, análoga a `BOARD_COLS`/`BOARD_ROWS`/`HIDDEN_ROWS`: no es configurable por `GameConfig` (§6, §23).

## 9. Creación inicial

Al crear el motor (`createGameEngine`):

1. Se consume una pieza de la bolsa para `activePiece` (posicionada mediante el cálculo de spawn ya existente, `calculateSpawnX`/`calculateSpawnY`, sin cambios respecto de `0002`/`0003`).
2. Se consumen exactamente **tres** piezas adicionales de la bolsa, en orden, para rellenar `nextPieces` con longitud 3.
3. Toda la secuencia procede de la misma bolsa de siete y del mismo PRNG ya existentes (`createPrng`, `shuffleBag`, `nextFromBag`); no se instancia un segundo generador ni una segunda bolsa.
4. No se emiten eventos adicionales por rellenar la cola inicial.
5. Se mantiene el contrato de eventos ya vigente: se emite únicamente `engineStarted`; no se emite `pieceSpawned` para la pieza inicial ni para ninguna de las tres piezas que entran directamente en `nextPieces`.

Pseudocódigo (sustituye a `spawnInitialPieces` tal como existe hoy):

```text
function spawnInitialPieces():
  activeType = nextFromBag(bag, prng)                       // 1 consumo
  nextPieces = [nextFromBag(bag, prng),                     // 3 consumos
                nextFromBag(bag, prng),
                nextFromBag(bag, prng)]

  spawnX = calculateSpawnX(activeType)
  spawnY = calculateSpawnY(activeType)
  cells  = computeAbsoluteCells(activeType, spawnX, spawnY, Orientation.Spawn)

  if isCollision(board, cells):
    // Caso límite teórico: el tablero está vacío en la creación, por lo que
    // esta rama no debería alcanzarse nunca en la práctica. Se conserva por
    // simetría con reset() y por completitud del contrato (ver §12).
    status = 'gameOver'
    activePiece = null
    emit gameOver { reason: 'spawnBlocked' }
    return   // nextPieces ya tiene longitud 3; se conserva sin cambios

  activePiece = { type: activeType, x: spawnX, y: spawnY, orientation: Orientation.Spawn }
  // lockDelayElapsedMs, lockResetsUsed, verticalProgress, horizontalState: sin cambios respecto de 0006
```

Nota sobre consumo total: la creación inicial consume ahora **4** piezas de la bolsa (1 activa + 3 de cola), frente a las 2 que consumía antes de esta tarea (1 activa + 1 siguiente). Esto es un cambio de comportamiento observable esperado y documentado: con la misma semilla, la secuencia completa de piezas jugadas no cambia, pero el estado exacto de la bolsa interna tras la creación sí avanza dos posiciones más que antes. No es una regresión; es la consecuencia directa de materializar tres piezas de previsualización en vez de una.

## 10. Orden de operaciones en el spawn tras fijación

Tras fijar una pieza y procesar la eliminación de líneas (secuencia ya existente de `lockAndProcess`/`lockActivePiece`/`clearLines`, sin cambios), el spawn de la siguiente pieza activa (`spawnNextPiece`) sigue **exactamente** este orden:

1. **Extraer candidata**: tomar `nextPieces[0]` como candidata a nueva pieza activa.
2. **Reponer cola**: desplazar las piezas restantes de la cola conservando el orden (lo que era `nextPieces[1]` pasa a `nextPieces[0]`, lo que era `nextPieces[2]` pasa a `nextPieces[1]`), y obtener una nueva pieza de la bolsa para la tercera posición, restaurando `nextPieces.length === 3`.
3. **Intentar spawn**: calcular la posición inicial de la candidata (mismo cálculo de `calculateSpawnX`/`calculateSpawnY` y comprobación de colisión ya existentes) para decidir si el spawn es válido.
4. **Activar o finalizar la partida**: si el spawn es válido, la candidata pasa a `activePiece` (con `lockDelayElapsedMs = 0`, `lockResetsUsed = 0`, acumulador vertical y estado horizontal reiniciados, igual que en `0005`/`0006`); si el spawn está bloqueado, `activePiece` pasa a `null` y el estado del motor pasa a `gameOver` (§11).
5. **Emitir eventos correspondientes**: `pieceSpawned` con la candidata si el spawn fue válido, o `gameOver` con motivo `spawnBlocked` si no lo fue. La reposición de la cola (paso 2) **no** emite ningún evento propio.

Pseudocódigo (sustituye a `spawnNextPiece` tal como existe hoy):

```text
function spawnNextPiece():
  candidate = nextPieces.shift()                 // 1. extraer candidata
  nextPieces.push(nextFromBag(bag, prng))        // 2. reponer cola (vuelve a longitud 3)

  spawnX = calculateSpawnX(candidate)
  spawnY = calculateSpawnY(candidate)
  cells  = computeAbsoluteCells(candidate, spawnX, spawnY, Orientation.Spawn)

  if isCollision(board, cells):                  // 3. intentar spawn
    status = 'gameOver'                          // 4. finalizar partida
    activePiece = null
    emit gameOver { reason: 'spawnBlocked' }      // 5. emitir evento
    return

  activePiece = { type: candidate, x: spawnX, y: spawnY, orientation: Orientation.Spawn }  // 4. activar
  // reiniciar horizontalState, verticalProgress, lockDelayElapsedMs, lockResetsUsed a sus valores iniciales (sin cambios respecto de 0006)
  emit pieceSpawned { piece: candidate }          // 5. emitir evento
```

### Nota sobre el orden interno equivalente

Los pasos 2 («reponer cola») y 3 («intentar spawn») son independientes entre sí: reponer la cola consume una pieza de la bolsa pero no depende del resultado de la comprobación de colisión, y la comprobación de colisión no depende de qué pieza se acaba de añadir al final de la cola. Por tanto, el orden interno exacto entre esos dos pasos concretos (reponer antes o después de comprobar colisión) es intercambiable sin alterar ningún resultado observable, siempre que:

- la candidata se calcule y se extraiga del frente de la cola exactamente una vez por spawn;
- se consuma exactamente una pieza de la bolsa para reponer la cola exactamente una vez por spawn, tanto si el spawn resulta válido como si resulta bloqueado;
- el snapshot final refleje `nextPieces` ya repuesta a longitud 3 en ambos casos;
- el consumo de PRNG/bolsa observado (número de llamadas y orden) sea idéntico al descrito arriba.

Si la implementación real encuentra más seguro o más claro reordenar internamente estos dos pasos concretos (por ejemplo, comprobar primero la colisión y reponer la cola justo después, antes de emitir el evento), es aceptable, siempre que el estado observable final (snapshot, eventos, consumo de bolsa) sea exactamente el descrito en esta sección. Los pasos 1, 4 y 5 no son reordenables: la candidata debe salir del frente antes de cualquier otra cosa, y la activación/finalización y la emisión de eventos deben ocurrir después de conocer el resultado de la comprobación de colisión.

## 11. Game over por spawn bloqueado

Si la candidata extraída de `nextPieces[0]` (§10, paso 1) no puede aparecer en su posición inicial:

- la candidata se considera **consumida**: no permanece al frente de la cola ni en ninguna posición de `nextPieces`;
- `activePiece` pasa a `null`;
- el estado del motor pasa a `gameOver`;
- se emite el evento `gameOver` con motivo `spawnBlocked` (mismo tipo de evento y motivo ya existentes desde `0002`; sin cambios de forma);
- la cola se repone igualmente hasta contener exactamente tres piezas futuras (paso 2 de §10 ya se ejecutó antes de conocer el resultado del spawn, o se ejecuta como parte del mismo flujo si la implementación reordena según la nota de §10);
- **no** se emite `pieceSpawned`;
- la cola final (`nextPieces` en el snapshot posterior al `gameOver`) representa la secuencia de piezas que habrían llegado a continuación de la pieza cuyo spawn falló, no la candidata fallida ni ninguna repetición de ella.

Esto es idéntico, en espíritu, al comportamiento ya vigente para `nextPiece` antes de esta tarea (donde `nextPiece` pasaba a `null` tras `spawnBlocked`), con la diferencia de que ahora la cola nunca queda vacía ni `null`: siempre se repone a longitud 3, aunque el motor ya no vaya a usar esas piezas (ver §12).

## 12. Estado de la cola en game over

Aunque el motor esté en `gameOver`:

- `activePiece === null`;
- `nextPieces.length === 3`;
- la cola sigue siendo de solo lectura, con las mismas garantías de copia defensiva que en `running` (§16);
- el contenido de `nextPieces` en este estado **no** es una promesa de que esas piezas vayan a jugarse: el motor no admite más `step()` (`ENGINE_NOT_RUNNING`), por lo que esas piezas nunca llegarán a spawnear;
- se conserva exclusivamente por utilidad de diagnóstico, coherencia con `reset()`/replay futuro, y para no introducir un caso especial (`null` vs. array) en el contrato público que los consumidores tendrían que comprobar aparte del propio `status`.

## 13. Reset

`reset(options)` seguirá la misma secuencia ya establecida en `0002` §23 y ampliada en `0005`/`0006`, sustituyendo únicamente los pasos relativos a la siguiente pieza:

1. Validar semilla y configuración (sin cambios).
2. Vaciar el tablero interno, reiniciar contadores de paso y tiempo lógico (sin cambios).
3. Reiniciar el PRNG y la bolsa de siete con la nueva semilla (sin cambios).
4. Reiniciar el acumulador vertical, el estado horizontal, `lockDelayElapsedMs` y `lockResetsUsed` (sin cambios respecto de `0006`).
5. Vaciar cualquier cola anterior (los tres elementos de `nextPieces` previos al `reset()` se descartan por completo; no se conservan ni se mezclan con la nueva secuencia).
6. Generar la nueva pieza activa y las tres nuevas próximas piezas siguiendo exactamente la misma lógica que la creación inicial (§9), consumiendo 4 piezas de la nueva bolsa (1 activa + 3 de cola).
7. Vaciar los eventos pendientes anteriores.
8. Emitir exactamente un `engineReset`. No se emite `engineStarted` ni `pieceSpawned`.

Tras `reset()`, el snapshot debe reflejar inmediatamente la nueva pieza activa y las tres nuevas próximas piezas, sin necesidad de llamar a `step()`, igual que ya ocurre con el resto de campos del snapshot.

## 14. Determinismo y consumo de PRNG/bolsa

Con la misma semilla, la misma configuración y la misma secuencia de `StepInput`, deben ser idénticos en cada `step()` observado:

- `activePiece` (tipo, posición, orientación, y los campos de lock delay ya existentes);
- `nextPieces` (contenido y orden, en cada snapshot);
- el tablero;
- los eventos emitidos, en el mismo orden;
- el motivo y el momento del `gameOver`, si ocurre;
- el número exacto de piezas consumidas de la bolsa en cada operación (creación: 4; cada spawn tras fijación: 1, tanto si el spawn resulta válido como si resulta bloqueado, porque la reposición de la cola ocurre siempre; `reset()`: 4 con la nueva semilla);
- el estado tras un `reset()` equivalente (misma nueva semilla).

Distintas semillas pueden producir secuencias de `nextPieces` distintas entre sí. No se usa `Math.random()` ni ninguna fuente de aleatoriedad externa al PRNG mulberry32 ya existente en ningún punto de esta tarea.

## 15. Seven-bag y cruce de frontera de bolsa

- El algoritmo de la bolsa de siete no cambia: cada bolsa contiene exactamente una pieza de cada uno de los siete tipos, barajada con Fisher–Yates sobre el PRNG del motor, y se consume de izquierda a derecha antes de barajar la siguiente.
- La cola de tres próximas piezas **puede** cruzar el límite entre dos bolsas consecutivas (por ejemplo, si quedan dos piezas de la bolsa actual, la tercera posición de `nextPieces` procederá ya de la siguiente bolsa barajada).
- No se introduce una segunda cola aleatoria, un PRNG independiente, ni una duplicación de la secuencia fuera del motor: `nextPieces` es simplemente una ventana observable sobre las próximas extracciones de la misma bolsa/PRNG ya existentes.
- Se exige un caso de prueba que fuerce explícitamente el cruce de una frontera de bolsa dentro de la ventana de tres piezas (§24).

## 16. Snapshot público

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];   // ← sustituye a nextPiece: PieceType | null
  clearedLines: number;
}>;
```

Reglas:

- `nextPieces` tiene siempre longitud exactamente 3, tanto en `running` como en `gameOver` (§8, §12).
- El orden de `nextPieces` es semántico: el índice 0 es la próxima pieza que intentará aparecer; los índices 1 y 2 son las dos siguientes, en el mismo orden en que se extraerán de la bolsa.
- `nextPieces` no expone la referencia mutable interna que el motor usa para desplazar (`shift`) y añadir (`push`) piezas. Cada llamada a `getSnapshot()` debe construir un array **nuevo** (por ejemplo, mediante el operador de propagación `[...cola]`) y congelarlo (`Object.freeze`) antes de incluirlo en el snapshot devuelto.
  - Es un error congelar directamente el array mutable interno de la cola: `Object.freeze` es irreversible, y el motor necesita seguir aplicando `shift()`/`push()` (o equivalentes) sobre esa estructura interna en operaciones posteriores. La copia defensiva evita este conflicto.
- Dos llamadas sucesivas a `getSnapshot()` sin ningún `step()` intermedio deben devolver arrays con el mismo contenido (aunque no es necesario, ni se debe asumir, que compartan la misma referencia).
- Mutar el array devuelto por `getSnapshot().nextPieces` (si el entorno de ejecución lo permitiera pese a `Object.freeze`, por ejemplo en modo no estricto) no debe, bajo ninguna circunstancia, afectar al estado interno del motor ni a snapshots ya devueltos anteriormente.
- La ampliación previa de `ActivePieceSnapshot` introducida en `0006` (`grounded`, `lockDelayElapsedMs`, `lockResetsUsed`) se conserva intacta: esta tarea no modifica `ActivePieceSnapshot` en absoluto.
- `EngineSnapshot` no gana ningún otro campo nuevo más allá de la sustitución de `nextPiece` por `nextPieces`.

## 17. Eventos

No se añade, elimina ni modifica ningún tipo de `GameEvent` ni ningún valor de `MoveReason` en esta tarea. En particular, no se introducen `nextPiecesChanged`, `previewRefilled`, `pieceQueued`, `bagRefilled` ni ningún otro evento relacionado con la cola: la actualización de `nextPieces` es parte del estado observable a través del snapshot, no un hecho de dominio que necesite un evento propio en esta fase.

- `engineStarted`, `engineReset`, `pieceSpawned`, `pieceMoved`, `pieceLocked`, `linesCleared`, `gameOver` y `pieceRotated` mantienen exactamente su forma y sus reglas de emisión ya vigentes desde `0002`/`0003`/`0005`/`0006`.
- `pieceSpawned` se sigue emitiendo únicamente para la candidata que se convierte en `activePiece` tras una fijación (§10); nunca para las piezas que entran en `nextPieces` (ni en la creación, ni en el reset, ni en la reposición tras cada spawn).
- `gameOver` con motivo `spawnBlocked` se sigue emitiendo exactamente igual que antes de esta tarea (§11); el hecho de que la cola se reponga en el mismo evento de `spawnBlocked` no altera la forma de ese evento.
- `drainEvents()` sigue devolviendo los eventos en el orden real de emisión y vaciando la cola interna, sin cambios de contrato.

## 18. Atomicidad e invariantes existentes sin cambios

Esta tarea no modifica `StepInput`, `validateInput`, `EngineStepError`, `EngineOptionsError`, ni ninguna regla de precedencia de errores ya vigente (`ENGINE_NOT_RUNNING` antes que `INVALID_GAME_INPUT`, sin cambios).

Una entrada inválida, en cualquier estado del motor, sigue sin mutar:

- el contador de paso ni el tiempo lógico;
- la pieza activa ni el tablero;
- **`nextPieces`** (ampliación explícita de la invariante ya vigente para `nextPiece`: la cola tampoco es una excepción);
- los acumuladores de DAS/ARR, la prioridad horizontal, `verticalProgress`, `lockDelayElapsedMs` ni `lockResetsUsed` (sin cambios respecto de `0006`);
- el PRNG ni el estado de la bolsa;
- la cola de eventos: no se emite ningún evento.

La ampliación de la cola de una a tres piezas no altera ninguna precedencia de error existente ni introduce ningún código de error nuevo.

Esta tarea tampoco reordena, modifica ni reinterpreta el orden del paso lógico ya consolidado en `0002`/`0003`/`0005`/`0006` (movimiento horizontal → rotación → hard drop → procesamiento vertical → detección final de apoyo y lock delay → fijación/líneas/spawn). El spawn de la siguiente pieza (§10) sigue ocurriendo exactamente en el mismo punto del orden del paso lógico en que ocurría antes de esta tarea (dentro de la secuencia de fijación); esta tarea solo cambia **qué hace** ese spawn con la cola, no **cuándo** ocurre dentro del paso.

## 19. Geometría pública de piezas: inspección, alternativas y decisión

### 19.1 Inspección del contrato y renderizado reales

Confirmado por lectura de `packages/game-engine/src/index.ts` (§8 de `0002`, ampliado por `0003`) y de `apps/web/src/game/scenes/GameScene.ts` (§4.3):

- La única geometría de piezas existente en el repositorio son las tablas privadas `PIECE_ORIENTATION_CELLS: Record<PieceType, Record<Orientation, readonly Cell[]>>`, `PIECE_WIDTH: Record<PieceType, number>` y `PIECE_HEIGHT: Record<PieceType, number>`, todas internas a `packages/game-engine/src/index.ts` y no exportadas.
- No existe hoy ninguna API pública de geometría de piezas en ningún paquete (alternativa A del enunciado de la tarea: **no existe**, por lo que queda descartada por inexistente).
- `apps/web` no necesita conocer la geometría de la pieza activa para renderizarla: `GameScene.renderFrame()` itera directamente `snap.activePiece.cells`, que ya son celdas **absolutas** resueltas por el motor (`activePieceCells`), y las pinta una a una con `PIECE_COLORS[cell.type]`. Por eso, hasta esta tarea, la geometría relativa de las piezas nunca ha necesitado cruzar la frontera del paquete.
- Una previsualización de piezas en reposo (no colocadas en el tablero, no activas, sin `x`/`y` de origen) es un caso nuevo: no hay ninguna celda absoluta que pintar, porque la pieza no existe en el tablero. Se necesita, por primera vez, la geometría **relativa** de cada tipo de pieza en su orientación inicial.
- Un detalle importante de la tabla real: las celdas de `Orientation.Spawn` no siempre están normalizadas a partir de `(0, 0)`. Por ejemplo, la pieza `I` tiene sus cuatro celdas de spawn en `y = 1` (no en `y = 0`), porque las tablas de `0003` codifican cada orientación dentro de una rejilla conceptual de wall kicks (4×4 para `I`, 3×3 para el resto), no como un bounding box ajustado. Esto es un detalle interno de la implementación de SRS, irrelevante para una previsualización en reposo, y **no debe filtrarse** a `apps/web`.

### 19.2 Alternativas evaluadas

**A. Reutilizar una API pública de geometría ya existente.** Descartada: no existe ninguna hoy (§19.1).

**B. Exponer una API pública pequeña y estable para consultar la geometría base de una pieza** (función pura en `packages/game-engine`, entrada `PieceType`, salida celdas relativas normalizadas + anchura + altura). Cumple los cuatro requisitos exigidos:
- la geometría de una pieza en su orientación inicial ya es una invariante pública útil (es, de hecho, la misma tabla que ya determina cómo se renderiza y cómo colisiona la pieza activa nada más aparecer);
- no expone ninguna estructura interna mutable (se congela el resultado, ver §19.4);
- evita que `apps/web` replique las siete tablas de celdas: la web solo llama a la función con cada `PieceType` de `nextPieces`;
- encaja con el renderizado actual (mismo origen de datos que usa el motor para spawnear), con un futuro bot (que necesitará razonar sobre geometría de piezas sin depender de una pieza activa concreta) y con una futura pieza fantasma o previsualizaciones adicionales, sin diseñar de más: la función no incluye orientación, wall kicks, ni estado de pieza activa (§19.4).

**C. Incluir una proyección de preview dentro del snapshot** (por ejemplo, `nextPiecesShapes` calculado dentro de `EngineSnapshot`). Descartada: sería estrictamente más grande que la alternativa B (cada snapshot tendría que recalcular y congelar geometría para las tres piezas en cada `step()`, aunque nada haya cambiado), acoplaría un dato de presentación (geometría en reposo, sin relación con la posición real de ninguna pieza en el tablero) al contrato de estado del motor, y no ofrece ninguna ventaja de seguridad o de tamaño frente a que `apps/web` llame a una función pura bajo demanda solo para las piezas que necesita mostrar.

### 19.3 Decisión

Se adopta la **alternativa B**: una función pura y mínima `getPieceShape(type: PieceType)`, exportada por `packages/game-engine`, construida a partir de la entrada `Orientation.Spawn` de la tabla `PIECE_ORIENTATION_CELLS` ya existente (sin duplicar esa tabla) y de las tablas `PIECE_WIDTH`/`PIECE_HEIGHT` ya existentes, **normalizando** las celdas para que su mínimo `x` y su mínimo `y` sean `0` (ver el detalle del `I` en §19.1). Esto evita que `apps/web` tenga que conocer, o compensar, la convención interna de rejilla de wall kicks de `0003`.

### 19.4 Contrato

```ts
export type PieceShape = Readonly<{
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  width: number;
  height: number;
}>;

export function getPieceShape(type: PieceType): PieceShape;
```

Reglas:

- `getPieceShape` es una función libre (no un método de `GameEngine`, no requiere crear un motor): depende únicamente de `type`.
- Es pura: no muta ningún estado, no consume el PRNG, no toca la bolsa, el tablero ni ninguna pieza activa.
- `cells.length === 4` siempre.
- Las celdas están normalizadas: existe al menos una celda con `x === 0`, al menos una con `y === 0`, y todas cumplen `0 <= cell.x < width` y `0 <= cell.y < height`. En particular, para `I`, cuya entrada cruda en `PIECE_ORIENTATION_CELLS['I'][Orientation.Spawn]` tiene todas las celdas en `y = 1`, `getPieceShape('I').cells` debe devolverlas desplazadas a `y = 0` (resta del mínimo `y` real de la tabla).
- `width` y `height` son los mismos valores que ya determinan el centrado horizontal y el cálculo de `spawnY` (`PIECE_WIDTH`/`PIECE_HEIGHT`, tabla de `0002` §8): `I` → 4×1; `O` → 2×2; `T`, `S`, `Z`, `J`, `L` → 3×2.
- El resultado no incluye orientación, wall kicks, ni ningún campo relativo a una pieza activa (posición, `grounded`, lock delay, etc.).
- El resultado está congelado (`Object.freeze` en el objeto y en sus colecciones anidadas). Dos llamadas con el mismo `type` devuelven valores equivalentes en contenido; no se garantiza ni se debe asumir identidad de referencia entre llamadas.
- No se añade ningún parámetro de orientación: la función siempre describe la orientación inicial (`Orientation.Spawn`), que es la única relevante para una pieza en reposo dentro de una previsualización.

## 20. Preview técnico en la web: decisión tecnológica

### 20.1 Alternativas evaluadas

**Phaser dentro del mismo canvas.** `GameScene.ts` ya tiene acceso completo al snapshot (incluido el futuro `nextPieces`) y ya sabe dibujar celdas coloreadas con `Graphics` y `PIECE_COLORS`. Técnicamente sería la opción de menor duplicación de código de dibujo. Sin embargo:
- El canvas de Phaser mide hoy exactamente `320×640` px (`CANVAS_WIDTH`/`CANVAS_HEIGHT` de `coordinates.ts`), dimensionado 1:1 para el tablero; añadir un panel de previsualización dentro de ese mismo canvas exige ampliar esas constantes y el CSS fijo de `GameCanvas.vue` (`320px × 640px`), acoplando un cambio de layout general a lo que debería ser un cambio de datos.
- No existe hoy ninguna prueba que ejercite el renderizado real de `GameScene` (`GameCanvas.test.ts` mockea por completo `createPhaserGame`); verificar visualmente tres previsualizaciones dentro de `Graphics` de Phaser exigiría introducir infraestructura de prueba nueva (lectura de píxeles o mocks de `Graphics`) solo para esta tarea provisional.
- Añadir contenido a Phaser que después habrá que sustituir por el HUD Tactical definitivo (que, según [docs/rautfall.md](../rautfall.md), «Elementos pendientes de rediseño», corresponde a paneles Vue/CSS/SVG, no al canvas de juego) sería trabajo desechable.

**Vue + CSS.** Un componente Vue pequeño que reciba las tres piezas (`PieceType[]`) y, para cada una, pinte una rejilla CSS de `width × height` celdas usando `getPieceShape` (§19) para saber qué celdas colorear. Encaja con la arquitectura ya vigente: Vue ya aloja el `info-panel` técnico (`status`, `step`, `elapsedMs`, ayuda de controles, botón de reset) con CSS propio y sin Pinia; añadir una tarjeta más al mismo panel es el cambio de menor superficie.

**Vue + SVG.** Equivalente a la anterior pero dibujando cada celda como un `<rect>` dentro de un `<svg>`. No aporta ninguna ventaja para una rejilla estática, no escalable y sin curvas: introduce una capa de coordenadas (`viewBox`, `x`/`y` en unidades SVG) que la alternativa CSS no necesita.

**Componente técnico pequeño que reutiliza geometría pública.** Es exactamente la alternativa «Vue + CSS» ya descrita, formulada de otro modo; no es una cuarta opción independiente.

### 20.2 Criterios aplicados

- **Coherencia con la arquitectura actual:** `docs/rautfall.md` («Responsabilidades de Vue») ya prevé que Vue muestre indicadores tácticos (puntuación, combo, energía, sabotajes) y lista «Estado de reserva y tres próximas piezas» entre los «Elementos pendientes de rediseño» de ese HUD. La previsualización de próximas piezas es, conceptualmente, más cercana a esos indicadores que al tablero de juego en sí.
- **Mínima complejidad:** un componente Vue con `<div>`s y CSS es la superficie de código más pequeña de las cuatro opciones; no introduce SVG, `viewBox`, ni ninguna ampliación del canvas de Phaser.
- **Ausencia de duplicación:** con `getPieceShape` (§19) disponible, ni la opción Vue+CSS ni la opción Vue+SVG necesitan replicar ninguna tabla de celdas; solo la opción Phaser evitaría incluso la llamada a `getPieceShape` (porque ya tiene `cells` absolutas para la pieza activa), pero eso no aplica a piezas en reposo dentro de `nextPieces`, que no tienen celdas absolutas: cualquier opción, incluida Phaser, necesitaría igualmente `getPieceShape` para dibujar piezas en reposo.
- **Testabilidad:** un componente Vue se puede montar con `@vue/test-utils` y `jsdom` (patrón ya usado en `GameCanvas.test.ts`) y verificar su DOM con aserciones directas, sin mocks de `Graphics` ni lectura de píxeles.
- **Accesibilidad básica:** un `<div>`/`<span>` con texto y `aria-label` es trivialmente accesible; una previsualización dentro de un `<canvas>` de Phaser no lo es sin trabajo adicional de accesibilidad que esta tarea no debe anticipar (§6).
- **Facilidad para sustituirlo por el HUD definitivo:** un componente Vue pequeño y con una prop mínima (`readonly PieceType[]`) es trivialmente reemplazable más adelante por el panel Tactical/Industrial Dramatic definitivo, sin tocar `packages/game-engine` ni el bucle de renderizado de Phaser.

### 20.3 Decisión

Se adopta **Vue + CSS**. La previsualización se implementa como un componente Vue pequeño y provisional (§21), sin sistema de diseño, sin Tactical, sin Industrial Dramatic definitivo.

Phaser no participa en el renderizado de la previsualización: no crea una segunda escena, no consume ni modifica la cola, y sigue sin ser fuente de verdad de ningún dato de dominio.

## 21. Responsabilidades por paquete

### `packages/game-engine`

- Mantiene la cola determinista de tres próximas piezas (§8–§15).
- Expone `nextPieces` en el snapshot, con copia defensiva (§16).
- Expone `getPieceShape` como fuente de verdad de la geometría de piezas en reposo (§19).
- Garantiza inmutabilidad y determinismo en ambos casos.
- No conoce ni depende de Vue, Phaser, CSS o el DOM.

### `apps/web`

- Amplía `GamePresentationState` (`apps/web/src/game/types.ts`) con `nextPieces: readonly PieceType[]`, poblado por `GameScene.notifyState()` a partir de `snap.nextPieces` (una simple copia de datos, sin transformación de dominio).
- Añade un componente Vue pequeño que consume esa prop y `getPieceShape` para representar la previsualización (§20, §22.2).
- No genera piezas, no avanza la bolsa, no conoce el PRNG y no mantiene una cola paralela: toda la cola vive exclusivamente en `packages/game-engine`; `apps/web` solo copia, en cada notificación de estado, el contenido ya calculado por el motor.
- No replica reglas de spawn ni de geometría: usa `getPieceShape` en vez de tablas propias.

### Phaser (`GameScene.ts`, `create-phaser-game.ts`)

- Sigue renderizando el tablero y la pieza activa exactamente igual que antes de esta tarea.
- Es responsable de leer `snap.nextPieces` y copiarlo al `GamePresentationState` que ya construye en `notifyState()` (ninguna otra responsabilidad nueva).
- No representa la previsualización de próximas piezas (decisión de §20.3).
- No consume ni modifica la cola: solo la lee para reenviarla a Vue.
- No crea una segunda instancia de Phaser ni una segunda escena.

## 22. Migración de consumidores existentes

### 22.1 `packages/game-engine`

- `EngineSnapshot.nextPiece` → `EngineSnapshot.nextPieces` (§7, §16).
- Variable interna `nextPieceType: PieceType | null` → estructura de cola interna (nombre a discreción de la implementación; no es parte del contrato público, se documentará en el informe de implementación, ver §29) con longitud fija 3.
- `spawnInitialPieces()` y `spawnNextPiece()` (o los nombres internos equivalentes que la implementación decida conservar) se reescriben según §9 y §10.
- Todas las aserciones sobre `snap.nextPiece` en `packages/game-engine/src/game-engine.test.ts` (identificadas en §4.2: bloques `game over`, `snapshot`, `determinismo`, `interacciones`, `eventos — DAS, ARR, soft drop`) se migran a `snap.nextPieces`, adaptando cada aserción a la nueva forma de array (por ejemplo, una comprobación `expect(snap.nextPiece).not.toBeNull()` se convierte en `expect(snap.nextPieces).toHaveLength(3)`, y una comprobación de persistencia `expect(snapAfter.nextPiece).toBe(nextBefore)` se convierte en una comprobación de igualdad de contenido del array, no de identidad de referencia, dado que cada snapshot produce una copia nueva, §16).

### 22.2 `apps/web`

- `apps/web/src/game/types.ts`: `GamePresentationState` gana `nextPieces: readonly PieceType[]` (importando el tipo `PieceType` desde `@rautfall/game-engine`, que ya es una dependencia existente del paquete web a través de `GameScene.ts`).
- `apps/web/src/game/types.test.ts`: la prueba que comprobaba «el estado enviado a Vue contiene solo status, step y elapsedMs» (tres claves) se actualiza para reflejar las cuatro claves vigentes (`status`, `step`, `elapsedMs`, `nextPieces`). La aserción `expect('nextPiece' in state).toBe(false)` (en singular) se conserva sin cambios: sigue siendo cierta, porque el campo singular no existe; se añaden aserciones nuevas sobre la presencia y la forma de `nextPieces` (por ejemplo, longitud 3 en un estado de ejemplo).
- `apps/web/src/game/scenes/GameScene.ts`: `notifyState()` incluye `nextPieces: snap.nextPieces` en el objeto que construye. La comparación de deduplicación (que hoy solo compara `status`, `step` y `elapsedMs` como primitivos) se amplía para comparar también `nextPieces` por contenido (no por referencia, ya que cada snapshot produce un array nuevo), de modo que `onStateUpdate` no se invoque de más cuando ningún campo observable ha cambiado realmente, ni deje de invocarse cuando solo `nextPieces` cambia (por ejemplo, justo después de un spawn, si `step`/`elapsedMs`/`status` coincidieran con la última notificación, lo cual no ocurre en la práctica porque `step` avanza en cada `step()`, pero la comparación debe ser correcta igualmente).
- Se añade un nuevo componente Vue (§20.3) que consume `nextPieces` desde el estado ya expuesto por `App.vue`/`GameCanvas.vue` y `getPieceShape` desde `@rautfall/game-engine`.
- `apps/web/src/App.vue` integra el nuevo componente dentro del `info-panel` ya existente, sin rediseñar el layout general ni introducir un panel industrial definitivo.

### 22.3 Documentos históricos

Las especificaciones de tareas anteriores (`docs/tasks/0001` a `docs/tasks/0006`) y sus informes de implementación (`docs/implementation/0001` a `docs/implementation/0006`) mencionan `nextPiece` como parte de su descripción del contrato vigente en el momento en que se escribieron. Son documentos inmutables y **no se modifican** en esta tarea, ni siquiera para corregir la terminología: describen fielmente el estado histórico del proyecto, no el estado actual.

## 23. Configuración y dependencias

- `packages/game-config` **no se modifica** en esta tarea: no se añade ninguna propiedad relativa al tamaño de la cola, ni a la geometría de piezas, ni de ningún otro tipo. Ni el esquema (`gameConfigSchema`), ni `prototypeConfig`, ni `collectRelationalIssues` cambian.
- La longitud de la cola (3) y la geometría de las piezas son invariantes del dominio, no parámetros de configuración, coherente con la sección «Elementos no configurables» de [docs/rautfall.md](../rautfall.md).
- No se añade ninguna dependencia nueva en ningún paquete (`packages/game-engine`, `packages/game-config`, `apps/web`) para esta tarea. No se modifica `pnpm-lock.yaml`.
- No se introduce Pinia, Vue Router, ni ninguna biblioteca de gráficos o de sistema de diseño para la previsualización: el componente Vue usa exclusivamente plantillas y CSS ya soportados por el stack actual.

## 24. Pruebas mínimas del motor

Aplicar TDD pragmático en `packages/game-engine` (lógica de dominio, determinismo). Las pruebas deben verificar comportamiento observable, invariantes y contratos, sin depender innecesariamente de detalles internos (nombres exactos de variables de estado privado, por ejemplo, no deben aparecer en aserciones de test). Como mínimo:

### 24.1 Creación

- `nextPieces` tiene longitud exactamente 3 inmediatamente tras `createGameEngine`, sin necesidad de llamar a `step()`.
- El orden de `nextPieces` es determinista para una semilla dada.
- La pieza activa inicial es distinta (no está duplicada dentro) de las piezas consumidas para la cola, en el sentido de que ambas provienen de extracciones consecutivas de la misma bolsa sin repetición dentro del mismo ciclo de bolsa.
- La misma semilla produce la misma pieza activa inicial y la misma `nextPieces` inicial.
- Semillas diferentes pueden producir `nextPieces` iniciales distintas.

### 24.2 Consumo tras fijación

- Tras una fijación válida que produce un spawn exitoso, `nextPieces[0]` (antes del spawn) pasa a ser `activePiece.type` (después del spawn).
- Las posiciones 1 y 2 de la cola anterior avanzan a las posiciones 0 y 1 de la cola posterior.
- Se añade exactamente una nueva pieza en la posición 2 de la cola posterior.
- `nextPieces.length` permanece en 3 antes y después de cada spawn.
- Se emite `pieceSpawned` con la candidata activada, y solo con ella (no con ninguna otra pieza de la cola).
- No se emite ningún evento adicional por la reposición de la cola.

### 24.3 Cruce de frontera de bolsa

- Existe al menos una prueba que fuerza deliberadamente que `nextPieces` contenga piezas de dos bolsas consecutivas (por ejemplo, consumiendo pasos hasta dejar una o dos piezas restantes en la bolsa actual antes de inspeccionar la cola).
- No se pierde ni se duplica ninguna pieza al cruzar la frontera: cada grupo completo de siete piezas consumidas (activa + repuestas de cola, contadas en el orden real de extracción) contiene exactamente las siete formas sin repetición.
- El comportamiento en el cruce de frontera es determinista para una semilla dada.

### 24.4 Game over

- La candidata bloqueada se consume (no permanece en `nextPieces`).
- `activePiece` queda `null`.
- El estado pasa a `gameOver`.
- La cola final tiene longitud 3, sin huecos ni `null`.
- Se emite `gameOver` con motivo `spawnBlocked`.
- No se emite `pieceSpawned`.

### 24.5 Reset

- `reset()` descarta cualquier `nextPieces` previa por completo (no se mezcla con la nueva secuencia).
- `reset()` usa la nueva semilla para generar tanto la pieza activa como las tres nuevas próximas piezas.
- El mismo `reset()` (misma semilla y configuración) repetido produce el mismo resultado.
- Los eventos de `reset()` (exactamente un `engineReset`, sin `engineStarted` ni `pieceSpawned`) permanecen intactos.

### 24.6 Inmutabilidad

- El array devuelto en `nextPieces` está congelado; intentar mutarlo no debe afectar al motor.
- Dos snapshots sucesivos no comparten la misma referencia de array para `nextPieces` que pueda verse afectada por una mutación interna posterior (§16).
- `getPieceShape`, si se invoca varias veces con el mismo tipo, no expone ninguna estructura mutable que permita alterar el resultado de invocaciones futuras.

### 24.7 Atomicidad

- Una entrada inválida no cambia `nextPieces` (ni su contenido ni su longitud).
- `ENGINE_NOT_RUNNING` mantiene su precedencia sobre `INVALID_GAME_INPUT`, sin relación con la cola.
- `drainEvents()` no altera `nextPieces`.

### 24.8 Regresión

- Lock delay sigue funcionando exactamente como en `0006` (temporizador, reinicios, límite de reinicios, hard drop incondicional).
- DAS/ARR y prioridad horizontal siguen funcionando exactamente como en `0005`.
- Soft drop y hard drop siguen funcionando.
- SRS (rotación y wall kicks) sigue funcionando.
- El orden de emisión de eventos dentro de un mismo `step()` no cambia.

### 24.9 Geometría de piezas

- `getPieceShape(type)` devuelve exactamente 4 celdas para cada uno de los siete tipos.
- Las celdas devueltas están normalizadas: el mínimo `x` y el mínimo `y` entre las celdas son `0` para los siete tipos, incluida `I` (cuya tabla interna cruda no está normalizada, §19.1).
- `width`/`height` coinciden con la tabla de `0002` §8 (`I`: 4×1; `O`: 2×2; `T`/`S`/`Z`/`J`/`L`: 3×2).
- El resultado está congelado.
- `getPieceShape` no requiere crear un motor ni pasar ningún estado de pieza activa.

## 25. Pruebas mínimas de la web

- La previsualización renderiza tres elementos, uno por cada posición de `nextPieces`.
- El orden de las tres previsualizaciones coincide con el orden de `nextPieces` recibido (primera, segunda y tercera posición claramente diferenciadas, §26).
- Tras un spawn simulado (cambio de la prop `nextPieces` recibida), la previsualización se actualiza para reflejar la nueva cola.
- Se prueba explícitamente la representación de piezas con bounding boxes distintos: al menos `I` (4×1), `O` (2×2) y una pieza de 3×2 (por ejemplo, `T`).
- Ni el componente ni su prueba duplican ninguna tabla de celdas propia: ambos obtienen la geometría exclusivamente a través de `getPieceShape` importado de `@rautfall/game-engine`.
- El componente no crea ninguna cola local paralela ni importa `createGameEngine`.
- La prueba no requiere temporizadores reales (no hay animaciones que esperar, §6).
- La suite existente de `apps/web` (`GameCanvas.test.ts`, `types.test.ts`, `input-buffer.test.ts`, `time-adapter.test.ts`, `coordinates.test.ts`, `input-debug.test.ts`, `workspace.test.ts`) sigue en verde tras la ampliación de `GamePresentationState`; solo se adaptan las aserciones de `types.test.ts` estrictamente necesarias (§22.2).
- No se introduce doble drenaje de eventos: `GameScene.update()` sigue llamando a `engine.drainEvents()` una única vez por frame, sin cambios respecto de `0006`.
- El diagnóstico opt-in de entrada de `0005`/`0006` (`apps/web/src/game/input-debug.ts`, activado con `?inputDebug=1`) sigue funcionando sin cambios: esta tarea no añade ni elimina ningún evento del motor, por lo que su comportamiento no se ve afectado.
- No se introduce Playwright.

## 26. Accesibilidad y semántica

Aunque la previsualización sea provisional:

- Debe existir un texto o etiqueta comprensible equivalente a «Próximas piezas» (en castellano, coherente con el resto de la interfaz técnica de `App.vue`), visible como encabezado de la sección.
- El orden de las tres piezas debe poder inferirse sin depender exclusivamente del color: cada previsualización debe incluir, en el DOM (de forma visible o mediante atributo de accesibilidad), un indicador de orden (por ejemplo, «1», «2», «3», o «Siguiente», «+1», «+2») y el tipo de pieza como texto (por ejemplo, la letra `I`/`O`/`T`/`S`/`Z`/`J`/`L`), de modo que tanto el orden como el tipo sean recuperables sin depender únicamente del color de fondo.
- No es necesario hacer cada previsualización interactiva (sin `tabindex`, sin manejadores de clic ni de teclado).
- No se añaden controles falsos ni botones sin función.
- No se dedica infraestructura específica de accesibilidad (por ejemplo, gestión de foco, `aria-live`, atajos de teclado) a esta tarea: basta con texto legible y estructura semántica básica (encabezado + lista o contenedores con etiquetas claras).

## 27. Validación manual futura

Antes de declarar la tarea completada, además de las validaciones automáticas (§28), realizar con `pnpm dev`:

- Comprobar que se muestran tres piezas en la previsualización, en el orden correcto.
- Fijar una pieza y comprobar que la primera previsualización pasa a ser la pieza activa, sin saltos ni piezas repetidas o perdidas.
- Comprobar que la cola avanza sin saltos tras varias fijaciones consecutivas.
- Jugar varias piezas hasta cruzar al menos una frontera de bolsa y comprobar que la previsualización sigue siendo coherente (sin piezas repetidas dentro de un mismo grupo de siete).
- Reiniciar (`R` o el botón de reset) y comprobar que la secuencia de piezas (activa y próximas) vuelve a ser determinista con la misma semilla fija del prototipo (`FIXED_SEED = 42` en `GameScene.ts`).
- Comprobar que no se ha alterado la sensación de control: movimiento, rotación, gravedad, DAS/ARR, soft drop, hard drop y lock delay se sienten exactamente igual que antes de esta tarea.
- Comprobar que no aparecen previsualizaciones corruptas, vacías, desalineadas o con celdas fuera de su rejilla (en particular, comprobar visualmente la pieza `I`, cuya geometría cruda no está normalizada en la tabla interna, §19.1).

## 28. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Todos deben finalizar correctamente. El aviso de Vite/Rollup sobre un chunk superior a 500 kB (atribuible principalmente a Phaser) puede continuar apareciendo y no bloquea esta tarea; no se resuelve mediante límites artificiales de tamaño ni mediante code splitting (§6).

Además, revisar:

- `git diff --check` no reporta problemas de espacio en blanco.
- No existen imports profundos entre paquetes.
- No se han añadido dependencias no justificadas.
- No existe código muerto (en particular, ninguna referencia residual a `nextPiece` en singular, ni ninguna variable interna del motor que quede sin uso tras la migración a la cola).
- No hay abstracciones innecesarias ni arquitectura preventiva para tareas futuras (HUD Tactical definitivo, hold, pieza fantasma, más de tres próximas piezas, tamaño de cola configurable).
- No se ha ampliado el alcance más allá de §5.
- No hay errores ni avisos de lint ignorados.

## 29. Documentación y cierre futuro

Este documento ([docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md](0007-cola-proximas-piezas-preview-tecnico.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá:

- crear [docs/implementation/0007-cola-proximas-piezas-preview-tecnico.md](../implementation/0007-cola-proximas-piezas-preview-tecnico.md) como informe de implementación independiente, con:
  - resumen;
  - archivos creados y modificados;
  - migración exacta de `nextPiece` a `nextPieces` (nombres internos elegidos para la estructura de cola, si difieren de los usados en esta especificación);
  - diseño interno final de la cola (extracción, reposición, orden de operaciones real frente al descrito en §10);
  - tratamiento final del `gameOver` por spawn bloqueado;
  - decisión final sobre la geometría pública (`getPieceShape`), incluida cualquier desviación respecto de §19;
  - decisión final sobre la tecnología de la previsualización (Vue/CSS, según §20), incluida cualquier desviación;
  - pruebas añadidas o adaptadas, tanto en el motor como en la web, y por qué;
  - número final de tests;
  - comandos ejecutados y resultados;
  - desviaciones respecto de esta especificación, si las hubo, y su justificación;
  - deuda técnica identificada (por ejemplo, ausencia de HUD definitivo, previsualización sin estilo Industrial Dramatic);
  - confirmación explícita de la ausencia del alcance excluido (§6);
  - confirmación de que no se hicieron commits;
- actualizar [docs/project-status.md](../project-status.md): estado de `0007` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y una nota sobre la siguiente tarea (ver §31, sin fijarla de forma definitiva).

Esta especificación no crea esos documentos ahora.

## 30. Criterios de aceptación

### Contrato público

- `EngineSnapshot` expone `nextPieces: readonly PieceType[]` y ya no expone `nextPiece`.
- `nextPieces.length === 3` en todo snapshot observado, tanto en `running` como en `gameOver`.
- `packages/game-engine` exporta `getPieceShape(type: PieceType): PieceShape`, pura, congelada, sin orientación ni wall kicks.
- `ActivePieceSnapshot`, `StepInput`, `GameEvent`, `MoveReason` y `GameConfig` no cambian de forma.
- No se añade ningún código de error nuevo ni ningún evento nuevo.

### Semántica exacta

- El spawn tras fijación sigue el orden: extraer candidata, reponer cola, intentar spawn, activar o finalizar partida, emitir eventos (§10).
- `spawnBlocked` consume la candidata, repone la cola a longitud 3, no emite `pieceSpawned`, y sí emite `gameOver` (§11).
- La cola puede cruzar fronteras de bolsa sin perder ni duplicar piezas (§15).
- El determinismo se conserva exactamente (§14).

### Web

- `apps/web` muestra tres previsualizaciones, ordenadas, con geometría coherente con las piezas reales, obtenida exclusivamente vía `getPieceShape`.
- `apps/web` no genera piezas, no avanza la bolsa, no conoce el PRNG y no mantiene una cola paralela.
- La previsualización es accesible en el sentido mínimo descrito en §26.

### Ausencia de alcance adicional

- No existe hold, pieza fantasma, puntuación, combos, T-Spins, `back-to-back`, energía, sabotajes, batalla, bot, pausa, audio, HUD Tactical definitivo, más de tres próximas piezas, tamaño de cola configurable, Pinia, Vue Router, Playwright, ni cambios de code splitting o del aviso de chunk.
- No se añadió ninguna propiedad de configuración nueva ni ninguna dependencia nueva.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

### Puertas de calidad

- `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan correctamente.
- `git diff --check` no reporta problemas.
- El aviso de chunk de Phaser puede continuar sin bloquear la tarea.

## 31. Próxima tarea

A definir en su propia especificación tras completar `0007`, validar manualmente la cola de próximas piezas y revisar la previsualización técnica. Esta especificación no fija una `0008` definitiva: candidatas razonables mencionadas en `docs/rautfall.md` y en el cierre de `0006` (hold, pieza fantasma, pausa, indicador visual de lock delay, consolidación visual del HUD) no se asumen automáticamente como alcance de la siguiente tarea hasta que se redacte su propia especificación, una vez comprobado si conviene abordar alguna de ellas a la luz del estado real del proyecto tras `0007`.
