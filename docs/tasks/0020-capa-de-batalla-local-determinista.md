# 0020 — Capa de batalla local determinista entre dos motores

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

Implementar en el nuevo paquete **`packages/battle-engine`**:

1. La **capa de orquestación de batalla local (`BattleSession`)**, que ejecuta dos motores independientes de `@rautfall/game-engine` en bucle síncrono determinista (lockstep).
2. El enrutamiento cruzado de sabotajes entre participantes ($A \to B$ y $B \to A$), eliminando la necesidad de loopback.
3. La conservación, preservación del orden y publicación de todos los eventos de dominio internos de cada motor (`GameEvent` / `EngineEvent`) como `participantEvent`, sin perder hechos transitorios ni distorsionar los datos del motor.
4. La gestión del ciclo de vida del combate: inicio, avance determinista, finalización por victoria de Player 1 (`playerOneWon`), victoria de Player 2 (`playerTwoWon`), empate por game over simultáneo (`draw`) y reinicio coordinado (`reset`).
5. En **`packages/game-engine`**:
   - La **separación de flujos pseudoaleatorios (PRNG)** entre generación de piezas y efectos/basura como prerrequisito interno obligatorio, garantizando que dos motores con la misma semilla principal mantengan exactamente la misma secuencia de piezas aunque reciban sabotajes diferentes.
   - La exportación explícita de `EngineEvent` (alias/exportación pública de `GameEvent`) y de la función pura de prevalidación `validateStepInput(input)`.
6. En **`apps/web`**: la integración técnica mínima mediante un modo de desarrollo aislado (**`?battle-demo=1`**), sin alterar la vista principal ni sustituir el monitor rival simulado en esta tarea.

---

## 2. Ubicación arquitectónica

Se aprueba la creación del paquete **`packages/battle-engine`** (`@rautfall/battle-engine`):

- **Dependencias**: Dependerá de `@rautfall/game-engine` y `@rautfall/game-config`.
- **Aislamiento**: Sin dependencias de Vue, Phaser, DOM, Canvas ni API del navegador.
- **Reutilización**: Diseñado para ser directamente reutilizable en backend Node.js, herramientas CLI de simulación, benchmark de bots y replay determinista.
- **Restricciones de arquitectura**:
  - No ubicar lógica de orquestación de batalla en `apps/web`.
  - No extender `packages/game-engine` para contener dos participantes.
  - No introducir infraestructura adicional de red, WebSockets ni backend.

---

## 3. Prerrequisitos en `packages/game-engine`

### 3.1 Separación determinista de flujos PRNG

En `packages/game-engine`, la inicialización del motor derivará deterministamente dos sub-semillas únicas a partir de la semilla principal:

```ts
const pieceSeed = deriveSeed(seed, 'pieces');
const effectsSeed = deriveSeed(seed, 'effects');
```

- **Flujo de piezas**: La bolsa de siete (7-bag) y la cola de próximas piezas consumen **exclusivamente** `pieceSeed`.
- **Flujo de efectos y basura**: La generación de huecos de basura y futuros efectos aleatorios consumen **exclusivamente** `effectsSeed`.
- Dos motores con la misma semilla principal conservan la misma secuencia de piezas aunque reciban sabotajes diferentes.
- No se comparte estado PRNG mutable entre motores.

### 3.2 Prevalidación de entradas y exportación de tipos de eventos

- `packages/game-engine` exportará la función pura `validateStepInput(input: unknown): void` para prevalidar `StepInput` sin ejecutar `step()`.
- `packages/game-engine` exportará `EngineEvent` (como alias o exportación directa del tipo público `GameEvent`).

---

## 4. Estado de batalla y eliminación de la pausa en `battle-engine`

```ts
export type BattleStatus =
  | 'running'
  | 'playerOneWon'
  | 'playerTwoWon'
  | 'draw';
```

- La pausa no pertenece a `packages/battle-engine`. `pause()`, `resume()`, `togglePause()`, `battlePaused` y `battleResumed` quedan **eliminados** del paquete.
- `apps/web` pausa la partida dejando de invocar `battleSession.step()`.

---

## 5. Contrato público de `packages/battle-engine`

```ts
import type { GameConfig } from '@rautfall/game-config';
import type { EngineEvent, EngineSnapshot, SabotageType, StepInput } from '@rautfall/game-engine';

export type BattleParticipant = 'playerOne' | 'playerTwo';

export type BattleWinner =
  | 'playerOne'
  | 'playerTwo'
  | 'draw'
  | null;

export type BattleStepInput = Readonly<{
  playerOne: StepInput;
  playerTwo: StepInput;
}>;

export type BattleSessionOptions = Readonly<{
  seed: number;
  config: GameConfig;
}>;

export type BattleSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: BattleStatus;
  winner: BattleWinner;
  playerOne: EngineSnapshot;
  playerTwo: EngineSnapshot;
}>;

export type BattleEvent =
  | Readonly<{
      type: 'battleStarted';
      step: number;
    }>
  | Readonly<{
      type: 'battleReset';
      step: number;
    }>
  | Readonly<{
      type: 'participantEvent';
      step: number;
      participant: BattleParticipant;
      event: EngineEvent;
    }>
  | Readonly<{
      type: 'sabotageRouted';
      step: number;
      source: BattleParticipant;
      target: BattleParticipant;
      sabotage: SabotageType;
    }>
  | Readonly<{
      type: 'battleEnded';
      step: number;
      winner: Exclude<BattleWinner, null>;
    }>;

export interface BattleSession {
  step(input: BattleStepInput): BattleSnapshot;
  getSnapshot(): BattleSnapshot;
  drainEvents(): readonly BattleEvent[];
  reset(): BattleSnapshot;
}
```

### 5.1 Reglas del contrato

- `config` es obligatorio en `BattleSessionOptions`.
- `reset()` reutiliza exactamente la semilla y configuración originales. No se acepta `newSeed?`.
- No se exponen las instancias internas de los motores ni sus colas de eventos separadas.
- No se permiten mutaciones directas de participantes.
- Los snapshots y eventos devueltos son congelados e inmutables.

---

## 6. Reglas de publicación y conservación de eventos de dominio (`participantEvent`)

1. **Conservación de hechos transitorios**: Al drenar eventos de `playerOneEngine` y `playerTwoEngine`, cada evento (`pieceMoved`, `pieceRotated`, `pieceLocked`, `linesCleared`, `levelUp`, `effectStarted`, `effectExpired`, `gameOver`, `sabotageTriggered`, etc.) se preserva y se publica envuelto en un `participantEvent`.
2. **Estructura**:
   ```ts
   Readonly<{
     type: 'participantEvent';
     step: number; // Paso de batalla actual
     participant: 'playerOne' | 'playerTwo';
     event: EngineEvent; // Evento original intacto sin reescribir su EngineEvent.step interno
   }>
   ```
3. **`sabotageTriggered`**: El uso de `sabotageTriggered` para enrutar el sabotaje **no lo elimina ni lo sustituye**. Permanece visible como `participantEvent` de ese jugador.
4. **Acceso exclusivo**: Los eventos internos solo son accesibles a través de `BattleSession.drainEvents()`. No son recuperables desde `BattleSnapshot`.

---

## 7. Orden canónico observable de un lockstep

Cada llamada a `battleSession.step(input)` ejecuta las tres fases en orden estricto:

### Fase 1: Validación y Ejecución de Motores
1. Verificar `status === 'running'` (si no, lanzar `BattleStepError('BATTLE_NOT_RUNNING')`).
2. Validar atómicamente `input.playerOne` e `input.playerTwo` con `validateStepInput`. Si falla, lanzar `BattleStepError('INVALID_BATTLE_INPUT')` sin mutar nada.
3. Incrementar una sola vez `step` (+1) y `elapsedMs` (+`config.fixedStepMs`) de la batalla.
4. Ejecutar `playerOneEngine.step(input.playerOne)`.
5. Ejecutar `playerTwoEngine.step(input.playerTwo)`.
6. Drenar eventos de P1. Drenar eventos de P2.
7. Publicar como `participantEvent` (P1) todos los eventos originales de P1 en su orden original.
8. Publicar como `participantEvent` (P2) todos los eventos originales de P2 en su orden original.

### Fase 2: Resolución Terminal
9. Inspeccionar los snapshots de ambos motores.
10. Si la batalla termina (`gameOver` en uno o ambos motores):
    - Si ambos en `gameOver` $\to$ `status = 'draw'`, `winner = 'draw'`.
    - Si solo P1 en `gameOver` $\to$ `status = 'playerTwoWon'`, `winner = 'playerTwo'`.
    - Si solo P2 en `gameOver` $\to$ `status = 'playerOneWon'`, `winner = 'playerOne'`.
    - Emitir exactamente un `battleEnded`.
    - **No enrutar sabotajes** emitidos en este paso.
    - **No ejecutar `receiveSabotage()`** sobre ningún participante.
    - Finalizar el lockstep y publicar el snapshot.

### Fase 3: Enrutamiento y Eventos Causados si la batalla continúa
11. Recorrer los `sabotageTriggered` originales de P1 en su orden:
    - Invocar `playerTwoEngine.receiveSabotage(sabotage)`.
    - Emitir `sabotageRouted` (P1 $\to$ P2).
    - Drenar inmediatamente los nuevos eventos generados en P2 (ej. `effectStarted`, `garbageApplied`).
    - Publicar inmediatamente esos eventos como `participantEvent` (P2) en el mismo lockstep.
12. Recorrer los `sabotageTriggered` originales de P2 en su orden:
    - Invocar `playerOneEngine.receiveSabotage(sabotage)`.
    - Emitir `sabotageRouted` (P2 $\to$ P1).
    - Drenar inmediatamente los nuevos eventos generados en P1.
    - Publicar inmediatamente esos eventos como `participantEvent` (P1) en el mismo lockstep.
13. Publicar el `BattleSnapshot` final.

---

## 8. Creación inicial y Operación `reset()`

- **Creación inicial (`createBattleSession`)**:
  - Los eventos iniciales del motor (`engineStarted`, `pieceSpawned`) se drenan y descartan.
  - La cola inicial de eventos contiene **únicamente**: `{ type: 'battleStarted', step: 0 }`.
- **Operación `reset()`**:
  - Recrea/reinicia ambos motores con la semilla y configuración originales.
  - Restablece `step = 0`, `elapsedMs = 0`, `status = 'running'`, `winner = null`.
  - Los eventos de reset del motor se drenan y descartan.
  - La cola de eventos tras `reset()` contiene **únicamente**: `{ type: 'battleReset', step: 0 }`.

---

## 9. Integración web mínima (`apps/web`)

- **Modo normal**: La aplicación normal de 1 jugador no sufre modificaciones. `OpponentMonitor.vue` conserva la insignia `SIMULADO` y la matriz estática.
- **Pausa web**: La web pausa dejando de invocar `battleSession.step()`.
- **Modo demo (`?battle-demo=1`)**:
  - P1 controlado por teclado humano.
  - P2 controlado por entrada neutra o guion scriptado determinista.
  - Tecla `A` dispara sabotajes que el orquestador enruta realmente a P2.
  - Muestra un panel de depuración técnico DEV con `status`, `winner`, `step`, eventos y métricas de P2.
  - Demuestra la eliminación del loopback.

---

## 10. Pruebas deterministas obligatorias

### 10.1 `packages/game-engine`
1. Misma semilla produce la misma secuencia de piezas.
2. Sabotaje *Residuos* en un motor no altera la secuencia futura de piezas en el otro.
3. Huecos de basura consumen `effectsSeed`.
4. `reset()` reproduce piezas y efectos.
5. Semillas distintas divergen.
6. Exportación de `validateStepInput` y `EngineEvent`.

### 10.2 `packages/battle-engine`
1. Creación emite únicamente `battleStarted` (`step: 0`).
2. Avance exacto en lockstep (`step` y `elapsedMs` incrementan 1 vez).
3. `participantEvent` conserva exactamente el `EngineEvent` original y atribuye al participante correcto (`playerOne` o `playerTwo`).
4. Los eventos de P1 se publican antes que los de P2 en la Fase 1.
5. El orden interno de cada participante se conserva intacto.
6. `sabotageTriggered` permanece visible como `participantEvent`.
7. `sabotageRouted` se emite tras el `sabotageTriggered` original.
8. Eventos causados por `receiveSabotage()` (ej. `effectStarted`) se publican en el mismo lockstep.
9. Sabotajes simultáneos respetan la serialización P1 $\to$ P2 y luego P2 $\to$ P1.
10. Si la batalla termina, no hay `sabotageRouted` ni eventos causados por recepción.
11. `battleEnded` se emite tras los `participantEvent` del paso terminal.
12. Victoria P1, victoria P2 y empate (`draw`) por `gameOver` simultáneo.
13. Paso en estado terminal lanza `BattleStepError('BATTLE_NOT_RUNNING')`.
14. Reset limpia la cola anterior y emite únicamente `battleReset`.
15. Validación atómica: entrada inválida de P1 o P2 no muta ningún motor.
16. Inmutabilidad de snapshots y eventos de `drainEvents()`.

### 10.3 `apps/web`
1. Activación exclusiva de `?battle-demo=1`.
2. P1 recibe teclado, P2 recibe neutro/script.
3. Actualización de panel DEV de batalla.
4. Pausa impide llamadas a `step()`.
5. Fuera de demo, comportamiento 1P intacto.

---

## 11. Alcance excluido

Queda explícitamente excluido de la Tarea 0020:
- Bot / IA heurística.
- Sabotaje *Interferencia*.
- Segundo tablero funcional visible en producción.
- Sustitución de `OpponentMonitor.vue` por el tablero rival real.
- Segundo canvas o rediseño de escenas Phaser.
- Red, WebSockets, backend, matchmaking o ranking.
- Replay completo o herramientas de grabación.
- Muerte súbita, avisos previos e inmunidad avanzada.
- Efectos de audio o rediseño visual amplio.

---

## 12. Criterios de aceptación

1. Dos motores avanzan en lockstep síncrono en `BattleSession`.
2. Misma semilla conserva idéntica secuencia de piezas aunque reciban basura o efectos aleatorios distintos.
3. Sabotajes enrutados al rival real ($A \to B$ y $B \to A$) sin loopback.
4. Eventos de dominio internos se preservan en `participantEvent` en el orden canónico observable en el mismo lockstep.
5. `sabotageRouted` y eventos secundarios del receptor se emiten en el mismo lockstep.
6. Resolución determinista de victorias y empate simultáneo.
7. Validación atómica que impide la mutación parcial ante entradas inválidas.
8. Pausa gestionada en la web dejando de invocar `step()`.
9. `reset()` restaura la sesión con semilla y configuración originales.
10. `packages/battle-engine` es 100% independiente de navegador, Vue, Phaser y DOM.
11. Aplicación de 1 jugador intacta.
12. Todos los comandos raíz (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`) finalizan sin errores ni avisos.
