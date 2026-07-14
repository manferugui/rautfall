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
| **Resultado** | Motor determinista completo: PRNG mulberry32, bolsa de siete, tablero 10×24 (4 filas ocultas + 20 visibles), movimiento, gravedad, hard drop, colisiones, fijación, clear de líneas, game over, eventos, snapshot, validación de entrada y reset. 87 tests pasan, typecheck y lint limpios, build exitoso. |

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

### Siguiente tarea

`0003 — Rotación SRS`

Implementación del Super Rotation System: orientaciones, rotación horaria y antihoraria, wall kicks, tabla específica de la pieza `I`, comportamiento de la pieza `O`, y cancelación de la rotación.
