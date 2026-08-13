# Informe de implementación — Tarea 0035: Perfiles de dificultad del bot (CADET / OPERATOR / ELITE)

## Resumen

Se han introducido tres perfiles de dificultad seleccionables para el rival heurístico de Rautfall (`CADET`, `OPERATOR` y `ELITE`) sin duplicar la implementación del bot ni alterar las reglas físicas del juego (SRS, DAS, ARR, gravedad o lock delay).

Existe **un único bot heurístico** (`DeterministicBot`), cuyo comportamiento se modula mediante perfiles de configuración centralizados en `@rautfall/battle-engine`.

---

## Perfiles de Dificultad y Comparativa

| Parámetro / Dimensión | CADET (`battleCadet`) | OPERATOR (`battleOperator`) | ELITE (`battleElite`) |
| :--- | :--- | :--- | :--- |
| **Identificador (`BotProfileId`)** | `'battleCadet'` | `'battleOperator'` | `'battleElite'` |
| **Etiqueta en UI** | CADET | OPERATOR | ELITE |
| **Retardo de reacción (`reactionDelaySteps`)** | 30 pasos (300 ms) | 20 pasos (200 ms) | 10 pasos (100 ms) |
| **Intervalo entre acciones (`actionIntervalSteps`)** | 6 pasos (60 ms) | 4 pasos (40 ms) | 2 pasos (20 ms) |
| **Pausa pre-HardDrop (`hardDropDelaySteps`)** | 8 pasos (80 ms) | 5 pasos (50 ms) | 2 pasos (20 ms) |
| **Tolerancia de suboptimalidad (`optimalityTolerance`)** | 80.0 puntos | 25.0 puntos | 5.0 puntos |
| **Prob. elección subóptima (`suboptimalChoiceProbability`)** | 0.40 (40%) | 0.15 (15%) | 0.02 (2%) |
| **Umbral energía sabotaje (`sabotageEnergyThreshold`)** | 90 E | 60 E | 40 E |
| **Intervalo eval. sabotaje (`sabotageIntervalSteps`)** | 100 pasos (1000 ms) | 50 pasos (500 ms) | 20 pasos (200 ms) |
| **Cooldown de sabotaje (`sabotageCooldownSteps`)** | 300 pasos (3000 ms) | 150 pasos (1500 ms) | 80 pasos (800 ms) |
| **Presupuesto de búsqueda (`maxSearchNodes`)** | 500 nodos | 500 nodos | 500 nodos |
| **Ponderación heurística (`weights`)** | Idéntica | Idéntica | Idéntica |
| **Reglas físicas (SRS/DAS/ARR/LockDelay)** | Idénticas | Idénticas | Idénticas |

---

## Principios y Mecánica de Selección Subóptima

1. **Invariante "Nunca Suicida" (Non-Suicidal Invariant):**
   - La selección estocástica subóptima opera exclusivamente sobre candidatos no terminales cuando exista al menos uno (`nonTerminalCandidates.length > 0`).
   - El bot nunca elegirá una colocación terminal (game over) mientras disponga de alternativas viables de supervivencia.

2. **Política Estocástica Determinista:**
   - Para un `SearchResult`, la mejor puntuación de colocación es `bestScore = candidates[0].score`.
   - Se identifica el conjunto de candidatos elegibles cuya diferencia de score respeta la tolerancia del perfil: `bestScore - candidate.score <= optimalityTolerance`.
   - Con probabilidad `suboptimalChoiceProbability`, se selecciona uniformemente un candidato elegible mediante el PRNG interno del bot. En caso contrario, o si no hay elegibles secundarios, se selecciona la opción óptima (`candidates[0]`).
   - Dado un estado inicial y una semilla, la trayectoria y selección son 100% reproducibles y deterministas.

3. **Inclusión de Conjuntos de Elegibilidad:**
   - Dados los umbrales de tolerancia configurados ($80.0 > 25.0 > 5.0$), para cualquier `SearchResult` se cumple la inclusión estricta de candidatos elegibles:
     $$\text{elegibles}(\text{ELITE}) \subseteq \text{elegibles}(\text{OPERATOR}) \subseteq \text{elegibles}(\text{CADET})$$

---

## Normalización y Compatibilidad de Perfiles

Se implementó la función pura `normalizeBotProfileId(value: string | undefined | null): BotProfileId`:
- Envia `'battleCadet'`, `'battleOperator'` o `'battleElite'` si el valor coincide exactamente.
- Envia `'battleOperator'` en caso de `undefined`, `null`, valor inválido o el alias heredado `'bot-deterministic-v1'`.

`DEFAULT_BOT_PROFILE_ID` se fijó en `'battleOperator'`.

---

## Archivos Creados y Modificados

### Creados:
- `packages/battle-engine/src/bot/profiles.ts` *(Definición de perfiles, constantes, `normalizeBotProfileId` y `getBotProfileConfig`)*
- `packages/battle-engine/src/bot/profiles.test.ts` *(Pruebas unitarias de ordenación relativa, normalización de alias e independencia de reglas físicas)*
- `docs/implementation/0035-perfiles-dificultad-bot.md` *(Informe de implementación de la tarea 0035)*

### Modificados:
- `packages/battle-engine/src/bot/types.ts` *(Añadido `BotProfileId` y campos `optimalityTolerance` / `suboptimalChoiceProbability` en `BotConfig`)*
- `packages/battle-engine/src/bot/deterministic-bot.ts` *(Integración de `selectCandidate` determinista con PRNG interno e invariante de supervivencia)*
- `packages/battle-engine/src/bot/deterministic-bot.test.ts` *(Pruebas deterministas de diferenciació, inclusión de conjuntos y no suicidio)*
- `packages/battle-engine/src/index.ts` *(Re-exportación de constantes, funciones y tipos de perfiles)*
- `apps/web/src/components/ModeSelector.vue` *(UI de selección de perfil BOT PROFILE con selector de botones [ CADET ] [ OPERATOR ] [ ELITE ] situado inmediatamente por encima del botón clicable del módulo de Batalla como bloque hermano independiente)*
- `apps/web/src/game/scenes/GameScene.ts` *(Propagación de `botProfile` a `playerTwoBot` instanciando `createDeterministicBot(getBotProfileConfig(...))`)*
- `apps/web/src/game/create-phaser-game.ts` *(Propagación de `botProfile` en `CreatePhaserGameOptions`)*
- `apps/web/src/components/GameCanvas.vue` *(Propagación de la prop `botProfile` a `createPhaserGame`)*
- `apps/web/src/App.vue` *(Estado reactivo `selectedBotProfile`, propagación a `GameCanvas` y envío de `opponentProfile` en POST de partidas)*
- `docs/rautfall.md` *(Actualizado mapa funcional con la especificación de perfiles de bot)*
- `docs/project-status.md` *(Actualizado registro de estado del proyecto para la Tarea 0035)*

---

## API Pública Producida

```ts
export type BotProfileId = 'battleCadet' | 'battleOperator' | 'battleElite';

export const DEFAULT_BOT_PROFILE_ID: BotProfileId = 'battleOperator';

export function normalizeBotProfileId(value: string | undefined | null): BotProfileId;

export function getBotProfileConfig(profileId?: BotProfileId | string | null): BotConfig;

export const BOT_PROFILES: Record<BotProfileId, Readonly<BotConfig>>;
```

---

## Resultados de las Validaciones Raíz

Ejecutados desde la raíz del monorepo:

- `pnpm test`: **725 tests pasados en verde (34 archivos de test)**.
- `pnpm lint`: **0 errores, 0 avisos de linting en todos los paquetes**.
- `pnpm typecheck`: **0 errores de TypeScript**.
- `pnpm build`: **Compilación exitosa en producción**.
