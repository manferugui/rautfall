# Informe de implementación — Tarea 0016 — Consumo de energía y Residuos

## Resumen

Se ha implementado el consumo automático de energía de combate, la generación y almacenamiento en cartucho FIFO del primer sabotaje (`residuos`), su activación mediante entrada por teclado (flanco único con la tecla `A` -> `triggerSabotage`), el encolamiento de basura en motor (`receiveSabotage('residuos')`), la aplicación determinista de 2 filas de basura con hueco independiente generado vía PRNG en `lockAndProcess()`, la condición de top-out por expulsión superior (`garbageOverflow`), la visualización de datos de combate reales en `CombatStatusPanel.vue` y la integración del modo de demostración de desarrollo en bucle cerrado (`?sabotage-demo=1`).

---

## Archivos creados y modificados

### Creados
- `docs/implementation/0016-consumo-energia-y-residuos.md` (este documento).
- `apps/web/src/game/sabotage-demo.ts`: Módulo de utilidad para detectar el query parameter `?sabotage-demo=1` únicamente en entorno de desarrollo (`import.meta.env.DEV`).

### Modificados
- `packages/game-engine/src/index.ts`:
  - Definición de tipos exportados `SabotageType = 'residuos'`.
  - Eventos de motor `SabotageTriggeredEvent` (`sabotageTriggered`) y `GarbageAppliedEvent` (`garbageApplied`).
  - Causa de game over `garbageOverflow` en `GameOverReason`.
  - Inclusión de `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number` en `EngineSnapshot`.
  - Inclusión de `triggerSabotage?: boolean` en `StepInput` y su validación boolean en `validateInput()`.
  - Método público `receiveSabotage(sabotage: SabotageType): void` en `GameEngine`.
  - Lógica de conversión de energía en `lockAndProcess()` (máximo 1 conversión por fijación, cartucho FIFO capacidad 2, conservación de excedente).
  - Aplicación de basura pendiente (`pendingGarbage`) tras limpieza de líneas del jugador y antes del spawn de la siguiente pieza, desplazando tablero hacia arriba, generando huecos independientes con el PRNG determinista del motor y comprobando expulsión superior (`y < 0`) para `garbageOverflow`.
  - Actualización de firmas de funciones auxiliares del tablero (`isCollision`, `countOccupiedCorners`, `isCornerOccupied`, `isTSpin`, `isGrounded`, `hardDropDistance`, `computeLandingCells`, `tryRotate`, `createEmptyBoard`, `boardToReadonly`, `cloneBoard`) para soportar celdas `PieceType | 'garbage' | null`.
- `packages/game-engine/src/game-engine.test.ts`:
  - Suite de pruebas unitarias deterministas completas para la Tarea 0016 (ejemplos exactos de conversión de energía, límite de cartucho, conservación de excedente, lanzamiento FIFO, encolamiento y aplicación de basura con PRNG, desbordamiento superior `garbageOverflow`, y reinicio `reset()`).
- `apps/web/src/game/types.ts`:
  - Extensión de `GamePresentationState` con `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number`.
- `apps/web/src/game/input-buffer.ts` y `apps/web/src/game/input-buffer.test.ts`:
  - Captura del flanco de la tecla `A` (`justPressedA`) y mapeo a `triggerSabotage: true` en `StepInput`.
- `apps/web/src/game/scenes/GameScene.ts`:
  - Registro de tecla `A`, renderizado visual de celdas basura (`'garbage'`, color grafito/gris `#555555`), notificaciones de `storedSabotages` y `pendingGarbage` a Vue y loopback de sabotaje disparado cuando `isSabotageDemoActive()` está activo.
- `apps/web/src/components/CombatStatusPanel.vue` y `apps/web/src/components/CombatStatusPanel.test.ts`:
  - Declaración de props `storedSabotages` y `pendingGarbage`, renderizado de datos de combate reales (cartucho y residuos) y eliminación de las etiquetas `SIMULADO` en cartucho y residuos.
- `apps/web/src/App.vue` y `apps/web/src/App.test.ts`:
  - Estado inicial `storedSabotages` y `pendingGarbage` en `gameState`, paso de props a `CombatStatusPanel` y adición de la tecla <kbd>A</kbd> a la lista de ayuda de controles.
- `apps/web/src/game/types.test.ts`:
  - Actualización de la especificación de `GamePresentationState` (11 propiedades).
- `docs/project-status.md`:
  - Registro de la Tarea 0016 completada con enlace a este informe de implementación.

---

## Decisiones relevantes

1. **Fórmula de conversión y conservación del excedente**:
   - `totalEnergy = combatEnergy + generatedEnergy`.
   - Si `storedSabotages.length < 2` y `totalEnergy >= 100`:
     - `storedSabotages.push('residuos')`.
     - `combatEnergy = Math.min(100, totalEnergy - 100)`.
   - De lo contrario:
     - `combatEnergy = Math.min(100, totalEnergy)`.
   - Se permite como máximo **una conversión** de energía por fijación.
2. **Capacidad FIFO y activación por teclado**:
   - El cartucho almacena hasta 2 sabotajes FIFO.
   - `StepInput.triggerSabotage` (disparado con flanco único de tecla `A`) extrae el primer sabotaje y emite el evento `sabotageTriggered`. Si el cartucho está vacío, no se realiza ninguna acción ni evento.
3. **Orden de resolución en `lockAndProcess()`**:
   1. Evaluar T-Spin antes de escribir la pieza.
   2. Escribir celdas de la pieza activa en el tablero.
   3. Emitir evento `pieceLocked`.
   4. Limpiar líneas completadas del jugador.
   5. Actualizar combo, back-to-back, puntuación, `combatEnergy` y `storedSabotages`.
   6. Emitir evento `linesCleared` (si aplica).
   7. Aplicar basura pendiente (`pendingGarbage`): comprobar expulsión de celdas a $y < 0$ (`garbageOverflow`), desplazar tablero 2 filas hacia arriba, insertar celdas `'garbage'` con 1 hueco independiente por fila (`Math.floor(prng() * 10)`), decrementar `pendingGarbage` y emitir `garbageApplied`.
   8. Intentar `spawnNextPiece()` (si la nueva pieza colisiona con el tablero elevado por basura, `gameOver` por `spawnBlocked`).
4. **Residuos y celdas basura**:
   - Las celdas basura de `Residuos` usan el tipo `'garbage'` y se representan visualmente con color grafito/gris `#555555`.
5. **Modo de demostración de desarrollo (`?sabotage-demo=1`)**:
   - Disponible solo en entorno de desarrollo (`import.meta.env.DEV`). Al emitirse `sabotageTriggered`, la escena lo redirige en bucle cerrado a `engine.receiveSabotage(event.sabotage)`.

---

## API pública producida

- `SabotageType`: `'residuos'`.
- `GameEngine.receiveSabotage(sabotage: SabotageType): void`.
- `EngineSnapshot`: contiene `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number`.
- `GamePresentationState`: contiene `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number`.
- `StepInput`: propiedad opcional `triggerSabotage?: boolean`.
- Eventos de motor:
  - `{ type: 'sabotageTriggered', step: number, sabotage: SabotageType }`.
  - `{ type: 'garbageApplied', step: number, linesCount: number }`.
- Causa de game over:
  - `{ type: 'gameOver', step: number, reason: 'garbageOverflow' }`.

---

## Pruebas añadidas

- Suite completa de pruebas unitarias deterministas para la Tarea 0016 en `packages/game-engine/src/game-engine.test.ts`.
- Pruebas de captura y consumo de `triggerSabotage` en `input-buffer.test.ts`.
- Pruebas del componente `CombatStatusPanel.vue` para cartucho real y residuos pendientes en `CombatStatusPanel.test.ts`.
- Pruebas de la estructura `GamePresentationState` (11 propiedades) en `types.test.ts`.
- Pruebas de integración de Vue en `App.test.ts`.

Total final de la suite: **480 tests pasando en 19 archivos**.

---

## Comandos ejecutados y resultados

- `pnpm test`: 480 passed (19 test files).
- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm typecheck`: Clean (3 workspace packages: game-config, game-engine, apps/web).
- `pnpm build`: Build exitoso en `@rautfall/web`.
- `pnpm test:e2e`: 1 passed (`essential-flow.spec.ts` en 3.4s).
- `git diff --check`: Sin conflictos de espaciado.
- `git status --short`: Muestra únicamente archivos modificados y creados dentro del alcance de la tarea 0016.

---

## Desviaciones

Ninguna. La implementación cumple exactamente con las especificaciones inmutables definidas en `AGENTS.md` y `docs/tasks/0016-consumo-energia-y-residuos.md`.

---

## Confirmación del alcance excluido

Se confirma estrictamente que:
- No se implementaron otros tipos de sabotaje (solo `'residuos'`).
- No se añadió un segundo tablero ni interfaz multijugador.
- No se introdujo bot, backend, conexión en red, efectos sonoros ni animaciones avanzadas.
