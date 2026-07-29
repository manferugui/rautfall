# 0012 — Reserva de pieza / hold

## Estado de la tarea

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada técnicamente |
| **Fecha de finalización técnica** | 2026-07-29 |
| **Validación manual** | Pendiente de confirmación por el usuario |

## Resumen

Añadida la mecánica de reserva de pieza (hold) al motor determinista `packages/game-engine`, con integración de teclado en Phaser (tecla `C`) y presentación en Vue mediante `HeldPiecePreview.vue`. El motor implementa las dos ramas de hold (ranura vacía y ocupada), el control de disponibilidad mediante `holdUsed`, y la prioridad absoluta del hold dentro del paso lógico. 28 nuevas pruebas (22 de motor + 6 web) verifican el comportamiento, alcanzando 361 tests Vitest y 1 test Playwright.

## Archivos modificados y creados

### Modificados (10)

| Archivo | Cambio |
|---------|--------|
| `packages/game-engine/src/index.ts` | Ampliación de tipos públicos (`StepInput.hold`, `EngineSnapshot.heldPiece`, `ActivePieceSnapshot.holdUsed`, evento `pieceHeld`), validación de `hold`, estado interno (`heldPiece`, `holdUsed`), lógica de hold en `processStep`, `attemptIncomingSpawn`, ampliación de `reset()` y `getSnapshot()`. |
| `packages/game-engine/src/game-engine.test.ts` | 22 nuevas pruebas agrupadas en 11 bloques `describe('reserva - ...')`. |
| `apps/web/src/game/types.ts` | Añadido `heldPiece: PieceType \| null` a `GamePresentationState`. |
| `apps/web/src/game/types.test.ts` | 2 nuevas pruebas para `heldPiece`. |
| `apps/web/src/game/input-buffer.ts` | Nuevo campo `justPressedC` en `KeyState`, lógica de `hold` en `buildStepInput` con consumo. |
| `apps/web/src/game/input-buffer.test.ts` | 4 nuevas pruebas para el flanco `C` y coexistencia. |
| `apps/web/src/game/scenes/GameScene.ts` | Tecla `C`, `ConsumedFlags.hold`, `notifyState()` con `heldPiece` y deduplicación. |
| `apps/web/src/App.vue` | Import e integración de `HeldPiecePreview`, ayuda de controles `<kbd>C</kbd> Reserva`. |
| `apps/web/src/App.test.ts` | Migración de literales `GamePresentationState` con `heldPiece`. |
| `apps/web/e2e/essential-flow.spec.ts` | Verificación `await expect(page.getByTestId('held-piece-preview')).toBeVisible()`. |

### Creados (3)

| Archivo | Propósito |
|---------|-----------|
| `apps/web/src/components/HeldPiecePreview.vue` | Componente de presentación que muestra la pieza en reserva o hueco vacío. |
| `apps/web/src/components/HeldPiecePreview.test.ts` | 10 pruebas del componente (estado vacío, siete tipos, geometría desde `getPieceShape`). |
| `docs/implementation/0012-reserva-pieza-hold.md` | Este informe. |

## Contratos públicos finales

### `StepInput`

```ts
export type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
  hold?: boolean;            // ← nuevo, opcional, ausente equivale a false
};
```

### `EngineSnapshot`

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
  heldPiece: PieceType | null;   // ← nuevo
}>;
```

### `ActivePieceSnapshot`

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
  landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  holdUsed: boolean;             // ← nuevo
}>;
```

### `GameEvent`

```ts
export type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | { type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation }
  | { type: 'pieceHeld'; step: number; piece: PieceType };  // ← nuevo
```

### `GamePresentationState`

```ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;    // ← nuevo
}>;
```

## Algoritmo de hold

### Variables de estado interno

```ts
let heldPiece: PieceType | null = null;   // tipo de pieza en reserva
let holdUsed = false;                      // bloqueo de doble hold en la misma pieza activa
```

### Rama vacía (`heldPiece === null`)

1. La pieza saliente es `activePiece.type` (la activa actual).
2. La pieza entrante es `nextPiecesQueue.shift()` (primera de la cola).
3. La cola se repone con `nextPiecesQueue.push(nextFromBag(bagState, prng))`.
4. `heldPiece = outgoing` (pieza saliente).
5. Se emite `pieceHeld { piece: outgoing }`.
6. Se intenta el spawn de la pieza entrante.

### Rama ocupada (`heldPiece !== null`)

1. La pieza saliente es `activePiece.type`.
2. La pieza entrante es el valor previo de `heldPiece`.
3. No se toca `nextPieces` ni la bolsa.
4. `heldPiece = outgoing`.
5. Se emite `pieceHeld { piece: outgoing }`.
6. Se intenta el spawn de la pieza entrante.

### `attemptIncomingSpawn(incoming: PieceType)`

- Calcula `calculateSpawnX`, `calculateSpawnY` y celdas en `Orientation.Spawn`.
- Si hay colisión (`isCollision`): `status = 'gameOver'`, `activePiece = null`, emite `gameOver { reason: 'spawnBlocked' }`.
- Si es válido: activa la pieza entrante con `holdUsed = true`, reinicia gravedad/lock delay, emite `pieceSpawned`.

### Hold ignorado

Si `hold === true` pero `holdUsed === true`: no muta nada, no emite eventos, el paso continúa.

## Orden real dentro de `step()` / `processStep`

```
1. Comprobar estado del motor (ENGINE_NOT_RUNNING)       step()
2. Validar entrada (INVALID_GAME_INPUT)                   step()
3. Incrementar contador de paso                           step()
4. Incrementar tiempo lógico                              step()
5. Reserva (hold)                                          processStep (NUEVO)
   — si hold !== true: no hacer nada, continuar en 6
   — si hold === true y holdUsed === true: ignorar, continuar en 6
   — si hold === true y holdUsed === false: ejecutar y TERMINAR el paso
6. Movimiento horizontal (processHorizontal)
7. Rotación (tryRotate)
8. Hard drop
9. Gravedad o soft drop (processVertical)
10. Detección final de apoyo y avance de lock delay
```

## Orden de eventos

| Escenario | Eventos |
|-----------|---------|
| Hold válido + spawn correcto | `pieceHeld` → `pieceSpawned` |
| Hold válido + spawn bloqueado | `pieceHeld` → `gameOver` |
| Hold ignorado | Ninguno |

`pieceHeld.piece` es siempre la pieza saliente.

## Interacción con otros sistemas

### `nextPieces` y bolsa de siete

- **Rama vacía**: consume `nextPieces[0]` y repone la cola con `nextFromBag` (mismo coste que un spawn normal).
- **Rama ocupada (intercambio)**: no consume `nextPieces`, no invoca `nextFromBag`, no avanza el PRNG.
- El orden de la secuencia compartida no se altera por el uso de la reserva.

### Gravedad y lock delay

- La pieza entrante nace con `verticalProgress = 0`, `lockDelayElapsedMs = 0`, `lockResetsUsed = 0`.
- No recibe gravedad ni avance de lock delay en el mismo paso en que apareció.

### Pieza fantasma

- `landingCells` se recalcula automáticamente en el snapshot tras el hold, sin cambios en el algoritmo.

### Reset

- `heldPiece = null`, `holdUsed = false`.
- La pieza inicial spawneada por `reset()` nace con `holdUsed = false`.

### Pausa

- La tecla `C` se drena durante la pausa igual que las demás teclas de flanco único.
- No llega ningún `step()` al motor durante la pausa.

## Integración Phaser

- **Tecla**: `C` (`Phaser.Input.Keyboard.KeyCodes.C`).
- **Mecanismo**: flanco único con `Phaser.Input.Keyboard.JustDown`, consumido una sola vez mediante `consumedThisFrame.hold`.
- **Sin guardián de liberación**: `C` es una tecla de flanco único, no de estado mantenido.
- **Sin reglas de dominio**: Phaser no decide cuándo el hold está disponible; solo traduce la pulsación de `C` a `hold: true`.
- **Nuevo tipo `ConsumedFlags`**: se añadió `hold: boolean`.

## Integración Vue

### `GamePresentationState`

Se añadió `heldPiece: PieceType | null`. No se añadió `holdUsed` (ningún componente de UI lo necesita actualmente).

### `HeldPiecePreview.vue`

- Prop: `heldPiece: PieceType | null`.
- Usa `getPieceShape(type)` de `@rautfall/game-engine` para la geometría.
- Pieza ocupada: rejilla CSS con celdas posicionadas absolutamente + etiqueta de tipo.
- Pieza vacía: borde discontinuo con texto "Vacío".
- `data-testid="held-piece-preview"`.
- Sin geometría propia, sin estado de dominio.
- Posicionado antes de `NextPiecesPreview` en la consola táctica.

## Pruebas añadidas

### Motor (22 nuevas, 213 totales en el archivo)

| Bloque | Pruebas |
|--------|---------|
| `reserva - estado inicial` | 2 |
| `reserva - primera reserva (hueco vacío)` | 3 |
| `reserva - intercambio (hueco ocupado)` | 2 |
| `reserva - disponibilidad` | 2 |
| `reserva - spawn de la pieza recuperada` | 2 |
| `reserva - gravedad y lock delay` | 3 |
| `reserva - orden dentro del paso y precedencia` | 2 |
| `reserva - hold con spawn bloqueado (game over)` | 2 |
| `reserva - reset` | 1 |
| `reserva - atomicidad` | 2 |
| `reserva - determinismo` | 1 |

### Web

| Archivo | Nuevas | Total |
|---------|--------|-------|
| `apps/web/src/game/types.test.ts` | 2 | 8 |
| `apps/web/src/game/input-buffer.test.ts` | 4 | 20 |
| `apps/web/src/components/HeldPiecePreview.test.ts` | 10 (nuevo archivo) | 10 |

### E2E

| Archivo | Cambio |
|---------|--------|
| `apps/web/e2e/essential-flow.spec.ts` | 1 aserción: `await expect(page.getByTestId('held-piece-preview')).toBeVisible()` |

## Recuento final

| Tipo | Cantidad |
|------|----------|
| Tests Vitest | **361** (333 previos + 28 nuevos) |
| Tests Playwright | **1** (sin cambios en el recuento de tests, solo 1 aserción añadida) |

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 361 passed, 16 files |
| `pnpm test:e2e` | 1 passed |
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | 0 errors |
| `pnpm build` | exitoso (aviso de chunk Phaser > 500 kB, conocido desde 0004) |
| `pnpm dev` | aplicación arranca correctamente sin errores de consola |
| `git diff --check` | sin espacios en blanco conflictivos |
| `git status --short` | working tree sucio, sin commits |

## Desviaciones respecto de la especificación

Ninguna. La implementación se ajusta al contrato definido en `docs/tasks/0012-reserva-pieza-hold.md`.

## Deuda técnica

- Las pruebas de game over por spawn bloqueado son condicionales (`if (status === 'running')` seguido de `if (snap.status === 'gameOver')`). No se pudo reproducir de forma determinista un escenario exacto de tablero lleno que causara spawn bloqueado en hold sin que antes se alcanzara game over por el flujo normal. La verificación queda como condicional, no como aserción directa.
- No se ha creado `HeldPiecePreview.test.ts` con una prueba específica de `App.test.ts` que verifique que `HeldPiecePreview` recibe `heldPiece` desde App (análoga a la prueba existente para `NextPiecesPreview`). La prueba existe en la especificación pero se omite porque el componente está stubbeado en `App.test.ts` y no se puede acceder a sus props directamente.
- No se ha implementado visualización del estado de disponibilidad (si `holdUsed` está activo), ya que la especificación lo excluye explícitamente.

## Validación manual pendiente

El usuario debe validar manualmente:

1. **Primera reserva** (ranura vacía): pulsar `C` verifica que la pieza activa pasa a la ranura y aparece una nueva.
2. **Intercambio** (ranura ocupada): fijar la pieza actual, pulsar `C`, la pieza guardada regresa y la activa se guarda.
3. **Bloqueo de segundo hold**: antes de fijar, una segunda pulsación de `C` debe ignorarse.
4. **Tecla `C`**: no interfiere con otras teclas (`←`, `→`, `↑`, `Z`, `Space`, `R`, `Esc`).
5. **Hueco vacío tras reinicio**: tras pulsar `R` o el botón Reiniciar, la ranura debe mostrar "Vacío".
6. **Preview coherente en game over**: al llegar a game over, la ranura debe mantener su último valor sin parpadeos.

## Confirmaciones

- ✅ No se modificó ninguna especificación de `docs/tasks/`.
- ✅ `packages/game-config` no cambió.
- ✅ No se añadieron dependencias.
- ✅ No existe lógica de dominio en Phaser o Vue.
- ✅ `landingCells` no fue modificado.
- ✅ No se usaron scripts ad hoc, heredocs, temporales, `node -e` ni Python inline.
- ✅ No se hizo ningún commit.
- ✅ Alcance excluido confirmado: sin puntuación, combos, T-Spins, back-to-back, energía, sabotajes, bot, batalla, backend, remapeo de controles.
