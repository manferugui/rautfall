# Informe de implementación — Tarea 0025: Flujo web de modos y resultados

## Resumen

Se ha implementado el flujo de usuario y la arquitectura de navegación de producción en `apps/web`, permitiendo pasar de un prototipo técnico dependiente de banderas de depuración en la URL (`?battle-demo=1`) a una aplicación web jugable completa de principio a fin.

La interfaz incorpora un **Menú Principal** (*Industrial Dramatic*), selector explícito de modos (**Entrenamiento 1P** y **Batalla Local 2P contra IA**), panel modal de **Resultados** al finalizar la partida con métricas oficiales y acciones post-partida (**Volver a jugar** y **Menú principal**), así como la gestión estricta del ciclo de vida de Phaser con destrucción completa y recreación limpia al transicionar entre pantallas o reiniciar modos.

---

## Archivos creados y modificados

### Creados
- `apps/web/src/components/ModeSelector.vue`: Componente de Menú Principal y Selector de Modos con estética *Industrial Dramatic* y resumen de controles.
- `apps/web/src/components/ModeSelector.test.ts`: Pruebas unitarias para `ModeSelector.vue`.
- `apps/web/src/components/ResultsModal.vue`: Modal/Panel de Resultados al finalizar la partida con desglose de estadísticas oficiales y botones de acción.
- `apps/web/src/components/ResultsModal.test.ts`: Pruebas unitarias para `ResultsModal.vue`.
- `apps/web/e2e/navigation-flow.spec.ts`: Test E2E en Playwright que verifica el flujo completo de navegación, selección de modos, resultados y retorno al menú.

### Modificados
- `apps/web/src/game/types.ts`: Exportación de los contratos `GameMode`, `AppScreen` y `GameResultSummary`.
- `apps/web/src/game/create-phaser-game.ts`: Extensión de `CreatePhaserGameOptions` con la propiedad opcional `mode?: GameMode` para transmitirla a `GameScene`.
- `apps/web/src/game/scenes/GameScene.ts`: Gestión de `mode?: GameMode` en `init()` y `resetEngine()`, discriminando entre `createGameEngine` (1P) y `createBattleSession` con `DeterministicBot` (2P).
- `apps/web/src/components/GameCanvas.vue`: Prop reactiva `mode?: GameMode` enviada a `createPhaserGame`.
- `apps/web/src/components/OpponentMonitor.vue`: Prop reactiva `mode?: GameMode` con presentación de estado standby (`SIN OPONENTE` / `STANDBY`) en Entrenamiento (1P) sin renderizar celdas estáticas falsas.
- `apps/web/src/components/OpponentMonitor.test.ts`: Pruebas unitarias ampliadas para verificar el estado de standby en Entrenamiento.
- `apps/web/src/App.vue`: Máquina de estados de navegación (`appScreen`: `'menu' | 'playing' | 'results'`), gestión de la pantalla de inicio, conmutación de modales, botón de retorno en la cabecera y conservación de flags DEV.
- `apps/web/src/App.test.ts`: Suite completa de integración para verificar la navegación, conmutación de pantallas, modal de resultados, acciones de reintento y menú, y ciclo de vida de Phaser.
- `apps/web/e2e/essential-flow.spec.ts`: Adaptación para navegar a Entrenamiento desde la raíz `/` a través del Menú Principal.
- `docs/project-status.md`: Actualización del estado del proyecto incorporando la Tarea 0025 completada.

---

## Decisiones relevantes

1. **Desacoplamiento de la navegación en Vue:** La máquina de estados (`AppScreen` y `GameMode`) reside de forma exclusiva en Vue (`App.vue`), sin introducir librerías externas como `vue-router` ni alterar la responsabilidad de los motores o de Phaser.
2. **Ciclo de vida limpio de Phaser (`game.destroy(true)`):** Al salir de una partida hacia el Menú Principal o al pulsar "Volver a jugar", Vue desmonta `GameCanvas.vue`, ejecutando el hook `onBeforeUnmount()` que invoca `controller.destroy()` / `game.destroy(true)`. Al reiniciar o seleccionar modo, se crea una instancia de Phaser totalmente nueva, garantizando la eliminación de listeners o acumuladores residuales.
3. **Presentación inequívoca de Entrenamiento:** En Modo Entrenamiento (1P), `OpponentMonitor.vue` muestra la insignia `SIN OPONENTE`, cuadrícula limpia sin celdas ficticias y telemetría en reposo, resolviendo la ambigüedad visual previa del patrón simulado.
4. **Conservación de accesos DEV:** Las banderas de consulta en URL (`?battle-demo=1`, `?tspin-demo=1`, etc.) continúan funcionando en entorno de desarrollo (`import.meta.env.DEV`), permitiendo saltar al escenario correspondiente directamente sin romper los tests E2E existentes.

---

## API pública y contratos producidos

```ts
/** Modos de juego en apps/web */
export type GameMode = 'training' | 'battle';

/** Pantallas principales de la aplicación web */
export type AppScreen = 'menu' | 'playing' | 'results';

/** Resumen oficial de resultados al finalizar una partida */
export type GameResultSummary = Readonly<{
  mode: GameMode;
  title: string;
  subtitle?: string | undefined;
  score: number;
  level: number;
  elapsedMs: number;
  battleResult?: Readonly<{
    status: BattleStatus;
    winner: BattleWinner;
    step: number;
  }> | undefined;
}>;

/** Factoría de Phaser ampliada */
export type CreatePhaserGameOptions = {
  parent: HTMLElement;
  mode?: GameMode;
  onStateUpdate: (state: GamePresentationState) => void;
};
```

---

## Pruebas añadidas y modificadas

- **Unitarias en Vitest:** 708 tests pasando en verde (+6 tests nuevos en `App.test.ts`, +5 tests en `ModeSelector.test.ts`, +5 tests en `ResultsModal.test.ts` y +1 test en `OpponentMonitor.test.ts`).
- **E2E en Playwright:** 7 escenarios pasando en verde (+1 test de navegación completa `navigation-flow.spec.ts` y 1 test adaptado `essential-flow.spec.ts`).

---

## Comandos ejecutados y resultados

- `pnpm test`: 708/708 tests Vitest en verde (32 archivos).
- `pnpm lint`: Cero errores ni advertencias (ESLint).
- `pnpm typecheck`: Cero errores de TypeScript (vue-tsc).
- `pnpm build`: Compilación de producción exitosa en `@rautfall/web`.
- `pnpm --filter @rautfall/web test:e2e`: 7/7 pruebas E2E en Playwright exitosas.
- `git diff --check`: Salida limpia sin espacios ni formateos incorrectos.
- `git status --short`: Árbol con archivos de la tarea 0025 modificados y creados.

---

## Desviaciones y trabajo pendiente

- Ninguna desviación respecto a la especificación inmutable `docs/tasks/0025-flujo-web-modos-y-resultados.md`.
- **Confirmación del alcance excluido:** No se han modificado `@rautfall/game-engine`, `@rautfall/battle-engine` ni `@rautfall/game-config`. No se ha implementado backend, audio, ranking, historial ni ajustes.
