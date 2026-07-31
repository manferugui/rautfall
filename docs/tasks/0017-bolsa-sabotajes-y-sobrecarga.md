# 0017 — Bolsa de sabotajes y Sobrecarga

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

Implementar en `packages/game-engine`:

1. La **bolsa determinista de 2 sabotajes (Sabotage 2-Bag)** (`['residuos', 'sobrecarga']`), impulsada por el PRNG determinista del motor y el algoritmo Fisher–Yates, garantizando que cada bolsa entregue ambos sabotajes exactamente una vez antes de regenerarse y barajarse de nuevo.
2. El **segundo sabotaje funcional: Sobrecarga (`'sobrecarga'`)**, ampliando `SabotageType` a `'residuos' | 'sobrecarga'`.
3. El tipo de efecto temporal activo **`ActiveEffectType = 'sobrecarga'`** y la estructura **`ActiveEffectSnapshot`** (`{ type: ActiveEffectType; remainingMs: number }`), expuesta en `activeEffects: readonly ActiveEffectSnapshot[]` dentro de `EngineSnapshot`.
4. La **activación, recepción y renovabilidad determinista de Sobrecarga**:
   - `receiveSabotage('sobrecarga')` la activa inmediatamente en ese mismo paso lógico.
   - Si Sobrecarga ya está activa, recibir otra reinicia su duración completa a 10.000 ms y vuelve a emitir `effectStarted`. No se añade un evento adicional de renovación.
   - El multiplicador de velocidad no se acumula: se mantiene estrictamente en **$3\times$**.
5. El **descuento del temporizador de efectos activos** en `step(input)` mediante `config.fixedStepMs` en cada paso lógico activo (cuando el motor está en estado `'running'`), emitiendo los eventos `effectStarted` y `effectExpired` (este último una única vez al alcanzar `remainingMs === 0`).
6. La **modificación determinista de la gravedad pasiva**:
   - Sobrecarga multiplica por 3 **únicamente la gravedad pasiva**: `activeGravity = config.gravityCellsPerSecond * OVERLOAD_GRAVITY_MULTIPLIER` (donde `OVERLOAD_GRAVITY_MULTIPLIER = 3`).
   - Mientras `input.softDropHeld === true`, la velocidad usada es exactamente `config.softDropCellsPerSecond`. Sobrecarga no modifica ni escala de forma indirecta el descenso por soft drop.
   - Se conserva el acumulador vertical existente (`verticalProgress`), pudiendo avanzar múltiples celdas en un paso si el progreso acumulado supera `VERTICAL_CELL_UNIT`.
   - Hard drop, DAS, ARR, SRS y lock delay **permanecen sin cambios**.
7. La **integración en la interfaz web (`apps/web`)**:
   - `CombatStatusPanel.vue`: añadir una sección mínima de **EFECTOS ACTIVOS** (sin animaciones), mostrando la insignia `SOBRECARGA` y su tiempo restante en segundos usando `Math.ceil(remainingMs / 1000)`.
   - Adaptar el modo de demostración 1P (`?sabotage-demo=1`) para probar en loopback determinista los sabotajes extraídos de la bolsa.

---

## 2. Antecedentes y decisiones aprobadas

1. **Duración de Sobrecarga**: Dura exactamente **10.000 ms** (`OVERLOAD_DURATION_MS = 10000`) de tiempo lógico activo del motor.
2. **Efecto sobre la gravedad pasiva**: Multiplica por **3** únicamente la velocidad de caída por gravedad pasiva.
3. **Comportamiento exacto de soft drop**: Mientras `input.softDropHeld === true`, la velocidad activa es exactamente `config.softDropCellsPerSecond`, incluso si la gravedad pasiva multiplicada fuese mayor. Sobrecarga no afecta indirectamente a soft drop.
4. **Invarianza de otros controles y tiempos**: Hard drop, DAS, ARR, SRS y lock delay no son modificados por Sobrecarga.
5. **Composición de la bolsa (Sabotage 2-Bag)**: La generación de sabotajes utiliza una bolsa determinista de 2 elementos `['residuos', 'sobrecarga']`. Cada bolsa entrega ambos sabotajes exactamente una vez antes de reponerse y volver a barajarse con el PRNG del motor.
6. **Activación inmediata y reutilización de `effectStarted`**:
   - Al recibir Sobrecarga cuando no está activa, se crea el efecto con 10.000 ms y se emite `effectStarted`.
   - Al recibir Sobrecarga cuando ya está activa, se restablece `remainingMs` a 10.000 ms y se vuelve a emitir `effectStarted`.
   - No se añade ningún evento adicional de renovación.
7. **Renovación sin acumulación**: El multiplicador no se apila ($3\times$ constante) y no se crean múltiples objetos de efecto de tipo `'sobrecarga'` en `activeEffects`.
8. **Descuento de temporizador**: `remainingMs` disminuye en `config.fixedStepMs` por cada llamada a `step()` cuando el motor está en estado `'running'`. El tiempo restante nunca baja de 0.
9. **Evento de expiración**: `effectExpired` se emite exactamente una sola vez cuando `remainingMs` alcanza 0.
10. **Acumulador vertical**: La gravedad calcula el progreso acumulado usando la nueva velocidad y aplica todos los descensos de celda que correspondan según `verticalProgress >= VERTICAL_CELL_UNIT`.
11. **Comportamiento en Pausa**: La pausa suspende las llamadas a `step()`. Si durante la pausa se invoca `receiveSabotage('sobrecarga')`, el efecto queda registrado inmediatamente con 10.000 ms (y emite `effectStarted`), pero su temporizador no disminuye hasta que se reanuden las llamadas a `step()`.
12. **Comportamiento en Game Over**: El temporizador de `activeEffects` queda congelado en el snapshot final emitido al producirse `gameOver`.
13. **Comportamiento en `reset()`**: `reset()` elimina todos los efectos activos, dejando `activeEffects = []`.
14. **Presentación en UI**: `CombatStatusPanel.vue` renderiza el bloque `EFECTOS ACTIVOS` en segundos con `Math.ceil(remainingMs / 1000)` sin animaciones.

---

## 3. Contrato exacto del motor (`packages/game-engine`)

### 3.1 Tipos públicos

```ts
export type SabotageType = 'residuos' | 'sobrecarga';

export type ActiveEffectType = 'sobrecarga';

export type ActiveEffectSnapshot = Readonly<{
  type: ActiveEffectType;
  remainingMs: number;
}>;

export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | 'garbage' | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;
  score: number;
  combo: number;
  backToBack: number;
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  pendingGarbage: number;
  activeEffects: readonly ActiveEffectSnapshot[];
}>;

export type StepInput = Readonly<{
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
  hold?: boolean;
  triggerSabotage?: boolean;
}>;
```

### 3.2 Eventos de dominio

```ts
export type EffectStartedEvent = Readonly<{
  type: 'effectStarted';
  step: number;
  effect: ActiveEffectType;
  durationMs: number;
}>;

export type EffectExpiredEvent = Readonly<{
  type: 'effectExpired';
  step: number;
  effect: ActiveEffectType;
}>;

export type GameEvent =
  | { type: 'engineStarted'; step: number }
  | { type: 'engineReset'; step: number }
  | { type: 'pieceSpawned'; step: number; piece: PieceType }
  | { type: 'pieceMoved'; step: number; reason: MoveReason }
  | { type: 'pieceLocked'; step: number; piece: PieceType }
  | {
      type: 'linesCleared';
      step: number;
      lines: number;
      lineIndices: readonly number[];
    }
  | { type: 'gameOver'; step: number; reason: GameOverReason }
  | { type: 'pieceRotated'; step: number; orientation: Orientation }
  | { type: 'pieceHeld'; step: number; piece: PieceType }
  | { type: 'sabotageTriggered'; step: number; sabotage: SabotageType }
  | { type: 'garbageApplied'; step: number; linesCount: number }
  | { type: 'effectStarted'; step: number; effect: ActiveEffectType; durationMs: number }
  | { type: 'effectExpired'; step: number; effect: ActiveEffectType };
```

### 3.3 API pública del motor

```ts
export interface GameEngine {
  step(input: StepInput): void;
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  receiveSabotage(sabotage: SabotageType): void;
  reset(options: EngineOptions): void;
}
```

---

## 4. Generación determinista mediante bolsa 2-bag de sabotajes

1. **Constantes y estado interno**:
   ```ts
   const ALL_SABOTAGES: readonly SabotageType[] = Object.freeze(['residuos', 'sobrecarga']);
   ```
   Un objeto de estado interno `sabotageBagState = { bag: SabotageType[], index: number }` gestiona la bolsa.
2. **Algoritmo de barajado**:
   - `shuffleSabotageBag(prng)` copia `ALL_SABOTAGES` y lo baraja usando Fisher–Yates con `prng()`.
   - `nextFromSabotageBag(state, prng)` devuelve el sabotaje en `state.index`. Si `state.index >= state.bag.length`, regenera y baraja una nueva bolsa y reinicia `index = 0`.
3. **Integración al convertir energía**:
   - En `lockAndProcess()`, al calcular `totalEnergy >= 100` y `storedSabotages.length < 2`:
     - Se extrae el siguiente sabotaje de la 2-bag (`nextFromSabotageBag(sabotageBagState, prng)`).
     - Se inserta en `storedSabotages.push(sabotage)`.

---

## 5. Recepción, temporización y orden exacto de resolución

### 5.1 Método `receiveSabotage(sabotage)`

Al invocar `engine.receiveSabotage(sabotage)`:

1. Si `sabotage === 'residuos'`:
   - Incrementa `pendingGarbage += 2` (comportamiento de la Tarea 0016).
2. Si `sabotage === 'sobrecarga'`:
   - Se busca si existe un efecto activo de tipo `'sobrecarga'` en `activeEffects`.
   - Si no existe:
     - Se agrega `{ type: 'sobrecarga', remainingMs: 10000 }` a `activeEffects`.
     - Se emite el evento `effectStarted { step: currentStep, effect: 'sobrecarga', durationMs: 10000 }`.
   - Si ya existe:
     - Se restablece `remainingMs = 10000` (renovación).
     - Se vuelve a emitir el evento `effectStarted { step: currentStep, effect: 'sobrecarga', durationMs: 10000 }`. No se genera un segundo objeto en `activeEffects` ni se crea un evento adicional.
   - La activación o renovación tiene efecto **inmediato** en ese mismo paso lógico.

### 5.2 Orden exacto dentro del paso lógico (`step(input)`)

```
1. Comprobar status === 'gameOver' (lanzar ENGINE_NOT_RUNNING si corresponde)
2. Validar input (lanzar INVALID_GAME_INPUT si no cumple el contrato)
3. Incrementar currentStep++ y currentElapsedMs += config.fixedStepMs
4. Procesar triggerSabotage (si triggerSabotage === true y storedSabotages.length > 0):
   - Extraer el primer sabotaje del cartucho (FIFO)
   - Emitir evento sabotageTriggered
5. Actualizar temporizador de efectos activos (activeEffects):
   - Para cada efecto en activeEffects:
     - remainingMs = Math.max(0, remainingMs - config.fixedStepMs)
     - Si remainingMs === 0 (expiración):
       - Remover el efecto de activeEffects
       - Emitir evento effectExpired { step: currentStep, effect: effect.type }
6. Ejecutar procesado del paso lógico del juego (processStep(input)):
   - Hold
   - Movimiento horizontal (DAS / ARR)
   - Rotaciones SRS (y reinicios de lock delay)
   - Hard drop (y fijación con lockAndProcess() si aplica)
   - Caída por gravedad o soft drop (processVertical(input)):
     - Si 'sobrecarga' está activo en activeEffects:
       activeGravity = config.gravityCellsPerSecond * OVERLOAD_GRAVITY_MULTIPLIER (donde OVERLOAD_GRAVITY_MULTIPLIER = 3)
     - De lo contrario:
       activeGravity = config.gravityCellsPerSecond
     - Si input.softDropHeld === true:
       activeCellsPerSecond = config.softDropCellsPerSecond
     - De lo contrario:
       activeCellsPerSecond = activeGravity
     - verticalProgress += config.fixedStepMs * activeCellsPerSecond
     - Mientras verticalProgress >= VERTICAL_CELL_UNIT: avanzar Y una celda, emitir pieceMoved ('gravity' o 'softDrop'), decrementar verticalProgress -= VERTICAL_CELL_UNIT
   - Comprobación y temporización de lock delay al final del paso (lockAndProcess() si expira o alcanza maxLockResets)
```

---

## 6. Integración en la interfaz web (`apps/web`)

1. **`GamePresentationState`**:
   - Se amplía con `activeEffects: readonly ActiveEffectSnapshot[]`.
2. **`CombatStatusPanel.vue`**:
   - Añadir una nueva fila o bloque **EFECTOS ACTIVOS** en la consola táctica.
   - Si `activeEffects` contiene el efecto `'sobrecarga'`, mostrar la insignia `SOBRECARGA` y el tiempo restante formateado en segundos con:
     `Math.ceil(remainingMs / 1000)` (por ejemplo, `10s`, `9s`, ..., `1s`).
   - Sin animaciones ni efectos complejos.
3. **Modo de demostración de desarrollo (`?sabotage-demo=1`)**:
   - Al capturar `sabotageTriggered`, la escena redirige en loopback el sabotaje lanzado (`residuos` o `sobrecarga`, proveniente de la 2-bag) hacia `engine.receiveSabotage(event.sabotage)`.

---

## 7. Determinismo, atomicidad, reset y game over

- **Determinismo**: Misma semilla produce exactamente la misma secuencia de la 2-bag de sabotajes y la misma duración de Sobrecarga.
- **Pausa**: Como la pausa detiene la invocación de `step()`, `remainingMs` no se descuenta. Si se recibe `receiveSabotage('sobrecarga')` durante la pausa, se registra inmediatamente con 10.000 ms y emite `effectStarted`.
- **Game Over**: Al producirse `gameOver`, `activeEffects` se congela con el `remainingMs` que tuviese en ese instante.
- **`reset()`**: Pone `activeEffects = []`.

---

## 8. Pruebas deterministas obligatorias

Todas las aserciones comprueban **valores exactos**.

### Motor (`packages/game-engine`)

1. **Generación determinista vía 2-bag de sabotajes**:
   - Con la misma semilla y 2 conversiones consecutivas de 100 de energía, verificar que los sabotajes resultantes en el cartucho contienen exactamente un `'residuos'` y un `'sobrecarga'` (en el orden determinado por el PRNG de esa semilla).
   - Verificar que tras 2 extracciones, la bolsa se repone y baraja de nuevo de forma determinista.
2. **Recepción y activación inmediata de Sobrecarga**:
   - Invocación de `receiveSabotage('sobrecarga')` añade el efecto a `activeEffects` con `remainingMs === 10000` y emite `effectStarted` con `durationMs === 10000`.
3. **Descuento de temporizador en `step()`**:
   - Tras 1 paso de 10 ms (`fixedStepMs = 10`), `remainingMs === 9990`.
   - Tras 100 pasos, `remainingMs === 9000`.
4. **Expiración única de Sobrecarga**:
   - Tras 1000 pasos de 10 ms (10.000 ms), `activeEffects` queda vacío `[]` y se emite exactamente un evento `effectExpired { step, effect: 'sobrecarga' }`.
5. **Renovación sin acumulación y reemisión de `effectStarted`**:
   - Tras 300 ms de Sobrecarga (`remainingMs === 9700`), invocar `receiveSabotage('sobrecarga')` restablece `remainingMs === 10000` y emite un nuevo evento `effectStarted { step, effect: 'sobrecarga', durationMs: 10000 }`.
   - Verificar que `activeEffects.length === 1` (no crea un segundo objeto de efecto en el snapshot).
   - La velocidad de caída pasiva durante la renovación sigue siendo $3\times$ (el multiplicador no se apila a $9\times$).
6. **Multiplicación de la gravedad pasiva a 3×**:
   - Con `gravityCellsPerSecond = 1` y `fixedStepMs = 10`, en un motor sin Sobrecarga la pieza avanza 1 celda cada 100 pasos.
   - Con Sobrecarga activa, la pieza avanza 1 celda cada 34 pasos (o 3 celdas cada 100 pasos), reflejando exactamente la aceleración de la gravedad pasiva a 3×.
7. **Soft drop exacto a `config.softDropCellsPerSecond`**:
   - Mientras `input.softDropHeld === true`, la velocidad activa es exactamente `config.softDropCellsPerSecond` (ej. 20 celdas por segundo), incluso si la gravedad pasiva multiplicada superase ese valor (ej. si `gravityCellsPerSecond = 10`, `3 * 10 = 30`, soft drop continúa a 20 celdas por segundo). Sobrecarga no escala ni altera soft drop.
8. **Invarianzas de hard drop / DAS / ARR / SRS / lock delay**:
   - Hard drop sigue fijando inmediatamente.
   - Lock delay sigue durando 500 ms al estar apoyada.
   - DAS / ARR / SRS permanecen inalterados.
9. **Pausa, reset y game over**:
   - `reset()` deja `activeEffects` en `[]`.
   - `gameOver` congela `activeEffects`.

### Web (`apps/web`)

1. **`CombatStatusPanel.test.ts`**:
   - Muestra el bloque `EFECTOS ACTIVOS` con `'SOBRECARGA'` y tiempo en segundos `Math.ceil(remainingMs / 1000)`.
2. **`types.test.ts` y `App.test.ts`**:
   - Extensión de `GamePresentationState` con `activeEffects`.

---

## 9. Criterios de aceptación

1. `pnpm test` pasando en todos los paquetes.
2. `pnpm lint` sin errores ni avisos en archivos modificados.
3. `pnpm typecheck` limpio.
4. `pnpm build` exitoso.
5. `pnpm test:e2e` pasando.
6. `git diff --check` limpio.
7. Validación manual con `pnpm dev` y `?sabotage-demo=1`:
   - Al probar sabotajes de la bolsa, lanzar `sobrecarga` activa el indicador `SOBRECARGA 10s` en la interfaz.
   - La pieza activa cae visiblemente a la triple velocidad.
   - El contador desciende segundo a segundo hasta desaparecer.

---

## 10. Alcance excluido

Queda explícitamente excluido de la Tarea 0017:

- Sabotajes **Interferencia** y **Polaridad inversa**.
- Acumulación multiplicativa de velocidad ($9\times$, $27\times$).
- Modificaciones a soft drop, hard drop, DAS, ARR, SRS o Lock Delay.
- Segundo tablero interactivo rival o bot IA.
- Backend, autenticación, ranking y persistencia.
