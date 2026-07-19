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

## Siguiente tarea

Pendiente de definir en su propia especificación.
