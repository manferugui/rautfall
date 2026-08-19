import type {
  WsStepInput,
  GameStateServerMessage,
  BattleEndedServerMessage,
  RematchRequestedServerMessage,
  PlayerDisconnectedServerMessage,
  ErrorServerMessage,
  WsParticipantRole,
} from '@rautfall/contracts';
import { OnlinePvPClient, type OnlinePvPClientOptions } from './pvp-ws-client';
import type { ControlAction } from '../settings/control-bindings';

export type OnlineSessionStatus =
  | 'idle'
  | 'connecting'
  | 'waiting'
  | 'ready'
  | 'playing'
  | 'ended'
  | 'disconnected'
  | 'error';

export type HeldState = {
  leftHeld: boolean;
  rightHeld: boolean;
  softDropHeld: boolean;
};

export class OnlineGameSession {
  private readonly client: OnlinePvPClient;

  private _roomCode: string | null = null;
  private _role: WsParticipantRole | null = null;
  private _status: OnlineSessionStatus = 'idle';
  private _latestGameState: GameStateServerMessage | null = null;
  private _lastError: ErrorServerMessage | null = null;
  private _rematchRequests: Set<WsParticipantRole> = new Set();

  private heldState: HeldState = {
    leftHeld: false,
    rightHeld: false,
    softDropHeld: false,
  };

  private unbindFns: Array<() => void> = [];
  private statusListeners: Set<(status: OnlineSessionStatus) => void> = new Set();
  private gameStateListeners: Set<(state: GameStateServerMessage) => void> = new Set();
  private battleEndedListeners: Set<(msg: BattleEndedServerMessage) => void> = new Set();
  private rematchRequestedListeners: Set<(msg: RematchRequestedServerMessage) => void> = new Set();
  private disconnectedListeners: Set<(msg: PlayerDisconnectedServerMessage) => void> = new Set();
  private errorListeners: Set<(msg: ErrorServerMessage) => void> = new Set();

  constructor(options?: OnlinePvPClientOptions) {
    this.client = new OnlinePvPClient(options);
    this.setupClientListeners();
  }

  public get roomCode(): string | null {
    return this._roomCode;
  }

  public get role(): WsParticipantRole | null {
    return this._role;
  }

  public get status(): OnlineSessionStatus {
    return this._status;
  }

  public get latestGameState(): GameStateServerMessage | null {
    return this._latestGameState;
  }

  public get lastError(): ErrorServerMessage | null {
    return this._lastError;
  }

  public get rematchRequests(): ReadonlySet<WsParticipantRole> {
    return this._rematchRequests;
  }

  public get isRematchRequestedByMe(): boolean {
    return this._role ? this._rematchRequests.has(this._role) : false;
  }

  public getHeldState(): Readonly<HeldState> {
    return { ...this.heldState };
  }

  private setStatus(status: OnlineSessionStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.statusListeners.forEach((cb) => cb(status));
    }
  }

  private setupClientListeners(): void {
    this.unbindFns.push(
      this.client.onRoomCreated((msg) => {
        this._roomCode = msg.code;
        this._role = msg.role;
        this.setStatus('waiting');
      })
    );

    this.unbindFns.push(
      this.client.onRoomJoined((msg) => {
        this._roomCode = msg.code;
        this._role = msg.role;
        this.setStatus('waiting');
      })
    );

    this.unbindFns.push(
      this.client.onRoomReady((msg) => {
        this._roomCode = msg.code;
        this.setStatus('ready');
      })
    );

    this.unbindFns.push(
      this.client.onBattleStarted((msg) => {
        this._role = msg.role;
        this._rematchRequests.clear();
        this.setStatus('playing');
      })
    );

    this.unbindFns.push(
      this.client.onGameState((msg) => {
        this._latestGameState = msg;
        if (this._status !== 'playing' && (msg.status === 'running' || msg.status === 'paused')) {
          this.setStatus('playing');
        }
        if (msg.status === 'paused') {
          this.heldState = {
            leftHeld: false,
            rightHeld: false,
            softDropHeld: false,
          };
        }
        this.gameStateListeners.forEach((cb) => cb(msg));
      })
    );

    this.unbindFns.push(
      this.client.onBattleEnded((msg) => {
        this.setStatus('ended');
        this.battleEndedListeners.forEach((cb) => cb(msg));
      })
    );

    this.unbindFns.push(
      this.client.onRematchRequested((msg) => {
        this._rematchRequests.add(msg.requestedBy);
        this.rematchRequestedListeners.forEach((cb) => cb(msg));
      })
    );

    this.unbindFns.push(
      this.client.onPlayerDisconnected((msg) => {
        this._rematchRequests.clear();
        this.setStatus('disconnected');
        this.disconnectedListeners.forEach((cb) => cb(msg));
      })
    );

    this.unbindFns.push(
      this.client.onError((msg) => {
        this._lastError = msg;
        this._rematchRequests.clear();
        this.setStatus('error');
        this.errorListeners.forEach((cb) => cb(msg));
      })
    );
  }

  public async createRoom(): Promise<void> {
    this.setStatus('connecting');
    this._lastError = null;
    try {
      await this.client.connect();
      this.client.createRoom();
    } catch (err) {
      const errorMsg: ErrorServerMessage = {
        type: 'error',
        code: 'CONNECTION_FAILED',
        message: err instanceof Error ? err.message : 'Fallo al conectar con el servidor WebSocket PvP',
      };
      this._lastError = errorMsg;
      this.setStatus('error');
      this.errorListeners.forEach((cb) => cb(errorMsg));
    }
  }

  public async joinRoom(code: string): Promise<void> {
    this.setStatus('connecting');
    this._lastError = null;
    try {
      await this.client.connect();
      this.client.joinRoom(code);
    } catch (err) {
      const errorMsg: ErrorServerMessage = {
        type: 'error',
        code: 'CONNECTION_FAILED',
        message: err instanceof Error ? err.message : 'Fallo al conectar con el servidor WebSocket PvP',
      };
      this._lastError = errorMsg;
      this.setStatus('error');
      this.errorListeners.forEach((cb) => cb(errorMsg));
    }
  }

  public get canResume(): boolean {
    if (!this._latestGameState || this._latestGameState.status !== 'paused') {
      return true;
    }
    return this._latestGameState.pausedBy === this._role;
  }

  public togglePause(): void {
    if (this._status === 'playing') {
      if (this._latestGameState?.status === 'paused' && this._latestGameState.pausedBy !== this._role) {
        return;
      }
      this.client.togglePause();
    }
  }

  /**
   * Procesa la pulsación física inicial (keydown) de una acción.
   * Actualiza el estado sostenido de la tecla y emite el snapshot completo con la acción oneshot activa si procede.
   */
  public handleKeyDown(action: ControlAction): void {
    if (this._status !== 'playing') return;

    let oneshotClockwise = false;
    let oneshotCounterclockwise = false;
    let oneshotHardDrop = false;
    let oneshotHold = false;
    let oneshotSabotage = false;

    if (action === 'moveLeft') {
      this.heldState.leftHeld = true;
    } else if (action === 'moveRight') {
      this.heldState.rightHeld = true;
    } else if (action === 'softDrop') {
      this.heldState.softDropHeld = true;
    } else if (action === 'rotateClockwise') {
      oneshotClockwise = true;
    } else if (action === 'rotateCounterClockwise') {
      oneshotCounterclockwise = true;
    } else if (action === 'hardDrop') {
      oneshotHardDrop = true;
    } else if (action === 'hold') {
      oneshotHold = true;
    } else if (action === 'triggerSabotage') {
      oneshotSabotage = true;
    }

    const inputSnapshot: WsStepInput = {
      leftHeld: this.heldState.leftHeld,
      rightHeld: this.heldState.rightHeld,
      softDropHeld: this.heldState.softDropHeld,
      leftPressed: action === 'moveLeft',
      rightPressed: action === 'moveRight',
      hardDrop: oneshotHardDrop,
      rotateClockwise: oneshotClockwise,
      rotateCounterclockwise: oneshotCounterclockwise,
      hold: oneshotHold,
      triggerSabotage: oneshotSabotage,
    };

    this.client.sendInput(inputSnapshot);
  }

  /**
   * Procesa la liberación física (keyup) de una acción.
   * Libera el estado sostenido correspondiente y transmite el snapshot actualizado con oneshots en false.
   */
  public handleKeyUp(action: ControlAction): void {
    if (this._status !== 'playing') return;

    if (action === 'moveLeft') {
      this.heldState.leftHeld = false;
    } else if (action === 'moveRight') {
      this.heldState.rightHeld = false;
    } else if (action === 'softDrop') {
      this.heldState.softDropHeld = false;
    }

    const inputSnapshot: WsStepInput = {
      leftHeld: this.heldState.leftHeld,
      rightHeld: this.heldState.rightHeld,
      softDropHeld: this.heldState.softDropHeld,
      leftPressed: false,
      rightPressed: false,
      hardDrop: false,
      rotateClockwise: false,
      rotateCounterclockwise: false,
      hold: false,
      triggerSabotage: false,
    };

    this.client.sendInput(inputSnapshot);
  }

  /**
   * Procesa la pérdida de foco (blur).
   * Restablece todo el estado sostenido a false y emite inmediatamente un snapshot neutro.
   */
  public handleBlur(): void {
    if (this._status !== 'playing') return;

    this.heldState = {
      leftHeld: false,
      rightHeld: false,
      softDropHeld: false,
    };

    const inputSnapshot: WsStepInput = {
      leftHeld: false,
      rightHeld: false,
      softDropHeld: false,
      leftPressed: false,
      rightPressed: false,
      hardDrop: false,
      rotateClockwise: false,
      rotateCounterclockwise: false,
      hold: false,
      triggerSabotage: false,
    };

    this.client.sendInput(inputSnapshot);
  }

  public requestRematch(): void {
    if (this._status === 'ended' || this._status === 'ready' || this._status === 'playing') {
      this.client.requestRematch();
    }
  }

  public onStatusChange(cb: (status: OnlineSessionStatus) => void): () => void {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public onGameState(cb: (state: GameStateServerMessage) => void): () => void {
    this.gameStateListeners.add(cb);
    return () => this.gameStateListeners.delete(cb);
  }

  public onBattleEnded(cb: (msg: BattleEndedServerMessage) => void): () => void {
    this.battleEndedListeners.add(cb);
    return () => this.battleEndedListeners.delete(cb);
  }

  public onRematchRequested(cb: (msg: RematchRequestedServerMessage) => void): () => void {
    this.rematchRequestedListeners.add(cb);
    return () => this.rematchRequestedListeners.delete(cb);
  }

  public onPlayerDisconnected(cb: (msg: PlayerDisconnectedServerMessage) => void): () => void {
    this.disconnectedListeners.add(cb);
    return () => this.disconnectedListeners.delete(cb);
  }

  public onError(cb: (msg: ErrorServerMessage) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  public destroy(): void {
    this.unbindFns.forEach((fn) => fn());
    this.unbindFns = [];
    this.statusListeners.clear();
    this.gameStateListeners.clear();
    this.battleEndedListeners.clear();
    this.disconnectedListeners.clear();
    this.errorListeners.clear();
    this.client.destroy();
    this._status = 'ended';
  }
}
