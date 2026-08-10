# Tarea 0030 — Informe de implementación

## 1. Veredicto
✅ **COMPLETADA Y AUDITADA CON ÉXITO**

Se ha implementado y auditado el primer vertical de plataforma completo para Rautfall:
- Paquete de contratos HTTP tipados en `@rautfall/contracts` (`packages/contracts`) con esquemas TypeBox y discriminated unions para los resultados de cada modo.
- Servidor backend en `apps/api` (`@rautfall/api`) con Fastify, TypeScript estricto, Drizzle ORM y PostgreSQL.
- Modelo de persistencia idempotente `matches` por `clientMatchId` (status 201 Created para inserción nueva, 200 OK para duplicados con payload idéntico, y 409 Conflict saneado con `MATCH_IDEMPOTENCY_CONFLICT` para duplicados con payload diferente).
- Consulta de historial por jugador (`GET /api/matches?playerId=<uuid>&limit=20`) ordenado por `created_at DESC, id DESC`.
- Consulta de ranking individual por modo (`GET /api/ranking?mode=<training|battle>&limit=20`) con la mejor puntuación de cada jugador único y tie-break determinista `score DESC, created_at ASC, id ASC`.
- Identidad anónima MVP basada en UUID v4 persistido en `localStorage` (`rautfall_player_id`) con alias derivado determinista `Jugador-XXXX` y recuperación ante valores corruptos.
- Cliente HTTP tipado en `apps/web` con envío de resultados asíncrono y non-blocking, resolución inteligente de `VITE_API_BASE_URL` (desarrollo local `http://localhost:3000`, producción `""` relativa para reverse proxy/same-origin).
- Pantallas `HistoryScreen.vue` y `RankingScreen.vue` en `apps/web` con estética Industrial Dramatic y manejo de estados (`loading`, `empty`, `error`, `success`).
- Estrategia de tests: 841 tests unitarios e integración con PostgreSQL real mediante `@testcontainers/postgresql` en Vitest, y suite E2E de Playwright.

## 2. Auditoría inicial
- Se auditaron las métricas del juego: los motores (`packages/game-engine` y `packages/battle-engine`) no registraban agregados históricos de T-Spins ni sabotajes por partida. Se decidió conscientemente no alterar la lógica del motor en la Tarea 0030 y persistir únicamente métricas contractuales reales (`score`, `linesCleared`, `level`, `durationMs`, `mode`, `result`, `opponentProfile`).
- Docker se encontró disponible en el sistema, permitiendo ejecutar pruebas de integración sobre PostgreSQL real con Testcontainers.

## 3. Arquitectura backend
`apps/api` sigue la convención modular del monorepo sin inyección de dependencias innecesaria:
- `src/config/env.ts`: Validación de variables de entorno con TypeBox (`DATABASE_URL`, `PORT`, `HOST`, `NODE_ENV`, `CORS_ORIGIN`).
- `src/db/`: Instancia de Drizzle ORM y `pg.Pool`.
- `src/repositories/matches-repository.ts`: Módulo de repositorio desacoplado para consultas SQL de Drizzle con comprobación estricta de conflicto de idempotencia (409).
- `src/routes/`: Rutas modularizadas `health.ts`, `matches.ts` y `ranking.ts`.
- `src/app.ts`: Factoría de aplicación Fastify apta para `fastify.inject()`.
- `src/server.ts`: Punto de entrada ejecutable.
- `src/db/cli-migrate.ts`: Script ejecutable CLI para `pnpm --filter @rautfall/api db:migrate`.

## 4. Contratos API
Exportados desde `@rautfall/contracts`:
- `CreateMatchInputSchema`: Union discriminada entre `CreateTrainingMatchInputSchema` (`mode: 'training'`, `result: 'finished'`, `opponentProfile: null`) y `CreateBattleMatchInputSchema` (`mode: 'battle'`, `result: 'victory'|'defeat'|'draw'`, `opponentProfile: string`).
- `MatchRecordSchema`: Tipo completo de partida persistida devuelta por la API.
- `GetMatchesQuerySchema`: Validante de `playerId` (UUID) y `limit` (1..100).
- `GetRankingQuerySchema`: Validante de `mode` (`'training'` | `'battle'`) y `limit` (1..100).
- `HealthResponseSchema` y `ErrorResponseSchema`.

## 5. Modelo PostgreSQL
Tabla `matches` en Drizzle (`apps/api/src/db/schema.ts`):
```sql
CREATE TABLE IF NOT EXISTS "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"player_name" varchar(30) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"result" varchar(20) NOT NULL,
	"score" integer NOT NULL,
	"lines_cleared" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"level" integer NOT NULL,
	"opponent_profile" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```
Índices:
- `idx_matches_client_match_id_unique`: `UNIQUE(client_match_id)`
- `idx_matches_history`: `(player_id, created_at DESC, id DESC)`
- `idx_matches_ranking`: `(mode, score DESC, created_at ASC, id ASC)`

## 6. Migraciones
- Generadas en `apps/api/drizzle/` mediante `drizzle-kit` (`0000_initial_matches_schema.sql` y metadatos `meta/_journal.json`).
- Script de aplicación `apps/api/src/db/cli-migrate.ts` ejecutable de forma autónoma via `pnpm --filter @rautfall/api db:migrate`.
- Las migraciones están versionadas y no se requiere `drizzle-kit push`. Una DB limpia puede ser migrada desde cero.

## 7. Endpoints
- `GET /api/health`: Chequea el estado del servidor y realiza `SELECT 1` a PostgreSQL.
- `POST /api/matches`: Registra una partida dada por `clientMatchId`. Retorna `201 Created` para inserciones nuevas, `200 OK` para envíos duplicados con payload idéntico, y `409 Conflict` (`MATCH_IDEMPOTENCY_CONFLICT`) si el payload difiere.
- `GET /api/matches?playerId=<uuid>&limit=20`: Devuelve el historial del jugador.
- `GET /api/ranking?mode=<training|battle>&limit=20`: Devuelve la clasificación agregada por jugador.

## 8. History
- La consulta filtra estrictamente por `playerId`.
- Ordenación: `created_at DESC, id DESC`.
- `HistoryScreen.vue` consulta `getMatchHistory(playerId)` y muestra el estado en una tabla táctica.

## 9. Ranking
- Separado estrictamente por modo (`training` o `battle`).
- CTE / Window Function con `ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score DESC, created_at ASC, id ASC)` para obtener una única mejor entrada por jugador.
- Orden global del ranking: `score DESC, created_at ASC, id ASC`.

## 10. Identidad MVP
- `apps/web/src/api/identity.ts`: Genera y persiste un UUID v4 en `localStorage['rautfall_player_id']`. Si el valor está ausente o corrupto/no-UUID, genera uno nuevo válido.
- Deriva el alias estable `Jugador-XXXX` a partir de los últimos 4 caracteres del UUID si no existe un nombre personalizado (máximo 30 caracteres, sin datos personales).

## 11. Integración web
- `apps/web/src/api/client.ts`: Cliente `fetch` nativo con `getApiBaseUrl()`.
- Al finalizar partida en `App.vue`, se envía `submitMatch(...)` de forma non-blocking.
- `ResultsModal.vue` muestra una etiqueta discreta de estado de guardado (`Guardando en ranking...`, `Partida registrada ✓`, `Modo local`).

## 12. Gestión de errores
- `handleAppError` en `apps/api`: Captura `AppError` y errores de validación de Fastify respondiendo `{ code: string, message: string }`. Sanita los errores 500 internos evitando volcar stack traces o SQL.
- `ApiClientError` en `apps/web`: Manejo elegante de fallos de red en la interfaz.

## 13. Seguridad y límites
- Validaciones con TypeBox / regex UUID en frontera HTTP.
- Queries parametrizadas mediante Drizzle / SQL template tags.
- Configuración explícita de `CORS_ORIGIN` en Fastify.

## 14. Tests
- **Contratos (`packages/contracts`)**: 6 pruebas unitarias de validación TypeBox.
- **Integración PostgreSQL (`apps/api`)**: 6 pruebas de `MatchesRepository` sobre PostgreSQL real efímero con Testcontainers.
- **Rutas API (`apps/api`)**: 10 pruebas con `fastify.inject()` sobre PostgreSQL Testcontainers.
- **Web UI & API client (`apps/web`)**: Pruebas unitarias de `identity.ts`, `client.ts`, `HistoryScreen.vue`, `RankingScreen.vue`.
- **E2E Playwright**: Suite completa de Playwright E2E.

## 15. Validaciones
Todas las validaciones ejecutadas desde la raíz finalizaron con 0 errores y 0 warnings:
- `pnpm test` (841 tests en verde)
- `pnpm lint` (0 errores, 0 warnings)
- `pnpm typecheck` (0 errores en 7 proyectos)
- `pnpm build` (compilación exitosa de `apps/web` y `@rautfall/api`)
- `git diff --check` (0 errores de formato)

## 16. Documentación
- Creada especificación inmutable `docs/tasks/0030-backend-persistencia-ranking-history.md`.
- Creado informe de implementación `docs/implementation/0030-backend-persistencia-ranking-history.md`.
- Actualizado `docs/project-status.md`.

## 17. Archivos

### Creados
- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/src/index.ts`
- `packages/contracts/src/common.ts`
- `packages/contracts/src/matches.ts`
- `packages/contracts/src/matches.test.ts`
- `apps/api/package.json`
- `apps/api/tsconfig.json`
- `apps/api/drizzle.config.ts`
- `apps/api/.env.example`
- `apps/api/drizzle/0000_initial_matches_schema.sql`
- `apps/api/drizzle/meta/_journal.json`
- `apps/api/drizzle/meta/0000_snapshot.json`
- `apps/api/src/server.ts`
- `apps/api/src/app.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/db/index.ts`
- `apps/api/src/db/schema.ts`
- `apps/api/src/db/migrate.ts`
- `apps/api/src/db/cli-migrate.ts`
- `apps/api/src/errors/app-error.ts`
- `apps/api/src/repositories/matches-repository.ts`
- `apps/api/src/routes/health.ts`
- `apps/api/src/routes/matches.ts`
- `apps/api/src/routes/ranking.ts`
- `apps/api/test/integration/matches-repository.test.ts`
- `apps/api/test/routes/api.test.ts`
- `apps/web/src/api/identity.ts`
- `apps/web/src/api/identity.test.ts`
- `apps/web/src/api/client.ts`
- `apps/web/src/api/client.test.ts`
- `apps/web/src/components/HistoryScreen.vue`
- `apps/web/src/components/HistoryScreen.test.ts`
- `apps/web/src/components/RankingScreen.vue`
- `apps/web/src/components/RankingScreen.test.ts`
- `docs/tasks/0030-backend-persistencia-ranking-history.md`
- `docs/implementation/0030-backend-persistencia-ranking-history.md`

### Modificados
- `pnpm-workspace.yaml`
- `apps/web/package.json`
- `apps/web/src/game/types.ts`
- `apps/web/src/components/ModeSelector.vue`
- `apps/web/src/components/ResultsModal.vue`
- `apps/web/src/App.vue`
- `docs/project-status.md`

## 18. Dependencias añadidas
- `@rautfall/contracts`: `@sinclair/typebox`
- `apps/api`: `fastify`, `@fastify/cors`, `@fastify/type-provider-typebox`, `@sinclair/typebox`, `dotenv`, `drizzle-orm`, `pg`, `@types/pg`, `drizzle-kit`, `tsx`, `testcontainers`, `@testcontainers/postgresql`

## 19. Git
Árbol listo para revisión. Sin commits realizados.

## 20. Riesgos pendientes
Ninguno. Las funciones de plataforma base, persistencia idempotente y visualización están completamente cubiertas con tests y validaciones.
