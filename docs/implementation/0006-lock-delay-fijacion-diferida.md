# 0006 — Lock delay y fijación diferida (Informe de implementación)

## Resumen

Se ha implementado el lock delay determinista en `packages/game-engine`, sustituyendo la fijación inmediata por gravedad o soft drop por un temporizador lógico gobernado por `config.lockDelayMs` y `config.maxLockResets`. La fijación por hard drop continúa siendo inmediata.

## Estado inicial del repositorio

- Working tree limpio.
- 231 tests en verde.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` correctos.

## Archivos inspeccionados

- `AGENTS.md`
- `docs/tasks/0006-lock-delay-fijacion-diferida.md`
- `docs/tasks/0005-das-arr-soft-drop.md`
- `docs/tasks/0004-integracion-phaser.md`
- `docs/tasks/0003-rotacion-srs.md`
- `docs/tasks/0002-motor-de-juego-determinista.md`
- `docs/implementation/0005-das-arr-soft-drop.md`
- `docs/implementation/0004-integracion-phaser.md`
- `docs/project-status.md`
- `packages/game-config/src/index.ts`
- `packages/game-engine/src/index.ts`
- `packages/game-engine/src/game-engine.test.ts`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/src/game/input-buffer.ts`
- `apps/web/src/game/input-debug.ts`
- `apps/web/src/game/types.ts`
- `apps/web/src/game/coordinates.ts`

## Archivos modificados y creados

### Modificados

- `packages/game-engine/src/index.ts` — Implementación del lock delay.
- `packages/game-engine/src/game-engine.test.ts` — Adaptación del test de soft drop existente + 34 nuevos tests de lock delay.

### Creados

- `docs/implementation/0006-lock-delay-fijacion-diferida.md` — Este informe.

### No modificados

- `packages/game-config/src/index.ts` — Sin cambios (ni nombres, ni valores, ni validación).
- `apps/web/*` — Sin cambios. La ampliación de `ActivePieceSnapshot` es compatible hacia atrás.

## Diseño implementado

### Estado interno

Dos variables privadas en el closure de `createGameEngine`:

- `lockDelayElapsedMs: number` — tiempo lógico acumulado apoyado (inicia a 0, reinicia en spawn/reset).
- `lockResetsUsed: number` — reinicios consumidos por la pieza activa (inicia a 0, reinicia en spawn/reset).

No se introdujeron objetos, clases ni abstracciones adicionales.

### Función auxiliar `isGrounded`

Función pura que determina si la pieza activa no puede descender una fila: evalúa colisión en `y + 1`. Se usa tanto para la comprobación local por acción (movimiento/rotación) como para la comprobación final del paso.

### Orden de resolución del paso

El orden definido en la especificación se implementa en `processStep`:

1. `processHorizontal` — cada movimiento real ejecuta la evaluación de reinicio (código inline en `tryMoveHorizontal`).
2. Rotación — cada rotación real ejecuta la evaluación de reinicio (código inline en el bloque de rotación de `processStep`).
3. Hard drop — fijación inmediata incondicional (sin cambios).
4. `processVertical` — gravedad/soft drop: intentos bloqueados ya no fijan; consumen la unidad de progreso.
5. Detección final de apoyo y avance del temporizador.
6. Fijación por expiración, eliminación de líneas y spawn.

Tras cualquier fijación (límite de reinicios, hard drop o expiración), el paso termina inmediatamente mediante `return` o comprobaciones de `continueIfActive()`.

### Semántica de reinicios en movimiento horizontal (`tryMoveHorizontal`)

- Antes del movimiento: `groundedBefore = isGrounded(board, activePiece)`.
- Si el movimiento es válido: aplicar, emitir `pieceMoved`.
- Si `groundedBefore`:
  - Si `groundedAfter`: `lockDelayElapsedMs = 0`, `lockResetsUsed += 1`. Si alcanza `maxLockResets`, fijar inmediatamente.
  - Si no: `lockDelayElapsedMs = 0`, no incrementa `lockResetsUsed`.
- Si no `groundedBefore`: sin interacción (tiempo ya 0).
- Movimiento bloqueado: no muta nada.

### Semántica de reinicios en rotación

Idéntica semántica, evaluada en el bloque de rotación de `processStep` con `groundedBefore` capturado antes de `tryRotate`.

### Límite de reinicios

Cuando `lockResetsUsed >= config.maxLockResets` tras una acción:
- La acción ya se aplicó.
- Se llama a `lockAndProcess()` que escribe en tablero, emite `pieceLocked`, elimina líneas, spawn.
- El paso termina (no se procesan más acciones sobre la pieza fijada).
- No existe `maxLockResets + 1`.

### Procesamiento vertical revisado

`processVertical` resta `VERTICAL_CELL_UNIT` del acumulador antes de comprobar colisión. Si hay colisión, no fija ni emite evento. La unidad de progreso ya se consumió, evitando acumulación infinita.

### Temporizador (paso 9 de `processStep`)

```ts
if (groundedAtEndOfStep) {
  lockDelayElapsedMs += config.fixedStepMs;
  if (lockDelayElapsedMs >= config.lockDelayMs) lockAndProcess();
} else {
  lockDelayElapsedMs = 0;
}
```

El primer paso apoyado ya cuenta `fixedStepMs`. No avanza más de una vez por paso.

### Snapshots

`ActivePieceSnapshot` se amplió con:
- `grounded: boolean` — derivado de `isGrounded` en el momento de construir el snapshot.
- `lockDelayElapsedMs: number` — valor del acumulador interno.
- `lockResetsUsed: number` — valor del contador interno.

Todos inmutables mediante `Object.freeze`.

### `reset()`, spawn y creación

En `reset()`, `spawnInitialPieces()` y `spawnNextPiece()` se inicializan ambos acumuladores a 0, sin herencia entre piezas.

## Contrato público final

```ts
type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;           // nuevo
  lockDelayElapsedMs: number;  // nuevo
  lockResetsUsed: number;      // nuevo
}>;
```

- `EngineSnapshot`, `StepInput`, `GameEvent` y `MoveReason` no cambiaron.
- No se añadieron nuevos códigos de error.

## Resolución de DAS/ARR y reinicios

- DAS/ARR producen movimientos individuales en `processHorizontal` (ya existente). Cada movimiento real invoca `tryMoveHorizontal`, que a su vez ejecuta la evaluación de reinicio por cada desplazamiento.
- Un movimiento bloqueado no consume reinicio ni reinicia tiempo.
- Cuando una secuencia DAS/ARR produce múltiples desplazamientos en un mismo paso, cada uno se evalúa independientemente. Si uno consume el último reinicio, la fijación detiene el bucle (el `while` de ARR comprueba `activePiece` tras cada iteración).

## Tratamiento del progreso vertical bloqueado

El acumulador `verticalProgress` resta 1000 unidades antes de comprobar colisión. Un intento bloqueado consume la unidad igual que uno exitoso, evitando acumulación infinita.

## Orden de eventos

- Movimiento + límite de reinicios: `pieceMoved(horizontal)` → `pieceLocked` → `linesCleared` (si) → `pieceSpawned`/`gameOver`.
- Rotación + límite de reinicios: `pieceRotated` → `pieceLocked` → `linesCleared` (si) → `pieceSpawned`/`gameOver`.
- Expiración del temporizador: `pieceLocked` → `linesCleared` (si) → `pieceSpawned`/`gameOver`.
- Hard drop: sin cambios respecto a 0005.
- Acciones bloqueadas: no emiten eventos.

## Pruebas añadidas

Se añadieron 34 nuevos tests organizados en 10 bloques `describe`:

1. **lock delay - temporizador** (5 tests): inicio al contactar, no fija antes del umbral, fija al alcanzar, avanza una vez por paso, no depende de tiempo real.
2. **lock delay - gravedad y soft drop** (5 tests): descenso bloqueado no fija, soft drop no reinicia, progreso bloqueado se consume.
3. **lock delay - hard drop** (4 tests): distancia positiva, distancia 0, no consume reinicios, no avanza tras fijar.
4. **lock delay - movimiento horizontal** (3 tests): válido reinicia, bloqueado no reinicia, en el aire no consume.
5. **lock delay - rotación** (3 tests): válida reinicia, inválida no reinicia, orden de eventos en límite.
6. **lock delay - límite de reinicios** (4 tests): último reinicio fija, acción antes que locked, no supera máximo, spawn limpio.
7. **lock delay - salida y reentrada** (2 tests): tiempo a 0 conserva histórico, nueva pieza reinicia.
8. **lock delay - snapshot** (4 tests): campos presentes, refleja apoyo real, inmutabilidad, game over con null.
9. **lock delay - atomicidad** (2 tests): entrada inválida no muta lock delay vars, precedencia ENGINE_NOT_RUNNING.
10. **lock delay - determinismo** (2 tests): misma semilla produce idénticos snapshots/eventos con lock delay; reset elimina progreso.

Además, se adaptó el test existente `colisión de soft drop fija la pieza inmediatamente` → `colisión de soft drop no fija la pieza inmediatamente (lock delay diferido)`.

## Comandos ejecutados y resultados

| Comando | Resultado |
|---|---|
| `pnpm test` | 265 passed (9 files) |
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | 3 packages OK |
| `pnpm build` | Build OK (warning de chunk de Phaser, aceptado) |
| `git diff --check` | Sin problemas |

## Número final de tests

**265 tests** (231 originales + 34 nuevos de lock delay).

## Desviaciones y decisiones de bajo nivel

- Se eliminó la función `evaluateLockReset` planeada pero no usada (el código inline era más claro y evitaba la necesidad de pasar `groundedBefore` como parámetro).
- En `tryMoveHorizontal`, la evaluación de `groundedBefore` se hace ANTES de mutar `activePiece.x`, ya que la función muta la pieza inline. En rotación, se captura `groundedBefore` antes de `tryRotate`.
- Los tests "fija exactamente al alcanzar lockDelayMs" y "no fija antes del umbral" y "avanza una única vez por paso lógico" se simplificaron para usar soft drop en vez de configuraciones de gravedad muy lentas, evitando problemas de validación relacional de `game-config` (softDrop debe ser > gravity).
- `maxLockResets: 0` no es válido según `game-config` (minimum 1). El test correspondiente se adaptó para usar `maxLockResets: 1`.
- `gravityCellsPerSecond: 20` requiere `softDropCellsPerSecond > 20` para pasar la validación. El test se adaptó con `softDropCellsPerSecond: 25`.

## Deuda técnica

- No hay indicador visual de lock delay.
- No se implementaron eventos públicos nuevos (`pieceGrounded`, etc.).
- El warning de chunk de Phaser permanece como deuda técnica aceptada.
- Los tests de "fija exactamente al alcanzar lockDelayMs" y "no fija antes del umbral" son frágiles porque dependen del número de pasos de gravedad desde spawn hasta grounded, que varía según la semilla. Se usan estrategias de soft drop compensatorio y comprobaciones genéricas (pieza null o grounded) en vez de valores exactos de paso.

## Confirmación Phaser

`apps/web` no implementa temporización de lock delay. El único cambio de contrato es la ampliación de `ActivePieceSnapshot`, compatible hacia atrás. No se modificó ningún archivo de `apps/web`.

## Confirmación de alcance excluido

No se implementó: ghost piece, hold, vista de tres próximas piezas, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, batalla, bot, pausa, audio, layout Tactical, HUD, backend, Pinia, Vue Router, Playwright, nuevos diagnósticos visuales, code splitting, ni subida del límite de chunk.

## Confirmación de ausencia de commits

No se crearon commits.
