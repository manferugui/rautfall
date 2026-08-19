# Informe de Implementación — Tarea 0043: Cliente web PvP online

## Resumen

Se ha completado la integración del cliente web PvP online en `apps/web`, permitiendo la experiencia multijugador 2P autoritativa mediante WebSocket frente al servidor de la Tarea 0042.

El flujo funcional implementado comprende:
1. Selección de "CONTRA JUGADOR" en el menú principal (`ModeSelector.vue`).
2. Creación de sala con generación de código de 5 caracteres o unirse mediante código de 5 caracteres con modal industrial dramático (`OnlineRoomModal.vue`).
3. Notificación de `battle_started` y transición a la vista de batalla (`App.vue` + `GameScene.ts`).
4. Entrada puramente impulsada por eventos físicos de teclado (`keydown`, `keyup`, `blur`), sin polling en el bucle `update()`.
5. Renderizado autoritativo basado en `WsGameStateMessage` y `WsEngineSnapshot` recibidos a 20 Hz desde el servidor.
6. Presentación del estado del oponente en `OpponentMonitor.vue`.
7. Finalización de partida (`battle_ended` / `player_disconnected`) y visualización de resultados mediante `ResultsModal.vue` reutilizado sin persistencia HTTP (`/api/matches`) ni firma de operador local.

## Archivos Creados y Modificados

### Archivos Creados
- `docs/tasks/0043-cliente-web-pvp-online.md`: Especificación técnica formal e inmutable de la Tarea 0043.
- `apps/web/src/api/pvp-ws-client.ts`: Capa de red pura `OnlinePvPClient` para la gestión de WebSocket, mensajería JSON tipada y suscripciones a eventos.
- `apps/web/src/api/pvp-ws-client.test.ts`: Pruebas unitarias de `OnlinePvPClient`.
- `apps/web/src/api/online-game-session.ts`: Capa de sesión/presentación `OnlineGameSession` para el ciclo de vida de salas y traducción de entrada event-driven.
- `apps/web/src/api/online-game-session.test.ts`: Pruebas unitarias de `OnlineGameSession`.
- `apps/web/src/components/OnlineRoomModal.vue`: Componente modal UI industrial para crear/unirse a salas PvP.
- `apps/web/src/components/OnlineRoomModal.test.ts`: Pruebas unitarias del componente `OnlineRoomModal.vue`.
- `docs/implementation/0043-cliente-web-pvp-online.md`: El presente informe de implementación.

### Archivos Modificados
- `apps/web/src/api/client.ts`: Añadida la función auxiliar `getWsApiUrl()` para resolución dinámica de URL WebSocket.
- `apps/web/src/api/client.test.ts`: Pruebas unitarias para `getWsApiUrl()`.
- `apps/web/src/game/types.ts`: Extendido `GameMode` con `'online'`.
- `apps/web/src/game/create-phaser-game.ts`: Propagación de `onlineSession` a la escena Phaser `GameScene`.
- `apps/web/src/components/GameCanvas.vue`: Soporte para prop `onlineSession`.
- `apps/web/src/game/scenes/GameScene.ts`: Adaptación para omitir el motor/bot local en modo `'online'`, capturar eventos de teclado directos sin polling y renderizar desde `latestGameState`.
- `apps/web/src/game/scenes/GameScene.test.ts`: Pruebas unitarias para la integración del modo online en `GameScene`.
- `apps/web/src/components/ModeSelector.vue` y `ModeSelector.test.ts`: Añadido botón "CONTRA JUGADOR" y su emisión `openOnlinePvP`.
- `apps/web/src/components/ResultsModal.vue`: Ocultación de firma de operador y envío HTTP POST cuando el modo de juego es `'online'`.
- `apps/web/src/App.vue`: Gestión del ciclo de vida de `OnlineGameSession`, montaje de `OnlineRoomModal` y navegación a resultados.
- `docs/project-status.md`: Actualización del estado global del proyecto.

## Decisiones Relevantes

1. **Protocolo Event-Driven Estricto de Entrada**:
   - `OnlineGameSession` mantiene el estado físico `heldState` (`leftHeld`, `rightHeld`, `softDropHeld`).
   - `handleKeyDown` activa el estado `held` correspondiente (o emite un flag oneshot para la tecla pulsada) y transmite inmediatamente una foto completa `WsStepInput`.
   - `handleKeyUp` desactiva el estado `held` y transmite la foto actualizada.
   - `handleBlur` reinicia todo el estado sostenido y envía una foto neutra para prevenir bloqueos de dirección.
   - `GameScene.ts` no realiza ningún polling ni envío periódico desde `update()`.

2. **Cero Lógica Local de Gameplay en Modo Online**:
   - En modo `'online'`, `GameScene.ts` no instancia `GameEngine`, `BattleSession` ni `DeterministicBot`.
   - No se incrementa el acumulador de tiempo ni se invoca `step()`.
   - El renderizado y el estado de presentación enviado a Vue se derivan en tiempo real a partir del `latestGameState` del servidor.

3. **Gestión Desacoplada de Red y Presentación**:
   - `OnlinePvPClient` maneja exclusivamente la conexión WebSocket y la codificación/decodificación JSON basada en `@rautfall/contracts`.
   - `OnlineGameSession` administra el ciclo de vida de las salas (`connecting` → `waiting` → `playing` → `ended`) y la traducción de teclas.

## API Pública Producida

- `getWsApiUrl(): string` (`apps/web/src/api/client.ts`)
- `OnlinePvPClient` (`apps/web/src/api/pvp-ws-client.ts`)
- `OnlineGameSession` (`apps/web/src/api/online-game-session.ts`)
- `OnlineRoomModal.vue` (`apps/web/src/components/OnlineRoomModal.vue`)

## Pruebas Añadidas

- `apps/web/src/api/client.test.ts`: Cobertura de resolución de `getWsApiUrl()`.
- `apps/web/src/api/pvp-ws-client.test.ts`: Conexión, envío de mensajes y despacho de suscripciones tipadas.
- `apps/web/src/api/online-game-session.test.ts`: Transiciones de estado de sesión, traducción de entradas acumuladas `held` y limpieza idempotente.
- `apps/web/src/components/OnlineRoomModal.test.ts`: Renderizado, selector de pestañas (crear/unirse), validación de 5 caracteres, visualización de errores y eventos emitidos.
- `apps/web/src/components/ModeSelector.test.ts`: Notificación del evento `openOnlinePvP`.
- `apps/web/src/game/scenes/GameScene.test.ts`: Delegación directa de eventos de entrada y omisión del motor local en modo `'online'`.

## Comandos Ejecutados y Resultados

Se ejecutaron desde la raíz del monorepo las cuatro validaciones obligatorias:

- `pnpm test`: Exitoso. Todas las pruebas del monorepo pasaron correctamente.
- `pnpm lint`: Exitoso. Sin errores ni advertencias.
- `pnpm typecheck`: Exitoso. TypeScript validó correctamente todos los paquetes y aplicaciones.
- `pnpm build`: Exitoso. Compilación completa de paquetes y aplicaciones.

## Desviaciones y Alcance Excluido

- No se incluyeron pruebas E2E con múltiples navegadores Playwright (diferidas a una tarea futura según diseño aprobado).
- No se implementó reconexión automática en caso de caída de WebSocket.
- No se realizaron cambios en la API o servidor autoritativo de la Tarea 0042.
