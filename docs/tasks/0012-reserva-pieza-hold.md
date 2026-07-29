# 0012 — Reserva de pieza / hold

## 1. Estado y precedencia

- **Proyecto:** Rautfall
- **Tarea:** 0012 — Reserva de pieza / hold
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0012`. Las decisiones globales de producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para el motor, la batalla, el bot o los sabotajes pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0012-reserva-pieza-hold.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0012-reserva-pieza-hold.md) (ver §32), siguiendo la convención de rutas de `AGENTS.md`.
- Ninguna especificación anterior (`0001`–`0011`) se modifica como parte de esta tarea. Esta especificación no contradice ninguna de ellas; donde se apoya en un contrato o comportamiento ya fijado por una tarea anterior, lo cita explícitamente y lo conserva sin cambios salvo que se indique lo contrario de forma explícita.

## 2. Objetivo

Añadir la mecánica de **reserva de pieza (hold)** al motor determinista (`packages/game-engine`), con su integración mínima de teclado y de presentación en `apps/web`, siguiendo la regla funcional de referencia ya fijada en [docs/rautfall.md](../rautfall.md) («Reserva y vista previa», §574–580) y en el enunciado de esta tarea (§6 de la petición):

- una pieza activa puede reservarse como máximo una vez;
- si la reserva está vacía, la pieza activa pasa a reserva y entra la primera pieza de `nextPieces`;
- si la reserva contiene una pieza, se intercambia con la activa (sin tocar `nextPieces` ni la bolsa);
- la pieza obtenida desde la reserva reaparece en su orientación y posición iniciales de spawn;
- la reserva vuelve a habilitarse únicamente después de que la pieza activa se fije y aparezca la siguiente pieza por el flujo normal de fijación.

Al terminar la tarea:

- `EngineSnapshot` expone `heldPiece: PieceType | null`, la identidad (solo el tipo, sin geometría mutable) de la pieza actualmente en reserva;
- `ActivePieceSnapshot` expone `holdUsed: boolean`, que indica si la pieza activa actual ya ha consumido su única reserva disponible;
- `StepInput` expone un nuevo campo opcional `hold?: boolean`, con la misma semántica de flanco único por paso que `rotateClockwise`/`rotateCounterclockwise`;
- el motor implementa la lógica completa de la reserva (disponibilidad, primera reserva, intercambio, spawn, reinicio de gravedad/lock delay, atomicidad, determinismo) sin que `apps/web` decida ninguna regla de dominio;
- Phaser captura una tecla nueva (`C`) como flanco único, la traduce a `hold: true` y no contiene ninguna regla sobre cuándo la reserva está disponible ni sobre qué pieza entra o sale de ella;
- Vue muestra el contenido de la reserva (o su hueco vacío) mediante un componente pequeño y provisional, coherente con el marco Tactical Industrial Dramatic ya existente, sin rediseñarlo;
- no se añade puntuación, combos, T-Spins, energía, sabotajes, bot, batalla ni backend.

## 3. Fuentes de verdad

En este orden, según `AGENTS.md`:

1. [AGENTS.md](../../AGENTS.md).
2. [docs/rautfall.md](../rautfall.md) — decisiones de producto citadas explícitamente en esta especificación (§574–580 «Reserva y vista previa», §1682 controles predeterminados, §357 «Elementos pendientes de rediseño», §755 y §1853/§2446 alcance de pruebas y exclusiones).
3. Las especificaciones inmutables de `docs/tasks/`, en particular:
   - [0002 — Motor de juego determinista](0002-motor-de-juego-determinista.md): spawn, colisión, fijación, game over por `spawnBlocked`, eventos base.
   - [0003 — Rotación SRS](0003-rotacion-srs.md): `Orientation`, `PIECE_ORIENTATION_CELLS`, `computeAbsoluteCells`.
   - [0005 — DAS, ARR y soft drop](0005-das-arr-soft-drop.md): contrato `StepInput` con campos `Held`/`Pressed`, validación estricta sin coerción.
   - [0006 — Lock delay y fijación diferida](0006-lock-delay-fijacion-diferida.md): `isGrounded`, `lockDelayElapsedMs`, `lockResetsUsed`, orden del paso lógico vigente.
   - [0007 — Cola de próximas piezas y preview técnico](0007-cola-proximas-piezas-preview-tecnico.md): `nextPieces`, `getPieceShape`, precedente de ampliación de `GamePresentationState`, precedente de migración exhaustiva de consumidores reales.
   - [0008 — Pausa, reanudación y reinicio coordinados](0008-pausa-reanudacion-reinicio-coordinados.md): la pausa pertenece a la capa web; el motor no la conoce; drenaje de teclas durante pausa.
   - [0011 — Pieza fantasma determinista](0011-pieza-fantasma-determinista.md): `landingCells`, patrón de campo derivado dentro de `ActivePieceSnapshot`, precedente de no ampliar `GamePresentationState` cuando no aporta valor real (aquí sí aporta valor, ver §24).
4. Los informes de `docs/implementation/` correspondientes a las tareas citadas, para confirmar el estado real tras cada tarea (no solo lo especificado).
5. El estado real del código y Git, confirmado por lectura directa (§4):
   - `packages/game-engine/src/index.ts` (1166 líneas).
   - `packages/game-engine/src/game-engine.test.ts` (43 bloques `describe`, incluidos diez de lock delay y uno de pieza fantasma).
   - `packages/game-config/src/index.ts`.
   - `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/input-buffer.ts`, `apps/web/src/game/input-release-guard.ts`, `apps/web/src/game/session-status.ts`.
   - `apps/web/src/App.vue`, `apps/web/src/components/NextPiecesPreview.vue`.
   - `apps/web/e2e/essential-flow.spec.ts`.
   - `docs/project-status.md` (321 tests Vitest, 1 test E2E, working tree limpio en el momento de redactar esta especificación).

## 4. Contexto técnico heredado (inspección previa)

Confirmado por lectura directa del código real, no por suposición.

### 4.1 Representación actual de la pieza activa

`ActivePieceSnapshot` (`packages/game-engine/src/index.ts:54-64`):

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

Internamente, la pieza activa es `{ type, x, y, orientation }` (tipo privado `ActivePiece`). No existe hoy ningún campo relativo a reserva.

### 4.2 `nextPieces` y seven-bag

- `nextPiecesQueue: PieceType[]` es la cola interna mutable, siempre de longitud 3 mientras el motor existe (`0007`).
- `spawnNextPiece()` (índice 634-660): extrae `nextPiecesQueue.shift()` como candidata, repone con `nextPiecesQueue.push(nextFromBag(bagState, prng))`, calcula spawn, activa o finaliza partida.
- La bolsa de siete (`bagState`, `nextFromBag`) es la única fuente de piezas nuevas; no existe ningún generador paralelo.
- `getSnapshot()` expone `nextPieces: Object.freeze([...nextPiecesQueue])` (copia defensiva, índice 991).

### 4.3 `EngineSnapshot` y `StepInput` reales

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
}>;

export type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};
```

Dato clave para el diseño del nuevo campo de entrada (§9): `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed`, `softDropHeld` y `hardDrop` son **obligatorios**, sin coerción ni valor por defecto (`validateInput` los exige explícitamente). `rotateClockwise` y `rotateCounterclockwise` son **opcionales**, con `false` como valor efectivo cuando están ausentes; esta distinción ya existe en el contrato vigente desde `0002` (obligatorios) y `0003` (opcionales, para no reescribir cientos de literales `StepInput` de `0002` al añadir la rotación). Esta tarea reutiliza el patrón opcional (§9).

### 4.4 Orden lógico vigente del paso (`processStep`, índice 850-936)

```text
1. Comprobar estado del motor (ENGINE_NOT_RUNNING)         — en step(), antes de processStep
2. Validar entrada (INVALID_GAME_INPUT)                     — en step(), antes de processStep
3. Incrementar contador de paso                              — en step()
4. Incrementar tiempo lógico                                 — en step()
5. Movimiento horizontal (processHorizontal)                 — processStep
6. Rotación (tryRotate)                                       — processStep
7. Hard drop (fija, elimina líneas, spawnea, return)          — processStep
8. Gravedad o soft drop (processVertical, solo si no hubo 7)  — processStep
9. Detección final de apoyo y avance de lock delay (puede fijar y spawnear) — processStep
```

Puntos de retorno anticipado ya existentes: el límite de reinicios de lock delay alcanzado durante el movimiento horizontal (paso 5) o la rotación (paso 6) invoca `lockAndProcess()` y detiene el resto del paso; el hard drop (paso 7) siempre detiene el resto del paso; la expiración del temporizador de lock delay (paso 9) también invoca `lockAndProcess()`. En todos los casos, tras `lockAndProcess()`/`spawnNextPiece()`, la pieza recién spawneada **no** recibe gravedad ni avance de lock delay en el mismo paso en que apareció: eso ocurre en el siguiente `step()`. Esta tarea reutiliza exactamente esta misma invariante para la pieza que entra por hold (§16, §18).

### 4.5 Validación de entrada (`validateInput`, índice 1051-1147)

Rechaza con `EngineStepError('INVALID_GAME_INPUT', …)`, sin mutar nada:

- propiedades desconocidas (lista blanca explícita `allowedKeys`);
- campos obligatorios ausentes o de tipo incorrecto;
- `leftPressed`/`rightPressed` sin su `Held` correspondiente;
- `leftPressed` y `rightPressed` simultáneos;
- `rotateClockwise` y `rotateCounterclockwise` simultáneos (ambos `true`);
- tipo incorrecto de `rotateClockwise`/`rotateCounterclockwise` cuando están presentes.

Ningún movimiento u acción no ejecutable (movimiento horizontal bloqueado, rotación sin wall kick válido) produce error ni evento: son **entradas válidas que el motor decide no ejecutar**, sin mutación ni excepción. Esta es la distinción clave para resolver la decisión pendiente de §11.4.

### 4.6 Adaptación de teclado en Phaser (`GameScene.ts`, `input-buffer.ts`)

- `GameScene.cursors` mapea teclas físicas a `Phaser.Input.Keyboard.Key`: `left`, `right`, `up` (rotación horaria), `down` (soft drop), `space` (hard drop), `z` (rotación antihoraria), `r` (reinicio), `esc` (pausa). No existe hoy ninguna tecla de reserva.
- `KeyState` (`input-buffer.ts`) nombra sus campos de flanco según la **tecla física** (`justPressedUp`, `justPressedZ`, `justPressedSpace`), no según la acción de dominio; el propio `StepInput` sí nombra sus campos según la acción de dominio (`rotateClockwise`, `hardDrop`). Esta tarea sigue ambas convenciones para sus respectivos contratos (§23).
- `buildStepInput()` traduce cada flanco de `KeyState` a su campo de `StepInput` correspondiente exactamente una vez por fotograma, mediante el mecanismo `consumedThisFrame`, y no contiene ninguna lógica de repetición, prioridad de reserva ni reglas de disponibilidad.
- El guardián de liberación (`input-release-guard.ts`) neutraliza **exclusivamente** `left`, `right` y `softDrop` (teclas de estado mantenido con implicaciones de DAS/ARR) durante transiciones de pausa/reinicio; las teclas de flanco único (`up`, `z`, `space`, y ahora `c`) no lo necesitan, porque `Phaser.Input.Keyboard.JustDown` ya no dispara para una tecla que estaba físicamente pulsada antes de crear/reactivar la escena.
- Durante la pausa, `readKeys()` se invoca para drenar flancos (su valor se descarta) y ningún `StepInput` llega al motor (`0008`).

### 4.7 Representación lateral en el marco visual

`App.vue` ya contiene una `.tactical-console` con secciones separadas por `.console-divider`: previsualización de próximas piezas (`NextPiecesPreview`), estado de sesión, controles y acciones, y panel de combate simulado (`CombatStatusPanel`). `NextPiecesPreview.vue` es el precedente directo de cómo mostrar piezas en reposo: usa `getPieceShape()` de `@rautfall/game-engine`, sin geometría propia, con una rejilla CSS por pieza.

### 4.8 Cobertura actual de Playwright

`apps/web/e2e/essential-flow.spec.ts` cubre: carga de la aplicación, estado inicial `running`, presencia de tres próximas piezas y paneles simulados, pausa, reanudación y reinicio, todo mediante controles reales de la interfaz (botones) y `data-testid`. No ejercita ninguna tecla de teclado ni ninguna acción de dominio (movimiento, rotación, hard drop): la cobertura de mecánicas de juego vive en las pruebas de motor (Vitest), no en Playwright.

## 5. Alcance incluido

- Ampliación de `StepInput` con `hold?: boolean` (§9).
- Ampliación de `EngineSnapshot` con `heldPiece: PieceType | null` (§8).
- Ampliación de `ActivePieceSnapshot` con `holdUsed: boolean` (§8).
- Implementación completa de la lógica de reserva en `packages/game-engine/src/index.ts`: disponibilidad, primera reserva, intercambio, spawn de la pieza recuperada, reinicio de gravedad/lock delay, atomicidad, determinismo (§11–§18).
- Nuevo evento de dominio `pieceHeld` (§20).
- Migración de todo consumidor real de `EngineSnapshot`/`StepInput`/`ActivePieceSnapshot` afectado por los campos nuevos (obligatorio: `GamePresentationState`, literales de test existentes que construyen `StepInput` u objetos `GamePresentationState`) (§21, §27, §29).
- Captura de teclado en Phaser para la tecla `C` como flanco único, sin lógica de dominio (§23).
- Componente Vue pequeño y provisional que muestra el contenido de la reserva (o su hueco vacío), integrado en la `.tactical-console` existente (§24).
- Pruebas de motor (TDD pragmático) que cubren todas las reglas fijadas en esta especificación (§26).
- Pruebas web mínimas para los cambios reales de `apps/web` (§27).
- Una única ampliación puntual y justificada del E2E existente, si aporta valor real (§28).

## 6. Alcance explícitamente excluido

No pertenece a `0012`:

- Puntuación, combos, T-Spins, `back-to-back`.
- Energía de combate y sabotajes (incluidos los controles `A`/`S` de `docs/rautfall.md`).
- Batalla, bot, multijugador local, backend, persistencia.
- Audio, partículas, animaciones (incluida cualquier animación de la reserva al usarse).
- Remapeo de controles, detección de teclas duplicadas, restauración de valores predeterminados: los controles siguen siendo fijos en código, igual que todos los ya existentes (`ArrowLeft/Right/Up/Down`, `Z`, `Space`, `R`, `Esc`).
- Uso de `Shift` como tecla alternativa de reserva (`docs/rautfall.md` ofrece «`C` o `Shift`» como opciones equivalentes; esta tarea fija una única tecla, `C`, ver §23.2). No se implementa una segunda tecla ni una preferencia configurable entre ambas.
- Más de una ranura de reserva (no hay «banco» de varias piezas).
- Cualquier límite de usos de reserva por partida, combo o cooldown temporal más allá de la regla «una vez por pieza activa» ya fijada.
- Cambios en el tamaño, número o algoritmo de la bolsa de siete, o en `nextPieces` más allá de su interacción exacta con el hold (§14).
- Cambios en `packages/game-config`: la reserva no introduce ningún parámetro configurable (no hay temporización, no hay coste, no hay duración).
- Rediseño del marco Tactical Industrial Dramatic, del monitor rival o del panel de combate simulado.
- Nuevas propiedades de configuración de usuario (activar/desactivar reserva, opacidad, color).
- Ampliación general del E2E más allá de lo estrictamente justificado en §28.
- Cualquier funcionalidad prevista en `docs/rautfall.md` no listada en §5.

## 7. Terminología y modelo conceptual

- **Reserva (hold):** acción de dominio que intercambia la pieza activa actual con el contenido de una única ranura de reserva, o almacena la pieza activa si la ranura está vacía.
- **Ranura de reserva (`heldPiece`):** almacén de identidad de pieza, de capacidad exactamente uno, representado como `PieceType | null`. No almacena posición, orientación ni celdas: solo el tipo de pieza (§7.1).
- **Disponibilidad de reserva (`holdUsed`):** propiedad de la pieza activa concreta, no de la partida en su conjunto. Cada pieza activa nace con `holdUsed = false` cuando aparece por el flujo normal de fijación (spawn tras `lockAndProcess`), y pasa a `holdUsed = true` en el instante en que ella misma resulta de una reserva. Una vez `holdUsed = true`, esa pieza activa concreta no puede volver a reservar mientras siga siendo la pieza activa.
- **Pieza saliente:** la pieza activa en el momento de solicitar la reserva; se convierte en el nuevo contenido de `heldPiece`.
- **Pieza entrante:** la pieza que pasa a ser la nueva pieza activa como resultado de la reserva: la primera de `nextPieces` (ranura vacía) o el contenido previo de `heldPiece` (ranura ocupada).

### 7.1 Por qué solo se almacena el tipo

Se exige explícitamente (petición de la tarea, criterios de diseño) no almacenar geometría mutable de la pieza reservada. La pieza reservada nunca se dibuja «en el tablero»: solo existe como una pieza en reposo, igual que cada elemento de `nextPieces`. Ninguna operación del motor necesita la posición, orientación o celdas de la pieza mientras está en reserva: al recuperarse, siempre reaparece en su orientación y posición iniciales de spawn (§15), calculadas de nuevo en ese momento con las mismas funciones ya existentes (`calculateSpawnX`, `calculateSpawnY`, `Orientation.Spawn`). Guardar algo más que el `PieceType` sería estado redundante sin ningún consumidor real, exactamente el mismo razonamiento ya aplicado en `0007` a `nextPieces` (que tampoco almacena geometría, solo `PieceType`).

## 8. Cambios exactos del contrato público del motor

### 8.1 `EngineSnapshot`

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;          // ← nuevo, esta tarea
}>;
```

#### Alternativas evaluadas para la ubicación de `heldPiece`

- **Dentro de `ActivePieceSnapshot`.** Descartada: `heldPiece` no es una propiedad de la pieza activa concreta (no varía con cada nueva pieza activa; sobrevive a múltiples spawns sin cambiar hasta el siguiente hold), a diferencia de `landingCells` (`0011`, ligada 1:1 a la pieza activa) o de `holdUsed` (§8.2, que sí es 1:1 con la pieza activa). Anidarlo bajo `ActivePieceSnapshot` lo haría desaparecer artificialmente cuando `activePiece === null` (por ejemplo en `gameOver`), rompiendo la utilidad diagnóstica ya establecida para `nextPieces` en ese mismo estado (`0007` §12).
- **Nivel superior de `EngineSnapshot`.** Adoptada: mismo patrón exacto que `nextPieces` (`0007` §7.2), un dato de dominio independiente de la pieza activa concreta, visible también en `gameOver` por la misma razón diagnóstica.

### 8.2 `ActivePieceSnapshot`

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
  holdUsed: boolean;                    // ← nuevo, esta tarea
}>;
```

#### Alternativas evaluadas para el nombre y la ubicación de `holdUsed`

- **`EngineSnapshot.holdAvailable: boolean` a nivel superior.** Descartada: mezclaría, en un mismo booleano de nivel superior, dos preguntas distintas («¿existe pieza activa?» y «¿puede reservar?»), obligando a un caso especial cuando `activePiece === null` (¿`true`, `false`, o no debería existir el campo?). `lockDelayElapsedMs` y `lockResetsUsed` ya resuelven exactamente este mismo problema anidándose en `ActivePieceSnapshot` (`0006`): cuando no hay pieza activa, la pregunta «¿puede reservar/reiniciar el lock delay?» deja de tener sentido, y `ActivePieceSnapshot === null` ya lo expresa sin ningún caso especial adicional.
- **`ActivePieceSnapshot.holdAvailable: boolean`** (polaridad positiva). Semánticamente equivalente a `holdUsed` negado. Se descarta por convención de nomenclatura: `lockResetsUsed` ya establece el patrón «`<recurso>Used`» para contadores/marcas de consumo ligados a la pieza activa; `holdUsed` es consistente con ese precedente y evita que un consumidor tenga que negar un booleano para saber si ya se gastó la reserva (`!snapshot.activePiece.holdUsed` sería el equivalente exacto, pero `holdAvailable` obligaría a la doble negación inversa en el propio motor al fijarlo a `true` tras un hold).
- **`ActivePieceSnapshot.holdUsed: boolean`.** Adoptada: anidado exactamente igual que `lockDelayElapsedMs`/`lockResetsUsed`, se reinicia a `false` en cada spawn normal (§15) y se fuerza a `true` en cada spawn resultante de un hold (§11, §13), sin ambigüedad y sin caso especial cuando no hay pieza activa.

### 8.3 `GameEvent`

Se añade un único caso nuevo a la unión discriminada:

```ts
export type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | { type: 'linesCleared'; step: number; lines: number; lineIndices: readonly number[] }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation }
  | { type: 'pieceHeld'; step: number; piece: PieceType };   // ← nuevo, esta tarea
```

`piece` reporta el tipo de la **pieza saliente** (la que se acaba de guardar en la ranura de reserva), siguiendo la misma convención que `pieceLocked.piece` (reporta la pieza que se acaba de fijar, no la que aparece después). No se añade ningún campo adicional (por ejemplo, la pieza entrante): ese dato ya queda cubierto, sin duplicación, por el evento inmediatamente posterior (`pieceSpawned.piece` si el spawn es válido, o por el propio `gameOver` si está bloqueado), exactamente el mismo principio de no duplicación ya aplicado en `0011` §7.4.

`GameOverReason` **no** gana ningún valor nuevo: un hold cuya pieza entrante no puede aparecer reutiliza `'spawnBlocked'` sin cambios (§17), porque es exactamente la misma situación de dominio (una pieza no puede ocupar su celda de spawn) que ya cubre ese motivo desde `0002`.

`MoveReason` no cambia: la reserva nunca emite `pieceMoved` (ni la pieza saliente ni la entrante se mueven; la entrante aparece directamente en su posición de spawn, igual que cualquier `pieceSpawned`).

## 9. Cambios exactos de `StepInput`

```ts
export type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
  hold?: boolean;                      // ← nuevo, esta tarea
};
```

### 9.1 Nombre del campo

Alternativas evaluadas: `hold`, `holdPressed`, `holdRequested`, `swapHold`.

- `holdPressed`/`holdRequested` se descartan por inconsistencia con el precedente más cercano: `rotateClockwise`/`rotateCounterclockwise` (acciones de flanco único, sin contrapartida «mantenida») no llevan sufijo `Pressed`; solo lo llevan `leftPressed`/`rightPressed`, precisamente porque **sí** existe una contrapartida mantenida (`leftHeld`/`rightHeld`) de la que hay que distinguirse. La reserva, igual que la rotación y el hard drop, no tiene una noción de «mantener reserva»: no existe ambigüedad que resolver con un sufijo.
- `swapHold` se descarta: describe solo uno de los dos comportamientos posibles (intercambio), no el caso de ranura vacía (que no es un intercambio, es un primer almacenamiento).
- `hold` es el nombre más corto y directo, consistente con `hardDrop` (también un sustantivo/verbo de acción sin sufijo, que dispara una acción de dominio completa en un único paso) y con el término de producto ya usado en `docs/rautfall.md` («Reserva»/«hold» son el mismo concepto en castellano/inglés, igual que `hard drop`/`soft drop`).

Se adopta **`hold`**.

### 9.2 Obligatoriedad

Se adopta **opcional** (`hold?: boolean`, valor efectivo `false` cuando está ausente), siguiendo el mismo patrón ya establecido para `rotateClockwise`/`rotateCounterclockwise` en `0003`, y por la misma razón práctica: `packages/game-engine/src/game-engine.test.ts` contiene ya varios miles de literales `StepInput` (43 bloques `describe`) que no conocen `hold`; si el campo fuera obligatorio, cada uno de esos literales necesitaría ampliarse solo para satisfacer el tipo, sin ningún valor añadido a la prueba que ese literal ejercita. Hacerlo opcional evita esa reescritura masiva e improductiva, exactamente la motivación que ya llevó a hacer opcionales `rotateClockwise`/`rotateCounterclockwise` en su momento.

### 9.3 Validación (`validateInput`)

- `'hold'` se añade a la lista blanca `allowedKeys`.
- Si `'hold' in obj`, debe ser `boolean`; si no lo es, `EngineStepError('INVALID_GAME_INPUT', …)`, sin mutar nada (mismo patrón que la comprobación ya existente para `rotateClockwise`).
- **No se añade ninguna regla de incompatibilidad estructural** entre `hold` y ningún otro campo (`leftPressed`, `rightPressed`, `hardDrop`, `rotateClockwise`, `rotateCounterclockwise`, `softDropHeld`). La combinación de `hold: true` con cualquier otro campo en `true` en el mismo `StepInput` es **entrada válida**; su resolución es de precedencia procedimental dentro de `processStep`, no de rechazo en `validateInput` (§18, §19). Esto es coherente con el contrato ya vigente: `leftPressed`/`hardDrop` simultáneos, por ejemplo, ya son válidos hoy (el movimiento horizontal se aplica y después el hard drop cae desde la nueva columna); el motor ya resuelve combinaciones de acciones por orden de procesamiento, no por rechazo de entrada, salvo en los casos explícitamente ambiguos ya fijados (`leftPressed`+`rightPressed`, `rotateClockwise`+`rotateCounterclockwise`), que no son el caso de `hold`.

## 10. Estado interno necesario

Dentro de `createGameEngine`, junto a las variables mutables ya existentes (`activePiece`, `nextPiecesQueue`, `lockDelayElapsedMs`, etc.):

```ts
let heldPiece: PieceType | null = null;
let holdUsed = false;
```

- `heldPiece` vive al mismo nivel que `activePiece`/`nextPiecesQueue`: una variable mutable privada del motor, nunca expuesta directamente (siempre copiada por valor a `EngineSnapshot.heldPiece`, que ya es inmutable por ser `PieceType | null`, un primitivo o `null`, sin necesidad de `Object.freeze` adicional).
- `holdUsed` se reinicia exactamente en los mismos puntos donde ya se reinician `lockDelayElapsedMs`/`lockResetsUsed` (`spawnInitialPieces`, `spawnNextPiece`, `reset()`), a `false`, **salvo** en el spawn provocado por un hold, donde se fija a `true` (§11, §13, §15).
- No se introduce ningún temporizador, contador de usos por partida, ni estructura de datos adicional (por ejemplo, ninguna «cola de reserva»): la ranura tiene capacidad exactamente uno, representable con una única variable `PieceType | null`.

## 11. Reglas de disponibilidad del hold

### 11.1 Regla general

Una solicitud de reserva (`input.hold === true`) se **ejecuta** si y solo si:

1. existe pieza activa (`activePiece !== null` — invariante ya garantizada mientras `status === 'running'`, ver §11.3); y
2. `holdUsed === false` para esa pieza activa.

Si ambas condiciones se cumplen, se ejecuta la reserva completa (§12 o §13, según el contenido de `heldPiece`) y el paso termina inmediatamente (§18): no se procesan movimiento horizontal, rotación, hard drop ni gravedad/soft drop en ese mismo paso.

### 11.2 Solicitud no disponible: se ignora, no se rechaza

Si `input.hold === true` pero `holdUsed === true`, la solicitud de hold se ignora silenciosamente: no modifica `heldPiece` ni `holdUsed`, no consume `nextPieces`. bolsa o PRNG, no emite `pieceHeld` y no lanza ningún error. El paso lógico continúa con normalidad, incluyendo el avance de `step`, `elapsedMs` y el procesamiento de las demás acciones.

- no muta ningún estado;
- no emite ningún evento;
- no lanza ningún error;
- el resto del paso (movimiento horizontal, rotación, hard drop, gravedad/soft drop, lock delay) se procesa exactamente como si `input.hold` hubiera sido `false` o estuviera ausente.

Esta decisión es la aplicación directa, a la reserva, del mismo criterio que el motor ya usa para cualquier acción de dominio válida pero no ejecutable: un movimiento horizontal bloqueado por colisión no lanza error ni emite evento, simplemente no ocurre (§4.5); una rotación sin wall kick válido tampoco. `hold` con `holdUsed === true` es estructuralmente idéntico: entrada bien formada (`INVALID_GAME_INPUT` no aplica, §9.3), pero acción no ejecutable en el estado actual del dominio. Se descarta deliberadamente tratarlo como error (`EngineStepError` nuevo o reutilizado) porque introduciría una asimetría injustificada frente a los demás casos de «acción solicitada pero no ejecutable» ya presentes en el motor, obligando a Phaser a capturar una excepción por una situación que ni siquiera es excepcional (pulsar la tecla de reserva mientras no está disponible es una interacción normal y esperada del jugador).

### 11.3 Caso imposible: sin pieza activa mientras `running`

`activePiece` solo es `null` simultáneamente con `status === 'gameOver'` (invariante ya vigente desde `0002`/`0007`: cualquier transición que deje `activePiece = null` fija `status = 'gameOver'` en la misma operación). Por tanto, mientras `status === 'running'`, `activePiece` nunca es `null`, y `step()` ya lanza `EngineStepError('ENGINE_NOT_RUNNING', …)` antes de procesar cualquier campo de `input` cuando `status === 'gameOver'` (comprobación ya existente, primer paso de `step()`). No existe ningún estado observable en el que `processStep` deba decidir qué hacer con `input.hold` sin pieza activa: esta especificación no introduce ninguna rama de código para ese caso porque el caso no puede ocurrir dado el contrato ya vigente.

### 11.4 Resumen de la decisión pendiente (ignorar vs. rechazar)

Fijado explícitamente: una solicitud de hold no disponible **se ignora**, coherente con el tratamiento ya vigente de movimientos y rotaciones no ejecutables. No se rechaza con excepción.

## 12. Regla de primera reserva con hueco vacío

Cuando `heldPiece === null` y el hold se ejecuta (§11.1):

1. La pieza saliente es `activePiece.type` (la pieza activa actual, antes de cualquier cambio).
2. La pieza entrante es `nextPieces[0]` (candidata extraída del frente de la cola), exactamente como en cualquier spawn normal tras fijación (`0007` §10, paso 1).
3. La cola se repone con una nueva pieza de la bolsa de siete (`nextPiecesQueue.push(nextFromBag(bagState, prng))`), exactamente como en cualquier spawn normal (`0007` §10, paso 2). Este es el **único** caso de hold que consume una pieza de la bolsa (§14).
4. `heldPiece` se fija a la pieza saliente (paso 1).
5. Se emite `pieceHeld { piece: <pieza saliente> }` (§20), incondicionalmente, en cuanto la ranura se ha actualizado, independientemente de si el spawn de la pieza entrante (paso siguiente) resulta válido o bloqueado.
6. Se intenta el spawn de la pieza entrante en su posición y orientación iniciales (§15). Si es válido, se activa con `holdUsed = true` y se emite `pieceSpawned`; si está bloqueado, se finaliza la partida (§17).

Pseudocódigo (rama de ranura vacía):

```text
function performHoldFromEmpty():
  outgoing = activePiece.type
  incoming = nextPieces.shift()                   // extraer candidata del frente
  nextPieces.push(nextFromBag(bag, prng))          // reponer cola (único consumo de bolsa del hold)

  heldPiece = outgoing
  emit pieceHeld { piece: outgoing }

  attemptIncomingSpawn(incoming)                    // ver §15, común a ambas ramas
```

## 13. Regla de intercambio con reserva ocupada

Cuando `heldPiece !== null` y el hold se ejecuta (§11.1):

1. La pieza saliente es `activePiece.type`.
2. La pieza entrante es el contenido actual de `heldPiece`.
3. **No se toca `nextPieces` ni la bolsa de siete en absoluto**: ni se extrae, ni se repone, ni se consume ningún PRNG (§14, confirmación explícita exigida por la petición de la tarea).
4. `heldPiece` se fija a la pieza saliente (paso 1), sustituyendo su valor anterior (que ya se ha capturado como pieza entrante en el paso 2).
5. Se emite `pieceHeld { piece: <pieza saliente> }`, con las mismas reglas de incondicionalidad que en §12, paso 5.
6. Se intenta el spawn de la pieza entrante (§15), idéntico en todo a la rama de ranura vacía salvo en el origen de la pieza entrante y en la ausencia de interacción con la cola/bolsa.

Pseudocódigo (rama de intercambio):

```text
function performHoldSwap():
  outgoing = activePiece.type
  incoming = heldPiece                              // sin tocar nextPieces ni la bolsa

  heldPiece = outgoing
  emit pieceHeld { piece: outgoing }

  attemptIncomingSpawn(incoming)                    // ver §15, común a ambas ramas
```

## 14. Interacción con `nextPieces` y seven-bag

- **Ranura vacía → primera reserva:** consume exactamente una pieza de `nextPieces[0]` y repone la cola con exactamente una nueva pieza de la bolsa (mismo coste de bolsa/PRNG que un spawn normal tras fijación, `0007` §10/§14). El resto de `nextPieces` se desplaza en el mismo sentido que ya lo hace `spawnNextPiece` (lo que era `nextPieces[1]` pasa a `nextPieces[0]`, etc.).
- **Ranura ocupada → intercambio:** no consume ninguna pieza de `nextPieces`, no invoca `nextFromBag`, no avanza el PRNG ni el índice de la bolsa. `nextPieces` permanece exactamente igual, en contenido y en orden, antes y después del intercambio.
- No existe una segunda fuente de aleatoriedad ni una cola paralela para la reserva: la única pieza que puede «aparecer nueva» a causa de un hold es la que ya estaba en `nextPieces[0]` (rama de ranura vacía); la reserva en sí nunca genera una pieza nueva de la nada.
- El orden de consumo de la secuencia compartida (semilla + bolsa de siete) **no se altera** por el uso de la reserva: guardar una pieza y recuperarla más tarde no le hace «saltarse turno» respecto de la secuencia ya determinada por la bolsa; solo cambia **cuándo** esa pieza concreta se convierte en activa, exactamente la afirmación ya fijada en `docs/rautfall.md` §577 («Reservar no alterará el orden de la secuencia compartida; únicamente modifica cuándo se utiliza una pieza ya obtenida»).

## 15. Reglas de spawn de la pieza obtenida

Común a ambas ramas (§12, §13), función compartida `attemptIncomingSpawn(incoming: PieceType)`:

```text
function attemptIncomingSpawn(incoming):
  spawnX = calculateSpawnX(incoming)                // función ya existente, sin cambios
  spawnY = calculateSpawnY(incoming)                // función ya existente, sin cambios
  cells  = computeAbsoluteCells(incoming, spawnX, spawnY, Orientation.Spawn)  // sin cambios

  if isCollision(board, cells):                      // función ya existente, sin cambios
    status = 'gameOver'
    activePiece = null
    emit gameOver { reason: 'spawnBlocked' }
    return                                            // el paso termina aquí (ver §18)

  activePiece = { type: incoming, x: spawnX, y: spawnY, orientation: Orientation.Spawn }
  holdUsed = true                                     // ← distinto de un spawn normal (holdUsed = false)
  resetHorizontalState(horizontalState)                // idéntico a un spawn normal
  verticalProgress = 0                                 // idéntico a un spawn normal
  lockDelayElapsedMs = 0                               // idéntico a un spawn normal
  lockResetsUsed = 0                                   // idéntico a un spawn normal
  emit pieceSpawned { piece: incoming }
```

- **Orientación y posición:** la pieza entrante reaparece siempre en `Orientation.Spawn`, en las mismas coordenadas (`calculateSpawnX`/`calculateSpawnY`) que cualquier pieza que spawnea por primera vez o tras una fijación. No existe ninguna variante de spawn específica de la reserva: se reutilizan literalmente las mismas dos funciones ya existentes, sin duplicarlas ni modificarlas.
- **`holdUsed` en la pieza entrante:** se fija a `true`, no a `false`. Esta es la diferencia esencial frente a un spawn normal (`spawnNextPiece`, que fija `holdUsed = false`): impide que la pieza recién obtenida por hold pueda, en el mismo instante, reservar de nuevo (encadenar reserva→intercambio→reserva→intercambio indefinidamente en el mismo paso o en pasos sucesivos sin haber fijado ninguna pieza real). `holdUsed` solo vuelve a `false` cuando esta pieza, ya activa, se fija por el flujo normal (`lockAndProcess` → `spawnNextPiece`) y aparece la siguiente pieza (§11 del objetivo, §22).
- **Colisión bloqueada:** si la pieza entrante no puede ocupar su celda de spawn, el resultado es idéntico en forma al de cualquier `spawnBlocked` ya existente (`status = 'gameOver'`, `activePiece = null`, evento `gameOver` con motivo `'spawnBlocked'`, sin `pieceSpawned`). La actualización de `heldPiece` (§12/§13, paso 4) **ya ha ocurrido** antes de intentar este spawn y **no se revierte**: la reserva se considera consumida/completada independientemente del resultado del spawn, exactamente el mismo principio ya fijado en `0007` §11 para la candidata de `nextPieces` en un `spawnBlocked` normal («la candidata se considera consumida», no se revierte ni se repite).

## 16. Interacción con gravedad y lock delay

- La pieza entrante nace con `verticalProgress = 0`, `lockDelayElapsedMs = 0` y `lockResetsUsed = 0`, exactamente igual que cualquier pieza recién spawneada (`0005`/`0006`), sin ningún tratamiento especial.
- Al terminar el paso en el que ocurrió el hold, la pieza entrante **no** recibe gravedad ni avance de lock delay en ese mismo paso: el hold, igual que el hard drop y que cualquier fijación por límite de reinicios o por expiración del temporizador, termina el procesamiento del paso inmediatamente después de spawnear (o de fallar el spawn) (§18). La gravedad y el lock delay de la nueva pieza empiezan a evaluarse a partir del siguiente `step()`, exactamente el mismo comportamiento ya vigente para cualquier pieza recién spawneada tras una fijación.
- `grounded` se deriva, como siempre, de `isGrounded(board, activePiece)` en el momento de `getSnapshot()`: para la pieza entrante recién aparecida, normalmente será `false` (salvo una pila muy alta que deje la celda de spawn ya apoyada), sin ninguna regla adicional.

## 17. Interacción con pieza fantasma

`landingCells` (`0011`) es un campo puramente derivado dentro de `ActivePieceSnapshot`, calculado en cada `getSnapshot()` a partir de `board` y de la posición/orientación/tipo actuales de `activePiece`, sin caché ni estado persistente. Tras un hold válido:

- la pieza fantasma se recalcula automáticamente en la siguiente llamada a `getSnapshot()` (incluida la que ocurre en el mismo `step()` que disparó el hold, si el llamador consulta el snapshot después), reflejando la proyección de la nueva pieza activa (la entrante), sin ningún cambio en `computeLandingCells`/`hardDropDistance`/`computeAbsoluteCells`.
- no se requiere ninguna modificación de `packages/game-engine` relativa a la pieza fantasma: esta tarea no toca `landingCells` ni su algoritmo.
- Phaser sigue leyendo `snapshot.activePiece.landingCells` directamente, sin ningún cambio de integración causado por esta tarea (§23): tras un hold, `renderFrame()` ya dibuja la fantasma de la nueva pieza activa en el siguiente fotograma, exactamente igual que tras cualquier spawn.

## 18. Orden lógico exacto dentro de `step()`

El hold se procesa **antes** de cualquier otra acción del paso, con prioridad absoluta:

```text
1. Comprobar estado del motor (ENGINE_NOT_RUNNING)          — sin cambios, en step()
2. Validar entrada (INVALID_GAME_INPUT)                       — ampliada con 'hold' (§9.3), en step()
3. Incrementar contador de paso                                — sin cambios, en step()
4. Incrementar tiempo lógico                                   — sin cambios, en step()
5. Reserva (hold)                                               — NUEVO, primer paso de processStep
   — si input.hold !== true: no hace nada, continuar en 6
   — si input.hold === true y holdUsed === true: ignorar (§11.2), continuar en 6
   — si input.hold === true y holdUsed === false: ejecutar §12 o §13 + §15,
     y TERMINAR el paso inmediatamente (no se procesan 6-10)
6. Movimiento horizontal (processHorizontal)                   — renombrado, antes paso 5
7. Rotación (tryRotate)                                         — renombrado, antes paso 6
8. Hard drop                                                     — renombrado, antes paso 7
9. Gravedad o soft drop (processVertical, solo si no hubo 8)     — renombrado, antes paso 8
10. Detección final de apoyo y avance de lock delay              — renombrado, antes paso 9
```

### 18.1 Justificación de la prioridad absoluta

Cuando el hold se ejecuta, la pieza activa sobre la que se estaban a punto de aplicar movimiento/rotación/hard drop/gravedad **deja de ser la pieza activa** en el mismo paso: pasa a `heldPiece` y es sustituida por la pieza entrante. Aplicar movimiento horizontal o rotación a una pieza que va a desaparecer de inmediato no tendría ningún efecto observable (solo se almacena su `type`, §7.1, nunca su posición/orientación), y generaría eventos espurios (`pieceMoved`, `pieceRotated`) para una pieza que ya no será la activa cuando el paso termine. Procesar el hold primero evita esa ambigüedad sin necesitar ninguna regla de cancelación retroactiva de eventos ya emitidos en el mismo paso.

Esta decisión es, además, exactamente simétrica con el tratamiento ya vigente de cualquier fijación disparada a mitad de paso (`lockAndProcess()` durante el movimiento horizontal o la rotación, por límite de reinicios): en esos casos, el motor ya "termina el paso" en el punto exacto donde ocurre la fijación, sin procesar los pasos lógicos posteriores. El hold aplica la misma idea, pero situándose como el primer paso posible en vez de intercalarse a mitad de otro.

### 18.2 Prioridad e incompatibilidad con otras acciones del mismo `StepInput`

Cuando el hold se ejecuta (§11.1), **ninguna** otra acción presente en el mismo `StepInput` (`leftPressed`/`rightHeld`/`rotateClockwise`/`hardDrop`/`softDropHeld`, etc.) se procesa en ese paso: el hold consume el paso completo. No es una regla de validación (§9.3 confirma que estas combinaciones son entrada válida), sino una consecuencia directa del orden de procesamiento (§18) y del retorno anticipado (§18.1). En el siguiente `step()`, esas acciones (si el jugador las repite, o si eran de estado mantenido como `leftHeld`) se evaluarán con normalidad sobre la nueva pieza activa.

Cuando el hold se solicita pero se ignora (§11.2, `holdUsed === true`), el resto del `StepInput` se procesa exactamente como si `hold` no hubiera estado presente: no hay ninguna interacción, ni siquiera de orden, con el resto de campos.

## 19. Validación, errores y atomicidad

- `hold` se valida estructuralmente en `validateInput` (§9.3): tipo `boolean` si está presente, incluido en `allowedKeys`. Ninguna otra regla de validación cruzada se añade.
- Una entrada estructuralmente inválida (por cualquier motivo, incluidos los ya existentes y el nuevo `hold` con tipo incorrecto) sigue lanzando `EngineStepError('INVALID_GAME_INPUT', …)` **antes** de `currentStep++`/`currentElapsedMs +=` (orden ya vigente en `step()`), por lo que no muta:
  - `board`, `activePiece`, `nextPieces`;
  - **`heldPiece` ni `holdUsed`** (ampliación explícita de la invariante de atomicidad ya vigente para el resto de campos, `0005`/`0007`);
  - el PRNG ni el estado de la bolsa;
  - la cola de eventos: no se emite ningún evento, incluido `pieceHeld`.
- Una solicitud de hold ignorada no produce por sí misma ninguna mutación específica de la reserva ni ningún evento `pieceHeld`; el resto del paso se ejecuta normalmente.
- Una solicitud de hold ignorada (§11.2) tampoco muta nada por definición (no es un caso de error, es un no-op deliberado).
- Un hold válido y ejecutado (§12/§13/§15) es una operación **todo o nada** dentro del paso: o bien completa toda su secuencia (actualizar `heldPiece`, emitir `pieceHeld`, intentar spawn, activar o finalizar partida, emitir `pieceSpawned`/`gameOver`), o bien el paso ni siquiera llega a intentarlo (por `ENGINE_NOT_RUNNING`, `INVALID_GAME_INPUT`, o por estar ignorado según §11.2). No existe ningún estado intermedio observable (por ejemplo, `heldPiece` actualizado pero sin haber decidido aún si el spawn es válido): toda la secuencia ocurre de forma síncrona dentro de una única llamada a `step()`, igual que ya ocurre con `lockActivePiece()` → `clearLines()` → `spawnNextPiece()` desde `0002`.

## 20. Eventos de dominio

Se añade exactamente un evento nuevo (§8.3): `{ type: 'pieceHeld'; step: number; piece: PieceType }`.

Reglas de emisión:

- Se emite si y solo si el hold se ejecuta (§11.1); nunca si se ignora (§11.2) ni si la entrada es inválida (§19).
- `piece` es siempre la pieza saliente (la que pasa a ocupar `heldPiece`), nunca la entrante.
- Se emite **antes** de intentar el spawn de la pieza entrante, y por tanto antes de `pieceSpawned` o de `gameOver`, en el mismo paso.
- Se emite exactamente una vez por hold ejecutado, tanto en la rama de ranura vacía (§12) como en la de intercambio (§13); no hay ninguna variante del evento según la rama (no se introduce, por ejemplo, `pieceHeldFromEmpty`/`pieceHeldSwap`): la distinción entre ambas ramas ya es derivable, por quien consuma los eventos, comparando el snapshot anterior (`heldPiece === null` o no) si alguna vez resultara necesario, sin que el evento en sí necesite duplicar esa información.
- Ningún otro tipo de `GameEvent` ni ningún valor de `MoveReason` se añade, elimina o modifica.

## 21. Snapshot e inmutabilidad

- `getSnapshot()` incluye `heldPiece` (valor primitivo `PieceType | null`, sin necesidad de copia defensiva: no es una colección) y, cuando `activePiece !== null`, `holdUsed` dentro del objeto ya congelado con `Object.freeze` que construye `activePieceSnap` (mismo patrón exacto que `grounded`, `lockDelayElapsedMs`, `lockResetsUsed`, `landingCells`).
- El snapshot completo sigue siendo inmutable de nivel superior (`Object.freeze`), igual que en `0002`/`0003`/`0006`/`0007`/`0011`.
- Ninguna llamada a `getSnapshot()` muta `heldPiece`, `holdUsed`, ni ningún otro estado del motor: son lecturas puras del estado interno ya actualizado por el `step()` anterior.
- Dos llamadas sucesivas a `getSnapshot()` sin `step()` intermedio devuelven el mismo valor de `heldPiece` y de `holdUsed` (comparación por igualdad de contenido; `heldPiece` es un primitivo, por lo que la igualdad de referencia es automática).

## 22. Reset

`reset(options)` sigue la misma secuencia ya establecida (`0002` §23, ampliada en `0005`/`0006`/`0007`), incorporando:

1. `heldPiece = null` (la reserva se vacía completamente; no se conserva ningún contenido de la partida anterior, ni siquiera si esa partida terminó en `gameOver` con una pieza en reserva).
2. `holdUsed = false` para la nueva pieza activa inicial, generada exactamente por la misma lógica que `spawnInitialPieces()` (o su equivalente invocado por `reset()`).

Tras `reset()`, el snapshot debe reflejar inmediatamente `heldPiece: null` y, si el spawn inicial es válido, `activePiece.holdUsed: false`, sin necesidad de llamar a `step()`, igual que el resto de campos del snapshot ya se comportan tras un reset.

## 23. Integración Phaser y teclado

### 23.1 Responsabilidad exacta de Phaser

Phaser captura la tecla física, detecta su flanco único, y traduce ese flanco a `StepInput.hold = true` exactamente una vez por fotograma en el que ocurrió la pulsación real. Phaser **no** decide:

- si la reserva está disponible (`holdUsed`);
- qué pieza entra o sale de la reserva;
- si el hold debe ignorarse o ejecutarse;
- el contenido de `nextPieces` ni de la bolsa.

Toda esa lógica vive exclusivamente en `packages/game-engine` (§11–§18). `GameScene.ts` se limita a añadir una tecla más al mismo mecanismo de flanco único ya usado para rotación y hard drop.

### 23.2 Tecla elegida

`docs/rautfall.md` (§1682, controles predeterminados) propone «Reserva: `C` o `Shift`» como opciones equivalentes para el control definitivo remapeable. Esta tarea no implementa remapeo de controles (§6): fija una única tecla concreta, no configurable, igual que todas las demás teclas ya implementadas (`ArrowUp` para rotación horaria en vez de `X`, que tampoco está mapeada; `Z` para rotación antihoraria; sin `A`/`S` de sabotaje). Se adopta **`C`** (`Phaser.Input.Keyboard.KeyCodes.C`):

- es una de las dos opciones ya previstas explícitamente en `docs/rautfall.md`, por lo que no introduce una tecla ajena a la intención de producto;
- se descarta `Shift` porque es una tecla modificadora con semántica de sistema/navegador distinta de una tecla de flanco único simple (posibles combinaciones con otras teclas, comportamiento de repetición del sistema operativo diferente), mientras que todas las teclas de acción discreta ya implementadas (`Z`, `Space`, `ArrowUp`) son teclas simples sin semántica de modificador; `C` mantiene esa misma naturaleza.

### 23.3 Cambios en `GameScene.ts`

- `this.cursors` gana `c: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C)`, añadida en `create()` junto a las demás teclas.
- `ConsumedFlags` gana `hold: boolean`, reiniciada a `false` en cada fotograma junto a `horizontal`/`clockwise`/`counterclockwise`/`hardDrop`.
- No se necesita ningún guardián de liberación (`input-release-guard.ts`) para `C`: es una tecla de flanco único (`Phaser.Input.Keyboard.JustDown`), como `Z`/`ArrowUp`/`Space`, no una tecla de estado mantenido con implicaciones de DAS/ARR como `left`/`right`/`softDrop` (§4.6). `armReleaseGuard`/`resolveHeld`/`clearReleaseGuardKey` no cambian.
- Durante la pausa, `readKeys()` sigue invocándose únicamente para drenar el estado de teclas (su valor de retorno se descarta, `0008`); el flanco de `C` se drena exactamente igual que ya se drenan `Z`/`ArrowUp`/`Space`, sin necesitar ningún cambio adicional en la rama de pausa de `update()`.

### 23.4 Cambios en `input-buffer.ts` (`KeyState`, `buildStepInput`)

```ts
export type KeyState = {
  horizontalPressed: 'left' | 'right' | null;
  leftHeld: boolean;
  rightHeld: boolean;
  justPressedUp: boolean;
  justPressedZ: boolean;
  justPressedSpace: boolean;
  justPressedC: boolean;              // ← nuevo, esta tarea; nombrado según la tecla física, igual que sus hermanos
  softDropHeld: boolean;
};
```

`buildStepInput` gana el mismo tratamiento exacto ya aplicado a `rotateClockwise`/`rotateCounterclockwise`/`hardDrop`: un flanco `hold` derivado de `keys.justPressedC`, consumido una sola vez por fotograma mediante una nueva entrada `hold: boolean` en el objeto `consumedThisFrame` (parámetro y retorno de la función). No se añade ninguna regla de exclusión mutua entre `hold` y las demás acciones discretas (a diferencia de la regla ya existente «si ambas rotaciones se disparan en el mismo frame, ninguna se envía»): esa regla existe porque rotar en ambos sentidos a la vez es ambiguo por definición; pulsar `C` y, por ejemplo, `Space` en el mismo fotograma no es ambiguo (el motor ya resuelve la coexistencia por orden de procesamiento, §18.2), por lo que `buildStepInput` reenvía `hold` de forma independiente, sin cancelarlo ni cancelar nada más.

### 23.5 Ayuda de controles en Vue

`App.vue` añade una línea a la lista de ayuda de controles ya existente (`.controls-help`):

```html
<li><kbd>C</kbd> Reserva</li>
```

## 24. Presentación visual de la reserva

### 24.1 Decisión: `GamePresentationState` se amplía

A diferencia de `landingCells` (`0011` §13, que **no** amplió `GamePresentationState` porque Phaser ya tiene acceso directo y completo al snapshot dentro de `GameScene.renderFrame()`, un contexto exclusivamente de Phaser), el contenido de la reserva necesita mostrarse en un **componente Vue**, y Vue no llama a `engine.getSnapshot()` en ningún punto (confirmado en `0004`/`0007` §4.3, sin cambios desde entonces): el único canal Phaser→Vue es `GamePresentationState`. Esta es exactamente la misma situación, y la misma decisión, que ya llevó a ampliar `GamePresentationState` con `nextPieces` en `0007` (§20, §21) para que `NextPiecesPreview.vue` pudiera consumirlo.

```ts
export type GamePresentationState = Readonly<{
  status: SessionStatus;
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];
  heldPiece: PieceType | null;        // ← nuevo, esta tarea
}>;
```

No se añade `holdUsed` a `GamePresentationState`: ningún elemento de interfaz previsto en esta tarea depende de si la reserva está disponible en este instante (no hay botón de reserva en pantalla, a diferencia de pausa/reinicio, que sí tienen botón); el único requisito real es mostrar **qué** hay guardado, no si puede usarse ahora mismo. Añadir `holdUsed` sin un consumidor real violaría el principio de no anticipar necesidades no demostradas (`AGENTS.md`).

`GameScene.notifyState()` incluye `heldPiece: snap.heldPiece` en el objeto que construye, y la comparación de deduplicación (que ya compara `status`/`step`/`elapsedMs`/`nextPieces`) se amplía para comparar también `heldPiece` (comparación de primitivos, más simple que la de `nextPieces`).

### 24.2 Nuevo componente Vue

Se crea `apps/web/src/components/HeldPiecePreview.vue`, siguiendo exactamente el patrón ya validado por `NextPiecesPreview.vue` (`0007` §20–§21): componente pequeño, sin Pinia, prop mínima, sin generar piezas ni mantener estado propio de dominio.

```ts
const props = defineProps<{
  heldPiece: PieceType | null;
}>();
```

- Si `heldPiece !== null`: usa `getPieceShape(heldPiece)` de `@rautfall/game-engine` (misma función pública ya existente desde `0007`, sin ampliarla) para pintar la pieza en reposo, con la misma técnica de rejilla CSS ya usada en `NextPiecesPreview.vue` (mismo tamaño de celda, mismo mapa de colores por tipo).
- Si `heldPiece === null`: muestra un hueco vacío explícito (por ejemplo, un contenedor con un borde discontinuo y el texto «Vacío»), coherente con Industrial Dramatic (sin iconografía nueva, sin animación).
- Encabezado «Reserva», análogo al encabezado «Próximas piezas» de `NextPiecesPreview.vue`.
- `data-testid="held-piece-preview"` en el contenedor raíz, siguiendo la convención de selectores contractuales ya establecida desde `0010`.
- No introduce ninguna dependencia nueva ni ninguna lógica de dominio: es un componente de presentación puro.

### 24.3 Integración en `App.vue`

Se añade una nueva `.console-section` dentro de la `.tactical-console` ya existente, con su `.console-divider` correspondiente, **antes** de la sección de «Próximas piezas» (orden de lectura habitual reserva → tablero → próximas piezas en interfaces de este género, y consistente con que la reserva es conceptualmente la contraparte de las piezas próximas, no del estado de sesión ni de los controles):

```html
<div class="console-section">
  <HeldPiecePreview :held-piece="gameState.heldPiece" />
</div>

<div class="console-divider"></div>

<div class="console-section">
  <NextPiecesPreview :next-pieces="gameState.nextPieces" />
</div>
```

No se modifica ningún estilo de `.tactical-console`/`.console-section`/`.console-divider` ya existente: se reutilizan tal cual. El valor inicial de `gameState` en `App.vue` (`ref<GamePresentationState>({ … })`) se amplía con `heldPiece: null`.

## 25. Pausa y game over

### 25.1 Pausa

La pausa pertenece exclusivamente a la capa web (`0008`); el motor no la conoce y no recibe ningún `step()` mientras `isPaused === true`. Ninguna solicitud de hold generada por la tecla `C` llega jamás al motor durante la pausa, por el mismo mecanismo ya vigente para el resto de teclas (`readKeys()` se invoca solo para drenar, su resultado se descarta, `GameScene.update()` retorna antes de llamar a `this.engine.step(...)` mientras `this.isPaused`). No se requiere ningún cambio adicional en `packages/game-engine` ni en la lógica de pausa ya existente en `GameScene.ts` más allá de incluir `c` en el conjunto de teclas leídas por `readKeys()` (§23.3).

El contenido de la reserva se congela junto con el resto del estado del motor mientras dura la pausa (no hay `step()`, no hay cambio de estado posible) y se sigue mostrando en `HeldPiecePreview.vue` con su último valor conocido, exactamente igual que `NextPiecesPreview.vue` ya hace.

### 25.2 Game over

- `heldPiece` **no se vacía** al entrar en `gameOver`: se conserva con su último valor, por la misma razón diagnóstica ya fijada para `nextPieces` en `gameOver` (`0007` §12) — utilidad de inspección, coherencia con `reset()`, y ausencia de un caso `null` especial que los consumidores deban aprender aparte del propio `status`.
- `holdUsed` deja de ser observable en `gameOver` porque `ActivePieceSnapshot` es `null` (mismo comportamiento ya vigente para `grounded`/`lockDelayElapsedMs`/`lockResetsUsed`/`landingCells`).
- Un hold cuya pieza entrante resulta bloqueada termina, él mismo, en `gameOver` (§15): en ese caso, `heldPiece` refleja la pieza saliente que se acaba de guardar justo antes del bloqueo, no un valor anterior ni `null`.
- `HeldPiecePreview.vue` no necesita ningún tratamiento especial para `gameOver`: sigue mostrando el último `heldPiece` recibido por `GamePresentationState`, sin ninguna comprobación adicional de `status`. No debe mostrarse una previsualización de reserva incoherente (por ejemplo, parpadeante o con un valor a medio actualizar): dado que `notifyState()` solo se invoca tras completar un `step()` entero de forma síncrona, y que `heldPiece` es siempre un valor final y consistente en cada snapshot, no existe ningún estado intermedio observable que pudiera producir esa incoherencia.

## 26. Pruebas unitarias y de regresión mínimas

Aplicar TDD pragmático en `packages/game-engine/src/game-engine.test.ts`. Las pruebas deben verificar comportamiento observable, invariantes y contratos, sin depender de nombres de variables privadas. Se recomienda un conjunto de bloques `describe` planos con el prefijo `reserva`, siguiendo el precedente ya establecido por los diez bloques `lock delay - …`. Como mínimo:

### 26.1 `reserva - estado inicial`

- `heldPiece` es `null` inmediatamente tras `createGameEngine`, sin necesidad de `step()`.
- `activePiece.holdUsed` es `false` para la pieza activa inicial.

### 26.2 `reserva - primera reserva (hueco vacío)`

- Tras un `step({ hold: true, … })` con `heldPiece === null`, `heldPiece` pasa a ser el tipo de la pieza activa anterior.
- La nueva pieza activa es exactamente `nextPieces[0]` (valor previo al `step`).
- `nextPieces` mantiene longitud 3 tras el `step`, con las piezas 1 y 2 anteriores desplazadas a las posiciones 0 y 1, y una nueva pieza de la bolsa en la posición 2.
- Se emite `pieceHeld` con la pieza saliente, seguido de `pieceSpawned` con la pieza entrante, en ese orden.

### 26.3 `reserva - intercambio (hueco ocupado)`

- Con `heldPiece` ya ocupado (tras una primera reserva previa y una fijación posterior que reactive el hold), un segundo `step({ hold: true, … })` intercambia `heldPiece` con `activePiece.type`.
- `nextPieces` no cambia en absoluto (mismo contenido, mismo orden) antes y después del intercambio.
- El número de piezas consumidas de la bolsa **no aumenta** por el intercambio (verificable comparando el estado de `nextPieces`/futuras piezas tras varios spawns con y sin intercambio intermedio, o mediante una prueba de determinismo dedicada, ver §26.9).
- Se emite `pieceHeld` con la pieza saliente, seguido de `pieceSpawned` con la pieza entrante (la que estaba en reserva).

### 26.4 `reserva - disponibilidad`

- Una segunda solicitud de hold antes de fijar la pieza activa (`holdUsed === true`) se ignora: no muta `heldPiece`, `activePiece`, `nextPieces`, el PRNG ni la cola de eventos; no emite ningún evento; no lanza ningún error.
- Tras fijar la pieza activa (por cualquier vía: hard drop, lock delay por temporizador, o límite de reinicios) y que aparezca la siguiente pieza por el flujo normal, `holdUsed` de la nueva pieza activa es `false` y una nueva solicitud de hold se ejecuta con normalidad.
- La pieza obtenida mediante un hold (rama vacía o intercambio) nace con `holdUsed === true`: una solicitud de hold inmediatamente posterior (mismo paso lógico siguiente, antes de fijar) se ignora.

### 26.5 `reserva - spawn de la pieza recuperada`

- La pieza recuperada (por cualquiera de las dos ramas) reaparece en `Orientation.Spawn`.
- La pieza recuperada reaparece en las coordenadas `calculateSpawnX`/`calculateSpawnY` correctas para su tipo (verificar al menos con `I` y con una pieza de anchura/altura distinta, por ejemplo `T` u `O`).

### 26.6 `reserva - gravedad y lock delay`

- Tras un hold válido, `activePiece.grounded` se deriva con normalidad desde el estado del tablero (sin heredar ningún valor de la pieza saliente).
- `lockDelayElapsedMs` es `0` inmediatamente tras el hold.
- `lockResetsUsed` es `0` inmediatamente tras el hold.
- `landingCells` se recalcula de inmediato para la nueva pieza activa (comprobar que coincide con la proyección esperada para su posición/orientación de spawn, reutilizando el mismo criterio ya usado en `0011` §10).
- Ningún campo de gravedad/lock delay de la pieza saliente sobrevive de ninguna forma observable (no hay ningún campo en `EngineSnapshot`/`ActivePieceSnapshot` donde pudiera hacerlo, pero se verifica explícitamente que los valores tras el hold son los de una pieza recién spawneada, no una continuación).

### 26.7 `reserva - orden dentro del paso y precedencia`

- Un `StepInput` con `hold: true` y, simultáneamente, `leftPressed: true`/`rotateClockwise: true`/`hardDrop: true` ejecuta únicamente el hold: el movimiento, la rotación y el hard drop no producen ningún efecto observable ni ningún evento propio en ese paso (no se emite `pieceMoved` ni `pieceRotated`; si `hardDrop` también estaba `true`, no se emite un segundo `pieceLocked`/`gameOver`/`pieceSpawned` por el hard drop, solo los del hold).
- Un `StepInput` con `hold: true` pero `holdUsed === true` (ignorado) sí procesa con normalidad el resto de acciones del mismo `StepInput` (por ejemplo, un movimiento horizontal válido en el mismo paso se aplica).

### 26.8 `reserva - hold con spawn bloqueado (game over)`

- Construir un escenario (tablero con la zona de spawn ya ocupada) en el que la pieza entrante, sea por la rama vacía o por intercambio, no puede aparecer.
- Verificar: `heldPiece` queda con la pieza saliente (no se revierte); `activePiece` es `null`; `status` es `'gameOver'`; se emite `pieceHeld` seguido de `gameOver` con motivo `'spawnBlocked'`; no se emite `pieceSpawned`.
- En la rama vacía, verificar además que `nextPieces` queda repuesta a longitud 3 igual que en cualquier `spawnBlocked` normal (`0007` §11).
- En la rama de intercambio, verificar que `nextPieces` no cambia en absoluto pese al `gameOver`.

### 26.9 `reserva - reset`

- Tras `reset()`, `heldPiece` es `null`, independientemente de su valor antes del reset (incluido el caso de venir de una partida en `gameOver` con una pieza en reserva).
- Tras `reset()`, `activePiece.holdUsed` es `false` para la nueva pieza activa inicial.

### 26.10 `reserva - atomicidad`

- Un `StepInput` estructuralmente inválido que incluya `hold` con tipo incorrecto (por ejemplo, `hold: 'yes'`) lanza `EngineStepError('INVALID_GAME_INPUT', …)` sin mutar `heldPiece`, `holdUsed`, `activePiece`, `board`, `nextPieces`, el PRNG ni la cola de eventos.
- Cualquier otro `StepInput` inválido ya cubierto por pruebas existentes (por ejemplo, `leftPressed`+`rightPressed` simultáneos) sigue sin mutar `heldPiece` ni `holdUsed` (ampliación de la prueba de atomicidad ya existente, si procede, o nueva aserción puntual).
- Una propiedad desconocida en `StepInput` sigue siendo rechazada (regresión de la lista blanca ya existente, ahora con `hold` incluido en ella).

### 26.11 `reserva - determinismo`

- Dos motores creados con la misma semilla y configuración, sometidos a la misma secuencia exacta de `StepInput` (incluidas varias solicitudes de hold, válidas e ignoradas), producen `heldPiece`, `activePiece.holdUsed`, `nextPieces`, el tablero y los eventos emitidos idénticos en cada paso comparado.
- El número de piezas consumidas de la bolsa en una secuencia con intercambios de reserva es idéntico al de la misma secuencia sin usar la reserva, salvo por el único consumo adicional correspondiente a cada primera reserva desde hueco vacío (§14), verificado de forma explícita contando piezas o comparando el estado exacto de `nextPieces` tras una secuencia controlada.

### 26.12 `reserva - snapshot e inmutabilidad`

- `heldPiece` y `holdUsed` no cambian por llamar a `getSnapshot()` repetidamente sin `step()` intermedio.
- Ningún campo nuevo introduce una referencia mutable compartida con el estado interno del motor (trivial para `heldPiece`/`holdUsed`, al ser primitivos, pero se verifica explícitamente igual que el resto de campos del snapshot).

### 26.13 Regresiones obligatorias

Ejecutar y mantener en verde, sin modificar su intención original salvo por la ampliación estrictamente necesaria de los literales `StepInput` que ahora podrían incluir `hold` (opcional, por lo que en la mayoría de los casos **no** es necesario tocar los literales existentes, §9.2):

- Regresión de cola de próximas piezas (`0007`).
- Regresión de hard drop (`0002`).
- Regresión de lock delay en todas sus variantes (`0006`).
- Regresión de pieza fantasma (`0011`).
- Regresión de rotación SRS (`0003`).
- Regresión de DAS/ARR/soft drop (`0005`).
- Regresión de reset y determinismo generales (`0002`/`0007`).

## 27. Pruebas de integración web

### 27.1 `apps/web/src/game/types.test.ts`

- Ampliar cada literal `GamePresentationState` existente con `heldPiece` (obligatorio, no opcional, §24.1).
- Añadir aserciones equivalentes a las ya existentes para `nextPieces`: número total de claves ahora en cinco (`status`, `step`, `elapsedMs`, `nextPieces`, `heldPiece`); presencia y tipo de `heldPiece`; ausencia de propiedades adicionales del snapshot del motor (`board`, `activePiece`, `clearedLines` ya cubiertos; no debe filtrarse tampoco un campo `holdUsed` a nivel superior).

### 27.2 `apps/web/src/game/input-buffer.test.ts`

- Ampliar `KeyState` con `justPressedC` en los literales de prueba existentes que construyan el objeto completo.
- Añadir pruebas equivalentes a las ya existentes para `justPressedZ`/`justPressedUp`/`justPressedSpace`: un flanco de `C` produce `hold: true` una sola vez y se consume correctamente mediante `consumedThisFrame.hold`; ausencia de flanco produce `hold: false`; el flanco de `C` no interfiere con los flancos de rotación ni de hard drop en el mismo `KeyState`.

### 27.3 `apps/web/src/App.test.ts`

- Ampliar cada literal `GamePresentationState`/`stateUpdateCallback(...)` existente con `heldPiece` (siguiendo exactamente la migración ya exigida en `0007` §22.2 para `nextPieces` cuando ese campo se añadió).
- Añadir una prueba que verifique que `HeldPiecePreview` recibe `heldPiece` desde `App` (mismo patrón que la prueba ya existente «`NextPiecesPreview` recibe `nextPieces` desde `App`»).
- Revisar las pruebas de layout ya existentes (recuento de secciones/columnas) para confirmar que la nueva `.console-section` no rompe ninguna aserción de estructura; si alguna aserción depende de un recuento exacto de `.console-section`/`.console-divider`, se actualiza para reflejar la nueva sección, sin alterar su intención original.

### 27.4 Nuevo `apps/web/src/components/HeldPiecePreview.test.ts`

Siguiendo el patrón exacto de `NextPiecesPreview.test.ts` (montaje con `@vue/test-utils`, aserciones directas sobre el DOM, sin mocks de `Graphics` ni de Phaser):

- Con `heldPiece: null`, se muestra el hueco vacío (por ejemplo, verificar el texto «Vacío» o el estado `aria`/`data-testid` correspondiente).
- Con `heldPiece` igual a cada uno de los siete tipos, se muestra la geometría correcta obtenida vía `getPieceShape` (verificar al menos el número de celdas pintadas y el tipo mostrado como texto, análogo a las aserciones ya existentes en `NextPiecesPreview.test.ts`).
- El contenedor raíz expone `data-testid="held-piece-preview"`.

## 28. Alcance E2E mínimo

Por defecto, se preserva la decisión ya fijada en `0011` §20 de no ampliar el E2E salvo que aporte valor real y verifique un contrato DOM estable. En este caso, sí existe un contrato DOM nuevo y estable derivado de esta tarea (`data-testid="held-piece-preview"`, visible desde la carga inicial de la aplicación), a diferencia de la pieza fantasma (que vive exclusivamente dentro del `<canvas>` de Phaser, sin ningún selector DOM).

Se añade una única ampliación puntual en `apps/web/e2e/essential-flow.spec.ts`, dentro del paso ya existente «estado inicial running, próximas piezas y paneles»:

```ts
await expect(page.getByTestId('held-piece-preview')).toBeVisible();
```

No se añade ninguna otra verificación E2E: en particular, no se simula la pulsación de `C` mediante Playwright (verificar la ejecución real de la mecánica de hold es responsabilidad de las pruebas de motor, §26, y de `input-buffer.test.ts`, §27.2, no del flujo E2E, coherente con que ninguna otra mecánica de juego —movimiento, rotación, hard drop, lock delay— se verifica hoy por Playwright, §4.8). No se introduce lectura de píxeles del canvas ni ninguna captura de regresión visual.

## 29. Archivos previsiblemente afectados

- `packages/game-engine/src/index.ts` — `StepInput.hold`, `EngineSnapshot.heldPiece`, `ActivePieceSnapshot.holdUsed`, nuevo evento `pieceHeld`, lógica de reserva dentro de `processStep`/nuevas funciones internas, validación de `hold`, reinicio en `reset()`.
- `packages/game-engine/src/game-engine.test.ts` — pruebas de §26.
- `apps/web/src/game/types.ts` — `GamePresentationState.heldPiece`.
- `apps/web/src/game/types.test.ts` — pruebas de §27.1.
- `apps/web/src/game/scenes/GameScene.ts` — tecla `c`, `ConsumedFlags.hold`, `notifyState()` con `heldPiece` y su deduplicación.
- `apps/web/src/game/input-buffer.ts` — `KeyState.justPressedC`, `buildStepInput` con `hold`.
- `apps/web/src/game/input-buffer.test.ts` — pruebas de §27.2.
- `apps/web/src/components/HeldPiecePreview.vue` — nuevo componente (§24.2).
- `apps/web/src/components/HeldPiecePreview.test.ts` — nuevo archivo de pruebas (§27.4).
- `apps/web/src/App.vue` — integración del nuevo componente, ayuda de controles, valor inicial de `gameState`.
- `apps/web/src/App.test.ts` — migración de literales y pruebas de §27.3.
- `apps/web/e2e/essential-flow.spec.ts` — ampliación puntual de §28.
- `docs/implementation/0012-reserva-pieza-hold.md` — informe de implementación (creado al finalizar, no ahora, §32).
- `docs/project-status.md` — actualización de estado (al finalizar, no ahora, §32).

No se prevé la creación ni modificación de ningún archivo de `packages/game-config`, de `apps/web/src/game/coordinates.ts`, de `apps/web/src/game/create-phaser-game.ts`, de `apps/web/src/game/session-status.ts`, de `apps/web/src/game/input-release-guard.ts`, de `apps/web/src/game/input-debug.ts`, ni de `apps/web/src/components/OpponentMonitor.vue`/`CombatStatusPanel.vue`. Si, durante la implementación, se detecta una necesidad real y mínima de tocar alguno de estos archivos, se documenta explícitamente en el informe de implementación junto con su justificación puntual.

## 30. Criterios de aceptación

### Contrato público

- `StepInput` expone `hold?: boolean`; el resto de sus campos no cambian de forma ni de obligatoriedad.
- `EngineSnapshot` expone `heldPiece: PieceType | null`; ningún otro campo cambia.
- `ActivePieceSnapshot` expone `holdUsed: boolean`; ningún otro campo cambia.
- `GameEvent` gana exactamente el caso `pieceHeld`; ningún otro tipo de evento ni `MoveReason` ni `GameOverReason` cambia.
- `GamePresentationState` expone `heldPiece: PieceType | null`; ningún otro campo cambia.
- No se añade ningún código de error público nuevo.

### Semántica exacta

- Una pieza activa puede reservarse como máximo una vez, gobernado por `holdUsed`.
- Ranura vacía → la pieza activa pasa a reserva, entra `nextPieces[0]`, la cola se repone con una pieza de la bolsa.
- Ranura ocupada → intercambio, sin tocar `nextPieces` ni la bolsa.
- La pieza recuperada reaparece en `Orientation.Spawn` y en las coordenadas de spawn correctas para su tipo, con gravedad, lock delay y contador de reinicios reiniciados, y `landingCells` recalculado de inmediato.
- El hold ejecutado tiene prioridad absoluta dentro del paso: ninguna otra acción del mismo `StepInput` se procesa cuando el hold se ejecuta.
- Una solicitud de hold no disponible se ignora, sin error ni mutación, y el resto del paso se procesa con normalidad.
- Un hold con spawn bloqueado produce `gameOver`/`spawnBlocked`, con `heldPiece` ya actualizado a la pieza saliente.
- La reserva vuelve a habilitarse únicamente cuando la pieza activa se fija por el flujo normal y aparece la siguiente pieza.

### Determinismo, pureza y atomicidad

- Misma semilla, configuración y secuencia de `StepInput` (incluidos holds) producen resultados idénticos entre dos motores independientes.
- Consultar `getSnapshot()` repetidamente no muta ningún estado del motor.
- Una entrada estructuralmente inválida no muta `heldPiece`, `holdUsed`, ni ningún otro estado del motor, ni emite ningún evento.

### Separación motor/Phaser/Vue

- `packages/game-engine` sigue sin depender de Phaser, Vue, DOM ni tiempo real.
- `GameScene.ts` no decide ninguna regla de disponibilidad, spawn o intercambio de reserva: solo traduce la tecla `C` a `hold: true` una vez por pulsación física.
- `App.vue`/`HeldPiecePreview.vue` no mantienen ninguna copia paralela de la lógica de reserva: se limitan a mostrar `heldPiece` recibido vía `GamePresentationState`.

### Ausencia de alcance adicional

- No existe puntuación, combos, T-Spins, `back-to-back`, energía, sabotajes, batalla, bot, backend, remapeo de controles, ni ninguna otra mecánica listada en §6.
- No se añadió ninguna propiedad de configuración nueva en `packages/game-config` ni ninguna dependencia nueva en ningún paquete.

### Documentación

- Esta especificación permanece sin modificar.
- El informe de implementación y la actualización de `docs/project-status.md` se realizan como pasos posteriores a la implementación, no como parte de esta especificación.

## 31. Puertas de calidad

Antes de declarar la tarea completada, ejecutar desde la raíz y verificar que todo finaliza correctamente:

```text
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Además, revisar:

- No existen imports profundos entre paquetes.
- `packages/game-config` no tiene ninguna modificación, salvo que la implementación demuestre y documente una necesidad real (no anticipada por esta especificación).
- No se ha ampliado `GamePresentationState` más allá de `heldPiece`.
- No existe código muerto ni una segunda implementación de spawn, colisión o cálculo de geometría: la reserva reutiliza `calculateSpawnX`, `calculateSpawnY`, `computeAbsoluteCells`, `isCollision`, `resetHorizontalState`, `getPieceShape` ya existentes, sin duplicarlos.
- No hay abstracciones innecesarias (ninguna clase, servicio, interfaz o paquete nuevo dedicado al hold; la lógica vive como funciones y estado adicional dentro del cierre ya existente de `createGameEngine`).
- No se ha ampliado el alcance más allá de §5.
- No hay errores ni avisos de lint ignorados.
- No se han usado scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline durante la implementación (`AGENTS.md`).
- El aviso de chunk de Vite/Rollup superior a 500 kB (atribuible a Phaser, aceptado desde `0004`) puede continuar apareciendo y no bloquea esta tarea.

## 32. Informe de implementación requerido

Este documento (`docs/tasks/0012-reserva-pieza-hold.md`) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Esta redacción no crea ni modifica ningún otro archivo del repositorio.

Al finalizar la implementación, quien la lleve a cabo (Cline) deberá crear [docs/implementation/0012-reserva-pieza-hold.md](../implementation/0012-reserva-pieza-hold.md) como informe de implementación independiente, con:

- resumen;
- archivos creados y modificados;
- contrato público final (`StepInput.hold`, `EngineSnapshot.heldPiece`, `ActivePieceSnapshot.holdUsed`, `GameEvent` con `pieceHeld`, `GamePresentationState.heldPiece`), y cualquier desviación de nombre o forma respecto de esta especificación, justificada;
- algoritmo final de la reserva (nombres internos reales, si difieren de los orientativos de esta especificación);
- orden final dentro de `step()`/`processStep`, confirmado por lectura del código resultante;
- tratamiento de la atomicidad y de la decisión «ignorar, no rechazar» (§11.2), confirmado por las pruebas añadidas;
- integración Phaser (tecla elegida, mecanismo de flanco único, ausencia de guardián de liberación);
- integración Vue (componente creado, ubicación en la consola táctica);
- pruebas añadidas (motor y web), y por qué;
- número final de tests Vitest y E2E;
- comandos ejecutados y resultados;
- desviaciones respecto de esta especificación, si las hubo, y su justificación;
- deuda técnica identificada;
- validación manual pendiente de confirmación por el usuario, si la hubiera (ver criterios equivalentes a los de `0011` §24: la reserva funciona en ambas ramas, la tecla `C` no interfiere con otras teclas, el hueco vacío se muestra correctamente tras reinicio, un game over no deja una previsualización de reserva incoherente);
- confirmación explícita de la ausencia de las mecánicas excluidas (§6);
- confirmación explícita de que no se hicieron commits durante la implementación.

Y actualizar [docs/project-status.md](../project-status.md): estado de `0012` (completada), fecha de finalización, resultado resumido, referencia al informe de implementación, y propuesta de siguiente tarea (§35).

Esta especificación no crea esos documentos ahora.

## 33. Restricciones para el agente implementador

- No modificar ninguna especificación existente de `docs/tasks/`, incluida esta.
- No usar scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline para modificar archivos ni para depurar el motor (`AGENTS.md`).
- No introducir dependencias nuevas en ningún paquete.
- No modificar `packages/game-config` salvo necesidad real demostrada y documentada (no se anticipa ninguna en esta tarea).
- No crear una clase, servicio, interfaz o paquete específico para el hold: la lógica se integra como funciones y estado adicional dentro de `packages/game-engine/src/index.ts`, siguiendo el estilo ya existente (funciones libres dentro del cierre de `createGameEngine`, no una nueva capa de abstracción).
- No almacenar en `heldPiece` nada más que `PieceType` (§7.1): ninguna posición, orientación, celdas ni referencia a la pieza activa original.
- No implementar Shift como tecla alternativa ni remapeo de controles (§6, §23.2).
- No ampliar el alcance hacia puntuación, combos, T-Spins, energía, sabotajes, bot, batalla o backend.
- Detenerse y preguntar si, durante la implementación, se detecta una decisión funcional no cubierta explícitamente por esta especificación (`AGENTS.md`, «Procedimiento de trabajo»).
- No hacer commits salvo instrucción explícita del usuario.
- Ejecutar las cuatro validaciones raíz (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`) y `pnpm test:e2e` antes de declarar la tarea completada, y validar el arranque real con `pnpm dev` (`AGENTS.md`, «Aplicaciones ejecutables»), deteniendo el servidor al finalizar.

## 34. Definición de terminado

La tarea `0012` se considera terminada cuando:

- el contrato público descrito en §8, §9 y §24.1 está implementado exactamente como se especifica, sin alias de compatibilidad ni campos adicionales no previstos;
- todas las reglas de §11 a §22 están implementadas y verificadas por las pruebas mínimas de §26 y §27;
- la integración Phaser (§23) no contiene ninguna regla de dominio relativa a la reserva;
- la presentación Vue (§24) muestra correctamente ambos estados (vacío y ocupado) sin duplicar la lógica del motor;
- las puertas de calidad de §31 finalizan correctamente;
- se ha creado el informe de implementación (§32) y actualizado `docs/project-status.md`;
- no queda ninguna ampliación de alcance no justificada respecto de §5/§6;
- no se ha hecho ningún commit no solicitado explícitamente por el usuario.

## 35. Siguiente tarea

No se fija una `0013` definitiva. Esta especificación no prejuzga cuál será. Candidatas razonables, a decidir tras validar manualmente la reserva y revisar `docs/rautfall.md` frente al estado real del proyecto: puntuación y combos, o el primer sabotaje real (condicionado, como ya señalaba `0010` §22 y `0011` §28, a decidir antes la mecánica de puntuación/energía real que ese sabotaje presupone).
