# 0001 — Prototype Foundation

[Especificación de la tarea](../tasks/0001-base-del-prototipo.md)

Se ha completado la base mínima, ejecutable y probada del monorepo de Rautfall. El workspace contiene tres unidades: `apps/web` (aplicación Vue 3 con Vite), `packages/game-config` (configuración validada con TypeBox) y `packages/game-engine` (contrato mínimo del motor determinista).

Las herramientas de desarrollo compartidas (TypeScript, ESLint, Prettier, Vitest) están configuradas desde la raíz. Todos los comandos raíz funcionan sin necesidad de compilación previa de los paquetes internos.

## Archivos creados o modificados

### Modificados
- `package.json` — TypeScript actualizado de `^7.0.2` a `5.9.3` por compatibilidad con vue-tsc y typescript-eslint
- `packages/game-config/src/game-config.test.ts` — corrección de lint (variable `_` no usada)
- `pnpm-lock.yaml` — actualizado por el cambio de versión de TypeScript

### Creados
- `packages/game-engine/src/index.ts` — implementación completa del motor
- `packages/game-engine/src/game-engine.test.ts` — 20 tests del motor
- `apps/web/index.html` — entrada HTML de Vite
- `apps/web/vite.config.ts` — configuración de Vite
- `apps/web/src/main.ts` — punto de entrada de la aplicación Vue
- `apps/web/src/App.vue` — componente raíz con pantalla técnica
- `apps/web/src/env.d.ts` — declaraciones de tipos para `.vue`
- `apps/web/src/workspace.test.ts` — test de integración del workspace
- `README.md` — documentación principal
- [docs/implementation/0001-base-del-prototipo.md](0001-base-del-prototipo.md) — este informe

## Estructura final de paquetes

```
apps/
  web/
    index.html
    vite.config.ts
    package.json
    tsconfig.json
    src/
      main.ts
      App.vue
      env.d.ts
      workspace.test.ts
packages/
  game-config/
    package.json
    tsconfig.json
    src/
      index.ts
      game-config.test.ts
  game-engine/
    package.json
    tsconfig.json
    src/
      index.ts
      game-engine.test.ts
```

## API públicas producidas

### `@rautfall/game-config`

- `GameConfig` (tipo)
- `GameConfigValidationIssueCode` (tipo)
- `GameConfigValidationIssue` (tipo)
- `GameConfigValidationError` (clase, `code: "INVALID_GAME_CONFIG"`)
- `parseGameConfig(input: unknown): GameConfig`
- `prototypeConfig: GameConfig`

### `@rautfall/game-engine`

- `EngineStatus` (tipo, valor único: `'running'`)
- `GameEvent` (tipo unión: `engineStarted | engineReset`)
- `EngineSnapshot` (tipo: `step`, `elapsedMs`, `status`, `seed`, `configVersion`)
- `EngineStepInput` (tipo: `Record<string, never>`)
- `EngineOptions` (tipo: `seed`, `config`)
- `GameEngine` (tipo interfaz: `step`, `getSnapshot`, `drainEvents`, `reset`)
- `EngineOptionsError` (clase, `code: "INVALID_ENGINE_OPTIONS"`)
- `createGameEngine(options: EngineOptions): GameEngine` (factoría)

## Pruebas añadidas

### `packages/game-config` (12 tests, existentes, no modificados funcionalmente)
Validación de configuración, rechazo de propiedades desconocidas, obligatorias ausentes, rangos inválidos, divisibilidad relacional, y ausencia de sustitución silenciosa.

### `packages/game-engine` (20 tests)
- Creación válida del motor
- Semilla 0 y semilla uint32 máxima aceptadas
- Semilla negativa, excedida y no entera rechazadas
- Un paso consume `config.fixedStepMs`
- Configuración alternativa con `fixedStepMs: 25` demuestra que no hay hardcodeo de 10
- Pasos repetidos acumulan `step` y `elapsedMs`
- Snapshot inmutable (no permite mutación en runtime)
- `engineStarted` emitido en creación
- Eventos devueltos en orden de emisión
- `drainEvents` vacía la cola
- Segundo drenaje sin eventos devuelve colección vacía
- Reset restaura contadores a cero
- Reset elimina eventos previos y emite exactamente un `engineReset`
- Reset valida opciones
- Reset seguido de step funciona
- Dos resets consecutivos son consistentes
- Entradas idénticas producen el mismo resultado observable

### `apps/web` (4 tests)
- Resolución de `@rautfall/game-config` por nombre
- Resolución de `@rautfall/game-engine` por nombre
- Ambos paquetes funcionan juntos
- Verificación de que no existen imports profundos (test simbólico)

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 36 passed, 0 failed |
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | 3 paquetes, todos exitosos |
| `pnpm build` | Build exitoso (261 módulos) |

## Versiones utilizadas

| Herramienta | Versión |
|-------------|---------|
| Node.js | 22.22.3 |
| pnpm | 10.34.5 |
| TypeScript | 5.9.3 |
| Vue | 3.5.39 |
| Vite | 8.1.4 |
| Vitest | 4.1.10 |
| vue-tsc | 3.3.7 |
| ESLint | 10.7.0 |
| Prettier | 3.9.5 |
| TypeBox | 0.34.52 |

## Desviaciones respecto a la especificación

- **TypeScript versionado a 5.9.3**: la versión inicial `^7.0.2` resolvió a 7.0.2, que resultó incompatible con `vue-tsc@3.3.7` y `typescript-eslint@8.63.0`. Se fijó a `5.9.3` como única corrección; todas las demás dependencias permanecen sin cambios.

## Deuda técnica o seguimientos

- El tipo `EngineStepInput` es un placeholder vacío (`Record<string, never>`) hasta que existan comandos de juego reales en 0002.
- `status` del motor contiene únicamente el valor `'running'`. Los estados `paused` y `gameOver` se añadirán cuando existan consumidores reales.
- No se ha implementado el PRNG `mulberry32`; queda diferido a 0002 según la especificación.
- ESLint `no-unused-vars` se satisface mediante `void` explícito para el parámetro `_input` de `step()`.

## Confirmación de alcance excluido

No se ha introducido nada del alcance excluido:

- ✅ Sin tablero, piezas, PRNG de juego, movimiento, DAS/ARR, SRS, gravedad, colisiones, lock delay, líneas, Phaser, Vue Router, Pinia, Playwright, backend, base de datos, autenticación, ranking, Azure, Docker, CI/CD, Husky, lint-staged, commitlint, Turborepo, i18n, audio, diseño visual definitivo ni layout Industrial Dramatic.
- ✅ No existen carpetas preventivas vacías.
- ✅ No existen imports profundos entre paquetes.
- ✅ No hay interfaces con prefijo `I`.
- ✅ No hay implementaciones con sufijo `Impl`.
- ✅ No hay abstracciones sin uso real.
- ✅ El workspace contiene únicamente las tres unidades acordadas.
- ✅ Las dependencias internas usan `workspace:*`.
- ✅ ES Modules se usa de forma consistente.
- ✅ No hay CommonJS imports ni `require()`.
