import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { OnlinePvPClient } from './pvp-ws-client';
import type { WsStepInput } from '@rautfall/contracts';

class MockWebSocket {
  public static OPEN = 1;
  public static CLOSED = 3;
  public static CONNECTING = 0;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;
  public sentData: string[] = [];
  private listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent('open', new Event('open'));
    }, 0);
  }

  public addEventListener(type: string, listener: (event: unknown) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  public removeEventListener(type: string, listener: (event: unknown) => void): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  public send(data: string): void {
    this.sentData.push(data);
  }

  public close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent('close', new Event('close'));
  }

  public dispatchEvent(type: string, event: unknown): void {
    if (this.listeners[type]) {
      this.listeners[type].forEach((cb) => cb(event));
    }
  }

  public receiveMessage(data: object): void {
    this.dispatchEvent('message', { data: JSON.stringify(data) });
  }
}

describe('OnlinePvPClient (pvp-ws-client.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('se conecta correctamente y permite enviar create_room, join_room e input', async () => {
    const client = new OnlinePvPClient({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = client.connect();
    vi.runAllTimers();
    await connectPromise;

    expect(client.isConnected()).toBe(true);

    client.createRoom();
    const wsInstance = (client as unknown as { socket: MockWebSocket }).socket;
    expect(wsInstance.sentData).toContain(JSON.stringify({ type: 'create_room' }));

    client.joinRoom('ab12c');
    expect(wsInstance.sentData).toContain(JSON.stringify({ type: 'join_room', code: 'AB12C' }));

    const dummyInput: WsStepInput = {
      leftHeld: true,
      rightHeld: false,
      leftPressed: true,
      rightPressed: false,
      softDropHeld: false,
      hardDrop: false,
    };
    client.sendInput(dummyInput);
    expect(wsInstance.sentData).toContain(JSON.stringify({ type: 'player_input', input: dummyInput }));

    client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('despacha eventos del servidor a sus suscripciones correspondientes', async () => {
    const client = new OnlinePvPClient({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = client.connect();
    vi.runAllTimers();
    await connectPromise;

    const wsInstance = (client as unknown as { socket: MockWebSocket }).socket;

    const onRoomCreated = vi.fn();
    const onRoomJoined = vi.fn();
    const onRoomReady = vi.fn();
    const onBattleStarted = vi.fn();
    const onGameState = vi.fn();
    const onBattleEnded = vi.fn();
    const onPlayerDisconnected = vi.fn();
    const onError = vi.fn();

    client.onRoomCreated(onRoomCreated);
    client.onRoomJoined(onRoomJoined);
    client.onRoomReady(onRoomReady);
    client.onBattleStarted(onBattleStarted);
    client.onGameState(onGameState);
    client.onBattleEnded(onBattleEnded);
    client.onPlayerDisconnected(onPlayerDisconnected);
    client.onError(onError);

    wsInstance.receiveMessage({ type: 'room_created', code: 'AB12C', role: 'playerOne' });
    expect(onRoomCreated).toHaveBeenCalledWith({ type: 'room_created', code: 'AB12C', role: 'playerOne' });

    wsInstance.receiveMessage({ type: 'room_joined', code: 'AB12C', role: 'playerTwo' });
    expect(onRoomJoined).toHaveBeenCalledWith({ type: 'room_joined', code: 'AB12C', role: 'playerTwo' });

    wsInstance.receiveMessage({ type: 'room_ready', code: 'AB12C' });
    expect(onRoomReady).toHaveBeenCalledWith({ type: 'room_ready', code: 'AB12C' });

    wsInstance.receiveMessage({ type: 'battle_started', role: 'playerOne' });
    expect(onBattleStarted).toHaveBeenCalledWith({ type: 'battle_started', role: 'playerOne' });

    const dummyState = { type: 'game_state', step: 1, self: {}, opponent: {} };
    wsInstance.receiveMessage(dummyState);
    expect(onGameState).toHaveBeenCalledWith(dummyState);

    wsInstance.receiveMessage({ type: 'battle_ended', winner: 'playerOne', finalSnapshot: {} });
    expect(onBattleEnded).toHaveBeenCalledWith({ type: 'battle_ended', winner: 'playerOne', finalSnapshot: {} });

    wsInstance.receiveMessage({ type: 'player_disconnected', reason: 'opponent_left' });
    expect(onPlayerDisconnected).toHaveBeenCalledWith({ type: 'player_disconnected', reason: 'opponent_left' });

    wsInstance.receiveMessage({ type: 'error', code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada' });
    expect(onError).toHaveBeenCalledWith({ type: 'error', code: 'ROOM_NOT_FOUND', message: 'Sala no encontrada' });
  });

  it('no realiza reconexión automática tras la desconexión', async () => {
    const client = new OnlinePvPClient({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = client.connect();
    vi.runAllTimers();
    await connectPromise;

    client.disconnect();
    expect(client.isConnected()).toBe(false);

    vi.advanceTimersByTime(10000);
    expect(client.isConnected()).toBe(false);
  });

  it('notifica error INVALID_JSON y no rompe la app ante JSON inválido del servidor', async () => {
    const client = new OnlinePvPClient({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = client.connect();
    vi.runAllTimers();
    await connectPromise;

    const onError = vi.fn();
    client.onError(onError);

    const wsInstance = (client as unknown as { socket: MockWebSocket }).socket;
    wsInstance.dispatchEvent('message', { data: 'BAD_JSON{' });

    expect(onError).toHaveBeenCalledWith({
      type: 'error',
      code: 'INVALID_JSON',
      message: 'Mensaje JSON no válido recibido del servidor',
    });
  });

  it('destroy() desconecta el socket y limpia todos los listeners de forma segura', async () => {
    const client = new OnlinePvPClient({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const connectPromise = client.connect();
    vi.runAllTimers();
    await connectPromise;

    const onRoomCreated = vi.fn();
    client.onRoomCreated(onRoomCreated);

    const wsInstance = (client as unknown as { socket: MockWebSocket }).socket;
    client.destroy();
    expect(client.isConnected()).toBe(false);

    wsInstance.receiveMessage({ type: 'room_created', code: 'AB12C', role: 'playerOne' });
    expect(onRoomCreated).not.toHaveBeenCalled();
  });
});
