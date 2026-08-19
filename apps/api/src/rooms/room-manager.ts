import {
  createBattleSession,
  type BattleSession,
  type BattleSessionOptions,
} from '@rautfall/battle-engine';
import { prototypeConfig } from '@rautfall/game-config';
import { RoomError } from './errors.js';
import { generateRoomCode } from './room-code.js';
import type { PvPRoom } from './pvp-room.js';

export type BattleSessionFactory = (options?: Partial<BattleSessionOptions>) => BattleSession;

export type RoomManagerOptions = Readonly<{
  battleSessionFactory?: BattleSessionFactory;
  rngFn?: () => number;
}>;

export interface RoomManager {
  createRoom(playerOneId: string): PvPRoom;
  getRoom(code: string): PvPRoom | undefined;
  joinRoom(code: string, playerTwoId: string): PvPRoom;
  closeRoom(code: string): void;
}

/**
 * Crea un gestor en memoria de salas PvP privadas.
 */
export function createRoomManager(options: RoomManagerOptions = {}): RoomManager {
  const rooms = new Map<string, PvPRoom>();

  const defaultBattleSessionFactory: BattleSessionFactory = (opts = {}) => {
    const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);
    const config = opts.config ?? prototypeConfig;
    return createBattleSession({ seed, config, ...opts });
  };

  const battleSessionFactory = options.battleSessionFactory ?? defaultBattleSessionFactory;

  function normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  function validatePlayerId(id: string): string {
    const trimmed = id.trim();
    if (!trimmed) {
      throw new RoomError('INVALID_PLAYER', 'Player ID must be a non-empty string.');
    }
    return trimmed;
  }

  return {
    createRoom(playerOneId: string): PvPRoom {
      const validPlayerOneId = validatePlayerId(playerOneId);

      const code = generateRoomCode((c) => rooms.has(c), options.rngFn);

      const room: PvPRoom = Object.freeze({
        code,
        status: 'waiting_for_player',
        playerOne: Object.freeze({ id: validPlayerOneId }),
      });

      rooms.set(code, room);
      return room;
    },

    getRoom(code: string): PvPRoom | undefined {
      if (!code) return undefined;
      const normalized = normalizeCode(code);
      return rooms.get(normalized);
    },

    joinRoom(code: string, playerTwoId: string): PvPRoom {
      const validPlayerTwoId = validatePlayerId(playerTwoId);
      const normalizedCode = normalizeCode(code);

      const existingRoom = rooms.get(normalizedCode);
      if (!existingRoom) {
        throw new RoomError('ROOM_NOT_FOUND', `Room with code '${normalizedCode}' was not found.`);
      }

      if (existingRoom.status !== 'waiting_for_player') {
        throw new RoomError(
          'ROOM_NOT_WAITING',
          `Cannot join room '${normalizedCode}' because it is in '${existingRoom.status}' state.`,
        );
      }

      if (existingRoom.playerOne.id === validPlayerTwoId) {
        throw new RoomError(
          'INVALID_PLAYER',
          `Player '${validPlayerTwoId}' cannot join room '${normalizedCode}' as Player 2 because they are already Player 1.`,
        );
      }

      // Instanciar la sesión de batalla únicamente tras superar todas las validaciones
      const battleSession = battleSessionFactory();

      const updatedRoom: PvPRoom = Object.freeze({
        code: existingRoom.code,
        status: 'ready',
        playerOne: existingRoom.playerOne,
        playerTwo: Object.freeze({ id: validPlayerTwoId }),
        battleSession,
      });

      rooms.set(normalizedCode, updatedRoom);
      return updatedRoom;
    },

    closeRoom(code: string): void {
      const normalizedCode = normalizeCode(code);
      if (!rooms.has(normalizedCode)) {
        throw new RoomError('ROOM_NOT_FOUND', `Cannot close room '${normalizedCode}' because it does not exist.`);
      }
      rooms.delete(normalizedCode);
    },
  };
}
