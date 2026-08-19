# Informe de implementación — Tarea 0042

## Resumen

Se ha desarrollado e integrado la capa de ejecución autoritativa de gameplay PvP en servidor (`apps/api`), conectando el modelo de salas privadas efímeras (`RoomManager`, Tarea 0040) y el transporte WebSocket (`/ws/rooms`, Tarea 0041) con el motor de batalla determinista (`@rautfall/battle-engine`).

La arquitectura implementada garantiza que el servidor sea la única fuente de verdad sobre el estado de la partida, procesando entradas `player_input` en un bucle temporal monotónico de 100 Hz y difundiendo periódicamente (20 Hz, cada 50 ms) snapshots de estado personalizados a cada jugador.

## Archivos creados y modificados

### Creados
- `docs/tasks/0042-runtime-autoritativo-gameplay-pvp-servidor.md`: especificación inmutable de la tarea.
- `docs/implementation/0042-runtime-autoritativo-gameplay-pvp-servidor.md`: este informe de implementación.
- `apps/api/src/rooms/room-game-runtime.ts`: runtime de simulación autoritativa (100 Hz, acumulador monotónico, límite catch-up de 100 ms, buffer de inputs sostenidos `held`, cola FIFO de acciones `oneshot`, consumo de máximo 1 oneshot por paso de 10 ms y filtrado de eventos de interferencia).
- `apps/api/src/rooms/game-runtime-registry.ts`: registro desacoplado de runtimes activos (`GameRuntimeRegistry`).
- `apps/api/test/rooms/room-game-runtime.test.ts`: 7 pruebas unitarias para el runtime, el consumo de oneshots, la invariante `maxActionsInSingleStep <= 1` y el filtrado por perspectiva.
- `apps/api/test/routes/rooms-ws-gameplay.test.ts`: 2 pruebas de integración en tiempo real sobre WebSockets probando `room_ready`, `battle_started`, `player_input`, `game_state` y desconexiones.

### Modificados
- `packages/contracts/src/pvp-ws.ts`: DTOs TypeBox explícitos (`WsStepInputSchema`, `PlayerInputClientMessageSchema`, `BattleStartedServerMessageSchema`, `WsEngineSnapshotSchema`, `WsParticipantStateSchema`, `GameStateServerMessageSchema`, `BattleEndedServerMessageSchema`, `WsBattleEventSchema`) sin `Type.Any()`.
- `apps/api/src/rooms/index.ts`: exportación pública de `RoomGameRuntime`, `GameRuntimeRegistry`, `consumeNextStepInput` y `filterEventsForParticipant`.
- `apps/api/src/routes/rooms-ws.ts`: integración de `GameRuntimeRegistry`, emisión de `battle_started` al completar `join_room`, manejo de `player_input` y detención idempotente del runtime ante desconexión.
- `apps/api/src/app.ts`: instanciación e inyección de `GameRuntimeRegistry` en `buildApp`.
- `docs/project-status.md`: actualización del estado del proyecto con la Tarea 0042 completada.

## Decisiones relevantes

1. **Servidor Autoritativo Puro**: El servidor `apps/api` crea y ejecuta de forma aislada la instancia de `BattleSession`. Los clientes no ejecutan motores autoritativos en local.
2. **DTOs de Red Explícitos en TypeBox**: Se eliminaron completamente todos los usos de `Type.Any()`. Todos los eventos y estructuras de snapshot expuestos por WebSocket cuentan con validación y tipado estricto en `@rautfall/contracts`.
3. **Consumo de Oneshots (Invariante Local = Online)**: `RoomGameRuntime` aplica la función `consumeNextStepInput`, la cual mantiene el estado `held` persistente y desencola **como máximo 1 acción discreta por jugador por paso de 10 ms**. Esto mantiene la invariante `maxActionsInSingleStep <= 1` coherente con el gameplay local (`input-buffer`).
4. **Acumulador Monotónico y Límite de Catch-Up**: El runtime realiza el tick lógico a 100 Hz (`fixedStepMs = 10`) acumulando `performance.now()`. Se impone un límite de catch-up de 100 ms por iteración para evitar la *spiral of death* en situaciones de congelación del event loop.
5. **Broadcast de Snapshots a 20 Hz**: Se emiten snapshots a 50 ms de intervalo. Los clientes renderizan el último snapshot recibido sin prediction, rollback ni interpolación en la v1.
6. **Filtrado Autoritativo por Interferencia**: Si un participante está interferido (`isInterfered === true`), la función `filterEventsForParticipant` excluye los eventos internos de movimiento y spawn del rival de la lista de `events` transmitidos por red.

## API pública producida

Exportaciones en `@rautfall/contracts`:
- `WsStepInputSchema` y `WsStepInput`
- `PlayerInputClientMessageSchema` y `PlayerInputClientMessage`
- `BattleStartedServerMessageSchema` y `BattleStartedServerMessage`
- `GameStateServerMessageSchema` y `GameStateServerMessage`
- `BattleEndedServerMessageSchema` y `BattleEndedServerMessage`
- `WsEngineSnapshotSchema`, `WsParticipantStateSchema`, `WsBattleEventSchema`

Exportaciones en `apps/api` (`src/rooms`):
- `RoomGameRuntime`, `consumeNextStepInput`, `filterEventsForParticipant`
- `createGameRuntimeRegistry`, `GameRuntimeRegistry`

## Pruebas añadidas

- 7 pruebas unitarias en `apps/api/test/rooms/room-game-runtime.test.ts`.
- 2 pruebas de integración en `apps/api/test/routes/rooms-ws-gameplay.test.ts`.
- Total de pruebas en el monorepo: 1025 pasadas en verde.

## Comandos ejecutados y resultados

- `pnpm --filter @rautfall/contracts build`: Exitoso.
- `pnpm test`: Exitoso (1025 tests pasados).
- `pnpm lint`: Exitoso (0 errores, 0 avisos).
- `pnpm typecheck`: Exitoso (0 errores).
- `pnpm build`: Exitoso.
- `git diff --check`: Exitoso (0 errores de formato/trailing whitespace).

## Desviaciones

Ninguna. La implementación respeta al 100% el diseño aprobado.

## Trabajo pendiente

- Tarea 0043 (en el futuro): Integración del cliente web (`apps/web` / `GameScene`) con los mensajes de WebSocket para renderizar la partida online y enviar `player_input`.

## Confirmación del alcance excluido

No se han modificado archivos en `apps/web`, no se alteraron los motores de dominio (`game-engine` y `battle-engine`), no se implementaron sistemas de prediction/rollback, ni UI de salas, ni despliegues ni persistencia externa.
