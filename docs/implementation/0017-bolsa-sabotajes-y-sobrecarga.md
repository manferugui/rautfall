# Informe de implementación — Tarea 0017 — Bolsa de sabotajes y Sobrecarga

## Resumen

Se ha implementado el segundo sabotaje funcional (**Sobrecarga** / `'sobrecarga'`), la bolsa determinista de 2 sabotajes (**Sabotage 2-Bag**) (`['residuos', 'sobrecarga']`), la gestión de **efectos activos temporales** (`activeEffects: readonly ActiveEffectSnapshot[]`) en `packages/game-engine`, la aceleración $3\times$ determinista de la gravedad pasiva sin afectar soft drop, hard drop, DAS, ARR, SRS o lock delay, la emisión de eventos de dominio `effectStarted` y `effectExpired`, la presentación del bloque `EFECTOS ACTIVOS` en `CombatStatusPanel.vue` (mostrando `SOBRECARGA Ns`), la adaptación del estado de presentación en `apps/web`, y los modos demo de desarrollo `?overload-demo=1` y `?garbage-demo=1` para la validación manual aislada de Sobrecarga y Residuos.

---

## Archivos creados y modificados

### Creados
- `docs/implementation/0017-bolsa-sabotajes-y-sobrecarga.md` (este documento).
- `apps/web/src/game/overload-demo.ts`: Módulo de demostración para el escenario cerrado `?overload-demo=1`.
- `apps/web/src/game/overload-demo.test.ts`: Pruebas del modo de demostración de desarrollo `overload-demo`.
- `apps/web/src/game/garbage-demo.ts`: Módulo de demostración para el escenario cerrado `?garbage-demo=1`.
- `apps/web/src/game/garbage-demo.test.ts`: Pruebas del modo de demostración de desarrollo `garbage-demo`.

### Modificados
- `packages/game-engine/src/index.ts`:
  - Extensión del tipo exportado `SabotageType = 'residuos' | 'sobrecarga'`.
  - Definición de tipos `ActiveEffectType = 'sobrecarga'` y `ActiveEffectSnapshot`.
  - Eventos de dominio `EffectStartedEvent` (`effectStarted`) y `EffectExpiredEvent` (`effectExpired`).
  - Extensión de `EngineSnapshot` con `activeEffects: readonly ActiveEffectSnapshot[]`.
  - Extensión de `TSpinDemoInitialState` con `combatEnergy?: number`.
  - Implementación de la bolsa determinista de 2 sabotajes (`Sabotage 2-Bag`) mediante `ALL_SABOTAGES = ['residuos', 'sobrecarga']`, `prng()` y el algoritmo Fisher–Yates.
  - Implementación de `receiveSabotage('sobrecarga')`: activación o renovación a 10.000 ms e igual emisión del evento `effectStarted`.
  - Descuento del temporizador en `step()` mediante `config.fixedStepMs` y emisión de `effectExpired` al expirar.
  - Multiplicador $3\times$ de gravedad pasiva en `processVertical()` sin alterar la velocidad explícita de `softDropHeld` (`config.softDropCellsPerSecond`).
  - Limpieza de `activeEffects` en `reset()`.
- `packages/game-engine/src/game-engine.test.ts`:
  - Suite de pruebas unitarias deterministas completas para la Tarea 0017 (2-bag determinista, recepción y activación de Sobrecarga, descuento temporal en `step()`, expiración única, renovación con reemisión de `effectStarted`, aceleración $3\times$ de gravedad pasiva, invarianza de soft drop, pausa, reset y game over).
- `apps/web/src/game/types.ts`:
  - Extensión de `GamePresentationState` con `activeEffects: readonly ActiveEffectSnapshot[]`.
- `apps/web/src/game/types.test.ts`:
  - Actualización de la especificación de `GamePresentationState` (12 propiedades).
- `apps/web/src/game/scenes/GameScene.ts`:
  - Inclusión de `activeEffects` en `GamePresentationState` y comprobación de igualdad profunda en `notifyState()`.
  - Integración de los modos de demostración `isOverloadDemoActive()`, `isGarbageDemoActive()`, `createOverloadDemoEngine()` y `createGarbageDemoEngine()` en `resetEngine()` y en el procesamiento de eventos `sabotageTriggered`.
- `apps/web/src/components/CombatStatusPanel.vue` y `apps/web/src/components/CombatStatusPanel.test.ts`:
  - Prop `activeEffects`, renderizado del bloque `EFECTOS ACTIVOS` en la consola táctica mostrando `SOBRECARGA Ns` con `Math.ceil(remainingMs / 1000)` (o `NINGUNO`), y suite de pruebas del componente.
- `apps/web/src/App.vue` y `apps/web/src/App.test.ts`:
  - Declaración inicial de `activeEffects` en `gameState`, propagación de `:active-effects="gameState.activeEffects"` a `CombatStatusPanel`, y pruebas unitarias de `App`.
- `docs/project-status.md`:
  - Registro de la Tarea 0017 completada con enlace a este informe de implementación.

---

## Modos de demostración de desarrollo (`?overload-demo=1` y `?garbage-demo=1`)

### Demo de Sobrecarga (`?overload-demo=1`)
- **URL de activación**: `http://localhost:5173/?overload-demo=1` (solo en entorno DEV).
- **Contrato**:
  - Arranca con Sobrecarga activa a **10.000 ms** (`remainingMs = 10000`).
  - Arranca con el cartucho cargado con `['sobrecarga', 'sobrecarga']`.
  - El panel `EFECTOS ACTIVOS` muestra de inmediato `SOBRECARGA 10s`.
  - La gravedad pasiva se acelera a **3×**.
  - Al pulsar **`A`**, se consume el sabotaje del cartucho y se renueva el efecto a **10.000 ms** sin duplicados.
  - Al pulsar **`Esc`**, la sesión pasa a `paused` y se congela el temporizador.
  - Al transcurrir 10s, expira y pasa a `NINGUNO`.
  - Al pulsar **`R`**, restablece la demo limpia.

### Demo de Residuos (`?garbage-demo=1`)
- **URL de activación**: `http://localhost:5173/?garbage-demo=1` (solo en entorno DEV).
- **Contrato**:
  - Arranca con `pendingGarbage = 2` (2 filas encoladas por aplicar).
  - Arranca con el cartucho cargado con `['residuos', 'residuos']`.
  - Arranca con celdas preparadas en filas 22 y 23 para visualizar claramente la subida vertical.
  - No inserta celdas `garbage` antes de la primera fijación.
  - Al fijar la primera pieza (Hard Drop / Space): inserta exactamente 2 filas de basura abajo (9 celdas `garbage` y 1 hueco por fila), desplaza las celdas preparadas 2 filas arriba y deja `pendingGarbage = 0`.
  - Al pulsar **`A`**: consume un sabotaje `residuos` del cartucho y encola nuevamente `pendingGarbage = 2`.
  - Al pulsar **`R`**: restaura el escenario inicial completo.

---

## Decisiones relevantes

1. **Bolsa determinista 2-bag**:
   - `ALL_SABOTAGES = ['residuos', 'sobrecarga']`.
   - Se baraja con Fisher–Yates mediante el PRNG determinista de la partida (`prng()`).
   - Cada ciclo entrega ambos sabotajes exactamente una vez antes de reponer y barajar la bolsa.
2. **Activación y renovación de Sobrecarga**:
   - `receiveSabotage('sobrecarga')` activa inmediatamente el efecto con `remainingMs = 10000` y emite `effectStarted`.
   - Si Sobrecarga ya está activa, restablece `remainingMs = 10000` y reemite `effectStarted`. No crea efectos duplicados en `activeEffects` ni apila multiplicadores de velocidad ($3\times$ constante).
3. **Fórmula de gravedad y soft drop**:
   - `activeGravity = hasSobrecarga ? gravityCellsPerSecond * 3 : gravityCellsPerSecond`.
   - `activeCellsPerSecond = input.softDropHeld ? softDropCellsPerSecond : activeGravity`.
   - Soft drop, hard drop, DAS, ARR, SRS y lock delay permanecen inalterados.
4. **Descuento temporal y pausa/reset/gameOver**:
   - `remainingMs = Math.max(0, remainingMs - config.fixedStepMs)`.
   - La pausa suspende las llamadas a `step()`, conservando `remainingMs`.
   - `gameOver` congela `activeEffects` en el snapshot.
   - `reset()` restablece `activeEffects = []`.

---

## API pública producida

- `SabotageType`: `'residuos' | 'sobrecarga'`.
- `ActiveEffectType`: `'sobrecarga'`.
- `ActiveEffectSnapshot`: `{ type: ActiveEffectType, remainingMs: number }`.
- `EngineSnapshot`: contiene `activeEffects: readonly ActiveEffectSnapshot[]`.
- `GamePresentationState`: contiene `activeEffects: readonly ActiveEffectSnapshot[]`.
- Eventos de motor:
  - `{ type: 'effectStarted', step: number, effect: ActiveEffectType, durationMs: number }`.
  - `{ type: 'effectExpired', step: number, effect: ActiveEffectType }`.

---

## Pruebas añadidas

- Suite completa de pruebas unitarias deterministas para la Tarea 0017 en `packages/game-engine/src/game-engine.test.ts`.
- Pruebas del modo demo `overload-demo` en `apps/web/src/game/overload-demo.test.ts`.
- Pruebas del modo demo `garbage-demo` en `apps/web/src/game/garbage-demo.test.ts`.
- Pruebas de `GamePresentationState` (12 propiedades) en `apps/web/src/game/types.test.ts`.
- Pruebas del componente `CombatStatusPanel.vue` para el bloque de efectos activos en `apps/web/src/components/CombatStatusPanel.test.ts`.
- Pruebas de propagación de props y estado en `apps/web/src/App.test.ts`.

---

## Comandos ejecutados y resultados

- `pnpm test`: Pasan todas las pruebas unitarias en el monorepo (507 tests pasando).
- `pnpm lint`: 0 errores, 0 avisos.
- `pnpm typecheck`: Limpio (los 3 paquetes: game-config, game-engine, apps/web).
- `pnpm build`: Build exitoso en `@rautfall/web`.
- `pnpm test:e2e`: Test E2E esencial pasando.
- `git diff --check`: Sin conflictos de espaciado.

---

## Desviaciones

Ninguna. La implementación cumple exactamente con las especificaciones inmutables definidas en `AGENTS.md` y `docs/tasks/0017-bolsa-sabotajes-y-sobrecarga.md`.

---

## Confirmación del alcance excluido

Se confirma estrictamente que:
- No se implementaron los sabotajes Interferencia ni Polaridad inversa.
- No se añadió un segundo tablero interactivo ni bot IA.
- No se introdujo multijugador, backend, conexión en red, audio ni animaciones complejas.
