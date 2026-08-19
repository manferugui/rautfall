import type { BattleEvent, BattleSession, BattleParticipant } from '@rautfall/battle-engine';
import type { StepInput } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import type {
  ServerWsMessage,
  WsStepInput,
  WsBattleEvent,
  WsEngineSnapshot,
  WsParticipantState,
} from '@rautfall/contracts';

export type OneshotAction =
  | 'leftPressed'
  | 'rightPressed'
  | 'hardDrop'
  | 'rotateClockwise'
  | 'rotateCounterclockwise'
  | 'hold'
  | 'triggerSabotage';

export type HeldState = {
  leftHeld: boolean;
  rightHeld: boolean;
  softDropHeld: boolean;
};

export type BroadcastCallback = (
  recipient: 'playerOne' | 'playerTwo',
  msg: ServerWsMessage,
) => void;

export type BattleEndedCallback = (roomCode: string) => void;

export const MAX_PENDING_ONESHOTS = 32;

export function consumeNextStepInput(held: HeldState, queue: OneshotAction[]): StepInput {
  const input: StepInput = {
    leftHeld: held.leftHeld,
    rightHeld: held.rightHeld,
    softDropHeld: held.softDropHeld,
    leftPressed: false,
    rightPressed: false,
    hardDrop: false,
  };

  while (queue.length > 0) {
    const action = queue[0]!;

    if (action === 'leftPressed') {
      queue.shift();
      if (held.leftHeld) {
        input.leftPressed = true;
        break;
      }
      continue;
    }

    if (action === 'rightPressed') {
      queue.shift();
      if (held.rightHeld) {
        input.rightPressed = true;
        break;
      }
      continue;
    }

    if (action === 'hardDrop') {
      queue.shift();
      input.hardDrop = true;
      break;
    }

    if (action === 'rotateClockwise') {
      queue.shift();
      input.rotateClockwise = true;
      break;
    }

    if (action === 'rotateCounterclockwise') {
      queue.shift();
      input.rotateCounterclockwise = true;
      break;
    }

    if (action === 'hold') {
      queue.shift();
      input.hold = true;
      break;
    }

    if (action === 'triggerSabotage') {
      queue.shift();
      input.triggerSabotage = true;
      break;
    }

    queue.shift();
  }

  return input;
}

export function filterEventsForParticipant(
  events: readonly BattleEvent[],
  recipient: BattleParticipant,
  isInterfered: boolean,
): WsBattleEvent[] {
  const wsEvents = events as unknown as WsBattleEvent[];
  if (!isInterfered) {
    return [...wsEvents];
  }

  const opponent = recipient === 'playerOne' ? 'playerTwo' : 'playerOne';
  return wsEvents.filter((evt) => {
    if (evt.type === 'participantEvent' && evt.participant === opponent) {
      const hiddenTypes = ['pieceMoved', 'pieceSpawned', 'pieceRotated', 'pieceLocked', 'pieceHeld'];
      return !hiddenTypes.includes(evt.event.type);
    }
    return true;
  });
}

export class RoomGameRuntime {
  private readonly roomCode: string;
  private readonly battleSession: BattleSession;
  private readonly onBroadcast: BroadcastCallback;
  private readonly onEnded?: BattleEndedCallback | undefined;

  readonly fixedStepMs: number = prototypeConfig.fixedStepMs;

  private p1Held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };
  private p2Held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };

  private p1PendingQueue: OneshotAction[] = [];
  private p2PendingQueue: OneshotAction[] = [];

  private eventBuffer: BattleEvent[] = [];

  private tickTimer: NodeJS.Timeout | null = null;
  private broadcastTimer: NodeJS.Timeout | null = null;

  private isRunning = false;
  private lastTime = 0;
  private accumulator = 0;

  constructor(
    roomCode: string,
    battleSession: BattleSession,
    onBroadcast: BroadcastCallback,
    onEnded?: BattleEndedCallback,
  ) {
    this.roomCode = roomCode;
    this.battleSession = battleSession;
    this.onBroadcast = onBroadcast;
    this.onEnded = onEnded;
  }

  enqueueInput(participant: 'playerOne' | 'playerTwo', input: WsStepInput): void {
    const heldState = participant === 'playerOne' ? this.p1Held : this.p2Held;
    const queue = participant === 'playerOne' ? this.p1PendingQueue : this.p2PendingQueue;

    heldState.leftHeld = input.leftHeld;
    heldState.rightHeld = input.rightHeld;
    heldState.softDropHeld = input.softDropHeld;

    const pushIfSpace = (action: OneshotAction) => {
      if (queue.length < MAX_PENDING_ONESHOTS) {
        queue.push(action);
      }
    };

    if (input.leftPressed) pushIfSpace('leftPressed');
    if (input.rightPressed) pushIfSpace('rightPressed');
    if (input.hardDrop) pushIfSpace('hardDrop');
    if (input.rotateClockwise) pushIfSpace('rotateClockwise');
    if (input.rotateCounterclockwise) pushIfSpace('rotateCounterclockwise');
    if (input.hold) pushIfSpace('hold');
    if (input.triggerSabotage) pushIfSpace('triggerSabotage');
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulator = 0;

    // Broadcast síncrono inicial del estado 0 inmediatamente después de battle_started
    this.broadcastState();

    // Bucle de tick autoritativo a 100 Hz (paso fijado por fixedStepMs)
    this.tickTimer = setInterval(() => {
      this.stepLoop();
    }, this.fixedStepMs);

    // Broadcast periódico a 20 Hz (cada 50ms)
    this.broadcastTimer = setInterval(() => {
      this.broadcastState();
    }, 50);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.broadcastTimer !== null) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  stepLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    let delta = now - this.lastTime;
    this.lastTime = now;

    // Límite estricto de catch-up por iteración: máximo 100 ms (10 steps)
    if (delta > 100) {
      delta = 100;
    }

    this.accumulator += delta;

    while (this.accumulator >= this.fixedStepMs) {
      if (!this.isRunning) break;

      const p1Input = consumeNextStepInput(this.p1Held, this.p1PendingQueue);
      const p2Input = consumeNextStepInput(this.p2Held, this.p2PendingQueue);

      let snapshot;
      try {
        snapshot = this.battleSession.step({
          playerOne: p1Input,
          playerTwo: p2Input,
        });
      } catch {
        snapshot = this.battleSession.getSnapshot();
      }

      const drained = this.battleSession.drainEvents();
      this.eventBuffer.push(...drained);

      if (snapshot.status !== 'running') {
        this.stop();
        const winner = snapshot.winner ?? 'draw';
        this.onBroadcast('playerOne', {
          type: 'battle_ended',
          winner,
          finalSnapshot: snapshot,
        });
        this.onBroadcast('playerTwo', {
          type: 'battle_ended',
          winner,
          finalSnapshot: snapshot,
        });
        if (this.onEnded) {
          this.onEnded(this.roomCode);
        }
        break;
      }

      this.accumulator -= this.fixedStepMs;
    }
  }

  broadcastState(): void {
    if (!this.isRunning) return;

    const snapshot = this.battleSession.getSnapshot();
    const eventsToBroadcast = [...this.eventBuffer];
    this.eventBuffer = [];

    const p1Perception = this.battleSession.getPerceivedOpponentSnapshot('playerOne');
    const p2Perception = this.battleSession.getPerceivedOpponentSnapshot('playerTwo');

    const p1Events = filterEventsForParticipant(
      eventsToBroadcast,
      'playerOne',
      snapshot.playerOneState.isInterfered,
    );

    const p2Events = filterEventsForParticipant(
      eventsToBroadcast,
      'playerTwo',
      snapshot.playerTwoState.isInterfered,
    );

    const p1Msg: ServerWsMessage = {
      type: 'game_state',
      step: snapshot.step,
      elapsedMs: snapshot.elapsedMs,
      status: snapshot.status,
      winner: snapshot.winner,
      suddenDeath: snapshot.suddenDeath,
      self: snapshot.playerOne as unknown as WsEngineSnapshot,
      opponent: p1Perception as unknown as WsEngineSnapshot,
      selfState: snapshot.playerOneState as unknown as WsParticipantState,
      opponentState: snapshot.playerTwoState as unknown as WsParticipantState,
      events: p1Events,
    };

    const p2Msg: ServerWsMessage = {
      type: 'game_state',
      step: snapshot.step,
      elapsedMs: snapshot.elapsedMs,
      status: snapshot.status,
      winner: snapshot.winner,
      suddenDeath: snapshot.suddenDeath,
      self: snapshot.playerTwo as unknown as WsEngineSnapshot,
      opponent: p2Perception as unknown as WsEngineSnapshot,
      selfState: snapshot.playerTwoState as unknown as WsParticipantState,
      opponentState: snapshot.playerOneState as unknown as WsParticipantState,
      events: p2Events,
    };

    this.onBroadcast('playerOne', p1Msg);
    this.onBroadcast('playerTwo', p2Msg);
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getPendingQueue(participant: 'playerOne' | 'playerTwo'): readonly OneshotAction[] {
    return participant === 'playerOne' ? this.p1PendingQueue : this.p2PendingQueue;
  }
}
