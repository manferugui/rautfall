# Informe de Implementación — Tarea 0023: Decisión y activación determinista de sabotajes por el bot

## Resumen

Se ha diseñado e implementado la política pura y determinista de decisión y activación de sabotajes para Player 2 (`DeterministicBot`) en la Capa de Batalla Local. La política evalúa exclusivamente el frente FIFO del cartucho de sabotajes (`storedSabotages[0]`), emite la activación utilizando el contrato público de entrada (`StepInput.triggerSabotage`) en ticks tácticos neutros sin interferir con movimientos ni hard drops, y funciona de forma desacoplada consultando únicamente instantáneas públicas de lectura (`EngineSnapshot`).

## Archivos Creados y Modificados

- **[NEW]** `packages/battle-engine/src/bot/sabotage-policy.ts`: Módulo con la función pura `evaluateSabotageDecision`, guardas de orden de precedencia y percepciones derivadas del tablero e instantánea rival.
- **[NEW]** `packages/battle-engine/src/bot/sabotage-policy.test.ts`: 23 pruebas unitarias deterministas que cubren guardas, umbrales de altura, polaridad en pared, sobrecarga, conservaciones y validación de configuración.
- **[NEW]** `apps/web/e2e/bot-sabotage.spec.ts`: Suite E2E de Playwright que valida el escenario DEV determinista de sabotajes para Player 2.
- **[NEW]** `docs/tasks/0023-bot-sabotajes-deterministas.md`: Especificación inmutable de la Tarea 0023.
- **[NEW]** `docs/implementation/0023-bot-sabotajes-deterministas.md`: Este informe de implementación.
- **[MODIFY]** `packages/battle-engine/src/bot/types.ts`: Definición de `SabotageDecision`, `SabotageDecisionReason`, `SabotagePolicyInput`, `BotSabotageConfig` y extensión de `BotConfig`.
- **[MODIFY]** `packages/battle-engine/src/bot/deterministic-bot.ts`: Integración de la política pura, temporizadores lógicos de intervalo (20 pasos) y cooldown (100 pasos), función `isNeutralPlacementInput` y telemetría táctica en `getDiagnostic()`.
- **[MODIFY]** `packages/battle-engine/src/bot/deterministic-bot.test.ts`: Pruebas de integración del ejecutor determinista con decisiones tácticas y cadencia.
- **[MODIFY]** `packages/battle-engine/src/battle-engine.test.ts`: Pruebas de integración en `BattleSession` verificando el enrutamiento de sabotajes activados por el bot.
- **[MODIFY]** `packages/battle-engine/src/index.ts`: Exposición de la nueva API pública readonly de sabotajes.
- **[MODIFY]** `packages/game-engine/src/index.ts`: Ampliación controlada de la API pública de inicialización y reset deterministas (`EngineInitialState` y parámetro opcional `resetInitialState` en `GameEngine.reset()`).
- **[MODIFY]** `apps/web/src/game/types.ts`: Ampliación de `BotDevDiagnostic` con campos de telemetría de decisión táctica y cooldowns.
- **[MODIFY]** `apps/web/src/game/battle-demo.ts`: Configuración del escenario DEV determinista para `?battle-demo=1&bot-sabotage=1` y `?battle-demo=1&bot-sabotage=high`.
- **[MODIFY]** `apps/web/src/game/scenes/GameScene.ts`: Paso de la instantánea de P1 (`bSnap.playerOne`) al bot de P2 y volcado de telemetría DEV.
- **[MODIFY]** `docs/project-status.md`: Actualización del estado del proyecto.

## Decisiones Relevantes

1. **Evaluación de frente FIFO**:
   Dado que `GameEngine` consume el cartucho en orden FIFO al recibir `triggerSabotage: true`, el bot no "elige" libremente entre todos los tipos almacenados. Su decisión real consiste en evaluar si activa el primer sabotaje disponible (`storedSabotages[0]`) o decide conservarlo.

2. **Integración en ticks neutros**:
   Para evitar reemplazar o alterar movimientos o hard drops del plan heurístico de colocación, `triggerSabotage: true` se emite en ticks neutros (`isNeutralPlacementInput(placementInput) === true`), garantizando que la acción táctica y las mecánicas 20/4/5 convivan sin colisión.

3. **Percepción strictly readonly**:
   `DeterministicBot.nextStep` acepta `opponentSnapshot?: EngineSnapshot | null`. El bot nunca recibe la referencia al `GameEngine` mutable del rival.

4. **Cooldown y cadencia táctica**:
   Se definió una cadencia de evaluación cada 20 pasos (200 ms) y un cooldown determinista de 100 pasos (1.000 ms) tras cada activación. Durante la conservación, solo se carga el intervalo de decisión sin activar cooldown.

5. **Ampliación controlada de la API pública de inicialización y reset deterministas**:
   Se exportó `EngineInitialState` (`Partial<TSpinDemoInitialState>`) y se añadió el parámetro opcional `resetInitialState` en `GameEngine.reset()`. Ambos contratos forman parte de la API pública de `@rautfall/game-engine` y `@rautfall/battle-engine`, acotados estrictamente a la inicialización y restauración determinista de motores en creación y reset. No permiten mutación arbitraria en caliente durante una partida en ejecución ni exponen puertas traseras de desarrollo.

## API Pública Producida

Exportaciones ampliadas en `@rautfall/game-engine`:
- `EngineInitialState`: Tipo público de inicialización determinista.
- `GameEngine.reset(options, resetInitialState?)`: Parámetro opcional en la interfaz pública `GameEngine` para restaurar deterministamente un estado inicial en la operación explícita de reset.

Exportaciones producidas en `@rautfall/battle-engine`:
- `evaluateSabotageDecision(input, config): SabotageDecision`
- `normalizeBotSabotageConfig(config?): BotSabotageConfig`
- `isNeutralPlacementInput(input): boolean`
- `DEFAULT_BOT_SABOTAGE_CONFIG: BotSabotageConfig`
- `SabotageDecision`, `SabotageDecisionReason`, `SabotagePolicyInput`, `BotSabotageConfig`

## Pruebas y Validación Realizadas

- **Pruebas unitarias de política táctica**: 23/23 tests verdes en `sabotage-policy.test.ts`.
- **Pruebas unitarias del ejecutor bot**: 17/17 tests verdes en `deterministic-bot.test.ts`.
- **Pruebas de integración de sesión de batalla**: 19/19 tests verdes en `battle-engine.test.ts`.
- **Suite completa Vitest**: Todos los paquetes (`game-engine`, `game-config`, `battle-engine`, `web`) verdes.
- **Pruebas E2E de Playwright**: 5/5 pruebas verdes en Chromium (`battle-demo.spec.ts` y `bot-sabotage.spec.ts`).
- **Validaciones globales**: `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check` finalizan sin errores ni avisos.

## Alcance Excluido Confirmado

- Sin niveles de dificultad (easy / normal / hard).
- Sin reordenación ni selección arbitraria de cartuchos.
- Sin lookahead de piezas del rival ni consumo de PRNG ajeno.
- Sin temporizadores reales, Math.random() ni Date.now().
- Sin backend, networking ni UI final de selección de bot.
