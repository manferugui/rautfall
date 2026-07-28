# 0011 — Pieza fantasma determinista

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0011 — Pieza fantasma determinista
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0011`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla o el bot pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0011-pieza-fantasma-determinista.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0011-pieza-fantasma-determinista.md) (ver §17), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Añadir una **pieza fantasma** (`landing cells`): la proyección determinista de dónde aterrizaría la pieza activa si se ejecutara un hard drop en el estado actual del motor, conservando su tipo, orientación y coordenada `x`, con la `y` más baja válida antes de colisionar.

Al terminar la tarea:

- `ActivePieceSnapshot` expone `landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>`, celdas absolutas del tablero, con la misma forma que `cells` pero trasladadas verticalmente a la posición de aterrizaje;
- `landingCells` se deriva en `packages/game-engine`, reutilizando exactamente la misma función de distancia de hard drop ya existente (`hardDropDistance`) y la misma función de resolución de celdas absolutas (`computeAbsoluteCells`); no existe una segunda implementación de colisión ni de recorrido de filas;
- `landingCells` es puramente derivada: no muta el motor, no genera eventos, no interactúa con `grounded`, `lockDelayElapsedMs` ni `lockResetsUsed`, y desaparece exactamente cuando desaparece la pieza activa (`activePiece === null`), incluido en `gameOver`;
- Phaser renderiza `landingCells` leyéndolas directamente del snapshot del motor, sin recalcular colisiones, sin simular un hard drop y sin mantener estado fantasma propio;
- no se modifica `GamePresentationState`: la pieza fantasma se pinta dentro de `GameScene.renderFrame()`, que ya lee `engine.getSnapshot()` directamente para dibujar el tablero y la pieza activa;
- no se añade ningún panel, indicador, contador ni configuración de usuario para la pieza fantasma.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo                                        ✅ Completada
0002 — Motor de juego determinista                                ✅ Completada
0003 — Rotación SRS                                                ✅ Completada
0004 — Integración de Phaser                                       ✅ Completada
0005 — DAS, ARR y soft drop                                         ✅ Completada
0006 — Lock delay y fijación diferida                               ✅ Completada
0007 — Cola de próximas piezas y preview técnico provisional        ✅ Completada
0008 — Pausa, reanudación y reinicio coordinados                   ✅ Completada
0009/0009b — Marco Tactical e identidad visual Industrial Dramatic ✅ Completada
0010 — E2E mínimo del flujo esencial                               ✅ Completada
0011 — Pieza fantasma determinista                                 ← Esta tarea
```

Esta tarea no incluye: hold/reserva, puntuación, combos, T-Spins, back-to-back, energía, sabotajes, multijugador local, audio, partículas, animaciones, configuración de usuario, activación/desactivación de la pieza fantasma, cambio de controles, rediseño del tablero, cambios en la carcasa Tactical, cambios en el rival simulado, Playwright visual, capturas de regresión, backend ni persistencia. Ver §7 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — MVP acordado provisionalmente (lista «Pieza fantasma» entre las mecánicas del juego base) y «Responsabilidades de Phaser» («Piezas activas y fantasmas»); ambas secciones describen intención de producto, no el contrato técnico exacto, que fija esta especificación.
- [docs/tasks/0002-motor-de-juego-determinista.md](0002-motor-de-juego-determinista.md) — hard drop original: cálculo de distancia hasta la posición legal más baja mediante recorrido incremental de colisión, fijación inmediata. Esta tarea reutiliza literalmente esa función de distancia, sin reescribirla.
- [docs/tasks/0003-rotacion-srs.md](0003-rotacion-srs.md) — geometría de piezas por orientación (`PIECE_ORIENTATION_CELLS`) y `computeAbsoluteCells`, que esta tarea reutiliza sin modificar.
- [docs/tasks/0006-lock-delay-fijacion-diferida.md](0006-lock-delay-fijacion-diferida.md) — concepto de apoyo (`isGrounded`), temporizador de lock delay y orden del paso lógico vigente, con los que la pieza fantasma no interactúa en absoluto (§12).
- [docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md](0007-cola-proximas-piezas-preview-tecnico.md) — precedente directo de cómo ampliar un contrato del motor con una función pura derivada (`getPieceShape`) sin acoplarla a Phaser, y de cómo decidir Vue+CSS frente a Phaser para una previsualización; esta tarea sigue el mismo patrón de decisión, pero con un resultado distinto (Phaser, no Vue, porque la fantasma se superpone al tablero real, no a piezas en reposo).
- `packages/game-engine/src/index.ts` — implementación real tras `0010` (ver §4). Se amplía, no se reescribe desde cero.
- `packages/game-engine/src/game-engine.test.ts` — 179 `it`/`test` en 43 bloques `describe` (incluidos diez bloques de lock delay tras `0006`). Ninguna de estas pruebas debe romperse por esta tarea.
- `packages/game-config/src/index.ts` — `GameConfig`, `prototypeConfig` y `parseGameConfig` reales. **No se modifican en esta tarea** (§14): la pieza fantasma no introduce ningún parámetro configurable.
- `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/coordinates.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/components/GameCanvas.vue`, `apps/web/src/App.vue`, `apps/web/src/components/NextPiecesPreview.vue` — integración web real tras `0009b`/`0010` (ver §4.3, §17).
- [docs/tasks/0010-e2e-minimo-flujo-esencial.md](0010-e2e-minimo-flujo-esencial.md) — flujo E2E real y sus selectores contractuales, que esta tarea no amplía (§20).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto (321 tests Vitest, 1 test E2E, working tree limpio).

## 4. Inspección previa (confirmada por lectura directa del código real)

### 4.1 Hard drop y colisión reales, reutilizables sin cambios

`packages/game-engine/src/index.ts` ya contiene, sin exportar:

```ts
function isCollision(board: (PieceType | null)[][], cells: Cell[]): boolean { /* … */ }

function computeAbsoluteCells(
  pieceType: PieceType, originX: number, originY: number, orientation: Orientation,
): Cell[] { /* … */ }

function hardDropDistance(board: (PieceType | null)[][], piece: ActivePiece): number {
  const cells = activePieceCells(piece);
  let distance = 0;
  while (true) {
    const nextCells = cells.map((c) => ({ x: c.x, y: c.y + distance + 1 }));
    if (isCollision(board, nextCells)) break;
    distance++;
  }
  return distance;
}
```

`hardDropDistance` es exactamente la función que ya usa el propio hard drop (`processStep`, paso 7 de `0006` §14) para calcular cuánto desciende la pieza antes de fijarse. Esta tarea reutiliza esta misma función, sin modificarla, para derivar la pieza fantasma: no existe ninguna otra forma de calcular "dónde aterrizaría" que no sea, exactamente, la distancia de hard drop.

### 4.2 `ActivePieceSnapshot` y `getSnapshot()` reales

```ts
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;
  lockDelayElapsedMs: number;
  lockResetsUsed: number;
}>;
```

`getSnapshot()` construye `activePieceSnap` únicamente cuando `activePiece !== null`, derivando `cells` mediante `activePieceCells(activePiece)` (que a su vez llama a `computeAbsoluteCells`) y `grounded` mediante `isGrounded(board, activePiece)`, ambas evaluadas en el momento de la llamada, sin almacenamiento persistente. Esta tarea sigue exactamente el mismo patrón para `landingCells` (§8).

### 4.3 Renderizado Phaser real: `GameScene.renderFrame()` ya lee el snapshot completo, no `GamePresentationState`

Confirmado por lectura de `apps/web/src/game/scenes/GameScene.ts`:

- `renderFrame()` llama a `this.engine.getSnapshot()` directamente y usa `snap.board` y `snap.activePiece.cells` para dibujar con `Phaser.GameObjects.Graphics` (`fillRect`/`strokeRect`), filtrando filas ocultas con `isRowVisible` de `coordinates.ts` y coloreando con el mapa privado `PIECE_COLORS: Record<PieceType, number>`.
- `notifyState()` es una función **distinta** de `renderFrame()`: construye `GamePresentationState` (`status`, `step`, `elapsedMs`, `nextPieces`) exclusivamente para el HUD de Vue (paneles, botones, previsualización de próximas piezas), y solo invoca `callbacks.onStateUpdate` cuando alguno de esos campos cambia.
- Por tanto, **`GamePresentationState` no es el canal por el que Phaser conoce el estado del motor**: es el canal por el que Vue conoce un resumen del estado. `GameScene` ya tiene acceso directo y completo a `EngineSnapshot`/`ActivePieceSnapshot` dentro de `renderFrame()`, incluida cualquier ampliación futura de esos tipos, sin pasar por `GamePresentationState`.
- Esta es la razón concreta y verificada por la que esta tarea **no necesita ampliar `GamePresentationState`** (resolviendo la ambigüedad condicional de la petición del usuario, §13): `landingCells` se lee dentro de `renderFrame()` exactamente igual que `snap.activePiece.cells`, sin ningún transporte adicional.
- `apps/web/src/game/types.test.ts` fija hoy, mediante aserciones explícitas, que `GamePresentationState` tiene exactamente cuatro claves (`status`, `step`, `elapsedMs`, `nextPieces`) y no contiene `board` ni `activePiece`. No tocar este archivo ni este tipo evita cualquier riesgo de romper esas aserciones.

### 4.4 Colores y utilidades de coordenadas reales, reutilizables sin cambios

- `PIECE_COLORS: Record<PieceType, number>` (privado a `GameScene.ts`): mismo mapa de colores por tipo de pieza ya usado para el tablero fijo y la pieza activa.
- `coordinates.ts`: `CELL_SIZE`, `HIDDEN_ROWS`, `boardXToCanvas`, `boardYToCanvas`, `isRowVisible`, ya testeadas en `coordinates.test.ts`. Ninguna de estas funciones cambia: la pieza fantasma usa las mismas coordenadas absolutas de tablero que `cells`, por lo que la misma transformación aplica sin modificación.

### 4.5 Ausencia de infraestructura de test para `GameScene.ts`

No existe ningún `GameScene.test.ts`. `GameCanvas.test.ts` mockea por completo `createPhaserGame` (§4.3 de `0007`, sin cambios desde entonces): ninguna prueba unitaria ejercita hoy el cuerpo real de `renderFrame()`, ni para el tablero fijo ni para la pieza activa. Esta ausencia es una decisión ya tomada y documentada en `0007` §20.1 (evitar mocks de `Graphics` o lectura de píxeles para renderizado de Phaser), no una laguna nueva que esta tarea deba cerrar (§16).

## 5. Alcance incluido

- Nuevo campo `landingCells` en `ActivePieceSnapshot`, derivado en `packages/game-engine/src/index.ts` mediante `hardDropDistance` y `computeAbsoluteCells` ya existentes (§8, §9).
- Cálculo dentro de `getSnapshot()`, sin caché, sin nuevo estado interno persistente (§9, §16).
- Renderizado de la pieza fantasma en `GameScene.renderFrame()`, leyendo `snap.activePiece.landingCells` directamente, con estilo visual mínimo coherente con Industrial Dramatic (§17, §18).
- Pruebas del motor (TDD pragmático) que cubren proyección, equivalencia exacta con hard drop, ausencia de mutación, inmutabilidad y determinismo (§21).
- Confirmación explícita de que no se modifica `GamePresentationState`, `packages/game-config`, el E2E de `0010`, ni ningún componente Vue (§13, §19, §20).

## 6. Alcance explícitamente excluido

No pertenece a `0011`:

- Hold / reserva de pieza.
- Puntuación, combos, T-Spins, `back-to-back`.
- Energía de combate y sabotajes.
- Batalla, bot, multijugador local.
- Audio, partículas, animaciones (incluida cualquier animación de parpadeo o pulso de la pieza fantasma).
- Configuración de usuario: no existe activación/desactivación de la pieza fantasma, ni opacidad, color o distancia configurables (§14).
- Cambios de controles.
- Rediseño del tablero, de la carcasa Tactical, del monitor rival o del panel de combate simulado.
- Nuevas propiedades de `GameConfig` (§14).
- Nuevos eventos públicos de `GameEvent` (§13).
- Ampliación de `GamePresentationState` (§4.3, §13).
- Ampliación del E2E de `0010` con inspección de píxeles del canvas o capturas de regresión visual (§20).
- Exposición de internals del motor (funciones privadas, `window`, hooks de test) para facilitar la prueba de la pieza fantasma.
- Cambios de code splitting o subida artificial del límite de aviso de chunk de Vite/Rollup. El aviso de chunk superior a 500 kB (atribuible a Phaser, aceptado desde `0004`) permanece sin resolver.
- Dependencias nuevas en ningún paquete.
- Refactor general del motor, de `GameScene.ts` o de cualquier otro archivo ajeno a esta tarea.
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §5.

## 7. Contrato público: nombre, ubicación y forma

### 7.1 Alternativas evaluadas

**A. Añadir información fantasma a `ActivePieceSnapshot`.** La pieza fantasma solo tiene sentido mientras existe una pieza activa (misma orientación, misma `x`): es una propiedad derivada de esa pieza concreta, no un dato independiente del motor. Añadirla a `ActivePieceSnapshot` resuelve gratis dos reglas exigidas por el objetivo: desaparece cuando no hay pieza activa y desaparece en `gameOver`, porque `ActivePieceSnapshot` ya es `null` en ambos casos. No se necesita ningún caso `null` adicional ni ninguna comprobación de "pieza fantasma ausente" distinta de la ya existente comprobación `activePiece === null`.

**B. Añadir un campo independiente a `EngineSnapshot`** (por ejemplo, `EngineSnapshot.landingCells: ReadonlyArray<…> | null`, en paralelo a `activePiece`). Descartada: duplicaría en el nivel superior del snapshot una regla de nulidad que `ActivePieceSnapshot` ya resuelve de forma natural (`null` cuando no hay pieza activa), obligando a mantener sincronizados dos campos en vez de uno, y separaría en el contrato público un dato que conceptualmente pertenece a la pieza activa, no al estado global del motor.

**C. Exponer una función pura pública derivada del snapshot** (por ejemplo, `computeLandingCells(snapshot: EngineSnapshot): Cell[] | null`, exportada junto a `getPieceShape`). Descartada para este caso: a diferencia de `getPieceShape` (que describe una pieza en abstracto, sin tablero ni posición, útil para una previsualización en reposo, §19 de `0007`), la pieza fantasma depende del tablero real y de la posición/orientación reales de la pieza activa en cada instante; recalcularla fuera del motor exigiría que el consumidor reciba también el tablero completo y reimplemente (o importe) `isCollision`, lo que no aporta ninguna ventaja frente a incluirla ya calculada en el snapshot, y abriría la puerta a que un consumidor la recalculara con una lógica ligeramente distinta de la del motor.

### 7.2 Decisión

Se adopta la **alternativa A**: un campo nuevo `landingCells` dentro de `ActivePieceSnapshot`, calculado por el propio motor en `getSnapshot()`, con el mismo patrón de derivación ya usado para `cells` y `grounded`.

### 7.3 Nombre del campo

Alternativas evaluadas: `ghostCells`, `landingCells`, `projectedCells`, `ghostPiece`.

- `ghostPiece` se descarta: sugiere una entidad independiente (con su propio tipo, posición, orientación), cuando en realidad es exactamente la misma pieza activa proyectada; introduciría una ambigüedad sobre si `ghostPiece.type`/`ghostPiece.orientation` pudieran diferir alguna vez de los de la pieza activa (nunca difieren, §9).
- `ghostCells` nombra la mecánica de producto («pieza fantasma»), pero no describe qué contiene el campo ni por qué existe; es el nombre más ambiguo de los cuatro para quien lee solo el contrato de tipos, sin contexto de producto.
- `projectedCells` es impreciso: no deja claro una proyección de qué (¿de la posición futura tras un paso? ¿de una rotación?). El motor ya usa el verbo «proyectar» en ningún otro sitio; introducirlo aquí no se apoya en ninguna convención existente.
- `landingCells` describe exactamente el hecho geométrico que el campo representa (las celdas donde la pieza aterrizaría) sin depender de terminología de género de videojuego, es coherente con el nombre ya existente de la función interna que lo calcula (`hardDropDistance`, que ya usa el vocabulario de "aterrizaje"/descenso) y con el propio nombre de sección de esta especificación («pieza fantasma» es el nombre de producto en castellano; `landingCells` es su contrato técnico en inglés, igual que `hardDrop`/`softDrop` son términos técnicos en inglés para conceptos con nombre en castellano en `docs/rautfall.md`).

Se adopta **`landingCells`**.

### 7.4 Forma final

```ts
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;
  lockDelayElapsedMs: number;
  lockResetsUsed: number;
  landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;
```

Reglas:

- `landingCells` contiene exactamente 4 celdas absolutas del tablero, con la misma forma `{ x: number; y: number }` que `cells` (mismo tipo, ningún campo adicional).
- No se expone ninguna coordenada de origen independiente (`landingX`/`landingY`): al igual que `cells`, `landingCells` son celdas ya resueltas a coordenadas absolutas, listas para componerse directamente sobre `EngineSnapshot['board']`, sin que el consumidor tenga que sumarles ningún desplazamiento.
- No se duplica información innecesaria: `landingCells` no repite `type` ni `orientation` (ya están en el nivel de `ActivePieceSnapshot`, y son idénticos a los de la pieza activa, §9).
- `EngineSnapshot` no cambia: la ampliación completa de esta tarea vive dentro de `ActivePieceSnapshot`.
- No se añade ningún alias de compatibilidad ni ningún campo transicional.

## 8. Algoritmo

```text
function computeLandingCells(board, activePiece):
  distance = hardDropDistance(board, activePiece)   // función ya existente, sin cambios
  return computeAbsoluteCells(
    activePiece.type,
    activePiece.x,
    activePiece.y + distance,
    activePiece.orientation,
  )                                                   // función ya existente, sin cambios
```

- `hardDropDistance` recorre incrementalmente las filas por debajo de la pieza activa hasta encontrar la primera colisión, exactamente como ya hace para el hard drop real (`0002` §14). No se introduce ninguna variante de esa función, ni una segunda implementación de recorrido de filas o de comprobación de colisión: `computeLandingCells` es una composición de dos funciones ya existentes y ya probadas, no un algoritmo nuevo.
- `computeLandingCells` se invoca una única vez por llamada a `getSnapshot()`, únicamente cuando `activePiece !== null`, exactamente en el mismo punto donde ya se calculan `cells` y `grounded` para el snapshot.
- Complejidad: `O(BOARD_ROWS)` en el peor caso (24 filas), idéntica a la ya existente para el hard drop real y para `isGrounded` (que también recorre una comprobación de colisión de coste constante por fila). No se introduce ninguna optimización prematura (sin memoización, sin invalidación por diffing de tablero): el coste es el mismo orden de magnitud que ya paga cada `getSnapshot()` para derivar `grounded`, y `getSnapshot()` ya se llama varias veces por frame en `GameScene.update()` sin que ello suponga hoy ningún problema de rendimiento medido (§16).
- `computeLandingCells` no consume el PRNG, no muta el tablero, no muta la pieza activa y no depende de ningún estado distinto de `board` y de la posición/orientación/tipo actuales de `activePiece`, exactamente igual que `isGrounded` (`0006` §7).

## 9. Semántica exacta

- **Relación con `ActivePieceSnapshot.cells`**: `landingCells` tiene la misma longitud (4), el mismo `type` y la misma `orientation` que `cells` (nunca varían entre ambos: la pieza fantasma nunca rota ni cambia de tipo respecto de la pieza activa). Únicamente difiere en el desplazamiento vertical: cada celda de `landingCells` es la celda correspondiente de `cells` desplazada `hardDropDistance(board, activePiece)` filas hacia abajo (`y` mayor o igual).
- **Pieza ya apoyada** (`grounded === true`, sin lock delay en curso o con él ya iniciado): `hardDropDistance` devuelve `0`, por lo que `landingCells` es, celda a celda, idéntico en contenido a `cells` (misma `x`, misma `y`). No es un caso especial: es el resultado natural de la misma fórmula.
- **Durante lock delay**: `landingCells` no lee ni depende de `lockDelayElapsedMs` ni de `lockResetsUsed`; se deriva exclusivamente de la posición/orientación actuales y del tablero actual, sea cual sea el progreso del temporizador. Mientras la pieza está apoyada y el temporizador avanza, `landingCells` permanece idéntico a `cells` en cada snapshot sucesivo (ambos inmóviles), hasta que un movimiento horizontal o una rotación válidos cambien la posición/orientación real, momento en el que ambos (`cells` y `landingCells`) se recalculan de forma coherente entre sí.
- **La proyección coincide completamente con la pieza activa**: es el caso ya descrito de pieza apoyada; no requiere ningún tratamiento especial ni ninguna señal adicional en el contrato (no se añade, por ejemplo, un booleano `isAtRest`): un consumidor que necesite saber si la fantasma coincide con la pieza activa puede comparar `cells` con `landingCells` directamente, o leer el ya existente `grounded`.
- **Durante hard drop**: el hard drop fija la pieza dentro del mismo `step()` en el que se solicita (`input.hardDrop === true`); no existe ningún snapshot intermedio observable entre "pieza activa a punto de caer" y "pieza ya fijada, nueva pieza activa o game over" (mismo argumento ya establecido en `0006` §14 para el resto de fijaciones). Por tanto, `landingCells` no tiene ningún comportamiento especial que definir "durante" un hard drop: antes de invocar `step({ hardDrop: true })`, `landingCells` ya predice correctamente dónde caerá; después de esa llamada, `landingCells` (si sigue existiendo pieza activa, es decir, tras el spawn de la siguiente) se recalcula desde cero para la nueva pieza.
- **Inmediatamente después de fijar y antes del siguiente spawn**: este estado intermedio **no es observable** con el motor actual. La secuencia completa de fijación (`lockActivePiece` → `clearLines` → `spawnNextPiece`) ocurre de forma síncrona dentro de un único `step()`, sin ceder el control ni permitir una llamada a `getSnapshot()` a mitad de esa secuencia (invariante ya vigente desde `0002`, reafirmada en `0006` §14). Esta tarea no cambia esa invariante ni la convierte en observable: no se introduce ningún punto de parada nuevo. Por tanto, no hace falta definir qué valor tendría `landingCells` en ese instante porque ese instante no existe para ningún consumidor externo.
- **Inmutabilidad del contrato**: `landingCells` es de solo lectura (`ReadonlyArray<Readonly<…>>`), congelada (`Object.freeze`) igual que `cells`, y cada llamada a `getSnapshot()` construye un array nuevo (sin compartir la referencia mutable interna que el motor pudiera usar para el cálculo intermedio). No se garantiza identidad de referencia entre llamadas sucesivas, solo igualdad de contenido cuando el estado no ha cambiado.

## 10. Relación con hard drop: prueba de equivalencia exigida

Se exige, como mínimo, una prueba de propiedad/equivalencia con esta forma:

```text
1. Crear dos motores (`engineA`, `engineB`) con la misma semilla y la misma configuración.
2. Aplicar, en ambos motores, exactamente la misma secuencia de `StepInput` hasta un punto
   intermedio arbitrario de la partida (por determinismo, `engineA` y `engineB` quedan
   en estados observables idénticos: mismo tablero, misma pieza activa, mismo `nextPieces`).
3. Leer `landingCells` de `engineA.getSnapshot().activePiece` SIN aplicar ningún step adicional.
4. Ejecutar en `engineB` un único `step()` con `hardDrop: true` (y el resto de campos de
   `StepInput` en su valor neutro), lo que fija la pieza en `engineB`.
5. Comprobar que, para cada una de las cuatro celdas de `landingCells` capturadas en el
   paso 3, la celda correspondiente del tablero de `engineB.getSnapshot()` contiene
   exactamente el tipo de pieza que estaba activa antes del hard drop.
```

No es necesario que el motor exponga una operación de clonación explícita: crear dos instancias independientes con `createGameEngine` usando la misma semilla/configuración y aplicarles la misma secuencia de `step()` ya garantiza equivalencia por el determinismo ya probado del motor (`0002`§19, `0007`§14). Esta prueba no acopla el cálculo de la fantasma a ningún evento de Phaser: se ejecuta íntegramente dentro de `packages/game-engine/src/game-engine.test.ts`.

## 11. Lock delay: ausencia de interacción

La pieza fantasma:

- no modifica `grounded`;
- no modifica `lockDelayElapsedMs`;
- no consume `lockResetsUsed`;
- no genera eventos;
- no cambia ningún estado interno del motor;
- no interactúa con el temporizador de lock delay en ningún sentido (ni lo lee para decidir su propio valor, ni lo afecta al calcularse).

`computeLandingCells` es una función pura invocada exclusivamente dentro de `getSnapshot()`, en el mismo punto donde ya se deriva `grounded`; ambas derivaciones son independientes entre sí y no comparten mutación de estado. Ninguna prueba de esta tarea debe observar un cambio en `lockDelayElapsedMs` ni en `lockResetsUsed` atribuible a la mera consulta de `landingCells` (leer el snapshot repetidamente sin llamar a `step()` no debe alterar ningún contador).

## 12. Eventos

No se añade, elimina ni modifica ningún tipo de `GameEvent` ni ningún valor de `MoveReason` en esta tarea. La pieza fantasma es exclusivamente un campo del snapshot, actualizado en cada `getSnapshot()`; los consumidores (Phaser) la actualizan al recibir el snapshot habitual, sin necesidad de suscribirse a ningún evento nuevo. No se introduce ningún evento del tipo `ghostUpdated`, `landingCellsChanged` o equivalente.

## 13. Configuración y `GamePresentationState`

- **`packages/game-config` no se modifica.** No se añade ninguna propiedad relativa a la pieza fantasma (ni activación, ni opacidad, ni color, ni distancia). La pieza fantasma está activa siempre que exista una pieza activa; no es un comportamiento configurable en esta fase.
- **`apps/web/src/game/types.ts` (`GamePresentationState`) no se modifica.** Confirmado por inspección (§4.3): Phaser ya lee `EngineSnapshot`/`ActivePieceSnapshot` completos dentro de `GameScene.renderFrame()`, sin pasar por `GamePresentationState`, que es exclusivamente el canal Phaser→Vue para el HUD (`status`, `step`, `elapsedMs`, `nextPieces`). Ampliarlo con `landingCells` no aportaría ninguna capacidad nueva y arriesgaría inflar un contrato que `apps/web/src/game/types.test.ts` ya fija hoy en exactamente cuatro claves.

## 14. Fuera de alcance de configuración de usuario

No se introduce:

- opción de usuario para activar/desactivar la pieza fantasma;
- opacidad configurable;
- color configurable;
- feature flags;
- configuración de distancia o de comportamiento.

La pieza fantasma está habilitada incondicionalmente en esta fase, coherente con `docs/rautfall.md` («Elementos no configurables»: las invariantes de dominio permanecen en código).

## 15. Snapshot e inmutabilidad

- `landingCells` se congela con `Object.freeze` en el array y en cada celda individual, siguiendo exactamente el mismo patrón ya aplicado a `cells`:

  ```ts
  landingCells: Object.freeze(
    computeLandingCells(board, activePiece).map((c) => Object.freeze({ x: c.x, y: c.y })),
  ),
  ```

- Ningún consumidor externo (Phaser, Vue, pruebas) puede mutar `landingCells` de forma que afecte al estado interno del motor: es un array nuevo en cada `getSnapshot()`, sin compartir referencias mutables internas.
- `ActivePieceSnapshot` sigue siendo `null` exactamente cuando `activePiece === null` (sin pieza activa, o en `gameOver`); no existe ningún valor de `landingCells` fuera de ese objeto, por lo que la ausencia de pieza fantasma se deriva gratis de la misma comprobación ya existente (`snap.activePiece === null`), sin ningún caso especial nuevo que el consumidor deba aprender.
- El snapshot completo sigue siendo inmutable (`Object.freeze` de nivel superior), igual que en `0002`/`0003`/`0006`/`0007`.

## 16. Rendimiento

- `getSnapshot()` ya se invoca varias veces por frame dentro de `GameScene.update()` (antes y después de cada `step()`, y de nuevo en `renderFrame()`/`notifyState()`). Esta tarea añade, a cada una de esas llamadas cuando existe pieza activa, un recorrido adicional de coste `O(BOARD_ROWS)` (como máximo 24 iteraciones de comprobación de colisión sobre 4 celdas), del mismo orden que el ya existente para `isGrounded` (que se ejecuta una sola comprobación de colisión, no un recorrido) y muy inferior al de `hardDropDistance` cuando se ejecuta un hard drop real.
- No se cachea `landingCells` entre llamadas a `getSnapshot()`: no hay evidencia de que el coste añadido (una función de bucle acotado a 24 iteraciones, sin asignaciones de memoria significativas) requiera invalidación explícita. Introducir una caché exigiría decidir cuándo invalidarla (tras cada movimiento horizontal, rotación, paso de gravedad, fijación…), lo que añadiría una superficie de error (desincronización) sin beneficio medido.
- Si una futura tarea de perfilado real detectara un coste no aceptable, esa optimización quedaría fuera de esta tarea y se abordaría de forma independiente y justificada por evidencia, no de forma preventiva aquí.

## 17. Integración Phaser

### 17.1 Punto de integración

`GameScene.renderFrame()` (única función que dibuja el estado del motor) se amplía para leer `snap.activePiece.landingCells` y dibujarlas, exactamente en el mismo bucle de iteración por celdas ya usado para `snap.activePiece.cells`, reutilizando `boardXToCanvas`, `boardYToCanvas`, `isRowVisible` y `PIECE_COLORS` sin modificarlos.

### 17.2 Orden de capas

```text
1. Tablero fijado           (ya existente, sin cambios)
2. Pieza fantasma            (nuevo, esta tarea)
3. Pieza activa              (ya existente, sin cambios)
4. Overlays Vue (pausa, etc.) (ya existentes, fuera del canvas)
```

`renderFrame()` limpia el `Graphics` (`this.graphics.clear()`) y dibuja en este orden: primero el tablero fijo (bucle ya existente), después la pieza fantasma (bucle nuevo, insertado entre el tablero y la pieza activa), y por último la pieza activa (bucle ya existente, sin cambios). Este orden asegura que, cuando `landingCells` coincide exactamente con `cells` (pieza apoyada, §9), la pieza activa se dibuja encima y la fantasma queda visualmente oculta bajo ella, sin ningún parpadeo ni superposición ambigua.

### 17.3 Técnica gráfica y estilo visual

- Se usa el mismo `PIECE_COLORS[snap.activePiece.type]` que ya colorea la pieza activa: la fantasma no introduce una paleta nueva ni un color neutro genérico, para que se identifique de inmediato con qué pieza corresponde.
- Relleno con opacidad reducida (`fillStyle(color, 0.25)` sobre `fillRect`) y contorno con opacidad algo mayor (`lineStyle(1, color, 0.5)` sobre `strokeRect`), frente al relleno sólido (`alpha = 1`) usado para bloques fijados y para la pieza activa. La diferencia de opacidad es, por sí sola, suficiente para distinguir la fantasma de un bloque real sin necesitar un patrón, una textura o un borde discontinuo adicional.
- No se usa `bloom`, ni resplandor (`glow`), ni neón, ni ninguna animación de parpadeo o pulso: coherente con los límites visuales de Industrial Dramatic (`docs/rautfall.md`, «Límites visuales»: «sin resplandor permanente», «los efectos luminosos se reservan para eventos» — la pieza fantasma no es un evento, es información pasiva y permanente durante el juego).
- No se añaden partículas ni transiciones.
- No se introduce ninguna textura, patrón de rayas o icono adicional: geometría clara (mismo contorno que la pieza real) y opacidad reducida son la solución mínima verificable.

### 17.4 Filas ocultas

`landingCells`, igual que `cells`, puede contener celdas en las cuatro filas ocultas superiores (`y < HIDDEN_ROWS`) si la pieza fantasma aterrizara parcialmente dentro de esa región (situación posible cerca de un game over inminente, aunque infrecuente). El bucle de dibujo de la fantasma aplica el mismo filtro `isRowVisible(cell.y)` ya usado para la pieza activa, sin dibujar ninguna celda oculta. No se modifica el tamaño del tablero, el número de filas ocultas, el sistema de coordenadas, la cámara ni la resolución del canvas.

### 17.5 Ausencia de cálculo de colisión en Phaser

`GameScene.ts` no invoca, en ningún punto de esta tarea, ninguna comprobación de colisión, ningún recorrido de filas, ninguna simulación de hard drop ni ninguna duplicación de `PIECE_ORIENTATION_CELLS`. Toda la geometría de la fantasma llega ya resuelta en `snap.activePiece.landingCells`; Phaser se limita a traducir esas celdas absolutas a coordenadas de canvas y a pintarlas.

## 18. Dirección visual

La pieza fantasma respeta Industrial Dramatic sin ruido adicional:

- usa el color real de la pieza activa (no un gris neutro ni un color de sistema), a opacidad reducida;
- geometría clara: mismo contorno cuadriculado que cualquier pieza, sin deformaciones;
- claramente distinguible de bloques reales por la opacidad (0.25 relleno / 0.5 contorno frente a opacidad 1 de bloques reales y pieza activa);
- sin bloom, sin neón, sin animación pulsante, sin partículas (§17.3);
- no eclipsa la pieza activa: el orden de capas (§17.2) garantiza que la pieza activa siempre se dibuja por encima.

## 19. Presentación Vue

No se modifica ningún componente Vue ni `App.vue`. No se crea:

- panel;
- indicador;
- contador;
- control;
- estado Vue específico de la pieza fantasma.

`GamePresentationState` no se amplía (§13). La pieza fantasma es exclusivamente un elemento del canvas de Phaser.

## 20. E2E

Por defecto, **no se toca** `apps/web/e2e/essential-flow.spec.ts` ni `apps/web/playwright.config.ts`. La pieza fantasma:

- no introduce ningún selector DOM nuevo (vive dentro del `<canvas>` de Phaser, no en el DOM de Vue);
- no cambia ningún texto, estado de sesión, botón ni panel observado por el flujo E2E existente;
- no se expone mediante `window`, hooks de test ni ningún atajo del motor para facilitar su verificación en Playwright.

No existe ningún contrato DOM estable y útil derivado de esta tarea que justifique ampliar el E2E (a diferencia, por ejemplo, de los `data-testid` añadidos en `0010` para controles y paneles ya existentes en el DOM). Verificar el canvas por píxeles queda expresamente excluido (§6, §21).

## 21. Pruebas del motor (TDD pragmático)

Aplicar TDD en `packages/game-engine/src/game-engine.test.ts`. Las pruebas deben verificar comportamiento observable, invariantes y contratos, sin depender de detalles internos (nombres exactos de funciones o variables privadas). Como mínimo:

### 21.1 Proyección básica

- Proyección en tablero vacío: `landingCells` cae hasta la última fila del tablero (`BOARD_ROWS - 1`) para la orientación inicial de una pieza recién generada.
- Proyección con bloques fijados: `landingCells` se detiene justo encima de la primera colisión, para al menos un caso con una pila irregular.
- Proyección junto a ambas paredes (columna 0 y columna `BOARD_COLS - 1`).
- Proyección con la pieza rotada (al menos una orientación distinta de `Spawn`).
- Proyección de la pieza `I` (caso de anchura máxima, 4 columnas).
- Proyección de la pieza `O` (caso sin rotación real, comportamiento ya conocido de `0003`).

### 21.2 Casos de reposo y lock delay

- Pieza ya apoyada: `landingCells` es idéntico en contenido a `cells` (celda a celda).
- Pieza durante lock delay (apoyada, con `lockDelayElapsedMs > 0`): `landingCells` sigue siendo idéntico a `cells` en cada snapshot sucesivo mientras la pieza no se mueve, y ni `lockDelayElapsedMs` ni `lockResetsUsed` cambian por el mero hecho de leer `landingCells` repetidamente.

### 21.3 Reactividad a cambios de estado

- Tras un movimiento horizontal válido, `landingCells` refleja la nueva columna en el siguiente snapshot.
- Tras una rotación válida, `landingCells` refleja la nueva orientación y posición (incluido un caso con *wall kick* aplicado) en el siguiente snapshot.

### 21.4 Ausencia

- `landingCells` no existe (`activePiece === null`) inmediatamente tras un `gameOver` por `spawnBlocked`.
- `landingCells` no existe cuando no hay pieza activa (mismo caso que el anterior, verificado explícitamente sobre `snap.activePiece`).

### 21.5 Pureza y no mutación

- Consultar `getSnapshot()` repetidamente (sin llamar a `step()` entre medias) no muta `board`, `activePiece`, `lockDelayElapsedMs`, `lockResetsUsed`, el PRNG ni la cola de eventos.
- `landingCells` (el array y sus celdas) está congelado: un intento de mutación no debe alterar el estado interno del motor ni un snapshot ya devuelto anteriormente.

### 21.6 Equivalencia exacta con hard drop

- La prueba de propiedad/equivalencia descrita en §10, con al menos dos escenarios distintos (por ejemplo, tablero con una pila irregular, y pieza ya cerca del fondo).

### 21.7 Determinismo y reset

- Misma semilla, configuración y secuencia de `StepInput` producen `landingCells` idénticos en cada snapshot comparado entre dos motores independientes.
- `reset()` recalcula `landingCells` de forma coherente con la nueva pieza activa inicial, sin heredar ningún valor de la partida anterior.

## 22. Pruebas web/Phaser

Dado que no existe infraestructura de test para el cuerpo real de `GameScene.renderFrame()` (§4.5, decisión ya tomada en `0007` §20.1: sin mocks de `Graphics`, sin lectura de píxeles), y que esta tarea no introduce ninguna función pura nueva en `apps/web` (la traducción de coordenadas reutiliza `boardXToCanvas`/`boardYToCanvas`/`isRowVisible`, ya cubiertas por `coordinates.test.ts` sin cambios), las pruebas de esta tarea en el lado web se limitan a lo que es real y proporcionado:

- **No se crea ningún archivo de test nuevo para `GameScene.ts`**: sería la primera prueba de renderizado real de la escena, y añadir esa infraestructura únicamente para la pieza fantasma, cuando ni el tablero fijo ni la pieza activa la tienen, ampliaría el alcance de forma desproporcionada respecto de esta tarea.
- **`coordinates.test.ts` no cambia**: no se introduce ninguna función nueva en `coordinates.ts`; la pieza fantasma reutiliza las funciones ya exportadas y ya probadas.
- **`apps/web/src/game/types.test.ts` no cambia**: `GamePresentationState` no se amplía (§13).
- Se confirma explícitamente, como parte del informe de implementación (§17 de este documento), que:
  - la traducción de celdas fantasma a coordenadas de render no introduce lógica nueva más allá de una llamada a funciones ya testeadas;
  - la creación y limpieza de objetos gráficos sigue el ciclo ya existente (`this.graphics.clear()` al inicio de cada `renderFrame()`, sin crear objetos `Graphics` adicionales por celda: se reutiliza la misma instancia `this.graphics` con `fillRect`/`strokeRect`, igual que el tablero y la pieza activa);
  - la actualización al cambiar el snapshot ocurre automáticamente porque `renderFrame()` ya se invoca una vez por frame con el snapshot más reciente;
  - la ocultación sin pieza activa se deriva de que el bloque de dibujo de la fantasma está condicionado a `if (snap.activePiece)`, exactamente como ya lo está el de la pieza activa;
  - no se ha introducido ningún cálculo de colisión, recorrido de filas ni simulación de hard drop en `apps/web` (§17.5).
- Si, durante la implementación, se decide extraer una función pura y pequeña para mapear `landingCells` a un formato intermedio de dibujo (por ejemplo, para evitar repetir el filtro `isRowVisible` dos veces), esa función debe ser trivial, sin nueva lógica de negocio, y puede acompañarse de un test unitario puntual; esto es una decisión de implementación menor, no un requisito de esta especificación.

## 23. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Todos deben finalizar correctamente. El aviso de Vite/Rollup sobre un chunk superior a 500 kB (atribuible a Phaser) puede continuar apareciendo y no bloquea esta tarea.

Además, revisar:

- No existen imports profundos entre paquetes.
- `packages/game-config` no tiene ninguna modificación.
- No se ha ampliado `GamePresentationState` ni se ha tocado el E2E de `0010`.
- No existe código muerto ni una segunda implementación de colisión o de recorrido de filas.
- No hay abstracciones innecesarias ni arquitectura preventiva para tareas futuras (hold, puntuación, sabotajes).
- No se ha ampliado el alcance más allá de §5.
- No hay errores ni avisos de lint ignorados.
- No se han usado scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline durante la implementación (`AGENTS.md`).

## 24. Validación manual requerida

A ejecutar mediante `pnpm dev` antes de declarar la tarea completada:

1. La proyección coincide con el aterrizaje real de la pieza (comparar visualmente la posición de la fantasma con dónde termina la pieza tras un hard drop o tras dejarla caer por gravedad).
2. La fantasma se actualiza inmediatamente al mover la pieza horizontalmente y al rotarla.
3. La fantasma no parpadea entre frames.
4. La fantasma no se confunde con la pieza activa ni con bloques fijados (opacidad claramente distinta).
5. La fantasma desaparece en el instante en que la pieza se fija y reaparece correctamente con la siguiente pieza tras el spawn.
6. La fantasma se comporta correctamente durante la pausa (no se actualiza mientras está pausado, coherente con que el motor no recibe `step()` durante la pausa; `0008`).
7. Reiniciar la partida recalcula la fantasma correctamente para la nueva pieza activa inicial.
8. Un game over no deja ninguna fantasma residual visible.
9. No aparecen errores nuevos en la consola del navegador durante todo el flujo anterior.

## 25. Archivos previstos

- `packages/game-engine/src/index.ts` — campo `landingCells` en `ActivePieceSnapshot`, función interna de derivación, cálculo en `getSnapshot()`.
- `packages/game-engine/src/game-engine.test.ts` — pruebas de §21.
- `apps/web/src/game/scenes/GameScene.ts` — bucle de dibujo de la fantasma en `renderFrame()` (§17).
- `docs/implementation/0011-pieza-fantasma-determinista.md` — informe de implementación (creado al finalizar, no ahora, §26).
- `docs/project-status.md` — actualización de estado (al finalizar, no ahora, §26).

No se prevé la creación de ningún componente Vue nuevo, ni la modificación de `packages/game-config`, `apps/web/src/game/types.ts`, `apps/web/src/game/coordinates.ts`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/components/GameCanvas.vue`, ningún componente de `apps/web/src/components/`, ni `apps/web/e2e/essential-flow.spec.ts`. Si, durante la implementación, se detecta una necesidad real y mínima de tocar alguno de estos archivos, se documenta explícitamente en el informe de implementación junto con su justificación puntual.

## 26. Documentación y cierre futuro

Este documento (`docs/tasks/0011-pieza-fantasma-determinista.md`) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá crear [docs/implementation/0011-pieza-fantasma-determinista.md](../implementation/0011-pieza-fantasma-determinista.md) como informe de implementación independiente, con:

- resumen;
- archivos modificados y creados;
- contrato público elegido (`ActivePieceSnapshot.landingCells`, forma exacta);
- algoritmo (`computeLandingCells`, o el nombre interno equivalente que decida la implementación, documentado explícitamente si difiere);
- relación exacta con hard drop (resultado de la prueba de equivalencia de §10);
- tratamiento de lock delay (confirmación de ausencia de interacción, §11);
- integración Phaser (orden de capas, técnica gráfica, valores de opacidad usados);
- decisiones visuales tomadas durante la implementación, si difieren de los valores orientativos de §17.3;
- pruebas añadidas (motor y web), y por qué;
- número final de tests Vitest y E2E;
- comandos ejecutados y resultados;
- desviaciones respecto de esta especificación, si las hubo, y su justificación;
- deuda técnica identificada;
- validación manual pendiente de confirmación por el usuario, si la hubiera;
- confirmación explícita de la ausencia de las mecánicas excluidas (§6);
- confirmación explícita de que no se hicieron commits durante la implementación.

Y actualizar [docs/project-status.md](../project-status.md): estado de `0011` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y propuesta de siguiente tarea (ver §27).

Esta especificación no crea esos documentos ahora.

## 27. Criterios de aceptación

### Contrato público

- `ActivePieceSnapshot` expone `landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>`, con exactamente 4 celdas cuando existe pieza activa.
- `EngineSnapshot`, `StepInput`, `GameEvent`, `MoveReason` y `GameConfig` no ganan ni pierden ningún campo o valor.
- `GamePresentationState` no cambia.
- No se añade ningún código de error público nuevo.

### Semántica exacta

- `landingCells` conserva el tipo, la orientación y la coordenada `x` de la pieza activa, y su `y` corresponde a la posición de aterrizaje calculada mediante `hardDropDistance`.
- Coincide exactamente, celda a celda, con el tablero resultante de ejecutar un hard drop desde el mismo estado (§10).
- Coincide con `cells` cuando la pieza ya está apoyada.
- No interactúa con `grounded`, `lockDelayElapsedMs` ni `lockResetsUsed`.
- Desaparece exactamente cuando `activePiece` es `null` (sin pieza activa o en `gameOver`).

### Determinismo y pureza

- Misma semilla, configuración y secuencia de `StepInput` producen `landingCells` idénticos.
- Consultar `getSnapshot()` repetidamente no muta ningún estado del motor.
- `landingCells` y sus celdas son de solo lectura.

### Separación motor/Phaser

- `packages/game-engine` sigue sin depender de Phaser, Vue, DOM ni tiempo real.
- `GameScene.ts` no recalcula colisiones, no simula un hard drop y no mantiene estado fantasma propio: lee `landingCells` directamente del snapshot.
- No se amplía `GamePresentationState`.

### Ausencia de alcance adicional

- No existe hold, puntuación, combos, T-Spins, `back-to-back`, energía, sabotajes, batalla, bot, audio, partículas, animaciones, configuración de usuario para la fantasma, ni cambios en la carcasa Tactical, el rival simulado o el E2E de `0010`.
- No se añadió ninguna propiedad de configuración nueva ni ninguna dependencia nueva.
- No se añadió ningún evento público nuevo.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

### Puertas de calidad

- `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan correctamente.
- `git diff --check` no reporta problemas.
- El aviso de chunk de Phaser puede continuar sin bloquear la tarea.

## 28. Próxima tarea

No se fija una `0012` definitiva. Candidatas razonables, a decidir tras validar manualmente la pieza fantasma y revisar `docs/rautfall.md` frente al estado real del proyecto:

- reserva/hold de pieza;
- puntuación y combos;
- el primer sabotaje real (condicionado, como ya señalaba `0010` §22, a decidir antes la mecánica de puntuación/energía real que ese sabotaje presupone).

Esta especificación no prejuzga cuál de ellas será `0012`.
