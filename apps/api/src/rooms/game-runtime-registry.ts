import type { BattleSession } from '@rautfall/battle-engine';
import { RoomGameRuntime, type BroadcastCallback } from './room-game-runtime.js';

export interface GameRuntimeRegistry {
  get(roomCode: string): RoomGameRuntime | undefined;
  create(
    roomCode: string,
    battleSession: BattleSession,
    onBroadcast: BroadcastCallback,
  ): RoomGameRuntime;
  stopAndRemove(roomCode: string): void;
}

export function createGameRuntimeRegistry(): GameRuntimeRegistry {
  const runtimes = new Map<string, RoomGameRuntime>();

  function normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  return {
    get(roomCode: string): RoomGameRuntime | undefined {
      if (!roomCode) return undefined;
      return runtimes.get(normalizeCode(roomCode));
    },

    create(
      roomCode: string,
      battleSession: BattleSession,
      onBroadcast: BroadcastCallback,
    ): RoomGameRuntime {
      const normalizedCode = normalizeCode(roomCode);
      const existing = runtimes.get(normalizedCode);
      if (existing) {
        existing.stop();
        runtimes.delete(normalizedCode);
      }

      const runtime = new RoomGameRuntime(
        normalizedCode,
        battleSession,
        onBroadcast,
        (codeToClean) => {
          runtimes.delete(normalizeCode(codeToClean));
        },
      );
      runtimes.set(normalizedCode, runtime);
      return runtime;
    },

    stopAndRemove(roomCode: string): void {
      const normalizedCode = normalizeCode(roomCode);
      const runtime = runtimes.get(normalizedCode);
      if (runtime) {
        runtime.stop();
        runtimes.delete(normalizedCode);
      }
    },
  };
}
