# 0021 — Integración visual del segundo tablero real

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

1. Integrar visualmente el segundo tablero real (Player 2) en **`apps/web`** consumiendo `BattleSnapshot.playerTwo` suministrado por la `BattleSession` de `@rautfall/battle-engine` (implementada en la Tarea 0020).
2. Sustituir progresivamente el monitor rival simulado (`OpponentMonitor.vue`) por datos reales de P2 únicamente durante una sesión de batalla real (**`?battle-demo=1`**).
3. Eliminar la insignia y matriz estáticas **`SIMULADO`** exclusivamente cuando exista una batalla real activa, manteniendo el comportamiento simulado sin cambios en el flujo normal de 1 jugador.
4. Renderizar el tablero de P2 (filas bloqueadas, basura, pieza activa y pieza fantasma) mediante una cuadrícula compacta HTML/CSS en Vue, sin añadir un segundo canvas Phaser ni modificar el tamaño del canvas de P1.
5. Presentar la telemetría y estado táctico real de P2: nivel, energía de combate, cartuchos de sabotaje almacenados, efectos activos, basura pendiente y estado de sesión/terminalidad (`running`, `paused`, `playerOneWon`, `playerTwoWon`, `draw`).
6. Gestionar de forma coordinada el congelamiento en pausa, el reinicio de ambos tableros y la congelación con indicación visual de resultado al finalizar la batalla.

---

## 2. Auditoría de la arquitectura actual

### 2.1 Situación de datos en `apps/web` tras la Tarea 0020
- `GameScene.ts` crea una `BattleSession` de `@rautfall/battle-engine` al activar `?battle-demo=1`.
- En cada tick, `GameScene` notifica a Vue mediante `GamePresentationState.battleState`.
- Sin embargo, `battleState` solo incluye campos resumidos (`status`, `winner`, `step`, `playerTwoStatus`, `playerTwoLevel`, `playerTwoCombatEnergy`, `playerTwoStoredSabotages`, `playerTwoActiveEffects`, `lastSabotageRouted`).
- **Carece actualmente** del tablero (`board`), pieza activa (`activePiece`) y pieza fantasma (`landingCells`) de P2.
- En `App.vue`, estos datos resumidos se renderizan únicamente en un panel de texto técnico DEV (`data-testid="battle-demo-dev-panel"`).

### 2.2 Estado de `OpponentMonitor.vue`
- Es un componente de 240px de ancho con celda compacta de 16px (`OPPONENT_CELL_SIZE = 16`).
- Renderiza un array estático congelado de 87 celdas (`OPPONENT_STATIC_BOARD`) en una cuadrícula 10×20.
- Contiene el distintivo `<span class="simulated-badge">SIMULADO</span>` en la cabecera y la nota al pie *"Vista de prototipo — sin lógica de combate"*.
- Es un componente de renderizado HTML/CSS puro mediante divs con posición absoluta `left/top`.

---

## 3. Decisión arquitectónica preferida

### 3.1 Comparativa de estrategias de renderizado para P2

| Criterio | A. Cuadrícula compacta Vue (HTML/CSS) | B. Ampliar canvas Phaser único (P1 + P2) | C. Segundo canvas Phaser dedicado |
|---|---|---|---|
| **Alcance** | Mínimo. Modifica solo la capa de presentación Vue. | Medio. Altera viewport, cámara y maquetación de Phaser. | Alto. Instancia dos motores Phaser en paralelo. |
| **Complejidad** | Muy baja. Vue renderiza celdas mediante divs o CSS grid. | Alta. Requiere rediseñar la escena y coordenadas. | Muy alta. Gestión de ciclo de vida de dos canvas. |
| **Coherencia con `rautfall.md`** | **Absoluta**. Respeta la columna táctica y el monitor HTML/CSS. | Baja. Rompe la disposición de la consola central. | Baja. Desperdicia recursos para una vista secundaria. |
| **Testabilidad** | **Excelente**. Tests de componentes Vue simples con Vitest. | Difícil. Requiere inspección de canvas/Phaser. | Difícil. Mockeo complejo de dos escenas Phaser. |
| **Rendimiento** | Excelente. Celdas HTML con posiciones reactivas. | Alto. Renderizado WebGL/Canvas de ambos. | Medio-Bajo. Sobrecarga de dos instancias Phaser. |
| **Riesgo de trabajo provisional** | **Nulo**. Es la arquitectura final deseada. | Alto. Debería revertirse al volver al layout Tactical. | Alto. Abandonado habitualmente por ineficiencia. |

### 3.2 Recomendación
Se aprueba de forma unánime la **Estrategia A (Cuadrícula compacta Vue en `OpponentMonitor.vue`)**.

---

## 4. Política Simulado frente a Real

1. **Fuera de batalla (Modo 1P normal)**:
   - `OpponentMonitor.vue` no recibe datos reales de P2 (`playerTwo === null` o `undefined`).
   - Renderiza el tablero simulado estático actual (`OPPONENT_STATIC_BOARD`).
   - Muestra el distintivo **`SIMULADO`** y la telemetría decorativa estática.
2. **En batalla real (`?battle-demo=1`)**:
   - `OpponentMonitor.vue` recibe `playerTwo` derivado de `BattleSnapshot.playerTwo`.
   - Muestra el tablero real, pieza activa real y pieza fantasma real de P2.
   - **Oculta la insignia `SIMULADO`** y sustituye la telemetría estática por los datos reales de P2.
3. **Diseño del componente**:
   - Se mantiene un único `OpponentMonitor.vue` que opera en modo simulado o real según la presencia de la propiedad opcional de presentación.
   - Se evita duplicar componentes o crear wrappers innecesarios.

---

## 5. Contrato de presentación para Vue

En `apps/web/src/game/types.ts`:

```ts
import type { ActiveEffectSnapshot, PieceType, SabotageType } from '@rautfall/game-engine';
import type { BattleStatus, BattleWinner } from '@rautfall/battle-engine';

export type CellPresentation = Readonly<{
  x: number; // 0..9
  y: number; // 0..19 (coordenada visual en tablero 10×20)
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

### 5.1 Construcción y mapeo
- Un mapeador puro desacoplado (`mapEngineToOpponentPresentation`) transforma `EngineSnapshot` de P2 en `OpponentPresentationState`.
- Las 4 filas ocultas supernumerarias del motor ($y \in [0..3]$) se descartan para la visualización ($y_{engine} < 4$). Solo las 20 filas visibles ($y \in [4..23]$) se proyectan a la cuadrícula de Vue ($y_{visual} = y_{engine} - 4$).
- Prioridad estricta de superposición por coordenada $(x, y_{visual})$:
  `activePiece` > `landingCells` (fantasma) > `board` (fijas/basura).
- Cada coordenada $(x, y_{visual})$ aparece a lo sumo una vez en `visibleCells`.
- La pieza fantasma (`appearance: 'ghost'`) conserva el color base del tipo de la pieza activa.
- Ordenación determinista: por `y` creciente y luego `x` creciente.
- Las celdas vacías (`null`) no se incluyen en `visibleCells`.

---

## 6. Renderizado del tablero rival en Vue

### 6.1 Dimensiones y prioridades visuales
- Dimensiones visibles: 10 columnas × 20 filas (ancho: 160px, alto: 320px, tamaño celda: 16px).
- `appearance: 'ghost'` es un atributo de apariencia visual (opacidad reducida/borde punteado), no un tipo de dominio.
- Ninguna celda fuera del rango visible ($y_{engine} < 4$) debe renderizarse.
- Clave de iteración en Vue (`:key`): `${cell.x}-${cell.y}`.
- **Sin lógica de dominio en Vue**: Vue únicamente recibe la lista de celdas ya resuelta. No calcula colisiones, hard drops ni SRS.

---

## 7. Pausa, reset y terminalidad

1. **Pausa**:
   - Al pulsar `Esc` o el botón Vue, la web deja de invocar `battleSession.step()`.
   - `OpponentMonitor.vue` conserva la última instantánea visible congelada y muestra un indicador o velo sutil **`PAUSA`** derivado del estado global de sesión. `OpponentPresentationState.status` no se altera (permanece `'running'`).
2. **Reset**:
   - Al pulsar `R` o el botón Reiniciar, `battleSession.reset()` reinicia ambos participantes a `step 0`.
   - `OpponentMonitor.vue` se actualiza inmediatamente reflejando el tablero e indicadores iniciales de P2.
3. **Estado terminal (`playerOneWon`, `playerTwoWon`, `draw`)**:
   - Cuando el estado de la batalla cambia a terminal, se detienen los pasos del orquestador.
   - El último snapshot permanece visible congelado en `OpponentMonitor.vue`.
   - El estado terminal se deriva de `BattlePresentationState.status` y `winner`.
   - Indicadores contextuales:
     - `playerOneWon` $\to$ **DERROTA RIVAL**
     - `playerTwoWon` $\to$ **VICTORIA RIVAL**
     - `draw` $\to$ **EMPATE**

---

## 8. Escenario de demostración (`?battle-demo=1`)

- Solo activo detrás de `import.meta.env.DEV` y con la query param `?battle-demo=1`.
- En este modo:
  - P1 es controlado por el teclado humano.
  - P2 ejecuta entradas neutras en lockstep síncrono.
  - Los sabotajes lanzados por P1 con la tecla `A` modifican visualmente el tablero de P2 en tiempo real.
  - `OpponentMonitor.vue` se actualiza reactivamente en cada frame con los datos reales de P2.
  - Al terminar la partida, la pantalla congela el resultado de la batalla.

---

## 9. Pruebas obligatorias

### 9.1 Mapeo y presentación
- Test unitario del mapeador `EngineSnapshot` $\to$ `OpponentPresentationState`:
  - Proyección 10×24 $\to$ 10×20.
  - Descarte de filas ocultas ($y_{engine} < 4$).
  - Prioridad `activePiece` > `landingCells` > `board`.
  - Ausencia de coordenadas duplicadas.
  - Celdas de basura y tipos de pieza.
  - Pieza fantasma con color base de la pieza activa.
  - Orden determinista por `y` y `x`.
  - Ausencia de `activePiece`.
  - `gameOver`.

### 9.2 Componente Vue (`OpponentMonitor.test.ts`)
- Modo simulado sin datos reales (badge `SIMULADO` presente).
- Modo real (badge `SIMULADO` ausente).
- Renderizado de celdas `fixed`, `active`, `ghost` y `garbage`.
- Telemetría táctica real (Nivel, Energía, Sabotajes almacenados, Efectos activos, Basura pendiente).
- Pausa (velo `PAUSA`).
- Terminalidad (`VICTORIA RIVAL`, `DERROTA RIVAL`, `EMPATE`).
- Reset de props/estado.
- Sin resolución de reglas de dominio en el componente.

### 9.3 Integración Web
- `battleState` expone `playerTwo` con `visibleCells`.
- Modo normal conserva simulación estática.
- `?battle-demo=1` usa datos reales y está protegido por `import.meta.env.DEV`.
- Pausa y reset coordinados.

### 9.4 Pruebas E2E (Playwright)
- Escenario determinista sobre `?battle-demo=1`:
  - Monitor rival sin badge `SIMULADO`.
  - Presencia de celdas reales de P2.
  - Pausa congela el estado visible.
  - Reanudación continúa.
  - Reset devuelve ambos participantes a `step 0`.
  - Sin errores de consola ni `pageerror`.

---

## 10. Exclusiones

Queda explícitamente excluido de la Tarea 0021:
- Bot IA heurístico (Tarea 0022).
- Controles humanos para P2.
- Sabotaje *Interferencia*.
- Red, WebSockets, backend.
- Segundo canvas Phaser o nueva instancia Phaser.
- Sonido o efectos de audio.
- Nuevas reglas del motor o cambios de balance.

---

## 11. Criterios de aceptación

1. En `?battle-demo=1`, `OpponentMonitor.vue` representa el tablero y estado real de P2 a partir de `BattleSnapshot.playerTwo`.
2. La insignia `SIMULADO` desaparece únicamente en el modo de batalla real.
3. El modo simulado estático se conserva intacto en el juego normal de 1 jugador.
4. El tablero de P2 muestra celdas bloqueadas, basura, pieza activa y pieza fantasma con las prioridades visuales correctas.
5. Se muestran los indicadores reales de nivel, energía, cartuchos de sabotaje almacenados, efectos activos y basura pendiente de P2.
6. La pausa congela visualmente el monitor rival sin perder su estado.
7. El reinicio (`R`) resetea coordinadamente P1 y P2 a sus estados iniciales.
8. La finalización de la batalla deja visible el último estado congelado junto con la indicación del resultado (`VICTORIA RIVAL`, `DERROTA RIVAL` o `EMPATE`).
9. No se introduce lógica de dominio, colisiones ni rotación en Vue.
10. No se crean segundos canvas Phaser ni se modifica `packages/game-engine` ni `packages/game-config`.
11. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm --filter @rautfall/web test:e2e` finalizan sin errores ni avisos.
