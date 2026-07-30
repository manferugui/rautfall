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

## Task [0009 — Marco Tactical e identidad visual Industrial Dramatic](tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-28 |
| **Resultado** | Layout Tactical de escritorio (tres zonas, responsive hasta 760px), identidad visual Industrial Dramatic (paleta grafito/metal, acentos cian/ámbar/rojo, biseles y sombras), componentes simulados (OpponentMonitor, CombatStatusPanel) con datos congelados fuera del motor, aviso de ancho insuficiente, selectores migrados a data-testid. 316 tests pasan, lint, typecheck y build exitosos (aviso de chunk de Phaser no bloqueante). |

### Resumen

- Hoja de variables CSS `tactical-theme.css` con 18 tokens visuales, importada desde `main.ts`.
- Layout de tres columnas: tablero propio (360 px), columna táctica (300–380 px), monitor rival (220 px).
- Dos puntos de corte responsive: 1200px (escritorio), 760px (suelo mínimo con aviso).
- `OpponentMonitor.vue`: tablero rival estático 10×20 con patrón fijo y etiqueta SIMULADO.
- `CombatStatusPanel.vue`: energía segmentada (7 segmentos, 3 activos en cian), cartucho (ámbar), Residuos (rojo).
- `simulated-tactical-data.ts`: datos congelados, fuera de `GamePresentationState` y del motor.
- `NextPiecesPreview.vue` restilado con variables del tema, sin cambios en script/template.
- Migration de selectores `button:first-child/last-child` a `data-testid` en `App.test.ts`.
- 13 nuevas pruebas (5 datos simulados + 4 monitor + 4 combate + 5 layout en App).
- No se modificaron `packages/game-engine` ni `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0009-marco-tactical-identidad-visual-industrial-dramatic.md).

## Revisión [0009b — Refinamiento visual del marco Tactical Industrial Dramatic](implementation/0009b-refinamiento-visual-marco-tactical.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada (validación visual en navegador pendiente de confirmación del usuario) |
| **Fecha de finalización** | 2026-07-28 |
| **Resultado** | Revisión visual correctiva de `0009` (no es una tarea de mecánica nueva): carcasa Tactical (`.tactical-chassis`) que agrupa cabecera y las tres zonas, cabecera integrada como placa estructural, marco de tablero propio en cuatro niveles con acento dinámico por estado real de sesión, consola táctica unificada sin tarjetas sueltas, monitor rival rediseñado (celda 16px, patrón "skyline" de 87 celdas, ventilación y telemetría simulada), breakpoint de portátil corregido a `grid` explícito. 321 tests pasan, lint, typecheck y build exitosos. Sin cambios en `packages/game-engine` ni `packages/game-config`. |

### Resumen

- Corrige exclusivamente composición, escala, integración y acabado de `0009`; no añade mecánicas ni estado de dominio.
- `App.vue`: carcasa `.tactical-chassis` con remaches de esquina, cabecera en placa con tag angular y franja de advertencia decorativa, marco de tablero en 4 niveles (`.board-column` → `.board-bezel--{status}` → `.canvas-wrapper` → canvas), consola táctica unificada (`.tactical-console` con `.console-section`/`.console-divider`), aviso de ancho insuficiente reubicado al inicio del DOM, breakpoint 760–1199px pasado de `flex-wrap` a `grid` explícito.
- `OpponentMonitor.vue`: `OPPONENT_CELL_SIZE` 10→16px, patrón estático regenerado con perfil irregular por columna (87 celdas), ranura de ventilación y telemetría simulada (enlace/sector/canal), columna ensanchada a 240px.
- `CombatStatusPanel.vue`: identificación general de módulo prototipo añadida sin alterar los tres badges `SIMULADO` por bloque; eliminado el chrome de tarjeta individual de cada bloque.
- `NextPiecesPreview.vue`: solo se simplifica su `<style scoped>` (sin chrome de tarjeta propia); script y template sin cambios.
- `simulated-tactical-data.ts`: nuevas constantes de señalética simulada del rival; patrón del tablero regenerado deterministamente a partir de un array de alturas por columna.
- Ningún `data-testid` existente se modifica; 5 pruebas nuevas protegen la carcasa, el acento dinámico del marco, la señalética simulada y la identificación general de módulo.
- Limitación explícita: no se pudo generar una captura de navegador real ni comparar visualmente pixel a pixel (entorno sin Chromium/Playwright/Puppeteer disponible); queda pendiente de validación manual por el usuario vía `pnpm dev`.

### Informe detallado

Ver [Informe de implementación](implementation/0009b-refinamiento-visual-marco-tactical.md).

## Task [0010 — E2E mínimo del flujo esencial](tasks/0010-e2e-minimo-flujo-esencial.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-28 |
| **Resultado** | Playwright configurado en `apps/web`, Chromium como único navegador, flujo E2E esencial sobre Vue, Phaser y DOM, pausa, reanudación y reinicio verificados, errores de consola y `pageerror` controlados, 321 tests Vitest y 1 test E2E en verde, lint, typecheck y build correctos, sin cambios en dominio. |

### Resumen

- Playwright instalado como dependencia de desarrollo en `apps/web` con scripts E2E.
- Configuración de Playwright con Chromium como único navegador, servidor web automático en puerto 5174.
- Flujo E2E esencial que cubre carga de aplicación, estado inicial `running`, pausa, reanudación y reinicio mediante controles reales de la interfaz.
- Añadidos selectores contractuales `data-testid` para facilitar la localización de elementos sin depender de clases CSS.
- Control de errores: registro y verificación de mensajes de consola de tipo `error` y eventos `pageerror`.
- Validación completa: 321 tests Vitest y 1 test E2E pasan, sin errores de lint, typecheck ni build.
- No se modificaron `packages/game-engine` ni `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0010-e2e-minimo-flujo-esencial.md).

## Task [0011 — Pieza fantasma determinista](tasks/0011-pieza-fantasma-determinista.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-28 |
| **Resultado** | `ActivePieceSnapshot` ampliado con `landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>` que representa las celdas absolutas donde aterrizaría la pieza activa mediante hard drop desde el estado actual. Proyección derivada en `packages/game-engine` reutilizando `hardDropDistance` y `computeAbsoluteCells`. Phaser renderiza `snapshot.activePiece.landingCells` sin recalcular reglas. La pieza fantasma se dibuja antes que la activa, con opacidad reducida (0.25 relleno, 0.5 contorno) y el mismo color base que la pieza activa. 321 tests pasan, lint, typecheck y build exitosos. |

### Resumen

- `ActivePieceSnapshot` ampliado con `landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>`.
- Derivación en `getSnapshot()` con la misma semántica que hard drop: conserva tipo, orientación y X, con Y válida más baja antes de colisionar.
- `landingCells` coincide con `cells` cuando la pieza ya está apoyada.
- No se añade a `EngineSnapshot` fuera de `activePiece`.
- No se expone función pública adicional para calcular la proyección.
- Implementación en `packages/game-engine/src/index.ts` reutilizando `hardDropDistance` y `computeAbsoluteCells`.
- `GameScene.ts` renderiza `snapshot.activePiece.landingCells` en orden previo a la pieza activa.
- Estilo visual: opacidad reducida (0.25 relleno, 0.5 contorno), mismo color base que pieza activa, geometría clara sin efectos.
- `landingCells` y sus celdas son inmutables (`ReadonlyArray<Readonly<...>>`).
- Desaparece cuando `activePiece` es `null` (sin pieza activa o en `gameOver`).
- No modifica `grounded`, `lockDelayElapsedMs` ni `lockResetsUsed`.
- No se añade hold, puntuación, multijugador, audio, partículas, ni configuración de usuario.
- 13 pruebas nuevas (321 totales).
- No se modificó `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0011-pieza-fantasma-determinista.md).

## Task [0012 — Reserva de pieza / hold](tasks/0012-reserva-pieza-hold.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada técnicamente |
| **Fecha de finalización técnica** | 2026-07-29 |
| **Validación manual** | Pendiente de confirmación por el usuario |
| **Resultado** | 361 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- `StepInput` ampliado con `hold?: boolean` (opcional, ausente equivale a `false`).
- `EngineSnapshot` expone `heldPiece: PieceType | null`.
- `ActivePieceSnapshot` expone `holdUsed: boolean`.
- Nuevo evento `pieceHeld { step, piece }`.
- `GamePresentationState` expone `heldPiece: PieceType | null`.
- Algoritmo completo de hold en el motor: rama vacía (consume `nextPieces[0]` y repone cola), rama ocupada (intercambio sin tocar `nextPieces` ni bolsa), control de disponibilidad mediante `holdUsed`, prioridad absoluta del hold dentro del paso.
- Spawn bloqueado durante hold produce `gameOver` con `spawnBlocked`; `heldPiece` no se revierte.
- Phaser añade la tecla `C` como flanco único (`JustDown`), sin reglas de dominio.
- Vue muestra el contenido de la reserva (o hueco vacío) mediante `HeldPiecePreview.vue`, posicionado antes de `NextPiecesPreview` en la consola táctica.
- 22 nuevas pruebas de motor, 4 de input buffer, 2 de tipos y 10 del componente.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0012-reserva-pieza-hold.md).

## Task [0013 — Puntuación y combos](tasks/0013-puntuacion-combos.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-30 |
| **Resultado** | 406 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- `EngineSnapshot` expone `score: number` y `combo: number`.
- `GamePresentationState` expone `score` y `combo`.
- Tabla de puntos por líneas: 100/300/500/800 para 1/2/3/4 líneas simultáneas.
- Combo: 0 sin cadena, 1 tras primera eliminación consecutiva, incremento por cada eliminación adicional, ruptura silenciosa a 0 cuando fijación sin líneas.
- Bonificación de combo: `50 * (combo - 1)` cuando `combo >= 2`.
- Soft drop: 1 punto por celda realmente descendida.
- Hard drop: 2 puntos por celda de distancia real.
- Hard drop unificado sobre `lockAndProcess()`.
- `ScorePanel.vue` muestra puntuación y combo reales en la consola táctica.
- 26 nuevas pruebas de motor, 4 de ScorePanel, 1 nueva de App.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0013-puntuacion-combos.md).

## Siguiente tarea

La siguiente tarea se decidirá después de validar manualmente la puntuación y combos, y revisar `docs/rautfall.md` frente al estado real del proyecto. Candidatas razonables: T-Spins y back-to-back, energía de combate, o el primer sabotaje real.
