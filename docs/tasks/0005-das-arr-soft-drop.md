# 0005 — DAS, ARR y soft drop

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0005 — DAS, ARR y soft drop
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0005`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0005-das-arr-soft-drop.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0005-das-arr-soft-drop.md) (ver §21), siguiendo la convención de rutas de `AGENTS.md`.
- **Aviso sobre `docs/project-status.md`:** en la fecha de redacción de este documento, [docs/project-status.md](../project-status.md) anticipaba `0005 — Prototipo vertical Tactical` como siguiente tarea, sin especificación propia todavía. Esta especificación sustituye esa previsión: el contenido real de la tarea `0005` es el definido aquí (DAS, ARR y soft drop), por decisión explícita del producto. `docs/project-status.md` no se modifica en esta tarea (ver §21); su actualización, incluida la corrección de esta previsión, corresponde al informe de implementación.

## 1. Objetivo

Añadir al motor determinista existente:

- Movimiento horizontal mantenido, determinista, gobernado íntegramente por `game-engine` mediante Delayed Auto Shift (`dasMs`) y Auto Repeat Rate (`arrMs`), usando los valores ya existentes en `packages/game-config`.
- Soft drop mantenido, gobernado íntegramente por `game-engine`, usando `softDropCellsPerSecond` ya existente en `packages/game-config`.
- Un acumulador vertical único y privado que decide, paso a paso, si la pieza activa desciende por gravedad normal o por soft drop, sin sumar ambas velocidades.
- Un contrato de entrada ampliado que distingue estado mantenido (`Held`) de flanco de pulsación (`Pressed`) para el movimiento horizontal, y un estado mantenido para soft drop, conservando el resto del contrato ya existente (rotación, hard drop).
- La adaptación de Phaser correspondiente: Phaser deja de tener ninguna noción de "una sola pulsación produce un único movimiento"; se limita a observar teclado y entregar estado mantenido/flanco al motor, que decide cuántos movimientos ocurren y cuándo.

Al terminar la tarea, mantener pulsada una dirección debe producir movimiento repetido determinista (pulsación inmediata, espera de `dasMs`, repeticiones cada `arrMs`), y mantener la tecla de soft drop debe sustituir la gravedad normal por `softDropCellsPerSecond` mientras se mantenga pulsada.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo              ✅ Completada
0002 — Motor de juego determinista      ✅ Completada
0003 — Rotación SRS                     ✅ Completada
0004 — Integración de Phaser            ✅ Completada
0005 — DAS, ARR y soft drop             ← Esta tarea
```

Esta tarea no incluye: lock delay, puntuación por soft drop, remapeo de controles, pausa, hold, ghost piece, preview visual de próximas piezas, cambios de navegación, code splitting, subida artificial del límite de aviso de tamaño de chunk, cambios visuales no necesarios para observar el nuevo comportamiento, ni refactors generales ajenos a esta tarea. Ver §7 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — decisiones globales del producto. No contiene ninguna decisión específica sobre DAS, ARR o soft drop (verificado por inspección); estos parámetros ya existen como campos de configuración desde `0001`/`0002` sin uso real hasta ahora.
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) — modelo de tablero, sistema de coordenadas, gravedad basada en tiempo lógico, fijación, orden del paso lógico original.
- [docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md) — rotación SRS, `Orientation`, inserción de la rotación en el orden del paso.
- [docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md) — adaptación de tiempo real a pasos lógicos fijos, captura de teclado por flanco (`JustDown`), estructura `GameCanvas.vue` / `create-phaser-game.ts` / `GameScene.ts`, comunicación Phaser→Vue.
- `packages/game-engine/src/index.ts` — API pública real del motor tras `0004` (ver §4). Se amplía, no se reescribe desde cero.
- `packages/game-engine/src/game-engine.test.ts` — 103 pruebas existentes, muchas de ellas construyen `StepInput` con el campo `horizontal` que esta tarea sustituye (ver §8.3).
- `packages/game-config/src/index.ts` — `GameConfig` y `prototypeConfig` reales.
- `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/time-adapter.ts`, `apps/web/src/game/coordinates.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/components/GameCanvas.vue` — integración Phaser real tras `0004`, que esta tarea adapta sin rediseñar (ver §15).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto (ver aviso en «Estado» sobre la previsión de título de `0005`).

## 4. Contratos públicos reales disponibles (inspección previa a esta tarea)

Confirmado por lectura directa de `packages/game-engine/src/index.ts` y `packages/game-config/src/index.ts`.

### 4.1 `@rautfall/game-engine` (antes de esta tarea)

```ts
function createGameEngine(options: EngineOptions): GameEngine;

type EngineOptions = { seed: number; config: GameConfig };

type GameEngine = {
  step(input: StepInput): void;               // throws EngineStepError
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  reset(options: EngineOptions): void;         // throws EngineOptionsError
};

type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};

type MoveReason = 'horizontal' | 'gravity' | 'hardDrop';

type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | { type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation };

class EngineStepError extends Error {
  code: 'INVALID_GAME_INPUT' | 'ENGINE_NOT_RUNNING';
}
class EngineOptionsError extends Error {
  code: 'INVALID_ENGINE_OPTIONS';
}
```

Hechos verificados relevantes:

- El motor procesa el paso lógico internamente en este orden (función `processStep`, confirmado en el código): movimiento horizontal (§ paso 5) → rotación (§ paso 6) → hard drop (§ paso 7, si `hardDrop === true`, con `return` inmediato tras fijar/limpiar/spawnear) → gravedad (§ paso 8, solo si no hubo hard drop, con `gravityAccumulatorMs` acumulando `fixedStepMs` y umbral `msPerCell = 1000 / gravityCellsPerSecond`, fijando y `break`eando el bucle si el descenso falla).
- La validación de entrada (`validateInput`) usa una lista cerrada de claves permitidas (`allowedKeys`), rechaza propiedades desconocidas, exige `horizontal` y `hardDrop`, y rechaza `rotateClockwise === true && rotateCounterclockwise === true`.
- `gravityAccumulatorMs` es una variable interna de clausura, no expuesta en `EngineSnapshot`, reiniciada a `0` en la creación, en cada spawn de pieza tras fijación (`spawnNextPiece`) y en `reset()`.
- El error `EngineStepError` con `code: 'INVALID_GAME_INPUT'` no muta ningún estado (comprobado antes de incrementar `currentStep`/`currentElapsedMs`).

### 4.2 `@rautfall/game-config` (antes de esta tarea)

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
  lockDelayMs: 500,
  maxLockResets: 15,
};
```

Reglas relacionales ya vigentes en `parseGameConfig` (confirmadas por lectura del código, no se modifican en esta tarea):

- `dasMs % fixedStepMs === 0` (150 % 10 = 0 ✓).
- `arrMs % fixedStepMs === 0` (50 % 10 = 0 ✓).
- `lockDelayMs % fixedStepMs === 0` (no afecta a esta tarea).
- `softDropCellsPerSecond > gravityCellsPerSecond` (20 > 1 ✓).

`prototypeConfig` ya satisface todas las reglas relacionales con los valores reales de `dasMs`, `arrMs` y `softDropCellsPerSecond` que esta tarea debe usar. **`packages/game-config` no se modifica en esta tarea**: ni el esquema, ni `prototypeConfig`, ni las reglas relacionales.

### 4.3 Integración Phaser real (`apps/web`, tras `0004`)

- `GameScene.update(time, delta)` usa `computeSteps` (`apps/web/src/game/time-adapter.ts`) para traducir `delta` a un número de pasos lógicos fijos, limitando el delta efectivo a `250 ms` y a `25` pasos por frame (constantes `MAX_DELTA_MS`, `MAX_STEPS_PER_FRAME`). Esta tarea no modifica `time-adapter.ts` ni sus límites.
- `buildStepInput` (`apps/web/src/game/input-buffer.ts`) hoy calcula él mismo, en Phaser, cuál es el `horizontal` efectivo (incluida la regla de "ambas pulsadas → 0") y consume flancos (`JustDown`) para rotación y hard drop, con un mecanismo de "consumido este frame" para no repetir una acción en varios pasos lógicos del mismo frame. **Esta lógica de decisión de movimiento horizontal se traslada íntegramente al motor** (ver §9, §16); Phaser deja de decidir si hay o no movimiento horizontal.
- `GameScene.ts` mapea teclado así: `ArrowLeft`/`ArrowRight` (movimiento), `ArrowUp` (`rotateClockwise`), `Z` (`rotateCounterclockwise`), `Space` (`hardDrop`), `R` (reset). No existe hoy ninguna tecla mapeada a soft drop; esta tarea añade `ArrowDown` con esa única función (ver §17.2).
- `GameScene.ts` mantiene `consumedThisFrame` para que una pulsación de flanco (rotación, hard drop) se entregue una sola vez aunque el adaptador ejecute varios pasos lógicos en el mismo frame; los pasos lógicos adicionales del mismo frame usan un input "vacío" con `horizontal: 0`, sin rotación, sin hard drop.
- `GameCanvas.vue` tiene `tabindex="0"` en el contenedor; según `docs/tasks/0004-integracion-phaser.md` §9, las teclas de juego deben evitar su comportamiento por defecto (`preventDefault()`) mientras el canvas tiene el foco. `ArrowDown` se añade a ese mismo tratamiento (ver §17.2): evitar su comportamiento por defecto mientras el canvas tiene el foco, igual que `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space`.

Phaser no debe (continúa vigente de `0004`, reafirmado aquí):

- importar rutas internas (`@rautfall/game-engine/src/...`, `@rautfall/game-config/src/...`);
- mutar el snapshot devuelto por `getSnapshot()`;
- recalcular colisiones, SRS, gravedad, fijación, eliminación de líneas, DAS, ARR o velocidades de soft drop;
- interpretar `board` o `activePiece` como estado propio mutable.

## 5. Sistema de coordenadas y modelo de tablero

Sin cambios respecto de `0002`/`0003`/`0004`: tablero interno 10×24 (`HIDDEN_ROWS = 4`, filas visibles `[4, 23]`), origen superior izquierdo, `x` creciente a la derecha, `y` creciente hacia abajo. Esta tarea no modifica el modelo de tablero, la geometría de piezas, las tablas de wall kicks ni el algoritmo de rotación.

## 6. Alcance incluido

- Ampliación de `StepInput` con los campos `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed` y `softDropHeld` (ver §8), en sustitución del campo `horizontal` (eliminado, ver §8.3).
- Estado interno de prioridad horizontal (`left` / `right` / ninguna) gobernado por flancos y estado mantenido (ver §9).
- Delayed Auto Shift (DAS) y Auto Repeat Rate (ARR) horizontales, usando `config.dasMs` y `config.arrMs`, con tiempo puramente lógico (ver §10).
- Reglas deterministas de movimiento horizontal bloqueado durante DAS/ARR (ver §11).
- Soft drop mantenido usando `config.softDropCellsPerSecond`, sustituyendo a la gravedad normal mientras esté activo (ver §12).
- Acumulador vertical único y privado, compartido entre gravedad y soft drop, no expuesto en el snapshot (ver §12).
- Reinicio determinista de toda la temporización horizontal y vertical al aparecer una nueva pieza y en `reset()` (ver §13).
- Ampliación de `MoveReason` con `'softDrop'` (ver §14.3).
- Adaptación de `apps/web` para que Phaser deje de decidir movimiento horizontal repetido, entregue `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld` al motor, y añada `ArrowDown` como tecla de soft drop, mantenida y traducida únicamente a `softDropHeld` (ver §15, §17.2).
- Pruebas del motor (TDD pragmático) y pruebas de integración del adaptador Phaser (ver §19).

## 7. Alcance explícitamente excluido

No pertenece a `0005`:

- Lock delay (`lockDelayMs`, `maxLockResets` siguen sin usarse en el motor; esta tarea no los activa).
- Puntuación por soft drop ni por ningún otro concepto. `softDropCellsPerSecond` no genera puntuación ni ninguna magnitud nueva.
- Remapeo de controles.
- Pausa.
- Hold.
- Ghost piece.
- Preview visual de próximas piezas (más allá del dato técnico `nextPiece` ya existente).
- Cambios de navegación, Vue Router, Pinia.
- Code splitting o cualquier reestructuración de build orientada a reducir el tamaño de chunk.
- Subida artificial del límite de aviso de tamaño de chunk de Vite/Rollup. El aviso de chunk superior a 500 kB, atribuible principalmente a Phaser (documentado como deuda técnica no bloqueante en el informe de `0004`), permanece sin resolver en esta tarea.
- Cambios visuales no necesarios para observar el nuevo comportamiento (no se rediseña el canvas, los colores ni el HUD de Vue más allá de lo estrictamente necesario, si acaso, para mostrar información ya prevista).
- Dependencias nuevas, salvo necesidad técnica imprescindible y justificada (no se anticipa ninguna: no se añade nada al `package.json` de ningún paquete en esta tarea).
- Refactors generales ajenos a esta tarea (por ejemplo, no se reescribe el renderizado de `GameScene.ts`, no se reestructura `create-phaser-game.ts`, no se tocan las tablas SRS ni la geometría de piezas).
- Cualquier funcionalidad prevista en `docs/rautfall.md` (energía, ataques, batalla, bot, backend, base de datos, audio) no listada en §6.

No se añade ninguna propiedad de configuración nueva en `game-config` para esta tarea: `dasMs`, `arrMs` y `softDropCellsPerSecond` ya existen y ya son válidos con los valores actuales de `prototypeConfig` (ver §4.2).

## 8. Contrato de entrada ampliado (`StepInput`)

### 8.1 Forma del contrato

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
```

- `leftHeld` / `rightHeld`: `true` si la tecla física correspondiente está mantenida pulsada en el instante lógico representado por este `step()`.
- `leftPressed` / `rightPressed`: `true` únicamente en el paso lógico en el que la tecla pasa de no pulsada a pulsada (flanco de bajada→presión). Es responsabilidad del adaptador de entrada (Phaser, §16) entregar el flanco una sola vez.
- `softDropHeld`: `true` si la tecla de soft drop está mantenida pulsada en este instante lógico. No existe `softDropPressed`: soft drop es una acción puramente de estado mantenido (ver §12.1).
- `hardDrop`, `rotateClockwise`, `rotateCounterclockwise`: sin cambios respecto del contrato existente (`hardDrop` obligatorio; los dos campos de rotación siguen siendo opcionales, con `false` implícito si están ausentes).

Los cinco campos nuevos (`leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld`) son obligatorios: no se aceptan ausentes ni `undefined`, sin coerción ni valores por defecto silenciosos, igual que `horizontal` y `hardDrop` en el contrato anterior.

### 8.2 Validación de entrada ampliada

La lista de claves permitidas (`allowedKeys`) se sustituye por:

```ts
['leftHeld', 'rightHeld', 'leftPressed', 'rightPressed', 'softDropHeld', 'hardDrop', 'rotateClockwise', 'rotateCounterclockwise']
```

`horizontal` deja de ser una clave permitida: un `step()` que la incluya se rechaza como propiedad desconocida.

Reglas de validación (todas antes de cualquier mutación, en el mismo `EngineStepError` con `code: 'INVALID_GAME_INPUT'` ya existente):

1. `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld`, `hardDrop` deben estar presentes y ser de tipo `boolean`.
2. `rotateClockwise` y `rotateCounterclockwise`, si están presentes, deben ser `boolean` (sin cambios respecto de `0003`).
3. **Inválido:** `leftPressed === true` con `leftHeld === false`.
4. **Inválido:** `rightPressed === true` con `rightHeld === false`.
5. **Inválido:** `leftPressed === true` y `rightPressed === true` en la misma entrada.
6. **Inválido:** `rotateClockwise === true` y `rotateCounterclockwise === true` en la misma entrada (regla existente de `0003`, sin cambios).
7. Propiedades desconocidas adicionales se rechazan (regla existente, sin cambios).

Nótese que `leftHeld === true` y `rightHeld === true` simultáneos **son válidos** (es la situación normal cuando el jugador mantiene ambas direcciones y una de ellas tiene prioridad, ver §9). Solo la combinación de ambos **flancos** (`leftPressed && rightPressed`) es inválida, porque el motor no puede determinar cuál de las dos se pulsó "más recientemente" dentro del mismo paso lógico.

Ante cualquier entrada inválida (cualquiera de las reglas anteriores, en cualquier estado del motor):

- se lanza `EngineStepError` con `code: 'INVALID_GAME_INPUT'` (o `code: 'ENGINE_NOT_RUNNING'` si el motor ya estaba en `gameOver`, con la misma precedencia ya establecida en `0002` §13: el estado del motor se comprueba antes que la forma de la entrada);
- no se incrementa `step`;
- no se incrementa `elapsedMs`;
- no se muta la pieza activa, el tablero, el PRNG, la bolsa, el acumulador vertical, la prioridad horizontal ni sus acumuladores de DAS/ARR;
- no se emite ningún evento.

### 8.3 Sustitución del campo `horizontal`

Esta tarea sustituye intencionadamente el campo `horizontal: -1 | 0 | 1` de `StepInput` (introducido en `0002` y sin cambios en `0003`/`0004`) por los cuatro campos booleanos `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`. No es una ampliación aditiva: `step({ horizontal: -1, hardDrop: false, ... })` deja de ser una entrada válida (propiedad desconocida `horizontal`, y además faltarían los campos obligatorios nuevos).

Las 103 pruebas existentes en `packages/game-engine/src/game-engine.test.ts` que construyen `StepInput` con `horizontal` deben reescribirse para usar el nuevo contrato. Esta reescritura es mecánica en la mayoría de los casos (un movimiento por pulsación única de `horizontal: -1`/`1` se expresa como `leftPressed`/`rightPressed: true` con `leftHeld`/`rightHeld: true` en ese mismo paso, y `false`/`false` en los pasos siguientes si no se repite la pulsación) y no cambia el comportamiento ya cubierto por esas pruebas (colisiones, límites, rotación, hard drop, gravedad, fijación, líneas, game over, snapshot, eventos, determinismo, reset): ese comportamiento permanece intacto, solo cambia la forma de construir la entrada. De igual modo, `apps/web/src/game/input-buffer.test.ts` debe reescribirse por completo (ver §16.4): la lógica que prueba (`horizontal` calculado en Phaser) desaparece del adaptador.

## 9. Prioridad horizontal

El motor mantiene un estado interno privado (no expuesto en el snapshot):

```ts
type HorizontalPriority = 'left' | 'right' | null;
// horizontalPriority: HorizontalPriority
// horizontalAccumulatorMs: number
// horizontalHasReachedDas: boolean
```

### 9.1 Resolución de la dirección efectiva en cada paso

En cada `step()` válido, antes de mover la pieza, el motor resuelve la dirección horizontal efectiva de este paso siguiendo, en este orden exacto, la primera regla que aplique:

1. Si `input.leftPressed === true`: **activar** `'left'` (ver §9.2). (No puede ocurrir simultáneamente con `rightPressed === true`; esa combinación ya fue rechazada en validación, §8.2.)
2. Si no, si `input.rightPressed === true`: **activar** `'right'`.
3. Si no, si `horizontalPriority === 'left'` y `input.leftHeld === false`:
   - si `input.rightHeld === true`: **activar** `'right'`;
   - si no: **limpiar** prioridad (`horizontalPriority = null`, reiniciar acumuladores, sin movimiento).
4. Si no, si `horizontalPriority === 'right'` y `input.rightHeld === false`:
   - si `input.leftHeld === true`: **activar** `'left'`;
   - si no: **limpiar** prioridad.
5. Si no, si `horizontalPriority === null`:
   - si `input.leftHeld === true` y `input.rightHeld === false`: **activar** `'left'`;
   - si `input.rightHeld === true` y `input.leftHeld === false`: **activar** `'right'`;
   - si no (ninguna mantenida, o ambas mantenidas simultáneamente sin flanco en este paso): no hacer nada (sin movimiento; la prioridad permanece `null`).
6. En cualquier otro caso (la prioridad actual sigue manteniéndose sin flanco de cambio): **continuar** la secuencia DAS/ARR ya en curso (ver §10).

**Activar** una dirección (`d`) significa, en este orden:

1. `horizontalPriority = d`.
2. `horizontalAccumulatorMs = 0`.
3. `horizontalHasReachedDas = false`.
4. Intentar un único movimiento inmediato de una celda en la dirección `d` (ver §11 para la semántica de bloqueo). Este es el único movimiento de este paso: no se procesan repeticiones DAS/ARR en el mismo paso en que se activa una dirección.

**Limpiar** prioridad significa: `horizontalPriority = null`, `horizontalAccumulatorMs = 0`, `horizontalHasReachedDas = false`, sin ningún intento de movimiento.

### 9.2 Justificación del caso "ambas mantenidas sin flanco, prioridad nula" (regla 5)

Si, tras un reinicio de estado temporal (nueva pieza o `reset()`, §13), ambas direcciones están físicamente mantenidas y ninguna produce un flanco de pulsación en el paso en que se evalúa por primera vez, no existe información para determinar cuál se pulsó "más recientemente": el motor no aplica ninguna prioridad arbitraria entre izquierda y derecha en ese instante. La prioridad permanece `null` y no hay movimiento hasta que:

- se detecte un flanco de pulsación en alguna dirección (regla 1 o 2 del §9.1), o
- se libere una de las dos direcciones manteniéndose la otra (lo cual, con prioridad `null`, no dispara la regla 3/4 —que exigen una prioridad activa previa—, sino que corresponde a la regla 5 en el siguiente paso, donde ya solo una está mantenida).

Esta regla es la única forma de que "ambas mantenidas" no produzca movimiento sin imponer una prioridad fija entre izquierda y derecha.

### 9.3 Regla general de prioridad

- La última dirección **pulsada** (flanco) tiene prioridad inmediata sobre la que ya estuviera mantenida, incluso si ambas continúan mantenidas después.
- Mientras ninguna nueva pulsación ocurra, la dirección activa continúa su secuencia DAS/ARR sin cambios, aunque la otra dirección esté también mantenida (su estado mantenido no tiene efecto mientras no se libere la prioritaria ni se produzca un nuevo flanco en ella).
- Al soltar la dirección con prioridad, si la otra sigue mantenida, esta última toma el control **en el siguiente paso lógico**, con activación inmediata (movimiento inmediato + reinicio de DAS/ARR), según la regla 3/4 del §9.1.
- Un cambio efectivo de dirección (activación) siempre reinicia `horizontalAccumulatorMs` a `0` y `horizontalHasReachedDas` a `false`, sin excepción.

## 10. DAS y ARR

Cuando la regla del §9.1 determina que se debe **continuar** la secuencia ya en curso (la misma dirección sigue teniendo prioridad y no hubo activación en este paso), se ejecuta:

```text
horizontalAccumulatorMs += fixedStepMs

si !horizontalHasReachedDas y horizontalAccumulatorMs >= dasMs:
    horizontalAccumulatorMs -= dasMs
    horizontalHasReachedDas = true
    intentarMovimiento(horizontalPriority)   // primera repetición

si horizontalHasReachedDas:
    mientras horizontalAccumulatorMs >= arrMs:
        horizontalAccumulatorMs -= arrMs
        intentarMovimiento(horizontalPriority)   // repeticiones siguientes
```

`intentarMovimiento(direction)` intenta desplazar la pieza activa una celda en `direction` (`-1` para `'left'`, `+1` para `'right'`), aplicando la misma comprobación de colisión que el movimiento por pulsación única ya existente (`isCollision`). Si la posición resultante es válida, actualiza la coordenada `x` de la pieza y emite `pieceMoved` con motivo `'horizontal'`. Si colisiona, no muta nada y no emite evento (ver §11 para las consecuencias exactas del bloqueo).

### 10.1 Semántica exacta

- La pulsación/activación inicial mueve una celda de inmediato (§9.1, paso "activar").
- Tras la activación, se espera exactamente `dasMs` de tiempo lógico acumulado antes de la primera repetición.
- La primera repetición ocurre exactamente al alcanzar `horizontalAccumulatorMs >= dasMs` (umbral exacto, no una comparación de "superar").
- Las repeticiones siguientes ocurren cada `arrMs` de tiempo lógico acumulado desde la anterior.
- Pueden producirse varias repeticiones en un mismo paso lógico si el tiempo acumulado lo permite (el bucle `mientras` del pseudocódigo anterior).
- Toda la lógica usa exclusivamente tiempo lógico (`fixedStepMs` acumulado) y los valores de configuración `dasMs`/`arrMs`; no se usan temporizadores reales, `Date.now()` ni `performance.now()`.
- No se implementa semántica especial para `arrMs = 0`; `prototypeConfig.arrMs` vale `50` (positivo) y esta tarea no introduce ninguna rama de código específica para el caso `arrMs === 0`.

### 10.2 Ejemplo numérico (con `prototypeConfig`: `fixedStepMs = 10`, `dasMs = 150`, `arrMs = 50`)

Suponiendo que la dirección izquierda se mantiene pulsada desde `t = 0` sin soltarse ni cambiar de prioridad:

| Tiempo lógico (`elapsedMs`) | Evento |
| ---: | --- |
| `t = 0` | Activación: movimiento inmediato (1ª celda) |
| `t = 150` | `horizontalAccumulatorMs` alcanza `150 (dasMs)`: primera repetición (2ª celda) |
| `t = 200` | `horizontalAccumulatorMs` alcanza `50 (arrMs)` desde la repetición anterior: repetición (3ª celda) |
| `t = 250` | Repetición (4ª celda) |
| `t = 300, 350, …` | Una repetición cada 50 ms mientras la tecla siga mantenida y no colisione |

Este ejemplo usa los valores reales de `prototypeConfig`; no son valores de diseño nuevos de esta tarea.

## 11. Movimiento horizontal bloqueado

Cuando un intento de movimiento horizontal —por activación inmediata, por alcanzar `dasMs`, o por alcanzar `arrMs`— colisiona (`isCollision` devuelve `true` para la posición candidata):

- no se mueve la pieza (coordenada `x` sin cambios);
- no se emite `pieceMoved`;
- **no se reinicia** `horizontalAccumulatorMs` ni `horizontalHasReachedDas` por causa del bloqueo (ya fueron actualizados por la lógica de §10 antes de intentar el movimiento, y esa actualización se conserva igual si el intento falla);
- no queda ningún movimiento pendiente ni en cola: el intento fallido se descarta por completo, no se reintenta más tarde "recuperando" el tiempo;
- el intervalo correspondiente (`dasMs` o `arrMs`) se considera consumido con normalidad: el bucle de §10 continúa evaluando el siguiente umbral con el acumulador ya descontado, exactamente igual que si el movimiento hubiera tenido éxito.

Mientras la tecla siga mantenida (sin nuevo flanco ni cambio de prioridad), los intentos futuros se producen según la cadencia normal de ARR (`arrMs`), aunque el intento que alcanzó el umbral de `dasMs` haya sido el que colisionó (ese intento fallido consume igualmente el umbral de `dasMs` y `horizontalHasReachedDas` pasa a `true`, de modo que los siguientes intentos usan `arrMs`).

Si una rotación posterior en el mismo o en un paso siguiente libera espacio (por ejemplo, la pieza gira y dejan de colisionar las celdas hacia el lado bloqueado), esto **no** produce un movimiento horizontal inmediato: el movimiento horizontal se procesa antes que la rotación en el orden del paso (§14), así que una rotación en el paso `N` no puede retroactivamente producir un movimiento horizontal en ese mismo paso `N`. El siguiente movimiento en esa dirección ocurrirá en el paso en que corresponda según la cadencia ARR ya en curso, o en un nuevo cambio de dirección.

## 12. Soft drop y acumulador vertical

### 12.1 Soft drop

- Soft drop es una acción **mantenida** (`input.softDropHeld`), no de pulsación única. No existe `softDropPressed` en el contrato.
- No hay descenso inmediato al activarse `softDropHeld` en un paso concreto (a diferencia de la activación horizontal, que sí produce un movimiento inmediato): el soft drop simplemente cambia, desde ese paso, la velocidad vertical activa que alimenta el acumulador compartido de §12.2.
- Mientras `softDropHeld === true`, la velocidad vertical activa es `config.softDropCellsPerSecond`, en sustitución completa de `config.gravityCellsPerSecond` (no se suman ambas).
- Al pasar `softDropHeld` a `false`, la velocidad vertical activa vuelve a ser `config.gravityCellsPerSecond` desde ese mismo paso.
- El soft drop no genera puntuación ni ninguna magnitud nueva en esta tarea (no existe todavía ningún concepto de puntuación en el motor).
- Cada descenso real producido con `softDropHeld === true` emite `pieceMoved` con motivo `'softDrop'` (ver §14.3). Cada descenso real producido con `softDropHeld === false` sigue emitiendo `pieceMoved` con motivo `'gravity'`, sin cambios respecto del comportamiento existente.
- Soft drop no tiene efecto si `input.hardDrop === true` en el mismo paso: el hard drop domina, exactamente igual que domina hoy sobre la gravedad normal (§4.1, §14).

### 12.2 Acumulador vertical único

El motor sustituye el acumulador `gravityAccumulatorMs` existente (basado en milisegundos acumulados contra un umbral `msPerCell = 1000 / cellsPerSecond`) por un único acumulador de **progreso vertical**, privado, compartido entre gravedad y soft drop, no expuesto en `EngineSnapshot`:

```ts
// verticalProgress: number   (progreso acumulado hacia el siguiente descenso; 1000 = una celda completa)
```

En cada paso lógico en el que se procesa la fase vertical (es decir, `input.hardDrop === false` y hay pieza activa):

```text
activeCellsPerSecond = input.softDropHeld ? config.softDropCellsPerSecond : config.gravityCellsPerSecond
verticalProgress += fixedStepMs * activeCellsPerSecond

mientras verticalProgress >= 1000:
    intentar descender la pieza una celda
    si el descenso tiene éxito:
        verticalProgress -= 1000
        emitir pieceMoved con motivo 'gravity' si !softDropHeld, o 'softDrop' si softDropHeld
    si el descenso falla (colisión):
        fijar la pieza inmediatamente (misma secuencia de fijación de 0002 §18)
        eliminar líneas completas si las hay
        generar la siguiente pieza (o game over por spawnBlocked)
        detener el procesamiento vertical de este paso (no se evalúan más umbrales de 1000)
```

Justificación de las unidades: con `gravityCellsPerSecond = 1` y `fixedStepMs = 10`, cada paso acumula `10 * 1 = 10` unidades; alcanzar `1000` unidades requiere `100` pasos, es decir `1000 ms`, coherente con "1 celda por segundo". Con `softDropCellsPerSecond = 20`, cada paso acumula `10 * 20 = 200` unidades; alcanzar `1000` requiere `5` pasos, es decir `50 ms`, coherente con "20 celdas por segundo". Esta forma de acumular (en unidades de progreso, no en milisegundos contra un umbral variable por velocidad) es la que permite conservar el progreso exactamente al cambiar de velocidad (§12.3) sin ninguna conversión.

Pueden producirse varios descensos en el mismo paso lógico si `verticalProgress` acumulado lo permite (mismo principio que la gravedad de `0002`, ahora expresado en unidades de progreso en vez de milisegundos).

### 12.3 Conservación del progreso al cambiar de velocidad

- Activar o desactivar `softDropHeld` **no reinicia** `verticalProgress`.
- El progreso ya acumulado se conserva íntegramente; únicamente cambia, desde el paso en que cambia `softDropHeld`, la cantidad que se añade a `verticalProgress` en cada paso siguiente (`fixedStepMs * activeCellsPerSecond`, con el nuevo `activeCellsPerSecond`).
- Ejemplo: con gravedad normal (`gravityCellsPerSecond = 1`) acumulados `600` de los `1000` necesarios (60 % del progreso hacia la siguiente celda) y el jugador activa soft drop (`softDropCellsPerSecond = 20`) en el paso siguiente: ese paso suma `10 * 20 = 200`, quedando `verticalProgress = 800`; el paso siguiente suma otros `200` y alcanza `1000`, produciendo el descenso con motivo `'softDrop'`. El progreso previo de gravedad no se descarta ni se recalcula: simplemente se le sigue sumando con la nueva velocidad.
- No se usan temporizadores reales. No se depende de que `dasMs`, `arrMs`, `gravityCellsPerSecond` o `softDropCellsPerSecond` sean múltiplos exactos de `fixedStepMs` para que el comportamiento sea determinista (la divisibilidad de `dasMs`/`arrMs` entre `fixedStepMs` ya la exige `parseGameConfig`, ver §4.2, pero el acumulador de progreso vertical funciona igualmente con velocidades no alineadas).

## 13. Reinicio de estado temporal

Al generarse una nueva pieza activa, por cualquier causa (fijación por gravedad, fijación por soft drop, o hard drop, es decir, cada vez que se ejecuta `spawnNextPiece` o la generación inicial de piezas):

- `horizontalPriority = null`;
- `horizontalAccumulatorMs = 0`;
- `horizontalHasReachedDas = false`;
- `verticalProgress = 0`.

La nueva pieza no hereda ninguna repetición horizontal en curso ni progreso vertical de la pieza anterior.

Si, en el paso lógico siguiente a la aparición de la nueva pieza, una dirección horizontal continúa físicamente mantenida (`leftHeld` o `rightHeld` en `true`, sin flanco `Pressed` porque la tecla nunca se soltó), esa dirección se trata como una **nueva activación efectiva** según la regla 5 del §9.1 (prioridad `null` con exactamente una dirección mantenida): produce movimiento inmediato e inicia una secuencia DAS nueva. Si ambas continúan mantenidas sin flanco, se aplica la regla 5 completa (§9.2): ninguna se activa hasta que exista un flanco o se libere una de las dos.

Si `softDropHeld` continúa mantenido tras la aparición de la nueva pieza, esta parte con `verticalProgress = 0` y comienza a acumular con `softDropCellsPerSecond` desde el paso lógico siguiente (no hay ningún descenso inmediato asociado a soft drop, igual que en cualquier otro paso, ver §12.1).

Tras un hard drop o una fijación por gravedad/soft drop que generan una nueva pieza: no se procesa entrada adicional sobre la nueva pieza durante ese mismo `step()` (ya es el comportamiento existente del motor: el `return`/`break` tras `spawnNextPiece` termina el procesamiento de ese `step()`; esta tarea no lo modifica, solo lo reafirma explícitamente para el estado temporal horizontal y vertical).

### 13.1 `reset()`

`reset()` reinicia todo el estado temporal de esta tarea, con la misma secuencia ya definida en `0002` §23, añadiendo:

- `horizontalPriority = null`;
- `horizontalAccumulatorMs = 0`;
- `horizontalHasReachedDas = false`;
- `verticalProgress = 0`.

El adaptador Phaser debe, al invocar el reinicio (tecla `R` o `PhaserGameController.reset()`), limpiar también sus propios flancos pendientes (ver §16.5): no se reutiliza ninguna pulsación anterior al reset para producir un flanco `Pressed` después de reiniciar.

## 14. Orden del paso lógico

El orden lógico general ya establecido en `0002` §14 y ampliado en `0003` §13 se mantiene; esta tarea detalla los pasos 5 y 8 (movimiento horizontal y procesamiento vertical) sin reordenar el resto:

1. Comprobar estado del motor (`ENGINE_NOT_RUNNING` si `gameOver`).
2. Validar entrada (`INVALID_GAME_INPUT` si no cumple el contrato, ver §8.2).
3. Incrementar contador de paso (`currentStep += 1`).
4. Incrementar tiempo lógico (`currentElapsedMs += fixedStepMs`).
5. **Movimiento horizontal.** Resolver la dirección efectiva (§9.1) y ejecutar los movimientos debidos: activación inmediata, o continuación de DAS/ARR (§10), con las reglas de bloqueo del §11.
6. Rotación (sin cambios respecto de `0003`).
7. Hard drop, si `input.hardDrop === true` (sin cambios de comportamiento respecto de `0002`/`0003`: domina sobre el procesamiento vertical del paso 8, un único `pieceMoved` con motivo `'hardDrop'` si la distancia es `>= 1`, fijación inmediata, `return` tras completar fijación/líneas/spawn).
8. Si no hubo hard drop: procesar el acumulador vertical único (§12.2), que decide gravedad o soft drop según `input.softDropHeld`, pudiendo producir varios descensos, y fijando la pieza si un descenso falla.
9. Fijación, eliminación de líneas, spawn de la siguiente pieza y game over, cuando corresponda (secuencia ya existente de `0002` §14/§18/§19/§20, sin cambios).
10. Los eventos generados se encolan en el orden real de ejecución y quedan disponibles para `drainEvents()`.

Consecuencias explícitas (todas ya se derivan del orden anterior, se listan para evitar ambigüedad):

- El movimiento horizontal (incluidas sus repeticiones DAS/ARR) se procesa antes que la rotación.
- La rotación se procesa antes que el hard drop.
- El hard drop domina completamente sobre el descenso vertical (gravedad o soft drop) del mismo paso.
- Un intento de movimiento horizontal o vertical bloqueado no impide que se procesen los pasos posteriores del mismo `step()` (rotación, hard drop, etc. continúan evaluándose con normalidad).
- Si en el paso se fija una pieza (por hard drop o por fallo del descenso vertical) y se genera una nueva pieza activa, no se procesa ninguna entrada adicional sobre esa nueva pieza dentro del mismo `step()`.

## 15. Snapshot

`EngineSnapshot` y `ActivePieceSnapshot` **no cambian** en esta tarea: no se añade ningún campo nuevo. En particular:

- `horizontalPriority`, `horizontalAccumulatorMs`, `horizontalHasReachedDas` y `verticalProgress` son estado interno privado y **no** se exponen en `getSnapshot()`.
- El snapshot sigue siendo inmutable (`Object.freeze` profundo), igual que en `0002`/`0003`.

## 16. Eventos

### 16.1 `MoveReason`

```ts
type MoveReason = 'horizontal' | 'gravity' | 'hardDrop' | 'softDrop';
```

Se añade `'softDrop'` como único cambio a este tipo.

### 16.2 Reglas de eventos

- Cada desplazamiento horizontal real de una celda (por activación inmediata, por alcanzar `dasMs`, o por alcanzar `arrMs`) emite un `pieceMoved` con motivo `'horizontal'`. No se distingue públicamente entre pulsación inmediata, repetición por DAS o repetición por ARR: las tres usan el mismo motivo `'horizontal'`, igual que ya ocurre en el contrato existente.
- Cada descenso vertical real de una celda con `softDropHeld === true` emite `pieceMoved` con motivo `'softDrop'`.
- Cada descenso vertical real de una celda con `softDropHeld === false` sigue emitiendo `pieceMoved` con motivo `'gravity'` (sin cambios).
- Si un paso produce varios movimientos (varias repeticiones ARR en el mismo paso, o varios descensos verticales en el mismo paso), se emite un evento `pieceMoved` por cada celda, y todos comparten el mismo número de `step` (el `currentStep` de ese `step()`), en el orden real en que ocurrieron.
- Los intentos bloqueados (colisión en horizontal, o fallo del descenso vertical más allá del que produce la fijación) no emiten `pieceMoved`.
- El hard drop conserva su semántica actual: un único `pieceMoved` con motivo `'hardDrop'` si la distancia de descenso es `>= 1`, sin eventos por celda intermedia, sin cambios respecto de `0002`.

## 17. Compatibilidad y responsabilidades

### 17.1 `game-engine`

- Mantiene toda la temporización: DAS, ARR, gravedad y soft drop se deciden exclusivamente dentro de `packages/game-engine`.
- Mantiene la prioridad horizontal y los acumuladores (horizontal y vertical) como estado interno privado.
- Decide todos los movimientos (cuántos, cuándo y con qué motivo).
- Permanece independiente de Phaser, Vue, DOM y tiempo real (sin cambios respecto de las decisiones arquitectónicas ya vigentes).

### 17.2 Phaser (`apps/web`)

- Observa el estado físico del teclado y construye `StepInput` con `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld` (además de `hardDrop`/`rotateClockwise`/`rotateCounterclockwise`, sin cambios en estos tres).
- **Decisión cerrada de teclado:** `ArrowDown` es la tecla de soft drop. Su comportamiento es mantenido (no de flanco): Phaser traduce únicamente su estado físico (`isDown`) a `softDropHeld`, sin ningún equivalente a `softDropPressed`. `ArrowDown` evita su comportamiento por defecto del navegador mientras el canvas tiene el foco, igual que `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` (§4.3). No se introduce remapeo de controles ni se modifican los controles ya existentes de movimiento horizontal (`ArrowLeft`/`ArrowRight`), rotaciones (`ArrowUp`/`Z`), hard drop (`Space`) ni reset (`R`).
- Conserva flancos de pulsación pendientes y entrega cada flanco (`leftPressed`/`rightPressed`/`rotateClockwise`/`rotateCounterclockwise`/`hardDrop`) una sola vez, en el primer paso lógico disponible tras la pulsación física, cuando el adaptador de tiempo (`computeSteps`) ejecuta más de un paso lógico en el mismo frame.
- Mantiene `Held` en los pasos posteriores mientras la tecla física continúe pulsada. `softDropHeld` no participa de este mecanismo de flanco/consumo: al no haber pulsación única que consumir, se reporta igual en todos los pasos lógicos de un mismo frame.
- No calcula DAS. No calcula ARR. No calcula velocidades de soft drop. No decide movimientos horizontales repetidos ni descensos repetidos (ni de gravedad ni de soft drop): toda esa decisión llega ya resuelta como eventos y snapshots del motor; `game-engine` sigue siendo el único responsable de decidir cuándo ocurre cada descenso.

### 17.3 Vue (`apps/web`)

- Continúa como contenedor: navegación, ayuda de controles, resumen de estado (`GamePresentationState`), botón de reset.
- No asume ninguna regla de DAS, ARR o soft drop: sigue sin recibir `board`, `activePiece`, `nextPiece` ni ningún estado interno del motor (sin cambios respecto de `0004`).

### 17.4 Compatibilidad con tareas anteriores

- Rotación (SRS, `0003`): sin cambios de comportamiento. Una rotación exitosa sigue emitiendo `pieceRotated`; el orden horizontal → rotación → hard drop/vertical se mantiene (§14).
- Hard drop (`0002`): sin cambios de comportamiento; sigue dominando sobre el procesamiento vertical del mismo paso.
- Gravedad (`0002`): su comportamiento observable (motivo `'gravity'`, velocidad `gravityCellsPerSecond` cuando `softDropHeld === false`) se conserva; su implementación interna cambia (acumulador de progreso en vez de acumulador de milisegundos, ver §12.2), pero el resultado observable para `gravityCellsPerSecond = 1` y `fixedStepMs = 10` es idéntico al de `0002`/`0003`/`0004`.
- Reset (`0002`): conserva su secuencia y eventos (`engineReset` único, sin `engineStarted` ni `pieceSpawned`), ampliada con el reinicio del nuevo estado temporal (§13.1).

## 18. Dependencias

No se añade ninguna dependencia nueva en ningún paquete (`packages/game-engine`, `packages/game-config`, `apps/web`) para esta tarea. No se modifica `pnpm-lock.yaml`.

## 19. Estrategia de pruebas requerida

Aplicar TDD pragmático en `packages/game-engine` (lógica de dominio, determinismo) y pruebas de integración de valor real en `apps/web` (adaptador de entrada Phaser). Como mínimo:

### 19.1 Entrada y atomicidad

- `leftPressed: true` con `leftHeld: false` es rechazado con `INVALID_GAME_INPUT`.
- `rightPressed: true` con `rightHeld: false` es rechazado con `INVALID_GAME_INPUT`.
- `leftPressed: true` y `rightPressed: true` simultáneos son rechazados con `INVALID_GAME_INPUT`.
- `rotateClockwise: true` y `rotateCounterclockwise: true` simultáneos siguen siendo rechazados (regresión de `0003`).
- Una entrada inválida no muta `step`, `elapsedMs`, la pieza activa, el tablero, el PRNG, la bolsa, la prioridad horizontal, sus acumuladores, ni el acumulador vertical.
- `step({ horizontal: -1, hardDrop: false, ... })` es rechazado (propiedad desconocida `horizontal`).

### 19.2 Pulsación inmediata

- `leftPressed: true` con `leftHeld: true` mueve la pieza una celda a la izquierda de inmediato.
- `rightPressed: true` con `rightHeld: true` mueve la pieza una celda a la derecha de inmediato.
- Una nueva pulsación en la dirección contraria a la que tenía prioridad cambia la prioridad de inmediato y mueve en la nueva dirección ese mismo paso.
- Soltar la dirección con prioridad (pasa a `Held: false` sin `Pressed`) mientras la otra sigue mantenida activa esta última de inmediato en el paso siguiente (movimiento + reinicio de DAS).

### 19.3 DAS

- No se repite ningún movimiento antes de alcanzar `dasMs` de tiempo acumulado tras la activación.
- La primera repetición ocurre exactamente al alcanzar `dasMs` (umbral exacto).
- Un cambio de dirección reinicia el acumulador DAS y su bandera de "ya alcanzado".
- Soltar y volver a pulsar la misma dirección reinicia la secuencia DAS (nueva activación).
- Una nueva pieza no hereda ningún progreso DAS de la anterior.

### 19.4 ARR

- Tras alcanzar `dasMs`, las repeticiones siguientes ocurren cada `arrMs` exactos.
- Pueden producirse varias repeticiones en un mismo paso lógico cuando `fixedStepMs` es suficientemente grande respecto de `arrMs` (usar una configuración de prueba con esa relación, sin modificar `prototypeConfig`).
- Un intento bloqueado durante ARR no acumula una ráfaga de movimientos pendientes: al liberarse el bloqueo, el siguiente movimiento ocurre en el intervalo ARR que corresponda, no de inmediato.
- Una rotación que libera espacio en un paso no provoca un movimiento horizontal inmediato en ese mismo paso.
- Tras un bloqueo, la reanudación de movimientos ocurre en el siguiente intervalo ARR normal.

### 19.5 Soft drop

- `softDropHeld: true` no produce ningún descenso inmediato en el paso en que se activa.
- El descenso con `softDropHeld: true` usa exactamente `softDropCellsPerSecond` (verificar el número de pasos necesarios para un descenso con los valores de `prototypeConfig`: 5 pasos de `10 ms`).
- Con `softDropHeld: true`, no se aplica adicionalmente `gravityCellsPerSecond` (las velocidades no se suman).
- Pueden producirse varios descensos de soft drop en un mismo paso cuando el progreso acumulado lo permite.
- Cada descenso real de soft drop emite `pieceMoved` con motivo `'softDrop'`.
- Un intento de descenso de soft drop bloqueado fija la pieza inmediatamente (igual que un fallo de gravedad).
- Soft drop no añade puntuación ni ningún campo de puntuación al snapshot.

### 19.6 Acumulador vertical

- El progreso vertical se conserva al activar soft drop a mitad de una celda de gravedad (no se pierde ni se recalcula el progreso ya acumulado).
- El progreso vertical se conserva simétricamente al desactivar soft drop.
- El acumulador funciona de forma determinista con velocidades no alineadas exactamente con `fixedStepMs`.
- El acumulador se reinicia a `0` al aparecer una nueva pieza.
- El acumulador no traslada ningún remanente de una pieza a la siguiente.
- El acumulador se reinicia a `0` en `reset()`.

### 19.7 Interacciones

- Movimiento horizontal y rotación en el mismo paso lógico (ambos deben aplicarse correctamente, en ese orden).
- Rotación seguida de hard drop en el mismo paso.
- Movimiento horizontal, rotación y soft drop combinados en el mismo paso.
- Hard drop en un paso con `softDropHeld: true` omite por completo el procesamiento vertical de soft drop y de gravedad (el hard drop domina).
- Tras una fijación (por hard drop, gravedad o soft drop) que genera una nueva pieza, no se procesa ninguna entrada adicional sobre esa nueva pieza en el mismo `step()`.
- Compatibilidad con game over (`spawnBlocked`) y con `reset()`: el nuevo estado temporal se reinicia correctamente en ambos casos.

### 19.8 Adaptador Phaser (`apps/web`)

- Un flanco horizontal (`leftPressed`/`rightPressed`) se entrega al motor una sola vez, en el primer paso lógico disponible, aunque el adaptador de tiempo ejecute varios pasos lógicos en el mismo frame.
- Varios pasos lógicos ejecutados en un mismo frame no duplican el flanco: los pasos posteriores al primero del frame reciben `leftPressed`/`rightPressed: false` (pero conservan `leftHeld`/`rightHeld` reales).
- El estado mantenido (`leftHeld`/`rightHeld`/`softDropHeld`) persiste sin cambios en todos los pasos lógicos de un mismo frame.
- `ArrowDown` mantenido produce `softDropHeld: true` en todos los pasos lógicos correspondientes, sin flanco asociado (no existe `softDropPressed`); al soltarlo, `softDropHeld` pasa a `false` en el siguiente paso lógico. No hay lógica de consumo/flanco para esta tecla.
- El reinicio (tecla `R` o controlador) limpia cualquier flanco pendiente en el adaptador: no se reutiliza una pulsación anterior al reset.
- `apps/web/src/game/input-buffer.ts` (o el módulo que lo sustituya con la misma responsabilidad) no contiene referencias a `dasMs`, `arrMs`, `softDropCellsPerSecond` ni ningún cálculo de repetición, temporización o velocidad de descenso: esa lógica vive exclusivamente en `packages/game-engine`.

### 19.9 Eventos

- Un evento `pieceMoved` con motivo `'horizontal'` por cada celda de movimiento horizontal real (inmediato, DAS o ARR).
- Un evento `pieceMoved` con motivo `'softDrop'` por cada celda de descenso real con soft drop activo.
- El orden de los eventos es correcto cuando un mismo paso produce varios movimientos (por ejemplo, una repetición ARR seguida de un descenso de soft drop en el mismo paso).
- Ningún evento se emite por movimientos bloqueados (ni horizontales ni verticales, salvo el `pieceLocked`/`linesCleared`/`pieceSpawned`/`gameOver` que corresponda cuando el descenso vertical falla).

### 19.10 Determinismo

- Misma semilla, misma configuración y misma secuencia de entradas (incluyendo `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld`) producen snapshots y eventos idénticos.
- El resultado no depende de cómo el adaptador de tiempo de Phaser agrupe los pasos lógicos dentro de los frames gráficos: la misma secuencia de `step()` con las mismas entradas produce el mismo resultado sea cual sea el reparto de esos `step()` entre frames.

Estas pruebas deben verificar comportamiento observable, invariantes y contratos, sin depender innecesariamente de detalles internos (nombres exactos de las variables de estado privado, por ejemplo, no deben aparecer en aserciones de test).

## 20. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Todos deben finalizar correctamente. El aviso de Vite/Rollup sobre un chunk superior a 500 kB (atribuible principalmente a Phaser, documentado como deuda técnica en el informe de `0004`) puede continuar apareciendo y no bloquea esta tarea; no se resuelve mediante límites artificiales de tamaño ni mediante code splitting sin una frontera real de navegación (§7).

Además, revisar:

- No existen imports profundos entre paquetes.
- No se han añadido dependencias no justificadas.
- No existe código muerto (en particular, ninguna referencia residual al campo `horizontal` de `StepInput`, ni a `gravityAccumulatorMs` si se sustituye por completo por `verticalProgress`).
- No hay abstracciones innecesarias ni arquitectura preventiva para tareas futuras (lock delay, puntuación, hold, ghost piece).
- No se ha ampliado el alcance más allá de §6.
- No hay errores ni avisos de lint ignorados.
- Validación manual en `apps/web` (`pnpm dev`): mantener izquierda/derecha produce movimiento repetido con la cadencia esperada; mantener la tecla de soft drop acelera el descenso; soltar cualquiera de las dos vuelve al comportamiento normal; rotación, hard drop, gravedad y reset siguen funcionando como en `0004`.

## 21. Documentación y cierre futuro

Este documento ([docs/tasks/0005-das-arr-soft-drop.md](0005-das-arr-soft-drop.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá:

- crear [docs/implementation/0005-das-arr-soft-drop.md](../implementation/0005-das-arr-soft-drop.md) como informe de implementación independiente, con resumen, archivos creados y modificados, decisiones de bajo nivel, API pública producida, pruebas añadidas, comandos ejecutados y resultados, desviaciones respecto de esta especificación (si las hubo), trabajo pendiente, y confirmación explícita del alcance excluido (§7);
- actualizar [docs/project-status.md](../project-status.md): estado de `0005` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, corrección de la previsión de título anticipada («Prototipo vertical Tactical») por el contenido real de esta tarea, y propuesta de siguiente tarea (sin asumir automáticamente su alcance).

Esta especificación no crea esos documentos ahora.

## 22. Criterios de aceptación

### Contrato público

- `StepInput` expone `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld` (obligatorios) y conserva `hardDrop` (obligatorio), `rotateClockwise`/`rotateCounterclockwise` (opcionales), sin el campo `horizontal`.
- `MoveReason` incluye `'softDrop'` además de los tres motivos existentes.
- `EngineSnapshot` y `ActivePieceSnapshot` no ganan ningún campo nuevo.

### Validación

- Las cuatro combinaciones inválidas del §8.2 (pressed sin held por cada lado, y ambos pressed a la vez) se rechazan con `INVALID_GAME_INPUT` sin mutar el motor.
- La regla existente de rotaciones simultáneas sigue vigente.
- `step({ horizontal: ... })` se rechaza por propiedad desconocida.

### DAS

- La activación produce movimiento inmediato de una celda.
- La primera repetición ocurre exactamente a `dasMs`.
- Un cambio de dirección o una liberación seguida de nueva pulsación reinicia la secuencia DAS.

### ARR

- Las repeticiones tras la primera ocurren exactamente cada `arrMs`.
- Varias repeticiones pueden ocurrir en un mismo paso lógico cuando el tiempo acumulado lo permite.
- Un bloqueo no genera ráfagas al liberarse ni pierde la cadencia ARR normal.

### Soft drop

- No hay descenso inmediato al activarlo.
- La velocidad efectiva es exactamente `softDropCellsPerSecond`, sin sumarse a la gravedad.
- Los descensos de soft drop emiten `pieceMoved` con motivo `'softDrop'`.
- Un intento bloqueado de soft drop fija la pieza inmediatamente.

### Eventos

- Un evento por cada celda de movimiento horizontal real y por cada celda de descenso real (gravedad o soft drop), con el orden real de ejecución preservado dentro del mismo `step`.
- Ningún evento por intentos bloqueados.

### Determinismo

- Misma semilla, configuración y secuencia de `StepInput` producen snapshots y eventos idénticos, con independencia de cómo Phaser agrupe los pasos lógicos entre frames.

### Integración Phaser

- Phaser entrega `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld` sin decidir movimientos repetidos ni velocidades.
- `ArrowDown` es la tecla de soft drop, traducida únicamente a `softDropHeld` (estado mantenido, sin flanco), sin que Phaser calcule descensos, temporización, repetición ni velocidad.
- No se ha introducido remapeo de controles ni se han modificado los controles ya existentes de movimiento horizontal, rotaciones, hard drop o reset.
- Un flanco se entrega una sola vez por pulsación física, incluso con varios pasos lógicos por frame.
- El reset limpia los flancos pendientes del adaptador.
- Ninguna referencia a `dasMs`, `arrMs` o `softDropCellsPerSecond` aparece en el código de `apps/web`.

### Ausencia de alcance excluido

- No existe lock delay, puntuación por soft drop, remapeo de controles, pausa, hold, ghost piece, preview visual nuevo, cambios de navegación, code splitting, ni subida del límite de aviso de chunk.
- No se añadió ninguna dependencia nueva.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

### Puertas de calidad

- `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan correctamente.
- El aviso de chunk de Phaser puede continuar sin bloquear la tarea.

## 23. Próxima tarea

A definir en su propia especificación tras completar `0005`. Esta especificación no prejuzga su contenido ni asume que corresponda al «Prototipo vertical Tactical» mencionado previamente en `docs/project-status.md` (ver aviso en «Estado»).
