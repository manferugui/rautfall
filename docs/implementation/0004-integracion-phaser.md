# 0004 — Integración de Phaser (Informe de implementación)

## Resumen

Integración de Phaser 3.80.1 como motor de renderizado y entrada en `apps/web`, sustituyendo el tablero interactivo dibujado por Vue. Vue se mantiene como contenedor mostrando el estado (`status`, `step`, `elapsedMs`), controles, ayuda de teclas y botón Reset. Phaser gestiona el canvas, el teclado, la adaptación temporal y el game loop, consumiendo exclusivamente las APIs públicas de `@rautfall/game-engine` y `@rautfall/game-config`.

## Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `apps/web/src/game/types.ts` | Tipos `GamePresentationState` y `PhaserGameController` |
| `apps/web/src/game/time-adapter.ts` | Función pura `computeSteps` para adaptación delta → pasos fijos |
| `apps/web/src/game/time-adapter.test.ts` | 9 pruebas de adaptación temporal |
| `apps/web/src/game/coordinates.ts` | Transformación de coordenadas tablero → canvas |
| `apps/web/src/game/coordinates.test.ts` | 5 pruebas de coordenadas y visibilidad |
| `apps/web/src/game/input-buffer.ts` | Construcción de `StepInput` desde estado de teclas |
| `apps/web/src/game/input-buffer.test.ts` | 9 pruebas de entrada de teclado |
| `apps/web/src/game/types.test.ts` | 3 pruebas de contrato `GamePresentationState` |
| `apps/web/src/game/create-phaser-game.ts` | Factoría centralizada de `Phaser.Game` |
| `apps/web/src/game/scenes/GameScene.ts` | Escena principal: teclado, adaptación temporal, renderizado |
| `apps/web/src/components/GameCanvas.vue` | Componente Vue que monta/destruye Phaser |
| `apps/web/src/components/GameCanvas.test.ts` | 4 pruebas de ciclo de vida con mocks |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/package.json` | Añadida dependencia `phaser@3.80.1` y devDependencias `@vue/test-utils`, `jsdom` |
| `apps/web/src/App.vue` | Sustituido tablero Vue por `GameCanvas`, panel de estado, controles y ayuda |
| `pnpm-lock.yaml` | Actualizado por dependencias nuevas |

## Archivos eliminados

| Archivo | Motivo |
|---------|--------|
| `apps/web/src/board-composition.ts` | Sustituido por renderizado en Phaser desde snapshots |
| `apps/web/src/board-composition.test.ts` | Pruebas del renderer Vue eliminado (7 tests) |

## Dependencias añadidas

| Dependencia | Versión | Tipo | Justificación |
|-------------|---------|------|---------------|
| `phaser` | 3.80.1 | producción | Motor de renderizado y entrada para el juego |
| `@vue/test-utils` | — | dev | Pruebas de ciclo de vida de componentes Vue |
| `jsdom` | — | dev | Entorno DOM para pruebas Vue en Vitest |

## Arquitectura final

```
apps/web/src/
  App.vue                          ← Contenedor Vue: estado, controles, ayuda
  components/
    GameCanvas.vue                 ← Monta/destruye Phaser, emite controllerReady
    GameCanvas.test.ts             ← Pruebas de ciclo de vida con mock
  game/
    types.ts                       ← GamePresentationState, PhaserGameController
    time-adapter.ts                ← computeSteps (función pura)
    time-adapter.test.ts
    coordinates.ts                 ← Transformación tablero→canvas
    coordinates.test.ts
    input-buffer.ts                ← buildStepInput (función pura)
    input-buffer.test.ts
    create-phaser-game.ts          ← Factoría Phaser.Game
    scenes/
      GameScene.ts                 ← Escena única: teclado, delta→pasos, renderizado
```

### Responsabilidades

- **Vue**: contenedor, estado (solo `status`, `step`, `elapsedMs`), ayuda de controles, botón Reset, mensaje gameOver.
- **Phaser (GameScene)**: renderizado del tablero y pieza activa desde snapshots, captura de teclado, adaptación delta→pasos lógicos, reset.
- **`@rautfall/game-engine`**: única fuente de verdad del dominio (colisiones, SRS, gravedad, fijación, líneas, game over).

## Contratos públicos consumidos

- `createGameEngine({ seed, config })` de `@rautfall/game-engine`
- `prototypeConfig` de `@rautfall/game-config`
- `StepInput`, `EngineSnapshot`, `PieceType` de `@rautfall/game-engine`

## Versión de Phaser

**phaser@3.80.1** — versión estable compatible con el stack actual (Vite 8, Vue 3.5, TypeScript 5.9).

## Adaptación temporal implementada

La función pura `computeSteps(accumulator, deltaMs, fixedStepMs)` implementa el algoritmo cerrado:

1. Delta del frame limitado a 250 ms (`Math.min(deltaMs, 250)`).
2. Acumulador += delta limitado.
3. Pasos a ejecutar = `min(floor(accumulator / fixedStepMs), 25)`.
4. Acumulador -= pasos × fixedStepMs.
5. Exceso descartado (no arrastra deuda).

Esta función es pura y se probó en 9 tests.

## Entradas simultáneas

Si `ArrowLeft` y `ArrowRight` están presionadas simultáneamente, `horizontal = 0`. Si `ArrowUp` y `Z` se detectan en el mismo frame, ninguna rotación se envía (ambas `false`). Una acción discreta (movimiento, rotación, hard drop) se consume en el primer paso lógico del frame y no se repite en pasos adicionales.

## Estrategia de foco

El contenedor del canvas (`GameCanvas.vue`) tiene `tabindex="0"`. Phaser gestiona el teclado dentro de su ciclo de vida de escena; no hay listeners globales. Las teclas `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space` son capturadas por Phaser internamente.

## Renderizado y transformación de coordenadas

- Canvas lógico: 320 × 640 px (10 columnas × 20 filas visibles × 32 px).
- Filas ocultas (0-3) no se dibujan.
- `canvasX = x * 32`, `canvasY = (y - 4) * 32`.
- Solo celdas con `y >= 4` se renderizan.
- Se usa `Phaser.GameObjects.Graphics` con rectángulos coloreados.
- Pieza activa superpuesta sobre tablero fijo, sin mutar el snapshot.

## Pruebas

### Añadidas (23 nuevas)

- **time-adapter.test.ts** (9): adaptación temporal (delta menor, 1 paso, varios pasos, límite 250ms, tope 25 pasos, exceso descartado, sin deuda, fixedStepMs configurable, residuo entre frames).
- **input-buffer.test.ts** (9): pulsación única izquierda/derecha, no repetición mantenida, simultáneas → 0, rotación horaria/antihoraria, conflicto resuelto, hard drop único, consumido en frame.
- **coordinates.test.ts** (5): filas 0-3 excluidas, transformación fila 4→0, fila 23→19, x→píxeles, y→píxeles.
- **types.test.ts** (3): estado contiene solo status/step/elapsedMs, sin propiedades del motor, soporta gameOver.
- **GameCanvas.test.ts** (4): ciclo de vida con mocks (creación única, sin duplicados, destrucción al desmontar, emisión controllerReady).

### Eliminadas (7)

- `board-composition.test.ts` (7 tests): pruebas del renderer Vue que fue sustituido.

### Conservadas

- `packages/game-engine/src/game-engine.test.ts` (103 tests)
- `packages/game-config/src/game-config.test.ts` (12 tests)
- `apps/web/src/workspace.test.ts` (4 tests)


**Total final: 149 tests** (103 game-engine + 12 game-config + 4 workspace + 9 time-adapter + 9 input-buffer + 5 coordinates + 3 types + 4 GameCanvas)

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ 149 passed, 0 failed |
| `pnpm lint` | ✅ 0 errores, 0 avisos |
| `pnpm typecheck` | ✅ Sin errores (3 paquetes) |
| `pnpm build` | ✅ Build exitoso |

## Validación manual

Con `pnpm dev`:

- ✅ La aplicación carga sin errores de consola (Vite arranca correctamente).
- ❌ Validación en navegador: **no ejecutada**. No es posible lanzar un navegador desde esta terminal. Las comprobaciones visuales (canvas, tablero completo, 20 filas visibles, pieza activa, teclado, gravedad, fijación, gameOver, reset) quedan pendientes de verificación manual en un navegador real.

## Desviaciones

Ninguna desviación respecto a la especificación `docs/tasks/0004-integracion-phaser.md`.

## Riesgos detectados

- El build genera un chunk de 1.3 MB (Phaser). Aceptable para prototipo; se optimizará en una tarea futura si es necesario.
- No se ha probado el comportamiento real de Phaser.Scale.FIT/CENTER_BOTH en distintos tamaños de ventana.

## Deuda técnica

- No hay tests de GameScene (requeriría mock complejo de Phaser o integración con navegador).
- La paleta de colores es provisional, no la dirección Industrial Dramatic definitiva.
- No se ha implementado DAS/ARR (fuera de alcance de 0004).

## Corrección posterior: rearme de entrada de teclado

### Causa raíz

En `GameScene.ts`, las banderas `consumedThisFrame` se establecían a `true` cuando una acción se consumía en el primer paso lógico de un frame, pero **nunca se reiniciaban** al comienzo del siguiente frame. Una vez que `consumedThisFrame.horizontal = true`, permanecía `true` permanentemente, bloqueando todas las pulsaciones futuras de esa tecla, incluso después de un keyup y un nuevo keydown. Phaser `JustDown()` detectaba correctamente las nuevas pulsaciones, pero las banderas de consumo nunca se restablecían para dejarlas pasar.

### Archivo modificado

- `apps/web/src/game/scenes/GameScene.ts` — Añadido `this.consumedThisFrame = { horizontal: false, ... }` al inicio de `update()`, antes de cualquier procesamiento.

### Cambio implementado

Una línea al comienzo de `update()`:

```ts
this.consumedThisFrame = { horizontal: false, clockwise: false, counterclockwise: false, hardDrop: false };
```

Esto garantiza que cada frame empiece con las banderas limpias. `JustDown()` ya impide que una tecla mantenida dispare múltiples frames; `consumedThisFrame` solo evita que una misma pulsación dispare varias acciones en pasos lógicos múltiples *dentro del mismo frame*. El reset al empezar cada frame permite que un nuevo keydown (tras keyup) genere una nueva acción.

### Pruebas de regresión

No se modificaron las pruebas existentes. El bug estaba en la integración entre `GameScene.update()` (que no reseteaba `consumedThisFrame`) y `buildStepInput` (que sí funcionaba correctamente como función pura). Las pruebas de `buildStepInput` ya cubrían el comportamiento intra-frame; el bug era que nunca se llamaba con las banderas limpias entre frames.

### Resultados de calidad tras la corrección

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | ✅ 149 passed |
| `pnpm lint` | ✅ 0 errores, 0 avisos |
| `pnpm typecheck` | ✅ Sin errores |
| `pnpm build` | ✅ Build exitoso |

### Validación manual

Pendiente de verificar en navegador real. El servidor `pnpm dev` arranca correctamente.

## Confirmaciones

- ✅ Phaser solo está en `apps/web` (no en `game-engine` ni `game-config`).
- ✅ No se duplicó lógica del motor en Phaser (todo el dominio sigue en `@rautfall/game-engine`).
- ✅ No existe un segundo tablero Vue (board-composition.ts eliminado).
- ✅ No se añadió alcance excluido (sin DAS, ARR, soft drop, pausa, ghost, hold, scoring, audio, etc.).
- ✅ No se hicieron commits.
