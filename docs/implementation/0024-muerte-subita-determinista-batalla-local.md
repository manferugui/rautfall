# Informe de Implementación — Tarea 0024: Muerte súbita determinista en la batalla local

## Resumen

Se ha diseñado e implementado el modelo determinista de temporización y fases de Muerte Súbita para el modo de Batalla Local en `@rautfall/battle-engine`, respaldado por una extensión general desacoplada de modificadores externos (`EngineModifiers`) en `@rautfall/game-engine`. La Muerte Súbita transiciona por las fronteras temporales exactas acordadas en `docs/rautfall.md` (aviso desde 04:45, inicio a 05:00 con Fases 1, 2 y 3 de aceleración de gravedad y ganancia de energía $\times 1.20$), emitiendo eventos de hecho transitorio una sola vez por transición, aplicando la misma presión sobre ambos participantes y conservando intacta la condición de victoria por eliminación o empate simultáneo.

## Archivos Creados y Modificados

- **[NEW]** `apps/web/e2e/sudden-death.spec.ts`: Suite E2E de Playwright que valida el escenario DEV determinista de Muerte Súbita.
- **[NEW]** `docs/implementation/0024-muerte-subita-determinista-batalla-local.md`: Este informe de implementación.
- **[MODIFY]** `packages/game-engine/src/index.ts`: Definición e integración del tipo exportado `EngineModifiers` y ampliación opcional de `StepInput` (`modifiers?: EngineModifiers`).
- **[MODIFY]** `packages/game-engine/src/game-engine.test.ts`: Pruebas unitarias para la aplicación determinista de `EngineModifiers` sobre gravedad y ganancia de energía.
- **[MODIFY]** `packages/battle-engine/src/index.ts`: Definición de `SuddenDeathPhase`, `SuddenDeathSnapshot`, función `computeSuddenDeath`, integración en `BattleSnapshot.suddenDeath`, emisión única de eventos transitorios e inyección simétrica de modificadores en `BattleSession.step()`.
- **[MODIFY]** `packages/battle-engine/src/battle-engine.test.ts`: Pruebas unitarias e integración de Muerte Súbita (fronteras exactas 04:45, 05:00, 05:30 y 06:00, eventos únicos, simetría P1/P2, composición con Sobrecarga, energía $\times 1.20$, victorias y empate simultáneo).
- **[MODIFY]** `apps/web/src/game/battle-demo.ts`: Incorporación de `isSuddenDeathDemoActive` y avance inicial del tiempo en DEV para `?battle-demo=1&sudden-death-demo=1`.
- **[MODIFY]** `apps/web/src/game/battle-demo.test.ts`: Pruebas unitarias de `isSuddenDeathDemoActive`.
- **[MODIFY]** `docs/project-status.md`: Actualización del estado del proyecto al completar la Tarea 0024.

## Decisiones Relevantes

1. **Desacoplamiento de Muerte Súbita en `@rautfall/game-engine`**:
   `@rautfall/game-engine` desconoce por completo el concepto de Muerte Súbita o `BattleSession`. Solo expone el contrato genérico `EngineModifiers` a través de `StepInput.modifiers`, permitiendo inyectar multiplicadores externos de gravedad y energía de forma limpia y retrocompatible.

2. **Composición determinista de gravedad y energía**:
   - Gravedad activa: `baseGravityCellsPerSecond * (hasSobrecarga ? 3 : 1) * (input.modifiers?.gravityMultiplier ?? 1)`.
   - Energía generada: `Math.floor((baseEnergy + comboEnergyBonus + backToBackEnergyBonus) * (input.modifiers?.energyMultiplier ?? 1))`. La política de redondeo aplica `Math.floor` garantizando enteros deterministas sin acumulación de residuos flotantes.

3. **Conservación estricta de `BattleStatus`**:
   `BattleStatus` mantiene sus cuatro valores originales (`'running' | 'playerOneWon' | 'playerTwoWon' | 'draw'`). El estado de Muerte Súbita se expone separadamente en `BattleSnapshot.suddenDeath: SuddenDeathSnapshot`.

4. **Transiciones temporales exactas**:
   - `00:00.000` a `04:44.990` ($0 \le t < 285.000$ ms): `'inactive'`, multiplicadores 1.0 / 1.0.
   - `04:45.000` a `04:59.990` ($285.000 \le t < 300.000$ ms): `'warning'`, `warningRemainingMs = 300_000 - t`, multiplicadores 1.0 / 1.0. Emisión única de `suddenDeathWarning`.
   - `05:00.000` a `05:29.990` ($300.000 \le t < 330.000$ ms): `'phase1'`, gravedad $\times 1.15$, energía $\times 1.20$. Emisión única de `suddenDeathStarted`.
   - `05:30.000` a `05:59.990` ($330.000 \le t < 360.000$ ms): `'phase2'`, gravedad $\times 1.30$, energía $\times 1.20$. Emisión única de `suddenDeathPhaseChanged`.
   - $\ge 06:00.000$ ($t \ge 360.000$ ms): `'phase3'`, gravedad $\times 1.50$, energía $\times 1.20$. Emisión única de `suddenDeathPhaseChanged`.

5. **Alineación con pausa y guardas DEV**:
   - La pausa permanece en `apps/web`, que detiene las llamadas a `step()`, congelando `elapsedMs`.
   - Flag DEV `?battle-demo=1&sudden-death-demo=1` protegido por `import.meta.env.DEV` avanza `elapsedMs` a 04:40 para pruebas inmediatas.

## API Pública Producida

Exportaciones ampliadas en `@rautfall/game-engine`:
- `EngineModifiers`: Tipo público para multiplicadores externos de gravedad y energía.
- `StepInput.modifiers?: EngineModifiers`: Campo opcional en la entrada de paso individual.

Exportaciones producidas en `@rautfall/battle-engine`:
- `SuddenDeathPhase`: `'inactive' | 'warning' | 'phase1' | 'phase2' | 'phase3'`
- `SuddenDeathSnapshot`: Instantánea de estado de Muerte Súbita.
- `computeSuddenDeath(elapsedMs)`: Función pura de derivación de Muerte Súbita.
- `BattleSnapshot.suddenDeath`: Exposición de la instantánea de Muerte Súbita.
- Eventos de Muerte Súbita en `BattleEvent`: `suddenDeathWarning`, `suddenDeathStarted`, `suddenDeathPhaseChanged`.

## Pruebas y Validación Realizadas

- **Pruebas unitarias de modificadores en motor individual**: Verificación de inyección de multiplicadores de gravedad y energía en `game-engine.test.ts`.
- **Pruebas unitarias de Muerte Súbita**: Verificación de fronteras exactas (04:45, 05:00, 05:30, 06:00), emisión única de eventos, simetría P1/P2, composición con Sobrecarga, victorias individuales, empate simultáneo y reset en `battle-engine.test.ts`.
- **Suite completa Vitest**: Todos los 698 tests pasando en verde.
- **Pruebas E2E de Playwright**: Pruebas pasando en Chromium (`sudden-death.spec.ts`).
- **Validaciones globales**: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`, `git diff --check` y `git status --short` finalizan limpiamente.

## Alcance Excluido Confirmado

- Sin límite máximo arbitrario de duración (`maxBattleDurationMs`).
- Sin desempates artificiales por altura o puntuación.
- Sin filas basura automáticas.
- Sin menú principal, pantallas de resultados ni modales visuales en `apps/web`.
- Sin backend, networking ni replays.
