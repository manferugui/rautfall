# Tarea 0042 — Runtime autoritativo de gameplay PvP en servidor

## Objetivo

Implementar la capa de ejecución autoritativa de gameplay PvP en tiempo real en servidor (`apps/api`), conectando las sesiones de batalla (`BattleSession`) creadas en la Tarea 0040 con la infraestructura de transporte WebSocket de la Tarea 0041.

Al finalizar esta tarea:

1. Al estar ambos jugadores en una sala (`room_ready`), el servidor emite `battle_started` a cada socket con su rol asignado.
2. El servidor inicia un bucle monotónico de simulación autoritativa a 100 Hz (paso fijo `fixedStepMs = 10`).
3. Los clientes envían entradas de mando `player_input` mediante un modelo event-driven (cambio de estado sostenido `held` o disparo de acciones puntuales `oneshot`).
4. El servidor procesa de forma autoritativa la gravedad, colisiones, DAS/ARR, sabotajes y condiciones de victoria/derrota.
5. El servidor difunde periódicamente (20 Hz, cada 50 ms) mensajes `game_state` personalizados a P1 y P2.
6. El servidor filtra de forma autoritativa los eventos del rival durante el efecto del sabotaje `interferencia`.
7. La desconexión de cualquiera de los jugadores detiene el runtime, destruye la sala y notifica al superviviente.

## Requisitos

### 1. Esquemas TypeBox y Contratos (`packages/contracts/src/pvp-ws.ts`)

- Definición completa de esquemas explícitos para el transporte de red, sin uso de `Type.Any()`.
- Contrato cliente $\to$ servidor:
  - `PlayerInputClientMessageSchema`: (`type: 'player_input'`, `input: WsStepInput`).
- Contrato servidor $\to$ cliente:
  - `BattleStartedServerMessageSchema`: (`type: 'battle_started'`, `role: 'playerOne' | 'playerTwo'`).
  - `GameStateServerMessageSchema`: (`type: 'game_state'`, `step`, `elapsedMs`, `status`, `winner`, `suddenDeath`, `self`, `opponent`, `selfState`, `opponentState`, `events`).
  - `BattleEndedServerMessageSchema`: (`type: 'battle_ended'`, `winner`, `finalSnapshot`).

### 2. Runtime de Gameplay Autoritativo (`RoomGameRuntime`)

- Responsable de la ejecución de una partida activa.
- Bucle temporal monotónico con `performance.now()` y acumulador de delta de tiempo (`fixedStepMs = 10`).
- Límite estricto de catch-up por iteración: máximo 100 ms (10 pasos lógicos) para evitar la *spiral of death*.
- Buffer de entrada por jugador:
  - `heldState`: conserva `leftHeld`, `rightHeld`, `softDropHeld` del último paquete recibido.
  - `pendingQueue`: cola FIFO de acciones discretas (`oneshot`).
  - Invariante estricto: **máximo 1 acción discreta consumida por jugador por paso de 10 ms**.
  - Multiplicidad garantizada: acciones puntuales consecutivas (ej. dos rotaciones o rotación + hard drop) se consumen en steps lógicos consecutivos.
- Emisión de snapshots a 20 Hz (cada 50 ms).
- Drenaje y acumulación de `BattleEvent`.

### 3. Registro de Runtimes (`GameRuntimeRegistry`)

- Abstracción independiente en la capa de aplicación (`apps/api/src/rooms/game-runtime-registry.ts`).
- Desacoplado de `PvPRoom` (el modelo de sala permanece pasivo e inmutable).
- Métodos `get`, `create`, `stopAndRemove`.

### 4. Filtrado por Perspectiva (Interferencia)

- Si un jugador está interferido (`isInterfered === true`), `opponent` contiene el snapshot congelado de `battleSession.getPerceivedOpponentSnapshot(role)`.
- El servidor filtra de la cola de eventos enviada a ese jugador los `participantEvent` internos del rival (`pieceMoved`, `pieceSpawned`, `pieceRotated`).

### 5. Integración WebSocket (`apps/api/src/routes/rooms-ws.ts`)

- Al quedar la sala `ready`:
  - Instancia `RoomGameRuntime` en `GameRuntimeRegistry`.
  - Envía `battle_started` con rol específico a cada jugador.
  - Inicia el runtime (`start()`).
- Al recibir `player_input`: valida y delega en `runtime.enqueueInput(...)`.
- Al desconectarse o cerrar sala: invoca `runtimeRegistry.stopAndRemove(code)` e informa al oponente.

## Fuera de Alcance

- Modificaciones en `apps/web`.
- Modificaciones en `packages/game-engine` o `packages/battle-engine`.
- Prediction, rollback o interpolación de posiciones en cliente.
- UI web, matchmaking, persistencia de partidas PvP, Redis, múltiples instancias.
