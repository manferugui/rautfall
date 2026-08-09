# Informe de implementación — Tarea 0027: Cierre de protecciones y mecánicas pendientes de combate del MVP

## 1. Resumen

Se han cerrado y auditado todas las protecciones y mecánicas pendientes de combate del MVP en Rautfall:

1. **Sabotaje Interferencia (5.000 ms)**: Implementado como sabotaje de percepción en `packages/battle-engine` con bolsa determinista `Sabotage 4-Bag` en `packages/game-engine`.
2. **Aviso previo de sabotajes (Warning 750 ms)**: Implementado como estado previo explícito de 750 ms de tiempo lógico para sabotajes temporales disruptivos/percepción (`sobrecarga`, `polaridad`, `interferencia`). `residuos` no participa en warning.
3. **Inmunidad post-efecto (4.000 ms)**: Implementada como protección lógica de 4.000 ms que se activa tras la expiración de un efecto temporal y bloquea re-ataques del mismo sabotaje emitiendo `sabotageBlocked`.
4. **Límite máximo de basura pendiente (Garbage Cap)**: Saturación en 4 filas pendientes máximo (`MAX_PENDING_GARBAGE = 4`) en `packages/game-engine` al recibir nueva basura.
5. **Equivalencia Humano/Bot y Percepción unívoca**: En el cliente web, `OpponentMonitor.vue` muestra el velo `SEÑAL INTERFERIDA` sobre el monitor rival. En el bot (`DeterministicBot`), `battle-engine` congela la instantánea percibida del rival al momento en que comienza Interferencia, impidiéndole leer datos actualizados durante los 5 s del efecto.
6. **Validación integral**: 761 pruebas Vitest, 9 pruebas E2E de Playwright, `lint`, `typecheck` y `build` superados con 0 errores y 0 warnings.

---

## 2. Archivos Creados y Modificados

### Creados
- `docs/implementation/0027-cierre-protecciones-y-mecanicas-de-combate.md`

### Modificados
- `packages/game-engine/src/index.ts`
- `packages/game-engine/src/game-engine.test.ts`
- `packages/battle-engine/src/index.ts`
- `packages/battle-engine/src/battle-engine.test.ts`
- `packages/battle-engine/src/bot/types.ts`
- `packages/battle-engine/src/bot/sabotage-policy.ts`
- `apps/web/src/game/types.ts`
- `apps/web/src/game/opponent-mapper.ts`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/src/components/OpponentMonitor.vue`
- `apps/web/src/components/OpponentMonitor.test.ts`
- `docs/project-status.md`

---

## 3. Decisiones Relevantes

### 3.1. Orden canónico exacto de `BattleSession.step()`
Para resolver inequívocamente expiraciones que ocurren en el mismo paso y evitar que nuevos temporizadores pierdan tiempo en su paso de creación, se estableció el siguiente orden determinista:

1. **Pre-validación de entradas** (`validateStepInput`).
2. **Avance temporal del paso** (`step++`, `elapsedMs += config.fixedStepMs`).
3. **Muerte súbita** (cálculo y notificación de cambios de fase).
4. **Actualización de temporizadores existentes (creados en steps ANTERIORES)**:
   - **a) Efectos de Interferencia activos**: Decrementar `remainingMs` por `fixedStepMs`. Si llega a 0 $\to$ emitir `interferenciaExpired` e iniciar **Inmunidad post-efecto** para `interferencia` con `remainingMs = 4000` (`createdStep = step`).
   - **b) Inmunidades activas**: Decrementar `remainingMs` por `fixedStepMs`. Si llega a 0 $\to$ eliminar e emitir `immunityExpired`.
   - **c) Warnings activos**: Decrementar `remainingMs` por `fixedStepMs`. Si llega a 0 $\to$ emitir `warningExpired`. Verificar inmunidad del objetivo: si es inmune $\to$ `sabotageBlocked`. Si no es inmune $\to$ activar efecto (llamar a `receiveSabotage()` o iniciar Interferencia con congelación de percepción).
5. **Ejecución de los motores de juego individuales** (`playerOneEngine.step()`, `playerTwoEngine.step()`).
6. **Drenaje de eventos de los motores**: Detectar `effectExpired` de `sobrecarga` y `polaridad` $\to$ iniciar **Inmunidad post-efecto** en `battle-engine` con `remainingMs = 4000` (`createdStep = step`).
7. **Verificación de terminalidad** (`gameOver` $\to$ `battleEnded`).
8. **Procesamiento y ruteo de nuevos sabotajes disparados en este step**:
   - `residuos` $\to$ `receiveSabotage('residuos')` inmediato.
   - Sabotajes temporales $\to$ verificar inmunidad, efecto activo o warning pendiente. Si aplica $\to$ `sabotageBlocked`. Si no $\to$ iniciar warning (`remainingMs = 750`, `createdStep = step`) e emitir `warningStarted`.
9. **Actualización de la percepción de ambos participantes**:
   - Si un participante está interferido $\to$ conservar exactamente la foto congelada existente.
   - Si no está interferido $\to$ actualizar desde la instantánea actual del motor rival.

### 3.2. Congelación de percepción unívoca al activar Interferencia
Al expirar el warning de Interferencia y comenzar el efecto en el paso 4.c: `frozenPerceivedOpponentSnapshot` conserva la foto inmediata previa a la activación. Durante el paso 9 de ese mismo step y de los steps subsiguientes durante los 5 s, la percepción no incorpora los cambios reales que realiza el rival en sus motores.

### 3.3. Política contra sabotajes temporales duplicados
- Mismo warning pendiente $\to$ `sabotageBlocked { reason: 'warningPending' }`.
- Mismo efecto activo $\to$ `sabotageBlocked { reason: 'alreadyActive' }`.
- Inmunidad activa $\to$ `sabotageBlocked { reason: 'immunity' }`.
- Cartucho: El emisor extrae y consume el sabotaje del cartucho al dispararlo (`triggerSabotage`). El bloqueo posterior por el objetivo no devuelve la pieza al cartucho ni altera el estado del emisor.

### 3.4. Basura pendiente capada a 4
En `packages/game-engine`: `pendingGarbage = Math.min(4, pendingGarbage + 2)` al recibir Residuos. PRNG, generación de huecos y momento de aplicación se mantienen intactos.

### 3.5. Subescenario DEV de validación manual (`?battle-demo=1&interference-demo=1`)
Para la auditoría directa e inmediata sin depender de varios minutos de juego ni conversiones manuales de energía:
- La query parameter `?battle-demo=1&interference-demo=1` (o `?battle-demo=1&bot-sabotage=interferencia`) precarga a P1 con `storedSabotages: ['interferencia', 'interferencia']`.
- El primer disparo (tecla A) ejecuta el flujo real: `triggerSabotage` $\to$ `sabotageRouted` $\to$ `warningStarted` (750 ms) $\to$ `warningExpired` $\to$ `interferenciaStarted` (5.000 ms con velo `SEÑAL INTERFERIDA`) $\to$ `interferenciaExpired` $\to$ `immunityStarted` (4.000 ms).
- El segundo disparo efectuado durante la inmunidad produce el rechazo real `sabotageBlocked { reason: 'immunity' }`, expuesto en el panel DEV como `Último Bloqueado`.

---

## 4. Pruebas Añadidas

- Pruebas unitarias de `pendingGarbage` cap saturando a 4 y no-op defensivo de Interferencia en `game-engine.test.ts`.
- Pruebas unitarias en `battle-engine.test.ts`:
  - Warning de 750 ms y retraso de activación.
  - Bloqueo de duplicados (`warningPending`, `alreadyActive`, `immunity`).
  - Inmunidad post-efecto de 4.000 ms tras expirar Interferencia/Sobrecarga/Polaridad.
  - Reataques en el paso exacto de expiración y 1 step antes/después.
  - Congelación unívoca de percepción en Interferencia y test de cambio real del rival en el mismo step.
- Pruebas de componente en `OpponentMonitor.test.ts` verificando el velo `SEÑAL INTERFERIDA`.

---

## 5. Validaciones Finales

- `pnpm test`: 37 test files, 761 tests PASS.
- `pnpm lint`: PASS (0 errores, 0 warnings).
- `pnpm typecheck`: PASS en los 4 proyectos del workspace.
- `pnpm build`: PASS (compilación de producción web).
- `pnpm test:e2e`: 9 tests Playwright PASS.
