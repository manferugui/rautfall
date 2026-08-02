# Task 0022 — Bot heurístico determinista para batalla local

## Propósito

Sustituir el comportamiento provisional y pasivo de Player 2 en la Batalla Local determinista por un bot autonomo controlado por una IA heurística. El bot debe observar únicamente información permitida, evaluar colocaciones legales mediante simulación física directa, seleccionar la mejor jugada mediante una función heurística explícita y ejecutar sus decisiones paso a paso en el motor sin violar ninguna regla.

---

## Decisiones Aprobadas

1. **Ubicación:** `packages/battle-engine/src/bot/`
2. **Enumeración:** Búsqueda sobre estados alcanzables por acciones reales (Estrategia A) utilizando la capacidad de clonación del motor (`GameEngine.clone()`).
3. **Alcance inicial:**
   - Planificación de la pieza activa actual.
   - Ejecución física paso a paso mediante `StepInput`.
   - Retraso de reacción determinista en pasos lógicos (`BOT_REACTION_DELAY_STEPS = 15`).
   - Integración de Player 2 en `?battle-demo=1`.
4. **Exclusiones:**
   - `hold`;
   - uso automático de sabotajes;
   - lookahead de varias piezas;
   - selección estocástica subóptima;
   - múltiples niveles de dificultad;
   - construcción deliberada de T-Spins;
   - aprendizaje automático / redes neuronales;
   - backend, red y replays.

---

## Puerta Arquitectónica: API de Simulación en `@rautfall/game-engine`

### Necesidad Concreta
Para realizar la búsqueda BFS de estados alcanzables sin reimplementar colisiones, tablas SRS, wall kicks, lock delay ni gravedad dentro de `battle-engine`, el explorador de colocaciones necesita aplicar acciones reales `step()` sobre una instancia aislada del motor.

### Propuesta Contractual Mínima
Añadir el método `clone(): GameEngine` a la interfaz pública `GameEngine` en `@rautfall/game-engine`:

```ts
export interface GameEngine {
  step(input: StepInput): void;
  getSnapshot(): EngineSnapshot;
  drainEvents(): readonly GameEvent[];
  receiveSabotage(sabotage: SabotageType): void;
  reset(options: EngineOptions): void;
  /**
   * Crea una copia aislada e independiente del estado interno actual del motor.
   * La instancia clonada conserva exactamente la misma posición de pieza,
   * tablero, temporizadores, PRNGs y efectos, permitiendo simular pasos lógicos
   * sin mutar la partida real.
   */
  clone(): GameEngine;
}
```

### Garantías de Encapsulación y Determinismo
- `clone()` copia profundamente el tablero, estado de pieza activa, temporizadores y estado interno de los generadores PRNG.
- Invocar `step()` sobre un clon no emite eventos ni afecta el motor principal.
- No se exponen estructuras privadas ni se requieren setters o fixtures de test en producción.

---

## Modelo de Percepción, Decisión y Ejecución

```text
  ┌───────────────────────┐
  │  Perception Layer     │  Inspecciona EngineSnapshot de P2 e información permitida de P1
  └───────────┬───────────┘
              │
              ▼
  ┌───────────────────────┐
  │   Decision Layer      │  Búsqueda BFS con GameEngine.clone() + Evaluación Heurística
  └───────────┬───────────┘
              │  Produce BotPlan (secuencia inmutable de BotAction)
              ▼
  ┌───────────────────────┐
  │   Execution Layer     │  Retraso de reacción (15 ticks) + Generación de StepInput paso a paso
  └───────────────────────┘
```

---

## Especificación Modular

### 1. `packages/battle-engine/src/bot/types.ts`

Define las estructuras de datos puras del bot:

```ts
import type { Orientation, PieceType } from '@rautfall/game-engine';

export type BotAction =
  | 'left'
  | 'right'
  | 'rotateClockwise'
  | 'rotateCounterClockwise'
  | 'softDrop'
  | 'hardDrop'
  | 'wait';

export type BotHeuristicWeights = Readonly<{
  linesClearedWeight: number;
  aggregateHeightWeight: number;
  maxHeightWeight: number;
  holesWeight: number;
  bumpinessWeight: number;
  wellsWeight: number;
  topOutRiskWeight: number;
}>;

export type BotConfig = Readonly<{
  reactionDelaySteps: number;
  maxSearchNodes: number;
  heuristicWeights: BotHeuristicWeights;
}>;

export type PlacementCandidate = Readonly<{
  targetPlacement: Readonly<{ x: number; y: number; orientation: Orientation }>;
  actions: readonly BotAction[];
  heuristicScore: number;
  linesCleared: number;
  holes: number;
  maxHeight: number;
  boardFingerprint: string;
}>;

export type BotPlan = Readonly<{
  pieceType: PieceType;
  actions: readonly BotAction[];
  expectedBoardFingerprint: string;
}>;
```

---

### 2. `packages/battle-engine/src/bot/board-evaluator.ts`

Proporciona la evaluación pura de tableros post-colocación tras eliminación de líneas completas.

#### Métricas Evaluadas:
- `linesCleared`: Número de líneas borradas por la colocación.
- `aggregateHeight`: Suma de las alturas de las 10 columnas visibles ($y \in [4..23]$). La altura de la columna $c$ es $24 - \text{primera celda ocupada}$.
- `maxHeight`: Altura máxima entre las 10 columnas.
- `holes`: Número de celdas vacías que poseen al menos una celda ocupada por encima en la misma columna. Las celdas de tipo `'garbage'` cuentan como celdas ocupadas.
- `bumpiness`: Suma de las diferencias absolutas de altura entre columnas adyacentes ($\sum_{c=0}^8 |\text{height}[c] - \text{height}[c+1]|$).
- `wells`: Profundidad acumulada de huecos de 1 celda de ancho flanqueados por bloques o paredes.
- `topOutRisk`: Penalización si la altura máxima supera las 14 filas ($y < 10$).

####Pesos Iniciales (Hipótesis Centralizadas):
```ts
export const DEFAULT_BOT_HEURISTIC_WEIGHTS: BotHeuristicWeights = Object.freeze({
  linesClearedWeight: 100.0,
  aggregateHeightWeight: 5.0,
  maxHeightWeight: 10.0,
  holesWeight: 40.0,
  bumpinessWeight: 15.0,
  wellsWeight: 15.0,
  topOutRiskWeight: 50.0,
});
```

---

### 3. `packages/battle-engine/src/bot/placement-search.ts`

Algoritmo de búsqueda BFS determinista sobre estados alcanzables por acciones reales del motor.

#### Límite Centralizado:
```ts
export const BOT_MAX_SEARCH_NODES = 500;
```

#### Algoritmo:
1. Clona la instancia de `GameEngine` actual mediante `engine.clone()`.
2. Clave de estado para deduplicación: `${x}:${y}:${orientation}`.
3. Cola BFS que almacena `(engineClone, actionsPath)`.
4. En cada nodo:
   - Si la pieza está apoyada (`grounded`), simula un `hardDrop` en una copia del clon y evalúa el tablero resultante con `board-evaluator.ts`.
   - Si no se supera `BOT_MAX_SEARCH_NODES`, expande vecinos en orden de exploración estricto:
     1. `rotateClockwise`
     2. `rotateCounterClockwise`
     3. `left`
     4. `right`
     5. `softDrop`
5. Al finalizar la exploración, ordena los candidatos por el **Desempate Canónico Estricto**:
   1. Mayor puntuación heurística.
   2. Mayor número de líneas eliminadas.
   3. Menor número de huecos.
   4. Menor altura máxima.
   5. Orientación canónica (`0 < R < 2 < L`).
   6. Menor coordenada X.
   7. Secuencia de acciones lexicográficamente menor.

---

### 4. `packages/battle-engine/src/bot/deterministic-bot.ts`

Gestión de la percepción, retraso de reacción y emisión de `StepInput`.

#### Retraso de Reacción Centralizado:
```ts
export const BOT_REACTION_DELAY_STEPS = 15;
```

#### Ciclo de Vida:
1. **Percepción & Reacción:**
   - Si `activePiece` es `null` o el juego terminó (`gameOver`), emite entrada neutra vacía.
   - Si no hay plan activo o el plan actual se ha invalidado, inicia `reactionTimerSteps = 15` y calcula un nuevo `BotPlan` usando `placement-search.ts`.
   - Mientras `reactionTimerSteps > 0`, decrementa el temporizador en 1 por tick y emite entrada neutra vacía.
2. **Ejecución Paso a Paso:**
   - Una vez agotado el retardo de reacción, extrae la siguiente `BotAction` del plan y la convierte en `StepInput`.
   - Conversión exacta:
     - `'left'`: `{ leftPressed: true, leftHeld: true, rightHeld: false, rightPressed: false, softDropHeld: false, hardDrop: false }`
     - `'right'`: `{ rightPressed: true, rightHeld: true, leftHeld: false, leftPressed: false, softDropHeld: false, hardDrop: false }`
     - `'rotateClockwise'`: `{ rotateClockwise: true, leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false }`
     - `'rotateCounterClockwise'`: `{ rotateCounterclockwise: true, leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false }`
     - `'softDrop'`: `{ softDropHeld: true, leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, hardDrop: false }`
     - `'hardDrop'`: `{ hardDrop: true, leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false }`
     - `'wait'`: entrada neutra vacía.
3. **Invalidación del Plan:**
   - El plan se invalida inmediatamente si:
     - El tipo de pieza activa no coincide con `plan.pieceType`.
     - El tablero sufre cambios estructurales inesperados (por ejemplo, aplicación de filas basura).
     - La acción ejecutada no produjo el cambio de posición/orientación esperado.
   - Durante la **Polaridad Inversa**, las acciones horizontales y de rotación son invertidas por el motor. Al ejecutar la acción, el bot observa que la pieza se movió hacia el lado contrario a su plan, invalida el plan e inicia un nuevo retraso de reacción de 15 pasos. De este modo, el bot sufre desorientación real y no anula el sabotaje de forma omnisciente.

---

## Estrategia de Pruebas

1. `board-evaluator.test.ts`:
   - Verificación de métricas (altura agregada, máxima, huecos, bumpiness, pozos, riesgo de top-out) en tableros limpios, irregulares y con basura.
2. `placement-search.test.ts`:
   - Verificación de que la búsqueda BFS produce únicamente colocaciones alcanzables.
   - Respeto absoluto a SRS y wall-kicks mediante `GameEngine.clone()`.
   - Cumplimiento del límite `BOT_MAX_SEARCH_NODES`.
   - Desempate canónico determinista.
3. `deterministic-bot.test.ts`:
   - Cumplimiento estricto del retardo de reacción (15 pasos lógicos).
   - Inserción correcta de entradas válidas paso a paso.
   - Replanificación automática tras invalidación por basura o cambio de pieza.
   - Reacción con retraso ante Polaridad Inversa.
   - Comportamiento de reset.
4. `battle-engine.test.ts`:
   - Integración de P2 con el bot en `BattleSession`.
   - Avance en lockstep y enrutamiento de sabotajes P1 $\to$ P2 y P2 $\to$ P1.
5. `battle-demo.spec.ts` (E2E Web):
   - Verificación de que en `?battle-demo=1`, Player 2 se mueve y fija piezas activamente en el monitor rival.

---

## Archivos Previstos

### Paquete `@rautfall/game-engine`:
- `packages/game-engine/src/index.ts` *(Añadir `clone(): GameEngine`)*
- `packages/game-engine/src/game-engine.test.ts` *(Pruebas unitarias de `clone()`)*

### Paquete `@rautfall/battle-engine`:
- `packages/battle-engine/src/bot/types.ts`
- `packages/battle-engine/src/bot/board-evaluator.ts`
- `packages/battle-engine/src/bot/placement-search.ts`
- `packages/battle-engine/src/bot/deterministic-bot.ts`
- `packages/battle-engine/src/bot/board-evaluator.test.ts`
- `packages/battle-engine/src/bot/placement-search.test.ts`
- `packages/battle-engine/src/bot/deterministic-bot.test.ts`
- `packages/battle-engine/src/index.ts` *(Exportar la API pública del bot)*

### Aplicación `apps/web`:
- `apps/web/src/game/battle-demo.ts`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/e2e/battle-demo.spec.ts`

### Documentación:
- `docs/implementation/0022-bot-heuristico-determinista.md`
- `docs/project-status.md`
