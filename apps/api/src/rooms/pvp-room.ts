import type { BattleSession } from '@rautfall/battle-engine';

export type PvPRoomStatus = 'waiting_for_player' | 'ready';

export type PvPRoomParticipant = Readonly<{
  id: string;
}>;

export type PvPRoom = Readonly<{
  code: string;
  status: PvPRoomStatus;
  playerOne: PvPRoomParticipant;
  playerTwo?: PvPRoomParticipant;
  battleSession?: BattleSession;
}>;
