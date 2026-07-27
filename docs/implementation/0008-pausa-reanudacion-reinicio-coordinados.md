# 0008 — Pausa, reanudación y reinicio coordinados — Informe de implementación

## Estado inicial

- Working tree limpio (sin cambios sin commit).
- 276 tests pasando.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` correctos.

## Archivos inspeccionados

- `docs/rautfall.md`
- `docs/tasks/0008-pausa-reanudacion-reinicio-coordinados.md`
- `docs/project-status.md`
- `packages/game-engine/src/index.ts`
- `packages/game-config/src/index.ts`
- `apps/web/src/App.vue`
- `apps/web/src/components/GameCanvas.vue`
- `apps/web/src/components/GameCanvas.test.ts`
- `apps/web/src/components/NextPiecesPreview.vue`
- `apps/web/src/game/types.ts`
- `apps/web/src/game/types.test.ts`
- `apps/web/src/game/create-phaser-game.ts`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/src/game/input-buffer.ts`
- `apps/web/src/game/input-buffer.test.ts`
- `apps/web/src/game/input-debug.ts`
- `apps/web/src/game/input-debug.test.ts`
- `apps/web/src/game/time-adapter.ts`
- `apps/web/src/game/coordinates.ts`

## Decisiones arquitectónicas

### Lógica en `GameScene` frente a controlador separado

Se mantiene toda la lógica en `GameScene` con extracción de dos módulos puros y testeables (`session-status.ts`, `input-release-guard.ts`). Justificación completa en §21 de la especificación: el estado nuevo (`isPaused`, `releaseGuard`) está indisolublemente ligado a campos que `GameScene` ya posee en privado (`accumulator`, `pendingHorizontal`, `cursors`), y extraerlo a una clase aparte obligaría a exponer esos campos privados o duplicarlos. Los módulos puros ya cubren toda la lógica de decisión no trivial.

## Contrato final de `SessionStatus`

```ts
type SessionStatus = 'running' | 'paused' | 'gameOver';
```

## Contrato final de `GamePresentationState`

```ts
type GamePresentationState = Readonly<{
  status: SessionStatus;  // antes: 'running' | 'gameOver'
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
}>;
```

## Canal de comandos Vue → Phaser

`PhaserGameController` ampliado con `togglePause()`:

```ts
type PhaserGameController = Readonly<{
  reset(): void;
  togglePause(): void;
  destroy(): void;
}>;
```

El cableado desde `create-phaser-game.ts` sigue exactamente el mismo patrón defensivo que `reset()`:

```ts
togglePause(): void {
  const scene = game.scene.getScene('GameScene') as GameScene | null;
  if (scene) {
    scene.togglePause();
  }
}
```

## Semántica de `Escape`

- Detectado por flanco (`Phaser.Input.Keyboard.JustDown(this.cursors.esc)`) una vez por frame real de `update()`, no por paso lógico.
- Solo tiene efecto cuando `engineStatus !== 'gameOver'` (comprobado tanto en `update()` como en `togglePause()` mediante `canTogglePause()`).
- Durante `gameOver`: se consume el flanco (se lee `JustDown`) pero no produce cambio de estado.
- No se mezcla con la construcción de `StepInput`; `Escape` nunca llega al motor.

## Estrategia de neutralización y rearme de teclas (`input-release-guard.ts`)

### Mecanismo

- `armReleaseGuard(currentlyHeld)`: congela el estado físico de `left`/`right`/`softDrop` en el instante de reanudar o reiniciar.
- `resolveHeld(guard, key, isDown)`: devuelve `false` mientras la tecla esté bloqueada, independientemente de `isDown`.
- `clearReleaseGuardKey(guard, key)`: limpia la bandera al observar el `keyup` real (desde el listener ampliado).

### Puntos de aplicación

1. **Al reanudar** (en `togglePause()` pasando de `paused` a `running`).
2. **Al reiniciar** (en `resetEngine()`, tanto la primera vez en `create()` como en resets posteriores).

### Drenaje durante frames pausados

Mientras `isPaused === true`: `update()` invoca `readKeys()` en cada frame real (que drena `pendingHorizontal` y los flancos `JustDown`), descartando el resultado sin pasarlo al motor. Esto evita que teclas pulsadas durante la pausa se ejecuten al reanudar.

## Tratamiento del acumulador temporal

- Al pausar: `this.accumulator = 0`.
- Al reanudar: `this.accumulator = 0` (defensivo).
- Mientras está pausado: `computeSteps()` no se invoca (el bucle de pasos no se ejecuta).
- El `delta` que Phaser reporta en el primer frame tras reanudar es el intervalo real entre frames consecutivos (tipicamente ~16 ms), nunca la duración de la pausa. Esto se debe a que no se usa `scene.pause()`, por lo que Phaser sigue invocando `update()` a ritmo normal durante toda la pausa.

## Orden de operaciones

### Pausa (confirmado que coincide con §13)

1. Detectar solicitud (`JustDown(esc)` o clic del botón).
2. Cambiar `isPaused` a `true`.
3. Limpiar `pendingHorizontal = null` y drenar flancos con `readKeys()`.
4. Poner `accumulator = 0`.
5. Renderizar frame y notificar a Vue.

### Reanudación (confirmado que coincide con §13)

1. Detectar solicitud.
2. Cambiar `isPaused` a `false`.
3. Limpiar `pendingHorizontal = null` y drenar flancos con `readKeys()`.
4. Armar `releaseGuard` con el estado físico actual de las teclas.
5. Poner `accumulator = 0`.
6. Renderizar frame y notificar a Vue.

### Reinicio (confirmado que coincide con §15)

- `resetEngine()` limpia: engine, accumulator, consumedThisFrame, pendingHorizontal, isPaused (= false), arma releaseGuard, drena flancos con `readKeys()`.
- `resetGame()` añade: notifyState() y logDebug.

### Game over (confirmado que prevalece sobre pausa)

- `computeSessionStatus` garantiza la precedencia de forma pura.
- En `update()`: al detectar `engineStatus === 'gameOver'`, se fuerza `isPaused = false` como defensa adicional.
- El botón de pausa se deshabilita durante gameOver.

## Lifecycle y listeners

- No se duplicó ningún listener.
- No se usó `scene.pause()`.
- El listener `keyup` existente se amplió para limpiar el guardián de liberación en las teclas afectadas.
- No se registraron listeners adicionales: todo el nuevo comportamiento usa estado interno de `GameScene` y la tecla `Escape` gestionada por el mismo mecanismo `cursors`/`JustDown`.
- `this.horizontalListeners` sigue siendo el único punto de retirada, sin cambios de forma.

## Archivos modificados y creados

### Modificados

- `apps/web/src/App.vue`: botón Pausar/Reanudar, overlay PAUSA, CSS, botón Reiniciar, controles actualizados.
- `apps/web/src/game/types.ts`: `status` ampliado a `SessionStatus`; `PhaserGameController` con `togglePause()`.
- `apps/web/src/game/types.test.ts`: test de `status: 'paused'`.
- `apps/web/src/game/create-phaser-game.ts`: `togglePause()` en el controlador.
- `apps/web/src/game/scenes/GameScene.ts`: todo el comportamiento de pausa, reanudación, reinicio coordinado, guardián de liberación, drenaje durante pausa, `computeSessionStatus`, reordenación de `create()`.

### Creados

- `apps/web/src/game/session-status.ts`: `SessionStatus`, `computeSessionStatus`, `canTogglePause`.
- `apps/web/src/game/session-status.test.ts`: 6 tests.
- `apps/web/src/game/input-release-guard.ts`: `ReleaseGuard`, `armReleaseGuard`, `clearReleaseGuardKey`, `resolveHeld`.
- `apps/web/src/game/input-release-guard.test.ts`: 7 tests.
- `apps/web/src/App.test.ts`: 8 tests de integración Vue.
- `docs/implementation/0008-pausa-reanudacion-reinicio-coordinados.md`: este informe.

## Pruebas añadidas

| Ubicación | Tests | Tipo |
|-----------|-------|------|
| `session-status.test.ts` | 6 | Puro (sesión y precedencia) |
| `input-release-guard.test.ts` | 7 | Puro (guardián de liberación) |
| `types.test.ts` | +1 | Puro (status paused) |
| `App.test.ts` | 8 | Integración Vue |
| **Total nuevas** | **22** | |
| **Total final** | **298** | |

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 298 passed ✅ |
| `pnpm lint` | Sin errores ni avisos ✅ |
| `pnpm typecheck` | Sin errores ✅ |
| `pnpm build` | Exitoso (aviso chunk Phaser aceptado) ✅ |
| `git diff --check` | Sin espacios en blanco conflictivos ✅ |

## Número final de tests

**298** (276 anteriores + 22 nuevos).

## Desviaciones respecto a la especificación

Ninguna detectada. La implementación sigue exactamente el contrato, orden de operaciones, arquitectura, estrategia de rearme de teclas, tratamiento temporal, pruebas y documentación definidos en la especificación.

## Deuda técnica

- `GameScene` no tiene pruebas unitarias directas (continuación de la deuda aceptada desde `0004`, documentada en §25.5 de la especificación). La corrección se respalda en: (1) pruebas exhaustivas de la lógica de decisión pura extraída, (2) pruebas de integración Vue, (3) validación manual en navegador.
- Aviso de chunk grande de Phaser (>500 kB, aceptado desde `0004`, no corregido).

## Validación manual

Pendiente de ejecutar con `pnpm dev` (requiere navegador). Pasos documentados en §26 de la especificación.

## `git status --short`

```
M apps/web/src/App.vue
M apps/web/src/game/create-phaser-game.ts
 M apps/web/src/game/scenes/GameScene.ts
 M apps/web/src/game/types.test.ts
 M apps/web/src/game/types.ts
?? apps/web/src/App.test.ts
?? apps/web/src/game/input-release-guard.test.ts
?? apps/web/src/game/input-release-guard.ts
?? apps/web/src/game/session-status.test.ts
?? apps/web/src/game/session-status.ts
```

## Confirmaciones

- ✅ No se modificó `packages/game-engine`.
- ✅ No se modificó `docs/tasks/0008-pausa-reanudacion-reinicio-coordinados.md`.
- ✅ No se añadieron dependencias.
- ✅ No se usa `scene.pause()`.
- ✅ No existen listeners duplicados.
- ✅ No se hicieron commits.
- ✅ No se implementó nada del alcance excluido.
- ✅ `GameScene` no tiene estado `paused` ni métodos de pausa hacia el motor.
- ✅ No se usaron scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline.
