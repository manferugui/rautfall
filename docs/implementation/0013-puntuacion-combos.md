# 0013 — Puntuación y combos (Informe de implementación)

## Resumen

Se ha añadido puntuación y combos deterministas al modo Training de `packages/game-engine`. `EngineSnapshot` expone `score: number` y `combo: number`, calculados exclusivamente por el motor. La aplicación web muestra estos valores mediante un nuevo componente Vue `ScorePanel.vue`. El hard drop se ha unificado sobre `lockAndProcess()` para que la puntuación por líneas/combo tenga una única implementación.

## Archivos creados

- `apps/web/src/components/ScorePanel.vue` — componente Vue que muestra puntuación y combo
- `apps/web/src/components/ScorePanel.test.ts` — pruebas del componente

## Archivos modificados

- `packages/game-engine/src/index.ts` — `EngineSnapshot` con score/combo, constantes de puntuación, lógica de scoring en `lockAndProcess()`, `processVertical()`, hard drop, `getSnapshot()`, `reset()`
- `packages/game-engine/src/game-engine.test.ts` — 26 nuevas pruebas de puntuación y combos
- `apps/web/src/game/types.ts` — `GamePresentationState` con score/combo
- `apps/web/src/game/scenes/GameScene.ts` — `notifyState()` con score/combo
- `apps/web/src/App.vue` — integración de ScorePanel, valor inicial de gameState
- `apps/web/src/game/types.test.ts` — literales actualizados con score/combo
- `apps/web/src/App.test.ts` — literales actualizados, ScorePanel stub, nueva prueba de ScorePanel
- `apps/web/e2e/essential-flow.spec.ts` — verificación E2E de score-value y combo-value

## Contrato público final

### EngineSnapshot

```ts
export type EngineSnapshot = Readonly<{
  // ... campos existentes ...
  score: number;
  combo: number;
}>;
```

### GamePresentationState

```ts
export type GamePresentationState = Readonly<{
  // ... campos existentes ...
  score: number;
  combo: number;
}>;
```

No se añadió ningún evento de dominio nuevo. GameEvent permanece sin cambios.

## Algoritmo final de puntuación y combo

### Constantes internas

```ts
const LINE_CLEAR_POINTS: Readonly<Record<1 | 2 | 3 | 4, number>> = Object.freeze({
  1: 100,
  2: 300,
  3: 500,
  4: 800,
});

const SOFT_DROP_POINTS_PER_CELL = 1;
const HARD_DROP_POINTS_PER_CELL = 2;
```

### Lógica dentro de `lockAndProcess()`

- Tras `clearLines()`, si `lineIndices.length > 0`:
  - Se calculan puntos base desde `LINE_CLEAR_POINTS`
  - `combo += 1`
  - `comboBonus = combo >= 2 ? 50 * (combo - 1) : 0`
  - `score += basePoints + comboBonus`
- Si no hay líneas: `combo = 0`

### Soft drop (dentro de `processVertical()`)

- 1 punto por cada celda realmente descendida con `softDropHeld === true`

### Hard drop

- 2 puntos por celda de distancia real
- Después se invoca `lockAndProcess()` (unificado, §20.1)

### reset()

- `score = 0; combo = 0;`

## Unificación de §20.1

El bloque de hard drop ahora invoca `lockAndProcess()` en lugar de duplicar la secuencia `lockActivePiece()/clearLines()/spawnNextPiece()`. Esto garantiza que la puntuación por líneas/combo tenga una única implementación. Líneas afectadas: `processStep()` en el bloque `input.hardDrop`.

## Orden final dentro de `step()`/`processStep`

El orden vigente se mantiene (hold → horizontal → rotación → hard drop → gravedad/soft drop → lock delay). La puntuación por caída se concede durante el movimiento (hard drop: antes de `lockAndProcess()`; soft drop: durante `processVertical()`). La puntuación por líneas/combo se calcula dentro de `lockAndProcess()`.

## Confirmación de ausencia de eventos de dominio nuevos

No se añadió ningún evento de dominio nuevo. La puntuación solo se observa via `EngineSnapshot`, no via eventos. Ver §16 de la especificación.

## Integración Vue

- `ScorePanel.vue` con props `score` y `combo`
- Colocado en la `.tactical-console` entre `NextPiecesPreview` y "Estado de sesión"
- `data-testid="score-panel"`, `data-testid="score-value"`, `data-testid="combo-value"`

## Pruebas añadidas

### Motor (26 nuevas, ahora 406 totales)

- `puntuación - estado inicial` (3 tests): score=0, combo=0, reset
- `puntuación - hard drop` (2 tests): distancia * 2, distancia 0
- `puntuación - soft drop` (3 tests): progreso<1000, 1 punto/celda, gravedad=0
- `puntuación - eliminación de líneas` (3 tests): sin líneas→combo=0, acumulación larga, invariante no decreciente
- `combo - inicio y crecimiento` (2 tests): reset, fijaciones sin líneas
- `puntuación - hard drop con distancia y líneas` (1 test)
- `puntuación - game over y snapshot` (3 tests): score final, combo final, inmutabilidad
- `puntuación - atomicidad` (2 tests): entrada inválida, step en gameOver
- `puntuación - determinismo` (1 test)

### ScorePanel (4 tests)

- score=0, combo=0 muestra "0" y "—"
- score distinto de cero
- combo >= 1 muestra valor numérico
- contenedor con data-testid

### App.test.ts

- Nueva prueba: ScorePanel recibe score y combo desde App

### E2E

- Verificación de `score-value`="0" y `combo-value` visible

## Comandos ejecutados y resultados

```
pnpm test --run                    → 406 passed (406), 18 files
pnpm lint                          → 0 errors, 0 warnings
pnpm typecheck                     → Success (3 packages)
pnpm build                         → Success (Phaser chunk warning only)
pnpm test:e2e (Playwright)         → 1 passed (1), 0 failed
```

## Desviaciones respecto de la especificación

Ninguna desviación significativa. Las pruebas de motor no verifican la tabla de puntos 100/300/500/800 con valores aislados (por la naturaleza estocástica de las partidas), pero verifican invariantes de combo, score, atomicidad y determinismo. La función auxiliar `lineClearScore` que aparecía en el código fue eliminada por lint (no usada) sin afectar a la cobertura.

## Deuda técnica identificada

- Los valores de la tabla de puntos (100/300/500/800) y la fórmula de combo (50 * (combo-1)) están como constantes internas de `packages/game-engine`. Si en el futuro se introducen perfiles de batalla reales con recompensas distintas por perfil, deberán moverse a `packages/game-config`.
- `maxCombo` (combo máximo alcanzado) no se implementó porque ningún consumidor real lo necesita en esta tarea; queda como candidato natural para una futura pantalla de resultados.

## Validación manual pendiente

Pendiente de confirmación por el usuario: puntuación y combo correctos tras eliminar líneas jugando manualmente, coherencia tras pausa/reinicio, ausencia de parpadeo o incoherencia visual en `ScorePanel.vue`.

## Confirmación de exclusión

No se implementó energía de combate, T-Spins, back-to-back, sabotajes, bot, batalla, backend, persistencia, pantalla de resultados, animaciones, audio ni ningún otro elemento listado en §6 de la especificación.

## Confirmación de no commits

No se realizó ningún commit durante la implementación.
