# 0006 — Lock delay y fijación diferida

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0006 — Lock delay y fijación diferida
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0006`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0006-lock-delay-fijacion-diferida.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0006-lock-delay-fijacion-diferida.md) (ver §24), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Sustituir la fijación inmediata de la pieza activa (al fallar un descenso por gravedad o por soft drop) por un **retardo de fijación (`lock delay`) con reinicio limitado por movimiento**, usando exclusivamente los parámetros de configuración `lockDelayMs` y `maxLockResets` que ya existen en `packages/game-config` desde `0001`/`0002` sin uso real hasta ahora.

Al terminar la tarea:

- una pieza que no puede descender ya no se fija en el mismo paso: pasa a estado **apoyado** (`grounded`) y comienza a acumular tiempo lógico hacia `config.lockDelayMs`;
- un movimiento horizontal válido o una rotación válida, ejecutados mientras la pieza está apoyada y que la dejan apoyada, reinician el temporizador y consumen uno de los `config.maxLockResets` reinicios disponibles para esa pieza;
- al alcanzar `config.lockDelayMs` de tiempo acumulado apoyado, o al consumir el reinicio número `config.maxLockResets`, la pieza se fija inmediatamente;
- el hard drop conserva su fijación inmediata incondicional, sin relación alguna con el lock delay;
- el snapshot de la pieza activa expone `grounded`, `lockDelayElapsedMs` y `lockResetsUsed` como información de solo lectura.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo              ✅ Completada
0002 — Motor de juego determinista      ✅ Completada
0003 — Rotación SRS                     ✅ Completada
0004 — Integración de Phaser            ✅ Completada
0005 — DAS, ARR y soft drop             ✅ Completada
0006 — Lock delay y fijación diferida   ← Esta tarea
```

Esta tarea no incluye: pieza fantasma, hold, vista de tres próximas piezas, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, batalla, bot, pausa, audio, layout Tactical o Industrial Dramatic definitivo, backend, Pinia, Router, Playwright, nuevos diagnósticos visuales, ni cambios de code splitting o del aviso de tamaño de chunk de Phaser. Ver §6 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — sección «Decisión funcional: fijación de piezas» (retardo de fijación de 500 ms, reinicio por movimiento, máximo 15 reinicios, caída instantánea fija inmediatamente, acción inválida no reinicia) y sección «16. `Lock delay`» de la primera iteración técnica del prototipo. Ambas secciones ya describen la intención de producto; esta tarea es su primera implementación real en el motor.
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) — fijación inmediata original (§18), que esta tarea sustituye para gravedad y soft drop, y conserva sin cambios para hard drop.
- [docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md) — algoritmo de rotación y wall kicks, que esta tarea no modifica, solo envuelve con la lógica de reinicio de lock delay.
- [docs/tasks/0005-das-arr-soft-drop.md](0005-das-arr-soft-drop.md) — contrato `StepInput` actual, prioridad horizontal, DAS/ARR, acumulador vertical único (`verticalProgress`) y orden del paso lógico vigente, que esta tarea amplía sin reescribir.
- `packages/game-engine/src/index.ts` — implementación real tras `0005` (ver §4). Se amplía, no se reescribe desde cero.
- `packages/game-engine/src/game-engine.test.ts` — 145 pruebas existentes agrupadas en `describe` (PRNG, spawn, movimiento horizontal, gravedad, hard drop, fijación, líneas, game over, eventos, snapshot, determinismo, reset, validación, prioridad horizontal, DAS, ARR, soft drop, acumulador vertical, interacciones, rotación SRS con sus subgrupos, eventos DAS/ARR/soft drop). Ninguna de estas pruebas debe romperse por esta tarea salvo que dependa explícitamente del comportamiento de fijación inmediata por gravedad o soft drop que esta tarea sustituye (ver §17).
- `packages/game-config/src/index.ts` — `GameConfig`, `prototypeConfig` y `parseGameConfig` reales: `lockDelayMs: Type.Number({ minimum: 0 })`, `maxLockResets: Type.Integer({ minimum: 1 })`, y la regla relacional ya vigente `lockDelayMs % fixedStepMs === 0`. Estos contratos y valores (`lockDelayMs: 500`, `maxLockResets: 15`) ya existen y ya son válidos; **no se modifican en esta tarea**.
- `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/input-debug.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/coordinates.ts` — integración Phaser real tras `0005`. Ninguno de estos archivos referencia `activePiece` mediante un tipo propio duplicado: consumen `EngineSnapshot`/`ActivePieceSnapshot` tal como los exporta `@rautfall/game-engine`, por lo que la ampliación estructural de §15 no debería requerir cambios en `apps/web` (ver §20).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto.

## 4. Contratos públicos reales disponibles (inspección previa a esta tarea)

Confirmado por lectura directa de `packages/game-engine/src/index.ts` tras `0005`.

### 4.1 `StepInput`, `GameEvent`, `ActivePieceSnapshot` (sin cambios de forma en esta tarea salvo §15)

```ts
type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};

type MoveReason = 'horizontal' | 'gravity' | 'hardDrop' | 'softDrop';

type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | { type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation };

type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;
```

Esta tarea **no** amplía `StepInput`, **no** amplía `GameEvent` ni `MoveReason`, y **no** añade ningún código de error nuevo. La única ampliación de contrato es `ActivePieceSnapshot` (§15).

### 4.2 Comportamiento actual sustituido (confirmado por lectura de `processVertical` en el código real)

```text
function processVertical(input):
  activeCellsPerSecond = softDropHeld ? softDropCellsPerSecond : gravityCellsPerSecond
  verticalProgress += fixedStepMs * activeCellsPerSecond
  while verticalProgress >= 1000:
    intentar descender una celda
    si tiene éxito: verticalProgress -= 1000; emitir pieceMoved
    si falla (colisión): lockActivePiece(); clearLines(); spawnNextPiece(); break
```

Esta tarea sustituye exactamente la rama `si falla` de este bucle (ver §13). El resto del motor (movimiento horizontal, DAS/ARR, prioridad horizontal, rotación SRS, hard drop, PRNG, bolsa, tablero, líneas, snapshot, eventos) permanece sin cambios de comportamiento, salvo los puntos de integración explícitos descritos en §9, §10 y §11.

### 4.3 `GameConfig` (sin cambios)

```ts
type GameConfig = {
  version: string;
  fixedStepMs: number;
  dasMs: number;
  arrMs: number;
  gravityCellsPerSecond: number;
  softDropCellsPerSecond: number;
  lockDelayMs: number;
  maxLockResets: number;
};

const prototypeConfig: GameConfig = {
  version: 'prototype-0001',
  fixedStepMs: 10,
  dasMs: 150,
  arrMs: 50,
  gravityCellsPerSecond: 1,
  softDropCellsPerSecond: 20,
  lockDelayMs: 500,   // = 50 pasos de fixedStepMs
  maxLockResets: 15,
};
```

`parseGameConfig` ya exige `lockDelayMs % fixedStepMs === 0` y `maxLockResets >= 1` (enteros). `prototypeConfig` ya cumple ambas reglas. **`packages/game-config` no se modifica en esta tarea**: ni el esquema, ni `prototypeConfig`, ni las reglas relacionales, ni ninguna propiedad nueva (ver §19).

## 5. Alcance incluido

- Concepto de apoyo (`grounded`) derivado, sin almacenamiento redundante, evaluado mediante colisión contra la posición un paso más abajo de la pieza activa (§7).
- Temporizador de lock delay (`lockDelayElapsedMs`) que avanza `config.fixedStepMs` en cada paso lógico en el que la pieza termina apoyada, con el primer paso apoyado ya contabilizado (§8).
- Reinicio del temporizador y consumo de un reinicio (`lockResetsUsed`) por cada movimiento horizontal válido o rotación válida que parte de apoyado y termina apoyado (§9).
- Puesta a cero del temporizador, sin consumir reinicio, cuando un movimiento horizontal válido o una rotación válida parte de apoyado y deja la pieza en el aire (§10).
- Fijación inmediata al consumir el reinicio número `config.maxLockResets`, en el mismo paso lógico y sin conceder un nuevo periodo de `lockDelayMs` (§11).
- Fijación inmediata al alcanzar `lockDelayElapsedMs >= config.lockDelayMs` (§8, §14).
- Conservación de la fijación inmediata incondicional del hard drop, sin ninguna interacción con lock delay ni reinicios (§12).
- Revisión del procesamiento vertical (gravedad y soft drop): un descenso bloqueado ya no fija la pieza; consume la unidad de progreso de 1000 y no emite evento (§13).
- Orden del paso lógico ampliado con detección final de apoyo, aplicación de reinicios y avance/expiración del temporizador, manteniendo sin reordenar el resto del orden ya consolidado en `0002`/`0003`/`0005` (§14).
- Ampliación de `ActivePieceSnapshot` con `grounded`, `lockDelayElapsedMs` y `lockResetsUsed`, de solo lectura (§15).
- Reinicio de `lockDelayElapsedMs` y `lockResetsUsed` a `0` en la creación inicial, en cada spawn tras fijación y en `reset()` (§17).
- Pruebas del motor (TDD pragmático) que cubren temporizador, movimiento horizontal, rotación, límite de reinicios, procesamiento vertical, salida y reentrada en contacto, determinismo, reset e integración (§22).

## 6. Alcance explícitamente excluido

No pertenece a `0006`:

- Pieza fantasma (`ghost piece`).
- Hold / reserva de pieza.
- Vista de tres próximas piezas (más allá del dato técnico `nextPiece` ya existente).
- Puntuación.
- Combos.
- T-Spins y `back-to-back`.
- Energía de combate y sabotajes.
- Batalla y bot.
- Pausa.
- Audio.
- Layout Tactical, Duel o Industrial Dramatic definitivo.
- Backend, persistencia, autenticación, ranking, historial.
- Pinia.
- Vue Router.
- Playwright.
- Nuevos diagnósticos visuales del lock delay: no se implementa todavía ningún indicador visual (barra, parpadeo, contorno, animación) del apoyo o del progreso del temporizador. La única exposición de esta información en esta tarea es el snapshot público (§15), consumible por una tarea visual futura.
- HUD Tactical, barras, efectos, audio o animaciones específicas de sabotajes.
- Cambios de code splitting o cualquier reestructuración de build orientada a reducir el tamaño de chunk.
- Subida artificial del límite de aviso de tamaño de chunk de Vite/Rollup. El aviso de chunk superior a 500 kB (atribuible principalmente a Phaser, documentado como deuda técnica en `0004`/`0005`) permanece sin resolver en esta tarea.
- Nuevas propiedades de configuración: `lockDelayMs` y `maxLockResets` ya existen y ya son válidos con los valores actuales de `prototypeConfig`; la expectativa de esta tarea es no añadir ninguna propiedad nueva a `GameConfig` (ver §19).
- Nuevos eventos públicos (`pieceGrounded`, `lockDelayStarted`, `lockDelayReset`, `lockDelayExpired` u otros): el motor sigue comunicando la fijación exclusivamente mediante `pieceLocked` (ver §16).
- Nuevos códigos de error públicos (ver §18).
- Dependencias nuevas, salvo necesidad técnica imprescindible y justificada (no se anticipa ninguna: no se añade nada al `package.json` de ningún paquete en esta tarea).
- Refactors generales ajenos a esta tarea (no se reescriben rotación SRS, DAS/ARR, prioridad horizontal, tablas de wall kicks, geometría de piezas ni el renderizado de `GameScene.ts`).
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §5.

## 7. Concepto de apoyo (`grounded`)

Una pieza activa está **apoyada** cuando, en su posición y orientación actuales, desplazar su origen una fila hacia abajo (`y + 1`) produciría una colisión (contra el fondo del tablero interno, contra un bloque fijo, o ambos).

```text
function isGrounded(activePiece, board):
  if activePiece === null: return false
  candidateCells = computeAbsoluteCells(activePiece.type, activePiece.x, activePiece.y + 1, activePiece.orientation)
  return isCollision(board, candidateCells)
```

Reglas:

- `isGrounded` es una función pura derivada del tablero y de la posición/orientación actuales de la pieza activa. No introduce ningún nuevo campo de estado interno persistente: se evalúa cada vez que se necesita (antes y después de cada acción relevante, y al final de cada paso), reutilizando `isCollision` y `computeAbsoluteCells` ya existentes.
- El motor no mantiene una variable `grounded` separada que pueda desincronizarse de la posición real; el campo `grounded` del snapshot (§15) se deriva con la misma función en el momento de construir el snapshot.
- Una pieza recién generada (spawn) puede estar apoyada desde su primer instante si su posición inicial ya no admite descenso (tablero casi lleno); esto es una situación legítima, no un error, y ese primer paso ya inicia el lock delay con normalidad (§8).

## 8. Temporizador de lock delay

El motor mantiene, asociado a la pieza activa actual, un acumulador `lockDelayElapsedMs` (inicialmente `0`, expuesto en el snapshot, ver §15).

### 8.1 Avance

Al final de cada paso lógico (tras procesar movimiento horizontal, rotación, hard drop y procesamiento vertical; ver §14 para la posición exacta), el motor determina el apoyo final del paso mediante `isGrounded` (§7) y aplica:

```text
groundedAtEndOfStep = isGrounded(activePiece, board)

if groundedAtEndOfStep:
    lockDelayElapsedMs += fixedStepMs
    if lockDelayElapsedMs >= config.lockDelayMs:
        fijar la pieza inmediatamente (misma secuencia de §14, paso 9)
else:
    lockDelayElapsedMs = 0
```

Esta comprobación solo se ejecuta si sigue existiendo una pieza activa al llegar a este punto del paso (no se ejecuta si el paso ya fijó y generó una nueva pieza, o produjo game over, en una fase anterior del mismo paso; ver §14).

### 8.2 Semántica exacta

- **El primer paso en el que la pieza termina apoyada ya cuenta `fixedStepMs`.** No existe un paso de "inicio" que solo marque el apoyo sin avanzar el temporizador: la primera vez que `groundedAtEndOfStep` es `true` para una posición dada, `lockDelayElapsedMs` pasa de `0` a `fixedStepMs` en ese mismo paso.
- Esta misma regla se aplica igualmente cuando el temporizador se reinicia a `0` dentro de un paso a causa de un reinicio por movimiento u rotación (§9): si, tras ese reinicio, la detección final del mismo paso (§8.1) determina que la pieza sigue apoyada, el temporizador avanza igualmente `fixedStepMs` en ese mismo paso. El paso en el que ocurre un reinicio cuenta como el primer paso apoyado del nuevo periodo; no es una excepción a la regla anterior.
- La condición de fijación por expiración es `lockDelayElapsedMs >= config.lockDelayMs` (umbral exacto, no una comparación ambigua de "superar").
- Como `config.lockDelayMs` es siempre múltiplo exacto de `config.fixedStepMs` (regla relacional ya vigente en `parseGameConfig`, §4.3) y el temporizador solo avanza en incrementos de `fixedStepMs` desde `0`, `lockDelayElapsedMs` alcanza el umbral exactamente, sin sobrepasarlo, en el paso de fijación.
- Todo el temporizador usa exclusivamente tiempo lógico (`fixedStepMs` acumulado). No se usan temporizadores reales, `Date.now()` ni `performance.now()`.
- `lockDelayElapsedMs` nunca es negativo: solo se incrementa desde `0` en pasos de `fixedStepMs`, o se pone a `0` explícitamente; no existe ninguna operación de resta sobre este acumulador.
- `lockDelayElapsedMs` nunca puede quedar, de forma persistente, por encima de `config.lockDelayMs`: en el paso en que lo alcanza o lo supera, la pieza se fija inmediatamente y la variable deja de existir para esa pieza (la siguiente pieza activa empieza en `0`, ver §17).

## 9. Reinicio del lock delay por movimiento horizontal o rotación

Solo dos tipos de acción pueden reiniciar el temporizador y consumir un reinicio: un movimiento horizontal real (por activación inmediata, por alcanzar `dasMs`, o por cada repetición de `arrMs`, ver `0005` §9-§11) y una rotación real (horaria o antihoraria, con o sin *wall kick*, ver `0003` §11). Ninguna otra acción participa en este mecanismo.

### 9.1 Regla de consumo

Para cada movimiento horizontal individual que se ejecuta realmente (`tryMoveHorizontal` devuelve éxito) y para cada rotación individual que se ejecuta realmente (`tryRotate` devuelve éxito), el motor evalúa:

```text
groundedBefore = isGrounded(activePiece, board)   // evaluado antes de aplicar la acción
// … se aplica la acción (desplazamiento de x, o desplazamiento de x/y y cambio de orientation) …
groundedAfter = isGrounded(activePiece, board)    // evaluado después de aplicar la acción

if groundedBefore && groundedAfter:
    lockDelayElapsedMs = 0
    lockResetsUsed += 1
    if lockResetsUsed >= config.maxLockResets:
        fijar la pieza inmediatamente, en su nueva posición, en este mismo paso (ver §11)
else if groundedBefore && !groundedAfter:
    lockDelayElapsedMs = 0   // sin consumir reinicio (ver §10)
// si !groundedBefore: ninguna interacción con lock delay (lockDelayElapsedMs ya es 0; ver invariante de §8)
```

- Esta evaluación se realiza **por cada acción individual**, no una sola vez por fase del paso. Si el movimiento horizontal produce varias celdas de desplazamiento real en un mismo paso lógico (activación seguida de una o más repeticiones de `arrMs`, según `0005` §10), cada celda de desplazamiento real se evalúa de forma independiente con su propio `groundedBefore`/`groundedAfter`, en el orden real en que ocurre.
- Un movimiento horizontal bloqueado (colisión) o una rotación fallida (ningún *wall kick* válido) no ejecutan esta evaluación en absoluto: no reinician el temporizador, no consumen reinicio y no alteran `lockDelayElapsedMs` ni `lockResetsUsed`. Esto es así incluso si la pieza estaba apoyada antes del intento.
- Soft drop y gravedad nunca invocan esta evaluación: nunca reinician el temporizador ni consumen reinicios, tengan éxito o no (ver §13).
- Hard drop nunca invoca esta evaluación (ver §12).
- Si un movimiento horizontal o una rotación consume el reinicio número `config.maxLockResets` y provoca fijación inmediata (rama `if lockResetsUsed >= config.maxLockResets`), el resto del procesamiento de ese paso lógico se detiene de inmediato (ver §11 y §14): ninguna repetición de `arrMs` adicional dentro de la misma fase de movimiento horizontal, ninguna rotación, ningún hard drop ni procesamiento vertical se ejecuta sobre la nueva pieza dentro de ese mismo `step()`.

### 9.2 Semántica con varios desplazamientos en el mismo paso

Cuando DAS/ARR producen más de un desplazamiento horizontal real en un único paso lógico (posible según `0005` §10.1 cuando `fixedStepMs` es grande respecto de `arrMs`), cada desplazamiento se trata como una acción de reinicio independiente:

- si la pieza está apoyada antes y después de cada desplazamiento individual, cada uno de esos desplazamientos consume un reinicio distinto, en el orden real en que ocurren;
- si el reinicio número `config.maxLockResets` se consume a mitad de esa secuencia de repeticiones, las repeticiones restantes de ese mismo paso no se ejecutan (la pieza ya se fijó y una nueva pieza, si existe, no recibe más entrada en ese `step()`, ver §9.1 y §14);
- esta regla evita cualquier ambigüedad sobre "cuántos reinicios consume un paso con varias repeticiones": consume exactamente uno por cada desplazamiento real que cumple `groundedBefore && groundedAfter`, ni más ni menos.

## 10. Salida del contacto sin reinicio

Cuando un movimiento horizontal real o una rotación real parte de una pieza apoyada (`groundedBefore === true`) y la deja en el aire (`groundedAfter === false`):

- la acción se aplica con normalidad (la posición/orientación resultante es la real, no se cancela ni se revierte);
- `lockDelayElapsedMs` se pone a `0`;
- **no** se consume ningún reinicio (`lockResetsUsed` no cambia);
- `lockResetsUsed` se conserva íntegramente para el resto de la vida de esa pieza activa.

Si la pieza vuelve a apoyarse más adelante (en el mismo paso, tras el procesamiento vertical, o en un paso posterior), el temporizador comienza un periodo completamente nuevo desde `0`, con la misma semántica de "primer paso apoyado ya cuenta `fixedStepMs`" (§8.2), y `lockResetsUsed` sigue disponible con su valor ya consumido previamente (no se reinicia por salir y volver a entrar en contacto: solo se reinicia al aparecer una nueva pieza, en la creación del motor, o en `reset()`, ver §17).

## 11. Límite de reinicios y fijación inmediata

`config.maxLockResets` limita el número total de reinicios que una misma pieza activa puede consumir durante toda su vida (no por periodo de apoyo: los reinicios consumidos en periodos de apoyo anteriores, dentro de la vida de la misma pieza, cuentan hacia el mismo total acumulado, coherente con la regla de `docs/rautfall.md` de que "el contador de reinicios se conserva durante toda la vida de la pieza").

Cuando un movimiento horizontal real o una rotación real cumple `groundedBefore && groundedAfter` (§9.1) y ese reinicio hace que `lockResetsUsed` alcance `config.maxLockResets`:

1. la acción ya se ha aplicado (la pieza ya está en su nueva posición u orientación: no se cancela ni se revierte);
2. `lockDelayElapsedMs` se pone a `0` como cualquier otro reinicio (paso intermedio, sin efecto observable porque el siguiente paso es la fijación);
3. la pieza se fija inmediatamente, en esa misma posición, dentro del mismo paso lógico, mediante la misma secuencia de fijación de §14 (paso 9): escribir las celdas en el tablero, emitir `pieceLocked`, eliminar líneas completas y emitir `linesCleared` si procede, generar la siguiente pieza (`pieceSpawned`) o terminar la partida (`gameOver`) si el spawn está bloqueado;
4. la pieza **no** recibe un nuevo periodo completo de `lockDelayMs`: no se espera a que expire el temporizador, la fijación es inmediata en esa misma acción;
5. ningún procesamiento posterior de ese `step()` afecta a la pieza que se fija: si la fijación ocurre durante la fase de movimiento horizontal (§14, paso 5), no se procesan más repeticiones de `arrMs` de ese paso, ni la rotación, ni el hard drop, ni el procesamiento vertical de ese mismo `step()`; si ocurre durante la fase de rotación (§14, paso 6), no se procesan el hard drop ni el procesamiento vertical de ese mismo `step()`. La nueva pieza (si el spawn tuvo éxito) no recibe entrada adicional dentro de ese mismo `step()`, coherente con la regla ya vigente desde `0005` §13 para hard drop y fijación por gravedad/soft drop;
6. tras esta fijación, `lockResetsUsed` no puede seguir incrementándose para esa pieza porque la pieza ya no existe; la siguiente pieza activa empieza con `lockResetsUsed = 0` (§17).

No existe ningún camino en el motor por el que `lockResetsUsed` pueda superar `config.maxLockResets`: el propio reinicio que lo alcanzaría dispara la fijación en la misma operación, antes de que pueda intentarse un reinicio número `config.maxLockResets + 1`.

## 12. Hard drop

El hard drop conserva exactamente su comportamiento actual (`0002` §14, sin cambios): calcula la distancia hasta la posición legal más baja, la aplica en una sola operación, emite un único `pieceMoved` con motivo `'hardDrop'` si la distancia es `>= 1`, y fija la pieza inmediatamente en la misma secuencia de §14 (paso 9), con `return` al terminar de procesar fijación/líneas/spawn/game over.

Reglas explícitas de no interacción:

- el hard drop nunca comprueba `isGrounded`, nunca lee ni escribe `lockDelayElapsedMs` ni `lockResetsUsed` de la pieza que fija, y nunca invoca la evaluación de reinicio de §9;
- el hard drop domina completamente sobre el procesamiento vertical y sobre el temporizador de lock delay del mismo paso, exactamente como ya domina sobre la gravedad y el soft drop (`0002`/`0005`);
- el hard drop fija la pieza sin importar el valor que tuviera `lockDelayElapsedMs` o `lockResetsUsed` en el momento de ejecutarse (incluso si la pieza no estaba apoyada, situación normal antes de aplicar el descenso instantáneo);
- un hard drop con distancia de descenso `0` (la pieza ya estaba apoyada, con o sin progreso de lock delay acumulado) también fija inmediatamente, sin emitir `pieceMoved`, emitiendo únicamente `pieceLocked` y lo que corresponda de líneas/spawn/game over, exactamente igual que en `0002`/`0005`.

## 13. Procesamiento vertical revisado (gravedad y soft drop)

El acumulador `verticalProgress` (privado, no expuesto en el snapshot, sin cambios respecto de `0005` §12.2) conserva su forma de acumulación. Cambia únicamente qué ocurre cuando un intento de descenso falla por colisión:

```text
function processVertical(input):
  if !activePiece: return
  activeCellsPerSecond = input.softDropHeld ? config.softDropCellsPerSecond : config.gravityCellsPerSecond
  verticalProgress += fixedStepMs * activeCellsPerSecond

  while verticalProgress >= 1000:
    nextY = activePiece.y + 1
    candidateCells = computeAbsoluteCells(activePiece.type, activePiece.x, nextY, activePiece.orientation)
    verticalProgress -= 1000
    if !isCollision(board, candidateCells):
      activePiece.y = nextY
      reason = input.softDropHeld ? 'softDrop' : 'gravity'
      emitir pieceMoved con motivo reason
    // si colisiona: no se mueve, no se fija, no se emite evento.
    // La unidad de progreso se consume igualmente (verticalProgress ya se restó arriba),
    // igual que un intento de movimiento horizontal bloqueado consume su intervalo de DAS/ARR (0005 §11).
```

Reglas:

- Un intento de descenso vertical bloqueado por colisión **ya no fija la pieza**. Este es el cambio central de esta tarea: la fijación por gravedad o por soft drop deja de ser inmediata.
- Un intento bloqueado no mueve la pieza, no emite `pieceMoved`, y no invoca la evaluación de reinicio de lock delay de §9 (la gravedad y el soft drop nunca reinician ni consumen reinicios, tengan éxito o no).
- La unidad de progreso de `1000` correspondiente al intento bloqueado se consume igualmente (se resta de `verticalProgress`), de modo que el bucle `while` siempre termina de forma determinista y finita, sin necesidad de una condición de parada adicional: cada iteración, con éxito o sin él, resta `1000` de un acumulador que solo crece por `fixedStepMs * activeCellsPerSecond` en cada paso.
- Esta forma de consumir la unidad de progreso, aunque el intento falle, es intencional y evita que el progreso vertical se acumule sin límite mientras la pieza permanece apoyada con soft drop mantenido durante todo el periodo de lock delay; es la misma filosofía que ya aplica `0005` §11 al intervalo de DAS/ARR ante un movimiento horizontal bloqueado.
- Pueden producirse varios descensos reales en el mismo paso lógico si `verticalProgress` acumulado lo permite, exactamente como en `0005`; ahora, además, un intento fallido puede aparecer intercalado en la misma secuencia de iteraciones sin detener el bucle antes de que `verticalProgress` caiga por debajo de `1000`.
- El apoyo resultante de un intento de descenso bloqueado no se determina ni se actúa dentro de `processVertical`: la determinación autorizada de apoyo para el temporizador es la detección final de §8.1, ejecutada después de todo el procesamiento vertical del paso (ver §14). `processVertical` no necesita saber nada sobre `lockDelayElapsedMs` ni `lockResetsUsed`.

## 14. Orden del paso lógico

El orden ya consolidado en `0002` §14, ampliado en `0003` §13 y detallado en `0005` §14 se mantiene sin reordenar ninguna de sus fases existentes. Esta tarea inserta la detección final de apoyo, el avance del temporizador y la fijación por expiración **después** del procesamiento vertical, y envuelve las fases de movimiento horizontal y rotación con la evaluación de reinicio de §9. El orden completo, definitivo para `0006`:

1. Comprobar estado del motor (`ENGINE_NOT_RUNNING` si `gameOver`).
2. Validar entrada (`INVALID_GAME_INPUT` si no cumple el contrato; sin cambios de forma en esta tarea, ver §18).
3. Incrementar contador de paso (`currentStep += 1`).
4. Incrementar tiempo lógico (`currentElapsedMs += fixedStepMs`).
5. **Movimiento horizontal.** Resolver la dirección efectiva y ejecutar los movimientos debidos (activación inmediata, o continuación de DAS/ARR), sin cambios respecto de `0005` §9-§11. Cada desplazamiento real ejecuta además la evaluación de reinicio de lock delay de §9 inmediatamente después de aplicarse. Si algún desplazamiento consume el reinicio número `config.maxLockResets` (§11), la pieza se fija en ese instante y **el resto del paso termina aquí** (pasos 6 a 9 no se ejecutan sobre la nueva pieza en este `step()`).
6. **Rotación.** Sin cambios respecto de `0003` en el algoritmo de rotación y *wall kicks*. Si la rotación tiene éxito, emitir `pieceRotated` y ejecutar inmediatamente después la evaluación de reinicio de lock delay de §9. Si consume el reinicio número `config.maxLockResets`, la pieza se fija en ese instante y **el resto del paso termina aquí** (pasos 7 a 9 no se ejecutan en este `step()`).
7. **Hard drop**, si `input.hardDrop === true` (sin cambios de comportamiento respecto de `0002`/`0005`, sin ninguna interacción con lock delay, ver §12): fijación inmediata incondicional y `return` tras completar fijación/líneas/spawn/game over. El resto del paso no se ejecuta.
8. Si no hubo hard drop ni fijación en los pasos 5-6: **procesamiento vertical** (gravedad o soft drop, según `input.softDropHeld`), con la revisión de §13. Un intento bloqueado ya no fija la pieza.
9. Si sigue existiendo una pieza activa tras el paso 8 (es decir, no se fijó en los pasos 5, 6 o 7 de este mismo `step()`): **detección final de apoyo y lock delay**, exactamente como en §8.1:
   - calcular `groundedAtEndOfStep = isGrounded(activePiece, board)`;
   - si `groundedAtEndOfStep`: `lockDelayElapsedMs += fixedStepMs`; si `lockDelayElapsedMs >= config.lockDelayMs`, fijar la pieza inmediatamente (secuencia siguiente);
   - si no: `lockDelayElapsedMs = 0`.
10. **Fijación, eliminación de líneas, spawn de la siguiente pieza y game over**, cuando corresponda por cualquiera de las tres vías anteriores (límite de reinicios en el paso 5/6, hard drop en el paso 7, o expiración del temporizador en el paso 9): escribir las cuatro celdas en el tablero, emitir `pieceLocked`; inspeccionar y eliminar líneas completas, emitir `linesCleared` si hay alguna; generar la siguiente pieza y emitir `pieceSpawned`, o emitir `gameOver` con motivo `spawnBlocked` si el spawn está bloqueado (secuencia ya existente de `0002` §14/§18/§19/§20, sin cambios). La nueva pieza activa (si existe) inicia con `lockDelayElapsedMs = 0` y `lockResetsUsed = 0` (§17).
11. Los eventos generados se encolan en el orden real de ejecución y quedan disponibles para `drainEvents()`.

Consecuencias explícitas (se derivan del orden anterior; se listan para evitar ambigüedad):

- El movimiento horizontal (incluidas sus repeticiones DAS/ARR) sigue procesándose antes que la rotación, que sigue procesándose antes que el hard drop, que sigue dominando sobre el procesamiento vertical del mismo paso. Esta tarea no reordena ninguna de estas relaciones.
- La detección final de apoyo (paso 9) es la **única** determinación autorizada para decidir si el temporizador avanza en ese paso; los apoyos evaluados durante los pasos 5 y 6 (`groundedBefore`/`groundedAfter` de cada acción individual) son evaluaciones locales a esa acción, usadas exclusivamente para decidir si esa acción concreta reinicia o no el temporizador, no para decidir el avance del paso 9.
- Una fijación por límite de reinicios (paso 5 o 6) o por hard drop (paso 7) impide que el paso 9 llegue a ejecutarse en ese `step()`: no hay doble fijación ni doble emisión de `pieceLocked` en un mismo paso.
- Un intento de movimiento horizontal o vertical bloqueado no impide que se procesen las fases posteriores del mismo `step()` (rotación, hard drop, procesamiento vertical, detección final, etc. continúan evaluándose con normalidad), exactamente como en `0005`.

## 15. Snapshot

`ActivePieceSnapshot` se amplía con tres campos nuevos, todos de solo lectura:

```ts
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;
  lockDelayElapsedMs: number;
  lockResetsUsed: number;
}>;
```

Reglas:

- `grounded` se deriva en el momento de construir el snapshot mediante `isGrounded` (§7), sobre la posición y orientación actuales de la pieza activa y el tablero actual. Coincide siempre con la determinación final del paso más reciente (§8.1, §14 paso 9), porque nada muta el tablero ni la pieza activa entre el final de un `step()` y la llamada a `getSnapshot()`.
- `lockDelayElapsedMs` refleja el acumulador interno tal como queda tras el `step()` más reciente (§8). Nunca es negativo. Nunca queda, de forma persistente, por encima de `config.lockDelayMs` (§8.2).
- `lockResetsUsed` refleja el número de reinicios consumidos por la pieza activa actual desde su aparición (§9, §11). Nunca supera `config.maxLockResets` (§11).
- Estos tres campos son de solo lectura: no se expone ningún método ni referencia que permita a Phaser, Vue o cualquier consumidor externo mutarlos, iniciarlos, detenerlos o forzar su valor. Toda mutación ocurre exclusivamente dentro de `step()`, `reset()` y la creación del motor.
- No se añade `lockDelayRemainingMs`: es derivable como `config.lockDelayMs - lockDelayElapsedMs` por cualquier consumidor que lo necesite, y `config.lockDelayMs` ya es públicamente accesible desde `packages/game-config`.
- No se expone ningún temporizador externo (identificador de `setTimeout`/`setInterval`, referencia a un reloj, etc.): el lock delay es exclusivamente tiempo lógico interno del motor.
- No se añade ningún otro acumulador interno al snapshot más allá de los tres campos listados (por ejemplo, `verticalProgress`, `horizontalAccumulatorMs` o cualquier estado de prioridad horizontal siguen siendo privados, sin cambios respecto de `0005` §15).
- `EngineSnapshot` (el nivel superior del snapshot) no cambia: sigue sin ganar ningún campo nuevo. El estado de apoyo y lock delay pertenece exclusivamente a `ActivePieceSnapshot`, y por tanto no existe cuando `activePiece` es `null` (game over): no es necesario definir un valor de "apoyo" para la ausencia de pieza activa, porque el campo simplemente no está presente en ese caso.
- El snapshot sigue siendo inmutable (`Object.freeze`), igual que en `0002`/`0003`/`0005`.

## 16. Eventos

No se añade, elimina ni modifica ningún tipo de `GameEvent` ni ningún valor de `MoveReason` en esta tarea. En particular, no se introducen `pieceGrounded`, `lockDelayStarted`, `lockDelayReset` ni `lockDelayExpired`: el motor sigue comunicando la fijación exclusivamente mediante `pieceLocked`, y los movimientos y rotaciones válidos siguen emitiendo `pieceMoved`/`pieceRotated` exactamente como ya lo hacen.

Reglas de orden explícitas para los casos nuevos que introduce esta tarea:

- Cuando un movimiento horizontal consume el reinicio número `config.maxLockResets` y provoca fijación inmediata (§11): el evento `pieceMoved` (motivo `'horizontal'`) correspondiente a ese desplazamiento se emite primero (el desplazamiento ya ocurrió), seguido de `pieceLocked`, seguido de `linesCleared` si procede, seguido de `pieceSpawned` o `gameOver` según corresponda. Este es el mismo patrón de encadenamiento que ya usa el hard drop (`pieceMoved` → `pieceLocked` → `linesCleared` → `pieceSpawned`/`gameOver`) y la fijación por gravedad/soft drop de `0002`/`0005`.
- Cuando una rotación consume el reinicio número `config.maxLockResets` y provoca fijación inmediata (§11): `pieceRotated` se emite primero, seguido de la misma secuencia `pieceLocked` → `linesCleared` (si procede) → `pieceSpawned`/`gameOver`.
- Una fijación por expiración del temporizador (§8.1, §14 paso 9-10), al no estar asociada a ningún movimiento u rotación de ese mismo paso, emite únicamente `pieceLocked` → `linesCleared` (si procede) → `pieceSpawned`/`gameOver`, sin ningún `pieceMoved` adicional (coherente con la regla general de que `pieceMoved` solo se emite para movimientos reales, ya vigente desde `0002`).
- Las acciones bloqueadas (movimiento horizontal sin espacio, rotación sin *wall kick* válido, descenso vertical bloqueado) no emiten ningún evento, incluidas las de esta tarea: no existe ningún evento que señale "la pieza sigue apoyada" o "el temporizador avanzó" paso a paso; esa información solo es observable a través del snapshot (§15).
- `drainEvents()` sigue devolviendo los eventos en el orden real de emisión y vaciando la cola interna, sin cambios de contrato.

## 17. Reinicio de estado temporal (spawn y `reset()`)

Al generarse una nueva pieza activa, por cualquier causa (creación inicial del motor, fijación por límite de reinicios, fijación por hard drop, o fijación por expiración del lock delay — es decir, cada vez que se ejecuta `spawnInitialPieces` o `spawnNextPiece`):

- `lockDelayElapsedMs = 0`;
- `lockResetsUsed = 0`;
- `grounded`, al ser derivado (§7), refleja de inmediato la posición real de la nueva pieza (normalmente `false`, salvo el caso límite de un tablero casi lleno donde la nueva pieza ya nace apoyada, ver §7).

La nueva pieza no hereda temporizador ni reinicios de la pieza anterior, exactamente con el mismo principio ya aplicado en `0005` §13 a `horizontalPriority`, los acumuladores de DAS/ARR y `verticalProgress`.

### 17.1 `reset()`

`reset()` reinicia todo el estado temporal de esta tarea, con la misma secuencia ya definida en `0002` §23 y ampliada en `0005` §13.1, añadiendo:

- `lockDelayElapsedMs = 0`;
- `lockResetsUsed = 0`.

Tras `reset()`, el snapshot debe reflejar inmediatamente estos valores en la pieza activa inicial de la nueva secuencia, sin necesidad de llamar a `step()`, igual que ya ocurre con el resto de campos del snapshot.

## 18. Atomicidad y errores

No se introduce ningún código de error público nuevo. `EngineStepError` conserva exactamente sus dos códigos (`'INVALID_GAME_INPUT'`, `'ENGINE_NOT_RUNNING'`) y su precedencia ya establecida: si el motor está en `gameOver`, se lanza `ENGINE_NOT_RUNNING` incluso si la entrada también es inválida, comprobación que se realiza antes que la validación de la forma de la entrada, sin cambios respecto de `0002`/`0005`. `EngineOptionsError` tampoco cambia.

La forma de `StepInput` y las reglas de `validateInput` no cambian en esta tarea (§4.1): esta tarea no añade, elimina ni modifica ningún campo de entrada ni ninguna regla de validación.

Una entrada inválida, en cualquier estado del motor, no muta:

- el contador de paso ni el tiempo lógico;
- la pieza activa (tipo, posición, orientación) ni el tablero;
- los acumuladores de DAS/ARR, la prioridad horizontal ni `verticalProgress`;
- **`lockDelayElapsedMs` ni `lockResetsUsed`** (ampliación explícita de la invariante ya vigente, para dejar constancia de que el lock delay no es una excepción);
- el PRNG ni el estado de la bolsa;
- la cola de eventos: no se emite ningún evento.

La fijación diferida no introduce ninguna forma nueva de romper el determinismo ni el `reset()`: toda la lógica añadida (§7-§14) depende exclusivamente de `fixedStepMs`, `config.lockDelayMs`, `config.maxLockResets`, la posición/orientación de la pieza activa y el contenido del tablero, todos ellos ya deterministas.

## 19. Configuración

Esta tarea reutiliza `lockDelayMs` y `maxLockResets`, ya existentes en `GameConfig` desde `0001`/`0002`, con sus valores actuales (`500` y `15` en `prototypeConfig`) sin cambios. `packages/game-config` no se modifica en esta tarea:

- no se añade ninguna propiedad nueva al esquema (`gameConfigSchema`);
- no se modifica ninguna regla relacional existente en `collectRelationalIssues` (la regla `lockDelayMs % fixedStepMs === 0` ya es suficiente y ya se cumple);
- no se modifican los valores de `prototypeConfig`;
- no se duplica ninguna constante de configuración dentro de `packages/game-engine` ni de `apps/web`: el motor sigue leyendo `config.lockDelayMs` y `config.maxLockResets` directamente del objeto de configuración recibido, igual que ya hace con `config.dasMs`, `config.arrMs`, etc.

La configuración validada por `parseGameConfig` sigue siendo la única fuente de estos parámetros para el motor.

## 20. Phaser y aplicación web

Phaser no implementa, duplica ni anticipa el lock delay. No se introduce ningún `setTimeout`, temporizador de Phaser, tiempo real ni lógica por frame para esta mecánica: el lock delay es exclusivamente tiempo lógico interno de `packages/game-engine`, consumido por `apps/web` únicamente a través de `getSnapshot()` (los tres campos nuevos de §15) y de los eventos ya existentes (`pieceLocked`), sin ningún evento nuevo.

Inspección confirmada de `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/input-debug.ts`, `apps/web/src/game/types.ts` y `apps/web/src/game/coordinates.ts`: ninguno de estos archivos declara un tipo propio que enumere explícitamente los campos de `ActivePieceSnapshot` (todos consumen el tipo exportado por `@rautfall/game-engine` tal cual, o extraen campos concretos como `type`, `x`, `y`, `cells` sin una interfaz paralela cerrada). Por tanto:

- **no se anticipa ninguna modificación de archivos de `apps/web` en esta tarea**; la ampliación estructural de `ActivePieceSnapshot` (§15) es compatible hacia atrás con todo el código existente sin ningún cambio;
- no se implementa todavía ningún indicador visual definitivo del lock delay: sin barras, sin parpadeo, sin contorno de apoyo, sin animación de fijación inminente (ver §6);
- no se amplía el alcance visual del canvas, del HUD de Vue ni de la ayuda de controles;
- la herramienta de diagnóstico opt-in de entrada introducida en `0005` (`apps/web/src/game/input-debug.ts`, activada con `?inputDebug=1`) sigue funcionando sin cambios: registra eventos de teclado, entrada enviada al motor, resultado observable (posición antes/después) y eventos importantes del motor (`pieceLocked` entre ellos) exactamente igual que hoy. Como esta tarea no añade ningún evento nuevo ni cambia la frecuencia de drenado de la cola de eventos (`GameScene.update` sigue llamando a `engine.drainEvents()` una única vez por frame, al final de `update`, tal como hoy), no se introduce doble drenaje de eventos ni ruido adicional injustificado en el diagnóstico. Si `pieceLocked` pasa a emitirse en un paso distinto del que antes lo emitía (por ejemplo, más tarde, tras el periodo de lock delay, en vez de en el mismo paso en que la pieza tocaba fondo), esto es un cambio de comportamiento observable esperado de esta tarea, no una regresión del diagnóstico: el diagnóstico sigue registrando `pieceLocked` correctamente en el paso en el que realmente ocurre.
- si, durante la implementación, se detecta una necesidad real y mínima de ajuste no funcional en `apps/web` (por ejemplo, un tipo explícito que hoy enumere manualmente un subconjunto de campos de `ActivePieceSnapshot` y no se haya detectado en esta inspección), el ajuste se limita estrictamente a esa necesidad puntual, sin lógica nueva, sin indicador visual, y se documenta en el informe de implementación (§24).

## 21. Dependencias

No se añade ninguna dependencia nueva en ningún paquete (`packages/game-engine`, `packages/game-config`, `apps/web`) para esta tarea. No se modifica `pnpm-lock.yaml`.

## 22. Estrategia de pruebas requerida

Aplicar TDD pragmático en `packages/game-engine` (lógica de dominio, determinismo). Las pruebas deben verificar comportamiento observable, invariantes y contratos, sin depender innecesariamente de detalles internos (nombres exactos de variables de estado privado, por ejemplo, no deben aparecer en aserciones de test). Como mínimo:

### 22.1 Temporizador

- El temporizador empieza a avanzar cuando la pieza entra en contacto (deja de poder descender).
- El primer paso en el que la pieza termina apoyada ya cuenta `fixedStepMs` de `lockDelayElapsedMs`.
- La pieza no se fija antes de alcanzar `config.lockDelayMs` de tiempo acumulado apoyada.
- La pieza se fija exactamente al alcanzar o superar `config.lockDelayMs` (umbral exacto).
- El temporizador avanza una única vez por paso lógico mientras la pieza permanece apoyada, incluso si ese paso también contiene movimientos u otras acciones.
- El comportamiento del temporizador no depende de tiempo real (`Date.now()`/`performance.now()`), solo de `fixedStepMs` acumulado.

### 22.2 Movimiento horizontal

- Un movimiento horizontal válido con la pieza apoyada antes y después reinicia `lockDelayElapsedMs` a `0` y consume un reinicio (`lockResetsUsed` aumenta en `1`).
- Un movimiento horizontal bloqueado (colisión) no reinicia el temporizador ni consume reinicio.
- Un movimiento horizontal válido que parte de apoyado y deja la pieza en el aire pone `lockDelayElapsedMs` a `0` sin consumir reinicio, y `lockResetsUsed` no cambia.
- Varias repeticiones válidas de DAS/ARR en el mismo paso lógico, con la pieza apoyada antes y después de cada una, consumen un reinicio por cada repetición real, no uno solo por el paso.
- Varias repeticiones válidas de DAS/ARR en el mismo paso lógico no consumen reinicios de forma ambigua o accidental cuando alguna de ellas deja la pieza en el aire (esa repetición concreta no consume; las siguientes, si la pieza vuelve a apoyarse en el mismo paso mediante el procesamiento vertical, sí pueden volver a evaluarse con normalidad en pasos posteriores).

### 22.3 Rotación

- Una rotación válida con la pieza apoyada antes y después reinicia el temporizador y consume un reinicio.
- Una rotación inválida (ningún *wall kick* válido) no reinicia el temporizador ni consume reinicio.
- Un *wall kick* que deja la pieza apoyada (apoyada antes y después) consume un reinicio.
- Un *wall kick* que deja la pieza en el aire (apoyada antes, no apoyada después) pone el temporizador a `0` sin consumir reinicio.

### 22.4 Límite de reinicios

- El reinicio número `config.maxLockResets` aplica la acción (movimiento u rotación) y fija la pieza en el mismo paso lógico, en la nueva posición/orientación resultante de esa acción.
- No existe un reinicio número `config.maxLockResets + 1`: tras alcanzar el límite, la pieza ya está fijada y una nueva pieza (con `lockResetsUsed = 0`) ocupa su lugar.
- `lockResetsUsed` nunca supera `config.maxLockResets` en el snapshot, en ningún paso de ninguna prueba.
- El orden de eventos es correcto cuando una acción consume el último reinicio y fija en el mismo paso: `pieceMoved`/`pieceRotated` (según corresponda) antes de `pieceLocked`, antes de `linesCleared` (si procede), antes de `pieceSpawned`/`gameOver`.

### 22.5 Procesamiento vertical

- Una gravedad bloqueada (la pieza no puede descender) inicia o mantiene el lock delay; no fija la pieza inmediatamente.
- Un soft drop bloqueado inicia o mantiene el lock delay; no fija la pieza inmediatamente.
- Mantener soft drop mientras la pieza está apoyada no reinicia el temporizador ni consume reinicios, por muchos pasos que se mantenga.
- El hard drop fija la pieza inmediatamente, sin relación con `lockDelayElapsedMs` ni `lockResetsUsed`, en cualquier estado previo de ambos.
- Un hard drop con distancia de descenso `0` (pieza ya apoyada, con o sin progreso de lock delay previo) también fija inmediatamente.

### 22.6 Salida y reentrada en contacto

- El temporizador vuelve a `0` cuando una acción válida deja la pieza en el aire tras estar apoyada.
- `lockResetsUsed` se conserva (no se reinicia) al salir del contacto.
- Al volver a apoyarse (en el mismo paso o en un paso posterior), comienza un nuevo periodo de lock delay desde `0`, con el mismo `lockResetsUsed` ya acumulado.
- Una nueva pieza (tras fijación, en la creación del motor, o tras `reset()`) reinicia ambos contadores (`lockDelayElapsedMs = 0`, `lockResetsUsed = 0`), sin heredar nada de la pieza anterior.

### 22.7 Determinismo y reset

- Misma semilla, misma configuración y misma secuencia de `StepInput` producen exactamente el mismo resultado observable (snapshot y eventos idénticos), incluidos los tres campos nuevos del snapshot.
- `reset()` elimina cualquier progreso de lock delay pendiente de la partida anterior.
- Los snapshots no exponen mutabilidad: los tres campos nuevos son valores primitivos de solo lectura, no referencias mutables.
- Una entrada inválida durante un periodo de lock delay en curso no muta `lockDelayElapsedMs`, `lockResetsUsed`, ni ningún otro estado (ver §18).

### 22.8 Integración con rotación, DAS/ARR y soft drop existentes

- Movimiento horizontal y rotación combinados en el mismo paso lógico, ambos con la pieza apoyada antes y después de cada uno, consumen dos reinicios (uno por cada acción), en el orden real (horizontal antes que rotación).
- Compatibilidad con game over (`spawnBlocked`) tras una fijación por lock delay: el motor termina la partida con normalidad si el siguiente spawn resulta bloqueado, igual que tras cualquier otra fijación.

### 22.9 Integración Phaser/`apps/web` (si aplica)

- Confirmar que ninguna prueba existente de `apps/web` (`input-buffer.test.ts`, `time-adapter.test.ts`, `coordinates.test.ts`, `types.test.ts`, `input-debug.test.ts`, `workspace.test.ts`) queda rota por la ampliación de `ActivePieceSnapshot`.
- Si, y solo si, la inspección de §20 revela una necesidad real de ajuste no funcional, añadir o adaptar únicamente las pruebas estrictamente necesarias para ese ajuste puntual, documentándolo en el informe de implementación.
- La suite existente del motor (145 `it`/`test` en 32 bloques `describe` en `packages/game-engine/src/game-engine.test.ts`) continúa en verde, salvo las pruebas que dependieran explícitamente del comportamiento de fijación inmediata por gravedad o soft drop que esta tarea sustituye; esas pruebas concretas se adaptan a la nueva semántica de lock delay (por ejemplo, esperando `grounded: true` y progreso de `lockDelayElapsedMs` en vez de una fijación en el mismo paso), documentando la adaptación en el informe de implementación.

## 23. Comandos de validación final

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
- No existe código muerto (en particular, ninguna referencia residual a la fijación inmediata por gravedad/soft drop sustituida en `processVertical`).
- No hay abstracciones innecesarias ni arquitectura preventiva para tareas futuras (indicador visual de lock delay, pieza fantasma, hold).
- No se ha ampliado el alcance más allá de §5.
- No hay errores ni avisos de lint ignorados.
- Validación manual en `apps/web` (`pnpm dev`): una pieza que toca fondo o una pila ya no se fija instantáneamente; mover o rotar la pieza mientras está apoyada retrasa visualmente su fijación (aunque sin indicador visual dedicado, observable por el retraso); mantener soft drop sobre una pieza apoyada no la fija antes de `lockDelayMs`; el hard drop sigue fijando instantáneamente; rotación, movimiento, gravedad y reset siguen funcionando como en `0005`.

## 24. Documentación y cierre futuro

Este documento ([docs/tasks/0006-lock-delay-fijacion-diferida.md](0006-lock-delay-fijacion-diferida.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá:

- crear [docs/implementation/0006-lock-delay-fijacion-diferida.md](../implementation/0006-lock-delay-fijacion-diferida.md) como informe de implementación independiente, con:
  - resumen;
  - archivos creados y modificados;
  - contrato público final (en particular, la forma exacta de `ActivePieceSnapshot`);
  - decisiones de implementación de bajo nivel (nombres internos elegidos, forma exacta de las funciones auxiliares equivalentes a `isGrounded` y a la evaluación de reinicio de §9, si difieren de los nombres usados en esta especificación);
  - pruebas añadidas o adaptadas, y por qué;
  - comandos ejecutados y resultados;
  - desviaciones respecto de esta especificación, si las hubo, y su justificación;
  - deuda técnica identificada (por ejemplo, ausencia de indicador visual de lock delay);
  - confirmación explícita de la ausencia del alcance excluido (§6);
- actualizar [docs/project-status.md](../project-status.md): estado de `0006` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y propuesta de siguiente tarea (ver §25).

Esta especificación no crea esos documentos ahora.

## 25. Criterios de aceptación

### Contrato público

- `ActivePieceSnapshot` expone `grounded: boolean`, `lockDelayElapsedMs: number` y `lockResetsUsed: number`, además de los campos ya existentes, sin ningún otro cambio de forma.
- `EngineSnapshot`, `StepInput`, `GameEvent` y `MoveReason` no ganan ni pierden ningún campo o valor.
- No se añade ningún código de error público nuevo.

### Semántica exacta

- Gravedad y soft drop ya no fijan la pieza al fallar un descenso: la pieza pasa a estado apoyado y el temporizador de lock delay comienza o continúa.
- El primer paso apoyado ya cuenta `fixedStepMs` de `lockDelayElapsedMs`.
- La fijación por expiración ocurre exactamente al alcanzar `lockDelayElapsedMs >= config.lockDelayMs`.
- Un movimiento horizontal o una rotación válidos, con la pieza apoyada antes y después, reinician el temporizador y consumen un reinicio.
- Un movimiento horizontal o una rotación válidos que dejan la pieza en el aire ponen el temporizador a `0` sin consumir reinicio.
- Las acciones bloqueadas, la gravedad y el soft drop nunca reinician el temporizador ni consumen reinicios.
- El hard drop conserva su fijación inmediata incondicional, sin relación con el lock delay ni los reinicios.

### Límites

- El reinicio número `config.maxLockResets` aplica la acción y fija la pieza en el mismo paso, sin conceder un nuevo periodo de `lockDelayMs`.
- `lockResetsUsed` nunca supera `config.maxLockResets` en ningún snapshot observado.
- No existe ningún camino que permita un reinicio número `config.maxLockResets + 1`.

### Determinismo

- Misma semilla, configuración y secuencia de `StepInput` producen snapshots y eventos idénticos, incluidos los tres campos nuevos.
- `reset()` elimina cualquier progreso de lock delay pendiente y reinicia ambos contadores a `0`.
- Una entrada inválida no muta `lockDelayElapsedMs`, `lockResetsUsed`, ni ningún otro estado del motor.

### Separación motor/Phaser

- `packages/game-engine` sigue sin depender de Phaser, Vue, DOM ni tiempo real para el lock delay.
- Ningún archivo de `apps/web` implementa, duplica o anticipa temporización de lock delay.
- El diagnóstico opt-in de entrada de `0005` sigue funcionando sin doble drenaje de eventos ni ruido adicional injustificado.

### Ausencia de alcance adicional

- No existe pieza fantasma, hold, vista de tres próximas piezas, puntuación, combos, T-Spins, `back-to-back`, energía, sabotajes, batalla, bot, pausa, audio, HUD Tactical, indicador visual de lock delay, code splitting nuevo, ni subida del límite de aviso de chunk.
- No se añadió ninguna propiedad de configuración nueva ni ninguna dependencia nueva.
- No se añadió ningún evento público nuevo ni ningún código de error nuevo.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

### Puertas de calidad

- `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan correctamente.
- `git diff --check` no reporta problemas.
- El aviso de chunk de Phaser puede continuar sin bloquear la tarea.

## 26. Próxima tarea

A definir en su propia especificación tras completar `0006` y validar manualmente, mediante `pnpm dev`, que el retardo de fijación mejora la sensación de control (posibilidad real de corregir la colocación de una pieza apoyada mediante movimiento o rotación antes de que se fije). Esta especificación no prejuzga el contenido de `0007`: candidatas razonables mencionadas en `docs/rautfall.md` (pieza fantasma, hold, indicador visual de lock delay, puntuación) no se asumen automáticamente como alcance de la siguiente tarea hasta que se redacte su propia especificación.
