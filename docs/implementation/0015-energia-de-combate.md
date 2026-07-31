# Informe de implementación — Tarea 0015 — Energía de combate

## Resumen

Se ha implementado el sistema de energía de combate determinista en `packages/game-engine`, exponiéndolo en el snapshot inmutable y transmitiéndolo al estado de presentación de Vue (`GamePresentationState`).

La energía se acumula en el motor por acciones ofensivas (eliminaciones de líneas de 1 a 4 líneas, T-Spins con y sin líneas, combos y jugadas back-to-back consecutivas), con una capacidad máxima fija de `100` unidades (`COMBAT_ENERGY_MAX`). En esta tarea la energía es puramente acumulativa y determinista; no hay mecanismos de consumo ni sabotajes funcionales.

---

## Archivos creados y modificados

### Creados
- `docs/implementation/0015-energia-de-combate.md` (este documento).

### Modificados
- `packages/game-engine/src/index.ts`:
  - Definición de constantes `COMBAT_ENERGY_MAX`, `LINE_CLEAR_ENERGY`, `T_SPIN_ENERGY`, `COMBO_ENERGY_BONUS_PER_STEP`, `COMBO_ENERGY_BONUS_CAP`, `BACK_TO_BACK_ENERGY_BONUS_RATIO`.
  - Inclusión de `combatEnergy: number` en `EngineSnapshot`.
  - Estado interno `let combatEnergy = 0;` en `createGameEngine`.
  - Actualización atómica de energía en `lockAndProcess()`.
  - Exposición de `combatEnergy` en `getSnapshot()` y reinicio a `0` en `reset()`.
- `packages/game-engine/src/game-engine.test.ts`:
  - Pruebas deterministas de `combatEnergy` (tabla base, combos, B2B, T-Spins, reset, gameOver, saturación, no doble aplicación).
- `apps/web/src/game/types.ts`:
  - Inclusión de `combatEnergy: number` en `GamePresentationState`.
- `apps/web/src/game/scenes/GameScene.ts`:
  - Propagación de `snap.combatEnergy` a `newState` y comparación en `notifyState()`.
- `apps/web/src/components/ScorePanel.vue`:
  - Cuarta fila para el valor numérico de `combatEnergy` con `data-testid="combatEnergy-value"`.
- `apps/web/src/components/ScorePanel.test.ts`:
  - Pruebas para la prop `combatEnergy` y verificación del valor numérico renderizado.
- `apps/web/src/components/CombatStatusPanel.vue`:
  - Integración de `combatEnergy?: number` para controlar los 7 segmentos dinámicos de la barra de energía táctica (`Math.floor(combatEnergy / 100 * 7)`).
- `apps/web/src/components/CombatStatusPanel.test.ts`:
  - Pruebas del cálculo de segmentos según `combatEnergy` (0, 50, 100).
- `apps/web/src/App.vue`:
  - Estado inicial `combatEnergy: 0` en `gameState` y enlace con `ScorePanel` y `CombatStatusPanel`.
- `apps/web/src/App.test.ts`:
  - Actualización de los mocks de `GamePresentationState` con `combatEnergy: 0`.
- `apps/web/src/game/types.test.ts`:
  - Verificación de la estructura extendida de `GamePresentationState` (9 campos).
- `docs/project-status.md`:
  - Actualización del estado global del proyecto registrando la tarea 0015 completada.

---

## Decisiones relevantes

1. **Tabla de generación base**:
   - Single: 10
   - Double: 25
   - Triple: 45
   - Quad: 70
   - T-Spin sin líneas: 0
   - T-Spin Single: 25
   - T-Spin Double: 50
   - T-Spin Triple: 75
   - Fijación sin líneas: 0
2. **Bonificación de combo**: `min(combo - 1, 5) * 3` (máximo 15 unidades por jugada).
3. **Bonificación de back-to-back**: `floor(baseEnergy * 0.25)` calculado exclusivamente sobre la energía base.
4. **Fórmula atómica acumulativa**: `generatedEnergy = baseEnergy + comboEnergyBonus + backToBackEnergyBonus`, con saturación `combatEnergy = Math.min(100, combatEnergy + generatedEnergy)`. Excedente descartado.
5. **Comportamiento en sesión**: `reset()` restaura `combatEnergy` a 0. `gameOver` conserva el valor final congelado en el snapshot.

---

## API pública producida

- `EngineSnapshot`: expone `combatEnergy: number`.
- `GamePresentationState`: expone `combatEnergy: number`.
- Componentes Vue `ScorePanel.vue` y `CombatStatusPanel.vue`: aceptan prop `combatEnergy`.

---

## Pruebas añadidas

- Cobertura completa de la suite de `combatEnergy` en `game-engine.test.ts` (13 casos deterministas con valores exactos).
- Pruebas en `ScorePanel.test.ts` para verificar renderizado en `data-testid="combatEnergy-value"`.
- Pruebas en `CombatStatusPanel.test.ts` para verificar la activación de segmentos de la barra en HSL/cian (0 de 7 con 0%, 3 de 7 con 50%, 7 de 7 con 100%).
- Pruebas en `types.test.ts` para la interfaz `GamePresentationState`.

Total final de la suite: **471 tests pasando en 19 archivos**.

---

## Comandos ejecutados y resultados

- `pnpm test`: 471 passed.
- `pnpm lint`: 0 errors, 0 warnings.
- `pnpm typecheck`: Clean (3 workspace packages).
- `pnpm build`: Build exitoso en `@rautfall/web`.
- `pnpm test:e2e`: 1 passed (`essential-flow.spec.ts`).
- `git diff --check`: Sin conflictos de espaciado.
- `git status --short`: Muestra archivos modificados y creados limpios de temporales.

---

## Desviaciones

Ninguna. La implementación sigue exactamente la especificación inmutable `docs/tasks/0015-energia-de-combate.md`.

---

## Trabajo pendiente

- Tarea 0016: Consumo de energía y mecanismo de sabotajes funcionales.

---

## Confirmación del alcance excluido

Se confirma la exclusión estricta de:
- Consumo de energía ni mecanismos de descarga.
- Sabotajes funcionales.
- Eventos de dominio nuevos.
- Segundo tablero, bot ni backend.
- Modificador de energía de la muerte súbita.
- Audio, animaciones de llenado o configuración editable por usuario.
