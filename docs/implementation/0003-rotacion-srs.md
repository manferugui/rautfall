# 0003 — Rotación SRS (Informe de implementación)

## Resumen

Implementación completa del Super Rotation System (SRS) en el motor determinista de Rautfall: orientaciones numéricas, rotación horaria y antihoraria, tablas de wall kicks oficiales para JLSTZ e I, comportamiento específico de la pieza O, validación de colisiones, cancelación sin mutación, exposición de `orientation` en el snapshot y evento `pieceRotated`.

## Alcance implementado

- Enum `Orientation` con valores `Spawn = 0`, `Right = 1`, `Reverse = 2`, `Left = 3`.
- Campos de entrada `rotateClockwise` y `rotateCounterclockwise` como booleanos opcionales en `StepInput`.
- Validación extendida: acepta los nuevos campos, rechaza tipos no booleanos, rechaza `true` simultáneo.
- Tablas de celdas relativas para las cuatro orientaciones de cada pieza (I, O, T, S, Z, J, L).
- Tablas de wall kicks JLSTZ e I con los ocho desplazamientos por transición, convertidos a coordenadas del motor (y creciente hacia abajo).
- Algoritmo de rotación que recorre los kicks en orden oficial, validando con `isCollision` existente.
- Pieza O: actualiza orientación pero no modifica celdas ocupadas ni posición; no aplica wall kicks.
- Cancelación completa si ningún kick produce una posición válida.
- Exposición de `orientation` en `ActivePieceSnapshot`.
- Evento `pieceRotated` con payload `{ type: 'pieceRotated'; step: number; orientation: Orientation }`.
- Orden de paso: horizontal → rotación → hard drop/gravedad.
- 31 nuevas pruebas automatizadas que cubren todos los casos requeridos por la especificación.

## Archivos cambiados

### Modificados

- `packages/game-engine/src/index.ts` — Añadido `Orientation`, `PIECE_ORIENTATION_CELLS`, tablas SRS (`JLSTZ_KICKS`, `I_KICKS`), función `tryRotate`, integración en `processStep`, campos de entrada, validación, `orientation` en snapshot y tipo `pieceRotated` en `GameEvent`.
- `packages/game-engine/src/game-engine.test.ts` — 31 nuevas pruebas de rotación SRS.
- `apps/web/src/App.vue` — Botones Rotate CW/CCW, visualización de orientación en el panel de pieza activa y, tras la corrección del defecto de integración (ver más abajo), renderizado de un tablero compuesto que incluye la pieza activa.
- `docs/project-status.md` — Marcada tarea 0003 como completada; actualizado el recuento final de pruebas tras la corrección del defecto de integración.

### Creados (corrección de defecto de integración)

- `apps/web/src/board-composition.ts` — Función pura `composeBoardForRendering` que combina, solo para renderizado, las celdas fijas de `board` con las celdas de la pieza activa.
- `apps/web/src/board-composition.test.ts` — 7 pruebas focalizadas de la composición del tablero.

## Defecto de integración web detectado en validación manual

Durante la validación manual con `pnpm dev` se detectó que la pieza activa no se veía mientras caía: solo aparecía tras un hard drop, una vez fijada en el tablero. El contador de `step` y `elapsedMs` avanzaban con normalidad, lo que descartaba un problema del motor.

### Causa raíz

`apps/web/src/App.vue` renderizaba únicamente `snapshot.board` (las celdas fijas). La pieza activa se expone por separado en `snapshot.activePiece` y nunca se combinaba con el tablero al construir la cuadrícula visual, por lo que sus celdas jamás llegaban al DOM mientras estaba en curso.

Esto es un defecto de integración de la aplicación web, no del motor: `ActivePieceSnapshot.cells` ya expone las celdas absolutas de la pieza activa (ver `packages/game-engine/src/index.ts`, `getSnapshot()`), de modo que no fue necesario modificar el contrato público del motor ni duplicar la geometría de las piezas en la aplicación web.

### Corrección aplicada

Se añadió `apps/web/src/board-composition.ts` con una función pura, `composeBoardForRendering(board, activePiece)`, que:

- copia `board` (nunca lo muta);
- superpone sobre la copia las celdas de `activePiece.cells` cuyo `y` no pertenece a una fila oculta (`y >= 4`, mismo límite ya reflejado en el título del tablero de `App.vue`);
- descarta (clip) las celdas de la pieza activa situadas en filas ocultas, que no llegan a superponerse sobre la copia.

`App.vue` expone un `computed` (`renderedBoard`) que llama a esta función con `snapshot.value.board` y `snapshot.value.activePiece`, y la plantilla itera sobre `renderedBoard` en lugar de `snapshot.board`. No se modificaron `snapshot.board` ni `snapshot.activePiece`; la composición se construye siempre sobre una copia nueva.

No se introdujo una clase CSS ni un color distintos para la pieza activa: al reutilizar el mismo valor `PieceType` que las celdas fijas, la pieza activa se colorea automáticamente con las clases `cell-I`, `cell-O`, etc. ya existentes, sin rediseño visual.

### Pruebas añadidas para el defecto

`apps/web/src/board-composition.test.ts`, 7 pruebas:

- la pieza activa se representa en el tablero compuesto;
- las celdas fijas del tablero se conservan;
- las celdas de la pieza activa en filas ocultas no se renderizan;
- las celdas visibles de la pieza activa aparecen en las coordenadas correctas;
- la rotación cambia las celdas de la pieza activa que se renderizan;
- el hard drop no produce celdas duplicadas tras fijar la pieza;
- la composición no muta el snapshot ni el tablero original.

### Validación manual

- `pnpm dev` arrancó sin errores en el log del servidor y la petición HTTP a la aplicación respondió `200`.
- Se verificaron manualmente en un navegador real la rotación (horaria y antihoraria), el movimiento horizontal, el hard drop y el reset; la pieza activa se renderiza correctamente durante la caída, sin quedar oculta hasta la fijación.
- El servidor de desarrollo se detuvo al finalizar.

## Cambios en contratos públicos

| Contrato | Cambio |
|---|---|
| `Orientation` | Nuevo enum exportado con 4 valores |
| `StepInput` | Añadidos `rotateClockwise?: boolean` y `rotateCounterclockwise?: boolean` |
| `ActivePieceSnapshot` | Añadido `orientation: Orientation` |
| `GameEvent` | Nuevo miembro `{ type: 'pieceRotated'; step: number; orientation: Orientation }` |

No se modificaron otros contratos existentes.

## Modelo de orientación

```ts
export enum Orientation {
  Spawn = 0,
  Right = 1,
  Reverse = 2,
  Left = 3,
}
```

- `Spawn`: orientación inicial (estado 0 SRS).
- `Right`: equivalente a R (giro horario desde Spawn).
- `Reverse`: equivalente a 2 (180 grados).
- `Left`: equivalente a L (giro antihorario desde Spawn).

## Tablas SRS utilizadas

Se utilizan las tablas oficiales de wall kicks del Super Rotation System:

- **Tabla JLSTZ**: 5 kicks por cada una de las 8 transiciones, aplicable a J, L, S, T, Z.
- **Tabla I**: 5 kicks por cada una de las 8 transiciones, específica para la pieza I.
- **Tabla O**: vacía (sin kicks); solo se evalúa el desplazamiento (0,0).

## Conversión de coordenadas

Los valores de las tablas SRS oficiales (con Y positivo hacia arriba) se almacenan ya convertidos a coordenadas del motor:

```
engineX = srsX
engineY = -srsY
```

No se realiza inversión dinámica de Y durante la rotación.

## Algoritmo de rotación

Para cada paso con `rotateClockwise: true` o `rotateCounterclockwise: true`:

1. Determinar la orientación destino: `(orientation + 1) % 4` (horaria) o `(orientation + 3) % 4` (antihoraria).
2. Para pieza O: actualizar orientación directamente si las celdas no colisionan (siempre válido).
3. Para el resto: obtener la secuencia de kicks de la tabla correspondiente.
4. Probar cada kick en orden; el primer candidato sin colisión se aplica (actualiza x, y y orientation).
5. Si ningún kick es válido, no se muta el estado.

## Comportamiento de la pieza O

- La pieza O actualiza su `orientation` en cada rotación (Spawn → Right → Reverse → Left → Spawn).
- No modifica sus celdas ocupadas (idénticas en las cuatro orientaciones).
- No modifica su posición x/y.
- No aplica wall kicks.
- Emite `pieceRotated` con normalidad.

## Validación de entrada simultánea

- `rotateClockwise: true` y `rotateCounterclockwise: true` en el mismo `step()` lanzan `EngineStepError` con `code: 'INVALID_GAME_INPUT'`.
- No se prioriza ninguna dirección.
- No se ejecuta ninguna rotación.
- No se muta el estado del motor.
- No se emiten eventos.

## Comportamiento de eventos

- `pieceRotated` se emite solo cuando la rotación tiene éxito (se aplica un kick válido).
- No se emite para rotaciones fallidas.
- No se emite para entrada simultánea inválida (la validación previa lanza excepción).
- Incluye `step` y `orientation` (orientación resultante).

## Pruebas añadidas

31 nuevas pruebas distribuidas en las siguientes categorías:

- **Rotación horaria** (3): cambio a Right, kick 0 sin desplazamiento, kick lateral junto a pared.
- **Rotación antihoraria** (1): cambio a Left.
- **Transiciones** (2): ocho transiciones para T (JLSTZ) y ocho para I.
- **Wall kicks** (5): lateral exitoso, floor kick, tabla JLSTZ, tabla I, O sin kicks.
- **Colisiones** (2): contra pared, contra bloques fijos.
- **Cancelación** (2): estado no muta tras fallo, snapshot conserva todo.
- **Pieza O** (4): orientación se actualiza, celdas no cambian, posición no cambia, no aplica kicks.
- **Eventos** (2): éxito emite pieceRotated, fallo no emite nada.
- **Ciclos completos** (2): 4 CW y 4 CCW devuelven a Spawn.
- **Snapshots** (2): orientation tras spawn, orientation tras rotación.
- **Determinismo** (2): misma semilla → mismos resultados, PRNG no afectado.
- **Validación de entrada** (4): simultáneos rechazados, sin mutación, CW solo funciona, CCW solo funciona.

**Total de pruebas**: 126 (88 de 0002 + 31 de rotación SRS + 7 de la corrección del defecto de integración web).

## Resultados de validación

Resultados tras implementar la rotación SRS (antes de detectar el defecto de integración web):

| Comando | Resultado |
|---|---|
| `pnpm test` | ✅ 119/119 tests pasan |
| `pnpm lint` | ✅ 0 errores, 2 avisos (orden de atributos Vue) |
| `pnpm typecheck` | ✅ Sin errores |
| `pnpm build` | ✅ Build exitoso |

Resultados finales, tras corregir el defecto de integración (pieza activa no visible):

| Comando | Resultado |
|---|---|
| `pnpm test` | ✅ 126/126 tests pasan |
| `pnpm lint` | ✅ 0 errores, 0 avisos |
| `pnpm typecheck` | ✅ Sin errores |
| `pnpm build` | ✅ Build exitoso |

## Documentación creada o actualizada

- `docs/implementation/0003-rotacion-srs.md` — Este informe.
- `docs/project-status.md` — Marcada 0003 como completada, fecha, resultado.

## Limitaciones conocidas

No se han identificado limitaciones conocidas dentro del alcance de la tarea 0003.

## Confirmación de alcance excluido

No se añadieron:

- Rotación de 180 grados.
- Lock delay.
- T-Spin detection o scoring.
- Ghost piece.
- Hold piece.
- Phaser.
- Audio, backend, persistencia.
- Nuevas dependencias.
- Capas arquitectónicas innecesarias.
- `console.log` de depuración.
- Archivos en `.claude/`.
