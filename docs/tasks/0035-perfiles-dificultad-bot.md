# Task 0035 — Perfiles de dificultad del bot (CADET / OPERATOR / ELITE)

## Propósito

Introducir tres perfiles seleccionables de dificultad (`CADET`, `OPERATOR`, `ELITE`) para el rival heurístico automatizado en el modo Batalla de Rautfall. Los perfiles deben modular la agresividad, velocidad de reacción, cadencia de colocación, tolerancia de optimalidad estocástica y umbral de lanzamiento de sabotajes de la IA, sin crear tres implementaciones separadas del bot, sin alterar las reglas físicas del motor (`Super Rotation System`, `DAS`, `ARR`, `lock delay`, gravedad), sin violar la igualdad de percepción y manteniendo la determinibilidad estricta mediante el generador PRNG interno de la partida.

---

## Decisiones Aprobadas

1. **Arquitectura de Bot Único:**
   - No se crean tres bots ni tres algoritmos de búsqueda distintos.
   - Existe **un único bot heurístico** (`DeterministicBot`), cuyo comportamiento es modulado mediante objetos de configuración pura (`BotConfig`).

2. **Identificador de Perfil y Valores por Defecto:**
   - Tipo público exportado: `export type BotProfileId = 'battleCadet' | 'battleOperator' | 'battleElite';`.
   - Perfil por defecto: `OPERATOR` (`'battleOperator'`).
   - Normalización pura: `normalizeBotProfileId(value)` convierte `undefined`, `null`, cadenas vacías o el alias heredado `'bot-deterministic-v1'` a `'battleOperator'`.

3. **Parámetros Modulables por Perfil:**

   | Parámetro / Perfil | `CADET` (`battleCadet`) | `OPERATOR` (`battleOperator`) | `ELITE` (`battleElite`) |
   | ------------------ | ----------------------- | ----------------------------- | ----------------------- |
   | `reactionDelaySteps` | 18 ticks (~300 ms) | 12 ticks (~200 ms) | 6 ticks (~100 ms) |
   | `actionIntervalSteps` | 4 ticks | 3 ticks | 2 ticks |
   | `hardDropDelaySteps` | 2 ticks | 1 tick | 1 tick |
   | `optimalityTolerance` | 80.0 pts | 25.0 pts | 5.0 pts |
   | `suboptimalChoiceProbability` | 0.40 (40%) | 0.15 (15%) | 0.02 (2%) |
   | `sabotageEnergyThreshold` | 70.0 pts | 45.0 pts | 25.0 pts |
   | `sabotageIntervalSteps` | 300 ticks (5s) | 180 ticks (3s) | 120 ticks (2s) |
   | `sabotageCooldownSteps` | 300 ticks | 180 ticks | 120 ticks |

4. **Presupuesto de Búsqueda Idéntico (`maxSearchNodes`):**
   - `maxSearchNodes = 500` constante en todos los perfiles.
   - No se utiliza la completitud de la búsqueda BFS de posiciones alcanzables como mecanismo de degradación. La legalidad y alcance de los movimientos examinados es exactamente igual para los tres niveles.

5. **Invariantes Fundamentales de Dominio:**
   - **Igualdad de Reglas Físicas:** Jugador humano y bot se rigen por los mismos algoritmos de SRS, tablas de wall-kicks, retardo de fijación (`lock delay`), reinicios por movimiento, gravedad y colisiones.
   - **Invariante "Nunca Suicida" (Non-Suicidal Invariant):** La selección estocástica de movimientos subóptimos opera exclusivamente sobre candidatos no terminales (`nonTerminalCandidates`) mientras exista al menos una posición que no provoque la derrota inmediata (`top-out`).
   - **Selección Estocástica Determinista:** La elección de candidatos subóptimos dentro del rango `[bestScore - optimalityTolerance, bestScore]` utiliza el generador pseudoaleatorio determinista de la sesión (`prng`), asegurando reproducibilidad exacta ante semillas e insumos idénticos.
   - **Inclusión de Conjuntos de Elegibilidad:** Para un mismo mapa de posiciones candidatas evaluadas, los conjuntos de candidatos elegibles cumplen:
     $$\text{Elegibles}(\text{ELITE}) \subseteq \text{Elegibles}(\text{OPERATOR}) \subseteq \text{Elegibles}(\text{CADET})$$

6. **Interfaz de Usuario e Integración Visual:**
   - Selector `BOT PROFILE` ubicado en `apps/web/src/components/ModeSelector.vue` dentro de la columna de Batalla, posicionado por encima del módulo clicable `BATALLA TÁCTICA`.
   - El selector es un bloque hermano independiente fuera del área interactiva de inicio de partida (no desata la partida al hacer clic en un perfil).
   - Separación estricta en CSS de los estados `:hover`, `:focus-visible` (exclusivo para navegación por teclado) y `.bot-profile-btn--selected`.
   - El modo `ENTRENAMIENTO` permanece 100% inalterado.

7. **Persistencia y Registro del Rival (`opponentProfile`):**
   - Transmisión de `botProfile` seleccionado a la escena de Phaser (`GameScene.ts`), a `GameCanvas.vue` y en el payload POST `CreateMatchInput` (`opponentProfile`) para registrar el perfil utilizado en cada sesión.

---

## Especificación Modular y Contratos Puramente Compartidos

### 1. Tipos y Definición de Perfiles (`packages/battle-engine/src/bot/types.ts` & `profiles.ts`)

```ts
export type BotProfileId = 'battleCadet' | 'battleOperator' | 'battleElite';

export type BotConfig = Readonly<{
  reactionDelaySteps: number;
  actionIntervalSteps: number;
  hardDropDelaySteps: number;
  maxSearchNodes: number;
  heuristicWeights: BotHeuristicWeights;
  optimalityTolerance: number;
  suboptimalChoiceProbability: number;
  sabotageEnergyThreshold: number;
  sabotageIntervalSteps: number;
  sabotageCooldownSteps: number;
}>;

export const DEFAULT_BOT_PROFILE_ID: BotProfileId = 'battleOperator';

export function normalizeBotProfileId(profileId?: string | null): BotProfileId;
export function getBotProfileConfig(profileId?: BotProfileId | string | null): BotConfig;
```

---

### 2. Política de Selección Estocástica y "Nunca Suicida" (`packages/battle-engine/src/bot/deterministic-bot.ts`)

```ts
export function selectCandidate(
  searchResult: SearchResult,
  config: BotConfig,
  prng: () => number,
): PlacementCandidate {
  // Invariante "Nunca Suicida": filtrar candidatos terminales si existen supervivientes
  const pool = searchResult.nonTerminalCandidates.length > 0
    ? searchResult.nonTerminalCandidates
    : searchResult.candidates;

  const bestScore = searchResult.bestCandidate.heuristicScore;
  const eligible = pool.filter(
    (candidate) => bestScore - candidate.heuristicScore <= config.optimalityTolerance,
  );

  // Decisión estocástica determinista guiada por el PRNG de la partida
  if (eligible.length > 1 && prng() < config.suboptimalChoiceProbability) {
    const index = Math.floor(prng() * eligible.length);
    return eligible[index]!;
  }

  return searchResult.bestCandidate;
}
```

---

### 3. Selector Visual e Interacción en el Menú (`apps/web/src/components/ModeSelector.vue`)

```html
<div class="battle-module-group">
  <div class="bot-profile-selector" data-testid="bot-profile-selector">
    <span class="bot-profile-label">BOT PROFILE</span>
    <div class="bot-profile-buttons" role="radiogroup" aria-label="Dificultad del rival">
      <button
        type="button"
        class="bot-profile-btn"
        :class="{ 'bot-profile-btn--selected': selectedBotProfile === 'battleCadet' }"
        role="radio"
        :aria-checked="selectedBotProfile === 'battleCadet'"
        data-testid="bot-profile-cadet"
        @click="setBotProfile('battleCadet')"
      >
        CADET
      </button>
      <button
        type="button"
        class="bot-profile-btn"
        :class="{ 'bot-profile-btn--selected': selectedBotProfile === 'battleOperator' }"
        role="radio"
        :aria-checked="selectedBotProfile === 'battleOperator'"
        data-testid="bot-profile-operator"
        @click="setBotProfile('battleOperator')"
      >
        OPERATOR
      </button>
      <button
        type="button"
        class="bot-profile-btn"
        :class="{ 'bot-profile-btn--selected': selectedBotProfile === 'battleElite' }"
        role="radio"
        :aria-checked="selectedBotProfile === 'battleElite'"
        data-testid="bot-profile-elite"
        @click="setBotProfile('battleElite')"
      >
        ELITE
      </button>
    </div>
  </div>

  <button
    type="button"
    class="mode-module mode-module--battle"
    data-testid="start-battle-button"
    @click="onSelectMode('battle')"
  >
    <!-- Contenido del botón de Batalla Táctica -->
  </button>
</div>
```

---

## Criterios de Aceptación

1. **Tres Perfiles Seleccionables y Parametrizados:**
   - Existen `CADET`, `OPERATOR` y `ELITE` expuestos en el paquete `@rautfall/battle-engine`.
   - `OPERATOR` es el perfil por defecto.

2. **Presupuesto de Búsqueda Fijo:**
   - `maxSearchNodes = 500` constante en todas las configuraciones de perfil.

3. **Invariante "Nunca Suicida":**
   - El bot nunca selecciona una posición que cause su derrota inmediata mientras existan alternativas no terminales disponibles en la búsqueda.

4. **Inclusión de Conjuntos de Elegibilidad:**
   - Las pruebas unitarias demuestran que para una misma instantánea, los conjuntos de candidatos admitidos por tolerancia cumplen $\text{ELITE} \subseteq \text{OPERATOR} \subseteq \text{CADET}$.

5. **Determinismo Estricto:**
   - Misma semilla + mismo estado + mismo perfil produce idéntica secuencia de decisiones en el bot.

6. **Normalización de Alias Heredados:**
   - Entradas `undefined` o `'bot-deterministic-v1'` se mapean limpiamente a `'battleOperator'`.

7. **Aislamiento de la Interfaz Visual:**
   - El selector `BOT PROFILE` vive fuera del área interactiva de `BATALLA TÁCTICA`. Pulsar un perfil altera la dificultad seleccionada pero no inicia la partida.
   - El estado visual hover no persiste tras hacer clic; el foco `:focus-visible` se reserva exclusivamente para navegación por teclado.

8. **Invariancia del Modo Entrenamiento:**
   - El modo `ENTRENAMIENTO` permanece inalterado y no muestra selectores de bot.

9. **Registro y Persistencia:**
   - El perfil del bot se transmite en el payload de creación de partida (`CreateMatchInput.opponentProfile`).

---

## Estrategia de Pruebas

1. `profiles.test.ts`:
   - Verificación de valores de parámetros por perfil.
   - Normalización de alias heredados y valores por defecto.
   - Comprobación de que `maxSearchNodes` e `heuristicWeights` son idénticos entre perfiles.
2. `deterministic-bot.test.ts`:
   - Regresión del invariante "Nunca Suicida" frente a candidatos terminales.
   - Inclusión de conjuntos de elegibilidad de candidatos por perfil.
   - Reproducibilidad determinista guiada por PRNG.
3. `ModeSelector.test.ts`:
   - Verificación de que `bot-profile-selector` se encuentra fuera de `start-battle-button` (`contains() === false`).
   - Selección por defecto de `OPERATOR`.
   - Emisión correcta de `selectMode` con `('battle', selectedBotProfile)`.
4. Validaciones globales desde la raíz: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
