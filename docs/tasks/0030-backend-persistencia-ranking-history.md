# Tarea 0030 — Backend base, persistencia de partidas, History y Ranking

## Objetivo

Implementar el primer vertical completo de plataforma en Rautfall:
partida finalizada → contrato API HTTP tipado en `@rautfall/contracts` → servidor Fastify en `apps/api` → persistencia PostgreSQL mediante Drizzle ORM → consultas de historial por jugador y ranking individual por modo → integración en `apps/web` con visualización en pantallas de History y Ranking.

## Alcance

- Crear el paquete de contratos compartidos `packages/contracts` (`@rautfall/contracts`).
- Crear la aplicación backend `apps/api` (`@rautfall/api`) con Fastify, Drizzle ORM y PostgreSQL.
- Definir el esquema versionado PostgreSQL (`matches`) con Drizzle y generar la migración SQL correspondiente.
- Implementar los endpoints HTTP:
  - `POST /api/matches`: Persistencia idempotente mediante `clientMatchId`.
  - `GET /api/matches?playerId=<uuid>&limit=<number>`: Historial ordenado por fecha de un jugador.
  - `GET /api/ranking?mode=<training|battle>&limit=<number>`: Ranking agregando la mejor puntuación por jugador dentro de cada modo.
  - `GET /api/health`: Endpoint de readiness técnico con verificación de conexión a PostgreSQL.
- Identidad anónima MVP basada en UUID v4 persistido localmente (`rautfall_player_id`) y alias derivado determinista (ej. `Jugador-A7F2`).
- Integrar cliente API HTTP tipado en `apps/web` con persistencia non-blocking al finalizar partida.
- Implementar pantallas de `HistoryScreen.vue` y `RankingScreen.vue` en `apps/web` siguiendo la dirección Industrial Dramatic.
- Estrategia de tests: unitarios de contratos/cliente, integración PostgreSQL real con Testcontainers en `apps/api`, `fastify.inject()` para endpoints y Playwright E2E.

## Decisiones Contractuales y Arquitectónicas

### 1. Paquete `@rautfall/contracts` (`packages/contracts`)
- Contiene exclusivamente definiciones de TypeBox schemas, DTOs de transporte HTTP y tipos TypeScript inferidos (`Static<typeof Schema>`).
- Sin lógica de dominio, sin repositorios, sin dependencias de Drizzle ni de Phaser/DOM.

### 2. Modelo de Partida (`MatchRecord`)
Persiste únicamente los datos contractuales reales emitidos por el juego sin telemetría técnica no requerida:
- `id`: UUID (servidor, Primary Key)
- `clientMatchId`: UUID (cliente, UNIQUE)
- `playerId`: UUID (cliente)
- `playerName`: String (max 30 caracteres)
- `mode`: `'training'` | `'battle'`
- `result`: `'finished'` (Training) | `'victory'` | `'defeat'` | `'draw'` (Battle)
- `score`: Integer >= 0
- `linesCleared`: Integer >= 0
- `durationMs`: Integer >= 0
- `level`: Integer >= 1
- `opponentProfile`: String | null (`'bot-deterministic-v1'` en Battle, `null` en Training)
- `createdAt`: Timestamp with time zone (servidor)

### 3. Discriminated Union en TypeBox
- `TrainingMatch`: `mode: 'training'`, `result: 'finished'`, `opponentProfile: null`
- `BattleMatch`: `mode: 'battle'`, `result: 'victory' | 'defeat' | 'draw'`, `opponentProfile: string`

### 4. Idempotencia del POST `/api/matches`
- Cada partida local genera un `clientMatchId` (UUID v4) al iniciar la sesión de juego.
- La tabla PostgreSQL almacena `client_match_id` con restricción `UNIQUE`.
- Al recibir `POST /api/matches`:
  - Si `clientMatchId` no existe: se inserta la partida en la DB y responde `201 Created` con el recurso.
  - Si `clientMatchId` ya existe (POST duplicado): consulta el registro existente y responde `200 OK` con el recurso persistido sin lanzar error 500 ni duplicar filas.

### 5. Historial por Jugador (`GET /api/matches`)
- Parámetros obligatorios: `playerId` (UUID v4).
- Parámetros opcionales: `limit` (1..100, por defecto 20).
- Devuelve la lista de partidas del jugador indicando `created_at DESC, id DESC`.

### 6. Ranking Separado por Modo (`GET /api/ranking`)
- Parámetros obligatorios: `mode` (`'training'` | `'battle'`).
- Parámetros opcionales: `limit` (1..100, por defecto 20).
- Devuelve la mejor puntuación de cada jugador único en dicho modo.
- Ordenamiento y tie-break explícito: `score DESC, created_at ASC, id ASC`.

### 7. Identidad MVP
- UUID v4 guardado en `localStorage` (`rautfall_player_id`).
- Nombre/Alias visible (`rautfall_player_name`), fallback determinista derivado del UUID: `Jugador-XXXX` (últimos 4 caracteres del UUID en mayúsculas).
- Sin pantalla de edición ni flujo de autenticación en la Tarea 0030.

### 8. Configuración y CORS
- `CORS_ORIGIN`: Origen web permitido configurable por variable de entorno (por defecto `http://localhost:5173` en dev).
- `VITE_API_BASE_URL`: URL base de API en `apps/web` (por defecto `http://localhost:3000` o proxy `/api`).

### 9. Pruebas e Infraestructura de Tests
- Testcontainers con PostgreSQL real para validar migraciones y repositorios Drizzle sin SQLite ni SQL mocks.
- Test suite agrupada por contenedor por archivo para evitar penalizaciones de arranque.
- Fastify `inject()` para rutas HTTP.

## Criterios de Aceptación

1. Todos los comandos raíz (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`) finalizan sin errores ni avisos.
2. `packages/contracts` exporta schemas TypeBox limpios para matches, ranking y health.
3. `apps/api` compila, ejecuta migraciones Drizzle y expone endpoints HTTP en el puerto configurado.
4. `POST /api/matches` es idempotente por `clientMatchId` (inserta con 201 o retorna existente con 200).
5. `GET /api/matches` requiere `playerId` y filtra el historial del usuario.
6. `GET /api/ranking` requiere `mode` y retorna la clasificación única por jugador con tie-break determinista.
7. `apps/web` envía partidas de forma asíncrona non-blocking y muestra History y Ranking en la interfaz con estética Industrial Dramatic.
8. Los motores de juego (`packages/game-engine` y `packages/battle-engine`) permanecen intactos.
