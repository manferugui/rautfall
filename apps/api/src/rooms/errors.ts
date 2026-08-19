export type RoomErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_NOT_WAITING'
  | 'ROOM_NOT_READY'
  | 'INVALID_PLAYER'
  | 'ROOM_CODE_GENERATION_FAILED';

/**
 * Error específico del dominio de gestión de salas PvP.
 */
export class RoomError extends Error {
  readonly code: RoomErrorCode;

  constructor(code: RoomErrorCode, message: string) {
    super(message);
    this.name = 'RoomError';
    this.code = code;
  }
}
