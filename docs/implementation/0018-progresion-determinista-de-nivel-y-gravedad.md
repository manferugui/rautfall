# Informe de implementación — Tarea 0018 — Progresión determinista de nivel y gravedad

## Resumen

Se ha implementado la **progresión determinista de nivel y gravedad** en `packages/game-engine` y su integración en `apps/web`.

El motor calcula de forma atómica el nivel ($1..10$) tras cada eliminación de líneas mediante:
$$\text{level} = \min\left(10, \lfloor \frac{\text{clearedLines}}{10} \rfloor + 1\right)$$

Se aplica la tabla discreta oficial de gravedad base (`baseGravityCellsPerSecond`), desde $1.00\text{ c/s}$ (Nivel 1) hasta $10.00\text{ c/s}$ (Nivel 10). La gravedad activa (`activeGravityCellsPerSecond`) multiplica la gravedad base por 3 cuando **Sobrecarga** está activa. El movimiento por Soft Drop permanece estrictamente inalterado en `config.softDropCellsPerSecond`. Se expone `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond` en `EngineSnapshot` y en `GamePresentationState`, se emite el evento de dominio `levelUp` una sola vez al cambiar de nivel, y se presentan el nivel y la gravedad activa en `ScorePanel.vue`. Se añaden los modos demo de desarrollo `?level-demo=1` y `?level-demo=10`.

---

## Archivos creados y modificados

### Creados
- `docs/implementation/0018-progresion-determinista-de-nivel-y-gravedad.md` (este documento).
- `apps/web/src/game/level-demo.ts`: Módulo de demostración para escenarios cerrados `?level-demo=1` y `?level-demo=10`.
- `apps/web/src/game/level-demo.test.ts`: Pruebas de los escenarios de demostración de nivel.

### Modificados
- `packages/game-engine/src/index.ts`:
  - Definición de `MAX_LEVEL = 10` y `BASE_GRAVITY_TABLE` (Niveles 1 a 10: $1.00$ a $10.00\text{ c/s}$).
  - Extensión de `EngineSnapshot` con `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.
  - Definición del evento de dominio `LevelUpEvent` (`levelUp`).
  - Extensión de `TSpinDemoInitialState` con `clearedLines?: number`.
  - Recálculo de nivel y emisión única de `levelUp` en `lockAndProcess()`.
  - Cálculo de gravedad activa en `processVertical()` multiplicando por 3 durante Sobrecarga sin alterar Soft Drop.
  - Restablecimiento en `reset()`.
- `packages/game-engine/src/game-engine.test.ts`:
  - Suite de pruebas unitarias deterministas completas para la Tarea 0018 (umbrales de nivel, tabla de gravedades, Sobrecarga $3\times$, Soft Drop estricto, invarianza de lock delay por configuración, emisión única de `levelUp`, ausencia de evento si no varía el nivel, congelación en pausa/gameOver y determinismo).
- `apps/web/src/game/types.ts`:
  - Extensión de `GamePresentationState` con `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.
- `apps/web/src/game/types.test.ts`:
  - Actualización de las especificaciones de `GamePresentationState` (15 propiedades).
- `apps/web/src/game/scenes/GameScene.ts`:
  - Integración de `getLevelDemoTarget()` y `createLevelDemoEngine()` en `resetEngine()`.
  - Forwarding de `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond` en `notifyState()`.
- `apps/web/src/components/ScorePanel.vue` y `apps/web/src/components/ScorePanel.test.ts`:
  - Presentación de `Nivel` y `Gravedad` (`activeGravityCellsPerSecond.toFixed(2) c/s`) y suite de pruebas del componente.
- `apps/web/src/App.vue` y `apps/web/src/App.test.ts`:
  - Declaración inicial de `level` y gravedades en `gameState`, propagación de props a `ScorePanel` y pruebas de integración.
- `docs/project-status.md`:
  - Registro de la Tarea 0018 completada con enlace a este informe de implementación.

---

## Modos de demostración de desarrollo (`?level-demo=1` y `?level-demo=10`)

- **URLs de activación**:
  - `http://localhost:5173/?level-demo=1` (Nivel 1 con 9 líneas y tablero listo para limpiar 1 línea al fijar la pieza I).
  - `http://localhost:5173/?level-demo=10` (Nivel 10 con 90 líneas acumuladas y gravedad a $10.00\text{ c/s}$).

---

## Decisiones relevantes

1. **Tabla de gravedad base discreta**:
   - Nivel 1: $1.00\text{ c/s}$
   - Nivel 2: $1.25\text{ c/s}$
   - Nivel 3: $1.50\text{ c/s}$
   - Nivel 4: $2.00\text{ c/s}$
   - Nivel 5: $2.50\text{ c/s}$
   - Nivel 6: $3.00\text{ c/s}$
   - Nivel 7: $4.00\text{ c/s}$
   - Nivel 8: $5.00\text{ c/s}$
   - Nivel 9: $7.00\text{ c/s}$
   - Nivel 10: $10.00\text{ c/s}$
2. **Gravedad activa y Sobrecarga**:
   - `activeGravityCellsPerSecond = hasSobrecarga ? baseGravityCellsPerSecond * 3 : baseGravityCellsPerSecond`.
3. **Soft Drop estricto**:
   - Con `input.softDropHeld === true`, la velocidad activa es estrictamente `config.softDropCellsPerSecond`, sin alterar por Sobrecarga o nivel.
4. **Lock delay inalterado por configuración**:
   - `config.lockDelayMs` y `config.maxLockResets` no son modificados por la progresión de nivel ni contienen literales harcodeados en la lógica de nivel.
5. **Origen exclusivo de la gravedad base**:
   - `baseGravityCellsPerSecond` depende exclusivamente del nivel actual a través de la tabla determinista (`BASE_GRAVITY_TABLE`). `config.gravityCellsPerSecond` no participa en el cálculo de la gravedad base de ningún nivel (Nivel 1 siempre es estrictamente $1.00\text{ c/s}$).

---

## API pública producida

- `LevelUpEvent`: `{ type: 'levelUp', step: number, previousLevel: number, newLevel: number, baseGravityCellsPerSecond: number }`.
- `EngineSnapshot`: contiene `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.
- `GamePresentationState`: contiene `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.

---

## Pruebas añadidas

- 14 pruebas deterministas de motor para la Tarea 0018 en `packages/game-engine/src/game-engine.test.ts` (incluyendo prueba explícita con configuración alternativa `gravityCellsPerSecond: 2` demostrando la ausencia de caídas anormales de velocidad entre Nivel 1 y Nivel 2).
- 6 pruebas del escenario demo `level-demo.test.ts`.
- Pruebas actualizadas de `GamePresentationState` (15 propiedades) en `apps/web/src/game/types.test.ts`.
- Pruebas del componente `ScorePanel.vue` para nivel y gravedad en `apps/web/src/components/ScorePanel.test.ts`.
- Pruebas de integración de props en `apps/web/src/App.test.ts`.

---

## Comandos ejecutados y resultados

- `pnpm test`: 530 tests pasando (22 test files en verde).
- `pnpm lint`: 0 errores, 0 avisos.
- `pnpm typecheck`: Limpio (los 3 paquetes).
- `pnpm build`: Build exitoso en `@rautfall/web`.
- `pnpm test:e2e`: Test E2E pasando.
- `git diff --check`: Sin conflictos de espaciado.

---

## Confirmación del alcance excluido

Se confirma estrictamente que:
- No se implementó muerte súbita.
- No se modificó el multiplicador de puntuación por nivel.
- No se añadieron nuevos sabotajes, bot IA, segundo tablero ni multijugador.
