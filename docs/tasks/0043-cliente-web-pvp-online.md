# Tarea 0043 — Cliente web PvP online

## Objetivo

Implementar el flujo completo de juego multijugador online PvP en `apps/web`, conectando la interfaz de usuario y la escena de Phaser con el transporte WebSocket (`/ws/rooms`) y el runtime autoritativo en servidor desarrollados en las Tareas 0040, 0041 y 0042.

Al finalizar esta tarea:

1. El usuario puede seleccionar el modo "CONTRA JUGADOR" desde el Menú Principal.
2. Un jugador puede **Crear partida**, recibir un código único de sala de 5 caracteres ("AB12C") y aguardar al rival en estado visual "ESPERANDO AL RIVAL".
3. Otro jugador puede **Unirse a partida** desde otro navegador/dispositivo introduciendo dicho código de 5 caracteres (normalizado a mayúsculas).
4. Al estar ambos conectados, la recepción del mensaje autoritativo `battle_started` inicia automáticamente la partida online para ambos jugadores.
5. El cliente web interactúa con el servidor mediante una arquitectura desacoplada en dos capas (`OnlinePvPClient` para red pura y `OnlineGameSession` para sesión de dominio y entrada event-driven).
6. El cliente transmite entradas de control `player_input` de forma **100% event-driven** basada en eventos físicos de teclado (`keydown`, `keyup`, `blur`), emitiendo snapshots completos de `WsStepInput` sin realizar polling en `update()` a 60 FPS.
7. `GameScene` en modo online actúa exclusivamente como motor de presentación/renderizado y capturador de entrada física, sin instanciar `GameEngine`, `BattleSession` ni `DeterministicBot` locales.
8. Los efectos sonoros, FX visuales e información del oponente (`OpponentMonitor`) se alimentan directamente de los snapshots y eventos autoritativos remotos difundidos a 20 Hz (cada 50 ms).
9. El fin de partida (`battle_ended`) o la desconexión del oponente (`player_disconnected`) finalizan limpiamente la partida, mostrando el resultado o aviso de desconexión sin persistir la partida en la API de ranking local ni alterar el flujo 1P/Bot.

## Requisitos

### 1. Helper de URL WebSocket (`apps/web/src/api/client.ts`)
- Implementar `getWsApiUrl()` para construir la URL de conexión al WebSocket de salas.
- Prioridad: `VITE_WS_BASE_URL` explícita $\to$ derivación de `VITE_API_BASE_URL` (`http` $\to$ `ws`, `https` $\to$ `wss`) $\to$ fallback `window.location.host`.
- Sin barras duplicadas en `/ws/rooms`.

### 2. Capa de Red Pura (`OnlinePvPClient`)
- Gestión del ciclo de vida de la conexión `WebSocket`.
- Serialización y deserialización JSON de mensajes contractuales (`@rautfall/contracts`).
- Emisión de callbacks tipados (`room_created`, `room_joined`, `room_ready`, `battle_started`, `game_state`, `battle_ended`, `player_disconnected`, `error`).
- `disconnect()` e indemnidad al destruir la conexión. Sin reconexión automática.

### 3. Capa de Sesión y Presentación (`OnlineGameSession`)
- Gestión de estado de la partida online (`roomCode`, `role`, estado `'waiting' | 'ready' | 'playing' | 'ended'`).
- `App.vue` es el propietario único (`owner`) de la sesión online activa.
- Mantiene el estado continuo `heldState` (`leftHeld`, `rightHeld`, `softDropHeld`).
- Transforma transiciones físicas reales de teclado en snapshots `WsStepInput` completos emitidos mediante `client.sendInput(...)`.
- Manejo de `keydown` (transición held + oneshots), `keyup` (liberación held) y `blur` (limpieza completa a neutro).
- Métodos de destrucción idempotentes para evitar listeners u objetos huérfanos.

### 4. Flujo e Interfaz de Usuario (`ModeSelector.vue` / `OnlineRoomModal.vue`)
- Opción "CONTRA JUGADOR" en el Menú Principal.
- Subpantalla/modal para "CREAR PARTIDA" (muestra código de 5 caracteres + "ESPERANDO AL RIVAL") y "UNIRSE A PARTIDA" (input de 5 caracteres, mayúsculas, botón UNIRSE).
- Manejo visual de errores de red (`ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, etc.).
- Transición automática a partida al recibir `battle_started`.

### 5. Integración con `GameScene` y Phaser (`apps/web/src/game/scenes/GameScene.ts`)
- Modo de juego `'online'` añadido a `GameMode`.
- **Prohibido**: Instanciar `GameEngine`, `BattleSession` o `DeterministicBot` locales; ejecutar `step()` o simular gravedad localmente.
- Escucha eventos físicos de teclado durante gameplay y delega la emisión en `OnlineGameSession`.
- `GameScene.update()` en modo online se limita a `renderFrame()` y notificaciones a Vue.
- Tecla `ESC` en modo online no pausa, no envía protocolo ni muestra `PauseShutter`.
- Renderizado de `self` y `opponent` derivado del DTO autoritativo remitido por el servidor.
- FX y audio desencadenados a partir de los `WsBattleEvent` recibidos.

### 6. Resultados y Desconexión
- Reutilización de `ResultsModal.vue` para mostrar el resultado final sin enviar la partida a `/api/matches`, sin pedir `OperatorTag` y sin guardar en ranking.
- Desconexión del rival (`player_disconnected`) detiene el envío de entradas y muestra pantalla de aviso con botón para regresar al menú principal.

## Fuera de Alcance

- Modificaciones en `apps/api` o paquetes de motor.
- Predicción local, rollback o interpolación suave de movimiento.
- Autenticación, cuentas de usuario, matchmaking o lobby público.
- Chat o mensajes rápidos durante la partida.
- Persistencia de partidas online en la base de datos o ranking local.
- Pruebas E2E multi-navegador en Playwright (reservadas para tareas posteriores).
