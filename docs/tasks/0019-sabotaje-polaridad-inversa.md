# 0019 — Sabotaje Polaridad inversa

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

Implementar en `packages/game-engine`:

1. El **tercer sabotaje funcional: Polaridad inversa (`'polaridad'`)**, ampliando `SabotageType` a `'residuos' | 'sobrecarga' | 'polaridad'`.
2. La **bolsa determinista de 3 sabotajes (Sabotage 3-Bag)** (`['residuos', 'sobrecarga', 'polaridad']`), impulsada por el PRNG determinista del motor y el algoritmo Fisher–Yates, garantizando que cada ciclo entregue los tres sabotajes exactamente una vez antes de regenerarse y barajarse de nuevo.
3. El tipo de efecto temporal/activo **`ActiveEffectType = 'sobrecarga' | 'polaridad'`** y el contrato de **`ActiveEffectSnapshot`** mediante una unión discriminada estricta sin propiedades opcionales ni tipos ambiguos:
   ```ts
   export type ActiveEffectSnapshot =
     | Readonly<{
         type: 'sobrecarga';
         remainingMs: number;
       }>
     | Readonly<{
         type: 'polaridad';
         remainingPieces: 1 | 2;
       }>;
   ```
4. La **activación, recepción, renovabilidad y límite de piezas de Polaridad inversa**:
   - `receiveSabotage('polaridad')` activa inmediatamente el efecto en el motor para la pieza activa actual (o para la siguiente si no hay pieza activa en ese instante).
   - Duración inicial: **1 pieza completa** (`remainingPieces = 1`).
   - Al recibir otra Polaridad estando activa: no duplica la inversión ni el objeto en `activeEffects`; incrementa `remainingPieces` hasta un máximo de **2 piezas** (`remainingPieces = Math.min(2, remainingPieces + 1)`) y vuelve a emitir `effectStarted` con la duración renovada (`durationPieces: 2`). Si ya está en `2`, mantiene el valor en `2` y vuelve a emitir `effectStarted` (`durationPieces: 2`).
   - La inversión de entrada se aplica siempre **una sola vez**, independientemente de si el contador es 1 o 2.
   - Cada fijación de pieza en el tablero (`lockAndProcess()`) decrementa `remainingPieces` en 1.
   - Al decrementar desde 1, el efecto se elimina de `activeEffects` antes de exponer un snapshot con 0 y se emite exactamente un evento `effectExpired`.
5. El **evento `EffectStartedEvent`** mediante unión discriminada estricta:
   ```ts
   export type EffectStartedEvent =
     | Readonly<{
         type: 'effectStarted';
         step: number;
         effect: 'sobrecarga';
         durationMs: number;
       }>
     | Readonly<{
         type: 'effectStarted';
         step: number;
         effect: 'polaridad';
         durationPieces: 1 | 2;
       }>;
   ```
6. La **política exacta en `gameOver` para `receiveSabotage()`**:
   - Si `status === 'gameOver'`, la llamada a `receiveSabotage()` se ignora de forma explícita y no muta estado.
   - No modifica `activeEffects`, no modifica `pendingGarbage`, no modifica `storedSabotages`, no emite `effectStarted` ni ningún otro evento.
   - El snapshot final permanece completamente congelado. Esta política se aplica de forma uniforme a todos los sabotajes (`residuos`, `sobrecarga`, `polaridad`).
7. La **transformación determinista de intenciones de juego (`StepInput`) dentro del motor**:
   - La validación ocurre antes de la transformación: se valida primero la forma e invariantes de `input` (`validateInput(input)`). Una entrada inválida lanza `EngineStepError('INVALID_GAME_INPUT')` sin mutar estado ni efectos.
   - Al procesar una entrada válida con Polaridad activa:
     - `effectiveLeftHeld = input.rightHeld`
     - `effectiveRightHeld = input.leftHeld`
     - `effectiveLeftPressed = input.rightPressed`
     - `effectiveRightPressed = input.leftPressed`
     - `effectiveRotateClockwise = input.rotateCounterclockwise === true`
     - `effectiveRotateCounterclockwise = input.rotateClockwise === true`
   - Acciones no transformadas: `softDropHeld`, `hardDrop`, `hold`, `triggerSabotage`, pausa y reinicio.
   - La transformación respeta DAS, ARR, detección de flancos y prioridades horizontales dentro del motor de forma automática.
8. La **integración en la interfaz web (`apps/web`)**:
   - `CombatStatusPanel.vue`: renderizar en la sección **EFECTOS ACTIVOS** la insignia `POLARIDAD` y las piezas restantes: `POLARIDAD · 1 PIEZA` o `POLARIDAD · 2 PIEZAS`.
   - Adaptar el modo de demostración 1P (`?polarity-demo=1`) para probar en loopback determinista el sabotaje de Polaridad inversa.

---

## 2. Antecedentes y decisiones aprobadas

1. **Capa de transformación (Decisión de Arquitectura)**:
   - La transformación opera sobre intenciones abstractas dentro del motor (`packages/game-engine`).
   - No depende de teclas DOM ni de eventos de Phaser.
   - Se aplica de forma idéntica al jugador humano y al futuro bot.
   - Se ejecuta en `step(input)` después de validar la entrada original y antes de que DAS, ARR, SRS y el resto del paso lógico procesen la entrada.
2. **Invariantes de `ActiveEffectSnapshot`**:
   - `sobrecarga` siempre expose `remainingMs`.
   - `polaridad` siempre expone `remainingPieces: 1 | 2`.
   - Polaridad nunca expone `0`, `3`, valores negativos ni decimales.
   - Nunca se combinan `remainingMs` y `remainingPieces` en un mismo objeto.
   - Solo existe una entrada de cada tipo de efecto en `activeEffects`.
3. **Invariantes de `EffectStartedEvent`**:
   - Sobrecarga conserva `durationMs`.
   - Polaridad utiliza `durationPieces: 1 | 2`.
   - Activación inicial emite `durationPieces: 1`.
   - Renovación de 1 a 2 emite `durationPieces: 2`.
   - Nueva recepción estando en 2 vuelve a emitir `durationPieces: 2`.
   - Polaridad nunca emite `durationMs`.
   - Sobrecarga nunca emite `durationPieces`.
4. **Renovación y límite de piezas**:
   - Recepción sin estar activa: crea entrada con `remainingPieces = 1` y emite `effectStarted` (`durationPieces: 1`).
   - Recepción estando activa: incrementa `remainingPieces` hasta un máximo de 2 y emite `effectStarted` (`durationPieces: 2`).
   - Recepción con `remainingPieces = 2`: mantiene el valor en 2 y re-emite `effectStarted` (`durationPieces: 2`).
   - No existe inversión doble (no se cancela el efecto).
   - Cada fijación de pieza en el tablero (`lockAndProcess()`) reduce `remainingPieces` en 1.
   - Al decrementar desde 1, el efecto se elimina de `activeEffects` antes de exponer un snapshot con 0 y emite un único `effectExpired`.
5. **Comportamiento de `hold`**:
   - `hold` no consume ni reduce `remainingPieces`.
   - La Polaridad continúa activa sobre la pieza resultante del intercambio.
   - Solo la fijación en el tablero mediante `lockAndProcess()` decrementa el contador.
6. **Activación sin pieza activa**:
   - Si el motor está `running` y existe pieza activa, afecta inmediatamente a esa pieza.
   - Si el motor está `running` pero no existe pieza activa durante una transición interna, el efecto permanece en `activeEffects` y afectará a la siguiente pieza válida.
   - No se crea una API ni un estado público adicional para representar "pendiente".
7. **Comportamiento en Pausa, Game Over y Reset**:
   - Pausa: `remainingPieces` no cambia. Polaridad figura en el snapshot pausado con su valor actual (`1 | 2`). No se fijan piezas ni se emiten expiraciones durante la pausa.
   - Game Over: `receiveSabotage('polaridad')` se ignora explícitamente cuando `status === 'gameOver'`. No muta `activeEffects`, `pendingGarbage` ni `storedSabotages`, no emite eventos y el snapshot final permanece congelado.
   - Reset: `reset()` elimina Polaridad y resetea contadores. `reset()` **no emite** `effectExpired`.
8. **Presentación en UI**: `CombatStatusPanel.vue` muestra `POLARIDAD · 1 PIEZA` o `POLARIDAD · 2 PIEZAS` sin animaciones complejas.

---

## 3. Contrato exacto del motor (`packages/game-engine`)

### 3.1 Tipos públicos

```ts
export type SabotageType = 'residuos' | 'sobrecarga' | 'polaridad';

export type ActiveEffectType = 'sobrecarga' | 'polaridad';

export type ActiveEffectSnapshot =
  | Readonly<{
      type: 'sobrecarga';
      remainingMs: number;
    }>
  | Readonly<{
      type: 'polaridad';
      remainingPieces: 1 | 2;
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
  level: number;
  baseGravityCellsPerSecond: number;
  activeGravityCellsPerSecond: number;
}>;
```

### 3.2 Eventos de dominio

```ts
export type EffectStartedEvent =
  | Readonly<{
      type: 'effectStarted';
      step: number;
      effect: 'sobrecarga';
      durationMs: number;
    }>
  | Readonly<{
      type: 'effectStarted';
      step: number;
      effect: 'polaridad';
      durationPieces: 1 | 2;
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
  | EffectStartedEvent
  | EffectExpiredEvent
  | LevelUpEvent;
```

---

## 4. Orden de validación y transformación de intenciones (`StepInput`)

En cada invocación de `step(input)`:

1. **Validación previa**: Se comprueba el estado `status === 'running'` y se valida la forma e invariantes de `input` (`validateInput(input)`). Si la entrada no es válida, se lanza `EngineStepError('INVALID_GAME_INPUT')` sin mutar el estado del juego ni los efectos activos.
2. **Transformación**: Si la entrada es válida y `'polaridad'` está presente en `activeEffects`, se genera la entrada efectiva `effectiveInput`:
   ```ts
   const effectiveInput: StepInput = hasPolaridad
     ? {
         ...input,
         leftHeld: input.rightHeld,
         rightHeld: input.leftHeld,
         leftPressed: input.rightPressed,
         rightPressed: input.leftPressed,
         rotateClockwise: input.rotateCounterclockwise === true,
         rotateCounterclockwise: input.rotateClockwise === true,
       }
     : input;
   ```
3. **Procesado**: El motor procesa exclusivamente `effectiveInput`.

---

## 5. Interacción con DAS, ARR, Hold, Pausa, Game Over y Reset

- **DAS y ARR**: Los flancos y estados mantenidos llegan ya invertidos a `horizontalState`. `horizontalState.priority` almacena la dirección efectiva. Mantener físicamente la tecla izquierda produce repetición a la derecha; mantener la derecha produce repetición a la izquierda. Los cambios de prioridad simultáneos conservan las reglas de flancos actuales.
- **Hold**: `hold` no reduce `remainingPieces`. La Polaridad continúa activa sobre la pieza resultante del intercambio. Solo la fijación mediante `lockAndProcess()` decrementa el contador.
- **Pausa**: `remainingPieces` no se modifica durante la pausa. No se fijan piezas ni se emiten expiraciones.
- **Game Over**: `receiveSabotage('polaridad')` se ignora explícitamente cuando `status === 'gameOver'`. No muta `activeEffects`, `pendingGarbage` ni `storedSabotages`, no emite eventos y el snapshot final permanece congelado.
- **Reset**: `reset()` elimina el efecto sin emitir `effectExpired`.

---

## 6. Integración en la interfaz web (`apps/web`)

1. **`CombatStatusPanel.vue`**:
   - Muestra en el bloque de **EFECTOS ACTIVOS** el indicador de Polaridad con el contador de piezas:
     - `POLARIDAD · 1 PIEZA` (cuando `remainingPieces === 1`).
     - `POLARIDAD · 2 PIEZAS` (cuando `remainingPieces === 2`).
   - Sin animaciones visuales ni efectos complejos.
2. **Modo de demostración (`?polarity-demo=1`)**:
   - Inicia con Polaridad activa (`remainingPieces = 1`).
   - Almacena 2 cartuchos de Polaridad en `storedSabotages` para probar la renovación a `2`.
   - Ejecuta loopback de sabotajes al pulsar la tecla `A`.

---

## 7. Pruebas deterministas obligatorias

### Motor (`packages/game-engine`)
1. **Tipado exacto y snapshots**:
   - Activación inicial expone exactamente `{ type: 'polaridad', remainingPieces: 1 }`.
   - Renovación expone exactamente `{ type: 'polaridad', remainingPieces: 2 }`.
   - Tercera recepción mantiene `remainingPieces = 2`.
   - Única entrada de `'polaridad'` en `activeEffects`.
   - Tras la última fijación, Polaridad desaparece de `activeEffects`; **nunca** se observa `remainingPieces: 0`.
   - Una sola inversión aplicada independientemente de si el contador es 1 o 2.
2. **Eventos de dominio**:
   - Los eventos de Polaridad solo usan `durationPieces: 1 | 2`.
   - Activación inicial emite `effectStarted` con `durationPieces: 1`.
   - Renovación emite `effectStarted` con `durationPieces: 2`.
   - Nunca se emite `durationMs` para Polaridad ni `durationPieces` para Sobrecarga.
3. **Transformación de controles y DAS/ARR**:
   - Inversión de flancos horizontales (`leftPressed` ↔ `rightPressed`).
   - Inversión de estados mantenidos (`leftHeld` ↔ `rightHeld`).
   - DAS y ARR en la dirección efectiva inversa.
   - Giro horario transformado en antihorario y viceversa.
   - Soft drop y hard drop inalterados.
4. **Hold**:
   - `hold` funciona normalmente y **no** reduce `remainingPieces`.
5. **Fijación y expiración**:
   - Primera fijación de pieza reduce `remainingPieces` de 2 a 1 sin emitir `effectExpired`.
   - Segunda fijación reduce a 0, elimina el efecto de `activeEffects` y emite exactamente un evento `effectExpired`.
   - Activación con 1 pieza expira tras su primera fijación.
6. **Validación, Pausa, Game Over y Reset**:
   - Entrada inválida falla en la validación antes de transformar y no muta el estado.
   - Pausa congela el contador de piezas.
   - En `gameOver`, `receiveSabotage('polaridad')` sigue la política existente y no muta snapshot ni eventos (se comparan snapshot y eventos antes y después de la llamada).
   - `reset()` elimina el efecto sin emitir `effectExpired`.
7. **Determinismo**:
   - Misma semilla y secuencia de intenciones produce exactamente los mismos snapshots y eventos.

### Web (`apps/web`)
1. Renderizado de `POLARIDAD · 1 PIEZA`.
2. Renderizado de `POLARIDAD · 2 PIEZAS`.
3. Ausencia de la insignia cuando no hay efecto activo.
4. Pruebas del modo demo `?polarity-demo=1`.

---

## 8. Alcance excluido

Queda explícitamente excluido de la Tarea 0019:

- Sabotaje **Interferencia**.
- Inmunidad posterior al efecto o aviso previo.
- Bot, IA o segundo tablero interactivo.
- Multijugador o muerte súbita.
- Cambios de puntuación, energía o gravedad.
- Nuevos controles de usuario.
- Rediseño visual amplio.
- Composición genérica de modos demo.
