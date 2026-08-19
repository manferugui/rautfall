import type {
  ClientWsMessage,
  ServerWsMessage,
  RoomCreatedServerMessage,
  RoomJoinedServerMessage,
  RoomReadyServerMessage,
  BattleStartedServerMessage,
  GameStateServerMessage,
  BattleEndedServerMessage,
  RematchRequestedServerMessage,
  PlayerDisconnectedServerMessage,
  ErrorServerMessage,
  WsStepInput,
} from '@rautfall/contracts';
import { getWsApiUrl } from './client';

export type OnlinePvPClientOptions = {
  url?: string;
  WebSocketClass?: typeof WebSocket;
};

export type EventListener<T> = (data: T) => void;

export class OnlinePvPClient {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly WebSocketClass: typeof WebSocket;

  private roomCreatedListeners: Set<EventListener<RoomCreatedServerMessage>> = new Set();
  private roomJoinedListeners: Set<EventListener<RoomJoinedServerMessage>> = new Set();
  private roomReadyListeners: Set<EventListener<RoomReadyServerMessage>> = new Set();
  private battleStartedListeners: Set<EventListener<BattleStartedServerMessage>> = new Set();
  private gameStateListeners: Set<EventListener<GameStateServerMessage>> = new Set();
  private battleEndedListeners: Set<EventListener<BattleEndedServerMessage>> = new Set();
  private rematchRequestedListeners: Set<EventListener<RematchRequestedServerMessage>> = new Set();
  private playerDisconnectedListeners: Set<EventListener<PlayerDisconnectedServerMessage>> = new Set();
  private errorListeners: Set<EventListener<ErrorServerMessage>> = new Set();
  private closeListeners: Set<EventListener<CloseEvent | Event>> = new Set();

  constructor(options: OnlinePvPClientOptions = {}) {
    this.url = options.url ?? getWsApiUrl();
    this.WebSocketClass = options.WebSocketClass ?? (typeof WebSocket !== 'undefined' ? WebSocket : (null as unknown as typeof WebSocket));
  }

  public connect(): Promise<void> {
    if (this.socket && this.socket.readyState === this.WebSocketClass.OPEN) {
      return Promise.resolve();
    }

    if (!this.WebSocketClass) {
      return Promise.reject(new Error('WebSocket no está disponible en este entorno'));
    }

    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new this.WebSocketClass(this.url);
        this.socket = ws;

        let openHandler: (() => void) | null = null;
        let errorHandler: ((evt: Event) => void) | null = null;
        let connectCloseHandler: ((evt: CloseEvent) => void) | null = null;

        const cleanup = () => {
          if (openHandler) ws.removeEventListener('open', openHandler);
          if (errorHandler) ws.removeEventListener('error', errorHandler);
          if (connectCloseHandler) ws.removeEventListener('close', connectCloseHandler);
        };

        openHandler = () => {
          if (ws.readyState === this.WebSocketClass.OPEN) {
            cleanup();
            resolve();
          }
        };

        errorHandler = () => {
          cleanup();
          this.socket = null;
          reject(new Error('Fallo al conectar con el servidor WebSocket PvP'));
        };

        connectCloseHandler = () => {
          cleanup();
          this.socket = null;
          reject(new Error('Conexión cerrada antes de establecerse con el servidor PvP'));
        };

        ws.addEventListener('open', openHandler);
        ws.addEventListener('error', errorHandler);
        ws.addEventListener('close', connectCloseHandler);

        ws.addEventListener('message', (event: MessageEvent) => {
          this.handleMessage(event.data);
        });

        ws.addEventListener('close', (evt: CloseEvent) => {
          this.handleClose(evt);
        });

        ws.addEventListener('error', () => {
          if (ws.readyState !== this.WebSocketClass.CONNECTING) {
            this.notifyError({
              type: 'error',
              code: 'WEBSOCKET_ERROR',
              message: 'Error en la conexión WebSocket',
            });
          }
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Fallo al instanciar WebSocket'));
      }
    });
  }

  public disconnect(): void {
    if (this.socket) {
      const ws = this.socket;
      this.socket = null;
      try {
        ws.close();
      } catch {
        // Ignorar errores al cerrar
      }
    }
  }

  public createRoom(): void {
    this.send({ type: 'create_room' });
  }

  public joinRoom(code: string): void {
    const normalizedCode = code.trim().toUpperCase();
    this.send({ type: 'join_room', code: normalizedCode });
  }

  public sendInput(input: WsStepInput): void {
    this.send({ type: 'player_input', input });
  }

  public togglePause(): void {
    this.send({ type: 'toggle_pause' });
  }

  public requestRematch(): void {
    this.send({ type: 'request_rematch' });
  }

  private send(msg: ClientWsMessage): void {
    if (!this.socket || this.socket.readyState !== this.WebSocketClass.OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(msg));
    } catch {
      // Ignorar errores de envío en sockets cerrados
    }
  }

  private handleMessage(rawData: unknown): void {
    if (typeof rawData !== 'string') return;

    let msg: ServerWsMessage;
    try {
      msg = JSON.parse(rawData) as ServerWsMessage;
    } catch {
      this.notifyError({
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Mensaje JSON no válido recibido del servidor',
      });
      return;
    }

    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return;
    }

    switch (msg.type) {
      case 'room_created':
        this.roomCreatedListeners.forEach((cb) => cb(msg as RoomCreatedServerMessage));
        break;
      case 'room_joined':
        this.roomJoinedListeners.forEach((cb) => cb(msg as RoomJoinedServerMessage));
        break;
      case 'room_ready':
        this.roomReadyListeners.forEach((cb) => cb(msg as RoomReadyServerMessage));
        break;
      case 'battle_started':
        this.battleStartedListeners.forEach((cb) => cb(msg as BattleStartedServerMessage));
        break;
      case 'game_state':
        this.gameStateListeners.forEach((cb) => cb(msg as GameStateServerMessage));
        break;
      case 'battle_ended':
        this.battleEndedListeners.forEach((cb) => cb(msg as BattleEndedServerMessage));
        break;
      case 'rematch_requested':
        this.rematchRequestedListeners.forEach((cb) => cb(msg as RematchRequestedServerMessage));
        break;
      case 'player_disconnected':
        this.playerDisconnectedListeners.forEach((cb) => cb(msg as PlayerDisconnectedServerMessage));
        break;
      case 'error':
        this.notifyError(msg as ErrorServerMessage);
        break;
    }
  }

  private handleClose(evt: CloseEvent | Event): void {
    this.closeListeners.forEach((cb) => cb(evt));
  }

  private notifyError(error: ErrorServerMessage): void {
    this.errorListeners.forEach((cb) => cb(error));
  }

  // Métodos de suscripción
  public onRoomCreated(cb: EventListener<RoomCreatedServerMessage>): () => void {
    this.roomCreatedListeners.add(cb);
    return () => this.roomCreatedListeners.delete(cb);
  }

  public onRoomJoined(cb: EventListener<RoomJoinedServerMessage>): () => void {
    this.roomJoinedListeners.add(cb);
    return () => this.roomJoinedListeners.delete(cb);
  }

  public onRoomReady(cb: EventListener<RoomReadyServerMessage>): () => void {
    this.roomReadyListeners.add(cb);
    return () => this.roomReadyListeners.delete(cb);
  }

  public onBattleStarted(cb: EventListener<BattleStartedServerMessage>): () => void {
    this.battleStartedListeners.add(cb);
    return () => this.battleStartedListeners.delete(cb);
  }

  public onGameState(cb: EventListener<GameStateServerMessage>): () => void {
    this.gameStateListeners.add(cb);
    return () => this.gameStateListeners.delete(cb);
  }

  public onBattleEnded(cb: EventListener<BattleEndedServerMessage>): () => void {
    this.battleEndedListeners.add(cb);
    return () => this.battleEndedListeners.delete(cb);
  }

  public onRematchRequested(cb: EventListener<RematchRequestedServerMessage>): () => void {
    this.rematchRequestedListeners.add(cb);
    return () => this.rematchRequestedListeners.delete(cb);
  }

  public onPlayerDisconnected(cb: EventListener<PlayerDisconnectedServerMessage>): () => void {
    this.playerDisconnectedListeners.add(cb);
    return () => this.playerDisconnectedListeners.delete(cb);
  }

  public onError(cb: EventListener<ErrorServerMessage>): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  public onClose(cb: EventListener<CloseEvent | Event>): () => void {
    this.closeListeners.add(cb);
    return () => this.closeListeners.delete(cb);
  }

  public isConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === this.WebSocketClass.OPEN);
  }

  public destroy(): void {
    this.disconnect();
    this.roomCreatedListeners.clear();
    this.roomJoinedListeners.clear();
    this.roomReadyListeners.clear();
    this.battleStartedListeners.clear();
    this.gameStateListeners.clear();
    this.battleEndedListeners.clear();
    this.playerDisconnectedListeners.clear();
    this.errorListeners.clear();
    this.closeListeners.clear();
  }
}
