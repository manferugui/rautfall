# 0002 — Motor de juego determinista

## Estado

- **Proyecto:** Rautfall
- **Fase:** motor determinista con tablero, piezas, PRNG, colisiones, gravedad y eliminación de líneas
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia para esta tarea:** esta especificación define el alcance físico y técnico exacto de `0002`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en `docs/rautfall.md` para el motor completo pertenece automáticamente a esta tarea.
- **Modelo de tablero:** esta revisión alinea el modelo de tablero de 0002 con el modelo consolidado de `docs/rautfall.md` (tablero interno de 10×24 con 4 filas ocultas superiores y 20 filas visibles). La condición de fin de partida `lockAboveBoard` de una revisión anterior de este documento ha sido eliminada; el único motivo de fin de partida en esta tarea es `spawnBlocked`.
- **Documento:** esta especificación (`0002-motor-de-juego-determinista.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, `docs/implementation/0002-implementacion-motor-determinista.md` (ver §30).

## 1. Objetivo

Implementar el núcleo determinista del motor de juego que permita:

- Crear un tablero interno de 10 columnas × 24 filas (4 filas ocultas superiores y 20 filas visibles), con origen en la esquina superior izquierda del tablero interno.
- Generar piezas de tipo I, O, T, S, Z, J, L mediante una bolsa de siete barajada con Fisher–Yates sobre un PRNG mulberry32.
- Colocar cada pieza en una posición inicial centrada, con una única orientación, de modo que quede al menos parcialmente visible de inmediato, utilizando las filas ocultas superiores como colchón de aparición cuando la pieza lo requiera.
- Mover la pieza activa horizontalmente según la entrada del usuario.
- Aplicar gravedad basada exclusivamente en tiempo lógico (`fixedStepMs` y `gravityCellsPerSecond`).
- Ejecutar hard drop.
- Detectar colisiones contra paredes, límites del tablero interno y bloques fijos.
- Fijar la pieza activa inmediatamente cuando el movimiento descendente sea imposible.
- Eliminar líneas completas de forma simultánea, tanto en filas ocultas como visibles.
- Generar la siguiente pieza tras cada fijación y eliminación de líneas, y finalizar la partida únicamente si esa nueva pieza no puede colocarse en su posición inicial (`spawnBlocked`).
- Exponer un snapshot inmutable, eventos tipados y estricta validación de entrada.
- Soportar reinicio determinista.

## 2. Relación con el plan técnico

La secuencia inicial de trabajo queda fijada así:

1. `0001 — Base del prototipo` ✅ Completada
2. `0002 — Motor de juego determinista` ← Esta tarea
3. `0003 — Rotación SRS`
4. `0004 — Integración con Phaser`
5. `0005 — Prototipo vertical Tactical`

Esta tarea no incluye rotación, SRS ni wall kicks. Tampoco incluye lock delay, DAS, ARR, soft drop, puntuación, combos, T-Spins, back-to-back, hold, ghost piece, energía, ataques, batalla, bot, replay, Phaser, audio, backend ni base de datos.

## 3. Fuentes de verdad

- `docs/rautfall.md` — decisiones globales del producto, en particular la bolsa de siete piezas, el PRNG determinista, la arquitectura del motor y el modelo de tablero de 10×24 con 4 filas ocultas superiores.
- `packages/game-config/src/index.ts` — contrato y valores actuales de configuración.
- `packages/game-engine/src/index.ts` — contrato público existente del motor. Se ampliará, no se reescribirá desde cero.
- `packages/game-engine/src/game-engine.test.ts` — pruebas existentes. Se ampliarán; no se eliminarán sin justificación.
- `docs/implementation/0001-base-del-prototipo.md` — estructura, convenciones y precedentes de la tarea anterior.
- `docs/project-status.md` — estado actual del proyecto.

## 4. Alcance incluido

- PRNG determinista mulberry32 con semilla uint32.
- Fisher–Yates shuffle para barajar la bolsa.
- Seven-bag con piezas I, O, T, S, Z, J, L.
- Una única orientación inicial por pieza (sin rotación).
- Tablero interno de 10 columnas × 24 filas: 4 filas ocultas superiores y 20 filas visibles.
- Origen en esquina superior izquierda del tablero interno.
- Eje x creciente hacia la derecha; eje y creciente hacia abajo.
- El spawn se calcula para que la fila inferior del bounding box de cada pieza quede en la primera fila visible (`y = 4`), utilizando las filas ocultas superiores como colchón de aparición. Todas las coordenadas `y`, activas o fijadas, son siempre `>= 0`.
- Spawn determinista centrado.
- Movimiento horizontal: -1, 0, 1.
- Gravedad basada únicamente en tiempo lógico (`fixedStepMs` y `gravityCellsPerSecond`), con acumulador reiniciado en cada spawn de pieza.
- Hard drop.
- Colisión contra paredes, límites del tablero interno y bloques fijos.
- Fijación inmediata cuando el movimiento descendente es imposible.
- Eliminación simultánea de líneas completas, en filas ocultas o visibles.
- Spawn de la siguiente pieza tras fijar y eliminar líneas.
- Fin de partida por spawn bloqueado (`spawnBlocked`). Es el único motivo de fin de partida en esta tarea.
- Snapshot inmutable.
- Eventos tipados de ciclo de vida y juego.
- Validación estricta de entrada (sin coerción, sin valores por defecto).
- Actualización de la pantalla técnica Vue para observar el nuevo contrato del motor.
- Pruebas unitarias, de invariantes y de determinismo.

## 5. Alcance explícitamente excluido

Esta tarea no debe introducir:

- Rotación de piezas.
- SRS.
- Wall kicks.
- Lock delay.
- Reglas de reinicio del temporizador de fijación.
- DAS.
- ARR.
- Soft drop.
- Puntuación.
- Combos.
- T-Spins.
- Back-to-back.
- Hold.
- Ghost piece.
- Energía.
- Ataques.
- Batalla.
- Bot.
- Replay.
- Phaser.
- Audio.
- Backend.
- Base de datos.
- Playwright.
- Diseño visual Industrial Dramatic.

No se implementará rotación provisional. No se añadirán propiedades de configuración para mecánicas excluidas. No se añadirá ninguna condición de fin de partida distinta de `spawnBlocked`.

## 6. Sistema de coordenadas

- Origen: esquina superior izquierda del tablero interno.
- Eje x: creciente hacia la derecha. Rango: `[0, 9]`.
- Eje y: creciente hacia abajo. Rango interno: `[0, 23]`.
- Filas ocultas: `y` en `[0, 3]` (4 filas superiores, no visibles en pantalla). Constante `HIDDEN_ROWS = 4`.
- Filas visibles: `y` en `[4, 23]` (20 filas visibles).
- El spawn de cada pieza se calcula para que la fila inferior de su bounding box quede en la primera fila visible (`y = 4`), de modo que toda pieza es al menos parcialmente visible desde el instante en que aparece (ver §9).
- Todas las celdas de una pieza, activa o fijada, tienen siempre `y >= 0`. No existen coordenadas negativas en ningún momento del ciclo de vida de una pieza.
- Una celda ocupada se representa mediante el tipo de pieza (I, O, T, S, Z, J, L). El tablero no almacena booleanos ni identificadores opacos.

## 7. Modelo del tablero

- Dimensiones fijas del tablero interno: 10 columnas × 24 filas.
- Las primeras 4 filas (`y` de 0 a 3) son ocultas; las 20 filas restantes (`y` de 4 a 23) son visibles.
- El tablero almacena únicamente bloques fijados (piezas ya bloqueadas), tanto en filas ocultas como visibles. La pieza activa permanece separada.
- Cada celda fijada guarda el tipo de pieza que la ocupó.
- Las celdas vacías se representan como `null`.
- Al eliminar líneas, las filas superiores descienden para ocupar el espacio vacío. La comprobación de líneas completas se realiza sobre las 24 filas internas.
- El tablero nunca cambia de dimensiones.
- La presencia de bloques fijados en las filas ocultas no provoca por sí misma el fin de la partida. El fin de partida depende exclusivamente de que el spawn de la siguiente pieza sea válido (ver §20).

## 8. Modelo de las piezas

- Siete tipos: `I`, `O`, `T`, `S`, `Z`, `J`, `L`.
- Cada pieza tiene exactamente cuatro celdas relativas inmutables en su orientación inicial.
- Las celdas relativas se definen en coordenadas (x, y) respecto al origen de la pieza.
- La pieza activa almacena: tipo, coordenada x, coordenada y y celdas absolutas calculadas.
- Las celdas absolutas se obtienen sumando (x, y) del origen de la pieza a cada celda relativa.

Celdas relativas de cada pieza en su orientación inicial (origen en la celda superior izquierda del bounding box):

```
I: (0,0), (1,0), (2,0), (3,0)       ← pieza horizontal
O: (0,0), (1,0), (0,1), (1,1)       ← cuadrado 2×2
T: (1,0), (0,1), (1,1), (2,1)       ← T apuntando arriba
S: (1,0), (2,0), (0,1), (1,1)       ← S horizontal
Z: (0,0), (1,0), (1,1), (2,1)       ← Z horizontal
J: (0,0), (0,1), (1,1), (2,1)       ← J apuntando arriba
L: (2,0), (0,1), (1,1), (2,1)       ← L apuntando arriba
```

Anchura y altura del bounding box de cada pieza (usadas para el centrado horizontal y el cálculo de la fila de spawn, §9):

| Pieza | `pieceWidth` | `pieceHeight` |
| --- | ---: | ---: |
| I | 4 | 1 |
| O | 2 | 2 |
| T | 3 | 2 |
| S | 3 | 2 |
| Z | 3 | 2 |
| J | 3 | 2 |
| L | 3 | 2 |

Todas las celdas relativas tienen `y >= 0`, por lo que, al aplicarse sobre el origen de spawn calculado en §9, ninguna celda de spawn puede quedar fuera del tablero interno.

## 9. Reglas de spawn

- La pieza activa aparece centrada horizontalmente dentro del tablero interno.
- Centro: `x = Math.floor((10 - pieceWidth) / 2)`.
- `pieceWidth` y `pieceHeight` son la anchura y la altura del bounding box de la pieza (tabla en §8).
- La coordenada `y` inicial del origen de la pieza (`spawnY`) se calcula como:

  ```
  spawnY = HIDDEN_ROWS - pieceHeight + 1
  ```

  con `HIDDEN_ROWS = 4`. Esta fórmula sitúa la fila inferior del bounding box inicial exactamente en `y = 4` (la primera fila visible), de modo que toda pieza recién aparecida es al menos parcialmente visible de inmediato, incluso utilizando las filas ocultas como colchón de aparición.
- Ejemplos:
  - `I` (altura 1): `spawnY = 4 - 1 + 1 = 4`. Su única fila queda en `y = 4`, completamente visible.
  - `O`, `T`, `S`, `Z`, `J`, `L` (altura 2): `spawnY = 4 - 2 + 1 = 3`. Su fila superior queda en `y = 3` (oculta) y su fila inferior en `y = 4` (visible).
- Las celdas absolutas de spawn se obtienen sumando `(x, spawnY)` a las celdas relativas de la pieza (§8).
- Todas las celdas de spawn tienen `y >= 0` y permanecen dentro del tablero interno (`y` en `[0, 23]`). No existen celdas de spawn fuera del tablero interno ni coordenadas negativas.
- El spawn bloqueado (`spawnBlocked`) se produce cuando alguna celda absoluta de la nueva pieza colisiona con un bloque fijo del tablero interno (oculto o visible) o queda fuera del rango de columnas `[0, 9]`.

## 10. PRNG

- Algoritmo: mulberry32.
- Estado: un único entero uint32 privado.
- Semilla: entero uint32 proporcionado al crear el motor.
- No se utiliza `Math.random()` en ningún punto del motor.
- El estado del PRNG no se expone en la API pública.
- Dada la misma semilla, el PRNG produce exactamente la misma secuencia de valores.

Implementación:

```ts
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## 11. Seven-bag

- Cada bolsa contiene exactamente una unidad de cada tipo: I, O, T, S, Z, J, L.
- Al crear la bolsa se baraja mediante Fisher–Yates utilizando el PRNG del motor.
- La bolsa se consume de izquierda a derecha.
- Al agotarse, se genera una nueva bolsa barajada con el mismo PRNG.
- El estado de la bolsa (cola actual y posición) es privado.
- Dada la misma semilla, la secuencia de piezas es idéntica.

## 12. Entrada del motor

`step(input)` recibe un objeto con dos campos obligatorios:

```ts
type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
};
```

- `horizontal`: desplazamiento horizontal solicitado en este paso. Solo -1, 0 ó 1 son valores válidos.
- `hardDrop`: si es `true`, la pieza desciende instantáneamente hasta colisionar y se fija en el mismo paso.
- Ambos campos son obligatorios. No se aceptan valores ausentes ni `undefined`.
- No existe coerción ni valores por defecto silenciosos.
- Propiedades desconocidas en la entrada son rechazadas con código `INVALID_GAME_INPUT`.
- Un `step` inválido no debe mutar el estado del motor: no avanza el contador de pasos, no incrementa `elapsedMs`, no afecta al PRNG, no altera la bolsa, no modifica la pieza activa ni genera eventos.
- Esta tarea sustituye intencionadamente el contrato provisional `EngineStepInput = Record<string, never>` de 0001. `step({})` deja de ser una entrada válida: al carecer de `horizontal` y `hardDrop`, será rechazada con `INVALID_GAME_INPUT`. Las pruebas existentes que invocan `engine.step({})` deben adaptarse para proporcionar ambos campos; no basta con ampliarlas, algunas deben reescribirse.

## 13. Validación de entrada y atomicidad

- La validación ocurre al inicio de `step()`, antes de cualquier mutación.
- Si `step()` se invoca cuando el estado del motor es `gameOver`, se lanza un error con `code: "ENGINE_NOT_RUNNING"`. Esta comprobación se realiza **antes** que la validación de la forma de la entrada.
- Si el motor está `running` y la entrada es inválida, se lanza un error con:
  - `code: "INVALID_GAME_INPUT"`
  - `message` describiendo el problema.
- Cuando el motor está en `gameOver` y, además, la entrada proporcionada es inválida, el error resultante es `ENGINE_NOT_RUNNING` (no `INVALID_GAME_INPUT`): el estado del motor se comprueba primero.
- Llamar a `step()` con entrada inválida, en cualquier estado, no debe mutar el motor ni generar eventos.
- El tipo de error para ambos casos será `EngineStepError` (o nombre análogo aprobado), con una propiedad `code` que distingue ambas situaciones.

## 14. Orden del paso lógico

Cada llamada a `step(input)` ejecuta en este orden exacto:

1. **Comprobar estado del motor.** Si `status === 'gameOver'`, lanzar `ENGINE_NOT_RUNNING` y no mutar nada.
2. **Validar entrada.** Si es inválida, lanzar `INVALID_GAME_INPUT` y no mutar nada.
3. **Incrementar contador de paso.** `currentStep += 1`.
4. **Incrementar tiempo lógico.** `currentElapsedMs += config.fixedStepMs`.
5. **Movimiento horizontal.** Si `input.horizontal !== 0`, intentar desplazar la pieza activa en esa dirección. Si la nueva posición es válida (sin colisión), actualizar coordenadas y emitir `pieceMoved` con motivo `horizontal`. Si es inválida, no hacer nada (no emitir evento de movimiento inválido).
6. **Hard drop.** Si `input.hardDrop === true`, calcular la distancia de descenso hasta la posición final sin colisionar.
   - Si la distancia es mayor o igual a 1 fila: actualizar las coordenadas a la posición final y emitir un único `pieceMoved` con motivo `hardDrop`. No se emiten eventos por celda de descenso.
   - Si la distancia es 0 (la pieza ya está apoyada y no puede descender ninguna fila): no actualizar coordenadas y no emitir `pieceMoved`, en coherencia con la regla general de que `pieceMoved` solo se emite para movimientos reales.
7. **Gravedad.** Solo si `input.hardDrop === false`. Se procesa mediante el siguiente bucle determinista (ver también §16):

   ```
   gravityAccumulatorMs += fixedStepMs
   while gravityAccumulatorMs >= msPerCell:
     intentar mover la pieza una fila hacia abajo
     si el movimiento tiene éxito:
       gravityAccumulatorMs -= msPerCell
       emitir un pieceMoved con motivo gravity
     si el movimiento falla (colisión):
       marcar la pieza para fijación (paso 8)
       detener el procesamiento de gravedad para este paso
   ```

   Un mismo paso lógico puede provocar más de un descenso (más de un `pieceMoved` con motivo `gravity`) si `fixedStepMs` es suficientemente grande respecto de `msPerCell`. Los eventos se emiten en el orden en que ocurren.
8. **Fijación.** Si la pieza no puede descender más (bien porque acaba de colisionar por gravedad, bien porque acaba de realizar hard drop), se ejecuta la secuencia de fijación:
   1. calcular las cuatro celdas absolutas de la pieza activa en su posición actual;
   2. validar que las cuatro celdas están dentro del tablero interno (`0 <= x < 10`, `0 <= y < 24`) y no colisionan con bloques ya fijados — esta comprobación documenta una invariante que los pasos anteriores ya garantizan y no debería fallar en funcionamiento normal;
   3. escribir las cuatro celdas en el tablero interno, sean filas ocultas o visibles;
   4. emitir `pieceLocked`.

   No hay retardo de fijación en esta tarea. El lock delay queda fuera de alcance; la tarea en la que se implemente se decidirá por separado.
9. **Eliminación de líneas.** Tras la fijación, se inspeccionan las 24 filas internas del tablero (ocultas y visibles). Las filas completas se eliminan simultáneamente. Actualizar `clearedLines` (contador total). Emitir `linesCleared` con los índices de las filas eliminadas, si hay alguna.
10. **Spawn de siguiente pieza.** Si se acaba de fijar la pieza anterior, tomar la siguiente pieza de la bolsa, colocarla como activa dentro de las filas ocultas superiores y reiniciar el acumulador de gravedad a 0. Si el spawn está bloqueado (colisión inmediata con un bloque fijo, oculto o visible, o posición fuera del rango de columnas), emitir `gameOver` con motivo `spawnBlocked` y cambiar estado a `gameOver`; en ese caso la pieza no llega a ser activa. Si el spawn es válido, emitir `pieceSpawned`.
11. **Emisión de eventos.** Todos los eventos generados durante el paso se encolan y están disponibles para `drainEvents()` en el orden en que ocurrieron.

### Reglas de la gravedad

- La gravedad se evalúa en cada paso lógico si `hardDrop` es `false`, mediante el bucle determinista descrito en §16.
- Cada `gravityCellsPerSecond` celdas por segundo significa que la pieza desciende una fila cada `msPerCell = 1000 / gravityCellsPerSecond` milisegundos.
- La condición exacta de descenso es `gravityAccumulatorMs >= msPerCell` (umbral exacto, no una comparación ambigua de "superar").
- La unidad mínima de tiempo es `fixedStepMs`. Un mismo paso lógico puede producir varios descensos si `fixedStepMs` es suficientemente grande respecto de `msPerCell` (ver §16).
- El acumulador de gravedad se reinicia a 0 cada vez que se coloca una nueva pieza activa: en la creación inicial del motor, tras cada fijación durante la partida (paso 10) y en `reset()`. El tiempo restante de la pieza anterior no se traslada a la siguiente.
- No se usan temporizadores reales ni `requestAnimationFrame`. El tiempo es puramente lógico.

### Hard drop

- El hard drop domina a la gravedad en el mismo paso: no se aplica gravedad si `hardDrop` es `true`.
- La pieza desciende hasta la posición más baja posible sin colisionar con bloques fijos ni con el límite inferior del tablero interno.
- Si la distancia de descenso es mayor o igual a 1 fila: no se emiten eventos por celda; se emite exactamente un `pieceMoved` con motivo `hardDrop` al finalizar el descenso.
- Si la distancia de descenso es 0 (la pieza ya estaba apoyada): no se emite `pieceMoved`. Se emite únicamente `pieceLocked`, en coherencia con la regla general de que `pieceMoved` solo se emite para movimientos reales.
- En ambos casos, la fijación es inmediata en el mismo paso.

## 15. Movimiento horizontal

- El campo `input.horizontal` determina el desplazamiento: -1 (izquierda), 0 (ninguno), 1 (derecha).
- El movimiento se intenta siempre que `horizontal !== 0`.
- Si el desplazamiento resulta en una posición sin colisiones, la pieza se mueve.
- Si colisiona, la pieza permanece en su posición actual. No se emite evento de movimiento inválido.
- Los eventos de movimiento se emiten únicamente cuando el movimiento se ejecuta realmente.

## 16. Gravedad

- La gravedad solo se aplica si `hardDrop === false`.
- Se calcula el tiempo lógico necesario para descender una fila: `msPerCell = 1000 / gravityCellsPerSecond`.
- El motor mantiene `gravityAccumulatorMs`, una variable interna (no expuesta en snapshot público) que se incrementa en `fixedStepMs` en cada paso en el que se evalúa gravedad.
- La condición exacta de descenso es `gravityAccumulatorMs >= msPerCell`. No se utilizan comparaciones ambiguas de "superar el umbral".
- Procesamiento determinista en cada paso:

  ```
  gravityAccumulatorMs += fixedStepMs
  while gravityAccumulatorMs >= msPerCell:
    intentar mover la pieza una fila hacia abajo
    si el movimiento tiene éxito:
      gravityAccumulatorMs -= msPerCell
      emitir un pieceMoved con motivo gravity
    si el movimiento falla:
      fijar la pieza
      detener el procesamiento de gravedad
  ```

- Un mismo paso lógico puede provocar múltiples descensos (múltiples eventos `pieceMoved` con motivo `gravity`) si `fixedStepMs` es suficientemente grande respecto de `msPerCell`.
- No se emite evento de gravedad si el movimiento falla por colisión. En ese caso, se procede a fijación y se detiene el bucle para ese paso.
- Cuando la fijación provocada por el bucle de gravedad da lugar al spawn de una nueva pieza (paso 10 de §14): `gravityAccumulatorMs` se reinicia a 0. El resto de tiempo acumulado de la pieza anterior (cualquier remanente por debajo de `msPerCell`) no se traslada a la nueva pieza.
- El acumulador se reinicia a 0 también en la creación inicial del motor y en `reset()`.
- El acumulador admite intervalos de descenso no alineados con `fixedStepMs` (por ejemplo, cuando `msPerCell` no es múltiplo exacto de `fixedStepMs`). El comportamiento sigue siendo determinista mediante la acumulación y resta descritas arriba, sin necesidad de que ambos valores sean múltiplos exactos.
- Esta tarea no añade ninguna restricción de divisibilidad entre `gravityCellsPerSecond` y `fixedStepMs` en `packages/game-config`. `game-config` no se modifica en esta tarea.

## 17. Colisión

Una posición es inválida si:

- Cualquier celda absoluta de la pieza activa tiene x < 0 o x >= 10 (fuera del ancho del tablero).
- Cualquier celda absoluta tiene y < 0 o y >= 24 (fuera del tablero interno).
- Cualquier celda absoluta coincide con una celda ocupada del tablero interno (bloque fijo), esté en una fila oculta o visible.

La pieza cuadrada (O) no se trata de forma especial en esta tarea al no haber rotación.

## 18. Fijación (locking)

- La fijación es inmediata cuando la pieza no puede descender más. Esto ocurre:
  - Después de hard drop (la pieza llega al límite inferior del tablero interno o a un bloque fijo).
  - Después de gravedad, si la posición inferior está ocupada o es el límite inferior del tablero interno.
- No hay retardo, reinicios, temporizador ni contador de movimientos. El lock delay queda fuera de alcance; la tarea en la que se implemente se decidirá por separado.

Secuencia de fijación (invariante, no configurable):

1. Calcular las cuatro celdas absolutas de la pieza activa en su posición actual.
2. Validar que las cuatro celdas están dentro del tablero interno (`0 <= x < 10`, `0 <= y < 24`) y no colisionan con bloques ya fijados. Esta comprobación documenta una invariante ya garantizada por los pasos anteriores del motor; no debería fallar en funcionamiento normal.
3. Escribir las cuatro celdas en el tablero interno, sean filas ocultas o visibles.
4. Emitir `pieceLocked`.

La fijación en filas ocultas es válida y no provoca fin de partida por sí misma. El fin de partida depende exclusivamente de si el siguiente spawn resulta bloqueado (ver §20).

## 19. Eliminación de líneas

- Después de fijar, se inspeccionan las 24 filas internas del tablero (ocultas y visibles).
- Una fila completa es aquella donde las 10 celdas están ocupadas, sea una fila oculta o visible.
- Las filas completas se eliminan simultáneamente: se retiran del tablero y las filas superiores descienden para ocupar su lugar.
- Las filas nuevas (vacías) aparecen en la parte superior del tablero interno.
- Las dimensiones del tablero interno siempre son 10×24.
- `clearedLines` acumula el total de filas eliminadas en toda la partida.

## 20. Fin de partida (game over)

Existe un único motivo de fin de partida en esta tarea:

- **spawnBlocked**: tras fijar la pieza anterior y eliminar las líneas completas correspondientes, se intenta colocar la siguiente pieza en su posición inicial dentro de las filas ocultas superiores. Si alguna de sus celdas absolutas colisiona con un bloque fijo del tablero interno (oculto o visible), o queda fuera del rango de columnas, no se crea pieza activa y el estado pasa a `gameOver` inmediatamente.

La presencia de bloques fijados en las filas ocultas no es, por sí misma, motivo de fin de partida. Una partida solo termina cuando el spawn de una nueva pieza resulta inválido.

En caso de `spawnBlocked`:

- El estado del motor cambia a `gameOver`.
- Se emite el evento `gameOver` con motivo `spawnBlocked`.
- Llamadas posteriores a `step()` lanzan `ENGINE_NOT_RUNNING`.
- El snapshot sigue siendo accesible para inspeccionar el estado final.
- `drainEvents()` sigue funcionando para recuperar los eventos hasta el game over.
- `reset()` sigue funcionando para reiniciar el motor.

## 21. Snapshot

```ts
type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: 'running' | 'gameOver';
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPiece: PieceType | null;
  clearedLines: number;
}>;

type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;

type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
```

Campos:

- `step`: número de pasos lógicos ejecutados.
- `elapsedMs`: tiempo lógico acumulado en milisegundos.
- `status`: `'running'` o `'gameOver'`.
- `seed`: semilla actual del motor.
- `configVersion`: versión de configuración.
- `board`: matriz de 24 filas × 10 columnas (tablero interno completo). `board[y][x]` es `PieceType` si la celda está ocupada, `null` si está vacía. Las filas `board[0]` a `board[3]` son ocultas; `board[4]` a `board[23]` son visibles.
- `activePiece`: snapshot de la pieza activa, o `null` si no hay pieza activa (game over por `spawnBlocked`).
- `nextPiece`: tipo de la siguiente pieza, o `null` si no hay (no debería ocurrir en funcionamiento normal).
- `clearedLines`: total acumulado de líneas eliminadas.

El snapshot debe ser inmutable. Todas las colecciones anidadas deben ser de solo lectura. No deben exponer referencias mutables internas del motor.

## 22. Eventos

```ts
type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | { type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }
  | { type: 'gameOver'; step: number; reason: GameOverReason };

type MoveReason = 'horizontal' | 'gravity' | 'hardDrop';
type GameOverReason = 'spawnBlocked';
```

### Reglas de eventos

- No se emiten eventos para movimientos inválidos.
- Un hard drop con distancia de descenso 0 (la pieza ya está apoyada) no emite `pieceMoved`; emite únicamente `pieceLocked`, en coherencia con la regla general de que `pieceMoved` solo se emite para movimientos reales.
- `drainEvents()` devuelve los eventos en orden de emisión y vacía la cola interna.
- `drainEvents()` devuelve colecciones de solo lectura. No deben exponer referencias mutables internas.
- La creación del motor (`createGameEngine()`) genera la pieza activa inicial y la siguiente pieza, pero emite únicamente `engineStarted`. No se emite `pieceSpawned` para la pieza inicial.
- `reset()` elimina los eventos pendientes anteriores.
- `reset()` genera la pieza activa inicial y la siguiente pieza de la nueva secuencia, pero emite únicamente `engineReset`. No se emite `engineStarted` ni `pieceSpawned` durante `reset()`.
- `pieceSpawned` se emite únicamente cuando aparece una nueva pieza tras una fijación durante la partida (paso 10 de §14), nunca para la pieza inicial de `createGameEngine()` ni de `reset()`.
- Después de `reset()`, la pieza inicial ya debe existir en el snapshot (no dejar `engineStarted` ni `pieceSpawned` pendientes sin drenar).

## 23. Reset

`reset(options)` acepta las mismas opciones que la creación (`seed`, `config`).

Secuencia de `reset()` (única, sin alternativas):

1. Validar semilla y configuración con las mismas reglas que la creación. Si son inválidas, lanzar `INVALID_ENGINE_OPTIONS` y no mutar el motor.
2. Vaciar el tablero interno (10×24).
3. Restaurar el contador de pasos a 0.
4. Restaurar `elapsedMs` a 0.
5. Reiniciar el PRNG con la nueva semilla.
6. Reiniciar la bolsa de siete con la nueva semilla.
7. Reiniciar el acumulador de gravedad a 0.
8. Eliminar los eventos pendientes anteriores.
9. Generar la pieza inicial de la nueva secuencia y colocarla como activa dentro de las filas ocultas superiores; generar también la siguiente pieza (`nextPiece`).
10. Emitir exactamente un `engineReset`. No se emite `engineStarted` ni `pieceSpawned` durante `reset()`.

Tras `reset()`, el snapshot debe reflejar inmediatamente la nueva pieza activa y la siguiente pieza, sin necesidad de llamar a `step()`.

## 24. Errores tipados

```ts
class EngineOptionsError extends Error {
  readonly code = 'INVALID_ENGINE_OPTIONS';
}

class EngineStepError extends Error {
  readonly code: 'INVALID_GAME_INPUT' | 'ENGINE_NOT_RUNNING';
}
```

## 25. API pública del motor

El contrato `GameEngine` se amplía:

```ts
type GameEngine = {
  step(input: StepInput): void;
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  reset(options: EngineOptions): void;
};
```

Todas las exportaciones adicionales necesarias (tipos PieceType, MoveReason, GameOverReason, etc.) se agregarán al `index.ts` del paquete.

Esta tarea sustituye intencionadamente el contrato provisional `EngineStepInput = Record<string, never>` de 0001 por `StepInput` (§12). No es una ampliación aditiva: `step({})` deja de ser válido y las pruebas existentes que lo invocan así deben adaptarse.

## 26. Pruebas mínimas requeridas

### PRNG y bolsa
- mulberry32 con misma semilla produce misma secuencia.
- mulberry32 con distinta semilla produce secuencia diferente.
- Fisher–Yates baraja completamente la bolsa.
- Siete piezas consecutivas contienen todos los tipos sin repetición (una bolsa completa).
- Bolsas consecutivas son independientes.

### Spawn
- Spawn centrado coloca pieza en x correcta.
- Spawn de la pieza `I` (altura 1) coloca su única fila en `y = 4`, completamente visible.
- Spawn de piezas de altura 2 (`O`, `T`, `S`, `Z`, `J`, `L`) coloca su fila superior en `y = 3` (oculta) y su fila inferior en `y = 4` (visible).
- La fila inferior del bounding box de cada pieza queda siempre en `y = 4` (primera fila visible), sea cual sea su altura.
- Spawn bloqueado detecta colisión con bloques existentes, incluidos bloques en filas ocultas.

### Movimiento horizontal
- Movimiento izquierda/derecha válido actualiza coordenadas.
- Movimiento contra pared izquierda es bloqueado.
- Movimiento contra pared derecha es bloqueado.
- Movimiento contra bloque fijo es bloqueado.
- Movimiento inválido no muta estado ni emite evento.

### Gravedad
- Gravedad mueve la pieza hacia abajo cuando `gravityAccumulatorMs >= msPerCell` (umbral exacto).
- Gravedad no excede el tiempo lógico disponible.
- Gravedad se omite cuando hardDrop es true.
- Un mismo paso lógico produce múltiples descensos de gravedad (múltiples `pieceMoved` con motivo `gravity`) cuando `fixedStepMs` es suficientemente grande respecto de `msPerCell`.
- El acumulador de gravedad se reinicia a 0 al generar una nueva pieza tras una fijación.
- El acumulador de gravedad se reinicia a 0 en `reset()`.
- El acumulador de gravedad no traslada tiempo remanente de una pieza a la siguiente.
- Intervalos de gravedad no alineados con `fixedStepMs` se resuelven de forma determinista.

### Hard drop
- Hard drop desciende la pieza hasta la posición más baja posible.
- Hard drop fija la pieza inmediatamente.
- Hard drop no emite eventos por celda.
- Hard drop con distancia de descenso mayor o igual a 1 emite un único `pieceMoved` con motivo `hardDrop`, seguido de `pieceLocked`.
- Hard drop con distancia de descenso 0 (pieza ya apoyada) no emite `pieceMoved`; emite únicamente `pieceLocked`.

### Fijación
- Fijación transfiere las cuatro celdas al tablero interno.
- Fijación en filas ocultas no produce game over por sí misma.
- Fijación normal permite que continúe la partida.

### Eliminación de líneas
- Una línea completa se elimina, en fila oculta o visible.
- Múltiples líneas se eliminan simultáneamente.
- Líneas no completas permanecen.
- Las filas superiores descienden correctamente.
- `clearedLines` se actualiza.

### Game over
- `spawnBlocked` termina la partida.
- Bloques fijados en filas ocultas no provocan game over mientras el siguiente spawn sea válido.
- Estado pasa a `gameOver`.
- `step()` después de game over lanza `ENGINE_NOT_RUNNING`.
- `step()` en estado `gameOver` con una entrada también inválida lanza `ENGINE_NOT_RUNNING` (no `INVALID_GAME_INPUT`).

### Eventos
- `pieceSpawned` no se emite para la pieza inicial creada por `createGameEngine()`.
- `pieceSpawned` se emite para cada pieza generada tras una fijación durante la partida.
- `pieceMoved` se emite solo en movimientos válidos.
- `pieceMoved` no se emite cuando un hard drop tiene distancia de descenso 0 (solo se emite `pieceLocked`).
- `pieceLocked` se emite al fijar.
- `linesCleared` se emite con índices correctos.
- `gameOver` se emite con motivo `spawnBlocked`.
- No se emiten eventos para movimientos inválidos.
- `drainEvents` devuelve en orden y vacía la cola.

### Snapshot
- Snapshot contiene estado correcto tras cada paso.
- Snapshot es inmutable.
- `board` tiene 24 filas × 10 columnas.
- `activePiece` es null si no hay pieza activa.
- `nextPiece` es el tipo correcto.

### Determinismo
- Misma semilla y mismas entradas producen exactamente el mismo resultado observable (snapshot y eventos idénticos).
- Semillas diferentes producen resultados diferentes.

### Reset
- Reset restaura todos los contadores.
- Reset genera inmediatamente la pieza activa y la siguiente pieza, sin necesidad de llamar a `step()`.
- Reset no emite `pieceSpawned` ni `engineStarted`.
- Reset emite exactamente un `engineReset`.
- Reset elimina eventos anteriores.
- Reset permite comenzar de nuevo con nueva semilla.

### Validación de entrada
- `horizontal: -1` es válido.
- `horizontal: 0` es válido.
- `horizontal: 1` es válido.
- `horizontal: 2` es rechazado.
- `horizontal: -2` es rechazado.
- `horizontal` ausente es rechazado.
- `hardDrop` ausente es rechazado.
- Propiedad desconocida es rechazada.
- `step({})` es rechazado con `INVALID_GAME_INPUT`.
- Entrada inválida no muta estado, PRNG, bolsa, contadores ni eventos.
- `step()` en `gameOver` lanza `ENGINE_NOT_RUNNING`, incluso si la entrada también es inválida.

Estas pruebas deben verificar comportamiento observable, invariantes y contratos. No deben depender innecesariamente de detalles internos.

## 27. Adaptación de la pantalla web

La pantalla técnica actual de Vue se actualizará para reflejar el nuevo contrato del motor. Debe mostrar:

- Estado del motor (`running` / `gameOver`).
- Semilla.
- Versión de configuración.
- Paso lógico actual.
- Tiempo lógico acumulado.
- Pieza activa (tipo, coordenadas, celdas absolutas).
- Siguiente pieza.
- Líneas eliminadas.
- Tablero técnico (representación textual o cuadrícula básica con colores por tipo de pieza). Podrá distinguir visualmente las filas ocultas superiores (por ejemplo, atenuadas o con un borde diferenciado) del resto del tablero interno. La pieza activa debe ser al menos parcialmente visible desde el instante de su aparición (su fila inferior siempre queda en la primera fila visible).
- Últimos eventos drenados (lista actualizada).
- Controles:
  - Izquierda (envía `{ horizontal: -1, hardDrop: false }`).
  - Paso neutro (envía `{ horizontal: 0, hardDrop: false }`).
  - Derecha (envía `{ horizontal: 1, hardDrop: false }`).
  - Hard drop (envía `{ horizontal: 0, hardDrop: true }`).
  - Reset (restaura el motor con la semilla y configuración originales).

No se aplicará diseño Industrial Dramatic. La pantalla sigue siendo técnica y provisional, pero funcional para demostrar el motor.

## 28. Dependencias

- No se añadirán nuevas dependencias externas para esta tarea.
- Se utilizarán exclusivamente las ya presentes en el monorepo.
- Si se necesita alguna dependencia para pruebas (p. ej., para test de propiedades), se evaluará caso por caso.

## 29. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
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

## 30. Actualizaciones de documentación

Este documento (`docs/implementation/0002-motor-de-juego-determinista.md`) es la especificación de la tarea y permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación.

Al finalizar la implementación:

- Crear `docs/implementation/0002-implementacion-motor-determinista.md` como informe de implementación independiente (resumen, archivos, decisiones, API, pruebas, comandos, desviaciones, pendientes).
- Actualizar `docs/project-status.md`:
  - Estado de 0002: completada.
  - Fecha de finalización.
  - Resultado resumido.
  - Referencia al informe de implementación (`0002-implementacion-motor-determinista.md`).
  - Siguiente tarea: `0003 — Rotación SRS`.

## 31. Criterios de aceptación

### Motor
- El motor se crea con semilla uint32 y configuración válida.
- La creación genera una pieza activa inicial y una siguiente pieza, y emite únicamente `engineStarted` (sin `pieceSpawned`).
- El spawn sitúa la fila inferior del bounding box de cada pieza en la primera fila visible (`y = 4`), de modo que toda pieza es al menos parcialmente visible de inmediato.
- `step()` procesa entrada horizontal y hard drop.
- La gravedad usa la condición exacta `gravityAccumulatorMs >= msPerCell` y puede provocar más de un descenso en un mismo paso lógico; su acumulador se reinicia a 0 en cada spawn de pieza, sin trasladar tiempo remanente.
- Un hard drop con distancia de descenso 0 no emite `pieceMoved`; emite únicamente `pieceLocked`.
- Las colisiones con paredes, límites del tablero interno y bloques fijos funcionan correctamente.
- La fijación es inmediata al no poder descender, y escribe las cuatro celdas en el tablero interno (ocultas o visibles).
- Las líneas completas se eliminan simultáneamente, en filas ocultas o visibles.
- La partida termina únicamente con `spawnBlocked`. Los bloques fijados en filas ocultas no provocan fin de partida por sí mismos.
- El snapshot refleja el estado correcto (incluido el tablero interno de 24 filas) y es inmutable.
- Los eventos se emiten en orden y son correctos.
- El reset es determinista, genera de inmediato una pieza activa y una siguiente pieza, y emite exactamente un `engineReset` (sin `engineStarted` ni `pieceSpawned`).
- `step()` en estado `gameOver` lanza `ENGINE_NOT_RUNNING`, incluso si la entrada también es inválida.

### PRNG y bolsa
- El PRNG mulberry32 produce secuencias deterministas.
- La bolsa de siete contiene cada tipo exactamente una vez por ciclo.
- El estado del PRNG y la bolsa son privados.
- No se usa `Math.random()`.

### Validación
- Entrada inválida lanza `INVALID_GAME_INPUT`.
- `step()` en game over lanza `ENGINE_NOT_RUNNING`, con precedencia sobre la validación de la forma de la entrada.
- Entrada inválida no muta ningún estado.
- Propiedades desconocidas son rechazadas.
- Sin coerción ni valores por defecto silenciosos.
- `step({})` es rechazado (el contrato provisional de 0001 queda sustituido).

### Pantalla web
- Muestra todos los campos del snapshot.
- Permite controles: izquierda, neutro, derecha, hard drop, reset.
- Muestra eventos drenados.
- Sigue siendo técnica y provisional.

### Puertas de calidad
- `pnpm test` pasa.
- `pnpm lint` pasa.
- `pnpm typecheck` pasa.
- `pnpm build` pasa.

## 32. Próxima tarea

`0003 — Rotación SRS`

Implementación del Super Rotation System: orientaciones, rotación horaria y antihoraria, wall kicks, tabla de wall kicks específica de la pieza `I`, comportamiento de la pieza `O`, y cancelación de la rotación cuando ninguna transición produce una posición válida.

La asignación de tarea para el lock delay queda pendiente de decidir por separado; este documento no prejuzga en qué tarea futura se implementará.
