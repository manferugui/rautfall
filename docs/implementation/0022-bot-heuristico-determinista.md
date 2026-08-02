# Informe de implementación — Tarea 0022: Bot heurístico determinista para batalla local

## Resumen y Registro de Correcciones

Durante la validación manual en el entorno de desarrollo (`?battle-demo=1`), se ajustó la cadencia del bot para definir un único perfil de referencia equilibrado (base futura de `battleNormal`), sin implementar aún niveles de dificultad (easy/normal/hard).

Se corrigieron tres aspectos clave:
1. **Perfil de Cadencia Equilibrado (BattleNormal Reference):**
   - Retardo de reacción tras visibilidad completa: **20 pasos lógicos** (200 ms).
   - Intervalo entre acciones de movimiento/rotación: **4 pasos lógicos** (40 ms).
   - Pausa previa al `hardDrop`: **5 pasos lógicos** (50 ms).
2. **Identidad de Pieza Real (`pieceId`):**
   - Se añadió la propiedad `readonly pieceId: number` a `ActivePieceSnapshot` en `@rautfall/game-engine`.
   - Se eliminó el generador de cadenas sintéticas `getPieceId()`.
   - La percepción e invalidación del bot valida de forma estricta `snapshot.activePiece.pieceId`.
   - `clone()` conserva el `pieceId` exacto; `reset()` reproduce la secuencia inicial determinista (pieceId 1).
3. **Supervivencia y Legibilidad:**
   - Se conservó la prohibición estricta de candidatos terminales si existen alternativas no terminales, la penalización de pozos/huecos/filas ocultas y la visibilidad completa en $y \ge 4$.
4. **Verificación E2E por Mediciones Matemáticas Exactas:**
   - La suite E2E en Playwright (`apps/web/e2e/battle-demo.spec.ts`) mide las transiciones deterministas usando `battle-step` y la telemetría DEV expuesta:
     - `firstActionStep - visibleStep >= 20` (Retardo de reacción).
     - `secondActionStep - firstActionStep >= 4` (Intervalo entre acciones de movimiento/rotación).
     - `pieceChangedStep - hardDropWaitStartStep >= 5` (Pausa previa al `hardDrop`).
     - `hardDropStep - moveActionStep >= 1` (Separación estricta entre último movimiento y hard drop).
     - `st3.actionIndex - st1.actionIndex <= 1` (Ausencia de ráfaga tras reanudar la pausa).
     - Reset completo que restaura la máquina interna (`pieceId = 1`, `actionIndex = 0`, `planLength = 0`, `currentAction = null`, `reactionStepsRemaining = 20`, `hardDropDelayStepsRemaining = 5`).

---

## Archivos Creados y Modificados

### Creados:
- `packages/battle-engine/src/bot/types.ts`
- `packages/battle-engine/src/bot/board-evaluator.ts`
- `packages/battle-engine/src/bot/board-evaluator.test.ts`
- `packages/battle-engine/src/bot/placement-search.ts`
- `packages/battle-engine/src/bot/placement-search.test.ts`
- `packages/battle-engine/src/bot/deterministic-bot.ts`
- `packages/battle-engine/src/bot/deterministic-bot.test.ts`
- `docs/tasks/0022-bot-heuristico-determinista.md`
- `docs/implementation/0022-bot-heuristico-determinista.md`

### Modificados:
- `packages/game-engine/src/index.ts` *(Añadido `pieceId` numérico en `ActivePieceSnapshot`, `clone(): GameEngine` e incremento determinista)*
- `packages/game-engine/src/game-engine.test.ts` *(24 tests de clonación + 10 tests de contrato de `pieceId`)*
- `packages/battle-engine/src/index.ts` *(Exportaciones públicas actualizadas)*
- `apps/web/src/game/types.ts` *(Tipo `BotDevDiagnostic` con `pieceId`, `lastActionStep` y `lastAction`)*
- `apps/web/src/game/scenes/GameScene.ts` *(Integración de `DeterministicBot` para Player 2 en `?battle-demo=1`)*
- `apps/web/src/App.vue` *(Panel DEV con atributos `data-testid` estables)*
- `apps/web/e2e/battle-demo.spec.ts` *(Pruebas E2E deterministas de Playwright con mediciones matemáticas)*
- `docs/project-status.md` *(Documentado estado final de la Tarea 0022)*

---

## Configuración y Tiempos por Defecto

```ts
export const BOT_REACTION_DELAY_STEPS = 20;   // 200 ms a 10 ms por tick
export const BOT_ACTION_INTERVAL_STEPS = 4;   // 40 ms entre acciones
export const BOT_HARD_DROP_DELAY_STEPS = 5;   // 50 ms antes de hardDrop
```

La normalización respeta las sobreescrituras mediante `BotConfig` manteniendo estos valores como defaults por defecto.

---

## API Pública Producida

```ts
export interface ActivePieceSnapshot {
  readonly pieceId: number;
  readonly type: PieceType;
  readonly x: number;
  readonly y: number;
  readonly orientation: Orientation;
  // ...
}

export interface DeterministicBotDiagnostic {
  currentPhase: BotExecutionPhase;
  reactionTimerSteps: number;
  actionIntervalTimer: number;
  hardDropDelayTimer: number;
  actionIndex: number;
  lastActionStep: number | null;
  lastAction: string | null;
  planDiagnostic?: BotPlanDiagnostic | undefined;
}

export interface DeterministicBot {
  nextStep(engine: GameEngine, battleStatus?: BattleStatus): StepInput;
  reset(): void;
  getDiagnostic(): DeterministicBotDiagnostic;
}

export function createDeterministicBot(config?: Partial<BotConfig>): DeterministicBot;
```

---

## Resultado de las Validaciones Raíz

- `pnpm test`: **655 tests pasados en verde (29 archivos)**.
- `pnpm lint`: **0 errores, 0 avisos en todo el monorepo**.
- `pnpm typecheck`: **0 errores de tipo**.
- `pnpm build`: **Compilación exitosa en producción**.
- `pnpm --filter @rautfall/web test:e2e`: **2 tests E2E Playwright pasados en verde**.
- `git diff --check`: **Limpio**.

---

## Estado de la Validación Manual

- Servidor de desarrollo `pnpm dev` en marcha.
- Pendiente de confirmación visual interactiva final por el usuario.
