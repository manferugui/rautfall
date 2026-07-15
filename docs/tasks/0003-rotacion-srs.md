# 0003 — Rotación SRS

## Estado

- **Proyecto:** Rautfall
- **Fase:** Super Rotation System completo en el motor determinista
- **Estado de la tarea:** lista para implementación
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0003`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor completo pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0003-rotacion-srs.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente ([Informe de implementación](../implementation/0003-rotacion-srs.md)).

## 1. Objetivo

Añadir soporte completo de rotación SRS al motor determinista existente, incluyendo:

- Orientación numérica explícita para cada pieza.
- Rotación horaria y antihoraria mediante acciones de entrada dedicadas.
- Tablas oficiales de wall kicks para JLSTZ e I.
- Comportamiento específico de la pieza O.
- Validación de colisiones durante la rotación.
- Cancelación sin mutación cuando ninguna posición candidata es válida.
- Exposición de la orientación en el snapshot inmutable.
- Evento `pieceRotated` para rotaciones exitosas.

## 2. Relación con el plan técnico

```
0001 — Base del prototipo              ✅ Completada
0002 — Motor de juego determinista      ✅ Completada
0003 — Rotación SRS                     ← Esta tarea
0004 — Integración con Phaser
0005 — Prototipo vertical Tactical
```

Esta tarea no incluye lock delay, T-Spin detection, scoring, combos, back-to-back, ghost piece, hold piece, Phaser, audio, backend, ni rediseño visual.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — decisiones globales del producto, en particular la sección «Sistema de rotación» y SRS.
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) — contratos del motor existente que se amplían, no se reescriben.
- `packages/game-engine/src/index.ts` — API pública actual.
- `packages/game-engine/src/game-engine.test.ts` — pruebas existentes.
- [docs/project-status.md](../project-status.md) — estado actual del proyecto.

## 4. Alcance incluido

- Enum `Orientation` con valores `Spawn = 0`, `Right = 1`, `Reverse = 2`, `Left = 3`.
- Acciones de entrada `rotateClockwise` y `rotateCounterclockwise` como campos booleanos opcionales en `StepInput`.
- Celdas relativas de cada pieza para las cuatro orientaciones, en coordenadas del motor (y creciente hacia abajo).
- Tablas de wall kicks para JLSTZ y para I, con las ocho transiciones entre orientaciones.
- Algoritmo de rotación que recorre los kicks en orden oficial, valida cada candidato y aplica el primero válido.
- Comportamiento de la pieza O: actualiza orientación, no modifica celdas ocupadas, no aplica wall kicks.
- Cancelación completa de la rotación si ningún kick produce una posición válida.
- Validación de colisiones en rotación reutilizando la función `isCollision` existente.
- Exposición de `orientation` en `ActivePieceSnapshot`.
- Nuevo evento `pieceRotated` con motivo `clockwise` o `counterclockwise`.
- Ausencia de evento para rotaciones fallidas.
- Pruebas automatizadas de los casos requeridos (ver §20).
- Determinismo: misma semilla y mismas entradas producen idéntico resultado.

## 5. Alcance explícitamente excluido

- Rotación de 180 grados.
- Lock delay y reinicio del temporizador de fijación.
- Detección de T-Spin, T-Spin Mini o cualquier bonificación por rotación.
- Scoring, combos, back-to-back.
- Ghost piece.
- Hold piece.
- Phaser.
- Audio.
- Backend o persistencia.
- Rediseño visual o Industrial Dramatic.
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §4.

## 6. Orientation enum

```ts
export enum Orientation {
  Spawn = 0,
  Right = 1,
  Reverse = 2,
  Left = 3,
}
```

Significado:

- `Spawn`: orientación inicial de la pieza (estado 0 en SRS).
- `Right`: equivalente a R (giro horario desde Spawn).
- `Reverse`: equivalente a 2 (180 grados).
- `Left`: equivalente a L (giro antihorario desde Spawn).

El enum se exporta desde el paquete `game-engine`.

## 7. Acciones de entrada

Se añaden dos campos booleanos opcionales a `StepInput`:

```ts
type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};
```

Reglas:

- Ambos campos son opcionales y su valor por defecto implícito es `false`.
- `rotateClockwise: true` y `rotateCounterclockwise: true` simultáneos en el mismo paso son una entrada inválida: se rechazan de forma determinista con `EngineStepError` y `code: 'INVALID_GAME_INPUT'` (mismo tipo de error y mismo código que el resto de la validación de `StepInput`, ver §16). No se prioriza ninguna dirección y no se ejecuta ninguna rotación; el motor no muta estado ni emite eventos, igual que ante cualquier otra entrada inválida (§13 de 0002).
- No se introduce una acción genérica `rotate` con parámetros.
- No se incluye rotación de 180 grados.

La validación de entrada se amplía para aceptar estos campos como opcionales permitidos. Propiedades desconocidas adicionales siguen siendo rechazadas.

## 8. Sistema de coordenadas

Se conserva el sistema existente del motor:

- x crece hacia la derecha.
- y crece hacia abajo.

Las tablas SRS oficiales utilizan Y positivo hacia arriba. Los desplazamientos (kicks) se almacenan ya convertidos a coordenadas del motor:

```
engineX = srsX
engineY = -srsY
```

No se invierte Y dinámicamente durante cada intento de rotación.

## 9. Celdas por orientación

Cada pieza define sus cuatro celdas relativas para cada una de las cuatro orientaciones. Las coordenadas están en el sistema del motor (y hacia abajo), con origen en la celda superior izquierda del bounding box tras la rotación.

Se utilizarán las posiciones estándar del SRS, adaptadas a coordenadas del motor. El tamaño del bounding box puede variar según la orientación.

A continuación se definen las celdas para cada pieza y orientación. Las celdas se expresan como vectores (x, y) desde el origen de la pieza.

### Pieza I

| Orientation | Celdas relativas |
|---|---|
| Spawn | (0,1), (1,1), (2,1), (3,1) |
| Right | (2,0), (2,1), (2,2), (2,3) |
| Reverse | (0,2), (1,2), (2,2), (3,2) |
| Left | (1,0), (1,1), (1,2), (1,3) |

### Pieza O

| Orientation | Celdas relativas |
|---|---|
| Spawn | (0,0), (1,0), (0,1), (1,1) |
| Right | (0,0), (1,0), (0,1), (1,1) |
| Reverse | (0,0), (1,0), (0,1), (1,1) |
| Left | (0,0), (1,0), (0,1), (1,1) |

La pieza O tiene las mismas celdas en las cuatro orientaciones.

### Pieza T

| Orientation | Celdas relativas |
|---|---|
| Spawn | (1,0), (0,1), (1,1), (2,1) |
| Right | (1,0), (1,1), (2,1), (1,2) |
| Reverse | (0,1), (1,1), (2,1), (1,2) |
| Left | (1,0), (0,1), (1,1), (1,2) |

### Pieza S

| Orientation | Celdas relativas |
|---|---|
| Spawn | (1,0), (2,0), (0,1), (1,1) |
| Right | (1,0), (1,1), (2,1), (2,2) |
| Reverse | (1,1), (2,1), (0,2), (1,2) |
| Left | (0,0), (0,1), (1,1), (1,2) |

### Pieza Z

| Orientation | Celdas relativas |
|---|---|
| Spawn | (0,0), (1,0), (1,1), (2,1) |
| Right | (2,0), (1,1), (2,1), (1,2) |
| Reverse | (0,1), (1,1), (1,2), (2,2) |
| Left | (1,0), (0,1), (1,1), (0,2) |

### Pieza J

| Orientation | Celdas relativas |
|---|---|
| Spawn | (0,0), (0,1), (1,1), (2,1) |
| Right | (1,0), (2,0), (1,1), (1,2) |
| Reverse | (0,1), (1,1), (2,1), (2,2) |
| Left | (1,0), (1,1), (0,2), (1,2) |

### Pieza L

| Orientation | Celdas relativas |
|---|---|
| Spawn | (2,0), (0,1), (1,1), (2,1) |
| Right | (1,0), (1,1), (1,2), (2,2) |
| Reverse | (0,1), (1,1), (2,1), (0,2) |
| Left | (0,0), (1,0), (1,1), (1,2) |

## 10. Tablas de wall kicks

Cada transición entre orientaciones define una secuencia ordenada de desplazamientos (dx, dy) en coordenadas del motor. El primer desplazamiento es siempre (0, 0) (intento sin desplazamiento).

### Tabla JLSTZ

Los valores se expresan en coordenadas del motor (y_down). Entre paréntesis consta el valor SRS original como referencia (srsX, srsYUp).

| Transición | Kick 0 | Kick 1 | Kick 2 | Kick 3 | Kick 4 |
|---|---|---|---|---|---|
| Spawn → Right | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
| Right → Spawn | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
| Right → Reverse | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |
| Reverse → Right | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
| Reverse → Left | (0, 0) | (+1, 0) | (+1, -1) | (0, +2) | (+1, +2) |
| Left → Reverse | (0, 0) | (-1, 0) | (-1, +1) | (0, -2) | (-1, -2) |
| Left → Spawn | (0, 0) | (-1, 0) | (-1, -1) | (0, +2) | (-1, +2) |
| Spawn → Left | (0, 0) | (+1, 0) | (+1, +1) | (0, -2) | (+1, -2) |

### Tabla I

| Transición | Kick 0 | Kick 1 | Kick 2 | Kick 3 | Kick 4 |
|---|---|---|---|---|---|
| Spawn → Right | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
| Right → Spawn | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
| Right → Reverse | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |
| Reverse → Right | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
| Reverse → Left | (0, 0) | (+2, 0) | (-1, 0) | (+2, +1) | (-1, -2) |
| Left → Reverse | (0, 0) | (-2, 0) | (+1, 0) | (-2, -1) | (+1, +2) |
| Left → Spawn | (0, 0) | (+1, 0) | (-2, 0) | (+1, -2) | (-2, +1) |
| Spawn → Left | (0, 0) | (-1, 0) | (+2, 0) | (-1, +2) | (+2, -1) |

### Pieza O

La tabla de kicks para O está vacía (no se intenta ningún desplazamiento). El algoritmo solo comprueba la rotación sin desplazamiento.

## 11. Algoritmo de rotación

La rotación se procesa tras el movimiento horizontal y antes del hard drop y la gravedad, dentro del orden lógico del paso (`processStep`).

Al llegar a este punto, `rotateClockwise` y `rotateCounterclockwise` nunca son ambos `true`: esa combinación ya fue rechazada como entrada inválida en la validación previa (§7, §16) y el paso no llega a ejecutarse.

```
1. Si rotateClockwise o rotateCounterclockwise:
   a. Determinar la orientación destino:
      - Clockwise:  (orientation + 1) % 4
      - Counterclockwise: (orientation + 3) % 4
   b. Obtener la secuencia de kicks para la transición (pieza, desde, hacia).
   c. Para cada kick en orden:
      - Calcular las celdas candidatas usando las celdas de la orientación destino, el origen actual y el desplazamiento del kick.
      - Validar las celdas candidatas:
        · Dentro del tablero (x en [0, 9], y en [0, 23]).
        · Sin colisión con bloques fijos.
      - Si son válidas: actualizar orientación, origen (x += dx, y += dy), y emitir pieceRotated.
      - Si no, continuar con el siguiente kick.
   d. Si ningún kick es válido, no mutar nada. No emitir evento.
2. Continuar con el resto del paso (hard drop, gravedad, etc.).
```

### Reglas específicas

- La pieza O actualiza su orientación pero no sus celdas ocupadas ni su posición x/y. No aplica wall kicks. Si el candidato sin desplazamiento (0, 0) es válido (siempre lo es porque las celdas no cambian), la rotación tiene éxito y se emite `pieceRotated`.
- Una rotación fallida no debe mutar: piece type, position, orientation, board, next piece, game status, PRNG, bag state, ni la secuencia determinista de piezas.
- Un paso puede contener simultáneamente movimiento horizontal, rotación y hard drop. El orden es: horizontal → rotación → hard drop/gravedad.

## 12. Colisión en rotación

La rotación reutiliza la función `isCollision` existente. No se requiere lógica de colisión específica para rotación.

## 13. Integración en el orden del paso

El orden lógico del paso (definido en 0002, §14) se modifica para insertar la rotación entre el movimiento horizontal y el hard drop:

1. Comprobar estado del motor.
2. Validar entrada.
3. Incrementar contador de paso.
4. Incrementar tiempo lógico.
5. Movimiento horizontal.
6. **Rotación** (nuevo paso, ver §11).
7. Hard drop (si procede).
8. Gravedad (si no hay hard drop).
9. Fijación.
10. Eliminación de líneas.
11. Spawn de siguiente pieza.
12. Emisión de eventos.

## 14. Evento pieceRotated

Se añade un nuevo tipo al discriminated union `GameEvent`:

```ts
| { type: 'pieceRotated'; step: number; orientation: Orientation }
```

Reglas:

- `pieceRotated` se emite únicamente cuando la rotación tiene éxito (se aplica un kick válido).
- No se emite `pieceRotated` para rotaciones fallidas.
- El evento incluye la orientación resultante tras la rotación.
- No se emite por separado para O ni para ninguna pieza; todas las rotaciones exitosas emiten el mismo evento.

## 15. Snapshot

`ActivePieceSnapshot` se amplía con el campo `orientation`:

```ts
type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;
```

- `orientation` refleja la orientación actual de la pieza activa.
- Tras una rotación exitosa, `orientation` se actualiza en el snapshot.
- Tras una rotación fallida, `orientation` permanece sin cambios.
- En el spawn inicial, `orientation` es `Orientation.Spawn`.
- Tras `reset()`, `orientation` es `Orientation.Spawn`.
- El snapshot sigue siendo inmutable.

## 16. Validación de entrada ampliada

La función `validateInput` se amplía para aceptar `rotateClockwise` y `rotateCounterclockwise` como propiedades opcionales permitidas.

- Si están presentes y no son `boolean`, se lanza `INVALID_GAME_INPUT`.
- Si están ausentes, se comportan como `false`.
- Si `rotateClockwise === true` y `rotateCounterclockwise === true` en la misma entrada, se lanza `INVALID_GAME_INPUT` (esta comprobación se realiza tras validar que ambos campos son `boolean`, junto con el resto de la validación de forma, antes de cualquier mutación).
- Las propiedades desconocidas adicionales siguen siendo rechazadas.

Lista de claves permitidas: `['horizontal', 'hardDrop', 'rotateClockwise', 'rotateCounterclockwise']`.

## 17. API pública ampliada

Exportaciones nuevas desde `packages/game-engine/src/index.ts`:

- `Orientation` (enum).
- Actualización de `StepInput`, `GameEvent`, `ActivePieceSnapshot`.

No se modifican otros contratos existentes.

## 18. Determinismo

La rotación debe ser determinista:

- Dada la misma semilla, el mismo estado del motor y la misma entrada, el resultado de la rotación (éxito, orientación final, posición, eventos) debe ser idéntico.
- El PRNG no interviene en la rotación: las tablas de kicks son fijas y el orden de evaluación es determinista.

## 19. Dependencias

No se añadirán nuevas dependencias externas para esta tarea.

## 20. Pruebas mínimas requeridas

Las pruebas se escriben con descripciones en castellano en los bloques `describe`, `it` y `test`. Los identificadores y contratos públicos permanecen en inglés.

### Rotación horaria
- Una rotación horaria desde Spawn cambia la orientación a Right.
- La pieza rota sin desplazamiento cuando hay espacio suficiente (kick 0 es válido).
- La rotación horaria se aplica con kick lateral cuando la pieza está junto a una pared.

### Rotación antihoraria
- Una rotación antihoraria desde Spawn cambia la orientación a Left.

### Transiciones entre orientaciones
- Todas las ocho transiciones funcionan para una pieza JLSTZ genérica (T, por ejemplo).
- Todas las ocho transiciones funcionan para la pieza I.
- Cada transición utiliza la secuencia de kicks correcta.

### Wall kicks
- Un wall kick lateral exitoso desplaza la pieza horizontalmente.
- Un wall kick desde el suelo (floor kick) desplaza la pieza verticalmente.
- Se utiliza la tabla JLSTZ para piezas J, L, S, T, Z.
- Se utiliza la tabla I para la pieza I.
- La pieza O no aplica wall kicks.

### Colisiones
- Rotación bloqueada por colisión contra pared izquierda o derecha.
- Rotación bloqueada por colisión contra el techo del tablero (límite superior).
- Rotación bloqueada por colisión contra bloques fijos adyacentes.

### Cancelación
- Una rotación completamente bloqueada (ningún kick válido) no muta el estado.
- Tras una rotación fallida, el snapshot conserva piece type, posición, orientación, board, next piece, status, PRNG y bag state.

### O piece
- La rotación de O actualiza su orientación.
- La rotación de O no modifica sus celdas ocupadas.
- La rotación de O no modifica su posición x e y.
- La rotación de O no aplica wall kicks.

### Eventos
- Una rotación exitosa emite `pieceRotated` con la orientación destino y el step actual.
- Una rotación fallida no emite ningún evento.

### Ciclos completos
- Cuatro rotaciones horarias consecutivas devuelven a la orientación y geometría inicial (Spawn), si el espacio lo permite.
- Cuatro rotaciones antihorarias consecutivas devuelven a la orientación y geometría inicial (Spawn), si el espacio lo permite.

### Snapshots
- El snapshot expone `orientation` tras el spawn.
- El snapshot expresa la orientación actualizada tras una rotación exitosa.

### Determinismo
- Misma semilla y mismas entradas (incluyendo rotaciones) producen snapshot y eventos idénticos.
- El PRNG no se ve afectado por las rotaciones.

### Validación de entrada de rotación
- `rotateClockwise: true` junto con `rotateCounterclockwise: true` en el mismo `step()` lanza `EngineStepError` con `code: 'INVALID_GAME_INPUT'`.
- Esa combinación no muta el estado del motor (piece type, posición, orientación, board, next piece, PRNG, bag state, contador de pasos, tiempo lógico) ni emite ningún evento.
- `rotateClockwise: true` con `rotateCounterclockwise` ausente o `false` rota en sentido horario con normalidad.
- `rotateCounterclockwise: true` con `rotateClockwise` ausente o `false` rota en sentido antihorario con normalidad.

## 21. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Todos deben finalizar correctamente.

Además, revisar:

- No existen imports profundos entre paquetes.
- No se han añadido dependencias no justificadas.
- No existe código muerto o no usado.
- No hay abstracciones innecesarias.
- No se ha ampliado el alcance.
- No hay errores ni avisos ignorados.
- Las 88 pruebas de 0002 continúan pasando.

## 22. Criterios de aceptación

- `Orientation` es un enum numérico exportado con valores Spawn, Right, Reverse, Left.
- `StepInput` acepta `rotateClockwise` y `rotateCounterclockwise` como booleanos opcionales.
- Ambas direcciones de rotación están soportadas.
- Las tablas de kicks respetan el orden oficial SRS.
- JLSTZ e I utilizan tablas de kicks separadas.
- Los desplazamientos se almacenan ya convertidos a coordenadas del motor (y_down).
- El algoritmo evalúa los kicks en orden y aplica el primer candidato válido.
- Una rotación completamente bloqueada no muta el estado del motor.
- La pieza O rota lógicamente sin desplazamiento visible.
- `ActivePieceSnapshot` incluye `orientation`.
- `GameEvent` incluye `pieceRotated` con step y orientation.
- No se emite evento para rotaciones fallidas.
- `rotateClockwise: true` y `rotateCounterclockwise: true` simultáneos se rechazan de forma determinista con `EngineStepError` y `code: 'INVALID_GAME_INPUT'`, sin priorizar ninguna dirección, sin ejecutar ninguna rotación y sin mutar el estado del motor.
- Las pruebas automatizadas cubren los casos requeridos.
- Las pruebas existentes del motor determinista continúan pasando.
- No se introduce ninguna funcionalidad fuera de alcance.

## 23. Actualizaciones de documentación

Este documento ([docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación.

Al finalizar la implementación:

- Crear [docs/implementation/0003-rotacion-srs.md](../implementation/0003-rotacion-srs.md) como informe de implementación independiente.
- Actualizar [docs/project-status.md](../project-status.md):
  - Estado de 0003: completada.
  - Fecha de finalización.
  - Resultado resumido.
  - Referencia al informe de implementación.
  - Siguiente tarea: `0004 — Integración con Phaser`.

## 24. Próxima tarea prevista

`0004 — Integración con Phaser`
