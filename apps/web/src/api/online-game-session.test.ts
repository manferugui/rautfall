import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { OnlineGameSession } from './online-game-session';
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

describe('OnlineGameSession (online-game-session.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('gestiona el ciclo de vida de la sesión (connecting -> waiting -> playing -> ended)', async () => {
    const session = new OnlineGameSession({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const statusHistory: string[] = [];
    session.onStatusChange((status: string) => statusHistory.push(status));

    const createPromise = session.createRoom();
    vi.runAllTimers();
    await createPromise;

    const wsInstance = ((session as unknown as { client: { socket: MockWebSocket } }).client.socket);
    wsInstance.receiveMessage({ type: 'room_created', code: 'AB12C', role: 'playerOne' });
    expect(session.roomCode).toBe('AB12C');
    expect(session.role).toBe('playerOne');
    expect(session.status).toBe('waiting');

    wsInstance.receiveMessage({ type: 'battle_started', role: 'playerOne' });
    expect(session.status).toBe('playing');

    wsInstance.receiveMessage({ type: 'battle_ended', winner: 'playerOne', finalSnapshot: {} });
    expect(session.status).toBe('ended');

    expect(statusHistory).toEqual(['connecting', 'waiting', 'playing', 'ended']);
  });

  it('transforma entrada física event-driven conservando el estado held acumulado (LEFT -> SOFT DROP -> SOFT DROP release)', async () => {
    const session = new OnlineGameSession({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const createPromise = session.createRoom();
    vi.runAllTimers();
    await createPromise;

    const wsInstance = ((session as unknown as { client: { socket: MockWebSocket } }).client.socket);
    wsInstance.receiveMessage({ type: 'battle_started', role: 'playerOne' });

    // Clear initial sent data (create_room)
    wsInstance.sentData = [];

    // 1. Physical keydown: moveLeft
    session.handleKeyDown('moveLeft');
    expect(wsInstance.sentData).toHaveLength(1);
    const msg1 = JSON.parse(wsInstance.sentData[0]!) as { type: string; input: WsStepInput };
    expect(msg1.input).toEqual(expect.objectContaining({
      leftHeld: true,
      rightHeld: false,
      softDropHeld: false,
      leftPressed: true,
      rightPressed: false,
    }));

    // 2. Physical keydown: softDrop (mientras moveLeft sigue held)
    session.handleKeyDown('softDrop');
    expect(wsInstance.sentData).toHaveLength(2);
    const msg2 = JSON.parse(wsInstance.sentData[1]!) as { type: string; input: WsStepInput };
    expect(msg2.input).toEqual(expect.objectContaining({
      leftHeld: true, // Queda held
      rightHeld: false,
      softDropHeld: true,
      leftPressed: false,
    }));

    // 3. Physical keyup: softDrop (se libera softDrop, moveLeft sigue held)
    session.handleKeyUp('softDrop');
    expect(wsInstance.sentData).toHaveLength(3);
    const msg3 = JSON.parse(wsInstance.sentData[2]!) as { type: string; input: WsStepInput };
    expect(msg3.input).toEqual(expect.objectContaining({
      leftHeld: true, // Queda held
      rightHeld: false,
      softDropHeld: false, // Liberado
      leftPressed: false,
      rightPressed: false,
    }));

    // 4. Physical oneshot: rotateClockwise
    session.handleKeyDown('rotateClockwise');
    expect(wsInstance.sentData).toHaveLength(4);
    const msg4 = JSON.parse(wsInstance.sentData[3]!) as { type: string; input: WsStepInput };
    expect(msg4.input).toEqual(expect.objectContaining({
      leftHeld: true,
      rotateClockwise: true,
      hardDrop: false,
      hold: false,
    }));

    // 5. Blur event: limpia todo el estado sostenido a neutro
    session.handleBlur();
    expect(wsInstance.sentData).toHaveLength(5);
    const msg5 = JSON.parse(wsInstance.sentData[4]!) as { type: string; input: WsStepInput };
    expect(msg5.input).toEqual({
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
    });
  });

  it('destruye la sesión de forma idempotente limpiando suscripciones y socket', async () => {
    const session = new OnlineGameSession({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const createPromise = session.createRoom();
    vi.runAllTimers();
    await createPromise;

    const onGameState = vi.fn();
    session.onGameState(onGameState);

    session.destroy();
    expect(session.status).toBe('ended');

    // Múltiples destrucciones no causan excepciones
    expect(() => session.destroy()).not.toThrow();
  });

  it('al fallar la conexión WebSocket en createRoom(), establece el estado en error y notifica lastError', async () => {
    class FailingWebSocket {
      public static OPEN = 1;
      public static CLOSED = 3;
      public static CONNECTING = 0;
      public readyState = FailingWebSocket.CONNECTING;
      public url: string;
      private listeners: Record<string, Array<(event: unknown) => void>> = {};

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = FailingWebSocket.CLOSED;
          this.dispatchEvent('error', new Event('error'));
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

      public send(): void {}
      public close(): void {}

      public dispatchEvent(type: string, event: unknown): void {
        if (this.listeners[type]) {
          this.listeners[type].forEach((cb) => cb(event));
        }
      }
    }

    const session = new OnlineGameSession({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: FailingWebSocket as unknown as typeof WebSocket,
    });

    const statusHistory: string[] = [];
    session.onStatusChange((status: string) => statusHistory.push(status));

    const createPromise = session.createRoom();
    vi.runAllTimers();
    await createPromise;

    expect(session.status).toBe('error');
    expect(session.lastError).toEqual(
      expect.objectContaining({
        code: 'CONNECTION_FAILED',
      })
    );
    expect(statusHistory).toEqual(['connecting', 'error']);
  });

  it('envía toggle_pause al servidor y neutraliza heldState local únicamente al recibir game_state con status: paused', async () => {
    const session = new OnlineGameSession({
      url: 'ws://localhost:3000/ws/rooms',
      WebSocketClass: MockWebSocket as unknown as typeof WebSocket,
    });

    const createPromise = session.createRoom();
    vi.runAllTimers();
    await createPromise;

    const wsInstance = ((session as unknown as { client: { socket: MockWebSocket } }).client.socket);
    wsInstance.receiveMessage({ type: 'room_created', code: 'AB12C', role: 'playerOne' });
    wsInstance.receiveMessage({ type: 'battle_started', role: 'playerOne' });

    // Simular input retenido (heldState)
    session.handleKeyDown('moveLeft');
    expect(session.getHeldState()).toEqual({ leftHeld: true, rightHeld: false, softDropHeld: false });

    // Invocar togglePause: envía el mensaje pero NO neutraliza heldState local prematuramente
    session.togglePause();
    expect(wsInstance.sentData).toContain(JSON.stringify({ type: 'toggle_pause' }));
    expect(session.getHeldState()).toEqual({ leftHeld: true, rightHeld: false, softDropHeld: false });

    // Al recibir la confirmación autoritativa game_state con status: 'paused', neutraliza heldState
    wsInstance.receiveMessage({
      type: 'game_state',
      step: 10,
      elapsedMs: 100,
      status: 'paused',
      winner: null,
      suddenDeath: { phase: 'none', warningRemainingMs: 0, activeElapsedMs: 0, gravityMultiplier: 1, energyMultiplier: 1 },
      self: { step: 10, elapsedMs: 100, status: 'running', board: [], activePiece: null, nextPieces: [], clearedLines: 0, heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 1 },
      opponent: { step: 10, elapsedMs: 100, status: 'running', board: [], activePiece: null, nextPieces: [], clearedLines: 0, heldPiece: null, score: 0, combo: 0, backToBack: 0, combatEnergy: 0, storedSabotages: [], pendingGarbage: 0, activeEffects: [], level: 1 },
      selfState: { warnings: [], immunities: [], activeEffects: [], isInterfered: false, interferenciaRemainingMs: 0 },
      opponentState: { warnings: [], immunities: [], activeEffects: [], isInterfered: false, interferenciaRemainingMs: 0 },
      events: [],
    });

    expect(session.status).toBe('playing'); // Mantiene lifecycle de sesión en 'playing'
    expect(session.getHeldState()).toEqual({ leftHeld: false, rightHeld: false, softDropHeld: false }); // Held state neutralizado
  });
});
