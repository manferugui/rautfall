# Tarea 0041 — Transporte WebSocket para salas privadas PvP

## Objetivo

Conectar el modelo in-memory de salas creado en la Tarea 0040 a clientes reales mediante WebSocket desde `apps/api`.

Al finalizar esta tarea debe ser posible conceptualmente que:

1. Cliente A abre una conexión WebSocket.
2. Solicita crear una sala.
3. El servidor crea la sala mediante el `RoomManager` existente.
4. El servidor devuelve el código.
5. Cliente B abre otra conexión WebSocket.
6. Envía ese código para unirse.
7. El servidor utiliza `RoomManager.joinRoom()`.
8. Ambos clientes reciben confirmación de que la sala está `ready`.

Todavía NO se transmitirán inputs de juego ni snapshots de `BattleSession`.

## Requisitos

### Transporte

- Uso de `@fastify/websocket` integrado sobre Fastify 5.
- Sin servidores Node paralelos ni dependencias externas (Socket.IO, Redis, SSE, polling).

### Protocolo

- Protocolo mínimo, tipado mediante TypeBox en `@rautfall/contracts`.
- Cliente → Servidor: `{ type: 'create_room' }`, `{ type: 'join_room', code: string }`.
- Servidor → Cliente: `room_created`, `room_joined`, `room_ready`, `player_disconnected`, `error`.

### Identidad y Asociación

- Identidad efímera generada internamente por conexión WebSocket (`crypto.randomUUID()`).
- Sin autenticación ni cuentas de usuario.
- Regla de una sola sala por conexión WebSocket (`ALREADY_IN_ROOM`).

### Desconexión y Limpieza

- Al cerrarse la conexión, la sala asociada se elimina de `RoomManager`.
- Si el oponente sigue conectado, recibe `player_disconnected`.
- Limpieza idempotente.

## Fuera de alcance

- Gameplay por red, StepInput, snapshots de batalla, sincronización temporal, latencia, UI web, matchmaking, persistencia, Redis, múltiples instancias, cambios de despliegue Vercel/Neon.
