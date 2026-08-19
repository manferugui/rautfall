# Tarea 0040 — Modelo base de salas privadas PvP

## Objetivo

Crear en `apps/api` la capa de aplicación necesaria para representar y gestionar salas PvP privadas y efímeras de exactamente 2 jugadores.

Esta tarea NO debe implementar todavía WebSockets, UI, matchmaking ni persistencia de salas.

El objetivo es disponer de un núcleo pequeño, probado y reutilizable que posteriormente pueda ser conectado a un transporte WebSocket.

## Flujo funcional futuro que debe soportar el diseño

1. Player 1 crea una sala.
2. El servidor genera un código corto.
3. Player 1 comparte ese código externamente.
4. Player 2 introduce el código.
5. Player 2 entra en la sala.
6. Cuando están los dos jugadores, la sala queda preparada para iniciar una batalla.

No existe matchmaking.

## Requisitos

### Sala

Una sala debe tener como mínimo:

- código único;
- Player 1;
- Player 2 opcional hasta que se una;
- estado explícito de sala (`'waiting_for_player' | 'ready'`);
- asociación con una `BattleSession` cuando corresponda.

### Código

El código debe:

- ser corto y fácil de compartir manualmente (5 caracteres);
- generarse en servidor;
- usar un alfabeto inequívoco (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`);
- tener estrategia explícita frente a colisiones;
- no depender de base de datos.

### Gestión en memoria

Las salas deben vivir exclusivamente en memoria del proceso de `apps/api`.

Map<RoomCode, PvPRoom>

Debe ser posible como mínimo:

- crear una sala;
- consultar una sala por código;
- unir Player 2;
- impedir un tercer jugador;
- impedir unirse a una sala inexistente;
- impedir operaciones incompatibles con el estado actual;
- eliminar/cerrar una sala.

### BattleSession

Reutiliza `@rautfall/battle-engine`.

NO dupliques reglas de batalla en `apps/api`.

NO introduzcas conceptos de red en `game-engine` ni `battle-engine`.

Instanciar `BattleSession` cuando estén presentes ambos jugadores.

### Identidad

No diseñes cuentas de usuario. Reutiliza únicamente conceptos de identidad existentes si son suficientes para distinguir a los dos participantes dentro de una sala.

## Fuera de alcance

- WebSockets, Socket.IO, Redis, matchmaking, lobby público, chat, mensajes rápidos, persistencia PostgreSQL de salas, reconexión, espectadores, múltiples instancias coordinadas, cambios de despliegue, Vercel/Neon, UI, cambios en `game-engine` o `battle-engine`.
