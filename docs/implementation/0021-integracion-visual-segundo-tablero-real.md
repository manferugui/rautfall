# Informe de implementación — 0021: Integración visual del segundo tablero real

## Resumen

Se ha completado la **Tarea 0021**, integrando visualmente el segundo tablero real (Player 2) en `OpponentMonitor.vue` dentro de `apps/web` consumiendo la instantánea real de `BattleSnapshot.playerTwo` producida por la `BattleSession` de `@rautfall/battle-engine`.

En el modo de desarrollo aislado **`?battle-demo=1`**, el monitor rival sustituye la matriz estática por la cuadrícula real 10×20 de P2 (filas bloqueadas, basura, pieza activa y pieza fantasma con la prioridad visual `activePiece` > `landingCells` > `board`), oculta el distintivo `SIMULADO`, presenta la telemetría táctica real (Nivel, Energía, Sabotajes almacenados, Efectos activos, Basura pendiente) y responde coordinadamente a la pausa (velo `PAUSA`), reset (`R`) y terminalidad (`DERROTA RIVAL`, `VICTORIA RIVAL`, `EMPATE`). En el modo normal 1P, se conserva intacta la simulación estática previa con el distintivo `SIMULADO`.

- **Total de pruebas en el monorepo:** 597 tests en Vitest pasando + 2 pruebas E2E en Playwright pasando.
- **Lint, Typecheck y Build:** 100% limpios sin errores ni avisos.

---

## Archivos creados y modificados

### Creados
- `docs/tasks/0021-integracion-visual-segundo-tablero-real.md`: Especificación inmutable de la Tarea 0021.
- `apps/web/src/game/opponent-mapper.ts`: Mapeador puro desacoplado `mapEngineToOpponentPresentation` que transforma `EngineSnapshot` de P2 a `OpponentPresentationState`.
- `apps/web/src/game/opponent-mapper.test.ts`: 7 pruebas unitarias deterministas del mapeador de P2.
- `apps/web/e2e/battle-demo.spec.ts`: Test E2E Playwright determinista para `?battle-demo=1`.
- `docs/implementation/0021-integracion-visual-segundo-tablero-real.md`: Este informe de implementación.

### Modificados
- `apps/web/src/game/types.ts`: Añadidos `CellPresentation` (con `appearance: 'fixed' | 'active' | 'ghost'`), `OpponentPresentationState` y actualizado `BattlePresentationState`.
- `apps/web/src/game/scenes/GameScene.ts`: Invocación a `mapEngineToOpponentPresentation(bSnap.playerTwo)` en `notifyState()` para poblar `battleState.playerTwo`.
- `apps/web/src/components/OpponentMonitor.vue`: Sostenimiento de modo real y simulado discriminados; renderizado de `visibleCells`, telemetría táctica real, velo de `PAUSA` e indicadores terminales.
- `apps/web/src/components/OpponentMonitor.test.ts`: 10 pruebas unitarias de Vue covering ambos modos, props, pausa y terminalidad.
- `apps/web/src/App.vue`: Transmisión de `playerTwo`, `battleStatus`, `winner` e `isPaused` a `OpponentMonitor.vue`, y actualización de referencias en el panel DEV.
- `docs/project-status.md`: Actualizado con el registro de finalización de la Tarea 0021.

### Eliminados
- `docs/drafts/0021-integracion-visual-segundo-tablero-real.md`: Borrador de especificación eliminado tras trasladarlo a `docs/tasks/`.

---

## Decisiones relevantes

1. **Estrategia A (Cuadrícula compacta Vue en `OpponentMonitor.vue`)**: Se renderiza P2 mediante celdas HTML/CSS en el componente Vue existente sin crear un segundo canvas Phaser ni modificar el tamaño del canvas de P1.
2. **Mapeador puro desacoplado (`opponent-mapper.ts`)**: Descarta las 4 filas ocultas del motor ($y_{engine} < 4$), proyecta $y_{visual} = y_{engine} - 4$ (rango 0..19), resuelve previamente la prioridad de celdas (`activePiece` > `landingCells` > `board`), aplica el color de la pieza activa a la fantasma (`appearance: 'ghost'`), garantiza coordenadas únicas por celda, ordena deterministamente por `y` luego `x` y devuelve un contrato inmutable.
3. **Discriminación de modo**: `OpponentMonitor.vue` se mantiene unificado. Si `playerTwo` está presente (modo `?battle-demo=1`), oculta `SIMULADO` y muestra datos reales. Si `playerTwo` es nulo o indefinido (modo 1P), muestra el patrón estático simulado original.
4. **Pausa y terminalidad coordinadas**: El velo `PAUSA` se deriva del estado global de sesión sin añadir `'paused'` a `OpponentPresentationState.status`. Los indicadores terminales (`DERROTA RIVAL`, `VICTORIA RIVAL`, `EMPATE`) se derivan del estado y ganador globales de la batalla.

---

## API pública y contratos producidos

En `apps/web/src/game/types.ts`:

```ts
export type CellPresentation = Readonly<{
  x: number;
  y: number;
  type: PieceType | 'garbage';
  appearance: 'fixed' | 'active' | 'ghost';
  color: string;
}>;

export type OpponentPresentationState = Readonly<{
  status: 'running' | 'gameOver';
  level: number;
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  activeEffects: readonly ActiveEffectSnapshot[];
  pendingGarbage: number;
  visibleCells: readonly CellPresentation[];
}>;

export type BattlePresentationState = Readonly<{
  status: BattleStatus;
  winner: BattleWinner;
  step: number;
  lastSabotageRouted: string | null;
  playerTwo: OpponentPresentationState;
}>;
```

---

## Pruebas añadidas

- **`apps/web/src/game/opponent-mapper.test.ts` (7 pruebas unitarias)**:
  - Mapeo inicial vacío.
  - Proyección 10×24 $\to$ 10×20 y descarte de filas ocultas.
  - Prioridad active > ghost > board.
  - Asignación de color base a la pieza fantasma.
  - Ordenación determinista por `y` y `x`.
  - Mapeo de estado `gameOver`.
  - Inmutabilidad de la estructura devuelta.
- **`apps/web/src/components/OpponentMonitor.test.ts` (10 pruebas unitarias)**:
  - Pruebas del modo simulado (badge SIMULADO, celdas estáticas, telemetría decorativa, temporizadores).
  - Pruebas del modo real (badge Lvl N, celdas reales, telemetría táctica, velo PAUSA, banderas de terminalidad, reset).
- **`apps/web/e2e/battle-demo.spec.ts` (1 prueba E2E Playwright)**:
  - Carga de `?battle-demo=1` y verificación de ausencia de `SIMULADO` y presencia de celdas reales de P2.
  - Pausa y reanudación con velo sutil `PAUSA`.
  - Reinicio coordinado mediante `R` / botón Reiniciar.
  - Control de cero errores de consola o `pageerror`.

---

## Comandos ejecutados y resultados

- `pnpm test`: 597 tests en Vitest pasando (100% OK).
- `pnpm lint`: ESLint sin errores ni avisos (100% OK).
- `pnpm typecheck`: TypeScript en los 4 paquetes/aplicaciones en verde (100% OK).
- `pnpm build`: Compilación de producción con Vite exitosa (100% OK).
- `pnpm --filter @rautfall/web test:e2e`: 2/2 tests Playwright E2E en verde (100% OK).
- `git diff --check`: Salida limpia sin errores de espacios.

---

## Desviaciones

Ninguna. La implementación cumple estrictamente la especificación [0021-integracion-visual-segundo-tablero-real.md](file:///home/manuel/dev/rautfall/docs/tasks/0021-integracion-visual-segundo-tablero-real.md).

---

## Trabajo pendiente (para Tarea 0022)

- Desarrollo del bot IA heurístico para P2 según la especificación de `docs/rautfall.md`.

---

## Confirmación del alcance excluido

Se confirma que no se ha implementado:
- Bot o Inteligencia Artificial heurística.
- Sabotaje *Interferencia*.
- Renderizado de un segundo canvas Phaser ni modificación del tamaño del canvas principal.
- Servidor, WebSockets, backend, matchmaking o ranking.
- Rediseño de audio o efectos visuales fuera del monitor rival.
- Modificación de `packages/game-engine` o `packages/game-config`.
