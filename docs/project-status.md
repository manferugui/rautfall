# Project Status — Rautfall

## Task [0001 — Base del prototipo](tasks/0001-base-del-prototipo.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-13 |
| **Resultado** | Monorepo mínimo, ejecutable y probado con tres unidades: `apps/web`, `packages/game-engine`, `packages/game-config`. 36 tests pasan, lint y typecheck limpios, build exitoso. |

### Resumen

- Workspace pnpm con tres unidades acordadas.
- `packages/game-config`: configuración validada con TypeBox, esquema estricto, rechazo de propiedades desconocidas, validación relacional explícita.
- `packages/game-engine`: contrato mínimo con factoría, step lógico, snapshot, eventos y reset determinista.
- `apps/web`: aplicación Vue 3 + Vite que consume ambos paquetes públicos y muestra pantalla técnica.
- Todos los comandos raíz funcionan sin compilación previa.

## Task [0002 — Motor de juego determinista](tasks/0002-motor-de-juego-determinista.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-14 |
| **Resultado** | Motor determinista completo: PRNG mulberry32, bolsa de siete, tablero 10×24 (4 filas ocultas + 20 visibles), movimiento, gravedad, hard drop, colisiones, fijación, clear de líneas, game over, eventos, snapshot, validación de entrada y reset. 88 tests pasan, typecheck y lint limpios, build exitoso. |

### Resumen

- Núcleo del motor independiente de navegador y Phaser.
- PRNG mulberry32 con semilla uint32, Fisher–Yates para la bolsa de siete.
- Tablero interno de 10×24 con 4 filas ocultas superiores.
- Spawn centrado con visibilidad inmediata (fila inferior del bounding box en y=4).
- Gravedad basada en tiempo lógico con bucle determinista (condición `>=` exacta).
- Hard drop: desciende y fija en el mismo paso, sin aplicar gravedad.
- Fijación inmediata (sin lock delay, fuera del alcance de 0002).
- Eliminación simultánea de líneas completas (ocultas o visibles).
- Fin de partida exclusivamente por `spawnBlocked`.
- Snapshot inmutable con tablero, pieza activa y siguiente pieza.
- Eventos tipados: engineStarted, engineReset, pieceSpawned, pieceMoved, pieceLocked, linesCleared, gameOver.
- Validación estricta de entrada (sin coerción, sin valores por defecto).
- Controles en pantalla técnica: izquierda, neutro, derecha, hard drop, reset.
- Visualización del tablero completo (24 filas) con código de colores por tipo de pieza.
- Sustitución del contrato provisional de 0001 (`EngineStepInput = Record<string, never>`) por `StepInput`.

### Informe detallado

Ver [Informe de implementación](implementation/0002-motor-de-juego-determinista.md).

## Task [0003 — Rotación SRS](tasks/0003-rotacion-srs.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-15 |
| **Resultado** | Super Rotation System completo: enum `Orientation`, rotación horaria y antihoraria, wall kicks oficiales SRS, tablas separadas JLSTZ e I (coordenadas del motor), comportamiento de la pieza O, cancelación sin mutación, evento `pieceRotated`, exposición de `orientation` en el snapshot, validación de entrada simultánea, 31 nuevas pruebas. Corregido además un defecto de integración web: la pieza activa no se renderizaba durante la caída. 126 tests pasan, lint y typecheck limpios, build exitoso. |

### Resumen

Super Rotation System completo: orientaciones, rotación horaria y antihoraria, wall kicks oficiales, tablas separadas JLSTZ e I, comportamiento de la pieza O, cancelación sin mutación, evento `pieceRotated` y exposición de `orientation` en el snapshot.

### Informe detallado

Ver [Informe de implementación](implementation/0003-rotacion-srs.md).

## Task [0004 — Integración de Phaser](tasks/0004-integracion-phaser.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-15 |
| **Resultado** | Integración de Phaser 3.80.1 como motor de renderizado y entrada. Vue mantiene el contenedor (estado, controles, ayuda). Una única escena Phaser renderiza tablero y pieza activa desde snapshots, captura teclado, adapta tiempo real a pasos lógicos fijos (límite 250 ms, 25 pasos/frame). Eliminado el tablero interactivo Vue (board-composition.ts). 149 tests pasan, lint, typecheck y build exitosos. |

### Resumen

- Phaser 3.80.1 añadido exclusivamente a `apps/web`.
- `GameCanvas.vue` monta/destruye una única instancia Phaser.
- `GameScene.ts`: escena única con teclado, adaptación temporal y renderizado desde `getSnapshot()`.
- Lógica pura extraída a `computeSteps` (tiempo) y `buildStepInput` (entrada).
- Controles: flechas, Z, Space, R. Sin DAS/ARR/soft drop.
- Comunicación Phaser→Vue mediante `GamePresentationState` (status, step, elapsedMs).
- Eliminado `board-composition.ts` y sus 7 tests.
- 23 tests nuevos, 149 total en el monorepo.

### Informe detallado

Ver [Informe de implementación](implementation/0004-integracion-phaser.md).

## Task [0005 — DAS, ARR y soft drop](tasks/0005-das-arr-soft-drop.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-19 |
| **Resultado** | Movimiento horizontal mantenido determinista con DAS (`dasMs=150`) y ARR (`arrMs=50`), soft drop mantenido (`softDropCellsPerSecond=20`), prioridad horizontal gobernada por flancos, acumulador vertical único compartido entre gravedad y soft drop. Nuevo contrato `StepInput` con `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld`. Phaser adaptado sin contener lógica de repetición. 190 tests pasan, lint, typecheck y build exitosos. |

### Resumen

- Implementación completa de DAS/ARR/soft drop en `game-engine`.
- Prioridad horizontal por última dirección pulsada, sin preferencia fija izquierda/derecha.
- Acumulador vertical único en unidades de progreso (1000 = 1 celda), compartido entre gravedad y soft drop.
- `MoveReason` ampliado con `'softDrop'`.
- Validación de entrada ampliada: `pressed` requiere `held`, ambos flancos simultáneos rechazados, `horizontal` rechazada como propiedad desconocida.
- Phaser: `ArrowDown` como tecla de soft drop, estado mantenido sin flanco. No contiene `dasMs`, `arrMs` ni `softDropCellsPerSecond`.
- 33 nuevas pruebas sobre las 157 existentes (190 totales).

### Informe detallado

Ver [Informe de implementación](implementation/0005-das-arr-soft-drop.md).

## Task [0006 — Lock delay y fijación diferida](tasks/0006-lock-delay-fijacion-diferida.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-19 |
| **Resultado** | Lock delay determinista gobernado por `config.lockDelayMs` (500 ms) y `config.maxLockResets` (15). Gravedad y soft drop ya no fijan inmediatamente: la pieza pasa a estado apoyado y acumula tiempo lógico. Movimiento horizontal y rotación válidos reinician el temporizador y consumen un reinicio cuando la pieza está apoyada antes y después. Hard drop conserva fijación inmediata. `ActivePieceSnapshot` ampliado con `grounded`, `lockDelayElapsedMs` y `lockResetsUsed`. 265 tests pasan, lint, typecheck y build exitosos. |

### Resumen

- Fijación diferida: gravedad y soft drop bloqueados inician el temporizador de lock delay en vez de fijar inmediatamente.
- `isGrounded`: función pura derivada del tablero y posición, sin estado redundante.
- Reinicios por movimiento horizontal (DAS/ARR incluidos) y rotación: solo cuando apoyada antes y después.
- Límite de reinicios: al alcanzar `maxLockResets`, la pieza se fija en el mismo paso tras aplicar la acción.
- Hard drop: mismo comportamiento inmediato, sin interacción con lock delay.
- Temporizador exclusivamente lógico (`fixedStepMs` acumulado), sin `Date.now()` ni `setTimeout`.
- `ActivePieceSnapshot` ampliado con 3 campos de solo lectura.
- Phaser no implementa temporización de lock delay.
- 34 nuevas pruebas sobre las 231 existentes (265 totales).

### Informe detallado

Ver [Informe de implementación](implementation/0006-lock-delay-fijacion-diferida.md).

## Task [0007 — Cola determinista de tres próximas piezas y preview técnico provisional](tasks/0007-cola-proximas-piezas-preview-tecnico.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-19 |
| **Resultado** | Contrato `nextPiece` sustituido por cola determinista de 3 piezas. Nueva API pública `getPieceShape(type)` con geometría normalizada. Preview técnica provisional en Vue+CSS integrada en el panel de información. 276 tests pasan, lint, typecheck y build exitosos (aviso de chunk de Phaser no bloqueante). |

### Resumen

- `EngineSnapshot.nextPiece: PieceType | null` → `nextPieces: readonly PieceType[]` (longitud 3).
- Cola interna `nextPiecesQueue` alimentada por la misma bolsa de siete y PRNG.
- `spawnInitialPieces`: 4 consumos (1 activa + 3 cola).
- `spawnNextPiece`: extrae candidata, repone cola, intenta spawn, activa o game over.
- Game over: candidata consumida, cola repuesta a 3, `activePiece = null`.
- `getPieceShape(type)`: función pura, celdas normalizadas (minY=0 para I), congelada.
- `GamePresentationState` ampliado con `nextPieces`.
- `NextPiecesPreview.vue`: tres slots con orden numérico, tipo textual y geometría CSS.
- Phaser no mantiene la cola (solo la copia al estado de presentación).
- 276 tests (11 nuevos sobre 265).

### Informe detallado

Ver [Informe de implementación](implementation/0007-cola-proximas-piezas-preview-tecnico.md).

## Task [0008 — Pausa, reanudación y reinicio coordinados](tasks/0008-pausa-reanudacion-reinicio-coordinados.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-27 |
| **Resultado** | Pausa/reanudación por Escape y botón Vue, overlay «PAUSA», neutralización de teclas mantenidas, guardián de liberación de entrada, drenaje durante pausa, precedencia gameOver > paused, reinicio desde cualquier estado sin duplicar listeners ni modificar el motor. 298 tests pasan, lint, typecheck y build exitosos (aviso de chunk de Phaser no bloqueante). |

### Resumen

- `SessionStatus = 'running' | 'paused' | 'gameOver'` con precedencia determinista.
- `computeSessionStatus` deriva el estado de sesión de `(engineStatus, isPaused)` sin dos estados independientes.
- `Escape` detectado por flanco (JustDown) alterna running ⇄ paused; sin efecto en gameOver.
- Botón Pausar/Reanudar en Vue invoca `controller.togglePause()` (misma operación que Escape).
- Overlay técnico provisional «PAUSA» en Vue+CSS sobre el canvas, con `pointer-events: none`.
- Botón Reiniciar disponible en los tres estados, reutiliza semilla y configuración.
- Mecanismo `input-release-guard.ts` bloquea left/right/softDrop al reanudar o reiniciar hasta observar keyup real.
- Drenaje continuo de flancos durante frames pausados mediante `readKeys()` descartado.
- Acumulador temporal puesto a 0 al pausar y al reanudar; sin catch-up ni ráfaga de pasos.
- `GamePresentationState.status` ensanchado de `'running' | 'gameOver'` a `SessionStatus`.
- `PhaserGameController` ampliado con `togglePause()`.
- Reordenación de `create()` para construir cursores antes de `resetEngine()`.
- No se modificó `packages/game-engine`; no se usa `scene.pause()`; no se añadieron dependencias.
- 22 nuevos tests (298 totales).

### Informe detallado

Ver [Informe de implementación](implementation/0008-pausa-reanudacion-reinicio-coordinados.md).

## Siguiente tarea

No se fija una 0009 definitiva. La siguiente tarea se decidirá después de:
- validar en el navegador la pausa, reanudación y reinicio de 0008;
- revisar la sensación de control resultante;
- decidir, a la vista de `docs/rautfall.md` y del estado real, entre candidatas razonables como hold, ghost piece, puntuación/combos, o una consolidación visual del HUD.
