# Task 0023 — Decisión y activación determinista de sabotajes por el bot

## Propósito

Ampliar el bot heurístico determinista para que Player 2 pueda decidir y activar los sabotajes almacenados en su cartucho utilizando el contrato público de entrada (`StepInput.triggerSabotage`), sin acceso a información futura, sin atajos en el motor y respetando total determinismo.

## Requisitos de Producto y Arquitectura

1. **Determinismo total**:
   - Sin `Math.random()`, sin `Date.now()`, sin `performance.now()` ni temporizadores reales del navegador o sistema operativo.
   - Evaluación y temporizaciones gobernadas exclusivamente por pasos lógicos (`fixedStepMs = 10`).

2. **Contrato de entrada público y FIFO**:
   - El bot debe activar los sabotajes utilizando la propiedad pública `StepInput.triggerSabotage: true`.
   - La decisión respeta la cola FIFO del cartucho (`storedSabotages[0]`). El bot evalúa si activa `storedSabotages[0]` en el tick actual o lo conserva.
   - `triggerSabotage: true` no se combina con acciones de movimiento, rotación o hard drop en el mismo tick. Se emite en ticks tácticos neutros.

3. **Percepción pura y readonly**:
   - La política táctica (`evaluateSabotageDecision`) es una función pura que solo consulta instantáneas públicas e inmutables (`EngineSnapshot`) de ambos participantes.
   - El bot no recibe la instancia mutable de `GameEngine` del rival ni accede a su PRNG o cola futura.

4. **Reglas tácticas por tipo de sabotaje**:
   - **`residuos`**: Prioriza la activación cuando la altura máxima del rival es $\ge 8$ celdas y no existe suficiente presión pendiente acumulada.
   - **`sobrecarga`**: Prioriza la activación cuando el rival tiene una pieza activa y su altura es $\ge 5$ celdas, siempre que el efecto sobrecarga no se encuentre ya activo en el rival.
   - **`polaridad`**: Prioriza la activación cuando el rival tiene una pieza activa completamente visible ($y \ge 4$) posicionada cerca de una pared (distancia horizontal $\le 1$) o ante riesgo elevado de top-out, siempre que el efecto no esté ya activo en el rival.

5. **Cadencia táctica y Cooldown**:
   - Evaluación periódica cada `decisionIntervalSteps` (20 pasos / 200 ms por defecto).
   - Cooldown determinista tras activación de `cooldownSteps` (100 pasos / 1.000 ms por defecto) para evitar ráfagas descontroladas.
   - Pausa y terminalidad congelan la política. Reinicio restaura contadores.

## Entregables

- `packages/battle-engine/src/bot/sabotage-policy.ts`: Módulo puro de evaluación de decisiones tácticas de sabotaje.
- `packages/battle-engine/src/bot/sabotage-policy.test.ts`: Pruebas unitarias completas de la política táctica.
- `packages/battle-engine/src/bot/deterministic-bot.ts`: Integración de la cadencia táctica y cooldowns en `DeterministicBot`.
- `packages/battle-engine/src/bot/deterministic-bot.test.ts`: Pruebas unitarias del ejecutor determinista con sabotajes.
- `packages/battle-engine/src/battle-engine.test.ts`: Pruebas de integración en `BattleSession`.
- `apps/web/e2e/bot-sabotage.spec.ts`: Pruebas E2E en Chromium con Playwright.
