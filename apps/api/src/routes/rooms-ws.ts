import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { Value } from '@sinclair/typebox/value';
import { ClientWsMessageSchema, type ServerWsMessage } from '@rautfall/contracts';
import { RoomError, type RoomManager, type GameRuntimeRegistry } from '../rooms/index.js';

interface SessionState {
  socket: WebSocket;
  playerId: string;
  roomCode?: string | undefined;
  role?: 'playerOne' | 'playerTwo' | undefined;
}

interface RoomSessions {
  playerOneSession?: SessionState | undefined;
  playerTwoSession?: SessionState | undefined;
}

/**
 * Registra la ruta WebSocket para salas privadas PvP (/ws/rooms).
 */
export function registerRoomsWsRoutes(
  fastify: FastifyInstance,
  roomManager: RoomManager,
  runtimeRegistry: GameRuntimeRegistry,
): void {
  const roomSessionsMap = new Map<string, RoomSessions>();

  function sendWsMessage(socket: WebSocket, msg: ServerWsMessage): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  }

  fastify.get('/ws/rooms', { websocket: true }, (socket: WebSocket) => {
    const session: SessionState = {
      socket,
      playerId: randomUUID(),
    };

    function cleanupSession(): void {
      const code = session.roomCode;
      if (!code) return;

      const role = session.role;

      // Detener y eliminar el runtime de juego si existía
      runtimeRegistry.stopAndRemove(code);

      // Limpieza idempotente de la propia sesión
      session.roomCode = undefined;
      session.role = undefined;

      const roomSessions = roomSessionsMap.get(code);
      if (roomSessions) {
        roomSessionsMap.delete(code);
      }

      try {
        roomManager.closeRoom(code);
      } catch {
        // Ignorar error si la sala ya había sido eliminada
      }

      const opponentSession =
        role === 'playerOne' ? roomSessions?.playerTwoSession : roomSessions?.playerOneSession;

      if (opponentSession) {
        // Liberar la sesión del oponente superviviente para permitirle crear/unirse a una nueva sala
        opponentSession.roomCode = undefined;
        opponentSession.role = undefined;

        sendWsMessage(opponentSession.socket, {
          type: 'player_disconnected',
          reason: 'opponent_left',
        });
      }
    }

    socket.on('message', (rawMessage: unknown) => {
      let data: unknown;
      try {
        const messageString =
          typeof rawMessage === 'string'
            ? rawMessage
            : rawMessage instanceof Buffer
              ? rawMessage.toString('utf-8')
              : String(rawMessage);
        data = JSON.parse(messageString);
      } catch {
        sendWsMessage(socket, {
          type: 'error',
          code: 'INVALID_JSON',
          message: 'Failed to parse WebSocket message as valid JSON.',
        });
        return;
      }

      if (!Value.Check(ClientWsMessageSchema, data)) {
        sendWsMessage(socket, {
          type: 'error',
          code: 'BAD_REQUEST',
          message: 'WebSocket message payload does not match contract schema.',
        });
        return;
      }

      const msg = data;

      if (msg.type === 'create_room') {
        if (session.roomCode) {
          sendWsMessage(socket, {
            type: 'error',
            code: 'ALREADY_IN_ROOM',
            message: 'Connection is already associated with a room.',
          });
          return;
        }

        try {
          const room = roomManager.createRoom(session.playerId);
          session.roomCode = room.code;
          session.role = 'playerOne';
          roomSessionsMap.set(room.code, { playerOneSession: session });

          sendWsMessage(socket, {
            type: 'room_created',
            code: room.code,
            role: 'playerOne',
          });
        } catch (err) {
          if (err instanceof RoomError) {
            sendWsMessage(socket, {
              type: 'error',
              code: err.code,
              message: err.message,
            });
          } else {
            sendWsMessage(socket, {
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Failed to create room.',
            });
          }
        }
        return;
      }

      if (msg.type === 'join_room') {
        if (session.roomCode) {
          sendWsMessage(socket, {
            type: 'error',
            code: 'ALREADY_IN_ROOM',
            message: 'Connection is already associated with a room.',
          });
          return;
        }

        try {
          const room = roomManager.joinRoom(msg.code, session.playerId);
          session.roomCode = room.code;
          session.role = 'playerTwo';

          const existingSessions = roomSessionsMap.get(room.code) || {};
          existingSessions.playerTwoSession = session;
          roomSessionsMap.set(room.code, existingSessions);

          sendWsMessage(socket, {
            type: 'room_joined',
            code: room.code,
            role: 'playerTwo',
          });

          const readyMsg: ServerWsMessage = {
            type: 'room_ready',
            code: room.code,
          };

          if (existingSessions.playerOneSession) {
            sendWsMessage(existingSessions.playerOneSession.socket, readyMsg);
          }
          sendWsMessage(socket, readyMsg);

          // Crear e iniciar runtime autoritativo de juego
          if (room.battleSession) {
            const runtime = runtimeRegistry.create(room.code, room.battleSession, (recipient, serverMsg) => {
              const sessions = roomSessionsMap.get(room.code);
              const targetSession =
                recipient === 'playerOne' ? sessions?.playerOneSession : sessions?.playerTwoSession;
              if (targetSession) {
                sendWsMessage(targetSession.socket, serverMsg);
              }
            });

            if (existingSessions.playerOneSession) {
              sendWsMessage(existingSessions.playerOneSession.socket, {
                type: 'battle_started',
                role: 'playerOne',
              });
            }

            sendWsMessage(socket, {
              type: 'battle_started',
              role: 'playerTwo',
            });

            runtime.start();
          }
        } catch (err) {
          if (err instanceof RoomError) {
            sendWsMessage(socket, {
              type: 'error',
              code: err.code,
              message: err.message,
            });
          } else {
            sendWsMessage(socket, {
              type: 'error',
              code: 'INTERNAL_ERROR',
              message: 'Failed to join room.',
            });
          }
        }
        return;
      }

      if (msg.type === 'player_input') {
        if (!session.roomCode || !session.role) {
          sendWsMessage(socket, {
            type: 'error',
            code: 'NOT_IN_ROOM',
            message: 'Cannot process input because connection is not in an active room.',
          });
          return;
        }

        const runtime = runtimeRegistry.get(session.roomCode);
        if (runtime && runtime.getIsRunning()) {
          runtime.enqueueInput(session.role, msg.input);
        }
        return;
      }
    });

    socket.on('close', () => {
      cleanupSession();
    });

    socket.on('error', () => {
      cleanupSession();
    });
  });
}
