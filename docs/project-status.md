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
| **Estado** | ✅ Completada |
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
- Validación completada posteriormente en la Tarea 0010 (suite E2E Playwright en Chromium) y auditada en la Tarea 0031 (pulido visual Industrial Dramatic).

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
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-29 |
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

## Task [0014 — T-Spins y back-to-back](tasks/0014-t-spins-back-to-back.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-31 |
| **Resultado** | 454 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- `EngineSnapshot` expone `backToBack: number`.
- `GamePresentationState` expone `backToBack`.
- Detección de T-Spin: pieza T + `lastActionWasRotation` + ≥3 esquinas ocupadas.
- Tabla de puntos T-Spin: 400/800/1200/1600 para 0/1/2/3 líneas (sustituye a la ordinaria).
- Back-to-back: contador `0` (sin cadena), `1` (primera difícil), `≥2` (bonificación 50%).
- Única fila en `lockAndProcess()` para T-Spin y ordinaria.
- `lastActionWasRotation` gestionado en todas las acciones del motor.
- `ScorePanel.vue` muestra back-to-back en tercera fila.
- Escenario de desarrollo `?tspin-demo=1` para validación manual (dev-only).
- `createTSpinFixturedEngine` y `DevFixtureOptions` retirados de la API pública.
- 26 pruebas funcionales directas del motor (detección, semántica, puntuación, back-to-back) + 9 originales + 7 de escenario dev.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0014-t-spins-back-to-back.md).

## Task [0015 — Energía de combate](tasks/0015-energia-de-combate.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-31 |
| **Resultado** | 471 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- `EngineSnapshot` expone `combatEnergy: number`.
- `GamePresentationState` expone `combatEnergy`.
- Tabla base de energía: Single (10), Double (25), Triple (45), Quad (70), T-Spin Single (25), T-Spin Double (50), T-Spin Triple (75), T-Spin sin líneas (0), Fijación sin líneas (0).
- Bonificación de combo: `min(combo - 1, 5) * 3` (máximo 15 por jugada).
- Bonificación back-to-back: `floor(baseEnergy * 0.25)` sobre energía base.
- Acumulación determinista y atómica en `lockAndProcess()`.
- Saturación en `COMBAT_ENERGY_MAX = 100` con excedente descartado.
- `ScorePanel.vue` muestra el valor numérico en una cuarta fila (`data-testid="combatEnergy-value"`).
- `CombatStatusPanel.vue` renderiza la barra de 7 segmentos en función de `combatEnergy` real (`Math.floor(combatEnergy / 100 * 7)`).
- 13 pruebas deterministas del motor + pruebas de componentes Vue y tipos.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0015-energia-de-combate.md).

## Task [0016 — Consumo de energía y Residuos](tasks/0016-consumo-energia-y-residuos.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-31 |
| **Resultado** | 480 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- `EngineSnapshot` expone `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number`.
- `GamePresentationState` expone `storedSabotages` y `pendingGarbage`.
- Conversión atómica de energía en `lockAndProcess()`: si `storedSabotages.length < 2` y `totalEnergy >= 100`, se almacena `'residuos'` y la energía restante es `Math.min(100, totalEnergy - 100)`. Excedente descartado si el cartucho está lleno (2/2). Máximo 1 conversión por fijación.
- Cartucho FIFO capacidad 2. Tecla `A` (`JustDown`) mapeada a `StepInput.triggerSabotage` que extrae el primer sabotaje y emite evento `sabotageTriggered`.
- `receiveSabotage('residuos')` encola +2 filas de basura pendiente (`pendingGarbage`) sin alterar el tablero activo inmediatamente.
- Aplicación determinista en `lockAndProcess()` tras clear del jugador y antes de spawn: desplaza tablero arriba, inserta celdas `'garbage'` con 1 hueco independiente por fila (`Math.floor(prng() * 10)`), decrementa `pendingGarbage` y emite `garbageApplied`.
- Condición `garbageOverflow`: si la basura desplaza celdas ocupadas por encima de $y < 0$, se produce `gameOver` inmediato.
- Integración en `CombatStatusPanel.vue` (cartucho real y residuos reales encolados, eliminación de badges `SIMULADO` en cartucho y residuos).
- Modo demo `?sabotage-demo=1` en bucle cerrado para desarrollo (dev-only).
- 9 pruebas de motor para la Tarea 0016 + pruebas en `input-buffer`, `types`, `CombatStatusPanel` y `App`.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0016-consumo-energia-y-residuos.md).

## Task [0017 — Bolsa de sabotajes y Sobrecarga](tasks/0017-bolsa-sabotajes-y-sobrecarga.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-31 |
| **Resultado** | 490 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- Extensión de `SabotageType` con `'sobrecarga'`.
- Bolsa determinista de 2 sabotajes (`Sabotage 2-Bag`) (`['residuos', 'sobrecarga']`) mediante PRNG determinista (`prng()`) y algoritmo Fisher–Yates.
- `ActiveEffectType = 'sobrecarga'` y `ActiveEffectSnapshot` (`{ type: ActiveEffectType, remainingMs: number }`).
- `EngineSnapshot` y `GamePresentationState` exponen `activeEffects: readonly ActiveEffectSnapshot[]`.
- `receiveSabotage('sobrecarga')`: activa o renueva la duración a 10.000 ms de tiempo lógico activo y emite el evento de dominio `effectStarted`.
- La renovación no apila multiplicadores de velocidad ($3\times$ constante) ni crea objetos duplicados en `activeEffects`.
- Gravedad pasiva acelerada a $3\times$ (`config.gravityCellsPerSecond * 3`) durante Sobrecarga.
- Soft drop permanece inalterado a `config.softDropCellsPerSecond`. Hard drop, DAS, ARR, SRS y lock delay permanecen inalterados.
- Descuento temporal determinista de `remainingMs` por `config.fixedStepMs` en `step()`, emitiendo `effectExpired` una sola vez al llegar a 0.
- `reset()` limpia `activeEffects = []`.
- `CombatStatusPanel.vue` integra la sección `EFECTOS ACTIVOS` en la consola táctica mostrando `SOBRECARGA Ns` (`Math.ceil(remainingMs / 1000)`).
- 10 nuevas pruebas deterministas de motor para la Tarea 0017 + pruebas en `types.test.ts` y `CombatStatusPanel.test.ts`.
- Sin cambios en `packages/game-config`.

### Informe detallado

Ver [Informe de implementación](implementation/0017-bolsa-sabotajes-y-sobrecarga.md).

## Task [0018 — Progresión determinista de nivel y gravedad](tasks/0018-progresion-determinista-de-nivel-y-gravedad.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-31 |
| **Resultado** | 530 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- Progresión determinista de nivel ($1..10$) basada en líneas acumuladas eliminadas (`level = Math.min(10, Math.floor(clearedLines / 10) + 1)`).
- Tabla discreta de gravedad base (`baseGravityCellsPerSecond`), desde $1.00\text{ c/s}$ (Nivel 1) hasta $10.00\text{ c/s}$ (Nivel 10), derivada exclusivamente de la tabla sin intervención de `config.gravityCellsPerSecond`.
- Exposición en `EngineSnapshot` y `GamePresentationState` de `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.
- Evento de dominio `LevelUpEvent` (`levelUp`) emitido de forma atómica una sola vez al cambiar de nivel tras la eliminación de líneas.
- Gravedad activa multiplicada por 3 durante **Sobrecarga** (`activeGravityCellsPerSecond = baseGravityCellsPerSecond * 3`).
- Soft Drop strictly inalterado a `config.softDropCellsPerSecond` ($20.0\text{ c/s}$). Hard drop, DAS, ARR, SRS, `lockDelayMs` y `maxLockResets` inalterados.
- Presentación táctica de `Nivel` y `Gravedad` en `ScorePanel.vue`.
- Modos demo de desarrollo `?level-demo=1` y `?level-demo=10` para validación manual en entorno DEV.
- 14 pruebas deterministas de motor para la Tarea 0018 + pruebas de escenarios demo, `types.test.ts`, `ScorePanel.test.ts` y `App.test.ts`.

### Informe detallado

Ver [Informe de implementación](implementation/0018-progresion-determinista-de-nivel-y-gravedad.md).

## Task [0019 — Sabotaje Polaridad inversa](tasks/0019-sabotaje-polaridad-inversa.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-01 |
| **Resultado** | 554 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- Inversión determinista de intenciones de movimiento horizontal (`leftHeld` $\leftrightarrow$ `rightHeld`, `leftPressed` $\leftrightarrow$ `rightPressed`) y rotación (`rotateClockwise` $\leftrightarrow$ `rotateCounterclockwise`) en `packages/game-engine`.
- Los controles de Soft Drop, Hard Drop, Hold y activación de sabotajes (`triggerSabotage`) no sufren transformación alguna.
- Bolsa determinista ampliada a 3 sabotajes (**Sabotage 3-Bag**) (`['residuos', 'sobrecarga', 'polaridad']`).
- Duración por contador de piezas (`remainingPieces: 1 | 2`). Activación inicial con 1 pieza (`durationPieces: 1`), renovación hasta tope de 2 piezas (`durationPieces: 2`).
- Las acciones de Hold no decrementan `remainingPieces`.
- Al fijar una pieza en el tablero (`lockAndProcess`), `remainingPieces` decrementa en 1. Al alcanzar 0, el efecto es eliminado antes de tomar el snapshot y se emite un único `effectExpired`.
- `ActiveEffectSnapshot` y `EffectStartedEvent` refactorizados como uniones discriminadas estrictas.
- `receiveSabotage()` ignora llamadas en estado `gameOver` mediante guarda al inicio.
- Presentación en `CombatStatusPanel.vue` (`POLARIDAD · 1 PIEZA` y `POLARIDAD · 2 PIEZAS`).
- Modo demo de desarrollo `?polarity-demo=1` para validación manual en entorno DEV.
- 16 pruebas deterministas de motor para la Tarea 0019 + 8 de `polarity-demo` + 2 de `CombatStatusPanel`.

### Informe detallado

Ver [Informe de implementación](implementation/0019-sabotaje-polaridad-inversa.md).

## Task [0020 — Capa de batalla local determinista entre dos motores](tasks/0020-capa-de-batalla-local-determinista.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-01 |
| **Resultado** | Nuevo paquete `@rautfall/battle-engine` con orquestación headless, avance lockstep síncrono, validación atómica, enrutamiento cruzado de sabotajes, conservación y publicación de eventos (`participantEvent`), resolución determinista de victorias y empate (`draw`), separación de PRNG de piezas y efectos en `@rautfall/game-engine` e integración en el modo demo `?battle-demo=1`. 583 tests Vitest y 1 test E2E en verde. Lint, typecheck y build exitosos. |

### Resumen

- Nuevo paquete `packages/battle-engine` (`@rautfall/battle-engine`) desacoplado de Phaser y DOM.
- Orquestador `BattleSession` que gestiona dos motores independientes en bucle síncrono determinista (lockstep).
- Separación de flujos PRNG en `packages/game-engine`: `pieceSeed` (bolsa de 7 y cola de proximidad) y `effectsSeed` (huecos de basura). Dos motores con la misma semilla principal conservan idéntica secuencia de piezas independientemente de la basura o sabotajes recibidos.
- Prevalidación atómica de entradas en `step()` usando la función exportada `validateStepInput()` de `game-engine`. Ante entradas inválidas en P1 o P2, ningún motor avanza ni muta su estado.
- Publicación y conservación de hechos transitorios: cada evento drenado de un motor se preserva envuelto en `participantEvent`. Los sabotajes simultáneos se serializan (P1 $\to$ P2 y P2 $\to$ P1) publicando en el mismo paso los eventos causados en el receptor.
- Operación `reset()` que restaura la sesión con la semilla y configuración originales y emite exclusivamente `battleReset`.
- Modo demo de desarrollo `?battle-demo=1` para probar el combate 1v1 local con consola táctica DEV y enrutamiento real sin loopback.
- 17 pruebas deterministas en `battle-engine`, 6 pruebas de PRNG/validación en `game-engine` y 4 pruebas en `apps/web`.

### Informe detallado

Ver [Informe de implementación](implementation/0020-capa-de-batalla-local-determinista.md).

## Task [0021 — Integración visual del segundo tablero real](tasks/0021-integracion-visual-segundo-tablero-real.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-01 |
| **Resultado** | Integración visual del segundo tablero real (Player 2) en `OpponentMonitor.vue` consumiendo la instantánea `BattleSnapshot.playerTwo`. Renderizado de celdas 10×20 (fijas, basura, pieza activa y pieza fantasma con prioridad visual `activePiece` > `landingCells` > `board`), eliminación de la insignia `SIMULADO` únicamente en batalla real (`?battle-demo=1`), conservación del monitor simulado fuera de batalla, telemetría táctica real (nivel, energía, sabotajes, efectos, basura pendiente), velo de `PAUSA`, reset coordinado e indicadores de terminalidad (`DERROTA RIVAL`, `VICTORIA RIVAL`, `EMPATE`). 597 tests Vitest y 2 tests E2E Playwright en verde. Lint, typecheck y build exitosos. |

### Resumen

- Mapeador puro desacoplado `mapEngineToOpponentPresentation` en `apps/web/src/game/opponent-mapper.ts`.
- Proyección de coordenadas 10×24 $\to$ 10×20 descartando filas ocultas ($y_{engine} < 4$), con prioridad estricta `activePiece` > `landingCells` (fantasma) > `board`.
- `OpponentMonitor.vue` soporta modo real (detrás de `?battle-demo=1`) y modo simulado estático en el juego normal 1P.
- Eliminación del distintivo `SIMULADO` únicamente durante batallas reales.
- Telemetría táctica real de P2 (Nivel, Energía, Sabotajes almacenados, Efectos activos y Basura pendiente).
- Velo sutil `PAUSA` en pausa, reinicio coordinado con `R` e indicadores terminales (`DERROTA RIVAL`, `VICTORIA RIVAL`, `EMPATE`).
- Sin segundo canvas Phaser ni lógica de dominio en Vue.
- 7 pruebas unitarias de mapeador, 10 pruebas de componente Vue y 1 test E2E Playwright en `?battle-demo=1`.

### Informe detallado

Ver [Informe de implementación](implementation/0021-integracion-visual-segundo-tablero-real.md).

## Task [0022 — Bot heurístico determinista para batalla local](tasks/0022-bot-heuristico-determinista.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-02 |
| **Resultado** | Bot heurístico determinista (`DeterministicBot`) para Player 2 en Batalla Local, configurado con un único perfil de referencia equilibrado (base para `battleNormal`). Método contractual `GameEngine.clone()` en `@rautfall/game-engine` y propiedad contractual `pieceId: number` en `ActivePieceSnapshot` para percepción e invalidación determinista sin identificadores sintéticos. Exploración BFS de colocaciones alcanzables (`placement-search.ts`), descarte obligatorio de candidatos terminales cuando existan alternativas de supervivencia, función de evaluación con 10 métricas y penalización de pozos/huecos nuevos (`board-evaluator.ts`), desempate canónico de 7 niveles, espera de visibilidad completa ($y \ge 4$), ejecutor físico con retardo de 20 pasos (200 ms), intervalo de 4 pasos entre acciones (40 ms) y pausa de 5 pasos antes del hard drop (50 ms), desorientación por Polaridad Inversa e integración en Player 2 para `?battle-demo=1`. 645 tests Vitest y 2 tests E2E Playwright en verde. Lint, typecheck y build exitosos. |

### Resumen

- Método `clone(): GameEngine` en `@rautfall/game-engine` con clonación inmutable de tableros, piezas y PRNGs.
- Campo `pieceId: number` en `ActivePieceSnapshot` para identificar de forma contractual y estable cada pieza generada por el motor.
- `board-evaluator.ts` calcula métricas post-colocación penalizando pozos profundos, huecos nuevos y ocupación de filas ocultas.
- `placement-search.ts` filtra candidatos terminales si existen supervivientes y desempata en 7 niveles.
- `deterministic-bot.ts` impone perfil de cadencia de referencia (20 ticks de retardo, 4 ticks de intervalo, 5 ticks previos a hard drop), visibilidad completa ($y \ge 4$) y tolerancia a la gravedad natural.
- Integración en `GameScene.ts` para Player 2 en `?battle-demo=1` expuesta con atributos `data-testid` estables en consola DEV.
- 24 tests de clonación + 10 tests de `pieceId` en `game-engine`, 24 tests de bot en `battle-engine` y 2 tests E2E Playwright en `apps/web`.

### Informe detallado

Ver [Informe de implementación](implementation/0022-bot-heuristico-determinista.md).

## Task [0023 — Decisión y activación determinista de sabotajes por el bot](tasks/0023-bot-sabotajes-deterministas.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-02 |
| **Resultado** | Política táctica pura y determinista (`sabotage-policy.ts`) integrada en `DeterministicBot` para Player 2 en Batalla Local. Evaluación exclusiva del frente FIFO del cartucho (`storedSabotages[0]`), activación mediante contrato de entrada público (`StepInput.triggerSabotage`) emitido en ticks tácticos neutros sin interferir con movimientos ni hard drops, percepción estrictamente readonly desde `EngineSnapshot` del rival (sin acceso al motor mutable ni PRNG ajeno), cadencia táctica periódica (20 pasos / 200 ms) y cooldown determinista (100 pasos / 1.000 ms), escenario DEV determinista en `?battle-demo=1&bot-sabotage=1` y `?battle-demo=1&bot-sabotage=high`. 668 tests Vitest y 5 tests E2E Playwright en verde. Lint, typecheck, build y git diff --check limpios. |

### Resumen

- Módulo puro `sabotage-policy.ts` exporta `evaluateSabotageDecision` con guardas obligatorias en orden de precedencia (terminalidad propia, terminalidad rival, cooldown, intervalo de decisión, cartucho vacío).
- Evaluación exclusiva del primer elemento del cartucho FIFO (`storedSabotages[0]`), decidiendo entre activar o conservar con razones explícitas (`SabotageDecisionReason`).
- Reglas tácticas por tipo: `residuos` (altura rival $\ge 8$ y sin presión pendiente equivalente), `sobrecarga` (altura rival $\ge 5$, pieza activa en rival y sin efecto activo previo), `polaridad` (pieza activa completamente visible cerca de pared $\le 1$ o riesgo elevado de top-out y sin efecto previo).
- `DeterministicBot` emite `triggerSabotage: true` en ticks neutros (`isNeutralPlacementInput`) sin combinar con movimiento, rotación o hard drop.
- Cadencia táctica de 20 pasos de intervalo de decisión y 100 pasos de cooldown tras activación.
- Pausa y terminalidad congelan la política; `reset()` limpia el estado táctico por completo.
- Ampliación controlada de la API pública de inicialización y reset deterministas (`EngineInitialState` en `@rautfall/game-engine` y parámetro opcional `resetInitialState` en `GameEngine.reset()`).
- `apps/web` recibe instantánea pública de P1 (`bSnap.playerOne`) y expone telemetría táctica en consola DEV (`botDevDiagnostic`).
- 24 tests unitarios de política + 7 tests unitarios de ejecutor bot + 2 tests de integración `BattleSession` + 3 tests E2E Playwright.

### Informe detallado

Ver [Informe de implementación](implementation/0023-bot-sabotajes-deterministas.md).

## Task [0024 — Muerte súbita determinista en la batalla local](tasks/0024-muerte-subita-determinista-batalla-local.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-03 |
| **Resultado** | Extensión genérica de modificadores externos (`EngineModifiers`) en `@rautfall/game-engine` y modelo determinista de Muerte Súbita en `@rautfall/battle-engine` ajustado a `docs/rautfall.md` (aviso a 04:55, inicio a 05:00, Fases 1, 2 y 3 con aceleración de gravedad hasta 1.50× y multiplicador de energía 1.20×). Conservación estricta de `BattleStatus` (`'running' | 'playerOneWon' | 'playerTwoWon' | 'draw'`), emisión única de hechos transitorios, simetría P1/P2, resolución síncrona de victorias/empates, escenario DEV `?battle-demo=1&sudden-death-demo=1` y suite E2E de Playwright. 698 tests Vitest y 6 tests E2E Playwright en verde. Lint, typecheck, build y git diff --check limpios. |

### Resumen

- Extensión contractual `EngineModifiers` (`gravityMultiplier`, `energyMultiplier`) en `@rautfall/game-engine` y parámetro opcional `modifiers` en `StepInput`.
- Aplicación determinista de gravedad compuesta (`baseLevelGravity * (hasSobrecarga ? 3 : 1) * externalGravityMultiplier`) y energía multiplicada (`generatedEnergy * externalEnergyMultiplier`).
- Contrato separado `SuddenDeathPhase` (`'inactive' | 'warning' | 'phase1' | 'phase2' | 'phase3'`) y `SuddenDeathSnapshot` expuesto en `BattleSnapshot.suddenDeath`.
- Fronteras temporales exactas: aviso a 04:55 (295.000 ms), Phase 1 a 05:00 (300.000 ms, grav 1.15×, energ 1.20×), Phase 2 a 05:30 (330.000 ms, grav 1.30×), Phase 3 a 06:00 (360.000 ms, grav 1.50×).
- Emisión única de eventos transitorios (`suddenDeathWarning`, `suddenDeathStarted`, `suddenDeathPhaseChanged`) al cruzar cada umbral.
- Condición de victoria y empate intactos, procesados tras ejecutar ambos motores en el paso global.
- Avance bloqueado en estado terminal con `BattleStepError('BATTLE_NOT_RUNNING')`.
- Escenario DEV `?battle-demo=1&sudden-death-demo=1` y test E2E en Playwright (`sudden-death.spec.ts`).

### Informe detallado

Ver [Informe de implementación](implementation/0024-muerte-subita-determinista-batalla-local.md).

## Task [0025 — Flujo web de modos y resultados](tasks/0025-flujo-web-modos-y-resultados.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-08-03 |
| **Resultado** | Flujo jugable de producción completo en `apps/web`: Menú Principal Industrial Dramatic (`ModeSelector.vue`), selección e inicio de modos Entrenamiento (1P) y Batalla Local (2P contra `DeterministicBot`) sin query flags, panel modal de Resultados (`ResultsModal.vue`) con desglose de estadísticas oficiales y acciones Volver a Jugar / Menú Principal, presentación limpia de monitor rival en Entrenamiento (`SIN OPONENTE` / `STANDBY`), ciclo de vida estricto de Phaser con `game.destroy(true)` y creación limpia por partida, conservación de flags DEV para desarrollo y pruebas E2E. 708 tests Vitest y 7 tests E2E Playwright en verde. Lint, typecheck, build y git diff --check limpios. |

### Resumen

- Máquina de estados de navegación en Vue (`appScreen`: `'menu' | 'playing' | 'results'`) desacoplada del motor y Phaser.
- `ModeSelector.vue`: Menú Principal con estética Industrial Dramatic, selector de modos (Entrenamiento / Batalla) y resumen de controles.
- `ResultsModal.vue`: Modal de resultados al finalizar la partida con métricas oficiales (Puntuación, Nivel, Tiempo transcurrido, Resultado de batalla) y acciones Volver a Jugar / Menú Principal.
- `OpponentMonitor.vue` adaptado para mostrar estado standby inequívoco (`SIN OPONENTE`) en Entrenamiento (1P) sin celdas ficticias.
- Batalla Local 2P accesible desde la interfaz gráfica normal sin parámetros URL.
- Ciclo de vida estricto con destrucción completa de Phaser en `onBeforeUnmount()` y recreación limpia al iniciar cada partida.
- Flags DEV (`?battle-demo=1`, etc.) conservadas como accesos directos de desarrollo protegidas por `import.meta.env.DEV`.
- 708 tests Vitest y 7 escenarios E2E Playwright en verde. Sin errores de lint, typecheck ni build.

### Informe detallado

Ver [Informe de implementación](implementation/0025-flujo-web-modos-y-resultados.md).

## Task [0026 — Audio básico e identidad sonora](tasks/0026-audio-basico-e-identidad-sonora.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-09 |
| **Resultado** | Subsistema de audio desacoplado en `apps/web` (`AudioManager`) basado en Web Audio API pura, instancia singleton de `AudioContext` con desbloqueo diferido, silencio global (mute) persistido en `localStorage`, control Mute accesible, sintetizador de SFX sintéticos para 16 eventos esenciales, laboratorio DEV (**SFX LAB**) accesible vía `?sfx-lab=1` únicamente en desarrollo con exportación PCM WAV y audición BGM, 13 muestras SFX procesadas de producción integradas con resiliencia total, pieza musical definitiva de victoria `victory.wav` (*Sector Secured - Option 2* 42,0s estéreo PCM 48 kHz, peak -7.40 dBFS, RMS -25.75 dBFS, crossfade 150 ms), pista musical de **Menu BGM** `menu.wav` (*Terminal Pulse Loop v01* 31,5s), pista de combate **Gameplay BGM** `gameplay.wav` (*Breach Protocol Loop v04* 126,1s) y pista final **Sudden Death BGM** `sudden-death.wav` (*Breach Protocol 138 BPM Loop v01* 100,5s) procesadas e integradas en producción (bus `musicGain`, `loop = true`, crossfade 600 ms, ducking de alarma EAS a -10 dB durante 10,0 s con recuperación suave de 800 ms y silent fallback defensivo). Tests unitarios, de componentes y E2E Playwright en verde. Lint, typecheck, build y git diff --check limpios. |

### Resumen

- Subsistema de audio desacoplado en `apps/web/src/audio/` independiente del ciclo de vida de Phaser.
- Instancia singleton de `AudioContext` desbloqueada tras el primer clic o pulsación del usuario.
- Control de Mute global accesible en Menú Principal y cabecera de juego (`data-testid="audio-mute-button"`).
- Estado de Mute persistido en `localStorage['rautfall_audio_muted']`.
- Sintetizador `sfx-synth.ts` para 16 eventos sonoros clave.
- 13 muestras sonoras procesadas de producción integradas (`uiClick`, `pieceLocked`, `hardDrop`, `linesCleared`, `residuesTriggered`, `residuesReceived`, `overloadTriggered`, `overloadReceived`, `reversePolarityTriggered`, `reversePolarityReceived`, `suddenDeathStarted`, `gameOver`, `victoryFallback`).
- Colección completa de 4 piezas BGM reales de producción integradas (`menu.wav` 31,5s, `gameplay.wav` 126,1s, `sudden-death.wav` 100,5s y nueva pista definitiva `victory.wav` *Option 2* 42,0s).
- Transición fluida `Gameplay -> Sudden Death` con crossfade de 600 ms y alarma EAS `suddenDeathStarted` duckeada a **-10 dB** durante 10,0 s con rampa de recuperación progresiva de 800 ms.
- Laboratorio DEV (**SFX LAB**) en `?sfx-lab=1` actualizado con tarjetas BGM completas, controles de audición directos, botón `▶ PROBAR TRANSICIÓN + ALARMA` y botón `▶ PROBAR LOOP` para Victory BGM.
- Trazabilidad documental completa en `docs/audio-assets.md` y `docs/implementation/0026-audio-basico-e-identidad-sonora.md`.

### Informe detallado

Ver [Informe de implementación](implementation/0026-audio-basico-e-identidad-sonora.md).

## Task [0027 — Cierre de protecciones y mecánicas pendientes de combate del MVP](tasks/0027-cierre-protecciones-y-mecanicas-de-combate.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-09 |
| **Resultado** | Protecciones y mecánicas de combate del MVP completamente cerradas: Sabotaje Interferencia (5.000 ms), Aviso previo de sabotajes (Warning 750 ms), Inmunidad post-efecto (4.000 ms), Límite máximo de basura pendiente (Garbage Cap = 4), orden canónico secuencial en `BattleSession.step()`, política estricta de rechazo de duplicados (`sabotageBlocked`), equivalencia humano/bot con congelación de percepción unívoca durante Interferencia y refinamiento de presentación en `OpponentMonitor.vue`. 761 tests Vitest, 9 tests Playwright E2E, lint, typecheck y build limpios. |

### Resumen

- Sabotaje **Interferencia** (5.000 ms) implementado como efecto de percepción en `packages/battle-engine` con bolsa determinista `Sabotage 4-Bag` en `packages/game-engine`.
- **Aviso previo de sabotajes** (**Warning** 750 ms) para sabotajes temporales disruptivos/percepción (`sobrecarga`, `polaridad`, `interferencia`). `residuos` no participa en warning.
- **Inmunidad post-efecto** (4.000 ms) tras finalizar efectos temporales, bloqueando re-ataques con `sabotageBlocked`.
- **Límite máximo de basura pendiente** (`MAX_PENDING_GARBAGE = 4`) en `packages/game-engine` al recibir Residuos.
- **Orden canónico secuencial de `step()`**: ningún timer creado en un step pierde tiempo en su paso de creación.
- **Equivalencia Humano/Bot**: `OpponentMonitor.vue` muestra velo `SEÑAL INTERFERIDA`. Para el bot (`DeterministicBot`), la instantánea percibida del rival se congela al inicio de la Interferencia sin permitirle consultar el estado actualizado durante los 5 s.
- 761 tests Vitest, 9 tests Playwright E2E, `lint`, `typecheck` y `build` en verde.

### Informe detallado

Ver [Informe de implementación](implementation/0027-cierre-protecciones-y-mecanicas-de-combate.md).

## Task [0028 — DEV Demo Launcher](tasks/0028-dev-demo-launcher.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-09 |
| **Resultado** | Lanzador centralizado de escenarios de desarrollo (**DEV Demo Launcher**) accesible desde el menú principal únicamente cuando `import.meta.env.DEV === true`. Fuente única de verdad en `apps/web/src/dev/dev-demos.ts` con 13 definiciones canónicas auditadas (incluyendo la consolidación de SFX & Music Lab en **Audio Lab**). Componente `DevDemoLauncher.vue` simplificado con estilos tácticos existentes, navegación con URLs limpias desde cero (`pathname + '?' + exactDemoQuery`) y acción **Volver al menú** (`pathname`). Protección incondicional en producción comprobada en `dist` (cero código/chunk DEV residual). 773 tests unitarios, 10 tests E2E, lint, typecheck, build y diff --check en verde. |

### Resumen

- Auditoría completa de los 13 escenarios DEV reales del sistema (Batalla 2P, Muerte Súbita, Interferencia, Bot Sabotajes, Sabotaje Residuos 1P, Residuos en Tablero 1P, Sobrecarga 1P, Polaridad Inversa 1P, T-Spin Setup, Niveles 1 y 10, y Audio Lab).
- Registro centralizado `dev-demos.ts` y helper utilitario `buildDemoTargetUrl` para construir URLs limpias desde cero.
- Componente `DevDemoLauncher.vue` simplificado con tarjetas de demostración, badges de categoría, acción Abrir y botón **Volver al menú**.
- Integración en `ModeSelector.vue` con importación asíncrona (`defineAsyncComponent`) condicionada por `import.meta.env.DEV === true`.
- Verificación empírica tras `pnpm build`: exclusión física total del código del lanzador en el bundle de producción entregable (`dist/`).
- 773 tests Vitest, 10 tests Playwright E2E, lint, typecheck y build en verde.
- Paquetes de dominio `packages/game-engine` y `packages/battle-engine` intactos.

### Informe detallado

Ver [Informe de implementación](implementation/0028-dev-demo-launcher.md).

## Task [0029 — Settings y controles remapeables](tasks/0029-settings-y-controles-remapeables.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-10 |
| **Resultado** | Pantalla y flujo funcional de Settings con controles de teclado remapeables y persistencia local (`rautfall.settings.v1`). Fuente única de verdad en `control-bindings.ts` y persistencia con validación estricta en `settings-storage.ts` con fallback completo a defaults ante inconsistencias. Componente `SettingsScreen.vue` con captura interactiva de teclas físicamente por `KeyboardEvent.code`, ignorado de auto-repeat, cancelación segura con `Escape`, detección y rechazo explícito de teclas duplicadas, restauración de predeterminados y control de mute mediante `AudioManager`. Integración en `GameScene.ts` mediante canal de traducción único que preserva intactos DAS, ARR, `input-release-guard`, `StepInput` y compatibilidad transparente con Polaridad Inversa en el motor. 795 tests unitarios, 11 tests E2E, lint, typecheck, build y git diff --check en verde. |

### Resumen

- Auditoría completa de la capa de input, teclas hardcodeadas, navegación y persistencia.
- Contrato de controles `control-bindings.ts` con acciones de control tipadas (`moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotateClockwise`, `rotateCounterClockwise`, `hold`, `triggerSabotage`, `pause`) y defaults basados en `KeyboardEvent.code`.
- Respeto del contrato real de sabotajes (`triggerSabotage` FIFO, por defecto `KeyA`) y hotkey fija de soporte para Reset (`KeyR`).
- Módulos `settings-storage.ts` y `settings-store.ts` con almacenamiento local versionado y validación estricta sin merge parcial silencioso.
- Componente `SettingsScreen.vue` con estética Industrial Dramatic, modo captura, feedback de duplicados, soporte de `Escape` para cancelar y limpieza rigurosa de listeners.
- Integración en `ModeSelector.vue` y `App.vue` (`AppScreen = 'menu' | 'playing' | 'results' | 'settings'`).
- Integración en `GameScene.ts` sin Phaser KeyCodes hardcodeados sobrantes, consumiendo las configuraciones de usuario desde la misma fuente de verdad basada en `KeyboardEvent.code`.
- Compatibilidad transparente con Polaridad Inversa sin modificar `@rautfall/game-engine`.
- 795 tests Vitest, 11 tests Playwright E2E, lint, typecheck, build y git diff --check en verde.

### Informe detallado

Ver [Informe de implementación](implementation/0029-settings-y-controles-remapeables.md).

## Task [0030 — Backend base, persistencia de partidas, History y Ranking](tasks/0030-backend-persistencia-ranking-history.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-10 |
| **Resultado** | Backend base con Fastify, Drizzle ORM y PostgreSQL implementado. Contratos tipados en `@rautfall/contracts`, persistencia de partidas idempotente (con detección de conflicto 409), historial por jugador, ranking único por modo e integración en `apps/web`. |

### Resumen

- Paquete de contratos `@rautfall/contracts` con esquemas TypeBox estrictos y discriminated unions para result por modo.
- Servidor Fastify `@rautfall/api` con Drizzle ORM y PostgreSQL.
- Idempotencia del POST por `clientMatchId` con respuesta 409 Conflict si el payload contractual difiere.
- Historial por jugador (`GET /api/matches?playerId=<uuid>`).
- Ranking individual por modo (`GET /api/ranking?mode=<training|battle>`) con tie-break determinista (`score DESC, created_at ASC, id ASC`).
- Identidad anónima MVP con `rautfall_player_id` UUID local y alias derivado determinista.
- Integración en `apps/web` con envío non-blocking y pantallas de History y Ranking en Vue.

Ver [Informe de implementación](implementation/0030-backend-persistencia-ranking-history.md).

## Task [0031 — Pulido visual, FX e identidad industrial del MVP](tasks/0031-pulido-visual-fx-identidad-industrial.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada y validada |
| **Fecha de actualización** | 2026-08-12 |
| **Resultado** | MVP llevado a su acabado visual Industrial Dramatic completo: wordmark textual `RAUTFALL` (`Oswald 700`, acabado grafito/acero mate mediante CSS) con descriptor "BUILD · DISRUPT · SURVIVE" en el menú y placa `RAUTFALL` en Battle, `favicon.svg` propio (monograma "R"), tokens CSS globales `--rf-*` consolidados en `tactical-theme.css`, biseles y profundidades en relieve/inset, remaches y rejillas de ventilación reutilizables, botones tácticos mecánicos con traslación `:active`, keycaps metálicos, FX de Interferencia con scanlines y jitter, Sobrecarga con alerta ambarina, Polaridad Inversa con acento magnético violeta, Residuos con renderizado exclusivo de celda corroída en Phaser (física y lógica intactas), Sudden Death con atmósfera de emergencia industrial, ResultsModal con resplandor triunfal / distorsión mermada, y reglas estrictas `@media (prefers-reduced-motion: reduce)`. Validación final ejecutada sobre el working tree definitivo: `pnpm test` (832/832), `pnpm lint`, `pnpm typecheck`, `pnpm build` (warning no bloqueante de tamaño de chunk) y `pnpm test:e2e` (11/11) en verde; `git diff --check` limpio. |

### Resumen

- Branding final como wordmark textual: `RAUTFALL` en `Oswald 700` con acabado grafito/acero mate mediante CSS (menú y placa de Battle), descriptor "BUILD · DISRUPT · SURVIVE" en el menú, y favicon propio (monograma "R") integrado en HTML.
- Consolidación de tokens globales en `tactical-theme.css` con superficies metálicas, óxido controlado en bordes, acentos semánticos, biseles de muesca metálica y anillo de enfoque táctico.
- Botones unificados `.rf-btn-tactical` con elevación y pulsación mecánica real.
- Reestructuración de `ModeSelector`, `SettingsScreen`, `HistoryScreen`, `RankingScreen` y `ResultsModal` con identidad Industrial Dramatic consistente.
- FX enriquecidos: Interferencia con scanlines y jitter, Sobrecarga con pulso ámbar, Polaridad Inversa con tono magnético violeta, Sudden Death con alerta industrial y Residuos renderizados visualmente en Phaser como metal corroído.
- Soporte estricto para `@media (prefers-reduced-motion: reduce)` que sustituye jitter y pulsos por señalización estática clara.
- Validación final: `pnpm test` (832/832), `pnpm lint`, `pnpm typecheck`, `pnpm build` (warning no bloqueante de tamaño de chunk) y `pnpm test:e2e` (11/11) en verde; `git diff --check` limpio.

Ver [Informe de implementación](implementation/0031-pulido-visual-fx-identidad-industrial.md).

## Task [0032 — Operator Tag de 3 caracteres y firma arcade postpartida](tasks/0032-operator-tag-firma-postpartida.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-13 |
| **Resultado** | Reestructuración de la firma de iniciales arcade del Operator Tag integrada directamente en la consola de resultados (`ResultsModal.vue`), eliminando el overlay separado postpartida. Corrección demostrada de la causa raíz del bug de duplicación de caracteres de teclado (`event.preventDefault()` + `if (event.repeat) return;`). Persistencia local diferida de `rautfall_player_tag` únicamente tras recibir respuesta exitosa de la API POST. Limpieza garantizada de `pendingMatchResult` al abandonar Results (`VOLVER A JUGAR` / `MENÚ PRINCIPAL`) y transición automática a `RankingScreen` en el modo de la partida recién guardada (Entrenamiento o Batalla vs Bot). |

### Resumen

> El Operator Tag de 3 caracteres es una identidad visual local provisional inspirada en la introducción de iniciales de máquinas arcade. Se solicita en el flujo postpartida para firmar resultados y no constituye autenticación ni sustituye el modelo definitivo de cuentas previsto para Rautfall.

- Fusión UX en una única pantalla postpartida (`ResultsModal.vue`) con celdas de iniciales integradas.
- Solución limpia al bug de teclado: 1 pulsación física = 1 carácter (`[R] [_] [_]`) e ignorado de `event.repeat` (no produce `RRR`).
- Persistencia local diferida: `setPlayerTag` se ejecuta exclusivamente tras un POST exitoso a la API.
- Si la API falla, se conservan las iniciales editadas en pantalla y el tag persistente previo en `localStorage` no cambia.
- Abandonar Results sin confirmar limpia `pendingMatchResult` sin enviar datos ni arrastrar resultados a partidas siguientes.
- Transición automática a Ranking respetando el modo jugado (`initial-mode`).
- `linesCleared` procedente del snapshot real del motor (`state.clearedLines`).
- Suite completa de pruebas unitarias (`ResultsModal.test.ts` con test de regresión explícito, `App.test.ts`, `OperatorTagModal.test.ts`) y E2E (`operator-tag-flow.spec.ts`) en verde.

Ver [Informe de implementación](implementation/0032-operator-tag-firma-postpartida.md).

## Task [0033 — Popup Industrial de Activación de Audio](tasks/0033-popup-industrial-activacion-audio.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-13 |
| **Resultado** | Implementación del popup industrial modal de activación de audio (`AudioActivationModal.vue`), garantizando el flujo de cero autoplay al cargar la aplicación y resolviendo la confusión sobre la disponibilidad del sistema de sonido. Contrato público enriquecido con `AudioService.isUnlocked()`, separación estricta entre `unlocked`, `AudioContext.state` y `mute`. Soporte completo para accesibilidad de diálogo, focus trap, atajo Escape, protección de eventos de teclado respecto al gameplay, manejo asíncrono de inicialización, reconciliación de BGM y reintento antierrores. |

### Resumen

- Política de cero autoplay al cargar Rautfall: no se reproduce ningún sonido, no arranca ninguna BGM de forma ansiosa y no se instancian contextos Web Audio sin autorización explícita del usuario.
- Componente `AudioActivationModal.vue` con estética **Industrial Dramatic** (placas grafito/metal oscuro, remaches en esquinas, badge `STANDBY` en ámbar).
- Contrato público `AudioService.isUnlocked()` con variable booleana de instancia interna `unlocked`, preservando `true` aunque `AudioContext.state` pase a `suspended`.
- Manejador asíncrono `INICIALIZAR AUDIO`: ejecuta `unlock()`, desactiva el silencio mediante la API oficial (`setMuted(false)`) cumpliendo la intención explícita del usuario de escuchar sonido, muestra deshabilitación con spinner durante la operación, reproduce feedback de `uiClick`, reconcilia la pista BGM de la pantalla activa y cierra el modal.
- Manejador `SEGUIR EN SILENCIO`: cierra el modal en memoria SPA sin llamar a `unlock()` ni BGM/SFX, manteniendo la posibilidad de activar audio posteriormente en Settings.
- Manejo de fallos en `unlock()`: mantiene el popup abierto, no reproduce SFX/BGM, muestra la indicación discreta `AUDIO INIT FAILED // RETRY` y permite reintentos.
- Accesibilidad: `role="dialog"`, `aria-modal="true"`, foco inicial en el botón principal, focus trap `Tab`/`Shift+Tab`, atajo `Escape`, restauración de foco y aislamiento estricto mediante `stopPropagation()`.
- Cobertura completa de pruebas unitarias (`audio-manager.test.ts`, `AudioActivationModal.test.ts`, `App.test.ts`) y Playwright E2E (`audio-activation-modal.spec.ts` + helpers).

Ver [Informe de implementación](implementation/0033-popup-industrial-activacion-audio.md).

## Task [0034 — Cortinilla / Compuerta Industrial Animada de Pausa](tasks/0034-cortinilla-industrial-compuerta-pausa.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-13 |
| **Resultado** | Compuerta/blast shutter industrial animada de pausa (`PauseShutter.vue`) que sella físicamente la ventana principal de juego al pulsar `Esc` o el control de pausa de UI. Construida íntegramente con Vue 3 y CSS procedural en estética Industrial Dramatic (grafito, metal oscuro, juntas, remaches, señalética ámbar), con cierre progresivo en 500 ms, apertura rápida optimizada en ~240 ms y compatibilidad con `prefers-reduced-motion`. Integrada con `AudioManager` mediante los activos WAV derivados de producción `pause-shutter-close.wav` y `pause-shutter-open.wav`, manteniendo el motor y Phaser 100% ajenos a la presentación. |

### Resumen

- Componente presentacional `PauseShutter.vue` que encastra la compuerta dentro del marco (`board-bezel`) del tablero principal.
- Geometría procedural basada en 5 lamas metálicas horizontales, costillas estructurales, remaches y guías laterales.
- Placa central de señalética integrada con jerarquía técnica: `SYSTEM HOLD`, `PAUSED`, `ESC — RESUME`.
- Cierre en 500 ms con efecto de masa hidráulica; apertura rápida en ~240 ms para evitar que el tablero quede parcialmente cubierto cuando el estado es `running`.
- Soporte para `@media (prefers-reduced-motion: reduce)` con transición instantánea.
- Precedencia determinista: `gameOver` inhabilita la compuerta para no cubrir la pantalla de resultados.
- Activos WAV derivados de producción en `public/audio/sfx/` (`pause-shutter-close.wav` y `pause-shutter-open.wav`).
- Microajuste de transporte BGM en `AudioManager`: `pauseMusic()` suspende la BGM con fade-out de ~150 ms conservando el offset temporal acumulado (`offset % duration`), y `resumeMusic()` la reanuda con fade-in de ~250 ms desde ese punto exacto.
- `AudioContext` se mantiene activo durante la pausa permitiendo la reproducción normal de SFX (`pauseShutterClose`, `pauseShutterOpen`, clics).
- Orquestación limpia de audio y música desde `App.vue` al detectar cambios de estado de sesión.
- Sustitución completa del contrato E2E legacy `pause-overlay` por `pause-shutter`.
- Suite de pruebas unitarias (`PauseShutter.test.ts`, `App.test.ts`, `audio-manager.test.ts`) y E2E Playwright (`essential-flow.spec.ts`) en verde.

Ver [Informe de implementación](implementation/0034-cortinilla-industrial-compuerta-pausa.md).

## Task [0035 — Perfiles de dificultad del bot (CADET / OPERATOR / ELITE)](tasks/0035-perfiles-dificultad-bot.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-13 |
| **Resultado** | Tres perfiles seleccionables de dificultad (`CADET`, `OPERATOR`, `ELITE`) integrados en el bot heurístico único de Rautfall (`DeterministicBot`). Parámetros modulables centralizados en `@rautfall/battle-engine` (`reactionDelaySteps`, `actionIntervalSteps`, `hardDropDelaySteps`, `optimalityTolerance`, `suboptimalChoiceProbability`, `sabotageEnergyThreshold`, `sabotageIntervalSteps`, `sabotageCooldownSteps`). Invariante estricto "Nunca Suicida", política de selección estocástica determinista con PRNG interno, inclusión probada de conjuntos de elegibilidad ($\text{ELITE} \subseteq \text{OPERATOR} \subseteq \text{CADET}$), normalización de alias heredados (`bot-deterministic-v1` $\to$ `battleOperator`), selector UI con botones `[ CADET ] [ OPERATOR ] [ ELITE ]` en el módulo de Batalla de `ModeSelector.vue` e integración completa en Phaser y `App.vue`. 725 tests Vitest en verde, lint, typecheck, build y test:e2e limpios. |

### Resumen

- Un único bot heurístico (`DeterministicBot`) modulado mediante tres perfiles de configuración centralizados (`CADET`, `OPERATOR`, `ELITE`) en `@rautfall/battle-engine`.
- Reglas físicas (SRS, DAS, ARR, gravedad y lock delay) 100% idénticas e independientes del perfil del bot.
- Invariante "Nunca Suicida" (Non-Suicidal Invariant): la selección subóptima opera exclusivamente sobre colocaciones no terminales cuando exista al menos una disponible.
- Selección estocástica determinista modulada por `optimalityTolerance` ($80.0 > 25.0 > 5.0$) y `suboptimalChoiceProbability` ($0.40 > 0.15 > 0.02$).
- Inclusión comprobada de conjuntos de candidatos elegibles para una misma instantánea de búsqueda.
- Normalización pura `normalizeBotProfileId` que mapea `undefined` y el alias legacy `'bot-deterministic-v1'` a `'battleOperator'`.
- Interfaz gráfica en `ModeSelector.vue` con selector de perfil `BOT PROFILE` dentro del módulo de Batalla.
- Propagación de `botProfile` a través de Phaser (`GameScene.ts`, `create-phaser-game.ts`), `GameCanvas.vue` y `App.vue` para persistir y registrar `opponentProfile` en la API POST de partidas.
- Validación completa: 725 tests Vitest pasados, lint sin advertencias ni errores, typecheck limpio, build exitoso y test E2E pasando.

Ver [Informe de implementación](implementation/0035-perfiles-dificultad-bot.md).

## Task [0036 — Mejora de audio: activación independiente de Música y SFX](tasks/0036-activacion-independiente-musica-sfx.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-14 |
| **Resultado** | Activación y desactivación independiente y persistente de los canales de **MÚSICA** y **SFX / EFECTOS** en Rautfall, cubriendo las 4 combinaciones operativas (ON/ON, OFF/ON, ON/OFF, OFF/OFF). `AudioManager` ampliado con `musicEnabled`, `sfxEnabled` y `desiredMusicTrack` para la recuperación automática de pistas BGM sin duplicación de nodos. Guarda centralizada de efectos en `playSfx()`. Persistencia independiente en `localStorage` (`rautfall_audio_music_enabled` y `rautfall_audio_sfx_enabled`) con migración defensiva desde la clave legacy `rautfall_audio_muted`. Preservación estricta de `AudioContext` pre-unlock sin creaciones ni destrucciones ansiosas. Interfaz Industrial Dramatic con toggles en cabecera (`App.vue`) y ajustes (`SettingsScreen.vue`). 956 tests Vitest en verde, lint, typecheck, build y test:e2e limpios. |

### Resumen

- `musicEnabled` y `sfxEnabled` representan las preferencias independientes de reproducción.
- `desiredMusicTrack` conserva la pista correspondiente a la pantalla activa, deteniendo el nodo sonoro cuando `musicEnabled === false` y reactivándolo al pasar a `true` sin fuentes duplicadas ni huérfanas.
- Centralización de la guarda de SFX en `playSfx()` para todas las rutas de efectos (eventos de motor, eventos de combate, UI, etc.).
- Persistencia en `localStorage` con claves explícitas y migración defensiva desde `rautfall_audio_muted` solo cuando ambas claves nuevas están ausentes.
- Compatibilidad retroactiva con `isMuted()` y `setMuted(muted)`.
- `AudioActivationModal.vue` inicializa y desbloquea `AudioContext` sin sobrescribir las preferencias individuales del operador.
- Controles de UI con estética Industrial Dramatic en la cabecera (`App.vue`) y en la pantalla de configuración (`SettingsScreen.vue`).
- Validación completa: 956 tests Vitest pasados en verde (57 archivos), 0 errores de lint, 0 errores de typecheck, build exitoso y pruebas E2E en Playwright pasando.

Ver [Informe de implementación](implementation/0036-activacion-independiente-musica-sfx.md).

## Task [0037 — Navegación web con Vue Router: URL sincronizada y soporte real de Back/Forward](tasks/0037-sincronizacion-url-y-soporte-back-forward.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-14 |
| **Resultado** | Navegación web real para la SPA de Rautfall mediante **Vue Router** (`vue-router@^4.5.0`), sincronizando la URL del navegador con la pantalla activa y habilitando el uso natural del historial (**Atrás**, **Adelante**, **Reinicio / F5** y **Deep Links**). Mapa de 10 rutas nombradas estables (`home`, `training`, `battle`, `settings`, `history`, `ranking`, `results`, `dev-tools`, `sfx-lab`, `not-found`). Eliminada completamente la ref `appScreen`. `gameMode`, `isCanvasMounted` y la reconciliación sonora derivan de `currentRouteName`. Guardas de navegación en `router/index.ts` para rutas DEV y fallback seguro de `/results` expirado hacia `home` (`replace`). Auditada y documentada la frontera de fallback SPA. 958 tests Vitest en verde, lint, typecheck, build y test:e2e Playwright limpios. |

### Resumen

- Integración de `vue-router@^4.5.0` en `@rautfall/web`.
- `router/index.ts` exporta `routes` y la factoría `createAppRouter(options)` para aislamiento en pruebas unitarias (`createMemoryHistory()`).
- Rutas nombradas estables (`name`: `'home'`, `'training'`, `'battle'`, `'settings'`, `'history'`, `'ranking'`, `'results'`, `'dev-tools'`, `'sfx-lab'`, `'not-found'`).
- Orquestación en `App.vue` impulsada por `currentRouteName` sin `appScreen` ref paralela.
- Guardas de navegación para restringir `/dev-tools` y `/sfx-lab` en producción (`!import.meta.env.DEV`) y redirigir accesos directos a `/results` sin partida activa hacia `home` (`replace`).
- Salida limpia de sesión Phaser en un solo canvas de juego al alternar entre rutas.
- Auditoría de la frontera del servidor de desarrollo (Vite servirá `index.html` para deep links en dev/E2E; Fastify API no sirve la SPA; documentada la exigencia de fallback estático `index.html` para servidores de producción).
- Validación completa: 958 tests Vitest en verde (57 archivos), lint sin errores ni warnings, typecheck limpio en 6 paquetes, build de producción en Vite correcto y 19 pruebas E2E en Playwright pasadas.

Ver [Informe de implementación](implementation/0037-sincronizacion-url-y-soporte-back-forward.md).

## Task [0038 — Integración Continua con GitHub Actions](tasks/0038-integracion-continua-github-actions.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-15 |
| **Resultado** | Workflow de Integración Continua (CI) en GitHub Actions (`.github/workflows/ci.yml`) que automatiza el control de calidad en cada `push` a `main` y en cada `pull_request` hacia `main`. Configuración en runners `ubuntu-24.04` con permisos globales acotados a `contents: read`. Dos jobs en paralelo: `quality` (ejecuta `pnpm lint`, `pnpm typecheck`, `pnpm test` utilizando Docker nativo para `@testcontainers/postgresql` con PostgreSQL 16 y `pnpm build`) y `e2e` (instala Chromium y sus dependencias del SO con `pnpm --filter @rautfall/web exec playwright install --with-deps chromium`, ejecuta `pnpm test:e2e` y sube los artefactos de `apps/web/playwright-report/` y `apps/web/test-results/` solo en caso de fallo). 960 tests Vitest en verde, 19 pruebas E2E de Playwright en verde, lint, typecheck, build y `git diff --check` limpios. |

### Resumen

- Definición del workflow `.github/workflows/ci.yml` activado en `push` y `pull_request` sobre `main`.
- Definición explícita de runner `ubuntu-24.04` para los dos jobs (`quality` y `e2e`).
- Permisos acotados a `contents: read`.
- Job `quality`: `actions/checkout@v6` -> `pnpm/action-setup@v6` (`10.34.5`) -> `actions/setup-node@v6` (`22.22.3`, `cache: pnpm`) -> `pnpm install --frozen-lockfile` -> `pnpm lint` -> `pnpm typecheck` -> `pnpm test` -> `pnpm build`.
- Job `e2e`: `actions/checkout@v6` -> `pnpm/action-setup@v6` (`10.34.5`) -> `actions/setup-node@v6` (`22.22.3`, `cache: pnpm`) -> `pnpm install --frozen-lockfile` -> `pnpm --filter @rautfall/web exec playwright install --with-deps chromium` -> `pnpm test:e2e` -> `actions/upload-artifact@v7` (si falla).
- Sin secretos, sin Neon, sin PostgreSQL `services:`, sin CD, sin Dockerfile de producción ni infraestructura innecesaria.
- Validación local completada al 100%: 960 tests Vitest pasados, 19 pruebas Playwright E2E pasadas, ESLint sin errores, typecheck limpio en 6 paquetes, build exitoso de Vite y `git diff --check` sin observaciones.

Ver [Informe de implementación](implementation/0038-integracion-continua-github-actions.md).

## Task [0039 — Despliegue en Vercel + Neon](tasks/0039-despliegue-vercel-neon.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-16 |
| **Resultado** | Arquitectura de despliegue cloud para Rautfall en **Vercel** (SPA Vue 3 / Vite y Serverless Functions de Fastify 5 via `api/[...path].ts`) y **Neon PostgreSQL** (base de datos serverless administrada). Validación final completada con CI remoto `quality` y `e2e` en verde, `/api/health` respondiendo 200 `{"status":"ok","database":"connected"}`, acceso directo/F5 en SPA funcional, warning de `memory` eliminado, runtime Node alineado en `22.x` y regresión de CI por ausencia de `packages/contracts/dist` resuelta. 961 tests Vitest pasados, lint, typecheck y build exitosos. |

### Resumen

- Adaptador Serverless oficial Fastify 5 en `api/[...path].ts` instanciando `buildApp()` en module scope y emitiendo `fastify.server.emit('request', req, res)`.
- Configuración de monorepo Vercel en `vercel.json` sirviendo `apps/web/dist`, declarando la Function `api/[...path].ts`, build de `@rautfall/contracts` previo y fallback SPA a `/index.html`.
- `api/tsconfig.json` para compilar la Serverless Function con `module: ESNext` y `moduleResolution: Bundler`.
- Corrección de resoluciones relativas ESM en 11 archivos de la API añadiendo extensiones `.js` y `/index.js`.
- Corrección de empaquetado runtime en `@rautfall/contracts`: compilación TypeScript a `dist/` (`index.js` y `index.d.ts`), exclusión de archivos `*.test.ts` de la distribución, y exportación de runtime desde `./dist/index.js` antes de los consumidores runtime. Resuelta la regresión de CI por ausencia de `packages/contracts/dist`.
- Ajustes finales de configuración de Vercel: flexibilizado `engines.node` a `"22.x"` en `package.json` raíz y eliminada la propiedad obsoleta `memory` en `vercel.json` (warning de memory eliminado).
- Estrategia Neon: `DATABASE_URL` Pooled para runtime y `NEON_DIRECT_URL` Directa para migraciones en CD (cero migraciones en cold start).
- Pipeline `.github/workflows/cd.yml` en GitHub Actions garantizando el flujo determinista.
- **Validación final**:
  - CI remoto quality y e2e en verde.
  - Vercel despliega correctamente la SPA y la Serverless Function.
  - `@rautfall/contracts` se compila a `dist/` antes de los consumidores runtime.
  - `/api/health` responde 200 con `{"status":"ok","database":"connected"}`.
  - Acceso directo y F5 en rutas SPA como `/settings` y `/training` funcionan correctamente.
  - Warning de memory eliminado.
  - Runtime Node alineado en 22.x.
  - La regresión de CI por ausencia de `packages/contracts/dist` está resuelta.
- **Estado final de la Tarea 0039**: ✅ Completada.

Ver [Informe de implementación](implementation/0039-despliegue-vercel-neon.md).

## Task [0040 — Modelo base de salas privadas PvP](tasks/0040-modelo-base-salas-privadas-pvp.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-19 |
| **Resultado** | Capa de aplicación en memoria creada en `apps/api` para representar y gestionar salas privadas PvP efímeras de 2 jugadores (`RoomManager`). Algoritmo de generación de códigos aleatorios cortos de 5 caracteres con alfabeto inequívoco (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) y reintentos ante colisiones, gestión in-memory desacoplada de transportes de red (WebSockets), estados mínimos `'waiting_for_player'` y `'ready'`, eliminación física en `closeRoom()`, inyección e instanciación de `BattleSession` al unirse Player 2 y guardas atómicas sin mutaciones parciales. 832 tests Vitest en verde, lint, typecheck, build y git diff --check limpios. |

### Resumen

- Módulo in-memory en `apps/api/src/rooms/` que gestiona el ciclo de vida de las salas privadas PvP.
- `PvPRoomStatus`: `'waiting_for_player' | 'ready'`. Sin estado `closed` residual ni `createdAt` especulativos.
- `generateRoomCode`: códigos cortos de 5 caracteres con alfabeto de 29 símbolos sin ambigüedad tipográfica (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) y reintentos atómicos ante colisiones.
- `RoomManager`: encapsula `Map<string, PvPRoom>`. Operaciones `createRoom`, `getRoom`, `joinRoom`, `closeRoom`.
- Inyección de factoría de batalla `BattleSessionFactory`: `createRoom()` no crea `BattleSession`, `joinRoom()` válido la crea e integra atómicamente, y `joinRoom()` fallido no la instancia.
- `closeRoom()` elimina físicamente la sala devolviendo `undefined` en llamadas posteriores a `getRoom()`.
- 16 pruebas unitarias específicas en `apps/api/test/rooms/room-manager.test.ts`. 832 pruebas totales en el monorepo.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` en verde.

Ver [Informe de implementación](implementation/0040-modelo-base-salas-privadas-pvp.md).

## Task [0041 — Transporte WebSocket para salas privadas PvP](tasks/0041-transporte-websocket-salas-privadas-pvp.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-19 |
| **Resultado** | Transporte WebSocket integrado en `apps/api` sobre Fastify 5 (`/ws/rooms`) conectando clientes con el modelo `RoomManager`. Protocolo cliente-servidor tipado con TypeBox en `@rautfall/contracts`, generación de identidad efímera interna por conexión socket, estado explícito de roles (`playerOne`/`playerTwo`), notificación simplificada `room_ready`, restricción de una sola sala por conexión (`ALREADY_IN_ROOM`), manejo de errores contractuales (`INVALID_JSON`, `BAD_REQUEST`, `ROOM_NOT_FOUND`, etc.) y limpieza idempotente de salas ante desconexiones con aviso al oponente (`player_disconnected`). 10 nuevas pruebas de integración reales en Vitest (1016 pruebas pasadas en total en el monorepo), lint, typecheck, build y git diff --check limpios. |

### Resumen

- Integración de `@fastify/websocket` v11 en `apps/api/src/routes/rooms-ws.ts`.
- Contratos TypeBox exportados en `packages/contracts/src/pvp-ws.ts` para ser compartidos con `apps/web` en tareas futuras.
- Protocolo simplificado sin `playerId` expuesto desde el cliente (`create_room`, `join_room`).
- Generación de UUID efímero por conexión WebSocket para interactuar de forma segura con `RoomManager`.
- Notificación de estado simplificada: `room_ready` envía `{ type: 'room_ready', code }`.
- Restricción de una sola sala por socket emitiendo el código de error `ALREADY_IN_ROOM`.
- Limpieza idempotente en eventos `close`/`error`: elimina la sala en `RoomManager`, limpia mapeos y envía `player_disconnected` al oponente.
- 12 pruebas de integración reales en `apps/api/test/routes/rooms-ws.test.ts`.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` en verde.

Ver [Informe de implementación](implementation/0041-transporte-websocket-salas-privadas-pvp.md).

## Task [0042 — Runtime autoritativo de gameplay PvP en servidor](tasks/0042-runtime-autoritativo-gameplay-pvp-servidor.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-19 |
| **Resultado** | Capa de ejecución autoritativa de gameplay PvP implementada en servidor (`apps/api`) conectando `RoomManager` y el transporte WebSocket de `/ws/rooms` con `BattleSession`. Bucle de simulación autoritativo a 100 Hz (`fixedStepMs = 10`) con acumulador monotónico y límite de catch-up de 100 ms, procesamiento de entradas event-driven `player_input` con retención de estado sostenido `held` y cola FIFO de acciones discretas `oneshot` (garantizando `maxActionsInSingleStep <= 1` por paso de 10 ms), broadcast de snapshots autoritativos a ~60 Hz (`STATE_BROADCAST_INTERVAL_MS = 16`), esquemas DTO TypeBox explícitos en `@rautfall/contracts` sin ningún `Type.Any()`, filtrado autoritativo de eventos visuales del rival durante `interferencia`, desacoplamiento mediante `GameRuntimeRegistry` y detención idempotente del runtime ante desconexiones. 1025 tests en verde en el monorepo, lint, typecheck, build y git diff --check limpios. |

### Resumen

- Implementado `RoomGameRuntime` en `apps/api/src/rooms/room-game-runtime.ts` para ejecutar la `BattleSession` autoritativa en servidor.
- Bucle monotónico de 100 Hz con acumulador `performance.now()` y tope de catch-up de 100 ms por iteración para evitar la *spiral of death*.
- Manejo de entradas event-driven con estado sostenido `held` (`leftHeld`, `rightHeld`, `softDropHeld`) y cola FIFO de acciones discretas `oneshot` (`consumeNextStepInput`).
- Invariante estricta mantenida: **máximo 1 acción discreta consumida por jugador por paso de 10 ms**, coincidiendo con la semántica del motor local. Multiplicidad conservada en steps de 10 ms consecutivos.
- Difusión periódica de snapshots de juego (`game_state`) a ~60 Hz (`STATE_BROADCAST_INTERVAL_MS = 16`).
- Filtrado autoritativo de eventos del rival (`filterEventsForParticipant`) cuando un participante está interferido.
- Desacoplamiento mediante `GameRuntimeRegistry` en `apps/api/src/rooms/game-runtime-registry.ts` sin alterar el modelo pasivo de `PvPRoom`.
- DTOs TypeBox de red completamente explícitos en `packages/contracts/src/pvp-ws.ts` sin `Type.Any()`.
- 9 nuevas pruebas unitarias y de integración en `apps/api/test/rooms/room-game-runtime.test.ts` y `apps/api/test/routes/rooms-ws-gameplay.test.ts`.
- Validaciones raíz `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` en verde (1025 pruebas pasadas).
Ver [Informe de implementación](implementation/0042-runtime-autoritativo-gameplay-pvp-servidor.md).

## Task [0043 — Cliente web PvP online](tasks/0043-cliente-web-pvp-online.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-19 |
| **Resultado** | Cliente web PvP online implementado en `apps/web` integrando el runtime autoritativo del servidor (Tarea 0042) mediante protocolo WebSocket tipado. Capa de red desacoplada (`OnlinePvPClient`), capa de sesión y traducción de entrada event-driven (`OnlineGameSession`), interfaz gráfica modal Industrial Dramatic para crear y unirse a salas con código de 5 caracteres (`OnlineRoomModal.vue`), cero ejecución de motor/bot local en modo `'online'`, renderizado autoritativo continuo a ~60 Hz con actualización de `OpponentMonitor.vue`, integración de resultados sin persistencia HTTP (`ResultsModal.vue` reutilizado) y desconexión limpia. 1032 tests en verde en el monorepo, lint, typecheck, build y `git diff --check` limpios. |

### Resumen

- `getWsApiUrl()` en `apps/web/src/api/client.ts` para resolución dinámica de WebSocket (`VITE_WS_BASE_URL` $\to$ derivación de `VITE_API_BASE_URL` $\to$ fallback de origen).
- `OnlinePvPClient` (`apps/web/src/api/pvp-ws-client.ts`): capa pura de red sin Phaser ni DOM.
- `OnlineGameSession` (`apps/web/src/api/online-game-session.ts`): capa de sesión/presentación que mantiene `heldState` y emite snapshots completos `WsStepInput` exclusivamente por eventos de teclado (`keydown`, `keyup`, `blur`). Cero polling de entrada desde `update()`.
- `OnlineRoomModal.vue` (`apps/web/src/components/OnlineRoomModal.vue`): modal de UI Industrial Dramatic con pestañas CREAR / UNIRSE, visualización de código de 5 caracteres, estado de espera y banner de error contractual.
- `GameScene.ts` en modo `'online'`: desactiva el motor local, bot local y acumulador temporal. Escucha teclado directo y renderiza a partir de `latestGameState` difundido a ~60 Hz por el servidor.
- `OpponentMonitor.vue`: visualización en tiempo real del tablero del oponente a partir del snapshot autoritativo recibido del servidor.
- `ResultsModal.vue`: reutilizado en partidas online para mostrar el resultado (Victoria / Derrota / Empate) ocultando la firma de operador y omitiendo la llamada a `POST /api/matches`.
- Pruebas unitarias de red, sesión, componente modal y escena Phaser en `apps/web/src/api/` y `apps/web/src/components/`.
- Validaciones raíz `pnpm test` (1032 tests), `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` en verde.

Ver [Informe de implementación](implementation/0043-cliente-web-pvp-online.md).

## Task [0044 — Auditoría E2E del modo PvP Online y correcciones de integración](tasks/0044-auditoria-e2e-modo-online-pvp.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-19 |
| **Resultado** | Suite de pruebas E2E con Playwright realizada con dos contextos de navegador independientes (`online-pvp.spec.ts`) contra el servidor API/WebSocket real. Corrección de la reactividad de Vue para sincronización determinista de revancha y estados P1/P2 en la UI (`App.vue`), revancha autoritativa idempotente en la misma sala conservando roles y sockets con nueva semilla uint32, gestión de desconexión del rival durante el combate (`OpponentDisconnectedModal.vue`), ocultación del botón `REINICIAR` en modo online y migración de la selección de dificultad de bot a un modal táctico (`BotDifficultyModal.vue`). 1057 tests unitarios/integración y 23 tests E2E en verde en el monorepo, lint, typecheck, build y `git diff --check` limpios. |

### Resumen

- Implementación de `apps/web/e2e/online-pvp.spec.ts` probando PvP real con 2 navegadores independientes (creación de sala, unión por código, avance de ticks, pausa autoritativa P1/P2 y abandono de partida).
- Solución de la reactividad de Vue en `App.vue` mediante referencias reactivas explícitas (`onlineSessionStatus`, `onlineRematchRequests`) eliminando la asimetría P1/P2 al negociar revanchas.
- Revancha autoritativa en la misma sala (`RoomManager.resetRoomBattleSession`) con reinicio autoritativo e idempotente del servidor.
- `OpponentDisconnectedModal.vue`: modal bloqueante compacto para notificación de abandono de rival.
- `BotDifficultyModal.vue`: modal de selección de dificultad para Batalla Táctica desmantelando el bloque estático del menú.
- Ocultación del botón `REINICIAR` en partidas PvP online (`gameMode !== 'online'`).
- Validaciones globales `pnpm test` (1057 tests), `pnpm test:e2e` (23 tests), `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` en verde.

Ver [Informe de implementación](implementation/0044-auditoria-e2e-modo-online-pvp.md).

## Task [0045 — Reacciones vocales automáticas del operador en combate](tasks/0045-reacciones-vocales-operador-combate.md)

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de actualización** | 2026-08-20 |
| **Resultado** | Reacciones vocales automáticas del operador implementadas para los modos de combate **Battle vs Bot Local** y **PvP Online** en `apps/web`. Precarga y reproducción de las 13 muestras WAV aprobadas mediante el `AudioContext` singleton y el bus `sfxGain` de `AudioManager`, selector puro `CombatReactionSelector` con entrada desacoplada `CombatEvaluationInput`, evaluación atómica por ciclo de juego, priorización estricta (`terminal` > `critical` > `garbageApplied` > `sabotageReceived` > `attackBlocked` / `defenseSuccess` > `attackLaunched`), función pura `isCriticalBoard` (evaluando `y <= 8` en cuadrículas locales y remotas), cooldown global de 5.000 ms, probabilidades e inyección determinista de `random`/`now` para tests, no repetición inmediata y victorias/derrotas terminales (una sola vez, ignorando cooldown, empate silencioso). Integración aislada en `GameScene.ts` cuando `mode === 'online'` o `mode === 'battle'` (evaluando exclusivamente al humano `playerOne`, bot silencioso y Training excluido) sin modificar motores, WebSocket protocol, backend ni persistencia. Pruebas unitarias completas en verde. |


### Resumen

- Módulo `operator-reactions.ts` con tipos `OperatorReactionType`, mapa de activos y definición de pools.
- `AudioManager` extendido con precarga, almacenamiento en memoria y reproducción de las 13 muestras WAV de reacciones vocales en el bus `sfxGain`.
- `CombatReactionSelector`: selector puro desacoplado con evaluación atómica de cada actualización de juego, derivando como máximo UNA única reacción por ciclo y descartando ráfagas sonoras.
- Jerarquía de prioridades estricta y regla de ataque propio basada exclusivamente en el hecho contractual `sabotageRouted` (`source === role`).
- Helper puro `isCriticalBoard`: evalúa celdas ocupadas en `y <= 8` dentro de las 24 filas del tablero local o remoto.
- Cooldown global de 5.000 ms, probabilística inyectable, evitación de repetición inmediata de la última frase usada y victorias/derrotas terminales de un único disparo.
- `GameScene.ts` integrado en `mode === 'online'` y `mode === 'battle'` con evaluación exclusiva para el jugador humano `playerOne` y reseteo completo de selector en cada inicio/desmontaje. Modo Training excluido.
- Pruebas unitarias exhaustivas en `combat-reaction-selector.test.ts`, `GameScene.test.ts` y `audio-manager.test.ts`.

Ver [Informe de implementación](implementation/0045-reacciones-vocales-operador-combate.md).
