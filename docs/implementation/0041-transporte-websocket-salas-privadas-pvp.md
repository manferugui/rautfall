# Informe de implementación: Tarea 0041 — Transporte WebSocket para salas privadas PvP

## Resumen

Se ha implementado la capa de transporte WebSocket en `apps/api` para conectar clientes a las salas privadas PvP gestionadas en memoria por `RoomManager` (Tarea 0040). La solución utiliza `@fastify/websocket` integrado sobre Fastify 5 en el endpoint `/ws/rooms`, validación estricta de mensajes en runtime mediante esquemas TypeBox centralizados en `@rautfall/contracts`, gestión interna de identidades efímeras por conexión socket, estado explícito de roles (`playerOne` / `playerTwo`), mensajes de estado simplificados (`room_created`, `room_joined`, `room_ready`) y un mecanismo idempotente de limpieza y notificación de desconexiones (`player_disconnected`).

---

## Archivos creados y modificados

- **`packages/contracts/src/pvp-ws.ts`** `[NUEVO]`: Contratos TypeBox e interfaces TypeScript estáticas para los mensajes WebSocket Cliente → Servidor y Servidor → Cliente.
- **`packages/contracts/src/index.ts`** `[MODIFICADO]`: Re-exportación pública de `pvp-ws.js`.
- **`apps/api/package.json`** `[MODIFICADO]`: Adición de `@fastify/websocket` a `dependencies` y `ws` / `@types/ws` a `devDependencies`.
- **`apps/api/src/routes/rooms-ws.ts`** `[NUEVO]`: Manejador de la ruta WebSocket `/ws/rooms` con parsing JSON, validaciones de esquema, mapas de sockets y callbacks de ciclo de vida.
- **`apps/api/src/app.ts`** `[MODIFICADO]`: Registro del plugin `@fastify/websocket`, soporte opcional de `roomManager` en `AppOptions` y encapsulación del registro de `rooms-ws` en el ámbito de Fastify.
- **`apps/api/test/routes/rooms-ws.test.ts`** `[NUEVO]`: 12 pruebas de integración de WebSocket reales sobre servidor Fastify con puerto efímero.
- **`docs/tasks/0041-transporte-websocket-salas-privadas-pvp.md`** `[NUEVO]`: Especificación inmutable de la tarea.
- **`docs/implementation/0041-transporte-websocket-salas-privadas-pvp.md`** `[NUEVO]`: Este informe de implementación.
- **`docs/project-status.md`** `[MODIFICADO]`: Actualización del estado del proyecto incorporando la Tarea 0041.

---

## Decisiones relevantes

1. **Contratos compartidos de WebSocket en `@rautfall/contracts`**:
   - Se definieron los mensajes mediante `@sinclair/typebox` (`ClientWsMessageSchema`, `ServerWsMessageSchema`).
   - La validación en runtime se realiza mediante `Value.Check(ClientWsMessageSchema, data)`, respondiendo un error estructurado `{ type: 'error', code: 'BAD_REQUEST', message: '...' }` si el formato o las propiedades no cumplen el esquema.

2. **Asociación de Identidad Efímera (Conexión → Identidad → Sala → Rol)**:
   - Al establecer la conexión WebSocket en `/ws/rooms`, el servidor asigna a la sesión un `playerId` efímero e inmutable (`crypto.randomUUID()`).
   - No se exige ni permite `playerId` en los mensajes cliente → servidor (`{ type: 'create_room' }` y `{ type: 'join_room', code }`).
   - `RoomManager.createRoom(playerId)` o `RoomManager.joinRoom(code, playerId)` reciben el ID generado por el servidor, asegurando que un cliente no pueda suplantar la identidad de otro participante.
   - Una conexión solo puede estar asociada a una sala activa a la vez. Intentar crear o unirse a una segunda sala devuelve el código explícito `{ type: 'error', code: 'ALREADY_IN_ROOM', message: '...' }`.

3. **Simplificación de la notificación `room_ready`**:
   - Para proteger datos internos de la sala y mantener el contrato ligero, `room_ready` solo transmite `{ type: 'room_ready', code }`. Cada participante conoce su rol individual previa y explícitamente mediante `room_created` (`playerOne`) o `room_joined` (`playerTwo`).

4. **Limpieza Idempotente, Desconexión y Liberación de Sockets**:
   - En el evento `close` o `error` del socket, la función `cleanupSession()` desasocia el código de la propia sesión, destruye la sala en `RoomManager.closeRoom(code)`, notifica al oponente (si sigue conectado) mediante `{ type: 'player_disconnected', reason: 'opponent_left' }` y remueve la sala del mapa de sesiones.
   - **Liberación del socket superviviente**: Al recibir `player_disconnected`, la sesión del oponente que permanece conectado queda automáticamente liberada de su asociación de sala (`roomCode = undefined`), permitiéndole inmediatamente emitir un nuevo `create_room` o `join_room` sobre la misma conexión WebSocket sin ser bloqueado por `ALREADY_IN_ROOM`.
   - El resguardo es idempotente para prevenir excepciones secundarias si se emiten eventos de error y cierre consecutivos sobre el mismo socket.

5. **Alineación con el contrato real de la Tarea 0040**:
   - Se conservó intacta la estrategia de códigos de 5 caracteres con el alfabeto inequívoco (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) administrada por `room-code.ts` y `RoomManager`. La capa de WebSocket no altera la longitud ni la estrategia de generación.

---

## API Pública / Contratos producidos

### Mensajes Cliente → Servidor
- `create_room`: `{ type: 'create_room' }`
- `join_room`: `{ type: 'join_room', code: string }`

### Mensajes Servidor → Cliente
- `room_created`: `{ type: 'room_created', code: string, role: 'playerOne' }`
- `room_joined`: `{ type: 'room_joined', code: string, role: 'playerTwo' }`
- `room_ready`: `{ type: 'room_ready', code: string }`
- `player_disconnected`: `{ type: 'player_disconnected', reason: 'opponent_left' }`
- `error`: `{ type: 'error', code: string, message: string }`

---

## Pruebas añadidas

12 pruebas de integración reales en `apps/api/test/routes/rooms-ws.test.ts`:
1. `permite abrir una conexión WebSocket correctamente`: Apretón de manos HTTP Upgrade y conexión abierta.
2. `permite a P1 crear una sala y recibe código de 5 caracteres`: P1 emite `create_room`, recibe `room_created` con rol `playerOne` y código de 5 caracteres.
3. `permite a P2 unirse con el código y notifica ready a ambos`: P2 envía `join_room`, recibe `room_joined` (`playerTwo`), y ambos reciben `room_ready`.
4. `devuelve error ROOM_NOT_FOUND al intentar unirse a un código inexistente`: Manejo de código inválido.
5. `devuelve error ROOM_NOT_WAITING al intentar unirse a una sala que ya está ready`: Impide el ingreso de un tercer jugador P3.
6. `devuelve error ALREADY_IN_ROOM si la conexión intenta crear o unirse a otra sala`: Garantiza una sola sala por conexión.
7. `devuelve error INVALID_JSON ante un payload no parseable`: Manejo de sintaxis JSON inválida.
8. `devuelve error BAD_REQUEST ante un mensaje que no cumple el contrato`: Validación de esquemas TypeBox.
9. `mantiene aislamiento completo entre dos salas distintas`: Evita la fuga de mensajes o eventos entre salas independientes.
10. `notifica player_disconnected al oponente y destruye la sala al cerrarse la conexión`: Verifica la desconexión de P1, aviso a P2 y limpieza en `RoomManager`.
11. `libera la conexión del oponente (P2) permitiéndole crear una nueva sala tras la desconexión de P1`: Comprueba la liberación del socket superviviente de P2.
12. `libera la conexión del oponente (P1) permitiéndole crear una nueva sala tras la desconexión de P2`: Comprueba simétricamente la liberación del socket superviviente de P1.

---

## Restricciones y Despliegue

- **Incompatibilidad documentada con Vercel Serverless**:
  Las Serverless Functions de Vercel (AWS Lambda) no soportan conexiones TCP/WebSocket persistentes ni el encabezado HTTP `101 Switching Protocols`, además de no compartir el mapa in-memory de salas entre invocaciones. La ejecución y validación de esta tarea se realiza contra un proceso Fastify Node.js persistente local (`fastify.listen`).
- **Confirmación explícita de alcance excluido**:
  - NO se modificó ninguna configuración de despliegue en Vercel, Neon, Docker ni CI/CD (`.github/workflows`).
  - NO se implementaron inputs de juego (`StepInput`), snapshots de batalla, sincronización, matchmaking ni UI.
