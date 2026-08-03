# 0025 — Flujo web de modos y resultados

## Estado

**Propuesta e Inmutable.**

---

## 1. Contexto

En el estado actual de Rautfall, la aplicación web (`apps/web`) inicia directamente en una partida individual o abre el modo de Batalla Local únicamente si se especifican parámetros de consulta (*query flags*) en la URL (`?battle-demo=1`).

Aunque los motores `@rautfall/game-engine` y `@rautfall/battle-engine`, la IA del bot (`DeterministicBot`), la Muerte Súbita y el marco visual *Industrial Dramatic* están completamente implementados y probados mediante 703 tests unitarios y 6 escenarios E2E, la aplicación web carece de un flujo de usuario de producción.

Para convertir el prototipo en un producto web jugable de principio a fin sin depender de banderas de depuración, `apps/web` debe incorporar una máquina de estados de navegación en Vue que gestione el **Menú Principal**, la selección explícita de modos (**Entrenamiento** y **Batalla**), la pantalla o panel de **Resultados** al finalizar la partida y el ciclo de vida de la instancia de Phaser.

---

## 2. Objetivo

Diseñar la especificación técnica e inmutable para la Tarea 0025, transformando `apps/web` en un flujo jugable de producción que permita:

1. Entrar a la aplicación desde un Menú Principal con estética *Industrial Dramatic*.
2. Iniciar el modo **Entrenamiento** (*Training*) o el modo **Batalla** (*Battle* contra la IA) desde la interfaz normal sin necesidad de query flags.
3. Jugar la partida con la instrumentación Tactical adecuada al modo seleccionado.
4. Detectar la finalización de la partida y mostrar un panel/modal de **Resultados** con el resumen de métricas oficiales.
5. Permitir acciones inmediatas post-partida: **Volver a jugar** (reiniciar el mismo modo) o **Regresar al menú principal**.
6. Garantizar la destrucción completa y recreación limpia de la instancia de Phaser al cambiar de pantalla o reiniciar modo, sin fugar recursos ni mantener sesiones pausadas en segundo plano.
7. Conservar las banderas de consulta existentes (`?battle-demo=1`, `?sudden-death-demo=1`, `?bot-sabotage=1`, `?tspin-demo=1`, etc.) estrictamente como accesos directos de desarrollo (DEV) y pruebas E2E.

---

## 3. Estado previo

Al iniciar la Tarea 0025:

- `apps/web/src/App.vue` monta directamente `GameCanvas.vue` y muestra el tablero principal de forma incondicional desde la carga de la página.
- No existe un concepto de pantalla principal o navegación en `apps/web`. El estado de la interfaz se limita a `GamePresentationState.status` (`'running' | 'paused' | 'gameOver'`).
- En el modo individual sin query flags, la columna derecha `OpponentMonitor.vue` renderiza un patrón estático simulado con badges `SIMULADO`, lo que genera ambigüedad visual sobre si hay un rival activo o no.
- Para jugar contra el bot en Batalla Local, el usuario debe modificar la URL añadiendo `?battle-demo=1`.
- Al llegar a `gameOver` o resolverse la batalla, la interfaz solo muestra un texto estático (`GAME OVER`, `VICTORIA RIVAL`, `DERROTA RIVAL`, `EMPATE`) sin un desglose modal de resultados ni botones para volver al menú o cambiar de modo.
- `GameCanvas.vue` destruye la instancia de Phaser en `onBeforeUnmount()`, pero `App.vue` no conmuta componentes ni gestiona la destrucción al cambiar de modo de juego.

---

## 4. Alcance

### 4.1 Navegación en Vue
- Definir un estado explícito de pantalla en Vue:
  ```ts
  export type AppScreen = 'menu' | 'playing' | 'results';
  ```
- La navegación pertenece de forma exclusiva a la capa web (`apps/web`) y no altera `@rautfall/game-engine`, `@rautfall/battle-engine` ni Phaser.

### 4.2 Selección de Modos
- Definir el tipo de modo de juego:
  ```ts
  export type GameMode = 'training' | 'battle';
  ```
- Permitir la selección e inicio de ambos modos desde la interfaz gráfica normal sin parámetros en la URL.

### 4.3 Menú Principal
- Crear una pantalla o componente de Menú Principal (`ModeSelector.vue`) integrado en la carcasa *Industrial Dramatic*:
  - Identidad tipográfica Rautfall.
  - Descriptor (*Build. Disrupt. Survive.*).
  - Botón de inicio para **Modo Entrenamiento** (1P).
  - Botón de inicio para **Modo Batalla Local** (2P contra `DeterministicBot`).
  - Resumen claro de controles de teclado (`ArrowLeft`/`ArrowRight`, `ArrowUp`, `Z`, `Space`, `C`, `A`, `Esc`, `R`).
  - Sin enlaces a funcionalidades fuera del MVP (Ranking, Historial, Ajustes o Autenticación no se incluirán visualmente como botones activos ni ficticios).

### 4.4 Modo Entrenamiento (Training)
- Al seleccionar **Training**:
  - Se ejecuta la sesión individual de un solo motor (`createGameEngine`).
  - La columna `OpponentMonitor.vue` no mostrará un tablero rival simulado con celdas ficticias como si fuera un oponente real.
  - `OpponentMonitor.vue` mostrará un estado explícito de standby de entrenamiento (`mode === 'training'`), indicando claramente `ENTRENAMIENTO`, `SIN OPONENTE` o `MONITOR EN STANDBY`.
  - La consola táctica propia mantendrá la presentación de cola de 3, reserva, puntuación, combo, back-to-back, nivel, velocidad de gravedad, energía, cartucho de sabotajes y basura.

### 4.5 Modo Batalla (Battle)
- Al seleccionar **Battle**:
  - Se ejecuta la sesión de batalla determinista (`createBattleSession`) con P1 humano y P2 `DeterministicBot`.
  - La columna `OpponentMonitor.vue` renderiza en tiempo real el segundo tablero real (`BattleSnapshot.playerTwo`), telemetría de P2, sabotajes enrutados e indicadores terminales (`DERROTA RIVAL`, `VICTORIA RIVAL`, `EMPATE`).
  - Conserva Muerte Súbita, sabotajes y resolución determinista de victoria/empate.

### 4.6 Pantalla de Resultados
- Crear un panel o modal de **Resultados** (`ResultsModal.vue`) que se activa automáticamente al finalizar la partida:
  - Título según el resultado de la partida:
    - En Entrenamiento: `ENTRENAMIENTO FINALIZADO` / `GAME OVER`.
    - En Batalla: `VICTORIA` (si gana P1), `DERROTA` (si gana P2), `EMPATE` (derrota simultánea).
  - Desglose de métricas oficiales procedentes directamente de los contratos actuales (`GamePresentationState` / `BattlePresentationState`):
    - Puntuación final (`score`).
    - Nivel final alcanzado (`level`).
    - Tiempo total transcurrido (`elapsedMs` / formato mm:ss).
    - En Batalla: paso de resolución (`battleState.step`) y resultado del rival.
  - Botones de acción:
    - **Volver a jugar**: Reinicia de forma inmediata el mismo modo activo con una nueva instancia limpia.
    - **Menú principal**: Destruye la partida activa y regresa a la pantalla `'menu'`.

### 4.7 Ciclo de vida y destrucción de Phaser
- Al salir de la pantalla `'playing'` (ya sea para volver al menú o para reiniciar desde resultados/menú):
  - Invocación explícita de `controller.destroy()`, que ejecuta `game.destroy(true)`.
  - Se eliminan todos los listeners del DOM, guardianes de liberación (`input-release-guard`) y temporizadores de Phaser.
  - Se descarta la referencia al controlador y al estado de sesión.
  - Al iniciar una nueva partida, se crea una instancia de Phaser totalmente nueva a través de `GameCanvas.vue`.
  - No se mantendrá ninguna sesión terminada ni pausada por detrás de la interfaz del menú.

### 4.8 Conservación de escenarios DEV y E2E
- Las query flags existentes (`?battle-demo=1`, `?bot-sabotage=1`, `?sudden-death-demo=1`, `?tspin-demo=1`, etc.) se conservan intactas dentro de `apps/web/src/game/` bajo la protección de `import.meta.env.DEV`.
- Si se detecta un parámetro query DEV relevante al cargar la aplicación en modo desarrollo, la aplicación web podrá saltarse la pantalla de menú e iniciar directamente el escenario DEV solicitado para garantizar la compatibilidad con las pruebas automáticas y el flujo de trabajo de desarrollo actual.

---

## 5. Exclusiones

Queda expresamente fuera del alcance de la Tarea 0025:

- **Sin cambios en los paquetes de dominio o batalla**: No se modifica `@rautfall/game-engine`, `@rautfall/battle-engine` ni `@rautfall/game-config`.
- **Sin nuevos sabotajes ni mecánicas**: No se implementa el sabotaje `interferencia`, avisos previos de sabotajes ni inmunidades.
- **Sin efectos de audio ni animación de líneas**: No se añade la capa Web Audio ni partículas/animaciones de Phaser.
- **Sin backend ni persistencia**: No se crean endpoints HTTP, base de datos PostgreSQL, Drizzle ORM, ni guardado local/remoto de puntuaciones.
- **Sin pantallas no solicitadas**: No se añaden menús o botones para Ranking, Historial, Ajustes, Login o Selección de Dificultad del bot.
- **Sin métricas calculadas en UI**: No se calculan ni muestran métricas que no existan explícitamente en los snapshots contractuales actuales (como combo máximo acumulado, recuento total de líneas eliminadas o causa detallada de derrota).
- **Sin Vue Router ni librerías de enrutamiento externas**: La navegación entre pantallas se resuelve de forma sencilla y ligera mediante estado reactivo interno en Vue (`appScreen` y `gameMode`).
- **Sin remapeo de teclado ni personalización de controles**.

---

## 6. Decisiones de arquitectura de presentación

### 6.1 Máquina de estados de navegación en Vue

La gestión de pantallas se desacopla completamente del ciclo de renderizado de Phaser. `App.vue` gobernará la pantalla visible a través de dos variables reactivas principales:

```ts
const appScreen = ref<AppScreen>('menu');
const gameMode = ref<GameMode>('battle');
```

Transiciones permitidas:

```text
       ┌──────────┐
       │   MENU   │
       └────┬─────┘
            │ Iniciar Training / Battle
            ▼
      ┌───────────┐
  ┌───┤  PLAYING  ├──────────┐
  │   └─────┬─────┘          │
  │         │ Partida        │ Botón "Menú"
  │         │ finaliza       │ durante pausa/juego
  │         ▼                │
  │   ┌───────────┐          │
  │   │  RESULTS  ├──────────┘
  │   └─────┬─────┘
  │         │
  └─────────┴─ Botón "Volver a jugar" (reinicia con instancia limpia)
```

### 6.2 Separación entre `AppScreen` y `SessionStatus`

Es fundamental no confundir la pantalla de la aplicación (`AppScreen`) con el estado interno de la sesión de juego (`SessionStatus` / `BattleStatus`):

- **`SessionStatus` (`'running' | 'paused' | 'gameOver'`)**: Gobernado por la escena de Phaser y los snapshots del motor. Se notifica a Vue mediante `onStateUpdate`.
- **`AppScreen` (`'menu' | 'playing' | 'results'`)**: Gobernado por Vue. Cuando `SessionStatus` pasa a `'gameOver'` (o `BattleStatus` pasa a estado terminal), Vue conmuta automáticamente a `AppScreen = 'results'` tras un breve retardo de cortesía (ej. 500 ms) para que el jugador perciba el movimiento final antes de la aparición del panel/modal.

### 6.3 Tratamiento de `OpponentMonitor.vue` según el modo

El componente `OpponentMonitor.vue` aceptará la prop opcional `mode?: GameMode`:

1. **En `mode === 'battle'`**: Renderiza las celdas reales de `playerTwo`, nivel, energía, sabotajes, basura pendiente y banderas de victoria/derrota.
2. **En `mode === 'training'`**: Renderiza un panel de instrumentación inactivo de la consola Tactical con la etiqueta clara `MODO ENTRENAMIENTO · SIN OPONENTE`. Las celdas de la cuadrícula permanecerán vacías (sin bloques ni patrones falsos) y los indicadores de telemetría mostrarán el estado en reposo/inactivo.

### 6.4 Destrucción y creación limpia de la instancia Phaser

Para evitar fugas de memoria, acumulación de event listeners en la ventana o interferencias en los buffers de teclado entre partidas:

1. Al entrar en `appScreen = 'playing'`, Vue monta `GameCanvas.vue`.
2. `GameCanvas.vue` en su hook `onMounted` llama a `createPhaserGame({ mode: gameMode.value, ... })`.
3. Al salir de `appScreen = 'playing'` (hacia `'menu'` o `'results'`), Vue desmonta `GameCanvas.vue` o ejecuta `controller.destroy()`.
4. `controller.destroy()` ejecuta `game.destroy(true)`, retirando el canvas del DOM y destruyendo todos los subsistemas de Phaser.

---

## 7. Contratos y tipos

### 7.1 Tipos de navegación en `apps/web/src/game/types.ts`

```ts
/**
 * Modos de juego soportados por la aplicación web.
 */
export type GameMode = 'training' | 'battle';

/**
 * Pantallas principales de la aplicación web.
 */
export type AppScreen = 'menu' | 'playing' | 'results';

/**
 * Resumen oficial de resultados al finalizar una partida.
 */
export type GameResultSummary = Readonly<{
  mode: GameMode;
  title: string;
  subtitle?: string;
  score: number;
  level: number;
  elapsedMs: number;
  battleResult?: Readonly<{
    status: BattleStatus;
    winner: BattleWinner;
    step: number;
  }>;
}>;
```

### 7.2 Extensión de `CreatePhaserGameOptions` en `apps/web/src/game/create-phaser-game.ts`

```ts
export type CreatePhaserGameOptions = {
  /** Elemento DOM que contendrá el canvas de Phaser. */
  parent: HTMLElement;
  /** Modo de juego seleccionado para la sesión ('training' | 'battle'). */
  mode: GameMode;
  /** Callback para notificar cambios de estado a Vue. */
  onStateUpdate: (state: GamePresentationState) => void;
};
```

---

## 8. Orden lógico de implementación

1. **Definir tipos de navegación (`types.ts`):** Añadir `GameMode`, `AppScreen` y `GameResultSummary`.
2. **Actualizar la factoría de Phaser (`create-phaser-game.ts` y `GameScene.ts`):** Aceptar el parámetro `mode: GameMode` en las opciones de inicialización para decidir si se arranca una sesión individual (`createGameEngine`) o una sesión de batalla (`createBattleSession` con `DeterministicBot`).
3. **Adaptar `OpponentMonitor.vue`:** Aceptar la prop `mode?: GameMode` para mostrar el estado de standby en Entrenamiento o la telemetría real en Batalla.
4. **Crear el Menú Principal (`ModeSelector.vue`):** Diseñar la pantalla de inicio Tactical con selección de Training y Battle.
5. **Crear el Panel/Modal de Resultados (`ResultsModal.vue`):** Diseñar la presentación de victoria/derrota/fin de entrenamiento con las métricas oficiales y acciones de navegación.
6. **Integrar el flujo completo en `App.vue`:** Conectar el estado `appScreen`, gestionar las transiciones, el montaje/desmontaje de `GameCanvas.vue` y el soporte de escenarios DEV.
7. **Pruebas unitarias:** Escribir tests para `ModeSelector.vue`, `ResultsModal.vue` y el flujo de estados de `App.vue`.
8. **Pruebas E2E:** Crear el archivo `navigation-flow.spec.ts` en Playwright para verificar el recorrido completo sin flags de depuración.

---

## 9. Pruebas requeridas

### 9.1 Pruebas unitarias en Vitest

- **`ModeSelector.test.ts`**:
  - Verificar el renderizado del título Rautfall, el descriptor y los botones de modo.
  - Comprobar que al hacer clic en "Entrenamiento" se emite la selección de modo `training`.
  - Comprobar que al hacer clic en "Batalla" se emite la selección de modo `battle`.

- **`ResultsModal.test.ts`**:
  - Verificar la presentación de victoria, derrota o empate en Batalla.
  - Verificar la presentación de fin de partida en Entrenamiento.
  - Comprobar la visualización exacta de puntuación, nivel y tiempo formateado.
  - Verificar la emisión de eventos al pulsar "Volver a jugar" y "Menú principal".

- **`App.test.ts`**:
  - Comprobar que la aplicación inicia por defecto en la pantalla `'menu'` (salvo si existe una flag DEV activa).
  - Verificar la transición de `'menu'` a `'playing'` al seleccionar un modo.
  - Verificar la transición a `'results'` al recibir un estado terminal.
  - Verificar la vuelta a `'menu'` al pulsar el botón de salir.

### 9.2 Pruebas E2E en Playwright (`navigation-flow.spec.ts`)

- **Flujo completo de Batalla Local sin flags**:
  1. Cargar la raíz `/` sin parámetros URL.
  2. Verificar que se muestra el Menú Principal con los botones de modo.
  3. Hacer clic en "Batalla contra la IA".
  4. Confirmar que se monta el tablero propio y el monitor rival en tiempo real.
  5. Simular la finalización de la partida o pulsar el botón de rendición/salida.
  6. Verificar que aparece el panel de Resultados con las métricas.
  7. Hacer clic en "Menú principal" y comprobar que se vuelve a la pantalla inicial limpia.

- **Flujo de Entrenamiento sin flags**:
  1. Cargar la raíz `/`.
  2. Hacer clic en "Modo Entrenamiento".
  3. Verificar que el monitor rival muestra el estado de standby (`ENTRENAMIENTO · SIN OPONENTE`).
  4. Interactuar con el juego y verificar el funcionamiento normal del motor individual.

---

## 10. Validaciones obligatorias

Antes de dar por completada la Tarea 0025, se deben ejecutar y superar sin errores ni advertencias desde la raíz del monorepo:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm exec playwright test`
- `git diff --check`

Adicionalmente, se debe ejecutar `pnpm dev`, verificar manualmente en el navegador la navegación fluida entre menú, juego y resultados tanto en modo Entrenamiento como en Batalla, comprobando que la consola del navegador permanezca libre de errores o avisos.

---

## 11. Criterios de aceptación

1. La aplicación web arranca en una pantalla de Menú Principal (*Industrial Dramatic*) sin requerir parámetros de URL.
2. El usuario puede iniciar **Modo Entrenamiento** (1P) y **Modo Batalla** (2P contra bot) desde la interfaz gráfica.
3. En Modo Entrenamiento, el monitor rival refleja claramente que no hay un oponente activo y no simula datos ficticios.
4. En Modo Batalla, el monitor rival muestra la instantánea en tiempo real del segundo tablero y del bot.
5. Al terminar la partida, aparece una pantalla de Resultados con la puntuación, nivel, tiempo transcurrido y resultado oficial.
6. El usuario puede reiniciar el mismo modo o regresar al Menú Principal desde la pantalla de Resultados.
7. Al salir o cambiar de partida, la instancia de Phaser se destruye por completo sin dejar procesos ni listeners residuales.
8. Se mantienen las query flags DEV existentes para pruebas internas y desarrollo.
9. Todos los comandos de validación (`test`, `lint`, `typecheck`, `build`, `playwright test`) finalizan con cero errores.
