# 0014 — T-Spins y back-to-back

## 1. Estado y precedencia

- **Proyecto:** Rautfall
- **Tarea:** 0014 — T-Spins y back-to-back
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0014`. Las decisiones globales de producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para energía de combate, sabotajes, batalla, bot o backend pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0014-t-spins-back-to-back.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como documento independiente, [Informe de implementación](../implementation/0014-t-spins-back-to-back.md) (ver §29), siguiendo la convención de rutas de `AGENTS.md`.
- Ninguna especificación anterior (`0001`–`0013`) se modifica como parte de esta tarea. Esta especificación no contradice ninguna de ellas; donde se apoya en un contrato o comportamiento ya fijado por una tarea anterior, lo cita explícitamente y lo conserva sin cambios salvo que se indique lo contrario de forma explícita.

## 2. Objetivo

Añadir **detección de T-Spins** y **cadenas back-to-back** al modo Training (`packages/game-engine`), integrándolas con la puntuación y el combo ya implementados por `0013`, con su integración mínima de presentación en `apps/web`.

Al terminar la tarea:

- el motor detecta si una fijación de la pieza `T` constituye un T-Spin, según una regla precisa basada en el último movimiento relevante y en la ocupación de las cuatro esquinas del centro de rotación (§9);
- `EngineSnapshot` expone `backToBack: number`, calculado exclusivamente por el motor (§21);
- la tabla de puntos de T-Spin (§15) y la bonificación back-to-back (§17) se integran en `lockAndProcess()` sin duplicar la fuente de verdad, reutilizando exactamente el mismo punto de cálculo ya unificado por `0013` (§20 de esa especificación);
- `apps/web` (Vue) muestra `backToBack` real, leído directamente del snapshot vía `GamePresentationState`, sin recalcular ni duplicar ninguna regla;
- no se añade energía de combate, sabotajes, bot, batalla, backend, audio, animaciones, partículas ni T-Spin Mini (§10).

## 3. Fuentes de verdad

En este orden, según `AGENTS.md`:

1. [AGENTS.md](../../AGENTS.md).
2. [docs/rautfall.md](../rautfall.md) — decisión funcional citada explícitamente: «Decisión funcional: puntuación, combos y energía» (§680–746: tres tipos de habilidad premiada, T-Spins detectados inicialmente como «sin eliminación», «una línea», «dos líneas», «tres líneas»; T-Spin Mini «se evaluará durante la implementación y podrá quedar fuera del MVP si añade complejidad desproporcionada»; back-to-back iniciado por «cuatro líneas o T-Spins con líneas»; bonificación energética menor y limitada respecto de la de puntuación — energía fuera de alcance de `0014`, §6); «Sistema de rotación» (§587–631: SRS completo, centros de rotación establecidos, wall kicks); pantalla de resultados (§1727–1750, fuera de alcance); primera iteración técnica (§2108–2125: SRS mecánico sin detección de T-Spins ni back-to-back, confirmando que esta detección nunca se implementó).
3. Las especificaciones inmutables de `docs/tasks/`, en particular:
   - [0002 — Motor de juego determinista](0002-motor-de-juego-determinista.md): spawn, colisión, fijación, `clearLines`, game over por `spawnBlocked`, eventos base.
   - [0003 — Rotación SRS](0003-rotacion-srs.md): `Orientation`, tablas de wall kicks JLSTZ e I, comportamiento de la pieza `O`, evento `pieceRotated`.
   - [0006 — Lock delay y fijación diferida](0006-lock-delay-fijacion-diferida.md): fijación diferida, reinicios de lock delay por movimiento/rotación válidos, `lockAndProcess`.
   - [0011 — Pieza fantasma determinista](0011-pieza-fantasma-determinista.md): precedente de **no** añadir un campo a `EngineSnapshot`/`GamePresentationState` cuando no existe consumidor real; `landingCells` como campo puramente derivado sin relación con la puntuación.
   - [0012 — Reserva de pieza / hold](0012-reserva-pieza-hold.md): el hold nunca invoca `lockActivePiece`/`clearLines`; mismo precedente de no ampliar el snapshot sin consumidor real.
   - [0013 — Puntuación y combos](0013-puntuacion-combos.md): `score`/`combo` en `EngineSnapshot`, tabla `LINE_CLEAR_POINTS`, fórmula de combo `50 * (combo - 1)`, unificación de hard drop sobre `lockAndProcess()` (§20 de esa especificación — hallazgo clave reutilizado aquí, §22), decisión explícita de no añadir eventos de dominio nuevos sin consumidor real (§16 de esa especificación), decisión de mantener la tabla de puntos como constantes de código en `packages/game-engine`, no en `packages/game-config` (§8.3 de esa especificación).
4. Los informes de `docs/implementation/` correspondientes a las tareas citadas, en particular [0013](../implementation/0013-puntuacion-combos.md), que confirma 406 tests Vitest y 1 test E2E en verde en el momento de redactar esta especificación, y confirma la forma final real de `EngineSnapshot`, `GamePresentationState` y `lockAndProcess()`.
5. El estado real del código y Git, confirmado por lectura directa:
   - `packages/game-engine/src/index.ts` (1269 líneas, íntegro).
   - `packages/game-engine/src/game-engine.test.ts` (5864 líneas).
   - `apps/web/src/game/types.ts`, `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/App.vue`.
   - `apps/web/src/components/ScorePanel.vue`, `ScorePanel.test.ts`.
   - `apps/web/e2e/essential-flow.spec.ts`.
   - `docs/project-status.md` (406 tests Vitest, 1 test E2E, working tree limpio, rama `main`, HEAD `13f6782` en el momento de redactar esta especificación).

## 4. Contexto técnico heredado (auditoría del código real)

### 4.1 `Orientation` y geometría de la pieza `T`

`Orientation` (`index.ts:19-24`) es un enum con cuatro valores (`Spawn = 0`, `Right = 1`, `Reverse = 2`, `Left = 3`). `PIECE_ORIENTATION_CELLS.T` (`index.ts:231-236`) define, para cada orientación, cuatro celdas relativas al origen `(x, y)` de la pieza activa:

```text
Spawn:   (1,0) (0,1) (1,1) (2,1)
Right:   (1,0) (1,1) (2,1) (1,2)
Reverse: (0,1) (1,1) (2,1) (1,2)
Left:    (1,0) (0,1) (1,1) (1,2)
```

Confirmado por inspección directa: la celda relativa `(1, 1)` está presente en las cuatro orientaciones. Esto significa que el **centro de rotación de la T en coordenadas absolutas es siempre `(activePiece.x + 1, activePiece.y + 1)`**, con independencia de la orientación — no requiere ninguna tabla adicional ni distinción por orientación (§13).

### 4.2 Rotación SRS y wall kicks (`tryRotate`, `index.ts:472-515`)

`tryRotate(board, activePiece, clockwise)` calcula `targetOrientation`, y:

- para la pieza `O`: intenta la rotación sin tabla de kicks (`getKickTable` devuelve `{}` para `O`, `index.ts:464`), sin desplazamiento;
- para el resto: obtiene la tabla (`JLSTZ_KICKS` o `I_KICKS`) y prueba sus hasta cinco desplazamientos (`kicks`) en orden, aplicando el primero que no colisione.

`tryRotate` devuelve `boolean` (éxito o fracaso) y **no expone qué índice de la tabla de kicks se usó** — ni a su llamador (`processStep`, `index.ts:952-987`) ni al exterior. El único efecto observable de una rotación válida es la mutación de `activePiece.x/y/orientation` y el evento `pieceRotated` (`index.ts:962`). Esta ausencia de índice de kick es relevante para §10 (T-Spin Mini requiere conocer si se usó el último kick de la tabla).

### 4.3 Ausencia total de estado de «última acción» en el motor

Auditado exhaustivamente: **el motor no conserva actualmente ninguna información sobre la última acción válida aplicada a la pieza activa.** No existe ningún campo `lastAction`, `lastRotation`, `lastActionWasRotation` ni equivalente. Cada acción (movimiento horizontal, rotación, gravedad, soft drop, hard drop, hold) se procesa y muta el estado sin dejar ningún rastro adicional más allá de sus efectos ya conocidos (posición, orientación, eventos, `lockDelayElapsedMs`, `lockResetsUsed`). Esta tarea introduce el primer estado de este tipo (§11).

### 4.4 Qué distingue el motor entre tipos de acción, hoy

El motor sí distingue funcionalmente, en el código, entre:

- movimiento horizontal válido (`tryMoveHorizontal`, `index.ts:735-773`, invocado desde `activateDirection`/DAS/ARR dentro de `processHorizontal`, `index.ts:810-882`): muta `activePiece.x`, emite `pieceMoved{reason:'horizontal'}`, gestiona lock delay (reinicio si estaba apoyada antes y después);
- movimiento horizontal bloqueado: `tryMoveHorizontal` devuelve `false` sin mutar nada;
- rotación válida (`tryRotate` devuelve `true` dentro del bloque de rotación de `processStep`, `index.ts:952-987`): muta `activePiece.x/y/orientation`, emite `pieceRotated`, gestiona lock delay igual que el movimiento horizontal;
- rotación inválida: `tryRotate` devuelve `false`, no muta nada, no hay interacción con lock delay (comentario explícito en el código, `index.ts:985`);
- gravedad (`processVertical`, `index.ts:889-919`, con `input.softDropHeld === false`): mueve la pieza una celda si no colisiona, emite `pieceMoved{reason:'gravity'}`, sin puntuar (`0013`);
- soft drop (`processVertical` con `input.softDropHeld === true`): igual mecanismo, emite `pieceMoved{reason:'softDrop'}`, puntúa 1 punto/celda (`0013`);
- intento de descenso bloqueado (gravedad o soft drop): la unidad de progreso se consume, no hay movimiento, no hay evento (`index.ts:916-917`);
- hard drop (`index.ts:991-1002`): si `distance >= 1`, mueve la pieza y emite `pieceMoved{reason:'hardDrop'}`, puntúa `distance * 2` (`0013`); siempre invoca `lockAndProcess()` (unificado por `0013`, §20 de esa especificación) e interrumpe el paso;
- hold (`index.ts:922-945`): nunca invoca `lockActivePiece`/`clearLines` (`0012`); si se ejecuta, siempre termina en `attemptIncomingSpawn` (`index.ts:708-727`), que activa una pieza entrante nueva.

### 4.5 Qué ocurre con el estado de la pieza tras cada evento (auditoría exhaustiva)

| Evento | `lockDelayElapsedMs` | `lockResetsUsed` | `holdUsed` | Estado de «última acción» hoy |
| --- | --- | --- | --- | --- |
| Rotación válida (apoyada antes y después) | `= 0` | `+= 1` | sin cambio | no existe |
| Rotación válida (no apoyada) | `= 0` | sin cambio | sin cambio | no existe |
| Rotación inválida | sin cambio | sin cambio | sin cambio | no existe |
| Movimiento horizontal válido (apoyada antes y después) | `= 0` | `+= 1` | sin cambio | no existe |
| Movimiento horizontal bloqueado | sin cambio | sin cambio | sin cambio | no existe |
| Gravedad (mueve) | reiniciado indirectamente (solo si queda apoyada, ver `index.ts:1020-1023`) | sin cambio | sin cambio | no existe |
| Soft drop (mueve) | igual que gravedad | sin cambio | sin cambio | no existe |
| Hard drop | fija inmediatamente (`lockAndProcess`) | — (pieza nueva) | — (pieza nueva) | no existe |
| Espera en lock delay (apoyada, sin acción) | `+= fixedStepMs` | sin cambio | sin cambio | no existe |
| Hold | — (pieza nueva vía `attemptIncomingSpawn`) | reinicia a `0` | `true` para la entrante | no existe |
| Spawn (`spawnInitialPieces`/`spawnNextPiece`/`attemptIncomingSpawn`) | `= 0` | `= 0` | `= false` (o `true` si viene de hold) | no existe |
| Reset | `= 0` | `= 0` | `= false` | no existe |
| Entrada inválida | sin cambio (el motor lanza antes de `processStep`) | sin cambio | sin cambio | no existe |

Esta tabla confirma que **todas las transiciones de spawn ya reinician un conjunto de contadores por pieza** (`lockDelayElapsedMs`, `lockResetsUsed`, `holdUsed`); el nuevo estado de esta tarea (§11) se integra en el mismo patrón, en los mismos puntos exactos del código.

### 4.6 `lockAndProcess()` tras `0013` (`index.ts:609-636`)

```ts
function lockAndProcess(): void {
  lockActivePiece();
  const lineIndices = clearLines();
  if (lineIndices.length > 0) {
    const linesCount = lineIndices.length as 1 | 2 | 3 | 4;
    const basePoints = LINE_CLEAR_POINTS[linesCount];
    combo += 1;
    const comboBonus = combo >= 2 ? 50 * (combo - 1) : 0;
    score += basePoints + comboBonus;
    eventQueue.push({ type: 'linesCleared', step: currentStep, lines: lineIndices.length, lineIndices: Object.freeze([...lineIndices]) });
  } else {
    combo = 0;
  }
  spawnNextPiece();
}
```

Es el **único punto de cálculo** de puntuación por líneas y combo, invocado desde tres vías: hard drop (`index.ts:1000`, ya unificado por `0013`), límite de reinicios de lock delay alcanzado durante movimiento horizontal (`index.ts:758`) o rotación (`index.ts:975`), y expiración del temporizador de lock delay (`index.ts:1017`). Esta tarea reutiliza exactamente este mismo punto único para T-Spin y back-to-back (§22), sin introducir una segunda vía de cálculo.

### 4.7 Cota máxima de líneas alcanzables por la pieza `T`

`PIECE_HEIGHT.T = 2` (`index.ts:268`) describe el *bounding box* de la orientación Spawn/Reverse, pero las orientaciones Right/Left ocupan realmente 3 filas (`y` de `0` a `2` en `PIECE_ORIENTATION_CELLS.T[Right]`/`[Left]`, confirmado en §4.1). Ninguna orientación de `T` ocupa 4 filas: **un T-Spin no puede eliminar más de 3 líneas simultáneamente.** Esta cota, verificada contra la tabla de celdas real (no asumida), fija el rango de la tabla de puntuación de T-Spin a `{0, 1, 2, 3}` líneas (§15) sin necesitar un caso de 4 líneas ni validación adicional en tiempo de ejecución.

### 4.8 `GamePresentationState` y `ScorePanel.vue` tras `0013`

```ts
// apps/web/src/game/types.ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;
  score: number;
  combo: number;
}>;
```

`GameScene.notifyState()` (`GameScene.ts:528-556`) construye este objeto desde `engine.getSnapshot()` y lo entrega a Vue solo cuando cambia (comparación campo a campo, incluyendo `score`/`combo`). `ScorePanel.vue` (`apps/web/src/components/ScorePanel.vue`) recibe `score`/`combo` como props y muestra dos filas: puntuación numérica y combo (`combo >= 1 ? combo : '—'`). No existe ningún placeholder simulado de T-Spin o back-to-back en ningún componente Vue actual (confirmado por inspección de `simulated-tactical-data.ts` y `CombatStatusPanel.vue`, que solo simulan energía, cartucho y Residuos, sin cambios desde `0009`/`0013`).

### 4.9 Cobertura actual de Playwright

`apps/web/e2e/essential-flow.spec.ts` verifica, entre otros, `score-value` = `'0'` y visibilidad de `combo-value` en el estado inicial. No ejercita ninguna mecánica de dominio (rotación, T-Spins, líneas). Confirma el criterio ya establecido en `0010`: los E2E no fuerzan secuencias de teclado frágiles para construir jugadas de dominio complejas.

## 5. Confirmación de viabilidad

Se cumplen las condiciones exigidas para que `0014` sea la siguiente tarea adecuada:

- SRS está implementado y probado (`0003`), incluyendo tablas de wall kicks completas y un centro de rotación de la `T` verificado como fijo en las cuatro orientaciones (§4.1).
- Puntuación y combo están implementados y probados (`0013`), con un único punto de cálculo (`lockAndProcess()`) ya unificado entre hard drop y el resto de vías de fijación.
- La detección de T-Spin puede realizarse enteramente dentro de `packages/game-engine`, mediante un nuevo booleano de estado interno (§11) y una función de conteo de esquinas que reutiliza la misma semántica que `isCollision` (§13) — no exige reescribir el motor ni introducir una abstracción nueva (clase, servicio, capa).
- Las reglas de esta tarea (candidatura de rotación, conteo de esquinas, tabla de puntos, back-to-back) son verificables mediante pruebas deterministas siguiendo el mismo patrón ya usado en `game-engine.test.ts` (bucle de `hardDrop` hasta obtener una pieza concreta, construcción de la pila mediante piezas arbitrarias y movimiento horizontal).
- No depende de energía de combate, sabotajes ni batalla: ninguna de las reglas fijadas aquí necesita esos sistemas, todavía inexistentes en el repositorio.

`0014` es la siguiente tarea adecuada. No se detiene el procedimiento; se procede a fijar la especificación completa.

## 6. Alcance incluido

- Detección determinista de T-Spin dentro de `packages/game-engine`, evaluada en el único punto de fijación (`lockAndProcess()`), sin distinguir T-Spin Mini (§10).
- Nuevo estado interno mínimo `lastActionWasRotation: boolean` (§11).
- Reglas exactas de candidatura de rotación: qué la establece, qué la conserva, qué la invalida (§12).
- Reglas exactas de conteo de esquinas y centro de rotación de la `T` (§13).
- Tabla de puntos de T-Spin (`0`, `1`, `2`, `3` líneas), como constantes de código en `packages/game-engine` (§15), coherente con la decisión ya adoptada por `0013` (§8.3 de esa especificación) de mantener las tablas de puntuación fuera de `packages/game-config`.
- Ampliación de `EngineSnapshot`/`GamePresentationState` con `backToBack: number` (§21).
- Reglas completas de back-to-back: qué jugadas lo inician/mantienen/rompen/no lo afectan (§16), y su fórmula de bonificación (§17).
- Integración exacta de T-Spin y back-to-back con el combo ya existente, sin modificar la regla de combo de `0013` (§18).
- Migración de todo consumidor real de `EngineSnapshot`/`GamePresentationState` afectado por el campo nuevo (`GamePresentationState`, literales de test existentes).
- Ampliación mínima de `ScorePanel.vue` con una fila de back-to-back (§25).
- Pruebas de motor (TDD pragmático) que cubren todas las reglas fijadas en esta especificación (§27).
- Pruebas web mínimas para el cambio real de `apps/web` (§28).
- Una única ampliación puntual y justificada del E2E existente, si procede (§29 → decisión en §14 de esta sección de estructura; ver más abajo la sección numerada correspondiente).

## 7. Alcance explícitamente excluido

No pertenece a `0014`:

- T-Spin Mini, en ninguna de sus variantes (sin eliminación, single) — decisión justificada en §10.
- Energía de combate derivada de T-Spins o back-to-back, cartuchos, sabotajes.
- Batalla, bot, multijugador local, backend, persistencia, ranking, historial.
- Heurística del bot para construir T-Spins deliberadamente.
- Pantalla de resultados postpartida (`docs/rautfall.md` §1727–1750): «T-Spins» como métrica de esa pantalla no se implementa aquí.
- Audio, partículas, animaciones, flashes o cualquier efecto transitorio asociado a la detección de un T-Spin o al crecimiento/ruptura de una cadena back-to-back.
- Indicadores complejos de HUD (banners, textos de «T-SPIN!», contadores históricos).
- Niveles, multiplicadores de velocidad de caída o dificultad progresiva.
- Balance configurable: los valores de puntuación de esta tarea son invariantes de código, igual que en `0013` (§8.3 de esa especificación).
- Cualquier campo de configuración nuevo en `packages/game-config`.
- Cualquier evento de dominio nuevo (§20 justifica por qué no se añade ninguno).
- Cualquier campo adicional del snapshot sin consumidor real (`lastClear`, `lastSpin`, `lastScoreAward`, índice de wall kick usado) — justificado en §19/§21.
- Rediseño del marco Tactical Industrial Dramatic, del monitor rival o del panel de combate simulado.
- Ampliación general del E2E más allá de lo estrictamente justificado en la sección de E2E.
- Refactor arquitectónico general del motor: no se introduce ninguna clase, servicio ni capa nueva; el cambio se integra como funciones y estado adicional dentro de `packages/game-engine/src/index.ts`, en el mismo estilo que el código existente.
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §6.

## 8. Terminología

- **T-Spin:** clasificación de una fijación de la pieza `T` cuya última acción relevante fue una rotación válida y cuyo centro de rotación tiene al menos 3 de sus 4 esquinas diagonales ocupadas en el instante de la fijación (§9). Incluye el caso sin eliminación de líneas.
- **Esquina ocupada:** una de las cuatro celdas diagonales al centro de rotación de la `T` que está fuera de los límites del tablero (pared lateral, suelo o límite superior) o contiene un bloque ya fijado (§13).
- **Candidatura de rotación (`lastActionWasRotation`):** estado interno booleano que indica si la última mutación aplicada a la pieza activa fue una rotación válida, sin ningún movimiento posterior (§11, §12).
- **Jugada difícil:** una fijación que elimina 4 líneas (Quad) o que es un T-Spin con al menos 1 línea eliminada (§16). Un T-Spin sin líneas **no** es una jugada difícil a efectos de back-to-back (§16).
- **Back-to-back (`backToBack`):** contador entero que representa la longitud de la cadena actual de jugadas difíciles consecutivas, expuesto como `EngineSnapshot.backToBack`. `0` significa ausencia de cadena; `1` significa que la fijación más reciente fue una jugada difícil, la primera de una posible cadena (sin bonificación todavía); `n` (`n ≥ 2`) significa que las últimas `n` jugadas difíciles han sido consecutivas (con bonificación desde `n = 2`).
- **Bonificación back-to-back:** puntos adicionales otorgados desde la segunda jugada difícil consecutiva, proporcionales a los puntos base de esa jugada (§17).
- **Ruptura de back-to-back:** transición de `backToBack > 0` a `backToBack = 0`, provocada exclusivamente por una fijación que elimina entre 1 y 3 líneas sin ser T-Spin (§16).

## 9. Definición formal de T-Spin

Una fijación se clasifica como **T-Spin** si y solo si, en el instante de evaluación (§9.4), se cumplen simultáneamente:

1. La pieza fijada es de tipo `T`.
2. `lastActionWasRotation === true` (§11, §12): la última mutación aplicada a esta pieza activa fue una rotación válida, sin ningún movimiento posterior de ningún tipo.
3. Al menos 3 de las 4 esquinas diagonales del centro de rotación de la `T` están ocupadas (§13), contando el estado del tablero **antes** de escribir la pieza fijada y **antes** de eliminar líneas.

No se distingue T-Spin «completo» de T-Spin «Mini»: cualquier fijación que cumpla las tres condiciones anteriores es un T-Spin a efectos de esta tarea (§10 justifica por qué se excluye esa distinción).

### 9.1 Pseudocódigo de detección

```ts
function isTSpin(board: (PieceType | null)[][], piece: ActivePiece, lastActionWasRotation: boolean): boolean {
  if (piece.type !== 'T') return false;
  if (!lastActionWasRotation) return false;
  return countOccupiedCorners(board, piece) >= 3;
}

function countOccupiedCorners(board: (PieceType | null)[][], piece: ActivePiece): number {
  const cx = piece.x + 1; // centro de rotación, fijo en las cuatro orientaciones (§4.1)
  const cy = piece.y + 1;
  const corners: Cell[] = [
    { x: cx - 1, y: cy - 1 }, // superior-izquierda
    { x: cx + 1, y: cy - 1 }, // superior-derecha
    { x: cx - 1, y: cy + 1 }, // inferior-izquierda
    { x: cx + 1, y: cy + 1 }, // inferior-derecha
  ];
  return corners.filter((c) => isCornerOccupied(board, c)).length;
}

function isCornerOccupied(board: (PieceType | null)[][], cell: Cell): boolean {
  if (cell.x < 0 || cell.x >= BOARD_COLS) return true;  // pared lateral
  if (cell.y < 0 || cell.y >= BOARD_ROWS) return true;  // suelo o límite superior
  return board[cell.y]![cell.x] !== null;               // bloque fijo
}
```

`isCornerOccupied` reutiliza exactamente la misma semántica de límites que `isCollision` (`index.ts:358-368`) aplicada a una única celda, sin inventar una regla nueva de contorno. El límite superior (`y < 0`) cuenta como ocupado por la misma razón de uniformidad, aunque no es alcanzable en la práctica: el `spawnY` de la `T` (`calculateSpawnY`, `index.ts:433-435`) sitúa el centro de rotación en `y = 4` como mínimo, y ninguna secuencia de rotaciones o kicks documentada en las tablas SRS (`index.ts:282-303`) puede llevar ese centro a `y < 1`. Esta decisión no tiene, por tanto, ningún efecto observable en el juego real; se documenta únicamente para que la función quede definida sin ambigüedad en cualquier entrada.

### 9.2 Centro de rotación exacto por orientación

Confirmado en §4.1: el centro absoluto es siempre `(piece.x + 1, piece.y + 1)`, para las cuatro orientaciones (`Spawn`, `Right`, `Reverse`, `Left`). No se requiere una tabla adicional de centros por orientación.

### 9.3 Wall kicks: no influyen en la clasificación

Cualquier rotación válida cuenta igual para `lastActionWasRotation`, con independencia de qué desplazamiento de la tabla de kicks (`index.ts:282-303`) se haya aplicado — incluido el caso sin desplazamiento (`{x:0,y:0}`, siempre el primer intento de cada tabla). No se registra ni se expone qué índice de kick se usó (§4.2): esta tarea no necesita esa información porque no implementa T-Spin Mini (§10), cuya distinción (en el estándar de la industria) sí depende del índice de kick utilizado.

### 9.4 Instante de evaluación

La condición se evalúa **una sola vez por fijación**, dentro de `lockAndProcess()`, en este momento exacto:

1. Antes de invocar `lockActivePiece()` (antes de escribir la pieza en el tablero).
2. Antes de invocar `clearLines()` (antes de eliminar cualquier línea).
3. Usando `board` en su estado inmediatamente anterior a la fijación, y `activePiece` en su posición/orientación final (ya resuelta por movimiento, rotación, gravedad o hard drop de ese mismo paso).

No importa si se evalúa antes o después de que `lockActivePiece()` escriba las celdas de la propia `T`: las cuatro esquinas nunca coinciden con las celdas propias de la pieza en ninguna orientación (verificado contra `PIECE_ORIENTATION_CELLS.T`, §4.1), por lo que el resultado es idéntico en ambos órdenes. Se fija «antes» por ser el punto más simple y explícito de integrar en el código existente (§22).

## 10. Variantes incluidas y excluidas — decisión sobre T-Spin Mini

**Decisión: Opción A — implementar únicamente T-Spin completo (según la regla de 3+ esquinas de §9) y excluir T-Spin Mini de esta tarea.**

Variantes incluidas: T-Spin sin eliminación, T-Spin Single, T-Spin Double, T-Spin Triple (0 a 3 líneas, según §9.4 y la cota de §4.7).

Variantes excluidas: T-Spin Mini sin eliminación, T-Spin Mini Single, y cualquier otra variante no listada arriba.

### Justificación contra el motor real (no por costumbre)

- La distinción estándar entre T-Spin completo y T-Spin Mini exige conocer **qué esquinas concretas** están ocupadas (las dos esquinas «delanteras», en la dirección hacia la que apunta el saliente de la `T`, frente a las dos esquinas «traseras»), lo cual depende de la orientación de la pieza en el momento de la fijación. Esto obliga a mantener una tabla adicional de qué corners son «delanteros»/«traseros» por orientación — información que no existe hoy en el motor y que no tiene ningún otro consumidor (§4.1 confirma que el motor solo necesita el centro de rotación, no una clasificación de esquinas por rol).
- La regla estándar de la industria también exige una excepción: una rotación que usa el **último desplazamiento de la tabla de kicks** (el índice 4, el más extremo) siempre promueve la jugada a T-Spin completo, con independencia del conteo de esquinas delanteras/traseras. Esto exige registrar **qué índice de kick se usó** en la rotación — información que `tryRotate()` no expone hoy a su llamador (§4.2) y que no tiene ningún otro consumidor: añadirla exigiría cambiar la firma de `tryRotate()` y propagar un dato nuevo solo para esta excepción.
- Ninguna de las dos piezas de información anterior (esquinas por rol, índice de kick) tiene hoy ningún consumidor fuera de la clasificación Mini. Añadirlas ahora sería introducir complejidad y estado nuevos exclusivamente para una distinción que la propia fuente de verdad global (`docs/rautfall.md` §727) ya autoriza a excluir explícitamente si «añade complejidad desproporcionada» — y la auditoría confirma que sí la añade, de forma medible: dos piezas de estado nuevas (rol de esquina por orientación, índice de kick) frente a ninguna para el T-Spin completo.
- La regla de 3+ esquinas ocupadas, sin distinción de rol, es suficiente para cubrir exactamente las cuatro variantes que `docs/rautfall.md` (§718–723) exige como mínimo («T-Spin sin eliminación», «de una línea», «de dos líneas», «de tres líneas»), sin mencionar Mini en esa lista mínima.
- Se descarta la Opción B (implementar completo y Mini) por el coste de complejidad ya descrito, y la Opción C (dividir en dos tareas) porque no hay ningún indicio de que Mini vaya a ser necesario a corto plazo: no existe una tarea futura que dependa de esa distinción, y crear una tarea `0014b` sin consumidor concreto sería anticipar trabajo no solicitado (`AGENTS.md`, «no anticipar arquitectura destinada a tareas futuras»).

### Consecuencia sobre la tabla de puntos

Al no existir Mini, la tabla de puntos de T-Spin (§15) solo necesita 4 entradas (`0`, `1`, `2`, `3` líneas), sin una entrada separada para variantes Mini.

## 11. Estado interno necesario

Dentro de `createGameEngine`, junto a las variables mutables ya existentes (`lockDelayElapsedMs`, `lockResetsUsed`, `holdUsed`, `score`, `combo`):

```ts
let lastActionWasRotation = false;
let backToBack = 0;
```

### 11.1 Justificación de cada variable

- **`lastActionWasRotation: boolean`.** Es el único dato que la detección de T-Spin necesita del historial de la pieza activa (§9, §12). Se descartan alternativas más ricas:
  - **`lastRotation: { orientation, kickIndex } | null`** — descartada: el índice de kick no tiene consumidor sin Mini (§10); la orientación resultante ya está disponible en `activePiece.orientation`, duplicarla en un estado adicional no aporta nada.
  - **`lastSuccessfulAction: 'rotation' | 'horizontal' | 'gravity' | 'softDrop' | 'hardDrop' | null`** — descartada: ningún consumidor de esta tarea necesita distinguir *qué* acción no-rotación fue la última (solo necesita saber que *no fue* una rotación). Un enum de 5 valores donde solo 2 estados observables importan (`fue rotación` / `no lo fue`) es una abstracción sin necesidad real, contraria a «responsabilidades claras» y «no sobrearquitectura» (`AGENTS.md`).
  - **`lastActionWasRotation: boolean`** (adoptada) — es el mínimo estado suficiente: exactamente la pregunta que `isTSpin()` necesita responder (§9.1).
- **`backToBack: number`.** Sigue el mismo patrón ya validado por `combo` (`0013`, §12.5 de esa especificación): un entero simple es la representación más simple sin ambigüedad, sin necesitar un booleano auxiliar redundante ni un enum. Ver §16 para la semántica exacta de sus valores.

No se introduce ningún estado de «combo máximo», «T-Spin máximo», ni ninguna estructura adicional (array, objeto, temporizador): ningún consumidor real de esta tarea lo necesita, mismo criterio ya aplicado por `0011`/`0012`/`0013`.

### 11.2 Ciclo de vida de `lastActionWasRotation`

| Momento | Valor tras el evento | Punto exacto en el código |
| --- | --- | --- |
| Rotación válida (`tryRotate` devuelve `true`) | `true` | Inmediatamente después de `eventQueue.push({type:'pieceRotated', ...})`, dentro del bloque de rotación de `processStep` (tras `index.ts:962`) |
| Rotación inválida (`tryRotate` devuelve `false`) | sin cambio | No se toca — nada mutó |
| Movimiento horizontal válido (`tryMoveHorizontal` devuelve `true`) | `false` | Inmediatamente después de `eventQueue.push({type:'pieceMoved', reason:'horizontal'})`, dentro de `tryMoveHorizontal` (tras `index.ts:745`) |
| Movimiento horizontal bloqueado | sin cambio | No se toca |
| Gravedad o soft drop mueve una celda | `false` | Inmediatamente después de `eventQueue.push({type:'pieceMoved', reason: reason})`, dentro del bucle de `processVertical` (tras `index.ts:910`) |
| Intento de descenso bloqueado (gravedad/soft drop) | sin cambio | No se toca — no hubo movimiento real |
| Hard drop con `distance >= 1` | `false` | Inmediatamente después de `eventQueue.push({type:'pieceMoved', reason:'hardDrop'})`, antes de `lockAndProcess()` (tras `index.ts:995`) |
| Hard drop con `distance === 0` | sin cambio | No se toca — no hubo movimiento real; si la pieza ya estaba apoyada tras una rotación válida, la candidatura se conserva (§9, ejemplo en §18) |
| Espera durante lock delay (paso 10, sin acción) | sin cambio | No se toca — no hubo ninguna acción, solo transcurrió tiempo lógico |
| Entrada inválida (`EngineStepError`) | sin cambio | El motor lanza antes de `processStep`; no hay mutación de ningún tipo |
| Hold ejecutado | `false` | Mediante `attemptIncomingSpawn` (§11.3): la pieza entrante es una pieza nueva sin historial de rotación |
| Spawn (inicial, tras fijación, o entrante de hold) | `false` | Dentro de `spawnInitialPieces`, `spawnNextPiece`, `attemptIncomingSpawn` — mismo punto donde ya se reinician `lockDelayElapsedMs`/`lockResetsUsed`/`holdUsed` |
| `reset()` | `false` | Junto al resto de reinicios de estado en `reset()` |
| Pausa | sin cambio | El motor no conoce la pausa (`0008`); mientras `isPaused === true` no se recibe ningún `step()`, por lo que no hay ninguna oportunidad de mutar `lastActionWasRotation` |

### 11.3 Por qué el hold no necesita una regla especial

`attemptIncomingSpawn` (`index.ts:708-727`) ya forma parte del mismo grupo de «funciones de spawn» que reinician `lockDelayElapsedMs`/`lockResetsUsed` para la pieza entrante. Añadir `lastActionWasRotation = false` en ese mismo punto (junto a las otras tres funciones de spawn) es suficiente: el hold sustituye completamente la pieza activa, por lo que cualquier candidatura de rotación de la pieza saliente es irrelevante para la entrante. No se requiere ninguna comprobación adicional dentro del bloque de hold de `processStep` (`index.ts:922-945`).

## 12. Reglas de candidatura de rotación

### 12.1 Qué establece la candidatura

Únicamente una rotación válida (`tryRotate` devuelve `true`), con independencia de si usó un kick lateral, un kick de suelo, o ningún desplazamiento (§9.3).

### 12.2 Qué conserva la candidatura (no la invalida)

- Una rotación inválida posterior (nada mutó).
- Un movimiento horizontal bloqueado posterior (nada mutó).
- Un intento de descenso por gravedad o soft drop bloqueado (nada mutó; la unidad de progreso se consume, pero no hay movimiento real, §4.4).
- Un hard drop con `distance === 0` (la pieza ya estaba apoyada; no hay movimiento real).
- Cualquier número de pasos de espera durante el lock delay sin que ocurra ninguna acción (solo transcurre tiempo lógico; no es una acción, §11.2).
- Rotaciones válidas adicionales consecutivas (la candidatura se establece de nuevo a `true`, sigue siendo candidata).

### 12.3 Qué invalida la candidatura

- Un movimiento horizontal válido posterior (la pieza cambió de posición por una acción distinta de rotar).
- Un descenso real por gravedad (una celda o más).
- Un descenso real por soft drop (una celda o más).
- Un hard drop con `distance >= 1` (la pieza descendió realmente antes de fijarse).
- Un hold (la pieza activa completa se sustituye).
- Un spawn de cualquier tipo (pieza nueva sin historial).
- Un `reset()`.

### 12.4 Resumen por tipo de acción posterior a una rotación válida

| Acción tras la rotación | ¿Conserva la candidatura? |
| --- | --- |
| Rotación inválida | Sí |
| Movimiento horizontal bloqueado | Sí |
| Movimiento horizontal válido | No |
| Gravedad (bloqueada) | Sí |
| Gravedad (mueve) | No |
| Soft drop (bloqueado) | Sí |
| Soft drop (mueve) | No |
| Hard drop, `distance = 0` | Sí |
| Hard drop, `distance ≥ 1` | No |
| Espera en lock delay | Sí |
| Hold | No (pieza nueva) |

## 13. Reglas de esquinas y centro de rotación

Ver §9.1 y §9.2 para el pseudocódigo y la justificación del centro fijo `(piece.x + 1, piece.y + 1)`. Resumen de qué cuenta como esquina ocupada (§9.1):

- Bloque ya fijado en el tablero (`board[y][x] !== null`).
- Pared lateral (`x < 0` o `x >= BOARD_COLS`).
- Suelo (`y >= BOARD_ROWS`).
- Límite superior (`y < 0`) — incluido por uniformidad con `isCollision`, sin efecto práctico observable (§9.1).

El umbral de clasificación es **3 o 4 esquinas ocupadas** (ambos casos son T-Spin; no se distingue entre ellos, coherente con la exclusión de Mini, §10). 0, 1 o 2 esquinas ocupadas nunca constituyen T-Spin.

## 14. Clasificación de jugadas

No se introduce ningún tipo público exportado (`ClearKind` o equivalente). La clasificación de una fijación (T-Spin sí/no, número de líneas) es un detalle de implementación interno, calculado y consumido enteramente dentro de `lockAndProcess()` para decidir la tabla de puntos (§15), el combo (§18) y el back-to-back (§16) — sin sobrevivir como un valor expuesto en `EngineSnapshot` ni en ningún evento (§19, §21 justifican por qué no hay consumidor real para exponerla).

### 14.1 Regla de clasificación exacta (dentro de `lockAndProcess()`, tras calcular `lineIndices`)

```text
isTSpin = (activePiece.type === 'T') && lastActionWasRotation && (esquinasOcupadas >= 3)
linesCount = lineIndices.length   // 0 a 4 (0 solo relevante para T-Spin; una fijación ordinaria sin líneas no puntúa, 0013 §12.3)
isDifficult = (linesCount === 4) || (isTSpin && linesCount >= 1)
```

Nunca puede darse `isTSpin === true` con `linesCount === 4` (cota geométrica, §4.7): la tabla de T-Spin (§15) no necesita una entrada de 4 líneas.

## 15. Tabla de puntuación de T-Spins

**Decisión: tabla dedicada, mutuamente exclusiva con `LINE_CLEAR_POINTS` (`0013`), como constante de código en `packages/game-engine`:**

```ts
const T_SPIN_POINTS: Readonly<Record<0 | 1 | 2 | 3, number>> = Object.freeze({
  0: 400,
  1: 800,
  2: 1200,
  3: 1600,
});
```

| Jugada | Puntos base | Puntos base ordinarios equivalentes (`0013`) |
| --- | ---: | ---: |
| T-Spin sin eliminación | 400 | — (no existe entrada de 0 líneas en la tabla ordinaria) |
| T-Spin Single | 800 | 100 |
| T-Spin Double | 1200 | 300 |
| T-Spin Triple | 1600 | 500 |

### 15.1 Por qué estos valores exactos (no adoptados automáticamente)

- **Sustituyen, no se suman, a la tabla ordinaria.** Una fijación se clasifica como T-Spin o como jugada ordinaria, nunca ambas: `basePoints = isTSpin ? T_SPIN_POINTS[linesCount] : LINE_CLEAR_POINTS[linesCount]` (con `linesCount` acotado a `1|2|3|4` en la rama ordinaria, ya validado por `0013`). Esto elimina por construcción cualquier riesgo de doble puntuación entre ambas tablas: solo una rama se ejecuta por fijación.
- **Progresión coherente con «bonificación relevante» (`docs/rautfall.md` §725).** La proporción T-Spin/ordinario decrece con el número de líneas (8× para Single, 4× para Double, 3.2× para Triple), reflejando que un T-Spin Single es proporcionalmente más difícil de lograr que un Quad ordinario con la misma pieza, mientras que un T-Spin Triple ya es intrínsecamente difícil y no necesita un multiplicador tan extremo.
- Se evaluaron y descartaron explícitamente:
  - **Multiplicador sobre la tabla ordinaria** (p. ej. `LINE_CLEAR_POINTS[n] * 4`). Descartada: no cubre el caso de 0 líneas (no existe entrada `0` en la tabla ordinaria, exigiría una excepción); produce una progresión menos alineada con la convención ya extendida en la industria que la fuente de verdad global reclama implícitamente («bonificación relevante»).
  - **Un único valor fijo para cualquier T-Spin, sin distinguir por líneas.** Descartada: contradice la intención de premiar más las jugadas más difíciles (mismo principio ya aplicado a la tabla ordinaria y al combo en `0013`), y no ofrece ninguna diferencia observable entre Single/Double/Triple.
  - **La tabla exacta 400/800/1200/1600, sin distinción de líneas superpuesta** (adoptada). Es la hipótesis mínima razonable, explícitamente propuesta y validada contra la cota real de líneas alcanzables (§4.7): cuatro valores, uno por cada línea posible (`0`-`3`), sin necesitar casos especiales.
- Mismo régimen que `0013` (§8.3 de esa especificación): estos valores son constantes de código, no de `packages/game-config`, por la misma justificación (ausencia de perfiles reales de batalla, ausencia de necesidad de ajuste por perfil todavía).

### 15.2 Interacción con combo y drop score (resumen; detalle completo en §18 y §24-§26)

- Un T-Spin con 1-3 líneas incrementa el combo exactamente igual que una jugada ordinaria (`combo += 1`), y la bonificación de combo (`50 * (combo - 1)` desde `combo >= 2`, `0013`) se aplica sobre el mismo `combo` ya actualizado, sin ninguna variación por ser T-Spin.
- Un T-Spin sin líneas (`linesCount === 0`) **no** incrementa el combo: por la regla ya vigente de `0013` (§12.3 de esa especificación, sin modificar), cualquier fijación con `lineIndices.length === 0` pone `combo = 0`. Un T-Spin sin líneas es, a efectos de combo, una fijación sin líneas — ni más ni menos.
- Los puntos de caída (soft drop/hard drop, `0013` §10-§11) son completamente independientes y se conceden en el momento del movimiento, antes de que `lockAndProcess()` determine si la fijación resultante es un T-Spin.

## 16. Reglas de back-to-back

### 16.1 Qué jugadas son «difíciles» en esta tarea

- Un Quad (4 líneas eliminadas simultáneamente), sea o no con pieza `T` (geométricamente imposible que un T-Spin sea también Quad, §4.7).
- Un T-Spin con 1, 2 o 3 líneas eliminadas (T-Spin Single/Double/Triple).

**No** son jugadas difíciles a efectos de back-to-back:

- Un T-Spin sin eliminación (0 líneas): no elimina ninguna línea, por lo que no puede ser una «jugada difícil» en el sentido de esta cadena (§16.3 explica por qué esto no rompe la cadena tampoco).
- T-Spin Mini, en cualquier variante: no existe en esta tarea (§10).
- Cualquier eliminación ordinaria (Single, Double, Triple sin T-Spin).

### 16.2 Estado inicial y semántica del contador

`backToBack: number`, inicializado a `0` en la creación del motor y en `reset()`. Semántica adoptada (evaluada expresamente, no por defecto):

- `0`: sin cadena activa.
- `1`: la fijación más reciente fue una jugada difícil, la primera de una posible cadena — **sin bonificación todavía** (mismo patrón que `combo = 1`, `0013` §12.2).
- `n` (`n ≥ 2`): las últimas `n` jugadas difíciles han sido consecutivas — bonificación aplicada desde `n = 2` (§17).

Se evaluaron y descartaron:

- **Booleano (`backToBackActive: boolean`).** Descartada: no permite distinguir «primera jugada difícil, sin bonificación todavía» de «segunda o posterior, con bonificación», perdiendo información observable necesaria para aplicar §17 correctamente — mismo argumento ya usado por `0013` (§12.5 de esa especificación) para descartar un booleano en `combo`.
- **Enum (`'none' | 'started' | 'active'`).** Descartada: un contador entero ya distingue los mismos tres casos relevantes (`0`, `1`, `≥2`) sin introducir un tipo nuevo ni perder la información de «cuántas consecutivas», que además permite una prueba de regresión simple («la cadena sigue creciendo en la quinta jugada difícil consecutiva») sin necesitar un cuarto valor de enum.
- **Contador entero `backToBack: number`, semántica `0`/`1`/`n≥2`** (adoptada). Es la representación mínima suficiente, exactamente paralela a `combo` (mismo patrón ya validado en el código y en las pruebas existentes), sin estado adicional.

### 16.3 Qué mantiene, inicia, rompe o no afecta a la cadena

| Fijación | Efecto sobre `backToBack` |
| --- | --- |
| Quad | `backToBack += 1` (inicia en `1` si era `0`, o continúa) |
| T-Spin con 1-3 líneas | `backToBack += 1` (igual que Quad) |
| Eliminación ordinaria (Single/Double/Triple, no T-Spin) | `backToBack = 0` (rompe la cadena) |
| Fijación sin líneas (no T-Spin) | Sin cambio (se conserva el valor previo) |
| T-Spin sin líneas | Sin cambio (se conserva el valor previo, igual que cualquier fijación sin líneas) |
| Hold | Sin cambio (el hold nunca fija, `0012`) |
| Reset | `= 0` |
| Game over | Sin cambio (se conserva el último valor, mismo criterio que `score`/`combo`, `0013` §26.2) |

### 16.4 Por qué una fijación sin líneas no rompe la cadena (decisión explícita, no evidente)

A diferencia del combo (que se rompe con **cualquier** fijación sin líneas, `0013` §12.3, regla no modificada por esta tarea), el back-to-back se define exclusivamente sobre fijaciones que **sí** eliminan líneas: solo una eliminación que no alcanza el umbral de «difícil» (una eliminación ordinaria de 1-3 líneas) rompe la cadena. Esta distinción es intencional y no una omisión:

- Permite a un jugador intercalar una jugada de preparación (una pieza que no completa ninguna línea, o un T-Spin defensivo sin líneas) entre dos Quads o T-Spins sin perder la bonificación acumulada, exactamente igual que en la clasificación estándar de la industria para «back-to-back», que la fuente de verdad global no contradice en ningún punto (`docs/rautfall.md` §729-734 solo dice que «una eliminación ordinaria romperá la cadena», sin mencionar las fijaciones sin líneas).
- Si una fijación sin líneas rompiera también el back-to-back, el back-to-back se comportaría de forma idéntica al combo, y no existiría ninguna razón para mantener ambos como conceptos independientes con reglas de ruptura distintas (§18 exige explícitamente que se mantengan independientes).
- Un T-Spin sin líneas sigue concediendo su propia puntuación (§15) de forma completamente independiente de esta regla: la ausencia de efecto sobre `backToBack` no significa ausencia de recompensa por la jugada en sí.

## 17. Bonificación back-to-back

**Decisión: Opción A — multiplicador del 50 % sobre la puntuación base de la jugada difícil**, aplicado desde la segunda jugada difícil consecutiva (`backToBack >= 2`).

```ts
const BACK_TO_BACK_BONUS_RATIO = 0.5;

backToBackBonus = (isDifficult && backToBack >= 2)
  ? Math.floor(basePoints * BACK_TO_BACK_BONUS_RATIO)
  : 0;
```

### 17.1 Aclaraciones exigidas por la especificación

- **Redondeo:** `Math.floor()`. Con los valores exactos de `LINE_CLEAR_POINTS[4] = 800` y `T_SPIN_POINTS[1..3] = 800/1200/1600` (§15), el resultado de `basePoints * 0.5` es siempre un entero exacto (400/600/800); `Math.floor()` se fija de todos modos para que la fórmula quede determinista ante cualquier cambio futuro de la tabla de puntos, sin dejar un comportamiento implícito sin definir.
- **Se aplica desde la segunda jugada difícil:** la primera jugada difícil de una cadena (`backToBack` pasa de `0` a `1`) **no** recibe bonificación — mismo patrón que la bonificación de combo (`0013` §13.2).
- **Solo afecta a la puntuación base de la jugada difícil actual** (`basePoints`, ya sea `LINE_CLEAR_POINTS[4]` o `T_SPIN_POINTS[1..3]`): no se aplica sobre la bonificación de combo, ni sobre los puntos de caída (soft drop/hard drop) ya concedidos en un `step()` anterior o en el mismo `step()` antes de `lockAndProcess()`.
- **Jugadas no difíciles nunca reciben esta bonificación**, con independencia del valor de `backToBack` en el momento de esa fijación (una eliminación ordinaria siempre tiene `backToBackBonus = 0`, incluso si rompe una cadena larga — la bonificación es exclusiva de jugadas que además cumplen `isDifficult`).
- **Sin límite superior** en esta tarea, mismo criterio que `combo` (`0013` §13.3): `docs/rautfall.md` no fija un tope de puntuación para back-to-back, a diferencia de la energía (fuera de alcance).

### 17.2 Orden de cálculo dentro de una fijación con líneas

```text
1. basePoints = isTSpin ? T_SPIN_POINTS[linesCount] : LINE_CLEAR_POINTS[linesCount]
2. combo += 1
3. comboBonus = combo >= 2 ? 50 * (combo - 1) : 0
4. isDifficult = (linesCount === 4) || (isTSpin && linesCount >= 1)
5. if (isDifficult) backToBack += 1; else backToBack = 0
6. backToBackBonus = (isDifficult && backToBack >= 2) ? Math.floor(basePoints * 0.5) : 0
7. score += basePoints + comboBonus + backToBackBonus
```

`combo` se incrementa **antes** de calcular `comboBonus` (regla ya vigente de `0013`); `backToBack` se incrementa o rompe **antes** de calcular `backToBackBonus`, por el mismo motivo de coherencia: ambas bonificaciones se calculan siempre sobre el valor ya actualizado por la fijación actual, nunca sobre el valor anterior.

### 17.3 Alternativas evaluadas y rechazadas

- **Opción B — bonificación fija** (p. ej. `+200` puntos por cada jugada difícil desde la segunda). Descartada: no escala con la dificultad de la jugada (un Quad y un T-Spin Triple recibirían la misma bonificación absoluta pese a tener puntuaciones base muy distintas), y `docs/rautfall.md` no sugiere en ningún punto que la bonificación deba ser plana.
- **Opción C — tabla específica** (una entrada de bonificación por cada combinación de tipo de jugada difícil × longitud de cadena). Descartada: multiplica la superficie de valores a mantener y probar sin ninguna necesidad de balance demostrada; el multiplicador simple ya crece de forma proporcional sin necesitar una tabla.
- **Opción D — posponer la bonificación y registrar únicamente la cadena.** Descartada: `docs/rautfall.md` (§731-734) exige explícitamente que «una nueva eliminación difícil consecutiva recibirá una bonificación» dentro de la misma decisión funcional que motiva esta tarea; posponerla dejaría `0014` incompleta respecto de su propio objetivo (§2).
- **Opción A — multiplicador del 50 %** (adoptada). Es la hipótesis explícitamente propuesta, escala de forma proporcional y predecible con la dificultad de la jugada, reutiliza el mismo patrón de cálculo ya establecido por el combo (bonificación aplicada sobre el valor ya incrementado, desde el segundo elemento de la cadena), y produce siempre valores enteros con la tabla actual (§17.1).

## 18. Relación entre combo y back-to-back

Combo y back-to-back son conceptos independientes, con estado y reglas de ruptura propias (§16.4), calculados en el mismo punto (`lockAndProcess()`) pero sin que uno dependa del valor del otro. Ningún cambio de esta tarea modifica la regla de combo ya fijada por `0013`.

### 18.1 Casos combinados con ejemplos numéricos completos

Se asume, en todos los ejemplos, que no hay puntuación previa de caída salvo cuando se indique explícitamente, y que `LINE_CLEAR_POINTS`/`T_SPIN_POINTS` son los de §9/§15.

**Ejemplo 1 — T-Spin Single como primera eliminación de la partida.**
Estado previo: `score=0, combo=0, backToBack=0`.
`isTSpin=true, linesCount=1, basePoints=800, combo→1, comboBonus=0 (combo<2), isDifficult=true, backToBack→1, backToBackBonus=0 (backToBack<2)`.
`score += 800 + 0 + 0 = 800`. Estado final: `score=800, combo=1, backToBack=1`.

**Ejemplo 2 — T-Spin Double como segunda eliminación consecutiva (tras el ejemplo 1).**
Estado previo: `score=800, combo=1, backToBack=1`.
`isTSpin=true, linesCount=2, basePoints=1200, combo→2, comboBonus=50*(2-1)=50, isDifficult=true, backToBack→2, backToBackBonus=floor(1200*0.5)=600`.
`score += 1200 + 50 + 600 = 1850`. Estado final: `score=2650, combo=2, backToBack=2`.

**Ejemplo 3 — Quad después de un T-Spin (tras el ejemplo 2).**
Estado previo: `score=2650, combo=2, backToBack=2`.
`isTSpin=false (pieza no T), linesCount=4, basePoints=800, combo→3, comboBonus=50*(3-1)=100, isDifficult=true (linesCount=4), backToBack→3, backToBackBonus=floor(800*0.5)=400`.
`score += 800 + 100 + 400 = 1300`. Estado final: `score=3950, combo=3, backToBack=3`.

**Ejemplo 4 — Single ordinario después de un Quad (tras el ejemplo 3).**
Estado previo: `score=3950, combo=3, backToBack=3`.
`isTSpin=false, linesCount=1, basePoints=100, combo→4, comboBonus=50*(4-1)=150, isDifficult=false (linesCount=1, no T-Spin), backToBack=0 (rompe), backToBackBonus=0`.
`score += 100 + 150 + 0 = 250`. Estado final: `score=4200, combo=4, backToBack=0`.

**Ejemplo 5 — pieza sin líneas después de un Quad (variante alternativa al ejemplo 4, partiendo del mismo estado previo al ejemplo 4: `score=3950, combo=3, backToBack=3`).**
`linesCount=0, combo=0 (rompe, regla de 0013), backToBack sin cambio (=3, no es fijación con líneas), score sin cambio (no T-Spin, no hay puntos que conceder)`.
Estado final: `score=3950, combo=0, backToBack=3`.

**Ejemplo 6 — T-Spin sin líneas entre dos jugadas difíciles (partiendo de `score=3950, combo=0, backToBack=3`, continuación del ejemplo 5).**
`isTSpin=true, linesCount=0, basePoints=T_SPIN_POINTS[0]=400`. No hay incremento de combo (`linesCount=0`, regla de 0013: `combo=0`, ya lo era). `backToBack` sin cambio (`=3`, fijación sin líneas). No se calcula `comboBonus` ni `backToBackBonus` (ninguno de los dos aplica a una fijación sin líneas, por definición de `isDifficult` y de la regla de combo).
`score += 400`. Estado final: `score=4350, combo=0, backToBack=3`.

**Ejemplo 7 — T-Spin Double inmediatamente después del ejemplo 6 (la cadena de back-to-back se mantuvo a través del T-Spin sin líneas).**
Estado previo: `score=4350, combo=0, backToBack=3`.
`isTSpin=true, linesCount=2, basePoints=1200, combo→1, comboBonus=0 (combo<2, esta es la primera eliminación consecutiva tras la ruptura del ejemplo 5), isDifficult=true, backToBack→4, backToBackBonus=floor(1200*0.5)=600 (backToBack>=2)`.
`score += 1200 + 0 + 600 = 1800`. Estado final: `score=6150, combo=1, backToBack=4`. Este ejemplo confirma que `combo` y `backToBack` evolucionan de forma completamente independiente: el combo se reinició en el ejemplo 5 mientras que la cadena de back-to-back siguió intacta.

**Ejemplo 8 — hold entre jugadas (sin efecto).**
Cualquier hold ejecutado entre dos fijaciones no modifica `score`, `combo` ni `backToBack` (§12.3, `0012`): el estado previo a un hold es idéntico al estado posterior, salvo por `heldPiece`/`holdUsed`/`nextPieces` (fuera del alcance de esta tarea).

**Ejemplo 9 — hard drop que ejecuta una jugada difícil, con puntos de caída.**
Estado previo: `score=0, combo=0, backToBack=1` (ya hubo una jugada difícil previa). El jugador rota la `T` en el aire dejándola con `distance=3` hasta el suelo, y a continuación solicita hard drop en un paso posterior sin mover la pieza (de modo que, según §12.3, el hard drop tiene `distance=0` en ese momento y no invalida la candidatura). El hard drop puntúa `0 * 2 = 0` puntos de caída (distancia 0). `lockAndProcess()` clasifica: `isTSpin=true, linesCount=2, basePoints=1200, combo→1, comboBonus=0, isDifficult=true, backToBack→2, backToBackBonus=600`.
`score += 0 (caída) + 1200 + 0 + 600 = 1800`. Estado final: `score=1800, combo=1, backToBack=2`. Este ejemplo ilustra también que un hard drop con distancia real (`distance >= 1`) en el mismo paso, tras la rotación, habría invalidado `lastActionWasRotation` y el resultado habría sido, en cambio, `isTSpin=false` (jugada ordinaria de 2 líneas, `basePoints=300`).

## 19. Cambios exactos de contratos públicos

No se añade ningún tipo público exportado nuevo. `Orientation`, `PieceType`, `GameEvent`, `ActivePieceSnapshot`, `PieceShape`, `StepInput`, `EngineOptions`, `GameEngine` no cambian de forma en esta tarea. El único contrato público que cambia es `EngineSnapshot` (§21).

No se exporta `ClearKind`, `SpinType` ni ningún tipo de clasificación (§14): es un detalle de implementación interno sin consumidor público.

## 20. Cambios exactos de eventos

### 20.1 Decisión: no se añade ningún evento de dominio nuevo

`GameEvent` **no** gana ningún caso nuevo en esta tarea. `linesCleared` permanece exactamente igual que tras `0013` (`{ type: 'linesCleared'; step; lines; lineIndices }`), sin ningún campo de T-Spin ni de back-to-back añadido. No se introduce `tSpinDetected`, `clearResolved`, `scoreAwarded` ni ninguna variante equivalente.

### 20.2 Evaluación explícita de las alternativas

- **Opción A — ampliar `linesCleared`.** Rechazada: `linesCleared` describe un hecho de tablero (qué filas se eliminaron); no se emite en absoluto cuando `linesCount === 0` (T-Spin sin líneas), por lo que no puede transportar esa clasificación de forma consistente sin un caso especial. Mismo argumento ya usado por `0013` (§16.2 de esa especificación) para rechazar esta opción.
- **Opción B — añadir `tSpinDetected`.** Evaluada en detalle. Tras auditar los consumidores reales previstos por esta tarea (§25): la presentación Vue solo necesita leer `snapshot.backToBack` (igual que ya lee `snapshot.score`/`snapshot.combo`) en cada actualización de `GamePresentationState`, sin ningún desglose evento a evento de qué jugada concreta fue T-Spin. No existe en `0014` ninguna animación, ningún pulso de audio, ningún banner de «T-SPIN!» que necesite el instante exacto de detección con independencia del snapshot ya actualizado. Se descarta para esta tarea por la misma razón que `0013` descartó `scoreAwarded`: «duplicar información sin consumidor» y anticipar una necesidad de presentación (audio, animaciones) explícitamente excluida (§7).
- **Opción C — añadir `clearResolved`** (un evento unificado que sustituya o complemente a `linesCleared` con toda la clasificación de la jugada). Rechazada por el mismo motivo que B, con el coste adicional de tocar la forma de un evento ya estable y probado desde `0002`, sin necesidad demostrada.
- **Opción D — añadir `scoreAwarded`.** Rechazada exactamente por el mismo razonamiento que `0013` (§16.2 de esa especificación, opción C): ningún consumidor de `0014` necesita el desglose punto a punto de cómo se llegó al `score`/`backToBack` actuales.
- **Opción E — ningún evento nuevo** (adoptada). Es la única opción que no introduce información sin consumidor ni obliga a Vue/Phaser a recalcular o interpretar reglas de dominio. Las pruebas de motor (§27) verifican T-Spin, puntuación y back-to-back comparando `getSnapshot()` antes y después de cada `step()`, siguiendo el mismo patrón ya usado extensamente por la suite existente.

### 20.3 Revisión futura

Si una tarea posterior introduce audio, animaciones o un indicador de T-Spin/back-to-back con retroalimentación en tiempo real más fina que «leer el snapshot en cada frame», esa tarea deberá evaluar de nuevo esta decisión con un consumidor real y concreto en mano — no es una decisión permanente por principio.

## 21. Cambios exactos de snapshot

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
  score: number;
  combo: number;
  backToBack: number;                   // ← nuevo, esta tarea
}>;
```

### 21.1 Por qué a nivel superior, no dentro de `ActivePieceSnapshot`

Mismo razonamiento ya aplicado a `score`/`combo` (`0013` §15.1) y a `heldPiece` (`0012` §8.1): `backToBack` no es una propiedad de la pieza activa concreta — sobrevive a múltiples piezas activas sucesivas y no se reinicia en cada spawn. Anidarlo bajo `ActivePieceSnapshot` lo haría desaparecer artificialmente en `gameOver`.

### 21.2 `ActivePieceSnapshot` no cambia

Ningún campo nuevo se añade a `ActivePieceSnapshot`. En particular, `lastActionWasRotation` (§11) **no** se expone: es un dato de candidatura transitorio sin consumidor fuera del propio cálculo interno de `lockAndProcess()` — exponerlo violaría el mismo criterio que ya llevó a no exponer `comboBonusLastAwarded` en `0013` (§15.3 de esa especificación).

### 21.3 Alternativas evaluadas y rechazadas para campos adicionales

- **`lastClear: ClearKind`** (última clasificación de jugada, p. ej. `'tSpinDouble'`). Rechazada: ningún componente Vue previsto en esta tarea (§25) necesita mostrar la clasificación textual de la última jugada — solo el estado agregado (`backToBack`). Añadirlo ahora sería mantener un campo sin consumidor real, mismo criterio que en `0011`/`0012`/`0013`. Candidato natural para una futura tarea de audio/animaciones o de pantalla de resultados, si esa tarea demuestra un consumidor concreto.
- **`lastSpin: boolean`** (si la última fijación fue T-Spin). Rechazada por el mismo motivo: sin consumidor real en `0014`.
- **`lastScoreAward: { base: number; comboBonus: number; backToBackBonus: number }`** (desglose del último incremento). Rechazada: ningún consumidor de esta tarea necesita saber *cómo* se llegó al `score` actual, solo su valor total — mismo argumento ya usado por `0013` (§15.3 de esa especificación) para rechazar `comboBonusLastAwarded`.
- **`backToBack: number`, sin campos adicionales** (adoptada). Es el conjunto mínimo suficiente: permite mostrar el estado de la cadena en el HUD (§25) y permite que las pruebas de motor verifiquen la regla de back-to-back comparando snapshots, sin exponer ningún desglose ni clasificación textual.

## 22. Orden lógico dentro de la fijación

Integrado en `lockAndProcess()` (único punto de cálculo, §4.6), sin introducir una segunda vía. Orden exacto:

```text
1. Capturar isTSpin = (activePiece.type === 'T')
                      && lastActionWasRotation
                      && (countOccupiedCorners(board, activePiece) >= 3)
   — evaluado ANTES de escribir la pieza y ANTES de eliminar líneas (§9.4)
2. lockActivePiece()                                        — ya existente, sin cambios
   (escribe la pieza en el tablero, emite pieceLocked)
3. lineIndices = clearLines()                                — ya existente, sin cambios
4. linesCount = lineIndices.length
5. Si linesCount > 0:
   5.1. basePoints = isTSpin ? T_SPIN_POINTS[linesCount as 1|2|3]
                              : LINE_CLEAR_POINTS[linesCount as 1|2|3|4]
   5.2. combo += 1                                            — ya existente (0013), sin cambios
   5.3. comboBonus = combo >= 2 ? 50 * (combo - 1) : 0         — ya existente (0013), sin cambios
   5.4. isDifficult = (linesCount === 4) || (isTSpin && linesCount >= 1)  — NUEVO
   5.5. if (isDifficult) backToBack += 1; else backToBack = 0  — NUEVO
   5.6. backToBackBonus = (isDifficult && backToBack >= 2)
                          ? Math.floor(basePoints * 0.5) : 0    — NUEVO
   5.7. score += basePoints + comboBonus + backToBackBonus     — basePoints/backToBackBonus NUEVOS
   5.8. emit linesCleared (sin cambios de forma)                — ya existente, sin cambios
6. Si linesCount === 0:
   6.1. combo = 0                                              — ya existente (0013), sin cambios
   6.2. backToBack sin cambio                                  — NUEVO (decisión explícita, §16.4)
   6.3. Si isTSpin: score += T_SPIN_POINTS[0]                   — NUEVO
7. spawnNextPiece()                                            — ya existente, sin cambios
   (reinicia lastActionWasRotation = false para la pieza entrante, §11.2)
```

### 22.1 Invariantes que este orden garantiza

- **Una pieza solo se clasifica una vez:** `isTSpin` se calcula exactamente una vez por invocación de `lockAndProcess()`, y `lockAndProcess()` se invoca exactamente una vez por fijación (mismo argumento que `0013` §18 ya estableció para la puntuación de líneas/combo).
- **Una fijación solo puntúa una vez:** el bloque 5/6 se ejecuta una única vez por fijación, sea cual sea la vía (hard drop, límite de reinicios de lock delay, expiración del temporizador).
- **Hard drop sigue usando el mismo camino unificado:** el bloque de hard drop (`index.ts:991-1002`) invoca `lockAndProcess()` sin cambios adicionales respecto de `0013`; solo se añade el paso de invalidación de `lastActionWasRotation` cuando `distance >= 1` (§11.2), antes de la llamada.
- **Lock delay no duplica clasificación:** los reinicios de lock delay (por movimiento u rotación válidos) no invocan `lockAndProcess()`; solo la expiración del temporizador o el límite de reinicios lo hacen, cada uno con su propia invocación única.
- **`spawnBlocked` no elimina la puntuación ya concedida:** `spawnNextPiece()`/`attemptIncomingSpawn()` se invocan **después** del paso 5/6 (que ya mutó `score`/`combo`/`backToBack`); si el spawn resultante bloquea y termina en `gameOver`, esos valores ya están fijados y no se revierten (mismo criterio que `0013` §26.2).
- **T-Spin se evalúa antes de que la eliminación de líneas altere el tablero:** el paso 1 ocurre antes del paso 3 (`clearLines()`), que reescribe `board` por completo.

## 23. Interacción con SRS y wall kicks

Ninguna tabla de wall kicks (`JLSTZ_KICKS`, `I_KICKS`) cambia. `tryRotate()` no cambia su firma ni su comportamiento: sigue devolviendo `boolean`. El único cambio es que el llamador (`processStep`, bloque de rotación) ahora también actualiza `lastActionWasRotation` tras un `true` (§11.2). Ningún índice de kick se registra ni se expone (§9.3, §10). El comportamiento de la pieza `O` no cambia: como `O` nunca es `T`, `isTSpin` es siempre `false` para ella, con independencia de `lastActionWasRotation`.

## 24. Interacción con movimiento y caída

- Movimiento horizontal válido (activación de dirección, DAS, ARR): invalida `lastActionWasRotation` en cada movimiento real exitoso (§11.2), incluidos los movimientos generados por la repetición automática de ARR.
- Movimiento horizontal bloqueado: no invalida nada.
- Gravedad: cada celda realmente descendida invalida `lastActionWasRotation`; un intento bloqueado no.
- Soft drop: mismo criterio que gravedad; además sigue puntuando 1 punto/celda real (`0013`, sin cambios), de forma completamente independiente de la clasificación de T-Spin.
- Ninguna de estas interacciones cambia ningún otro comportamiento ya vigente (DAS, ARR, acumulador vertical único, reinicios de lock delay).

## 25. Interacción con hard drop

- El bloque de hard drop (`index.ts:991-1002`) invalida `lastActionWasRotation` únicamente cuando `distance >= 1`, inmediatamente después de emitir `pieceMoved{reason:'hardDrop'}` y de conceder los puntos de caída ya existentes (`0013`), y antes de invocar `lockAndProcess()`.
- Un hard drop con `distance === 0` no invalida nada: si la pieza llegó a esa posición mediante una rotación válida que la dejó ya apoyada, la candidatura se conserva y `lockAndProcess()` puede clasificarla como T-Spin (§18, ejemplo 9).
- Los puntos de caída del hard drop (`distance * 2`) y la puntuación de T-Spin/líneas/combo/back-to-back se conceden en la misma llamada a `step()`, en ese orden, exactamente igual que ya establece `0013` (§20.2 de esa especificación) para la interacción entre caída y líneas/combo.
- Un `StepInput` que combine rotación válida y hard drop en el mismo paso (orden ya vigente: rotación antes que hard drop, §4 de `0013`) puede producir un T-Spin en un único `step()`: la rotación se procesa primero y establece `lastActionWasRotation = true`; si el hard drop resultante tiene `distance === 0` (la rotación ya dejó la pieza apoyada), la candidatura se conserva hasta `lockAndProcess()`.

## 26. Interacción con lock delay

- El lock delay no introduce ningún cálculo de T-Spin o back-to-back propio: solo determina **cuándo** ocurre la fijación (sin cambios respecto de `0006`/`0013`).
- Los reinicios de lock delay por movimiento horizontal o rotación válidos siguen sin conceder ni descontar puntos (`0013` §22, sin cambios); adicionalmente, un reinicio por rotación válida establece `lastActionWasRotation = true` (§11.2), y un reinicio por movimiento horizontal válido lo invalida (§11.2) — ambos ya eran los únicos dos casos donde se reinicia el temporizador de lock delay (`groundedBefore && groundedAfter`), por lo que no se introduce ninguna interacción nueva entre el temporizador y la candidatura de rotación más allá de la ya descrita en §11.2.
- Esperar durante el lock delay sin ninguna acción (ni movimiento ni rotación) no invalida la candidatura de rotación (§12.2): una pieza rotada en un T-Spin válido, que agota varios reinicios de lock delay únicamente por transcurso de tiempo (sin nuevas acciones) antes de fijarse por expiración del temporizador, sigue siendo T-Spin en el instante de la fijación.
- El límite de reinicios de lock delay alcanzado (`lockResetsUsed >= config.maxLockResets`) sigue invocando `lockAndProcess()` exactamente igual que hoy, heredando automáticamente la clasificación de T-Spin/back-to-back unificada (§22) sin ningún cambio adicional en esa ruta.

## 27. Interacción con hold

- El hold (`0012`) nunca invoca `lockActivePiece()`/`clearLines()`: no puede, por definición, producir una fijación, y por tanto nunca es en sí mismo un T-Spin ni afecta a `backToBack` (§16.3).
- Un hold ejecutado a mitad de una candidatura de rotación (`lastActionWasRotation === true` para la pieza saliente) descarta esa candidatura por completo: la pieza entrante es una pieza nueva (§11.3), sin ninguna relación con el historial de rotación de la pieza saliente.
- `backToBack` conserva exactamente el valor que tenía inmediatamente antes del hold (§16.3, `combo` ya se comporta así desde `0013` §23): un hold ejecutado a mitad de una cadena de back-to-back no la interrumpe.
- Un hold cuya pieza entrante resulta en `spawnBlocked` no afecta a `score`, `combo` ni `backToBack` más allá de lo ya establecido por `0013` (§23 de esa especificación): es la misma situación de game over, sin ninguna fijación de por medio.

## 28. Interacción con pieza fantasma

`landingCells` (`0011`) sigue siendo un campo puramente derivado en cada `getSnapshot()`, sin relación con la puntuación, el T-Spin ni el back-to-back. La pieza fantasma no participa en la detección de T-Spin: la clasificación se evalúa únicamente en el instante real de la fijación (§9.4), usando la posición y orientación reales de `activePiece`, nunca la proyección de `landingCells`. No se requiere ningún cambio en `computeLandingCells`/`hardDropDistance`/`computeAbsoluteCells`.

## 29. Reset

`reset(options)` sigue la misma secuencia ya establecida, incorporando:

```ts
lastActionWasRotation = false;
backToBack = 0;
```

Junto a los reinicios ya existentes de `score`/`combo` (`0013`). Tras `reset()`, el snapshot debe reflejar inmediatamente `backToBack: 0`, sin necesidad de llamar a `step()`, igual que el resto de campos del snapshot ya se comportan tras un reset — con independencia del estado previo del motor (incluida una partida terminada en `gameOver` con `backToBack` distinto de cero).

## 30. Pausa y game over

### 30.1 Pausa

La pausa pertenece exclusivamente a la capa web (`0008`); el motor no la conoce y no recibe ningún `step()` mientras `isPaused === true`. `lastActionWasRotation` y `backToBack` quedan congelados junto con el resto del estado del motor mientras dura la pausa, y se siguen mostrando con su último valor conocido en el componente de presentación (§25), exactamente igual que `score`/`combo` ya se comportan durante la pausa (`0013` §26.1). No se requiere ningún cambio en `packages/game-engine` ni en la lógica de pausa ya existente relativo a esta tarea.

### 30.2 Game over

- `backToBack` **no se reinicia** al entrar en `gameOver`: conserva su último valor, mismo criterio que `score`/`combo` (`0013` §26.2).
- `backToBack` en el momento de `gameOver` refleja el estado de la cadena en el instante exacto del bloqueo de spawn: si la última fijación antes del `spawnBlocked` fue una jugada difícil, `backToBack` mantiene ese valor positivo incrementado; si fue una eliminación ordinaria, ya era `0` por la ruptura de esa misma fijación; si fue una fijación sin líneas (T-Spin o no), conserva el valor que ya tenía.
- Ningún componente de presentación necesita tratamiento especial para `gameOver`: sigue mostrando el último `backToBack` recibido por `GamePresentationState`, sin ninguna comprobación adicional de `status` (mismo principio ya aplicado a `heldPiece`/`score`/`combo` en `gameOver`).

## 31. Errores, atomicidad, determinismo e inmutabilidad

- **Atomicidad de entrada inválida:** una entrada estructuralmente inválida (`EngineStepError('INVALID_GAME_INPUT', ...)`) se lanza antes de `currentStep++`/`currentElapsedMs +=` (orden ya vigente), por lo que no muta `lastActionWasRotation`, `backToBack`, ni ningún otro estado del motor. No se emite ningún evento.
- **Motor detenido:** una llamada a `step()` con `status === 'gameOver'` lanza `EngineStepError('ENGINE_NOT_RUNNING', ...)` sin mutar `backToBack` (comportamiento ya vigente, sin cambios).
- **Determinismo:** dos motores creados con la misma semilla y configuración, sometidos a la misma secuencia exacta de `StepInput`, producen `backToBack` idéntico en cada paso comparado, por ser derivado exclusivamente de datos ya deterministas (tipo de pieza, orientación, posición, estado del tablero, número de líneas eliminadas) sin ninguna fuente adicional de aleatoriedad o de tiempo real. `lastActionWasRotation`, como estado puramente interno, también es determinista por construcción, pero no se compara directamente en las pruebas (no es observable desde el snapshot, §21.2) — su determinismo se verifica indirectamente a través de la clasificación resultante.
- **Inmutabilidad del snapshot:** `backToBack` es un valor `number` primitivo incluido directamente en el objeto congelado (`Object.freeze`) que devuelve `getSnapshot()`, sin necesidad de copia defensiva adicional (mismo patrón que `score`/`combo`/`clearedLines`). Ninguna llamada a `getSnapshot()` muta `backToBack`. Dos llamadas sucesivas a `getSnapshot()` sin `step()` intermedio devuelven el mismo valor.
- **`backToBack` no tiene la invariante «nunca decrece»:** a diferencia de `score` (`0013` §27, «la puntuación no disminuye»), `backToBack` sí puede volver a `0` (ruptura de cadena, §16.3) o, en principio, fluctuar hacia arriba y hacia abajo repetidamente a lo largo de una partida — esto es una diferencia deliberada respecto de `score`, no una inconsistencia: `backToBack` representa el estado de una cadena en curso, no una magnitud acumulada de rendimiento.

## 32. Integración con `GamePresentationState`

```ts
// apps/web/src/game/types.ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;
  score: number;
  combo: number;
  backToBack: number;                  // ← nuevo, esta tarea
}>;
```

`GameScene.notifyState()` (`GameScene.ts:528-556`) se amplía para incluir `backToBack: snap.backToBack` en la construcción de `newState`, y para comparar `this.lastState.backToBack === newState.backToBack` en la condición de no-cambio, siguiendo exactamente el mismo patrón ya usado para `score`/`combo`. Ningún otro método de `GameScene.ts` cambia.

## 33. Presentación visual

**Decisión: Opción B — mostrar `backToBack` real en el panel de puntuación ya existente (`ScorePanel.vue`), sin crear un componente nuevo.**

### 33.1 Justificación

- `backToBack` tiene el mismo perfil que `combo` (un contador entero, con un consumidor de presentación directo y evidente: mostrar el estado de la cadena actual), y `ScorePanel.vue` ya es el lugar natural para cualquier magnitud derivada de puntuación en la `.tactical-console` (precedente de `0013`).
- Crear un componente nuevo exclusivamente para un tercer número entero sería una fragmentación innecesaria (`AGENTS.md`, «no sobrearquitectura»); ampliar el componente ya existente es el cambio mínimo.
- Se descarta la Opción A (no cambiar Vue) porque `backToBack` sí tiene un consumidor de presentación real e inmediato, igual que `combo` lo tuvo en `0013` — no mostrarlo dejaría el dato calculado por el motor sin ningún uso observable para el jugador, mientras que el mecanismo (bonificación real de puntuación) ya está activo y afecta a `score`.
- Se descarta la Opción C (mostrar temporalmente la última jugada) porque exigiría un estado transitorio con temporización propia en Vue o Phaser — exactamente el tipo de «flash» o indicador temporal que §7 excluye explícitamente (frontera con animaciones).
- Se descarta la Opción D (mostrar ambos) porque ya queda cubierta por la combinación de decidir B y descartar C: no hay una «última jugada» que mostrar en esta tarea.

### 33.2 Cambio exacto

`ScorePanel.vue` gana una tercera fila, con la misma estructura que las dos ya existentes:

```html
<div class="score-panel__row">
  <span class="score-panel__label">Back-to-back</span>
  <span class="score-panel__value" data-testid="back-to-back-value">{{ backToBack >= 1 ? backToBack : '—' }}</span>
</div>
```

```ts
defineProps<{
  score: number;
  combo: number;
  backToBack: number;   // ← nuevo, esta tarea
}>();
```

- **Componente afectado:** `apps/web/src/components/ScorePanel.vue` (ya existente, no se crea ninguno nuevo).
- **Prop nueva:** `backToBack: number`, obligatoria (mismo patrón que `score`/`combo`).
- **Estado neutro:** `backToBack === 0` muestra `'—'` (em dash), idéntico criterio visual que `combo === 0` (consistencia visual entre ambos contadores).
- **Texto:** etiqueta `«Back-to-back»`, mismo estilo tipográfico que «Puntuacion»/«Combo» (misma clase `score-panel__label`).
- **`data-testid`:** `back-to-back-value` en el `<span>` del valor (mismo patrón que `score-value`/`combo-value`).
- `App.vue` propaga `gameState.backToBack` a `ScorePanel` (`:back-to-back="gameState.backToBack"` o equivalente en camelCase de prop), y su valor inicial por defecto de `gameState` (`ref<GamePresentationState>({...})`, `App.vue:11`) incluye `backToBack: 0`.

### 33.3 Restricciones respetadas

- Vue no detecta T-Spins: solo lee `backToBack` ya calculado por el motor.
- Phaser no calcula clasificación ni puntuación: `GameScene.ts` solo propaga el campo (§32), sin ninguna lógica de dominio adicional.
- No se añaden animaciones, flashes, partículas ni audio asociados al crecimiento o ruptura de la cadena.
- No se rediseña el HUD: se añade una fila más a un componente ya existente, sin tocar `.tactical-console`, `CombatStatusPanel.vue`, `OpponentMonitor.vue` ni `NextPiecesPreview.vue`.
- No se muestra ninguna información que no proceda directamente del snapshot del motor (ni clasificación de T-Spin, ni «última jugada», ver §33.1).
- Tras `reset()` o `gameOver`, el valor mostrado es siempre el último recibido por `GamePresentationState` (§30), sin ningún estado visual local contradictorio en `ScorePanel.vue`.

## 34. Pruebas unitarias y de regresión (motor)

Todas las pruebas se añaden a `packages/game-engine/src/game-engine.test.ts`, siguiendo el estilo ya establecido (bucle de `hardDrop` hasta obtener el tipo de pieza necesario, construcción de pilas mediante piezas arbitrarias y movimiento horizontal, comparación de `getSnapshot()` antes/después de cada `step()`). Como mínimo:

### 34.1 Detección de candidatura de rotación

- Una `T` fijada sin haber rotado nunca no es T-Spin (aunque tenga 3+ esquinas ocupadas por casualidad de la posición de spawn/caída).
- Una `T` rotada válidamente con menos de 3 esquinas ocupadas no es T-Spin.
- Una `T` rotada válidamente con exactamente 3 esquinas ocupadas es T-Spin.
- Una `T` rotada válidamente con 4 esquinas ocupadas también es T-Spin.
- La pared lateral cuenta como esquina ocupada (construir una pila junto a la pared donde 2 esquinas del tablero y 1 de la pila —o combinación equivalente— sumen 3).
- El suelo cuenta como esquina ocupada (T-Spin realizado en la fila más baja del tablero).
- Una rotación inválida (`tryRotate` devuelve `false`, p. ej. contra una pared sin espacio para ningún kick) no habilita candidatura de T-Spin.
- Un movimiento horizontal válido posterior a una rotación válida invalida la candidatura (la fijación resultante, aunque tenga 3+ esquinas ocupadas, no es T-Spin).
- Una caída por gravedad real (al menos una celda) posterior a una rotación válida invalida la candidatura.
- Un soft drop real posterior a una rotación válida invalida la candidatura.
- Un hard drop con `distance >= 1` posterior a una rotación válida invalida la candidatura.
- Un hard drop con `distance === 0` posterior a una rotación válida conserva la candidatura (T-Spin válido vía hard drop).
- Esperar uno o varios pasos de lock delay (sin ninguna acción) tras una rotación válida conserva la candidatura hasta la fijación por expiración del temporizador.
- Un movimiento horizontal bloqueado (contra la pared o una pila) tras una rotación válida no invalida la candidatura.
- Una rotación inválida posterior a una rotación válida no invalida la candidatura (la candidatura establecida por la rotación válida previa se mantiene).
- El hold limpia cualquier candidatura anterior: rotar la `T`, ejecutar hold, recuperarla más tarde y fijarla sin volver a rotar no debe clasificarse como T-Spin.
- El spawn limpia cualquier candidatura anterior (verificado indirectamente: la pieza recién generada nunca es T-Spin sin una rotación propia).
- El reset limpia cualquier candidatura anterior.
- Una entrada inválida (`EngineStepError`) no altera la candidatura existente (rotar válidamente, forzar una entrada inválida capturando la excepción, comprobar que una fijación inmediata posterior sin más acciones sigue siendo T-Spin).

### 34.2 Clasificación de jugadas

- T-Spin sin eliminación: `score` aumenta exactamente en `400`, `combo` pasa a `0` (o se mantiene en `0`), `backToBack` no cambia.
- T-Spin Single: `score` aumenta en `800` (+ bonificaciones de combo/back-to-back si aplican según el estado previo del test), `combo` se incrementa.
- T-Spin Double: `score` aumenta en `1200` (+ bonificaciones si aplican).
- T-Spin Triple: `score` aumenta en `1600` (+ bonificaciones si aplican). Confirmar que requiere la orientación `Right` o `Left` de la `T` (3 filas ocupadas).
- Quad ordinario (quatro líneas con una pieza no-`T`, o con `T` sin candidatura de rotación): usa `LINE_CLEAR_POINTS[4] = 800`, nunca la tabla de T-Spin.
- Single/Double/Triple ordinarios (sin T-Spin) no se clasifican como T-Spin y usan `LINE_CLEAR_POINTS`, incluso si la pieza fijada es una `T` que cumple 3+ esquinas ocupadas pero sin `lastActionWasRotation === true`.
- Ninguna pieza distinta de `T` (`I`, `O`, `S`, `Z`, `J`, `L`) es clasificada como T-Spin, con independencia de su historial de rotación o del número de esquinas ocupadas alrededor de su bounding box.

### 34.3 Puntuación

- Valores exactos para cada variante de T-Spin (`400`/`800`/`1200`/`1600`), verificados de forma aislada mediante una fijación sin combo previo ni back-to-back previo.
- No existe doble puntuación con la tabla ordinaria: una fijación T-Spin nunca suma `T_SPIN_POINTS` y `LINE_CLEAR_POINTS` a la vez.
- El combo se añade correctamente sobre una jugada T-Spin, con la misma fórmula que una jugada ordinaria.
- El back-to-back se añade correctamente: segunda jugada difícil consecutiva recibe `Math.floor(basePoints * 0.5)`.
- Los puntos de caída (soft drop/hard drop) se acumulan correctamente de forma independiente de la clasificación de T-Spin de la fijación resultante.
- T-Spin sin líneas: `score` aumenta en `400`, sin bonificación de combo ni de back-to-back, `combo` pasa a `0`, `backToBack` no cambia (verificado explícitamente con un `backToBack` previo distinto de `0`, confirmando que se conserva).
- Hard drop puntúa una sola vez (mismo criterio ya probado por `0013`, extendido para confirmar que también aplica cuando la fijación resultante es T-Spin).
- Lock delay no duplica puntos: una pieza que agota varios reinicios de lock delay antes de fijarse como T-Spin solo puntúa una vez, en el instante final.
- Game over conserva el resultado: `score`, `combo` y `backToBack` mantienen su último valor tras un `spawnBlocked` provocado inmediatamente después de una jugada T-Spin o back-to-back.
- Reset restaura `backToBack` a `0` (y `lastActionWasRotation` indirectamente, verificado por la ausencia de T-Spin en la primera fijación tras el reset incluso si se rota antes del reset).

### 34.4 Back-to-back

- Estado inicial: `backToBack === 0` en una partida recién creada.
- Primera jugada difícil (Quad o T-Spin con líneas) inicia la cadena en `1`, sin bonificación.
- Segunda jugada difícil consecutiva incrementa a `2` y aplica la bonificación (`Math.floor(basePoints * 0.5)`).
- Tercera jugada difícil consecutiva mantiene la cadena en `3`, con bonificación.
- Un Quad seguido de un T-Spin (con líneas) mantiene la cadena (ambos cuentan como «difícil», con independencia del tipo concreto).
- Un T-Spin (con líneas) seguido de un Quad mantiene la cadena, en el orden inverso.
- Una eliminación ordinaria rompe la cadena (`backToBack` vuelve a `0`), sin recibir ninguna bonificación ella misma.
- Una fijación sin líneas (no T-Spin) conserva la cadena sin modificarla.
- Un T-Spin sin líneas conserva la cadena sin modificarla (verificado explícitamente entre dos jugadas difíciles, confirmando que la cadena sigue intacta después).
- El hold no rompe la cadena por sí mismo (ejecutar hold entre dos jugadas difíciles no afecta al valor de `backToBack`).
- El reset la elimina (`backToBack` vuelve a `0` con independencia de su valor previo).
- Game over conserva el estado final de `backToBack` (mismo criterio que `score`/`combo`).

### 34.5 Regresiones

- SRS: las pruebas ya existentes de rotación, transiciones y wall kicks (`0003`) siguen pasando sin modificación de intención.
- Wall kicks: ninguna tabla cambia; las pruebas de kick lateral y kick de suelo siguen pasando.
- Hard drop, soft drop, lock delay: comportamiento y pruebas ya existentes (`0002`, `0005`, `0006`) no cambian de intención.
- Puntuación ordinaria y combo: todas las pruebas ya existentes de `0013` (tabla `100/300/500/800`, fórmula de combo) siguen pasando sin modificación de intención — esta tarea no cambia ninguna regla ya fijada por `0013` para jugadas no-T-Spin.
- Hold, pieza fantasma, cola de próximas piezas: comportamiento ya existente (`0011`, `0012`) no cambia.
- Spawn blocked, reset: comportamiento ya existente no cambia, ampliado únicamente para cubrir `backToBack`/`lastActionWasRotation` (§29, §30.2).
- Orden de eventos: `linesCleared`/`pieceLocked`/`pieceSpawned`/`gameOver` mantienen exactamente el mismo orden relativo ya probado.
- Determinismo entre dos motores: extender la prueba de determinismo ya existente (`seed` idéntica, misma secuencia de `StepInput`) para comparar también `backToBack` en cada paso.
- Snapshot profundamente inmutable: extender la prueba ya existente de inmutabilidad para cubrir `backToBack`.

## 35. Pruebas web

- `apps/web/src/components/ScorePanel.test.ts`: pruebas nuevas para la fila de back-to-back — `backToBack = 0` muestra `'—'`; `backToBack >= 1` muestra el valor numérico; el `data-testid="back-to-back-value"` existe y es localizable.
- `apps/web/src/game/types.test.ts`: literales de `GamePresentationState` actualizados para incluir `backToBack`.
- `apps/web/src/App.test.ts`: literales actualizados (valor inicial de `gameState` con `backToBack: 0`); prueba de que `ScorePanel` recibe `backToBack` desde `App` (mismo patrón que la prueba ya existente para `score`/`combo`, `0013`).

## 36. E2E

No se fuerza ninguna secuencia de teclado larga o frágil para construir un T-Spin real en Playwright (`0010`, criterio ya establecido). Ampliación mínima justificada de `apps/web/e2e/essential-flow.spec.ts`: comprobar únicamente que, en el estado inicial de la aplicación, el HUD muestra el estado neutro de back-to-back (`back-to-back-value` visible con contenido `'—'`), siguiendo el mismo patrón ya usado para `combo-value`. La aritmética de puntuación, la clasificación de T-Spin y las reglas de back-to-back se prueban exclusivamente en Vitest dentro del motor (§34).

## 37. Archivos previsiblemente afectados

- `packages/game-engine/src/index.ts` — estado interno nuevo, detección de T-Spin, tabla de puntos, lógica de back-to-back, cambios en `EngineSnapshot`/`reset()`/`lockAndProcess()`/`tryMoveHorizontal()`/`processVertical()`/bloque de rotación/bloque de hard drop/funciones de spawn.
- `packages/game-engine/src/game-engine.test.ts` — pruebas nuevas (§34).
- `apps/web/src/game/types.ts` — `GamePresentationState` con `backToBack`.
- `apps/web/src/game/types.test.ts` — literales actualizados.
- `apps/web/src/game/scenes/GameScene.ts` — `notifyState()` propaga `backToBack`.
- `apps/web/src/components/ScorePanel.vue` — nueva fila de back-to-back.
- `apps/web/src/components/ScorePanel.test.ts` — pruebas nuevas (§35).
- `apps/web/src/App.vue` — prop nueva hacia `ScorePanel`, valor inicial de `gameState`.
- `apps/web/src/App.test.ts` — literales y prueba de propagación actualizados.
- `apps/web/e2e/essential-flow.spec.ts` — verificación mínima del estado neutro de back-to-back (§36).
- `docs/implementation/0014-t-spins-back-to-back.md` — informe de implementación (creado al completar la tarea, no ahora).
- `docs/project-status.md` — actualizado al completar la tarea, no ahora.

No se incluye `packages/game-config`: ningún valor de esta tarea se convierte en configuración (§15.1, mismo criterio que `0013` §8.3).

## 38. Criterios de aceptación

- El motor clasifica correctamente como T-Spin toda fijación de `T` cuya última acción relevante fue una rotación válida y cuyo centro de rotación tiene 3 o 4 esquinas ocupadas, según la regla exacta de §9.
- Ninguna fijación de una pieza distinta de `T`, ni ninguna fijación de `T` sin candidatura de rotación vigente, se clasifica como T-Spin.
- La tabla de puntos de T-Spin (§15) y la fórmula de back-to-back (§17) están implementadas exactamente como se especifica, sin valores ni redondeos distintos.
- `EngineSnapshot`/`GamePresentationState` exponen `backToBack: number`, sin ningún campo adicional no previsto (`lastClear`, `lastSpin`, índice de kick, etc.).
- No se añade ningún evento de dominio nuevo.
- El combo (`0013`) no cambia de comportamiento para ninguna jugada no-T-Spin.
- `ScorePanel.vue` muestra `backToBack` real, sin recalcular ninguna regla de dominio.
- Todas las pruebas mínimas de §34/§35/§36 están implementadas y pasan.
- No queda ninguna ampliación de alcance no justificada respecto de §6/§7 (en particular: ninguna traza de T-Spin Mini, energía, sabotajes, bot, batalla, audio, animaciones).

## 39. Puertas de calidad

Antes de declarar la tarea completada, ejecutar desde la raíz y confirmar que todas finalizan correctamente:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test:e2e`

Además, validar el arranque real de `apps/web` con `pnpm dev` (`AGENTS.md`, «Aplicaciones ejecutables»), comprobando que carga sin errores de consola, jugando manualmente lo suficiente para observar `backToBack` cambiar en el HUD, y deteniendo el servidor al finalizar.

## 40. Informe de implementación obligatorio

Al completar la tarea, crear `docs/implementation/0014-t-spins-back-to-back.md` con, como mínimo:

- resumen de lo implementado;
- archivos creados y modificados;
- contrato público final (`EngineSnapshot.backToBack`, `GamePresentationState.backToBack`), y cualquier desviación de nombre o forma respecto de esta especificación, justificada;
- reglas de detección finales (nombres internos reales de constantes y funciones, si difieren de los orientativos de esta especificación);
- tabla de puntuación de T-Spin final;
- reglas de back-to-back finales, incluida la fórmula de bonificación;
- confirmación de que el combo (`0013`) no cambió de comportamiento;
- confirmación explícita de que no se añadió ningún evento de dominio nuevo, y por qué;
- integración Vue (cambios en `ScorePanel.vue`, `App.vue`);
- pruebas añadidas (motor y web), y por qué;
- número final de tests Vitest y E2E;
- comandos ejecutados y resultados;
- desviaciones respecto de esta especificación, si las hubo, y su justificación;
- deuda técnica identificada (por ejemplo, T-Spin Mini como candidato futuro si se demuestra un consumidor real, o la necesidad futura de mover las tablas de puntuación a `packages/game-config` si se introducen perfiles de batalla reales);
- validación manual pendiente de confirmación por el usuario, si la hubiera;
- confirmación explícita de la ausencia de las mecánicas excluidas (§7): T-Spin Mini, energía, sabotajes, bot, batalla, backend, persistencia, audio, animaciones;
- confirmación explícita de que no se hicieron commits durante la implementación.

Y actualizar [docs/project-status.md](../project-status.md): estado de `0014` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y propuesta de siguiente tarea. Esta especificación no crea esos documentos ahora.

## 41. Restricciones para el agente implementador

- No modificar ninguna especificación existente de `docs/tasks/`, incluida esta.
- No usar scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline para modificar archivos ni para depurar el motor (`AGENTS.md`).
- No introducir dependencias nuevas en ningún paquete.
- No modificar `packages/game-config` salvo necesidad real demostrada y documentada (no se anticipa ninguna en esta tarea).
- No crear una clase, servicio, interfaz o paquete específico para T-Spin/back-to-back: la lógica se integra como funciones y estado adicional dentro de `packages/game-engine/src/index.ts`, siguiendo el estilo ya existente.
- No añadir ningún evento de dominio nuevo (§20); si durante la implementación surge la tentación de añadir uno, detenerse y preguntar antes de hacerlo.
- No implementar T-Spin Mini en ninguna variante (§10).
- No añadir `lastClear`, `lastSpin`, índice de wall kick usado, ni ningún otro campo de clasificación sin consumidor real (§21.3).
- No implementar energía de combate, sabotajes, bot, batalla, backend, ranking, persistencia ni pantalla de resultados.
- No añadir animaciones, partículas, flashes ni audio asociados al T-Spin o al back-to-back.
- No modificar la regla de combo ya fijada por `0013` para ninguna jugada no-T-Spin.
- Detenerse y preguntar si, durante la implementación, se detecta una decisión funcional no cubierta explícitamente por esta especificación (`AGENTS.md`, «Procedimiento de trabajo»).
- No hacer commits salvo instrucción explícita del usuario.
- Ejecutar las cinco validaciones (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`) y validar el arranque real con `pnpm dev` antes de declarar la tarea completada, deteniendo el servidor al finalizar.

## 42. Definición de terminado

La tarea `0014` se considera terminada cuando:

- el contrato público descrito en §21/§32 está implementado exactamente como se especifica, sin campos adicionales no previstos ni eventos nuevos;
- todas las reglas de §9 a §31 están implementadas y verificadas por las pruebas mínimas de §34/§35/§36;
- la presentación Vue (§33) muestra correctamente `backToBack` real sin duplicar la lógica del motor;
- las puertas de calidad de §39 finalizan correctamente;
- se ha creado el informe de implementación (§40) y actualizado `docs/project-status.md`;
- no queda ninguna ampliación de alcance no justificada respecto de §6/§7;
- no se ha hecho ningún commit no solicitado explícitamente por el usuario.

## 43. Siguiente tarea

No se fija una `0015` definitiva. Esta especificación no prejuzga cuál será. Candidatas razonables, a decidir tras validar manualmente T-Spins y back-to-back y revisar `docs/rautfall.md` frente al estado real del proyecto: la energía de combate (que presupone la puntuación y las jugadas difíciles aquí definidas, `docs/rautfall.md` §680–695), o el primer sabotaje real (que a su vez presupone la energía). No se fija ninguna de estas como definitiva.
