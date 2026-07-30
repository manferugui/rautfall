# 0013 — Puntuación y combos

## 1. Estado y precedencia

- **Proyecto:** Rautfall
- **Tarea:** 0013 — Puntuación y combos
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0013`. Las decisiones globales de producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla, el bot, la energía de combate o los sabotajes pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0013-puntuacion-combos.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0013-puntuacion-combos.md) (ver §36), siguiendo la convención de rutas de `AGENTS.md`.
- Ninguna especificación anterior (`0001`–`0012`) se modifica como parte de esta tarea. Esta especificación no contradice ninguna de ellas; donde se apoya en un contrato o comportamiento ya fijado por una tarea anterior, lo cita explícitamente y lo conserva sin cambios salvo que se indique lo contrario de forma explícita.

## 2. Objetivo

Añadir **puntuación** y **combos** al modo Training (`packages/game-engine`), con su integración mínima de presentación en `apps/web`, delimitando de forma conservadora la decisión global «puntuación, combos y energía» de [docs/rautfall.md](../rautfall.md) (§680–746): esta tarea implementa únicamente la puntuación por eliminación de líneas, el combo asociado y la puntuación por caída (blanda e instantánea). No implementa energía de combate, T-Spins, `back-to-back`, ranking ni persistencia.

Al terminar la tarea:

- `EngineSnapshot` expone `score: number` y `combo: number`, ambos calculados exclusivamente por el motor;
- el motor implementa la tabla de puntos por eliminación simultánea de líneas, la regla de combo y la puntuación por caída, sin que `apps/web` decida ninguna regla de dominio;
- `apps/web` (Vue) muestra `score` y `combo` reales, leídos directamente del snapshot vía `GamePresentationState`, sin recalcular ni duplicar ninguna regla;
- no se añade ningún evento de dominio nuevo (§16);
- no se añade energía de combate, T-Spins, `back-to-back`, sabotajes, bot, batalla, backend, audio, animaciones, perfiles de dificultad ni persistencia.

## 3. Fuentes de verdad

En este orden, según `AGENTS.md`:

1. [AGENTS.md](../../AGENTS.md).
2. [docs/rautfall.md](../rautfall.md) — decisión funcional citada explícitamente en esta especificación: «Decisión funcional: puntuación, combos y energía» (§680–746: tres tipos de habilidad premiada, separación puntuación/energía, tabla de valores iniciales, reglas de combo, T-Spins, `back-to-back`, caídas); «Configuración, modos y dificultad» (§474–539: `training` sin bot/sabotajes/muerte súbita, ámbitos configurables por perfil); pantalla de resultados (§1727–1750, fuera de alcance, ver §6); estrategia de pruebas (§747–789, en particular «la puntuación no disminuye»).
3. Las especificaciones inmutables de `docs/tasks/`, en particular:
   - [0002 — Motor de juego determinista](0002-motor-de-juego-determinista.md): spawn, colisión, fijación, `clearLines`, game over por `spawnBlocked`, eventos base, `clearedLines`.
   - [0005 — DAS, ARR y soft drop](0005-das-arr-soft-drop.md): acumulador vertical único (`VERTICAL_CELL_UNIT`), `MoveReason` con `'softDrop'`/`'gravity'`, contrato `StepInput`.
   - [0006 — Lock delay y fijación diferida](0006-lock-delay-fijacion-diferida.md): fijación diferida, `lockAndProcess`, orden del paso lógico vigente, invariante de que la fijación puede ocurrir en distintos puntos del paso.
   - [0007 — Cola de próximas piezas y preview técnico](0007-cola-proximas-piezas-preview-tecnico.md): precedente de ubicar en `EngineSnapshot` de nivel superior un dato que sobrevive a `gameOver` y no está ligado 1:1 a la pieza activa; precedente de ampliación de `GamePresentationState`.
   - [0009 — Marco Tactical](0009-marco-tactical-identidad-visual-industrial-dramatic.md) y [0009b](0009b-refinamiento-visual-marco-tactical.md): estructura de `.tactical-console`, `.console-section`, `.console-divider`; separación explícita entre datos reales y datos simulados (`CombatStatusPanel.vue`, `simulated-tactical-data.ts`).
   - [0010 — E2E mínimo](0010-e2e-minimo-flujo-esencial.md): convención `data-testid`, criterio de no forzar secuencias largas o frágiles en Playwright.
   - [0011 — Pieza fantasma determinista](0011-pieza-fantasma-determinista.md): precedente de **no** añadir un campo a `EngineSnapshot`/`GamePresentationState` cuando no existe consumidor real.
   - [0012 — Reserva de pieza / hold](0012-reserva-pieza-hold.md): mismo precedente aplicado explícitamente a `holdUsed` (no se amplía `GamePresentationState` sin consumidor real); orden lógico vigente del paso; convención de nomenclatura `describe` por prefijo (`reserva - …`).
4. Los informes de `docs/implementation/` correspondientes a las tareas citadas, para confirmar el estado real tras cada tarea (no solo lo especificado). En particular, [0012](../implementation/0012-reserva-pieza-hold.md) confirma 361 tests Vitest y 1 test E2E en verde en el momento de redactar esta especificación.
5. El estado real del código y Git, confirmado por lectura directa:
   - `packages/game-engine/src/index.ts` (1241 líneas).
   - `packages/game-engine/src/game-engine.test.ts` (5511 líneas, 55 bloques `describe` de nivel superior o anidado).
   - `packages/game-config/src/index.ts`.
   - `apps/web/src/App.vue`, `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/game/types.ts`.
   - `apps/web/src/components/HeldPiecePreview.vue`, `NextPiecesPreview.vue`, `CombatStatusPanel.vue`.
   - `apps/web/src/presentation/simulated-tactical-data.ts` (confirmado: sin ningún placeholder simulado de puntuación o combo).
   - `apps/web/e2e/essential-flow.spec.ts`.
   - `docs/project-status.md` (361 tests Vitest, 1 test E2E, working tree limpio, rama `main`, HEAD `c2f4754` en el momento de redactar esta especificación).

## 4. Contexto técnico heredado (inspección previa)

Confirmado por lectura directa del código real, no por suposición.

### 4.1 `EngineSnapshot`, `ActivePieceSnapshot` y `StepInput` reales

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;
}>;
```

`ActivePieceSnapshot` (`index.ts:56-67`) expone `type`, `x`, `y`, `orientation`, `cells`, `grounded`, `lockDelayElapsedMs`, `lockResetsUsed`, `landingCells`, `holdUsed`. `StepInput` (`index.ts:108-118`) no cambia de forma en esta tarea: ningún campo nuevo de entrada es necesario, porque la puntuación es enteramente derivada de acciones ya representadas (`softDropHeld`, `hardDrop`, fijación) — no existe ninguna «acción de puntuar» que el jugador solicite explícitamente.

### 4.2 Orden lógico vigente del paso (`processStep`, `index.ts:890-1001`)

```text
1. Comprobar estado del motor (ENGINE_NOT_RUNNING)         — en step(), antes de processStep
2. Validar entrada (INVALID_GAME_INPUT)                     — en step(), antes de processStep
3. Incrementar contador de paso                              — en step()
4. Incrementar tiempo lógico                                 — en step()
5. Reserva (hold)                                             — processStep, termina el paso si se ejecuta
6. Movimiento horizontal (processHorizontal)
7. Rotación (tryRotate)
8. Hard drop (fija, elimina líneas, spawnea, return)
9. Gravedad o soft drop (processVertical, solo si no hubo 8)
10. Detección final de apoyo y avance de lock delay (puede fijar y spawnear)
```

### 4.3 Dos implementaciones independientes de «fijar + eliminar líneas + spawnear» (hallazgo clave de la auditoría)

`lockAndProcess()` (`index.ts:593-609`):

```ts
function lockAndProcess(): void {
  lockActivePiece();
  const lineIndices = clearLines();
  if (lineIndices.length > 0) {
    eventQueue.push({ type: 'linesCleared', step: currentStep, lines: lineIndices.length, lineIndices: Object.freeze([...lineIndices]) });
  }
  spawnNextPiece();
}
```

Se invoca desde tres puntos: el límite de reinicios de lock delay alcanzado durante el movimiento horizontal (`index.ts:731`), el mismo límite alcanzado durante la rotación (`index.ts:944`), y la expiración del temporizador de lock delay (`index.ts:993`).

El bloque de hard drop (`index.ts:960-978`) **duplica exactamente la misma secuencia** en línea, sin llamar a `lockAndProcess()`:

```ts
if (input.hardDrop && activePiece) {
  const distance = hardDropDistance(board, activePiece);
  if (distance >= 1) {
    activePiece.y += distance;
    eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'hardDrop' });
  }
  lockActivePiece();
  const lineIndices = clearLines();
  if (lineIndices.length > 0) {
    eventQueue.push({ type: 'linesCleared', step: currentStep, lines: lineIndices.length, lineIndices: Object.freeze([...lineIndices]) });
  }
  spawnNextPiece();
  return;
}
```

Tras el movimiento inicial de hard drop (`activePiece.y += distance` y su evento `pieceMoved`), el resto es literalmente idéntico a `lockAndProcess()`. Esta duplicación es relevante para esta tarea: si la puntuación por líneas/combo se implementara por separado en ambos sitios, existiría un riesgo real de divergencia entre el hard drop y el resto de vías de fijación (violación directa de «no duplicar la fuente de verdad», criterio de diseño obligatorio de esta tarea). §17 y §20 fijan la corrección de este hallazgo como parte necesaria y mínima de esta tarea.

### 4.4 Acumulador vertical único (`processVertical`, `index.ts:862-888`)

Gravedad y soft drop comparten `verticalProgress` (unidad `VERTICAL_CELL_UNIT = 1000` por celda, `0005`). Cada vez que `verticalProgress >= 1000`, el motor resta la unidad y, si no hay colisión, mueve la pieza una celda y emite `pieceMoved` con `reason: 'softDrop'` o `reason: 'gravity'` según `input.softDropHeld` en ese paso — nunca ambos a la vez dentro de la misma llamada, porque `softDropHeld` no cambia a mitad de un `processVertical`. Un intento de descenso bloqueado por colisión **no** mueve la pieza, no emite evento y no fija: la unidad de progreso ya se ha consumido, y el lock delay decide la fijación más tarde. Esto significa que, dentro de una sola llamada a `processVertical`, el número de celdas realmente descendidas es determinista y se puede obtener comparando `activePiece.y` antes y después de la llamada — sin necesitar contar eventos.

### 4.5 Distancia de hard drop ya calculada

`hardDropDistance(board, activePiece)` (`index.ts:425-434`) ya calcula la distancia real de caída antes de mover la pieza, y el propio bloque de hard drop la usa (`const distance = ...`). No es necesario ningún cálculo adicional: la distancia real está disponible en el mismo punto donde debe puntuarse.

### 4.6 `clearedLines` es un contador acumulado de partida, no de la fijación actual

`clearedLines` (`EngineSnapshot`) se incrementa dentro de `clearLines()` (`index.ts:631`) con el número de líneas eliminadas en cada fijación, mostrando el **total acumulado** desde el inicio de la partida (o desde el último `reset()`). El número de líneas eliminadas en la fijación actual solo existe, hoy, como variable local (`lineIndices.length`) y como campo del evento `linesCleared.lines`. La tabla de puntos (§9) necesita ese número por fijación, no el acumulado.

### 4.7 Cota máxima de líneas simultáneas

El tablero tiene 10 columnas y la pieza más alta (`I`) ocupa 4 filas en orientación vertical (`PIECE_HEIGHT.I = 4`); ninguna pieza puede completar más de 4 filas en una sola fijación. Esta cota (ya vigente desde `0002`) hace que la tabla de puntos (§9) solo necesite cubrir 1 a 4 líneas, sin caso por defecto ni validación adicional en tiempo de ejecución.

### 4.8 `GamePresentationState` y el canal Phaser→Vue

```ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;
}>;
```

`GameScene.notifyState()` (`GameScene.ts:528-552`) construye este objeto a partir de `engine.getSnapshot()` tras cada lote de pasos lógicos, y lo entrega a Vue solo cuando cambia respecto del último estado notificado (comparación campo a campo). Vue nunca llama a `engine.getSnapshot()` directamente (confirmado desde `0004`, sin cambios): el único canal es `GamePresentationState`.

### 4.9 Ausencia total de placeholders simulados de puntuación o combo

`apps/web/src/presentation/simulated-tactical-data.ts` y `CombatStatusPanel.vue` (`0009`/`0009b`) simulan **energía**, **cartucho** y **Residuos** — nunca puntuación ni combo. No existe ningún texto, contador o placeholder de puntuación/combo en ningún componente Vue actual. Esta tarea no sustituye ningún dato simulado existente: añade un dato real completamente nuevo.

### 4.10 Cobertura actual de Playwright

`apps/web/e2e/essential-flow.spec.ts` (63 líneas) cubre: carga de la aplicación, estado inicial `running` con próximas piezas/reserva/paneles simulados visibles, pausa, reanudación y reinicio, todo mediante controles reales de la interfaz y `data-testid`. No ejercita ninguna mecánica de dominio (movimiento, rotación, hard drop, eliminación de líneas): esa cobertura vive en las pruebas de motor (Vitest).

## 5. Alcance incluido

- Ampliación de `EngineSnapshot` con `score: number` y `combo: number` (§15).
- Tabla de puntos por eliminación simultánea de 1 a 4 líneas, como constantes internas de `packages/game-engine` (§8, §9).
- Regla de combo completa: inicio, crecimiento, ruptura (§12) y su fórmula de bonificación (§13).
- Puntuación por soft drop y por hard drop, proporcional a la distancia real descendida (§10, §11).
- Corrección de la duplicación descrita en §4.3: el hard drop invoca `lockAndProcess()` en vez de duplicar su secuencia (§17, §20), como cambio mínimo estrictamente necesario para que la puntuación por líneas/combo tenga una única implementación.
- Migración de todo consumidor real de `EngineSnapshot`/`GamePresentationState` afectado por los campos nuevos (`GamePresentationState`, literales de test existentes) (§28, §31).
- Nuevo componente Vue pequeño y provisional que muestra `score` y `combo` reales, integrado en la `.tactical-console` existente (§29).
- Pruebas de motor (TDD pragmático) que cubren todas las reglas fijadas en esta especificación (§30).
- Pruebas web mínimas para los cambios reales de `apps/web` (§31).
- Una única ampliación puntual y justificada del E2E existente (§32).

## 6. Alcance explícitamente excluido

No pertenece a `0013`:

- Energía de combate, cartuchos, sabotajes (incluido cualquier vínculo entre puntuación y energía).
- T-Spins (ninguna clasificación, detección ni puntuación) y `back-to-back`.
- Batalla, bot, multijugador local, backend, persistencia, ranking, historial.
- Pantalla de resultados postpartida (`docs/rautfall.md` §1727–1750): «Puntuación final», «Combo máximo» y demás campos de esa pantalla no se implementan aquí; no existe hoy ninguna pantalla de resultados en el prototipo, y esta tarea no la crea.
- Audio, partículas, animaciones, flashes o cualquier efecto asociado al crecimiento o ruptura del combo (`docs/rautfall.md` §714 lo reserva explícitamente para cuando exista audio/efectos, fuera de alcance de `0013`).
- Niveles, multiplicadores de velocidad de caída o dificultad progresiva.
- Cualquier campo de configuración nuevo en `packages/game-config` (§8.3 justifica por qué la tabla de puntos y la fórmula de combo son invariantes de código en esta tarea).
- `maxCombo` o cualquier otro campo derivado de puntuación sin consumidor real en esta tarea (§15.3).
- Cualquier evento de dominio nuevo (§16 justifica por qué no se añade ninguno).
- Remapeo de controles, nuevas teclas: la puntuación no introduce ninguna acción de entrada nueva (§4.1).
- Rediseño del marco Tactical Industrial Dramatic, del monitor rival o del panel de combate simulado.
- Ampliación general del E2E más allá de lo estrictamente justificado en §32.
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §5.

## 7. Terminología y modelo conceptual

- **Puntuación (`score`):** magnitud acumulada de rendimiento del jugador durante la partida en curso, expuesta como `EngineSnapshot.score`. Nunca disminuye (`docs/rautfall.md` §776).
- **Combo:** cadena de fijaciones consecutivas que eliminan al menos una línea cada una, expuesta como `EngineSnapshot.combo`. Es una propiedad de la partida en curso, no de la pieza activa concreta (§15.1).
- **Longitud del combo:** valor entero de `combo`; `0` significa ausencia de cadena activa; `1` significa que la fijación más reciente eliminó líneas y es la primera de una posible cadena; `n` (`n ≥ 2`) significa que las últimas `n` fijaciones consecutivas han eliminado líneas cada una.
- **Bonificación de combo:** puntos adicionales otorgados por mantener una cadena, sumados a los puntos base de la eliminación de líneas (§13).
- **Puntuación por líneas:** puntos otorgados según el número de líneas eliminadas simultáneamente en una única fijación (§9), independiente de la bonificación de combo.
- **Puntuación por caída (`drop score`):** puntos otorgados por celdas realmente descendidas mediante soft drop o hard drop (§10, §11); nunca por gravedad normal (§19).
- **Ruptura del combo:** transición de `combo > 0` a `combo = 0`, provocada exclusivamente por una fijación que no elimina ninguna línea (§12).

## 8. Modelo de puntuación

### 8.1 Dos fuentes de puntos, independientes y acumulativas

`score` se incrementa por exactamente dos tipos de evento de dominio, nunca simultáneos dentro del mismo cálculo:

1. **Puntuación por caída** (§10, §11): proporcional a la distancia vertical real descendida por soft drop o hard drop. Se concede en el momento del movimiento real, dentro del mismo `step()` en que ocurre ese movimiento.
2. **Puntuación por líneas y combo** (§9, §12, §13): concedida en el momento en que una pieza se fija y se determina cuántas líneas elimina esa fijación. Estas dos componentes (puntos base por líneas + bonificación de combo) se calculan y se suman a `score` en el mismo instante, como una única operación atómica (§17).

Ambas fuentes son independientes: un hard drop que además completa líneas otorga primero los puntos de caída (por la distancia) y, en la misma llamada a `step()`, los puntos de líneas/combo (por la fijación resultante) — ver §20 para el orden exacto y la prueba «Eliminación posterior a hard drop suma correctamente caída, líneas y combo» (§30.9).

### 8.2 Separación respecto de la energía de combate

`docs/rautfall.md` (§690–695) fija que puntuación y energía de combate son magnitudes separadas, con la energía «no convertible directamente» desde la puntuación. Esta tarea no implementa energía en absoluto (§6): no existe ningún campo, cálculo ni tabla de energía en `packages/game-engine` como resultado de `0013`. La separación conceptual ya queda garantizada por la ausencia total de energía funcional, sin necesitar ningún mecanismo adicional de aislamiento.

### 8.3 La tabla y la fórmula son invariantes de código, no de `packages/game-config`

**Decisión:** los valores de la tabla de puntos (§9), la fórmula de bonificación de combo (§13) y los puntos por celda de caída (§10, §11) se implementan como constantes privadas de módulo dentro de `packages/game-engine/src/index.ts`, en el mismo estilo que `VERTICAL_CELL_UNIT`, `BOARD_COLS` o `HIDDEN_ROWS` — **no** se añaden a `GameConfig` (`packages/game-config`).

Justificación:

- `docs/rautfall.md` (§482–503) prevé que la configuración por perfil (`training`, `battleEasy`, `battleNormal`, `battleHard`) module «energía necesaria y recompensas por líneas o combos», pero el prototipo actual solo tiene un perfil real (`prototypeConfig`, sin distinción `training`/`battle`); no existe hoy ningún consumidor que necesite dos tablas de puntos distintas. Añadir estos valores a `GameConfig` sería anticipar una arquitectura de perfiles múltiples que esta tarea no construye (`AGENTS.md`, «no anticipar arquitectura destinada a tareas futuras»).
- `docs/rautfall.md` (§706) ya califica estos valores como «hipótesis configurables [que] deberán equilibrarse mediante simulaciones y pruebas humanas» — es decir, la propia fuente de verdad global anticipa que **en algún momento futuro** (una tarea de balance, o la introducción real de perfiles de batalla) estos números se muevan a configuración. Ese momento no es `0013`: esta tarea fija los valores iniciales exactos ya propuestos en la petición de la tarea (§9) como invariantes de código, exactamente igual que `lockDelayMs`/`maxLockResets` sí están en `GameConfig` (porque ya existen múltiples valores probados y una necesidad real de ajustarlos por prueba de juego) mientras que, por ejemplo, `BOARD_COLS`/`BOARD_ROWS` no lo están (invariantes fundamentales del dominio, `docs/rautfall.md` §505–514).
- No modificar `packages/game-config` evita cualquier cambio en su esquema TypeBox, su validación relacional o sus pruebas, consistente con «no modificar `packages/game-config` salvo necesidad real demostrada» (criterio de diseño obligatorio de esta tarea).

Si una tarea futura introduce perfiles de dificultad reales con recompensas distintas por perfil, esa tarea deberá mover estos valores a `GameConfig` en ese momento, con su propia validación y migración — no es responsabilidad de `0013`.

## 9. Tabla de puntos por líneas

Valores exactos, adoptados sin modificación de la petición de la tarea y coherentes con `docs/rautfall.md` (§699–704, columna «Puntos iniciales»):

| Líneas simultáneas | Puntos base |
| --- | ---: |
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 | 800 |

Representación interna sugerida (nombres orientativos, el informe de implementación puede confirmar los reales):

```ts
const LINE_CLEAR_POINTS: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 100,
  2: 300,
  3: 500,
  4: 800,
});
```

- Estos puntos se conceden **una vez por fijación**, según el número de líneas que esa fijación concreta elimina (`lineIndices.length` en el código actual), nunca según `clearedLines` acumulado (§4.6).
- No existe entrada para `0` líneas: una fijación que no elimina líneas no otorga ningún punto base (§12, ruptura de combo).
- No existe entrada más allá de 4: cota ya garantizada por la geometría de las piezas (§4.7); no se añade validación en tiempo de ejecución para un caso que no puede ocurrir.
- Estos valores no son configurables en esta tarea (§8.3).

## 10. Puntuación por soft drop

**Decisión:** 1 punto por cada celda realmente descendida mediante soft drop, concedido en el mismo `step()` en el que la celda se desciende de verdad.

- «Realmente descendida» significa: una celda que `processVertical` mueve de verdad (sin colisión), no una celda «intentada» — un intento de descenso bloqueado no otorga ningún punto, coherente con que tampoco emite `pieceMoved` ni fija (§4.4).
- El origen de la distancia es la diferencia entre `activePiece.y` antes y después de ejecutar el bucle de `processVertical` en un `step()` dado, condicionada a `input.softDropHeld === true` en ese mismo paso (§4.4: dentro de una llamada, la razón del descenso —`'softDrop'` o `'gravity'`— es única y se determina por ese mismo booleano).
- Si `input.softDropHeld === true` pero ninguna celda desciende realmente (pieza bloqueada, o acumulador insuficiente para completar una unidad de celda en ese paso), no se concede ningún punto en ese `step()`.
- La gravedad normal (`input.softDropHeld === false`) nunca concede puntos por las celdas que desciende, aunque el mecanismo interno (`processVertical`) sea el mismo (§19).
- No existe ningún límite de puntos por soft drop dentro de un mismo paso: si el soft drop desciende varias celdas en un único `step()` (posible según `config.softDropCellsPerSecond` y `config.fixedStepMs`), se puntúan todas las celdas realmente descendidas en ese paso.

## 11. Puntuación por hard drop

**Decisión:** 2 puntos por cada celda de distancia real de hard drop, concedidos en el mismo `step()` en que ocurre el hard drop, inmediatamente después de mover la pieza y antes de fijarla.

- La distancia real es exactamente `hardDropDistance(board, activePiece)` (§4.5), la misma variable ya calculada por el código existente — no se introduce ningún cálculo paralelo.
- Un hard drop de distancia `0` (la pieza ya está apoyada en el momento de solicitar el hard drop) no concede ningún punto de caída: `distance >= 1` sigue siendo la única condición para mover la pieza y para conceder puntos (misma condición ya existente en el código para emitir `pieceMoved`, reutilizada también para la puntuación).
- Los puntos de hard drop son independientes de si la fijación resultante elimina líneas o no: se conceden por el movimiento en sí, no por su consecuencia (§8.1).

## 12. Reglas de combo

### 12.1 Cuándo comienza y cuándo aumenta

- El combo **comienza** en la primera fijación (tras el inicio de la partida, tras un `reset()`, o tras la fijación previa que rompió cualquier cadena anterior) que elimina al menos una línea: `combo` pasa de `0` a `1`.
- El combo **aumenta** en cada fijación consecutiva subsiguiente que también elimina al menos una línea: `combo` se incrementa en `1` respecto de su valor anterior (`2` tras la segunda fijación consecutiva, `3` tras la tercera, etc.), sin límite superior en esta tarea (§13.3).
- «Consecutiva» significa: sin ninguna fijación intermedia que no elimine líneas. El hold (§23) no cuenta como fijación (nunca invoca `lockActivePiece`/`clearLines`) y por tanto no afecta al combo en ningún sentido (ni lo mantiene expresamente ni lo rompe): el combo permanece exactamente en el valor que tenía antes del hold.

### 12.2 Valor observable de la primera eliminación

La primera eliminación de una cadena deja `combo = 1`. Esta fijación **sí** concede los puntos base de línea (§9) correspondientes al número de líneas eliminadas, pero **no** concede ninguna bonificación de combo (§13.2): la bonificación empieza a aplicarse a partir de la segunda eliminación consecutiva.

### 12.3 Cuándo se rompe

El combo se rompe —`combo` vuelve a `0`— exactamente cuando una pieza se fija **sin** eliminar ninguna línea. Esto incluye:

- una fijación por expiración del temporizador de lock delay sin líneas completas;
- una fijación por alcanzar el límite de reinicios de lock delay sin líneas completas;
- un hard drop que no completa ninguna línea.

La ruptura del combo es **silenciosa**: no emite ningún evento de dominio nuevo ni existente (§16), no concede ni resta puntos, y no tiene ningún efecto observable más allá de que `EngineSnapshot.combo` pasa a `0` en el siguiente `getSnapshot()`.

### 12.4 Pieza que fija sin eliminar líneas

Se trata exactamente del caso de ruptura (§12.3): la fijación ocurre con normalidad (`lockActivePiece`, `pieceLocked`), `clearLines()` devuelve una lista vacía, no se otorga ningún punto de línea ni bonificación de combo, `combo` se fija a `0` (si no lo era ya), y el flujo continúa con `spawnNextPiece()` exactamente como hoy. Ningún otro comportamiento del motor (gravedad, lock delay, spawn, game over) cambia por esta regla.

### 12.5 Alternativas evaluadas para la semántica de `combo`

- **`combo` cuenta *rupturas evitadas* en vez de fijaciones consecutivas** (por ejemplo, empezando en `0` y solo pasando a `1` en la segunda eliminación). Descartada: no permite distinguir, desde el snapshot, entre «aún no ha eliminado ninguna línea en esta partida» y «acaba de eliminar una línea por primera vez», perdiendo información observable sin ganar nada a cambio.
- **`combo` como booleano (`comboActive: boolean`) más un contador separado.** Descartada: introduce dos campos donde uno basta; `lockResetsUsed`/`lockDelayElapsedMs` (`0006`) ya establecen el precedente de un contador entero simple como fuente única de verdad para «cuánto» sin un booleano auxiliar redundante.
- **`combo` entero, `0` = sin cadena, `n ≥ 1` = longitud de la cadena activa** (adoptada). Es la representación más simple, sin ambigüedad, y coincide exactamente con la decisión recomendada validada contra el motor real: no existe ningún obstáculo técnico (el motor ya mantiene contadores enteros por pieza como `lockResetsUsed`, reiniciados y incrementados con el mismo patrón).

## 13. Fórmula de bonificación de combo

### 13.1 Fórmula adoptada

```text
comboBonus(combo) = combo >= 2 ? 50 * (combo - 1) : 0
```

Aplicada en el momento en que `combo` ya ha sido incrementado a su nuevo valor (§17): la bonificación se calcula **después** de que `combo` refleje la fijación actual, nunca sobre el valor anterior.

| Fijación consecutiva | `combo` resultante | `comboBonus` |
| --- | ---: | ---: |
| 1.ª | 1 | 0 |
| 2.ª | 2 | 50 |
| 3.ª | 3 | 100 |
| 4.ª | 4 | 150 |
| n-ésima | n | 50 × (n − 1) |

### 13.2 La bonificación se aplica desde la segunda eliminación consecutiva

Confirmado explícitamente: la primera eliminación de una cadena (`combo = 1`) no recibe ninguna bonificación (`comboBonus = 0`), solo los puntos base de línea (§9). Este es el comportamiento de `combo >= 2` en la fórmula; no es un caso especial adicional, es la fórmula evaluada en `combo = 1`.

### 13.3 Sin límite máximo en esta tarea

No se introduce ningún tope superior para `combo` ni para `comboBonus` en `0013`. `docs/rautfall.md` (§712) prevé que «la bonificación de puntuación crecerá con la longitud del combo» sin fijar un límite para la puntuación (a diferencia de la energía, §713, que sí lo tendrá cuando se implemente); esta tarea no implementa energía, por lo que no hereda ninguna necesidad de límite. Un límite de puntuación sin una razón de balance demostrada sería una restricción arbitraria no solicitada.

### 13.4 Alternativas de fórmula evaluadas y rechazadas

- **Multiplicador sobre los puntos base** (por ejemplo, `basePoints * (1 + 0.1 * combo)`). Descartada: acopla la bonificación de combo al valor de la tabla de líneas, de modo que un combo de cuatros líneas premiaría desproporcionadamente frente a un combo de líneas simples, sin que `docs/rautfall.md` pida ese acoplamiento; además complica el cálculo con aritmética no entera, indeseable para una magnitud de puntuación estrictamente entera y creciente.
- **Bonificación cuadrática o exponencial en `combo`.** Descartada: `docs/rautfall.md` (§706) ya advierte que estos valores son «hipótesis... que deberán equilibrarse mediante simulaciones»; una fórmula no lineal introduce más superficie de balance sin que exista todavía ninguna simulación o justificación de producto que la requiera. Una progresión lineal simple es la hipótesis mínima razonable, coherente con el resto de valores iniciales de esta tarea (también enteros y simples).
- **Bonificación fija por combo activo, no creciente con la longitud.** Descartada: contradice explícitamente `docs/rautfall.md` §712 («la bonificación... crecerá con la longitud del combo»).
- **`50 * (combo - 1)`, lineal, sin tope** (adoptada). Es la opción explícitamente propuesta y validada contra el motor real: no exige estado adicional más allá del propio `combo` ya necesario (§12), es enteramente determinista, y es la hipótesis más simple compatible con «crece con la longitud» y con «la primera eliminación no recibe bonificación».

## 14. Estado interno necesario

Dentro de `createGameEngine`, junto a las variables mutables ya existentes (`clearedLines`, `heldPiece`, etc.):

```ts
let score = 0;
let combo = 0;
```

- `score` y `combo` viven al mismo nivel que `clearedLines`/`heldPiece`: variables mutables privadas del motor, nunca expuestas directamente (siempre copiadas por valor a `EngineSnapshot`, que ya es inmutable por ser un `number` primitivo, sin necesidad de `Object.freeze` adicional).
- No se introduce ningún temporizador, ninguna estructura de datos adicional, ni ningún estado por pieza (a diferencia de `holdUsed`, `combo` no es una propiedad de la pieza activa concreta: no se reinicia en cada spawn, solo en una ruptura de combo o en `reset()`, ver §12.3, §25).
- No se introduce ningún estado de «energía» ni de «combo máximo» (§15.3): ningún consumidor real de esta tarea lo necesita.

## 15. Cambios exactos de `EngineSnapshot`

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;
  score: number;                        // ← nuevo, esta tarea
  combo: number;                        // ← nuevo, esta tarea
}>;
```

### 15.1 Por qué a nivel superior, no dentro de `ActivePieceSnapshot`

Mismo razonamiento ya aplicado en `0012` §8.1 a `heldPiece`: ni `score` ni `combo` son propiedades de la pieza activa concreta (ninguno de los dos se reinicia en cada spawn; ambos sobreviven a múltiples piezas activas sucesivas). Anidarlos bajo `ActivePieceSnapshot` los haría desaparecer artificialmente en `gameOver` (cuando `activePiece === null`), rompiendo la utilidad diagnóstica ya establecida para `clearedLines`/`heldPiece`/`nextPieces` en ese mismo estado.

### 15.2 `ActivePieceSnapshot` no cambia

Ningún campo nuevo se añade a `ActivePieceSnapshot` en esta tarea: no existe ninguna propiedad de puntuación ligada 1:1 a la pieza activa (a diferencia de `holdUsed`, que sí lo está).

### 15.3 Alternativas evaluadas para campos adicionales del snapshot

- **`maxCombo: number`** (combo máximo alcanzado en la partida). Evaluada y **rechazada** para esta tarea: `docs/rautfall.md` la prevé únicamente como parte de la pantalla de resultados postpartida (§1735, «Combo máximo»), que no existe hoy en el prototipo y está fuera de alcance (§6). Ningún elemento de presentación previsto en `0013` (§29) necesita mostrar un máximo histórico; solo el combo activo. Añadirlo ahora sería mantener un campo sin ningún consumidor real, violando el mismo criterio que en `0011`/`0012` ya llevó a no ampliar el snapshot sin necesidad demostrada. Queda como candidato natural para la futura tarea de pantalla de resultados o de energía/T-Spins.
- **`comboBonusLastAwarded` / `lastPointsAwarded`** (desglose del último incremento de puntuación). Rechazada: ningún consumidor de esta tarea necesita saber *cómo* se llegó al `score` actual, solo su valor total; introducir este desglose sin un consumidor real (por ejemplo, una animación de «+100» o «+50 combo») sería anticipar una funcionalidad de presentación explícitamente excluida (§6, sin animaciones ni flashes).
- **`score: number`, `combo: number`, sin campos adicionales** (adoptada). Es el conjunto mínimo suficiente para todos los requisitos reales de esta tarea (§29 solo necesita mostrar puntuación total y longitud de combo activo).

## 16. Cambios exactos de eventos

### 16.1 Decisión: no se añade ningún evento de dominio nuevo

`GameEvent` **no** gana ningún caso nuevo en esta tarea. `linesCleared` permanece exactamente como está hoy (`{ type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }`), sin ningún campo de puntuación ni de combo añadido. No se introduce `scoreChanged` ni `scoreAwarded` ni ninguna variante equivalente.

### 16.2 Evaluación explícita de las alternativas

- **Opción A — Ampliar `linesCleared` con puntuación.** Rechazada: mezclaría, en el mismo evento, la descripción de un hecho de tablero (qué líneas se eliminaron) con una consecuencia derivada de reglas de puntuación (cuántos puntos y de qué combo), obligando a cualquier consumidor de `linesCleared` que no necesite puntuación (no existe hoy ninguno, pero el propio contrato quedaría acoplado) a ignorar campos irrelevantes. Viola además, de forma directa, la restricción explícita de esta tarea: «evitar mezclar en `linesCleared` puntuación de soft/hard drop» — y por extensión, cualquier puntuación.
- **Opción B — Añadir `scoreChanged`.** Rechazada: un evento genérico de «cambio de valor» sin más contexto obligaría a quien lo consuma a inferir la razón del cambio (¿línea?, ¿combo?, ¿caída?) a partir de otros eventos emitidos en el mismo paso, es decir, a reconstruir reglas de negocio en la capa de presentación — exactamente lo que el criterio de diseño obligatorio de esta tarea prohíbe («no reconstruir puntuación en la interfaz a partir de eventos si el snapshot ya expone el total»).
- **Opción C — Añadir un evento semántico como `scoreAwarded` (`{ step, points, reason, totalScore }` o variantes con `lines`/`combo`).** Evaluada en detalle. Se descarta para `0013` porque, tras auditar todos los consumidores reales previstos por esta tarea (§29): la presentación Vue solo necesita leer `snapshot.score`/`snapshot.combo` en cada actualización de `GamePresentationState`, sin necesitar el desglose punto a punto de cómo se llegó a ese total. No existe en `0013` ninguna animación de «+100» flotante, ningún pulso de audio, ningún indicador de combo que necesite saber el instante exacto de cada incremento con independencia del snapshot ya inmutable y ya actualizado. Emitir este evento ahora sería «duplicar información sin consumidor» (restricción explícita de esta tarea) y anticipar una necesidad de presentación (audio, partículas, flashes) explícitamente excluida por `docs/rautfall.md` §714 y por el alcance de `0013` (§6).
- **Opción D — Ningún evento nuevo; `score`/`combo` solo observables vía snapshot** (adoptada). Es la única opción que no introduce información sin consumidor, no obliga a Vue/Phaser a recalcular ni interpretar reglas, y no emite eventos granulares por cada paso de gravedad (no hay ningún evento que emitir, granular o no). Las pruebas de motor (§30) verifican la puntuación y el combo comparando `getSnapshot()` antes y después de cada `step()`, siguiendo el mismo patrón ya usado extensamente en la suite existente para otros campos derivados sin evento propio (por ejemplo, `nextPieces`, `landingCells`).

### 16.3 Revisión futura

Si una tarea posterior introduce audio, animaciones de puntuación, o un indicador de combo con retroalimentación en tiempo real más fina que «leer el snapshot en cada frame», esa tarea deberá evaluar de nuevo esta decisión con un consumidor real y concreto en mano — no es una decisión permanente por principio, es la decisión correcta para el conjunto de consumidores que existen en `0013`.

## 17. Orden lógico de cálculo

Orden exacto, integrado en el paso lógico ya vigente (§4.2):

```text
1. Comprobar estado del motor (ENGINE_NOT_RUNNING)          — sin cambios
2. Validar entrada (INVALID_GAME_INPUT)                      — sin cambios
3. Incrementar contador de paso                               — sin cambios
4. Incrementar tiempo lógico                                  — sin cambios
5. Reserva (hold)                                              — sin cambios; no otorga puntos (§23)
6. Movimiento horizontal                                       — sin cambios; no otorga puntos
7. Rotación                                                    — sin cambios; no otorga puntos
8. Hard drop:
   8.1. Calcular distance = hardDropDistance(...)              — ya existente
   8.2. Si distance >= 1: mover pieza, emitir pieceMoved,
        AWARD drop score = distance * 2                        — NUEVO, en el momento del movimiento
   8.3. lockAndProcess()                                       — ver 10, invocado en vez de duplicar
   8.4. return
9. Gravedad o soft drop (solo si no hubo 8):
   9.1. processVertical(input) ya existente
   9.2. Tras el bucle, si input.softDropHeld === true y
        cellsDescended > 0: AWARD drop score = cellsDescended * 1 — NUEVO
        (si input.softDropHeld === false, nunca se otorgan puntos, sea cual sea cellsDescended)
10. Detección final de apoyo y avance de lock delay:
    — si expira el temporizador o se alcanza el límite de reinicios (en 6/7): lockAndProcess()
    10.1. lockActivePiece()                                     — ya existente, sin cambios
    10.2. lineIndices = clearLines()                            — ya existente, sin cambios
    10.3. Si lineIndices.length > 0:
          — basePoints = LINE_CLEAR_POINTS[lineIndices.length]
          — combo += 1
          — comboBonus = combo >= 2 ? 50 * (combo - 1) : 0
          — score += basePoints + comboBonus                    — NUEVO
          — emit linesCleared (sin cambios de forma)             — ya existente
          Si lineIndices.length === 0:
          — combo = 0                                           — NUEVO, silencioso, sin evento
    10.4. spawnNextPiece()                                       — ya existente, sin cambios
```

Puntos clave de este orden:

- La puntuación por caída (paso 8/9) se concede **en el paso lógico en que ocurre el movimiento real**, que para gravedad/soft drop puede ser un `step()` distinto (anterior) al `step()` en que finalmente se fija la pieza (cuando expira el lock delay varios pasos después). Para hard drop, ambos ocurren en el mismo `step()` porque el hard drop siempre fija de inmediato.
- La puntuación por líneas y combo (paso 10.3) se concede **una única vez**, exactamente cuando la pieza se fija de verdad, sea por hard drop (a través de `lockAndProcess()`, §20), por expiración del temporizador, o por el límite de reinicios — un único punto de cálculo para las tres vías, eliminando el riesgo de divergencia descrito en §4.3.
- `combo += 1` ocurre **antes** de calcular `comboBonus`: la bonificación siempre se calcula sobre el valor de `combo` ya actualizado por la fijación actual (§13.1).

## 18. Interacción con fijación y eliminación de líneas

- La puntuación por líneas y la actualización de combo (§17, paso 10.3) se integran directamente dentro de `lockAndProcess()`, inmediatamente después de `clearLines()` y antes de `spawnNextPiece()` — mismo punto donde hoy se decide si emitir `linesCleared`.
- `clearedLines` (acumulado total) no cambia de comportamiento: sigue incrementándose exactamente igual dentro de `clearLines()` (§4.6), sin relación directa con `score` más allá de compartir el mismo `lineIndices.length` como entrada.
- El evento `pieceLocked` no cambia de forma ni de condiciones de emisión: se emite exactamente igual que hoy, independientemente de si la fijación otorga puntos.
- El evento `linesCleared` no cambia de forma (§16.2, opción A rechazada): se sigue emitiendo si y solo si `lineIndices.length > 0`, con los mismos campos (`step`, `lines`, `lineIndices`).
- Una pieza fija sus líneas **una sola vez**: `lockAndProcess()` se invoca exactamente una vez por fijación (sin importar la vía), por lo que el bloque 10.3 se ejecuta exactamente una vez por fijación. No existe ningún camino en el motor que llame a `clearLines()` dos veces para la misma pieza.

## 19. Interacción con gravedad

- La gravedad normal (`input.softDropHeld === false` durante `processVertical`) **nunca concede puntos**, aunque desciende celdas exactamente con el mismo mecanismo que el soft drop (§4.4, §10). La única diferencia observable en la puntuación es el valor de `input.softDropHeld` en el `step()` en que ocurre el descenso.
- Un intento de descenso por gravedad bloqueado por colisión no concede puntos (ya era `0` de todos modos, al no ser soft drop) y no fija la pieza (comportamiento ya vigente, sin cambios).
- Ningún otro efecto de la gravedad (avance de `verticalProgress`, interacción con lock delay) cambia en esta tarea.

## 20. Interacción con hard drop

### 20.1 Cambio necesario: unificar la secuencia de fijación

Como cambio mínimo estrictamente necesario para que la puntuación por líneas/combo tenga una única implementación (§4.3, criterio de diseño obligatorio «no duplicar la fuente de verdad»), el bloque de hard drop pasa de duplicar la secuencia de fijación a invocar `lockAndProcess()`:

```ts
// Antes (duplicado, index.ts:960-978)
if (input.hardDrop && activePiece) {
  const distance = hardDropDistance(board, activePiece);
  if (distance >= 1) {
    activePiece.y += distance;
    eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'hardDrop' });
  }
  lockActivePiece();
  const lineIndices = clearLines();
  if (lineIndices.length > 0) { /* emitir linesCleared */ }
  spawnNextPiece();
  return;
}

// Después (esta tarea)
if (input.hardDrop && activePiece) {
  const distance = hardDropDistance(board, activePiece);
  if (distance >= 1) {
    activePiece.y += distance;
    eventQueue.push({ type: 'pieceMoved', step: currentStep, reason: 'hardDrop' });
    score += distance * HARD_DROP_POINTS_PER_CELL;   // ← nuevo
  }
  lockAndProcess();                                   // ← reemplaza la duplicación
  return;
}
```

Este refactor no cambia ningún comportamiento observable existente: `lockAndProcess()` y el bloque duplicado ya eran funcionalmente idénticos tras el movimiento inicial (§4.3); unificarlos es una simplificación estricta, no una nueva regla. Todas las pruebas de regresión de hard drop existentes (fijación, `linesCleared`, spawn, game over) deben seguir pasando sin modificación de intención.

### 20.2 Orden de puntuación dentro de un hard drop que también elimina líneas

1. Se calcula `distance`.
2. Si `distance >= 1`: se mueve la pieza, se emite `pieceMoved(reason: 'hardDrop')`, y se conceden los puntos de caída (`distance * 2`).
3. `lockAndProcess()` fija la pieza, detecta las líneas eliminadas, concede los puntos de línea y la bonificación de combo correspondiente (§17, §18), emite `linesCleared` si procede, y spawnea la siguiente pieza (o finaliza la partida).

Ambos incrementos de `score` (caída y líneas/combo) ocurren dentro de la misma llamada a `step()`, en ese orden. Un hard drop de distancia `0` que sí completa líneas (posible si la pieza ya estaba apoyada y el jugador solicita hard drop de todos modos) solo concede los puntos de línea/combo, no los de caída (§11).

### 20.3 Movimiento horizontal combinado con hard drop en el mismo paso

Un `StepInput` que combina un movimiento horizontal válido (`leftPressed`/`rightPressed`) con `hardDrop: true` en el mismo paso solo puntúa la distancia vertical real del hard drop, calculada **después** de aplicar el movimiento horizontal (orden ya vigente: horizontal antes que hard drop, §4.2). El desplazamiento horizontal en sí nunca concede puntos, sea cual sea su magnitud.

## 21. Interacción con soft drop

- La puntuación por soft drop (§10) se concede dentro de `processVertical`, inmediatamente después del bucle de descenso, condicionada a `input.softDropHeld === true` y a que el número de celdas realmente descendidas (`cellsDescended`) sea mayor que `0`.
- Un soft drop bloqueado (pieza ya apoyada, o colisión inmediata) tiene `cellsDescended === 0` y no concede ningún punto.
- Si el soft drop provoca, en un `step()` posterior, que la pieza acabe fijándose (por expiración de lock delay tras quedar apoyada), la puntuación por líneas/combo de esa fijación se concede por separado, en el `step()` en que ocurre la fijación (§17, §18) — no en el `step()` del soft drop. No hay solapamiento ni doble conteo entre ambos mecanismos.

## 22. Interacción con lock delay

- El lock delay no introduce ningún cálculo de puntuación propio: solo determina **cuándo** ocurre la fijación (sin cambios respecto de `0006`). La puntuación por líneas/combo se calcula exactamente una vez, en el instante de la fijación, sea cual sea el número de reinicios de lock delay consumidos antes de ese instante.
- Reinicios de lock delay por movimiento horizontal o rotación válidos no conceden ni descuentan puntos (§19 y la ausencia de cualquier regla de puntuación asociada al movimiento/rotación).
- El límite de reinicios de lock delay alcanzado (`lockResetsUsed >= config.maxLockResets`) sigue invocando `lockAndProcess()` exactamente igual que hoy, por lo que hereda automáticamente la puntuación por líneas/combo unificada (§18) sin ningún cambio adicional en esa ruta.
- Prueba explícita requerida (§30): una pieza que agota varios reinicios de lock delay antes de fijar solo puntúa sus líneas una vez, en el instante final de fijación, nunca de forma acumulada por cada reinicio.

## 23. Interacción con hold

- El hold (`0012`) **nunca** invoca `lockActivePiece()` ni `clearLines()`: intercambia o almacena la pieza activa sin fijarla en el tablero (`docs/rautfall.md` y `0012` §7, §12–§15). Por tanto, el hold no otorga puntos de ningún tipo (ni de línea, ni de combo, ni de caída) y no afecta a `combo` en ningún sentido: ni lo incrementa, ni lo rompe, ni lo reinicia.
- `combo` conserva exactamente el valor que tenía inmediatamente antes del hold, tanto en la rama de ranura vacía como en la de intercambio (`0012` §12, §13): un hold ejecutado a mitad de una cadena de combos no interrumpe esa cadena; la siguiente fijación real (de la pieza entrante) continúa evaluándose respecto del mismo `combo` previo.
- Un hold cuya pieza entrante resulta en `spawnBlocked` (`0012` §15) tampoco afecta a `score` ni a `combo`: es exactamente la misma situación de game over ya cubierta por §26, sin ninguna fijación de por medio.
- No se requiere ningún cambio en `packages/game-engine` relativo al hold más allá de la ausencia de interacción ya descrita: no se modifica `performHoldFromEmpty`/`performHoldSwap`/`attemptIncomingSpawn` (nombres orientativos de `0012`) para tocar `score` ni `combo`.

## 24. Interacción con pieza fantasma

`landingCells` (`0011`) es un campo puramente derivado en cada `getSnapshot()`, sin relación con la puntuación. La pieza fantasma no concede puntos por su mera existencia ni por su proyección: solo el hard drop real (que la pieza fantasma anticipa visualmente) concede puntos de caída, en el momento en que efectivamente ocurre (§11), no en el momento en que la fantasma se muestra. No se requiere ningún cambio en `computeLandingCells`/`hardDropDistance`/`computeAbsoluteCells`.

## 25. Reset

`reset(options)` sigue la misma secuencia ya establecida (`0002`, ampliada en `0005`/`0006`/`0007`/`0012`), incorporando:

```ts
score = 0;
combo = 0;
```

- Tras `reset()`, el snapshot debe reflejar inmediatamente `score: 0` y `combo: 0`, sin necesidad de llamar a `step()`, igual que el resto de campos del snapshot ya se comportan tras un reset.
- Esto se cumple independientemente del estado previo del motor (incluida una partida terminada en `gameOver` con `score`/`combo` distintos de cero): `reset()` siempre produce un estado limpio.

## 26. Pausa y game over

### 26.1 Pausa

La pausa pertenece exclusivamente a la capa web (`0008`); el motor no la conoce y no recibe ningún `step()` mientras `isPaused === true`. `score` y `combo` quedan congelados junto con el resto del estado del motor mientras dura la pausa (no hay `step()`, no hay cambio de estado posible) y se siguen mostrando con su último valor conocido en el componente de presentación (§29), exactamente igual que el resto de campos de `GamePresentationState` ya se comportan durante la pausa. No se requiere ningún cambio en `packages/game-engine` ni en la lógica de pausa ya existente en `GameScene.ts` relativo a esta tarea.

### 26.2 Game over

- `score` y `combo` **no se reinician** al entrar en `gameOver`: conservan su último valor, cumpliendo explícitamente «la puntuación no disminuye» (`docs/rautfall.md` §776) y «game over conserva la puntuación final» (prueba requerida, §30).
- `combo` en el momento de `gameOver` refleja el estado de la cadena en el instante exacto del bloqueo de spawn: si la última fijación antes del `spawnBlocked` eliminó líneas, `combo` mantiene ese valor positivo; si no, `combo` ya era `0` por la ruptura de esa misma fijación (§12.3).
- Ningún componente de presentación necesita tratamiento especial para `gameOver`: sigue mostrando el último `score`/`combo` recibido por `GamePresentationState`, sin ninguna comprobación adicional de `status` (mismo principio ya aplicado a `heldPiece`/`nextPieces` en `gameOver`, `0007`/`0012`).

## 27. Determinismo, errores, atomicidad e inmutabilidad

- **Atomicidad de entrada inválida:** una entrada estructuralmente inválida (`EngineStepError('INVALID_GAME_INPUT', ...)`) se lanza **antes** de `currentStep++`/`currentElapsedMs +=` (orden ya vigente en `step()`), por lo que no muta `score`, `combo`, ni ningún otro estado del motor (ampliación explícita de la invariante de atomicidad ya vigente desde `0005`/`0007`/`0012`). No se emite ningún evento.
- **Motor detenido:** una llamada a `step()` con `status === 'gameOver'` lanza `EngineStepError('ENGINE_NOT_RUNNING', ...)` sin mutar `score` ni `combo` (comportamiento ya vigente, sin cambios).
- **Determinismo:** dos motores creados con la misma semilla y configuración, sometidos a la misma secuencia exacta de `StepInput`, producen `score` y `combo` idénticos en cada paso comparado, por ser ambos derivados exclusivamente de datos ya deterministas (número de líneas eliminadas por fijación, celdas realmente descendidas por soft/hard drop) sin ninguna fuente adicional de aleatoriedad o de tiempo real.
- **Inmutabilidad del snapshot:** `score` y `combo` son valores `number` primitivos incluidos directamente en el objeto congelado (`Object.freeze`) que devuelve `getSnapshot()`, sin necesidad de copia defensiva adicional (mismo patrón que `clearedLines`). Ninguna llamada a `getSnapshot()` muta `score` ni `combo`: son lecturas puras del estado interno ya actualizado por el `step()` anterior. Dos llamadas sucesivas a `getSnapshot()` sin `step()` intermedio devuelven el mismo valor de ambos campos.
- **La puntuación no disminuye:** invariante de propiedad exigida por `docs/rautfall.md` §776; se cumple por construcción, dado que `score` solo se incrementa (`+=`) en toda esta especificación, nunca se decrementa ni se reasigna a un valor menor salvo por `reset()` (que reinicia toda la partida, no es una disminución dentro de una partida en curso).

## 28. Integración con `GamePresentationState`

```ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;
  score: number;                       // ← nuevo, esta tarea
  combo: number;                       // ← nuevo, esta tarea
}>;
```

- Mismo razonamiento ya aplicado en `0007`/`0012` a `nextPieces`/`heldPiece`: la puntuación necesita mostrarse en un componente Vue, y Vue no llama a `engine.getSnapshot()` en ningún punto; el único canal Phaser→Vue es `GamePresentationState`. `score`/`combo` son, por tanto, candidatos directos a esta ampliación, con un consumidor real ya identificado (§29).
- `GameScene.notifyState()` (`GameScene.ts:528-552`) incluye `score: snap.score` y `combo: snap.combo` en el objeto que construye, y la comparación de deduplicación (que ya compara `status`/`step`/`elapsedMs`/`nextPieces`/`heldPiece`) se amplía para comparar también ambos campos (comparación de primitivos, tan simple como la ya existente para `heldPiece`).
- El valor inicial de `gameState` en `App.vue` (`ref<GamePresentationState>({ ... })`) se amplía con `score: 0, combo: 0`.
- No se añade `maxCombo` a `GamePresentationState` (§15.3): ningún elemento de presentación previsto en esta tarea lo necesita.

## 29. Presentación visual en Vue/Phaser

### 29.1 Responsabilidad exacta de Phaser

Phaser no calcula ni interpreta puntuación ni combo en ningún punto: `GameScene.ts` se limita a leer `snap.score`/`snap.combo` del snapshot ya calculado por el motor y a incluirlos, sin transformación, en el objeto `GamePresentationState` que entrega a Vue (§28). `renderFrame()` no dibuja ningún elemento de puntuación: el HUD de puntuación pertenece exclusivamente a Vue (fuera del `<canvas>`), igual que el resto del panel táctico.

### 29.2 Responsabilidad exacta de Vue

Vue muestra `score` y `combo` exactamente como los recibe de `GamePresentationState`, sin ningún cálculo, acumulación ni interpretación adicional de reglas de dominio. No reconstruye la puntuación a partir de eventos (§16): no existe ningún evento que consumir para este propósito.

### 29.3 Nuevo componente `ScorePanel.vue`

Se crea `apps/web/src/components/ScorePanel.vue`, siguiendo el mismo patrón ya validado por `HeldPiecePreview.vue`/`NextPiecesPreview.vue`: componente pequeño, sin Pinia, props mínimas, sin lógica de dominio.

```ts
const props = defineProps<{
  score: number;
  combo: number;
}>();
```

- Muestra «Puntuación» con el valor numérico de `score` (formateado como entero simple, sin separadores de miles ni animación).
- Muestra «Combo» con el valor numérico de `combo` cuando `combo >= 1`, o un estado neutro claramente definido (texto «—») cuando `combo === 0`. No se oculta la etiqueta «Combo» en ningún caso (evita saltos de layout y mantiene el contrato DOM estable para E2E, §32).
- `data-testid="score-panel"` en el contenedor raíz, `data-testid="score-value"` en el valor de puntuación, `data-testid="combo-value"` en el valor de combo, siguiendo la convención de selectores contractuales ya establecida desde `0010`.
- No introduce ninguna dependencia nueva, ninguna animación, ningún efecto visual de aparición/crecimiento del combo más allá del cambio de texto/número (`docs/rautfall.md` §714 reserva esa comunicación reforzada para audio/efectos futuros, fuera de alcance).

### 29.4 Integración en `App.vue`

Se añade una nueva `.console-section` dentro de la `.tactical-console` ya existente, con su `.console-divider` correspondiente, **entre** la sección de «Próximas piezas» y la de «Estado de sesión» (orden narrativo: piezas en juego → rendimiento real → estado técnico de sesión → controles → panel de combate simulado):

```html
<div class="console-section">
  <NextPiecesPreview :next-pieces="gameState.nextPieces" />
</div>

<div class="console-divider"></div>

<div class="console-section">
  <ScorePanel :score="gameState.score" :combo="gameState.combo" />
</div>

<div class="console-divider"></div>

<!-- Estado de sesión real (sin cambios) -->
```

No se modifica ningún estilo de `.tactical-console`/`.console-section`/`.console-divider` ya existente: se reutilizan tal cual, sin ningún rediseño del HUD.

### 29.5 Ningún placeholder que sustituir

Confirmado en la auditoría (§4.9): no existe hoy ningún placeholder simulado de puntuación o combo en `CombatStatusPanel.vue` ni en `simulated-tactical-data.ts`. Esta tarea no retira ni sustituye ningún dato simulado existente; añade un panel completamente nuevo con datos reales.

## 30. Pruebas unitarias y de regresión mínimas

Aplicar TDD pragmático en `packages/game-engine/src/game-engine.test.ts`. Se recomienda un conjunto de bloques `describe` planos con prefijo `puntuación -` y `combo -`, siguiendo el precedente ya establecido por los bloques `lock delay - …`/`reserva - …`. Como mínimo:

### 30.1 `puntuación - estado inicial`

- `score` es `0` inmediatamente tras `createGameEngine`, sin necesidad de `step()`.
- `combo` es `0` inmediatamente tras `createGameEngine`.

### 30.2 `puntuación - eliminación de líneas`

- Construir escenarios donde una fijación elimina exactamente 1, 2, 3 y 4 líneas (por separado) y verificar que `score` se incrementa exactamente en 100, 300, 500 y 800 puntos respectivamente, en fijaciones aisladas (primera eliminación de una cadena, sin bonificación de combo).

### 30.3 `combo - inicio y crecimiento`

- La primera eliminación de una cadena deja `combo = 1` y no añade ninguna bonificación (`score` solo aumenta en los puntos base de línea).
- Una segunda eliminación consecutiva deja `combo = 2` y añade una bonificación de 50 puntos (verificar el incremento exacto de `score` en ese paso: puntos base de esa fijación + 50).
- Una tercera eliminación consecutiva deja `combo = 3` y añade una bonificación de 100 puntos.

### 30.4 `combo - ruptura`

- Fijar una pieza que no elimina ninguna línea deja `combo = 0`, sin importar el valor previo de `combo`, y no modifica `score`.
- Tras una ruptura, una nueva eliminación de líneas comienza de nuevo en `combo = 1`, sin bonificación, exactamente igual que la primera cadena de la partida.
- Una pieza que fija sin eliminar líneas cuando `combo` ya era `0` no tiene ningún efecto observable adicional (idempotencia de la ruptura).

### 30.5 `puntuación - soft drop`

- Mantener soft drop durante varios `step()` y verificar que `score` aumenta exactamente en 1 punto por cada celda realmente descendida (comparar `activePiece.y` antes/después de cada `step()` con el incremento de `score`).
- Un soft drop bloqueado (pieza ya apoyada) no incrementa `score` en absoluto durante los pasos en los que permanece bloqueado.
- Un `step()` con gravedad normal (`softDropHeld: false`) que desciende una o más celdas no incrementa `score`.

### 30.6 `puntuación - hard drop`

- Un hard drop desde una altura conocida incrementa `score` exactamente en `distancia * 2`.
- Un hard drop de distancia `0` (pieza ya apoyada) no incrementa `score` por caída (verificar por separado de cualquier puntuación de línea que ese mismo hard drop pudiera generar).
- Movimiento horizontal (incluido DAS/ARR) y rotación, con o sin hard drop posterior en el mismo paso, no incrementan `score` por sí mismos: solo la distancia vertical real del hard drop cuenta.

### 30.7 `puntuación - acciones sin efecto`

- Movimiento horizontal (pulsación, DAS, ARR) no concede puntos.
- Rotación (horaria, antihoraria, con o sin wall kick aplicado) no concede puntos.
- Hold, en cualquiera de sus dos ramas, no concede puntos y no modifica `combo` (§23): verificar que `score`/`combo` antes y después de un `step()` con `hold: true` ejecutado son idénticos.
- La pieza fantasma (`landingCells`) no concede puntos por su mera proyección, en ningún `getSnapshot()`.
- Una entrada válida sin ninguna acción efectiva (`StepInput` neutro) no modifica `score` ni `combo`.

### 30.8 `puntuación - combinación de movimiento y hard drop`

- Un `StepInput` con movimiento horizontal válido y `hardDrop: true` en el mismo paso puntúa únicamente la distancia vertical real del hard drop (calculada tras aplicar el movimiento horizontal), nunca una cantidad relacionada con el desplazamiento horizontal.

### 30.9 `puntuación - hard drop con eliminación de líneas`

- Un hard drop que además completa una o más líneas incrementa `score` en la suma exacta de: puntos de caída (`distancia * 2`) + puntos base de línea + bonificación de combo si procede, todo dentro del mismo `step()`.
- `combo` se actualiza correctamente (incrementado o iniciado) tras un hard drop que elimina líneas, exactamente igual que tras cualquier otra vía de fijación.

### 30.10 `puntuación - lock delay`

- Una pieza que consume varios reinicios de lock delay antes de fijar (por movimiento u rotación válidos repetidos) puntúa sus líneas **una sola vez**, en el instante final de la fijación, sin incremento parcial en ningún reinicio intermedio.
- Una fijación provocada por alcanzar el límite de reinicios de lock delay (sin que el temporizador llegue a expirar) puntúa correctamente sus líneas y actualiza el combo exactamente igual que una fijación por expiración del temporizador.
- Ningún reinicio de lock delay, por sí mismo, modifica `score` ni `combo`.

### 30.11 `puntuación - game over`

- Tras un `spawnBlocked` (por fijación normal o por hold), `score` y `combo` conservan los valores que tenían inmediatamente antes del bloqueo; no se reinician ni se modifican por la transición a `gameOver`.

### 30.12 `puntuación - reset`

- Tras `reset()`, `score` es `0` y `combo` es `0`, independientemente de sus valores antes del reset (incluido el caso de venir de una partida en `gameOver` con puntuación acumulada).

### 30.13 `puntuación - atomicidad`

- Un `StepInput` estructuralmente inválido (por ejemplo, una propiedad desconocida, o `leftPressed`/`rightPressed` simultáneos) lanza `EngineStepError('INVALID_GAME_INPUT', ...)` sin mutar `score` ni `combo`.
- Una llamada a `step()` con el motor en `gameOver` lanza `EngineStepError('ENGINE_NOT_RUNNING', ...)` sin mutar `score` ni `combo`.

### 30.14 `puntuación - determinismo`

- Dos motores creados con la misma semilla y configuración, sometidos a la misma secuencia exacta de `StepInput` (incluidos soft drop, hard drop, líneas eliminadas y rupturas de combo), producen `score` y `combo` idénticos en cada paso comparado.

### 30.15 `puntuación - snapshot e inmutabilidad`

- `score` y `combo` no cambian por llamar a `getSnapshot()` repetidamente sin `step()` intermedio.
- La propiedad «la puntuación no disminuye» se verifica de forma explícita a lo largo de una secuencia larga y variada de acciones (movimiento, rotación, hard drop, soft drop, líneas, rupturas de combo, hold): `score` en cada paso es mayor o igual que en el paso anterior.

### 30.16 Regresiones obligatorias

Ejecutar y mantener en verde, sin modificar su intención original:

- Regresión de eliminación de líneas y fijación (`0002`).
- Regresión de hard drop, incluida la unificación de §20.1 (`0002`, `0013`).
- Regresión de soft drop y gravedad (`0005`).
- Regresión de lock delay en todas sus variantes (`0006`).
- Regresión de cola de próximas piezas (`0007`).
- Regresión de pieza fantasma (`0011`).
- Regresión de reserva/hold (`0012`).
- Regresión de reset y determinismo generales (`0002`/`0005`/`0007`/`0012`).

## 31. Pruebas de integración web

### 31.1 `apps/web/src/game/types.test.ts`

- Ampliar cada literal `GamePresentationState` existente con `score`/`combo` (obligatorios, no opcionales, §28).
- Añadir aserciones equivalentes a las ya existentes para `heldPiece`: número total de claves ahora en siete (`status`, `step`, `elapsedMs`, `nextPieces`, `heldPiece`, `score`, `combo`); presencia y tipo de ambos campos nuevos; ausencia de propiedades adicionales del snapshot del motor (`board`, `activePiece`, `clearedLines` ya cubiertos; no debe filtrarse un campo `maxCombo` a nivel superior).

### 31.2 `apps/web/src/App.test.ts`

- Ampliar cada literal `GamePresentationState`/`stateUpdateCallback(...)` existente con `score`/`combo` (siguiendo exactamente la migración ya exigida en `0007`/`0012` cuando esos campos se añadieron).
- Añadir una prueba que verifique que `ScorePanel` recibe `score`/`combo` desde `App` (mismo patrón que las pruebas ya existentes para `NextPiecesPreview`/`HeldPiecePreview`).
- Revisar las pruebas de layout ya existentes (recuento de secciones/columnas) para confirmar que la nueva `.console-section` no rompe ninguna aserción de estructura; actualizar si depende de un recuento exacto, sin alterar su intención original.

### 31.3 Nuevo `apps/web/src/components/ScorePanel.test.ts`

Siguiendo el patrón exacto de `HeldPiecePreview.test.ts`/`NextPiecesPreview.test.ts` (montaje con `@vue/test-utils`, aserciones directas sobre el DOM, sin mocks de Phaser):

- Con `score: 0, combo: 0`, se muestra «0» en `score-value` y el estado neutro («—») en `combo-value`.
- Con `score` distinto de cero, se muestra exactamente ese valor en `score-value`.
- Con `combo >= 1`, se muestra exactamente ese valor numérico en `combo-value` (verificar al menos con `combo: 1` y `combo: 3`).
- El contenedor raíz expone `data-testid="score-panel"`.

## 32. Alcance E2E mínimo

Por defecto, se preserva la decisión ya fijada en `0011`/`0012` de no ampliar el E2E salvo que aporte valor real y verifique un contrato DOM estable. En este caso, sí existe un contrato DOM nuevo y estable (`data-testid="score-value"`, `data-testid="combo-value"`, visibles desde la carga inicial de la aplicación).

No se fuerza ninguna secuencia de eliminación de líneas en Playwright: generarla de forma fiable requeriría manipular el tablero o encadenar muchas pulsaciones deterministas, una secuencia larga y frágil que el resto del E2E ya evita deliberadamente (`0012` §28). Es suficiente verificar que el marcador inicial real aparece y que pausa/reinicio lo mantienen coherente, dejando toda la aritmética de puntuación a las pruebas de motor (§30).

Se añade una ampliación puntual en `apps/web/e2e/essential-flow.spec.ts`:

```ts
// dentro del paso ya existente «estado inicial running, próximas piezas, reserva y paneles»
await expect(page.getByTestId('score-value')).toHaveText('0');
await expect(page.getByTestId('combo-value')).toBeVisible();
```

```ts
// dentro del paso ya existente de reinicio, tras hacer clic en reset-button
await expect(page.getByTestId('score-value')).toHaveText('0');
```

No se añade ninguna otra verificación E2E: no se simula ninguna secuencia de juego que module `score`/`combo` más allá de los ceros iniciales ya verificados. No se introduce lectura de píxeles del canvas ni ninguna captura de regresión visual.

## 33. Archivos previsiblemente afectados

- `packages/game-engine/src/index.ts` — `EngineSnapshot.score`/`combo`, tabla de puntos y constantes de caída, lógica de puntuación y combo dentro de `lockAndProcess`/`processVertical`/el bloque de hard drop, unificación de hard drop sobre `lockAndProcess()` (§20.1), reinicio en `reset()`.
- `packages/game-engine/src/game-engine.test.ts` — pruebas de §30.
- `apps/web/src/game/types.ts` — `GamePresentationState.score`/`combo`.
- `apps/web/src/game/types.test.ts` — pruebas de §31.1.
- `apps/web/src/game/scenes/GameScene.ts` — `notifyState()` con `score`/`combo` y su deduplicación.
- `apps/web/src/components/ScorePanel.vue` — nuevo componente (§29.3).
- `apps/web/src/components/ScorePanel.test.ts` — nuevo archivo de pruebas (§31.3).
- `apps/web/src/App.vue` — integración del nuevo componente, valor inicial de `gameState`.
- `apps/web/src/App.test.ts` — migración de literales y pruebas de §31.2.
- `apps/web/e2e/essential-flow.spec.ts` — ampliación puntual de §32.
- `docs/implementation/0013-puntuacion-combos.md` — informe de implementación (creado al finalizar, no ahora, §36).
- `docs/project-status.md` — actualización de estado (al finalizar, no ahora, §36).

No se prevé la creación ni modificación de ningún archivo de `packages/game-config`, de `apps/web/src/game/coordinates.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/game/session-status.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/input-release-guard.ts`, `apps/web/src/game/input-debug.ts`, ni de `apps/web/src/components/OpponentMonitor.vue`/`CombatStatusPanel.vue`/`HeldPiecePreview.vue`/`NextPiecesPreview.vue`. Si, durante la implementación, se detecta una necesidad real y mínima de tocar alguno de estos archivos, se documenta explícitamente en el informe de implementación junto con su justificación puntual.

## 34. Criterios de aceptación

### Contrato público

- `EngineSnapshot` expone `score: number` y `combo: number`; ningún otro campo cambia; `ActivePieceSnapshot` no cambia.
- `GameEvent` no gana ningún caso nuevo; `linesCleared` no cambia de forma (§16).
- `StepInput` no cambia de forma.
- `GamePresentationState` expone `score: number` y `combo: number`; ningún otro campo cambia.
- No se añade ningún código de error público nuevo.

### Semántica exacta

- Tabla de puntos por líneas: 100/300/500/800 para 1/2/3/4 líneas simultáneas, concedida una vez por fijación.
- Combo: `0` sin cadena activa, `1` tras la primera eliminación consecutiva, incrementado en 1 por cada eliminación consecutiva adicional, roto (`0`) por cualquier fijación sin líneas.
- Bonificación de combo: `50 * (combo - 1)` cuando `combo >= 2`, `0` en caso contrario, sin límite superior.
- Soft drop: 1 punto por celda realmente descendida con `softDropHeld: true`; hard drop: 2 puntos por celda de distancia real; gravedad normal: 0 puntos siempre.
- Hard drop de distancia `0`: 0 puntos de caída.
- Hold: no concede puntos y no afecta a `combo`.
- Puntuación por líneas/combo calculada exactamente una vez por fijación, con independencia de la vía de fijación (hard drop, expiración de lock delay, límite de reinicios), gracias a la unificación de §20.1.

### Determinismo, pureza y atomicidad

- Misma semilla, configuración y secuencia de `StepInput` producen `score`/`combo` idénticos entre dos motores independientes.
- Consultar `getSnapshot()` repetidamente no muta ningún estado del motor.
- Una entrada estructuralmente inválida, o una llamada a `step()` en `gameOver`, no muta `score` ni `combo`, ni emite ningún evento.
- `score` nunca disminuye dentro de una misma partida.

### Separación motor/Phaser/Vue

- `packages/game-engine` sigue sin depender de Phaser, Vue, DOM ni tiempo real.
- `GameScene.ts` no calcula ninguna regla de puntuación: solo traduce `snap.score`/`snap.combo` a `GamePresentationState`.
- `App.vue`/`ScorePanel.vue` no mantienen ninguna copia paralela de la lógica de puntuación: se limitan a mostrar `score`/`combo` recibidos vía `GamePresentationState`.

### Ausencia de alcance adicional

- No existe energía de combate, T-Spins, `back-to-back`, sabotajes, batalla, bot, backend, ranking, persistencia, ni ninguna otra mecánica listada en §6.
- No se añadió ninguna propiedad de configuración nueva en `packages/game-config` ni ninguna dependencia nueva en ningún paquete.
- No se añadió ningún evento de dominio nuevo.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

## 35. Puertas de calidad

Antes de declarar la tarea completada, ejecutar desde la raíz y verificar que todo finaliza correctamente:

```text
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Además, revisar:

- No existen imports profundos entre paquetes.
- `packages/game-config` no tiene ninguna modificación, salvo que la implementación demuestre y documente una necesidad real (no anticipada por esta especificación).
- No se ha ampliado `GamePresentationState` más allá de `score`/`combo`.
- No existe código muerto ni una segunda implementación de la secuencia de fijación: el hard drop invoca `lockAndProcess()` (§20.1), sin ninguna copia paralela de `lockActivePiece`/`clearLines`/`spawnNextPiece`.
- No hay abstracciones innecesarias (ninguna clase, servicio, interfaz o paquete nuevo dedicado a la puntuación; la lógica vive como funciones y estado adicional dentro del cierre ya existente de `createGameEngine`).
- No se ha ampliado el alcance más allá de §5.
- No hay errores ni avisos de lint ignorados.
- No se han usado scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline durante la implementación (`AGENTS.md`).
- El aviso de chunk de Vite/Rollup superior a 500 kB (atribuible a Phaser, aceptado desde `0004`) puede continuar apareciendo y no bloquea esta tarea.

## 36. Informe de implementación requerido

Este documento (`docs/tasks/0013-puntuacion-combos.md`) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá crear [docs/implementation/0013-puntuacion-combos.md](../implementation/0013-puntuacion-combos.md) como informe de implementación independiente, con:

- resumen;
- archivos creados y modificados;
- contrato público final (`EngineSnapshot.score`/`combo`, `GamePresentationState.score`/`combo`), y cualquier desviación de nombre o forma respecto de esta especificación, justificada;
- algoritmo final de puntuación y combo (nombres internos reales, tabla de constantes, si difieren de los orientativos de esta especificación);
- confirmación de la unificación de §20.1 (hard drop invocando `lockAndProcess()`), con referencia a las líneas finales del código;
- orden final dentro de `step()`/`processStep`, confirmado por lectura del código resultante;
- confirmación explícita de que no se añadió ningún evento de dominio nuevo, y por qué (referencia a §16);
- integración Vue (componente creado, ubicación en la consola táctica);
- pruebas añadidas (motor y web), y por qué;
- número final de tests Vitest y E2E;
- comandos ejecutados y resultados;
- desviaciones respecto de esta especificación, si las hubo, y su justificación;
- deuda técnica identificada (por ejemplo, la necesidad futura de mover la tabla de puntos a `packages/game-config` si se introducen perfiles de batalla reales);
- validación manual pendiente de confirmación por el usuario, si la hubiera (puntuación y combo correctos tras eliminar líneas de verdad jugando manualmente, coherencia tras pausa/reinicio, ausencia de parpadeo o incoherencia visual en `ScorePanel.vue`);
- confirmación explícita de la ausencia de las mecánicas excluidas (§6): energía, T-Spins, `back-to-back`, sabotajes, bot, batalla, backend, persistencia;
- confirmación explícita de que no se hicieron commits durante la implementación.

Y actualizar [docs/project-status.md](../project-status.md): estado de `0013` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y propuesta de siguiente tarea (§39).

Esta especificación no crea esos documentos ahora.

## 37. Restricciones para el agente implementador

- No modificar ninguna especificación existente de `docs/tasks/`, incluida esta.
- No usar scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline para modificar archivos ni para depurar el motor (`AGENTS.md`).
- No introducir dependencias nuevas en ningún paquete.
- No modificar `packages/game-config` salvo necesidad real demostrada y documentada (no se anticipa ninguna en esta tarea, §8.3).
- No crear una clase, servicio, interfaz o paquete específico para la puntuación: la lógica se integra como funciones y estado adicional dentro de `packages/game-engine/src/index.ts`, siguiendo el estilo ya existente.
- No añadir ningún evento de dominio nuevo (§16); si durante la implementación surge la tentación de añadir uno para «facilitar» la interfaz, detenerse y preguntar antes de hacerlo.
- No añadir `maxCombo` ni ningún otro campo de puntuación sin consumidor real (§15.3).
- No implementar energía de combate, T-Spins, `back-to-back`, sabotajes, bot, batalla, backend, ranking, persistencia ni pantalla de resultados.
- No añadir animaciones, partículas, flashes ni audio asociados a la puntuación o al combo.
- Detenerse y preguntar si, durante la implementación, se detecta una decisión funcional no cubierta explícitamente por esta especificación (`AGENTS.md`, «Procedimiento de trabajo»).
- No hacer commits salvo instrucción explícita del usuario.
- Ejecutar las cuatro validaciones raíz (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`) y `pnpm test:e2e` antes de declarar la tarea completada, y validar el arranque real con `pnpm dev` (`AGENTS.md`, «Aplicaciones ejecutables»), deteniendo el servidor al finalizar.

## 38. Definición de terminado

La tarea `0013` se considera terminada cuando:

- el contrato público descrito en §15 y §28 está implementado exactamente como se especifica, sin campos adicionales no previstos ni eventos nuevos;
- todas las reglas de §8 a §26 están implementadas y verificadas por las pruebas mínimas de §30 y §31;
- el hard drop invoca `lockAndProcess()` en vez de duplicar su secuencia de fijación (§20.1);
- la presentación Vue (§29) muestra correctamente la puntuación real y el estado del combo (activo o neutro) sin duplicar la lógica del motor;
- las puertas de calidad de §35 finalizan correctamente;
- se ha creado el informe de implementación (§36) y actualizado `docs/project-status.md`;
- no queda ninguna ampliación de alcance no justificada respecto de §5/§6;
- no se ha hecho ningún commit no solicitado explícitamente por el usuario.

## 39. Siguiente tarea

No se fija una `0014` definitiva. Esta especificación no prejuzga cuál será. Candidatas razonables, a decidir tras validar manualmente la puntuación y los combos y revisar `docs/rautfall.md` frente al estado real del proyecto: T-Spins y `back-to-back` (ambos ya delimitados como fuera de alcance de `0013`, §6), la energía de combate (que presupone la puntuación aquí implementada, `docs/rautfall.md` §680–695), o el primer sabotaje real (que a su vez presupone la energía). No se fija ninguna de estas como definitiva.
