# Informe de implementación — 0020: Capa de batalla local determinista entre dos motores

## Resumen

Se ha implementado con éxito la **Tarea 0020**, introduciendo el paquete `@rautfall/battle-engine` como la capa de orquestación local, determinista y headless entre dos motores de juego independientes. Además, se han separado los flujos pseudoaleatorios (PRNG) en `@rautfall/game-engine` para piezas y efectos, garantizando la igualdad absoluta de secuencia de piezas entre participantes con la misma semilla aunque reciban basura o sabotajes diferentes. En la aplicación web (`apps/web`), se ha integrado el escenario de desarrollo aislado `?battle-demo=1` con instrumentación táctica DEV de 2P.

- **Total de pruebas en el monorepo:** 583 en Vitest (330 en `game-engine`, 17 en `battle-engine`, 236 en `web/config`) + 1 prueba E2E en Playwright.
- **Lint, Typecheck y Build:** 100% limpios sin errores ni avisos.

---

## Archivos creados y modificados

### Creados
- `packages/battle-engine/package.json`: Definición del nuevo paquete workspace `@rautfall/battle-engine`.
- `packages/battle-engine/tsconfig.json`: Configuración de TypeScript del paquete.
- `packages/battle-engine/src/index.ts`: Implementación de la API pública, factoría `createBattleSession`, lockstep, validación atómica, enrutamiento síncrono de sabotajes, resolución terminal y tipos.
- `packages/battle-engine/src/battle-engine.test.ts`: 17 pruebas deterministas completas del orquestador de batalla.
- `apps/web/src/game/battle-demo.ts`: Módulo de desarrollo `?battle-demo=1`.
- `apps/web/src/game/battle-demo.test.ts`: Pruebas unitarias de `battle-demo`.
- `docs/implementation/0020-capa-de-batalla-local-determinista.md`: Este informe de implementación.

### Modificados
- `packages/game-engine/src/index.ts`: Implementada la derivación determinista de sub-semillas (`deriveSeed`), separación de `piecePrng` y `effectsPrng`, exportación de `EngineEvent` y de `validateStepInput(input)`.
- `packages/game-engine/src/game-engine.test.ts`: Añadidas 6 pruebas unitarias para la separación de PRNG y `validateStepInput`.
- `apps/web/package.json`: Añadida la dependencia de workspace `@rautfall/battle-engine`.
- `apps/web/src/game/types.ts`: Añadida la interfaz `BattlePresentationState` y extendido `GamePresentationState` con el campo opcional `battleState`.
- `apps/web/src/game/scenes/GameScene.ts`: Integrada la gestión de `BattleSession` durante la activación de `?battle-demo=1`, enrutamiento transparente y notificación de `battleState`.
- `apps/web/src/App.vue`: Añadida la consola táctica de depuración DEV para presentar `battleState` en el modo `?battle-demo=1`.
- `docs/project-status.md`: Actualizado con el registro de finalización de la Tarea 0020.

---

## Decisiones relevantes

1. **Paquete dedicado `packages/battle-engine`**: Mantiene la arquitectura limpia y desacoplada de la web (0% Phaser/Vue/DOM), lista para su reutilización en backend Node.js, CLI simulator, benchmarking de bots y replay determinista.
2. **Separación determinista del PRNG**: `deriveSeed(seed, 'pieces')` e `effectsSeed = deriveSeed(seed, 'effects')` garantizan que las piezas (bolsa de 7 y queue de 3) no consuman la misma secuencia pseudoaleatoria que la colocación de huecos de basura. Dos jugadores arrancan y progresan con la misma secuencia de piezas aunque uno reciba basura y el otro no.
3. **Validación atómica**: La prevalidación de la entrada conjunta (`BattleStepInput`) en `step()` asegura que ante una entrada inválida de P1 o P2, ningún motor avanza ni muta su estado.
4. **Publicación y conservación de eventos (`participantEvent`)**: Los eventos drenados de cada motor se envuelven intactos conservando su `step` interno. Los sabotajes simultáneos se serializan deterministamente (P1 $\to$ P2 y P2 $\to$ P1) drenando y publicando en el mismo paso de batalla los eventos secundarios causados en el receptor (ej. `effectStarted`).
5. **Pausado fuera del paquete**: `@rautfall/battle-engine` no gestiona estados de pausa. La web pausing se realiza dejando de invocar `battleSession.step()`.

---

## API pública producida

```ts
export type BattleParticipant = 'playerOne' | 'playerTwo';

export type BattleStatus =
  | 'running'
  | 'playerOneWon'
  | 'playerTwoWon'
  | 'draw';

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

En `@rautfall/game-engine`:
```ts
export type EngineEvent = GameEvent;
export function validateStepInput(input: unknown): asserts input is StepInput;
```

---

## Pruebas añadidas

- **`packages/game-engine` (6 nuevas pruebas)**:
  - Misma semilla genera idéntica secuencia de piezas.
  - Recepción de Residuos no altera la secuencia de piezas.
  - Determinismo en huecos de basura.
  - Reset de PRNGs de piezas y efectos.
  - Divergencia de semillas distintas.
  - Validación de `validateStepInput`.
- **`packages/battle-engine` (17 pruebas)**:
  - `battleStarted` en creación.
  - Snapshot inicial síncrono.
  - Lockstep determinista.
  - Secuencia de piezas compartida e insensibilidad a inputs/Residuos.
  - Enrutamiento síncrono P1 $\to$ P2 y P2 $\to$ P1.
  - Serialización de sabotajes simultáneos.
  - Conservación de `EngineEvent` en `participantEvent` en orden canónico.
  - Publicación en el mismo lockstep de eventos causados por el receptor.
  - Victoria de P1, P2 y empate (`draw`).
  - Terminalidad y error `BATTLE_NOT_RUNNING`.
  - Validación atómica (`INVALID_BATTLE_INPUT`).
  - Reset coordinado y emisión de `battleReset`.
  - Vaciado de cola de eventos e inmutabilidad de snapshots/eventos.
- **`apps/web` (4 nuevas pruebas)**:
  - Activación e inactividad del modo `?battle-demo=1`.
  - Creación de la `BattleSession` de demo.
  - Ayuda `BATTLE_DEMO_HELP`.

---

## Comandos ejecutados y resultados

- `pnpm test`: 583 tests en Vitest pasando (100% OK).
- `pnpm lint`: ESLint sin errores ni avisos (100% OK).
- `pnpm typecheck`: TypeScript en los 4 paquetes/aplicaciones en verde (100% OK).
- `pnpm build`: Compilación de producción con Vite exitosa.
- `pnpm test:e2e`: Playwright E2E passing (100% OK).

---

## Desviaciones

Ninguna. La implementación cumple estrictamente la especificación [0020-capa-de-batalla-local-determinista.md](file:///home/manuel/dev/rautfall/docs/tasks/0020-capa-de-batalla-local-determinista.md).

---

## Trabajo pendiente (para Tarea 0021)

- Integración visual real del segundo tablero en `OpponentMonitor.vue` leyendo el snapshot de Player 2.
- Sustitución progresiva de la insignia y matriz estáticas `SIMULADO`.
- Incorporación del bot IA heurístico.

---

## Confirmación del alcance excluido

Se confirma que no se ha implementado:
- Bot o Inteligencia Artificial heurística.
- Sabotaje *Interferencia*.
- Renderizado de un segundo canvas Phaser ni segundo tablero en producción.
- Sustitución de `OpponentMonitor.vue` por el tablero rival en el modo 1P normal.
- Servidor, WebSockets, backend, matchmaking o ranking.
- Replays, muerte súbita, avisos previos e inmunidades avanzadas.
- Efectos de audio o rediseño visual amplio.
