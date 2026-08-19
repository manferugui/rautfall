import { describe, expect, it, vi } from 'vitest';
import type { BattleSession } from '@rautfall/battle-engine';
import {
  createRoomManager,
  generateRoomCode,
  RoomError,
  UNAMBIGUOUS_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../../src/rooms/index.js';

describe('RoomManager y Modelo de Salas PvP', () => {
  it('crea una sala con estado waiting_for_player y playerOne configurado', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    expect(room.code).toHaveLength(ROOM_CODE_LENGTH);
    expect(room.status).toBe('waiting_for_player');
    expect(room.playerOne.id).toBe('player-1');
    expect(room.playerTwo).toBeUndefined();
    expect(room.battleSession).toBeUndefined();
  });

  it('genera un código corto usando únicamente el alfabeto inequívoco', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    for (const char of room.code) {
      expect(UNAMBIGUOUS_ALPHABET).toContain(char);
    }
  });

  it('resuelve colisiones de código reintentando hasta encontrar uno libre', () => {
    const existingCodes = new Set(['AAAAA', 'BBBBB']);
    let calls = 0;
    const mockRng = () => {
      calls++;
      // Devuelve 0 tres veces (para generar AAAAA tres veces consecutivas) y luego índice de C (2)
      if (calls <= 15) return 0; // Apunta a '2'
      return 0.1;
    };

    const code = generateRoomCode((c) => existingCodes.has(c), mockRng);
    expect(code).not.toBe('AAAAA');
    expect(code).not.toBe('BBBBB');
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('lanza RoomError si no logra generar un código único tras el máximo de reintentos', () => {
    const alwaysCollides = () => true;
    expect(() => generateRoomCode(alwaysCollides)).toThrow(RoomError);
    try {
      generateRoomCode(alwaysCollides);
    } catch (err) {
      expect(err).toBeInstanceOf(RoomError);
      expect((err as RoomError).code).toBe('ROOM_CODE_GENERATION_FAILED');
    }
  });

  it('permite consultar una sala por su código (insensible a mayúsculas/minúsculas y espacios)', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    const foundUpper = manager.getRoom(room.code);
    const foundLower = manager.getRoom(room.code.toLowerCase());
    const foundSpaced = manager.getRoom(`  ${room.code}  `);

    expect(foundUpper).toEqual(room);
    expect(foundLower).toEqual(room);
    expect(foundSpaced).toEqual(room);
  });

  it('devuelve undefined al consultar un código inexistente o vacío', () => {
    const manager = createRoomManager();
    expect(manager.getRoom('NOEXISTE')).toBeUndefined();
    expect(manager.getRoom('')).toBeUndefined();
  });

  it('no instancia BattleSession durante createRoom()', () => {
    const mockFactory = vi.fn<() => BattleSession>();
    const manager = createRoomManager({ battleSessionFactory: mockFactory });

    const room = manager.createRoom('player-1');

    expect(mockFactory).not.toHaveBeenCalled();
    expect(room.battleSession).toBeUndefined();
  });

  it('incorpora Player 2, transiciona a ready e instancia exactamente una BattleSession en joinRoom() válido', () => {
    const dummySession = {} as BattleSession;
    const mockFactory = vi.fn<() => BattleSession>(() => dummySession);
    const manager = createRoomManager({ battleSessionFactory: mockFactory });

    const createdRoom = manager.createRoom('player-1');
    const joinedRoom = manager.joinRoom(createdRoom.code, 'player-2');

    expect(mockFactory).toHaveBeenCalledTimes(1);
    expect(joinedRoom.status).toBe('ready');
    expect(joinedRoom.playerOne.id).toBe('player-1');
    expect(joinedRoom.playerTwo?.id).toBe('player-2');
    expect(joinedRoom.battleSession).toBe(dummySession);
  });

  it('rechaza la incorporación de un tercer jugador en una sala que ya está ready', () => {
    const dummySession = {} as BattleSession;
    const mockFactory = vi.fn<() => BattleSession>(() => dummySession);
    const manager = createRoomManager({ battleSessionFactory: mockFactory });

    const createdRoom = manager.createRoom('player-1');
    manager.joinRoom(createdRoom.code, 'player-2');

    expect(() => manager.joinRoom(createdRoom.code, 'player-3')).toThrow(RoomError);
    try {
      manager.joinRoom(createdRoom.code, 'player-3');
    } catch (err) {
      expect(err).toBeInstanceOf(RoomError);
      expect((err as RoomError).code).toBe('ROOM_NOT_WAITING');
    }
  });

  it('rechaza unirse a una sala inexistente', () => {
    const manager = createRoomManager();
    expect(() => manager.joinRoom('UNKNOWN', 'player-2')).toThrow(RoomError);
    try {
      manager.joinRoom('UNKNOWN', 'player-2');
    } catch (err) {
      expect((err as RoomError).code).toBe('ROOM_NOT_FOUND');
    }
  });

  it('rechaza que Player 1 se una a su propia sala como Player 2', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    expect(() => manager.joinRoom(room.code, 'player-1')).toThrow(RoomError);
    try {
      manager.joinRoom(room.code, 'player-1');
    } catch (err) {
      expect((err as RoomError).code).toBe('INVALID_PLAYER');
    }
  });

  it('rechaza identificadores de jugador vacíos o inválidos', () => {
    const manager = createRoomManager();
    expect(() => manager.createRoom('   ')).toThrow(RoomError);

    const room = manager.createRoom('player-1');
    expect(() => manager.joinRoom(room.code, '')).toThrow(RoomError);
  });

  it('no instancia BattleSession ante un joinRoom() inválido', () => {
    const mockFactory = vi.fn<() => BattleSession>();
    const manager = createRoomManager({ battleSessionFactory: mockFactory });

    expect(() => manager.joinRoom('INVALID_CODE', 'player-2')).toThrow();
    expect(mockFactory).not.toHaveBeenCalled();

    const room = manager.createRoom('player-1');
    expect(() => manager.joinRoom(room.code, 'player-1')).toThrow();
    expect(mockFactory).not.toHaveBeenCalled();
  });

  it('garantiza la ausencia de mutaciones parciales ante operaciones inválidas', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    expect(() => manager.joinRoom(room.code, 'player-1')).toThrow();

    const untouchedRoom = manager.getRoom(room.code);
    expect(untouchedRoom?.status).toBe('waiting_for_player');
    expect(untouchedRoom?.playerTwo).toBeUndefined();
    expect(untouchedRoom?.battleSession).toBeUndefined();
  });

  it('elimina físicamente la sala en closeRoom() y hace que getRoom() devuelva undefined', () => {
    const manager = createRoomManager();
    const room = manager.createRoom('player-1');

    expect(manager.getRoom(room.code)).toBeDefined();

    manager.closeRoom(room.code);

    expect(manager.getRoom(room.code)).toBeUndefined();
  });

  it('lanza RoomError al intentar cerrar una sala que no existe', () => {
    const manager = createRoomManager();
    expect(() => manager.closeRoom('NOTFOUND')).toThrow(RoomError);
    try {
      manager.closeRoom('NOTFOUND');
    } catch (err) {
      expect((err as RoomError).code).toBe('ROOM_NOT_FOUND');
    }
  });
});
