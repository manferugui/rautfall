# 0024 — Muerte súbita determinista en la batalla local

## Estado

**Propuesta e Inmutable.**

---

## 1. Contexto

En el modo de Batalla Local de Rautfall (`@rautfall/battle-engine`), dos participantes compiten simultáneamente mediante la orquestación síncrona (*lockstep*) de dos instancias independientes de `@rautfall/game-engine`.

Actualmente, las batallas únicamente finalizan cuando uno o ambos participantes sufren una derrota por colapso de tablero (*top-out* o desbordamiento de filas basura). Si dos participantes humanos o dos bots juegan con un alto nivel de eficacia defensiva, la batalla puede prolongarse de manera indefinida sin un mecanismo determinista de aceleración de presión.

De acuerdo con las especificaciones de producto expresadas en [docs/rautfall.md](docs/rautfall.md), el juego exige una fase de **Muerte Súbita** gobernada por el tiempo lógico que incremente progresivamente la gravedad y la generación de energía de combate sin alterar el determinismo ni la condición fundamental de victoria por eliminación.

---

## 2. Objetivo

Diseñar la especificación técnica e inmutable para la Tarea 0024, definiendo:

1. La extensión general y desacoplada de `@rautfall/game-engine` para aceptar modificadores externos de presión de gravedad y generación de energía en cada paso lógico.
2. El modelo determinista de temporización y fases de **Muerte Súbita** en `@rautfall/battle-engine`, ajustado a las fronteras temporales oficiales de [docs/rautfall.md](docs/rautfall.md) (aviso desde 04:45, inicio a 05:00 con Fases 1, 2 y 3).
3. La conservación del contrato existente de `BattleStatus` (`'running' | 'playerOneWon' | 'playerTwoWon' | 'draw'`) y la adición del contrato complementario `SuddenDeathSnapshot` en `BattleSnapshot`.
4. La conservación estricta de la resolución de victoria o empate por eliminación, procesada síncronamente tras completar ambos motores en el mismo paso global.
5. Los escenarios de desarrollo DEV (`?battle-demo=1&sudden-death-demo=1`) y pruebas E2E correspondientes.

---

## 3. Estado previo

Al iniciar la Tarea 0024:

- `@rautfall/game-engine` calcula la gravedad activa combinando únicamente la gravedad base del nivel (`baseGravityCellsPerSecond`) y el multiplicador fijo de Sobrecarga ($3\times$). No existe un contrato público para recibir modificadores de gravedad o energía externos.
- `@rautfall/battle-engine` gestiona la sesión de batalla mediante `BattleSession.step(input)`, acumulando `elapsedMs` e inyectando las entradas en ambos motores, pero no evalúa fases de Muerte Súbita ni aplica modificadores progresivos sobre la partida.
- `BattleSnapshot` expone `step`, `elapsedMs`, `status`, `winner`, `playerOne` y `playerTwo`, pero no incluye información sobre Muerte Súbita.
- `apps/web` ejecuta el modo de batalla detrás de la bandera `?battle-demo=1`.

---

## 4. Alcance

1. **En `@rautfall/game-engine`:**
   - Definición e incorporación del tipo exportado `EngineModifiers` (`gravityMultiplier?: number`, `energyMultiplier?: number`).
   - Extensión opcional del contrato público `StepInput` mediante `modifiers?: EngineModifiers`.
   - Aplicación determinista del multiplicador externo de gravedad sobre `activeGravityCellsPerSecond`.
   - Aplicación determinista del multiplicador externo de energía sobre la energía generada en eliminaciones y combos (`generatedEnergy`).
2. **En `@rautfall/battle-engine`:**
   - Definición del tipo `SuddenDeathPhase` (`'inactive' | 'warning' | 'phase1' | 'phase2' | 'phase3'`).
   - Definición del tipo `SuddenDeathSnapshot` e integración dentro de `BattleSnapshot.suddenDeath`.
   - Lógica de derivación de fase de Muerte Súbita basada en `elapsedMs` acumulado (paso fijo de 10 ms):
     - `00:00.000` a `04:44.990` ($0 \le \text{elapsedMs} < 285.000$): fase `'inactive'`.
     - `04:45.000` a `04:59.990` ($285.000 \le \text{elapsedMs} < 300.000$): fase `'warning'`.
     - `05:00.000` a `05:29.990` ($300.000 \le \text{elapsedMs} < 330.000$): fase `'phase1'` (gravedad $\times 1.15$, energía $\times 1.20$).
     - `05:30.000` a `05:59.990` ($330.000 \le \text{elapsedMs} < 360.000$): fase `'phase2'` (gravedad $\times 1.30$, energía $\times 1.20$).
     - $\ge 06:00.000$ ($\text{elapsedMs} \ge 360.000$): fase `'phase3'` (gravedad $\times 1.50$, energía $\times 1.20$).
   - Emisión determinista de hechos transitorios (`BattleEvent`): `suddenDeathWarning`, `suddenDeathStarted` y `suddenDeathPhaseChanged`, emitidos **exactamente una sola vez** al cruzar la frontera del paso correspondiente.
   - Inyección simétrica y síncrona de `EngineModifiers` en las entradas enviadas a ambos motores (`playerOneEngine.step` y `playerTwoEngine.step`).
3. **En `apps/web`:**
   - Proyección técnica mínima de `BattleSnapshot.suddenDeath` en la consola DEV cuando aplique.
   - Modo demo DEV protegido `?battle-demo=1&sudden-death-demo=1` para simular un tiempo inicial cercano al aviso previa comprobación de `import.meta.env.DEV`.
   - Pruebas E2E de Playwright que verifiquen las transiciones temporales en el navegador.

---

## 5. Exclusiones

- **No se altera `BattleStatus`**: Conserva sus cuatro estados contractuales originales (`'running'`, `'playerOneWon'`, `'playerTwoWon'`, `'draw'`).
- **Sin límite máximo de duración (`maxBattleDurationMs`)**: La Muerte Súbita no detiene forzosamente la partida ni impone un tiempo límite tras el cual se declare un vencedor artificial. La Fase 3 se prolonga indefinidamente a gravedad $\times 1.50$ hasta la derrota de un participante.
- **Sin desempates artificiales**: No se evaluará desempate por altura de tablero, puntuación, líneas eliminadas u otras métricas.
- **Sin filas basura automáticas**: La Muerte Súbita no genera filas basura de forma periódica o automática sin intervención de sabotajes.
- **Sin reducción de inmunidad**: La regla descrita en la memoria preliminar sobre la reducción de periodos de inmunidad no se implementa en esta tarea al no existir aún un sistema general de inmunidades en la base de código.
- **Sin pantallas de menú o resultados en `apps/web`**: No se agregan modales de victoria, pantallas finales ni menús de selección de modo.

---

## 6. Decisiones de dominio

### 6.1 Desacoplamiento de modificadores en `@rautfall/game-engine`

Para evitar que `@rautfall/battle-engine` acceda ilegítimamente al estado mutable interno de `@rautfall/game-engine` o intente recalcular la energía a partir de eventos, se amplía la entrada lógica del motor individual mediante un contrato general de modificadores externos.

Se elige extender `StepInput` con la propiedad opcional `modifiers?: EngineModifiers`:

- **Justificación**:
  1. `StepInput` es el contrato público por paso enviado a `GameEngine.step(input)`.
  2. Al ser una propiedad opcional, se conserva el 100 % de compatibilidad retroactiva con todas las pruebas y consumidores existentes del motor individual.
  3. Evita introducir métodos de estado mutables en `GameEngine` (como `setModifiers`) o flags específicos de Muerte Súbita. `@rautfall/game-engine` permanece agnóstico sobre qué es una Muerte Súbita o qué orquestador la invoca; simplemente aplica multiplicadores numéricos genéricos.

### 6.2 Composición de gravedad y energía en `@rautfall/game-engine`

1. **Gravedad activa**:
   $$\text{activeGravityCellsPerSecond} = \text{baseGravityCellsPerSecond} \times ( \text{hasSobrecarga} ? 3 : 1 ) \times (\text{input.modifiers?.gravityMultiplier} ?? 1)$$
   - Durante Sobrecarga y Fase 1 de Muerte Súbita a Nivel 1 ($1.0\text{ c/s}$): $1.0 \times 3 \times 1.15 = 3.45\text{ c/s}$.

2. **Energía generada**:
   $$\text{generatedEnergy} = (\text{baseEnergy} + \text{comboEnergyBonus} + \text{backToBackEnergyBonus}) \times (\text{input.modifiers?.energyMultiplier} ?? 1)$$
   - Durante Muerte Súbita ($\times 1.20$), una eliminación de 1 línea ($10$ energía) genera $12$ unidades de energía de combate.

### 6.3 Modelo temporal y fronteras de Muerte Súbita

La temporalidad se mide estrictamente mediante el tiempo lógico acumulado `elapsedMs` (gobernado por `config.fixedStepMs = 10` ms por paso):

| Intervalo de `elapsedMs` | Paso lógico (`step`) | Fase (`SuddenDeathPhase`) | Gravedad ($\times$) | Energía ($\times$) | Evento emitido (una sola vez) |
|---|---|---|:---:|:---:|---|
| $0 \le t < 285.000\text{ ms}$ | $0 \le s < 28.500$ | `'inactive'` | $1.00$ | $1.00$ | Ninguno |
| $285.000 \le t < 300.000\text{ ms}$ | $28.500 \le s < 30.000$ | `'warning'` | $1.00$ | $1.00$ | `suddenDeathWarning` (en $s=28.500$) |
| $300.000 \le t < 330.000\text{ ms}$ | $30.000 \le s < 33.000$ | `'phase1'` | $1.15$ | $1.20$ | `suddenDeathStarted` (en $s=30.000$) |
| $330.000 \le t < 360.000\text{ ms}$ | $33.000 \le s < 36.000$ | `'phase2'` | $1.30$ | $1.20$ | `suddenDeathPhaseChanged` (en $s=33.000$) |
| $t \ge 360.000\text{ ms}$ | $s \ge 36.000$ | `'phase3'` | $1.50$ | $1.20$ | `suddenDeathPhaseChanged` (en $s=36.000$) |

---

## 7. Contratos afectados

### 7.1 En `@rautfall/game-engine`

```ts
/**
 * Modificadores externos aplicables al paso lógico del motor individual.
 */
export type EngineModifiers = Readonly<{
  gravityMultiplier?: number;
  energyMultiplier?: number;
}>;

/**
 * Entrada de un paso lógico del motor individual (ampliada opcionalmente).
 */
export type StepInput = {
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
  modifiers?: EngineModifiers;
};
```

### 7.2 En `@rautfall/battle-engine`

```ts
/**
 * Fases deterministas de Muerte Súbita en Batalla Local.
 */
export type SuddenDeathPhase =
  | 'inactive'
  | 'warning'
  | 'phase1'
  | 'phase2'
  | 'phase3';

/**
 * Instantánea inmutable del estado activo de Muerte Súbita.
 */
export type SuddenDeathSnapshot = Readonly<{
  phase: SuddenDeathPhase;
  warningRemainingMs: number;
  activeElapsedMs: number;
  gravityMultiplier: number;
  energyMultiplier: number;
}>;

/**
 * Instantánea global de la sesión de batalla (ampliada).
 */
export type BattleSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: BattleStatus;
  winner: BattleWinner;
  suddenDeath: SuddenDeathSnapshot;
  playerOne: EngineSnapshot;
  playerTwo: EngineSnapshot;
}>;

/**
 * Eventos transitorios de batalla (ampliados con hechos de Muerte Súbita).
 */
export type BattleEvent =
  | Readonly<{ type: 'battleStarted'; step: number }>
  | Readonly<{ type: 'battleReset'; step: number }>
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
    }>
  | Readonly<{
      type: 'suddenDeathWarning';
      step: number;
      warningRemainingMs: number;
    }>
  | Readonly<{
      type: 'suddenDeathStarted';
      step: number;
    }>
  | Readonly<{
      type: 'suddenDeathPhaseChanged';
      step: number;
      phase: SuddenDeathPhase;
      gravityMultiplier: number;
    }>;
```

---

## 8. Orden lógico del paso

En cada invocación de `BattleSession.step(input: BattleStepInput)`:

1. **Guarda de batalla terminal**:
   - Si `status !== 'running'`, lanzar `BattleStepError('BATTLE_NOT_RUNNING', 'Battle is not running')` sin mutar el estado.
2. **Validación de entradas**:
   - Prevalidar `input.playerOne` y `input.playerTwo` con `validateStepInput()`. Ante entrada inválida, lanzar `BattleStepError('INVALID_BATTLE_INPUT')`.
3. **Avance de contadores globales**:
   - Incrementar `step` en $1$.
   - Incrementar `elapsedMs` en `config.fixedStepMs` ($10$ ms).
4. **Derivación de Muerte Súbita y enrutamiento de modificadores**:
   - Calcular `suddenDeath` (`phase`, `warningRemainingMs`, `activeElapsedMs`, `gravityMultiplier`, `energyMultiplier`) en función del nuevo `elapsedMs`.
   - Si el paso actual alcanza exactamente la frontera de una nueva fase (paso $28.500$, $30.000$, $33.000$ o $36.000$), encolar el evento `BattleEvent` correspondiente (**una sola vez**).
   - Los multiplicadores de la fase activa se aplican **en este mismo paso** a ambos participantes.
5. **Composición e inyección de entradas**:
   - Construir `p1Input = { ...input.playerOne, modifiers: { gravityMultiplier, energyMultiplier } }`.
   - Construir `p2Input = { ...input.playerTwo, modifiers: { gravityMultiplier, energyMultiplier } }`.
6. **Ejecución lockstep síncrona**:
   - Ejecutar `playerOneEngine.step(p1Input)`.
   - Ejecutar `playerTwoEngine.step(p2Input)`.
7. **Drenaje y envoltorio de hechos primarios**:
   - Drenar eventos de `playerOneEngine` y `playerTwoEngine`, agregándolos a la cola de hechos como `participantEvent`.
8. **Enrutamiento de sabotajes cruzados**:
   - Procesar hechos `sabotageTriggered` de P1 $\to$ inyectar `receiveSabotage` en P2, emitir `sabotageRouted` y drenar hechos secundarios de P2.
   - Procesar hechos `sabotageTriggered` de P2 $\to$ inyectar `receiveSabotage` en P1, emitir `sabotageRouted` y drenar hechos secundarios de P1.
9. **Inspección síncrona de terminalidad**:
   - Obtener los snapshots resultantes tras haber completado el procesamiento de ambos motores en el paso actual:
     - `p1GameOver = playerOneEngine.getSnapshot().status === 'gameOver'`
     - `p2GameOver = playerTwoEngine.getSnapshot().status === 'gameOver'`
   - **Evaluación de condiciones**:
     - Si `p1GameOver && p2GameOver`: `status = 'draw'`, `winner = 'draw'`, emitir `battleEnded`.
     - Si `p1GameOver && !p2GameOver`: `status = 'playerTwoWon'`, `winner = 'playerTwo'`, emitir `battleEnded`.
     - Si `!p1GameOver && p2GameOver`: `status = 'playerOneWon'`, `winner = 'playerOne'`, emitir `battleEnded`.
   - La ordenación interna del bucle (evaluar P1 antes que P2) no puede impedir la detección de un empate simultáneo, ya que los estados finales se inspeccionan **después** de procesar a ambos participantes.
10. **Publicación de la instantánea**:
    - Devolver `getSnapshot()` inmutable.

---

## 9. Invariantes

1. **Independencia del motor individual**: `@rautfall/game-engine` desconoce la existencia de la Muerte Súbita o de `BattleSession`. Solo reacciona a modificadores numéricos genéricos enviados en `StepInput.modifiers`.
2. **Determinismo absoluto**: A partir de la misma semilla e idéntica secuencia de `BattleStepInput`, la sesión produce exactamente el mismo historial de snapshots, fases y eventos.
3. **Simetría estricta de presión**: `playerOne` y `playerTwo` reciben exactamente los mismos multiplicadores de Muerte Súbita en el mismo paso lógico global.
4. **Emisión de eventos única**: Los hechos `suddenDeathWarning`, `suddenDeathStarted` y `suddenDeathPhaseChanged` se emiten exactamente una sola vez cuando `step` cruza el umbral correspondiente.
5. **No retroactividad ni aceleración de tiempo real**: La Muerte Súbita modifica la velocidad lógica del juego y la ganancia de energía; no altera el intervalo del paso lógico fijo (`fixedStepMs = 10` ms).
6. **Invarianza de pausa**: La pausa gestionada en la capa de presentación (`apps/web`) detiene las llamadas a `BattleSession.step()`. El tiempo lógico `elapsedMs` no avanza mientras la partida esté pausada.

---

## 10. Pruebas requeridas

### 10.1 Fronteras temporales exactas

- **$284.990\text{ ms}$ (paso $28.499$)**: `phase = 'inactive'`, `warningRemainingMs = 0`, multiplicadores $1.0 / 1.0$.
- **$285.000\text{ ms}$ (paso $28.500$)**: `phase = 'warning'`, `warningRemainingMs = 15.000`, multiplicadores $1.0 / 1.0$.
- **$299.990\text{ ms}$ (paso $29.999$)**: `phase = 'warning'`, `warningRemainingMs = 10`, multiplicadores $1.0 / 1.0$.
- **$300.000\text{ ms}$ (paso $30.000$)**: `phase = 'phase1'`, `warningRemainingMs = 0`, `activeElapsedMs = 0`, gravedad $\times 1.15$, energía $\times 1.20$.
- **$329.990\text{ ms}$ (paso $32.999$)**: `phase = 'phase1'`, `activeElapsedMs = 29.990`, gravedad $\times 1.15$, energía $\times 1.20$.
- **$330.000\text{ ms}$ (paso $33.000$)**: `phase = 'phase2'`, `activeElapsedMs = 30.000`, gravedad $\times 1.30$, energía $\times 1.20$.
- **$359.990\text{ ms}$ (paso $35.999$)**: `phase = 'phase2'`, `activeElapsedMs = 59.990`, gravedad $\times 1.30$, energía $\times 1.20$.
- **$360.000\text{ ms}$ (paso $36.000$)**: `phase = 'phase3'`, `activeElapsedMs = 60.000`, gravedad $\times 1.50$, energía $\times 1.20$.

### 10.2 Emisión única de eventos

- `suddenDeathWarning` se emite únicamente en el paso $28.500$.
- `suddenDeathStarted` se emite únicamente en el paso $30.000$.
- `suddenDeathPhaseChanged` (`phase2`) se emite únicamente en el paso $33.000$.
- `suddenDeathPhaseChanged` (`phase3`) se emite únicamente en el paso $36.000$.
- Ningún evento se reemite en los pasos intermedios ni en ejecuciones subsecuentes de la misma fase.

### 10.3 Composición y simetría

- Verificación de la gravedad activa combinada: $\text{baseGravity} \times 3\text{ (Sobrecarga)} \times 1.15\text{ (Fase 1)} = 3.45\text{ c/s}$.
- Verificación del incremento de energía: eliminación de 1 línea otorga $12$ energía (frente a los $10$ ordinarios) durante Muerte Súbita.
- P1 y P2 experimentan exactamente los mismos multiplicadores en cada paso.

### 10.4 Terminalidad, avance y reset

- Verificación de victoria de P2 cuando P1 sufre `gameOver` en Muerte Súbita.
- Verificación de victoria de P1 cuando P2 sufre `gameOver` en Muerte Súbita.
- Verificación de `draw` cuando P1 y P2 sufren `gameOver` en el mismo paso global durante Muerte Súbita.
- Invocación de `step()` tras finalizar la batalla lanza `BattleStepError('BATTLE_NOT_RUNNING')`.
- `reset()` reinicia `step` a $0$, `elapsedMs` a $0$, `phase` a `'inactive'` y limpia la cola de eventos.

### 10.5 Regresión

- Todas las pruebas existentes en el monorepo y las nuevas pruebas de Muerte Súbita deben pasar en verde.

---

## 11. Escenarios DEV y E2E

1. **Modo Demo DEV (`?battle-demo=1&sudden-death-demo=1`):**
   - Protegido explícitamente mediante `import.meta.env.DEV`.
   - Permite opcionalmente inicializar la sesión de batalla con un offset de tiempo lógico simulado (por ejemplo, `elapsedMs = 280_000` ms / paso $28.000$), de modo que el aviso y las tres fases de Muerte Súbita puedan observarse visualmente en menos de 90 segundos de juego real sin esperar 5 minutos.
   - No altera los valores ni la configuración por defecto de producción.
2. **Pruebas E2E en Playwright:**
   - Crear una prueba en `apps/web/e2e/sudden-death.spec.ts` utilizando la URL `?battle-demo=1&sudden-death-demo=1`.
   - Verificar la transición temporal del aviso y las fases mediante la inspección de la telemetría en la interfaz.

---

## 12. Validaciones obligatorias

Antes de declarar completada la implementación futura de la Tarea 0024, se ejecutarán los scripts reales del repositorio desde la raíz:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
git diff --check
git status --short
```

---

## 13. Criterios de aceptación

1. `@rautfall/game-engine` exporta `EngineModifiers` y acepta la propiedad opcional `modifiers` en `StepInput`, aplicando los multiplicadores de gravedad y energía de forma determinista.
2. `@rautfall/battle-engine` evalúa y transiciona deterministamente las fases de Muerte Súbita (`inactive`, `warning`, `phase1`, `phase2`, `phase3`) en los umbrales lógicos de 04:45, 05:00, 05:30 y 06:00.
3. `BattleSnapshot` incluye la propiedad `suddenDeath: SuddenDeathSnapshot` con los datos de fase, tiempos restantes/activos y multiplicadores vigentes.
4. `BattleStatus` conserva sus valores originales (`'running' | 'playerOneWon' | 'playerTwoWon' | 'draw'`) y la condición de victoria/empate por eliminación permanece inalterada.
5. Los hechos `suddenDeathWarning`, `suddenDeathStarted` y `suddenDeathPhaseChanged` se emiten exactamente una vez por paso de transición.
6. El escenario DEV `?battle-demo=1&sudden-death-demo=1` permite probar el flujo de Muerte Súbita sin alterar producción.
7. Todos los comandos de validación obligatorios finalizan sin errores ni avisos.

---

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Acumulación de gravedad excesiva en niveles altos durante Fase 3 | Dificultad extrema de juego | La gravedad se aplica sobre el acumulador vertical por unidades de celda (`VERTICAL_CELL_UNIT = 1000`), garantizando la resolución determinista de saltos de fila sin bucles infinitos. |
| Incoherencias en el redondeo de energía multiplicada por $1.20$ | Divergencia o errores flotantes | La energía generada aplica el multiplicador $1.20$ sobre valores enteros base ($10, 25, 45, 70$), produciendo cantidades exactas sin necesidad de truncamientos o redondeos arbitrarios. |
| Ruptura de compatibilidad con clientes existentes de `StepInput` | Fallos en tests previos de `game-engine` | `modifiers` se define como propiedad opcional (`modifiers?: EngineModifiers`). Si está ausente o es `undefined`, el motor asume multiplicadores por defecto de $1.0$. |

---

## 15. Archivos previstos

### Creados:
- `docs/tasks/0024-muerte-subita-determinista-batalla-local.md` *(este documento)*
- `apps/web/e2e/sudden-death.spec.ts`

### Modificados (en futura implementación):
- `packages/game-engine/src/index.ts`
- `packages/battle-engine/src/index.ts`
- `packages/battle-engine/src/battle-engine.test.ts`
- `apps/web/src/game/scenes/GameScene.ts`

---

## 16. Fuera de alcance futuro

- Sistema de inmunidad post-efecto y reducción de tiempos de inmunidad durante Muerte Súbita (diferido a tareas de balance).
- Pantalla visual de resultados, modales de fin de batalla y navegación en `apps/web`.
- Filas basura automáticas o periódicas por temporizador.
- Desempate por métricas de puntuación o altura de tablero.
- Backend, autenticación, persistencia y replays.
