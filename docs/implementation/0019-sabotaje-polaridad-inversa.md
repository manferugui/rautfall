# Informe de implementación — Tarea 0019 — Sabotaje Polaridad inversa

## Resumen

Se ha implementado el sabotaje determinista **Polaridad inversa** (`'polaridad'`) en `packages/game-engine` y su correspondiente integración y presentación en `apps/web`.

Cuando el efecto de Polaridad está activo, invierte las intenciones de control horizontal (`leftHeld` $\leftrightarrow$ `rightHeld`, `leftPressed` $\leftrightarrow$ `rightPressed`) y la rotación (`rotateClockwise` $\leftrightarrow$ `rotateCounterclockwise`) del jugador (humano o bot) en `StepInput`. El control se transforma dentro de `packages/game-engine` antes de ser procesado por el buffer de entrada, DAS, ARR, SRS y el paso lógico del juego. Los controles de Soft Drop, Hard Drop, Hold y desencadenamiento de sabotajes (`triggerSabotage`) no sufren inversión alguna.

El efecto se consume por contador de piezas (`remainingPieces: 1 | 2`). Se activa inicialmente con 1 pieza (`remainingPieces: 1`, emitiendo `effectStarted` con `durationPieces: 1`). Su renovación incrementa en +1 las piezas restantes hasta un tope máximo de 2 piezas (`remainingPieces: 2`, emitiendo `effectStarted` con `durationPieces: newRemaining`). Al fijarse una pieza activa en el tablero (`lockAndProcess`), el contador decrementa en 1; cuando llega a 0, el efecto es eliminado del motor antes de generar la captura de estado (`EngineSnapshot`) y se emite exactamente un evento `effectExpired`. Las acciones de Hold no decrementan `remainingPieces`.

El contrato de `ActiveEffectSnapshot` y `EffectStartedEvent` utiliza una unión discriminada sin propiedades opcionales ni ambiguas. En `CombatStatusPanel.vue` se presenta la etiqueta `POLARIDAD · 1 PIEZA` o `POLARIDAD · 2 PIEZAS` según corresponda. Además, se añade el escenario de desarrollo de prueba visual `?polarity-demo=1`.

---

## Archivos creados y modificados

### Creados
- `docs/implementation/0019-sabotaje-polaridad-inversa.md` (este documento).
- `apps/web/src/game/polarity-demo.ts`: Módulo de demostración para el escenario cerrado `?polarity-demo=1`.
- `apps/web/src/game/polarity-demo.test.ts`: Pruebas del escenario de demostración de Polaridad.

### Modificados
- `packages/game-engine/src/index.ts`:
  - Incorporación de `'polaridad'` en `SabotageType`, `ActiveEffectType` y `ALL_SABOTAGES` (`['residuos', 'sobrecarga', 'polaridad']`).
  - Definición de unión discriminada para `ActiveEffectSnapshot` (`sobrecarga` con `remainingMs`, `polaridad` con `remainingPieces: 1 | 2`).
  - Definición de unión discriminada para `EffectStartedEvent` (`sobrecarga` con `durationMs`, `polaridad` con `durationPieces: 1 | 2`).
  - Transformación de entrada `StepInput` en `step()` cuando `'polaridad'` está en `activeEffects`.
  - Recálculo/descuento de `remainingPieces` al fijar piezas en `lockAndProcess()`, eliminando el efecto y emitiendo `effectExpired` al llegar a 0.
  - Recepción de sabotaje en `receiveSabotage('polaridad')`, ignorando llamadas si `status === 'gameOver'`.
- `packages/game-engine/src/game-engine.test.ts`:
  - Suite de pruebas unitarias deterministas completas para la Tarea 0019 (activación inicial a 1 pieza, renovación a 2 piezas, tope en 2 piezas, única inversión aplicada, transformación horizontal y rotación, DAS/ARR invertidos, inalteración de Soft/Hard drop/Hold, exención de Hold de decrementos, expiración única tras fijaciones, fallo en entrada inválida previa a transformación, congelación en pausa, reset y descarte de recepción en `gameOver`).
  - Actualización de narrowing en pruebas de Sobrecarga y de la bolsa de 3 sabotajes (3-bag).
- `apps/web/src/components/CombatStatusPanel.vue`:
  - Formateo de `activeEffectsDisplay` para presentar `POLARIDAD · 1 PIEZA` y `POLARIDAD · 2 PIEZAS`.
- `apps/web/src/components/CombatStatusPanel.test.ts`:
  - Pruebas unitarias de renderizado visual para Polaridad a 1 y 2 piezas.
- `apps/web/src/game/overload-demo.test.ts`:
  - Actualización de narrowing para la unión discriminada de `ActiveEffectSnapshot`.
- `apps/web/src/game/scenes/GameScene.ts`:
  - Integración de `isPolarityDemoActive()` y `createPolarityDemoEngine()` en `resetEngine()`.
  - Actualización de la comparación de `activeEffects` en `notifyState()` para la unión discriminada.
- `docs/project-status.md`:
  - Registro de la Tarea 0019 completada con enlace a este informe de implementación.

---

## Modo de demostración de desarrollo (`?polarity-demo=1`)

- **URL de activación**: `http://localhost:5173/?polarity-demo=1`
- **Comportamiento**:
  - Arranca inmediatamente con el efecto **Polaridad** activo (`remainingPieces: 1`) y 2 sabotajes de Polaridad en el cartucho (`storedSabotages: ['polaridad', 'polaridad']`).
  - Permite verificar de forma directa e interactiva la inversión de controles horizontales, giros, DAS/ARR, exención de Hard Drop/Soft Drop/Hold, renovación con la tecla `A` y expiración por fijación de piezas.

---

## Decisiones relevantes

1. **Transformación pura en el motor (`packages/game-engine`)**:
   - Se aprobó que la inversión de controles ocurra al inicio de `step(input)` antes de procesar el buffer de entrada, DAS/ARR o SRS.
   - Aplica exactamente igual a entradas del jugador humano y a futuros bots.
2. **Unión discriminada en contratos**:
   - `ActiveEffectSnapshot` es una unión discriminada estricta (`{ type: 'sobrecarga', remainingMs: number } | { type: 'polaridad', remainingPieces: 1 | 2 }`).
   - `EffectStartedEvent` es una unión discriminada estricta (`{ type: 'effectStarted', step: number, effect: 'sobrecarga', durationMs: number } | { type: 'effectStarted', step: number, effect: 'polaridad', durationPieces: 1 | 2 }`).
3. **Control de renovación y decremento**:
   - Inicial: `remainingPieces: 1`.
   - Renovación: `remainingPieces = Math.min(2, remainingPieces + 1) as 1 | 2`.
   - La fijación de piezas en `lockAndProcess()` decrementa `remainingPieces`. Al llegar a 0, se elimina el efecto **antes** de generar el snapshot del estado y se emite exactamente un evento `effectExpired`.
4. **Respeto a GameOver**:
   - `receiveSabotage()` incluye la guarda `if (status === 'gameOver') return;` al inicio de su ejecución, evitando mutaciones o eventos en estado terminado.

---

## API pública producida

- `SabotageType`: `'residuos' | 'sobrecarga' | 'polaridad'`.
- `ActiveEffectType`: `'sobrecarga' | 'polaridad'`.
- `ActiveEffectSnapshot`:
  ```ts
  export type ActiveEffectSnapshot =
    | Readonly<{ type: 'sobrecarga'; remainingMs: number }>
    | Readonly<{ type: 'polaridad'; remainingPieces: 1 | 2 }>;
  ```
- `EffectStartedEvent`:
  ```ts
  export type EffectStartedEvent =
    | Readonly<{ type: 'effectStarted'; step: number; effect: 'sobrecarga'; durationMs: number }>
    | Readonly<{ type: 'effectStarted'; step: number; effect: 'polaridad'; durationPieces: 1 | 2 }>;
  ```

---

## Pruebas añadidas

- 16 pruebas deterministas de motor para la Tarea 0019 en `packages/game-engine/src/game-engine.test.ts`.
- 8 pruebas del escenario demo `polarity-demo.test.ts`.
- 2 pruebas del componente `CombatStatusPanel.vue` en `apps/web/src/components/CombatStatusPanel.test.ts`.

---

## Comandos ejecutados y resultados

- `pnpm test`: 554 tests pasando (23 test files en verde).
- `pnpm lint`: 0 errores, 0 avisos.
- `pnpm typecheck`: Limpio (los 3 paquetes).
- `pnpm build`: Build exitoso en `@rautfall/web`.
- `pnpm test:e2e`: Test E2E pasando.
- `git diff --check`: Sin errores de formato.

---

## Confirmación del alcance excluido

Se confirma estrictamente que:
- No se añadieron sabotajes no especificados.
- No se implementó bot IA, segundo tablero ni multijugador.
- No se crearon ni ejecutaron scripts temporales fuera de la estructura del proyecto.
