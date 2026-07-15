# 0004 — Integración de Phaser

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0004 — Integración de Phaser
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0004`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0004-integracion-phaser.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente ([Informe de implementación](../implementation/0004-integracion-phaser.md), mismo slug, ver §22), siguiendo la convención de rutas de `AGENTS.md` (especificaciones en `docs/tasks/`, informes en `docs/implementation/`).

## 1. Objetivo

Sustituir el tablero técnico dibujado directamente por Vue (`apps/web/src/App.vue` + `apps/web/src/board-composition.ts`) por una única instancia de Phaser embebida en Vue, que:

- renderice el tablero fijo y la pieza activa a partir de snapshots inmutables del motor;
- capture teclado y traduzca pulsaciones a `StepInput`;
- adapte tiempo real (delta de `update`) a los pasos lógicos fijos del motor (`config.fixedStepMs`);
- ejecute movimiento horizontal, rotación horaria/antihoraria, hard drop, gravedad y reset;
- no duplique ninguna regla de dominio (colisión, SRS, gravedad, fijación, líneas, game over).

Al terminar la tarea no debe existir un tablero jugable alternativo en Vue: Phaser es la única representación visual jugable.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo              ✅ Completada
0002 — Motor de juego determinista      ✅ Completada
0003 — Rotación SRS                     ✅ Completada
0004 — Integración de Phaser            ← Esta tarea
0005 — Prototipo vertical Tactical
```

Esta tarea no incluye: lock delay, DAS, ARR, soft drop, ghost piece, hold, scoring, energía, ataques, batalla, bot, segundo tablero, audio, backend, Pinia, Vue Router, Playwright, ni rediseño Industrial Dramatic definitivo. Ver §6 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — decisión arquitectónica «Phaser frente a Unity» y «integración de Vue y Phaser» (stack provisional completo; solo una parte reducida pertenece a `0004`, ver §6).
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) y [docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md) — contratos del motor que esta tarea consume sin modificar.
- `packages/game-engine/src/index.ts` — API pública real del motor tras 0003 (ver §4).
- `packages/game-config/src/index.ts` — `GameConfig` y `prototypeConfig` reales.
- `apps/web/src/App.vue`, `apps/web/src/board-composition.ts`, `apps/web/src/board-composition.test.ts` — implementación web actual, que esta tarea reemplaza (ver §12).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto.

## 4. Contratos públicos reales disponibles (inspección posterior a 0003)

Confirmado por lectura directa de `packages/game-engine/src/index.ts` y `packages/game-config/src/index.ts`. Phaser consumirá exclusivamente esta superficie:

```ts
// @rautfall/game-engine
function createGameEngine(options: EngineOptions): GameEngine;

type EngineOptions = { seed: number; config: GameConfig };

type GameEngine = {
  step(input: StepInput): void;               // throws EngineStepError
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  reset(options: EngineOptions): void;         // throws EngineOptionsError
};

type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};

type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: 'running' | 'gameOver';
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>; // 24 filas × 10 columnas
  activePiece: ActivePieceSnapshot | null;
  nextPiece: PieceType | null;
  clearedLines: number;
}>;

type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>; // celdas absolutas
}>;

enum Orientation { Spawn = 0, Right = 1, Reverse = 2, Left = 3 }

class EngineStepError extends Error {
  code: 'INVALID_GAME_INPUT' | 'ENGINE_NOT_RUNNING';
}
class EngineOptionsError extends Error {
  code: 'INVALID_ENGINE_OPTIONS';
}

// @rautfall/game-config
const prototypeConfig: GameConfig; // { version, fixedStepMs: 10, dasMs, arrMs,
                                    //   gravityCellsPerSecond, softDropCellsPerSecond,
                                    //   lockDelayMs, maxLockResets }
```

Hechos verificados relevantes para el diseño de Phaser:

- `prototypeConfig.fixedStepMs` vale **10 ms**. El límite de 250 ms por frame (§7) equivale exactamente a 25 pasos fijos (`250 / 10 = 25`): los dos límites provisionales son coherentes entre sí con la configuración actual, no arbitrarios entre ellos.
- `step()` lanza `EngineStepError` con `code: 'ENGINE_NOT_RUNNING'` si se invoca cuando `status === 'gameOver'`. Phaser debe dejar de llamar a `step()` tras detectar `gameOver` en el snapshot; no depende de capturar la excepción para ese fin.
- `GameConfig` ya declara `dasMs`, `arrMs`, `lockDelayMs` y `maxLockResets`, pero el motor **no los usa** en ningún punto de `processStep` (confirmado en `packages/game-engine/src/index.ts`): no hay lock delay, DAS ni ARR implementados en el motor a día de hoy. Esto es coherente con que 0004 no los implemente en Phaser tampoco (§6); no es una funcionalidad que Phaser deba activar ni imitar.
- El tablero interno (`EngineSnapshot['board']`) tiene 24 filas × 10 columnas; las filas ocultas son `[0, 3]` y las visibles `[4, 23]` (`HIDDEN_ROWS = 4`, verificado en el código del motor). El motor no expone `HIDDEN_ROWS` como contrato público; Phaser fija este valor como constante propia, igual que ya hace `board-composition.ts` hoy.
- `ActivePieceSnapshot.cells` ya contiene celdas **absolutas**, listas para componer directamente sobre `board` sin recalcular geometría de piezas.

Phaser no debe:

- importar rutas internas (`@rautfall/game-engine/src/...`);
- mutar el snapshot devuelto por `getSnapshot()` (ya es `Object.freeze` profundo; una mutación fallaría en modo estricto o sería un error silencioso en no estricto — no se debe intentar);
- recalcular colisiones, SRS, gravedad, fijación o eliminación de líneas;
- interpretar `board` o `activePiece` como estado propio mutable.

## 5. Alcance incluido

- Añadir `phaser` como dependencia de `apps/web` (versión exacta a fijar durante la implementación, ver §16).
- Una única instancia de `Phaser.Game` creada por Vue al montar y destruida al desmontar.
- Una única escena Phaser.
- Adaptador de tiempo real → pasos lógicos fijos (acumulador con tope de 250 ms y máximo 25 pasos por frame, ver §7).
- Captura de teclado y construcción de `StepInput` completo en cada paso lógico ejecutado (ver §8).
- Foco del canvas gestionado localmente, sin listeners globales de teclado (ver §9).
- Renderizado del tablero fijo y la pieza activa desde `getSnapshot()`, limitado a las 20 filas visibles, mediante `Phaser.GameObjects.Graphics` (ver §10).
- Canvas lógico de 320×640 con `Phaser.Scale.FIT` y `Phaser.Scale.CENTER_BOTH` (ver §11).
- Estructura mínima: `GameCanvas.vue`, `create-phaser-game.ts`, `GameScene.ts` (ver §12).
- Comunicación unidireccional Phaser → Vue mediante callback tipado con un resumen mínimo (ver §13).
- Eliminación completa del tablero jugable actual en Vue y de `board-composition.ts`/`board-composition.test.ts` (ver §14).
- Reset con semilla fija reutilizada, accesible desde teclado (`R`) y desde un botón Vue que invoca el mismo controlador (ver §14, §15).
- Drenado controlado de la cola de eventos del motor, sin usarlos todavía para gobernar la representación (ver §17).
- Pruebas unitarias de la lógica testeable en aislamiento (adaptador temporal, entrada, transformación de coordenadas) y del ciclo de vida Vue con mocks (ver §18).

## 6. Alcance explícitamente excluido

No pertenece a `0004`:

- DAS y ARR (repetición horizontal mantenida). El motor no los implementa hoy (§4); quedan para una tarea posterior del motor.
- Soft drop.
- Lock delay (no implementado en el motor a día de hoy, confirmado en §4; no se introduce ninguna imitación en Phaser).
- Pausa.
- Ghost piece.
- Hold.
- Preview visual de próximas piezas (más allá del dato técnico ya existente `nextPiece`, si se decide mostrarlo como texto).
- Puntuación, niveles, energía, ataques, bot, batalla, segundo tablero.
- Audio.
- Partículas, animaciones complejas o efectos avanzados.
- Spritesheets, texturas rasterizadas o cualquier asset gráfico externo.
- Menús y navegación.
- Pinia, Vue Router.
- Backend, persistencia, autenticación, ranking.
- Playwright, pruebas visuales por píxel o snapshots de canvas.
- CI/CD.
- Diseño visual Industrial Dramatic definitivo.
- Soporte táctil y remapeo de controles.

No se añadirá ninguna propiedad de configuración nueva en `game-config` para mecánicas excluidas. No se modificará ningún contrato de `game-engine`.

## 7. Adaptación temporal (tiempo real → pasos lógicos fijos)

Phaser recibe el delta real en `Scene.update(time, delta)`. El motor solo avanza mediante `step()`, un paso lógico fijo por llamada. El adaptador vive en `GameScene` (o una función pura que `GameScene` invoca) y sigue este algoritmo, ejecutado en cada `update`:

```text
accumulatorMs += min(delta, 250)          // limitar el delta efectivo del frame
executedSteps = 0
while accumulatorMs >= config.fixedStepMs && executedSteps < 25:
  input = buildStepInput()                // ver §8
  if engine.getSnapshot().status === 'gameOver': break
  engine.step(input)
  accumulatorMs -= config.fixedStepMs
  executedSteps += 1
// cualquier accumulatorMs sobrante permanece para el siguiente frame,
// salvo el exceso ya descartado por el límite de 250 ms
```

Reglas cerradas, no reabribles durante la implementación:

- El delta efectivo de cada frame se limita a 250 ms antes de acumularse. El tiempo real por encima de ese límite se descarta, no se recupera en frames posteriores.
- Como máximo se ejecutan 25 pasos lógicos por frame. Si el acumulador aún cumple `>= config.fixedStepMs` tras 25 pasos, el resto se descarta (no se arrastra indefinidamente intentando "ponerse al día").
- `config.fixedStepMs` no se modifica ni se reinterpreta; se lee tal cual de `GameConfig`.
- No se ejecutan pasos de duración variable: cada llamada a `step()` representa siempre `config.fixedStepMs` de tiempo lógico, nunca una fracción.
- Tras volver de una pestaña en segundo plano (delta real muy grande en el primer `update`), no se intenta recuperar el tiempo perdido más allá del límite de 250 ms: no hay lógica especial de "catch-up" adicional al límite ya descrito.

Los valores 250 ms y 25 pasos son hipótesis de integración provisionales. Se implementan como constantes explícitas (no mágicas dispersas) y se validan manualmente (§20); no se ajustan sin necesidad demostrada durante `0004`.

## 8. Entrada de teclado

Phaser captura el teclado dentro de `GameScene` (no hay gestión global) y construye un `StepInput` completo en cada paso lógico ejecutado por el adaptador de §7.

| Tecla | Acción |
| --- | --- |
| `ArrowLeft` | Movimiento horizontal a la izquierda |
| `ArrowRight` | Movimiento horizontal a la derecha |
| `ArrowUp` | Rotación horaria (`rotateClockwise`) |
| `Z` | Rotación antihoraria (`rotateCounterclockwise`) |
| `Space` | Hard drop |
| `R` | Reset (también tras `gameOver`) |

Reglas:

- El movimiento horizontal solo se aplica ante una **nueva pulsación** (flanco de bajada→presión, `JustDown`); no hay repetición mantenida. No se implementa DAS ni ARR en Phaser (quedan para una tarea del motor, §6).
- Si `ArrowLeft` y `ArrowRight` están presionadas simultáneamente en el instante en que se construye la entrada, `horizontal` es `0`. Esta comprobación se hace por estado de tecla mantenida (`isDown`), no por flanco, ya que el objetivo es neutralizar la ambigüedad, no detectar una nueva pulsación conjunta.
- Rotación horaria, rotación antihoraria y hard drop se consumen **una sola vez por pulsación** (flanco), igual que el movimiento horizontal. Nunca se envían ambas rotaciones (`rotateClockwise` y `rotateCounterclockwise`) como `true` en el mismo `StepInput`: como muy poco una de ellas es siempre `false` porque provienen de teclas distintas (`ArrowUp` y `Z`) y ambas se leen por flanco independiente; aun así, si ambas se detectasen en el mismo instante, ninguna se envía (se prioriza no romper la regla de entrada válida del motor, ver `EngineStepError`/`INVALID_GAME_INPUT`).
- Cuando el adaptador de §7 ejecuta varios pasos lógicos en un mismo frame, una pulsación de flanco (rotación, hard drop, movimiento) se consume una única vez, en el primer paso lógico de ese frame; los pasos lógicos siguientes del mismo frame usan `horizontal: 0`, `hardDrop: false`, sin rotación, salvo que la tecla continúe siendo una nueva pulsación distinta en un frame posterior. Esta regla evita que un frame con `delta` grande dispare varias rotaciones o varios hard drops a partir de una única pulsación física.
- Tras `gameOver` (según el `status` del snapshot), `GameScene` deja de llamar a `step()` (§7); las teclas de juego dejan de tener efecto salvo `R`.
- `R` reinicia también tras `gameOver`, reutilizando la misma semilla fija (§15).
- Sin soft drop, sin pausa, sin remapeo de teclas, sin controles táctiles.

## 9. Foco y comportamiento del navegador

- El contenedor o el propio canvas deben poder recibir foco (por ejemplo, `tabindex` en el elemento contenedor).
- El canvas recibe el foco mediante interacción del usuario (clic o `Tab`), no automáticamente al montar.
- Mientras la partida tiene el foco, las teclas `ArrowLeft`, `ArrowRight`, `ArrowUp` y `Space` deben evitar su comportamiento por defecto del navegador (`preventDefault()`), para que no se produzca scroll de la página.
- La ayuda de controles (qué tecla hace qué) se muestra en Vue, no dentro del canvas.
- No se crea gestión global de teclado (por ejemplo, listeners en `window` fuera del ciclo de vida de la escena): la captura vive dentro de Phaser, ligada a la vida de la escena/instancia.

## 10. Renderizado desde snapshots

El renderizado es una proyección directa del snapshot en cada frame en que se ejecutó al menos un paso lógico (o, como mínimo, una vez por frame tras el adaptador de §7); no se reconstruye el estado a partir de eventos.

Secuencia por frame, tras ejecutar los pasos lógicos correspondientes:

1. Obtener `engine.getSnapshot()`.
2. Limpiar el `Graphics` de la escena.
3. Dibujar el tablero fijo: iterar `board[y][x]` solo para `y` en `[4, 23]` (20 filas visibles); las filas `[0, 3]` (ocultas) nunca se dibujan.
4. Superponer la pieza activa: iterar `activePiece.cells`, dibujando solo las celdas cuyo `y >= 4`; las celdas en filas ocultas se descartan sin dibujar (mismo criterio que aplicaba `composeBoardForRendering` en la implementación Vue que esta tarea reemplaza, ahora aplicado directamente en coordenadas de canvas en vez de sobre una matriz intermedia).
5. Drenar la cola de eventos (`engine.drainEvents()`) para evitar que crezca indefinidamente; en `0004` los eventos drenados no disparan ninguna animación ni cambio visual adicional (ver §17).

Transformación de coordenadas (celda del tablero → posición de canvas), con `CELL_SIZE = 32`, `HIDDEN_ROWS = 4`:

```text
canvasX = x * CELL_SIZE
canvasY = (y - HIDDEN_ROWS) * CELL_SIZE
```

Solo se calcula para celdas con `y >= HIDDEN_ROWS`; el resto no se transforma ni se dibuja.

Restricciones de esta tarea:

- Únicamente `Phaser.GameObjects.Graphics` con geometría (rectángulos), sin spritesheets, texturas rasterizadas, assets externos, partículas ni animaciones complejas.
- El tablero interno del motor sigue siendo de 10×24; el canvas solo representa las 20 filas visibles.
- Vue no almacena ni representa el tablero ni la pieza activa en ningún momento.
- Los eventos del motor no gobiernan el estado visual en esta tarea; se drenan para mantener la cola vacía y quedar disponibles para una tarea futura de animaciones.

## 11. Canvas y escalado

Resolución lógica fija:

| Parámetro | Valor |
| --- | ---: |
| Columnas visibles | 10 |
| Filas visibles | 20 |
| Celda lógica | 32 × 32 px |
| Canvas lógico | 320 × 640 px |

Configuración de escalado de Phaser:

- `Phaser.Scale.FIT` como modo de escalado.
- `Phaser.Scale.CENTER_BOTH` como modo de centrado.
- Las coordenadas lógicas internas permanecen fijas en 320×640; el escalado es puramente de presentación.
- Alineación a píxeles enteros (evitar interpolación borrosa en los bordes de celda).
- Fondo transparente (`transparent: true` en la configuración del juego): el marco exterior, el layout y cualquier fondo visual pertenecen a Vue/CSS.
- No se incluye HUD (paso, tiempo, estado) dentro del canvas; esa información vive en Vue (§14).

## 12. Estructura mínima y responsabilidades

```text
apps/web/src/components/GameCanvas.vue
apps/web/src/game/create-phaser-game.ts
apps/web/src/game/scenes/GameScene.ts
```

Los nombres pueden ajustarse levemente si el código real lo justifica (por ejemplo, un archivo adicional pequeño y cohesivo para la transformación de coordenadas de §10, si conviene extraerlo para poder probarlo sin Phaser), pero deben mantenerse estas responsabilidades y estos límites:

### `GameCanvas.vue`

- Contiene el elemento contenedor (con `tabindex` para foco, §9).
- Crea la instancia de Phaser en `onMounted`.
- Destruye la instancia en `onBeforeUnmount` (`game.destroy(true)` o el mecanismo real equivalente).
- Evita instancias duplicadas (una única instancia viva por montaje del componente).
- Conecta el resumen de estado (`GamePresentationState`, §13) con Vue mediante `ref`/`computed`.
- No contiene reglas de juego ni transforma coordenadas del tablero.

### `create-phaser-game.ts`

- Crea `new Phaser.Game(config)` con la configuración de escalado, tamaño lógico y fondo transparente (§11).
- Centraliza la configuración de Phaser (una única función, no un contenedor de dependencias genérico).
- Recibe el elemento contenedor y los callbacks/dependencias mínimas necesarias (por ejemplo, el callback de resumen de estado de §13).
- Devuelve un controlador explícito y pequeño (`PhaserGameController`, §13).
- No introduce un contenedor de inyección de dependencias ni abstracciones adicionales.

### `GameScene.ts`

- Crea (o recibe, según lo que resulte más simple de probar y de inicializar) la instancia de `GameEngine` con `createGameEngine({ seed: FIXED_SEED, config: prototypeConfig })` (§15).
- Captura la entrada de teclado (§8).
- Adapta tiempo real a pasos lógicos fijos (§7).
- Obtiene snapshots y renderiza (§10).
- Drena eventos (§17).
- Ejecuta `reset()` cuando corresponda (tecla `R` o llamada del controlador).
- Deja de invocar `step()` cuando el snapshot indica `gameOver`.
- No contiene reglas de colisión, rotación, spawn, gravedad, fijación ni eliminación de líneas: toda esa lógica ya vive en `game-engine` y se consume tal cual.

### Restricciones estructurales

No se introducen en `0004`:

- Múltiples escenas Phaser.
- Un bus de eventos genérico o un «event bridge» reutilizable para tareas futuras.
- Pinia, Vue Router.
- Un servicio global de juego.
- Interfaces artificiales o arquitectura preventiva sin consumidor real dentro de esta tarea.

## 13. Comunicación Phaser–Vue

Comunicación unidireccional mínima: la escena notifica a Vue mediante un callback tipado solo cuando cambia el resumen relevante; Vue nunca lee ni muta estructuras internas de Phaser o del motor.

```ts
type GamePresentationState = Readonly<{
  status: 'running' | 'gameOver';
  step: number;
  elapsedMs: number;
}>;

type PhaserGameController = Readonly<{
  reset(): void;
  destroy(): void;
}>;
```

Reglas:

- Vue no recibe ni almacena: `board`, `activePiece`, `nextPiece`, la cola de eventos, el acumulador temporal, ningún otro estado interno del motor, ni objetos de Phaser.
- `PhaserGameController.reset()` reinicia el motor con la misma semilla fija (§15); es la misma operación que dispara la tecla `R` dentro de la escena.
- `PhaserGameController.destroy()` libera la instancia de Phaser (listeners de teclado, `Graphics`, el propio `Phaser.Game`).
- El nombre exacto de los campos y métodos puede ajustarse a las convenciones reales del repositorio si aporta claridad, pero no se añaden métodos redundantes (por ejemplo, no se duplica `reset` bajo dos nombres distintos) ni se amplía el resumen con campos no usados por Vue en esta tarea.

## 14. Sustitución de la pantalla actual

Inspección confirmada de `apps/web/src/App.vue` y `apps/web/src/board-composition.ts`: hoy Vue renderiza directamente un tablero jugable (grid de celdas con color por `PieceType`, botones que llaman a `engine.step`/`engine.reset` directamente, y `composeBoardForRendering` para superponer la pieza activa). Esta tarea sustituye por completo ese tablero:

- Se elimina el tablero jugable actual de `App.vue` (la sección `board-section`/`board-grid`, sus estilos asociados, y las funciones `doLeft`, `doRight`, `doStep`, `doRotateCW`, `doRotateCCW`, `doHardDrop` que llaman al motor directamente desde Vue).
- Se eliminan `apps/web/src/board-composition.ts` y `apps/web/src/board-composition.test.ts`: su función (`composeBoardForRendering`) queda sustituida por la composición equivalente hecha dentro de `GameScene` sobre coordenadas de canvas (§10), y mantenerlos junto a Phaser crearía exactamente el tablero jugable paralelo que esta tarea prohíbe.
- No se conserva ningún modo alternativo Vue ni un selector Vue/Phaser.
- No se deja código muerto: ninguna función, componente o estilo que quede sin uso tras retirar el tablero Vue permanece en el árbol.

Vue conserva y sigue mostrando (fuera del canvas):

- Título de la aplicación.
- El contenedor de `GameCanvas.vue`.
- Ayuda de controles (tabla o lista de teclas, §8).
- Estado `running`/`gameOver` (a partir de `GamePresentationState.status`).
- `step` y `elapsedMs` como información técnica provisional (a partir de `GamePresentationState`).
- Un botón accesible «Reset» que invoca `PhaserGameController.reset()`.

La tecla `R` (dentro del canvas, con foco) y el botón «Reset» de Vue ejecutan la misma operación de reinicio (mismo `reset()` del controlador, misma semilla fija).

## 15. Semilla e inicialización

- Se mantiene una semilla fija válida para esta tarea (por ejemplo, la misma `FIXED_SEED = 42` ya usada en la implementación actual de `App.vue`, o el valor concreto que se decida durante la implementación, documentado en el informe final).
- `reset()` reutiliza siempre esa misma semilla fija.
- La inicialización usa `prototypeConfig` de `@rautfall/game-config`, sin modificarlo.
- No se añade selector de semilla, ni configuración de dificultad, ni persistencia de ningún tipo.

## 16. Dependencias y versión

- `phaser` se añade únicamente como dependencia de `apps/web`. No se convierte en dependencia de `packages/game-engine` ni de `packages/game-config`.
- Durante la implementación se elegirá una versión estable de Phaser compatible con el stack actual (Vite 8, Vue 3.5, TypeScript 5.9, Node 22) y se registrará la versión exacta instalada en el informe final ([docs/implementation/0004-integracion-phaser.md](../implementation/0004-integracion-phaser.md)).
- Esta especificación no fija ni sugiere un número de versión concreto de Phaser; no se debe inventar uno.
- No se modifican `package.json` ni `pnpm-lock.yaml` durante la redacción de esta especificación.
- Dependencia auxiliar a evaluar durante la implementación, no durante esta especificación: `vitest.config.ts` no define actualmente un entorno DOM (por defecto, entorno `node`) y `apps/web` no tiene `@vue/test-utils` como dependencia. La prueba de ciclo de vida de `GameCanvas.vue` descrita en §18 necesitará previsiblemente ambas cosas (una dependencia de test, `@vue/test-utils`, y un entorno DOM tipo `jsdom` o `happy-dom` para el archivo o proyecto de test correspondiente). Si se confirma esa necesidad, se añade y se justifica en el informe final según las reglas de dependencias de `AGENTS.md`; no se añade preventivamente más de lo que esa prueba concreta requiera.
- No se añaden otras dependencias auxiliares salvo necesidad real demostrada durante la implementación.

## 17. Eventos

- `GameScene` drena la cola de eventos del motor (`engine.drainEvents()`) en cada frame en que se ejecutó al menos un paso lógico, para que la cola interna no crezca indefinidamente.
- En `0004` los eventos drenados no controlan la representación: no se implementan animaciones para `pieceMoved`, `pieceRotated`, `pieceLocked` ni `linesCleared`.
- No se introduce un «event bridge» genérico pensado para tareas futuras; el drenado es simplemente para higiene de la cola.
- Una tarea posterior podrá usar estos eventos para efectos visuales sin cambiar la fuente de verdad del dominio (el motor sigue emitiéndolos igual).

## 18. Estrategia de pruebas

Se separa la lógica testeable en aislamiento (funciones puras, sin Phaser real ni WebGL) de los aspectos que solo pueden validarse razonablemente en un navegador real.

### Pruebas unitarias de alto valor (TDD recomendado)

Sobre el adaptador temporal y la entrada (funciones puras extraídas de `GameScene`, o métodos testeables sin necesidad de una escena Phaser real):

- El acumulador ejecuta el número correcto de pasos fijos para un delta dado.
- Un delta inferior a `config.fixedStepMs` no ejecuta ningún paso.
- Varios pasos lógicos pueden ejecutarse a partir de un único frame con delta grande.
- El delta efectivo de un frame se limita a 250 ms antes de acumularse.
- Nunca se superan 25 pasos lógicos por frame, incluso con un delta arbitrariamente grande.
- El exceso de tiempo por encima de los límites anteriores se descarta y no se recupera en frames posteriores.
- Una pulsación única (rotación, hard drop, movimiento) se consume una sola vez aunque el adaptador recupere varios pasos lógicos en el mismo frame.
- `ArrowLeft` y `ArrowRight` simultáneas producen `horizontal: 0`.
- Nunca se construye un `StepInput` con `rotateClockwise` y `rotateCounterclockwise` ambos `true`.
- Un hard drop no se repite en pasos lógicos sucesivos del mismo frame a partir de una única pulsación.
- Tras detectar `status === 'gameOver'` en el snapshot, no se realizan más llamadas a `step()`.
- `reset()` vuelve a usar la misma semilla fija.

Sobre la transformación de coordenadas y el filtrado de filas visibles (funciones puras, análogas a la responsabilidad que hoy cumple `composeBoardForRendering`, pero orientadas a coordenadas de canvas en vez de a una matriz intermedia):

- El mapeo de filas internas a visibles excluye las filas 0 a 3.
- `board[y][x]` se transforma correctamente a coordenadas de canvas (`canvasX`, `canvasY`) para `y >= 4`.
- Las celdas de la pieza activa se representan solo cuando su `y` pertenece a una fila visible.
- El resumen (`GamePresentationState`) enviado a Vue contiene únicamente `status`, `step` y `elapsedMs`, sin campos adicionales del snapshot del motor.

### Ciclo de vida Vue (con mocks)

- `GameCanvas.vue` crea una única instancia al montarse.
- No crea instancias duplicadas ante remontajes.
- Destruye la instancia al desmontarse (llama al mecanismo real de destrucción de Phaser, o al equivalente mockeado en el test).
- El botón «Reset» invoca el controlador (`PhaserGameController.reset()`).
- Estas pruebas usan un mock de `create-phaser-game.ts` (la factoría), sin arrancar WebGL real ni una instancia real de Phaser en Vitest.
- Esta prueba requiere previsiblemente `@vue/test-utils` y un entorno DOM (`jsdom` o `happy-dom`) para el archivo o proyecto de test correspondiente, no disponibles hoy en el repositorio (ver nota de dependencias, §16).

### Fuera del alcance de las pruebas automatizadas (validación manual, §20)

- Renderizado visual real en navegador.
- Comportamiento real de escalado (`Phaser.Scale.FIT`/`CENTER_BOTH`) en distintos tamaños de ventana.
- Sin Playwright, sin pruebas visuales por píxel, sin snapshots HTML del canvas, sin probar internals de Phaser.

Las pruebas existentes del motor (126 pruebas tras 0003) deben seguir pasando sin modificación de contrato.

## 19. Criterios de aceptación

### Arquitectura

- Phaser solo existe como dependencia de `apps/web`.
- `packages/game-engine` sigue sin depender de navegador, Vue ni Phaser.
- Existe una única instancia de `Phaser.Game`, una única escena y un único tablero jugable en toda la aplicación.
- `GameCanvas.vue` monta y destruye correctamente la instancia (sin duplicados, sin fugas).
- No existe estado de dominio duplicado entre Vue y el motor.

### Tiempo

- El avance lógico se basa exclusivamente en `config.fixedStepMs`.
- El delta efectivo de cada frame está limitado a 250 ms.
- Nunca se ejecutan más de 25 pasos lógicos por frame.
- El exceso de tiempo se descarta, no se acumula indefinidamente.
- Las reglas del motor no dependen de los FPS reales del navegador.

### Entrada

- Los controles de §8 están cerrados: no hay soft drop, pausa, remapeo ni controles táctiles.
- Las acciones de pulsación única (rotación, hard drop, movimiento) se consumen correctamente una sola vez por pulsación, incluso si un frame recupera varios pasos lógicos.
- No hay repetición horizontal mantenida ni DAS/ARR provisional en Phaser.
- Tras `gameOver`, no se llama más a `step()`.
- El reset funciona igual desde teclado (`R`) y desde el botón Vue.

### Renderizado

- El tablero fijo y la pieza activa se representan exclusivamente a partir de `getSnapshot()`.
- Se muestran las 20 filas visibles; las 4 filas ocultas no se dibujan.
- La resolución lógica del canvas es 320×640, con celda de 32×32.
- El renderizado usa únicamente `Phaser.GameObjects.Graphics`.
- El fondo del canvas es transparente.
- No existe renderizado paralelo del tablero en Vue.

### Pruebas

- Las pruebas unitarias del adaptador temporal, la entrada y la transformación de coordenadas (§18) pasan.
- La prueba de ciclo de vida de `GameCanvas.vue` con mocks pasa.
- Las pruebas existentes del motor determinista siguen pasando sin modificación de contrato.
- La validación manual (§20) queda documentada en el informe final.

### Calidad

- `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan correctamente.
- No hay imports profundos entre paquetes.
- No hay scripts ad hoc de depuración.
- No queda código muerto (en particular, ni restos del tablero Vue anterior ni de `board-composition.ts`).
- No se amplía el alcance más allá de lo descrito en §5.

## 20. Validación manual requerida

A ejecutar con `pnpm dev`, documentando el resultado en el informe final:

- La aplicación carga sin errores de consola.
- El tablero se ve completo y proporcionado (sin recortes ni deformaciones evidentes).
- Las filas ocultas no se muestran.
- La pieza activa coincide visualmente con lo que indica el snapshot (tipo, posición, orientación).
- Izquierda y derecha mueven la pieza por pulsación individual.
- Mantener ambas direcciones simultáneamente no desplaza la pieza.
- La rotación horaria funciona.
- La rotación antihoraria funciona.
- El hard drop se ejecuta una sola vez por pulsación.
- La gravedad hace avanzar la pieza automáticamente sin entrada del jugador.
- Las piezas se fijan correctamente al tocar el fondo o bloques existentes.
- Las líneas se eliminan si se completan durante la sesión de prueba.
- El estado `gameOver` se refleja en Vue.
- No se siguen ejecutando pasos lógicos tras `gameOver`.
- La tecla `R` reinicia la partida.
- El botón «Reset» de Vue reinicia la partida.
- Tras reiniciar, la secuencia de piezas reproducida es la misma (misma semilla).
- Cambiar de pestaña y volver no bloquea el navegador ni produce una recuperación descontrolada de pasos acumulados.
- Desmontar y volver a montar la vista no duplica canvas, listeners ni instancias de Phaser.
- No aparece scroll de la página causado por las flechas o `Space` mientras la partida tiene el foco.

## 21. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Todos deben finalizar correctamente. Además, revisar:

- No existen imports profundos entre paquetes.
- Cualquier dependencia añadida (Phaser y, si procede, dependencias de test) está justificada según las reglas de `AGENTS.md`.
- No existe código muerto (en particular, restos del tablero Vue anterior).
- No hay abstracciones innecesarias ni arquitectura preventiva.
- No se ha ampliado el alcance descrito en §5/§6.
- No hay errores ni avisos de lint ignorados.

## 22. Actualizaciones de documentación

Este documento ([docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación.

Al finalizar la implementación, se debe crear [docs/implementation/0004-integracion-phaser.md](../implementation/0004-integracion-phaser.md) como informe de implementación independiente, con:

- resumen;
- archivos creados y modificados;
- arquitectura final;
- versión exacta de Phaser instalada;
- decisiones de bajo nivel tomadas durante la implementación;
- pruebas añadidas;
- comandos ejecutados y resultados;
- validación manual (§20) documentada punto por punto;
- desviaciones respecto de esta especificación, si las hubo;
- riesgos detectados;
- deuda técnica identificada;
- confirmación explícita de que no se duplicó lógica del motor en Phaser;
- confirmación explícita de que no existe un segundo tablero jugable en Vue;
- actualización de [docs/project-status.md](../project-status.md) (estado, fecha, resultado resumido, referencia al informe);
- siguiente tarea propuesta, sin asumir automáticamente su alcance.

## 23. Próxima tarea prevista

`0005 — Prototipo vertical Tactical` (alcance a definir en su propia especificación; esta tarea no prejuzga su contenido).
