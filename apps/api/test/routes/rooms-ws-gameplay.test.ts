import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { buildApp } from '../../src/app.js';
import type { GameRuntimeRegistry } from '../../src/rooms/index.js';
import type { ServerWsMessage } from '@rautfall/contracts';
import type { AppDatabase } from '../../src/db/index.js';
import type { MatchesRepository } from '../../src/repositories/matches-repository.js';

describe('Rutas WebSocket para gameplay PvP autoritativo (/ws/rooms)', () => {
  let fastify: FastifyInstance;
  let gameRuntimeRegistry: GameRuntimeRegistry;
  let serverAddress: string;
  let closeApp: () => Promise<void>;

  beforeAll(async () => {
    const dummyDb = {} as AppDatabase;
    const dummyRepo = {} as MatchesRepository;

    const appObj = buildApp({
      env: {
        NODE_ENV: 'test',
        PORT: 0,
        HOST: '127.0.0.1',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/test',
        CORS_ORIGIN: 'http://localhost:5173',
      },
      db: dummyDb,
      matchesRepository: dummyRepo,
    });

    fastify = appObj.fastify;
    gameRuntimeRegistry = appObj.gameRuntimeRegistry;
    closeApp = appObj.close;

    await fastify.ready();
    const address = await fastify.listen({ port: 0, host: '127.0.0.1' });
    serverAddress = address.replace('http://', 'ws://') + '/ws/rooms';
  });

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
  });

  function connectWs(): Promise<{
    client: WebSocket;
    messages: ServerWsMessage[];
    nextMessage: () => Promise<ServerWsMessage>;
  }> {
    return new Promise((resolve, reject) => {
      const client = new WebSocket(serverAddress);
      const messages: ServerWsMessage[] = [];
      const waiters: Array<(msg: ServerWsMessage) => void> = [];

      client.on('open', () => {
        resolve({
          client,
          messages,
          nextMessage: () => {
            if (messages.length > 0) {
              return Promise.resolve(messages.shift()!);
            }
            return new Promise<ServerWsMessage>((res) => {
              waiters.push(res);
            });
          },
        });
      });

      client.on('message', (data: unknown) => {
        const str = data instanceof Buffer ? data.toString('utf-8') : String(data);
        const parsed = JSON.parse(str) as ServerWsMessage;
        if (waiters.length > 0) {
          const waiter = waiters.shift()!;
          waiter(parsed);
        } else {
          messages.push(parsed);
        }
      });

      client.on('error', (err) => {
        reject(err);
      });
    });
  }

  it('al estar ambos jugadores unidos, emite room_ready, battle_started e inicia broadcasts de game_state', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    expect(createMsg).toEqual({
      type: 'room_created',
      code: expect.any(String),
      role: 'playerOne',
    });
    const code = (createMsg as Extract<ServerWsMessage, { type: 'room_created' }>).code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));

    const p2Joined = await p2.nextMessage();
    expect(p2Joined).toEqual({
      type: 'room_joined',
      code,
      role: 'playerTwo',
    });

    const p1Ready = await p1.nextMessage();
    expect(p1Ready).toEqual({ type: 'room_ready', code });

    const p2Ready = await p2.nextMessage();
    expect(p2Ready).toEqual({ type: 'room_ready', code });

    const p1Started = await p1.nextMessage();
    expect(p1Started).toEqual({ type: 'battle_started', role: 'playerOne' });

    const p2Started = await p2.nextMessage();
    expect(p2Started).toEqual({ type: 'battle_started', role: 'playerTwo' });

    // Verificar que el runtime se creó e inició en la registry
    const runtime = gameRuntimeRegistry.get(code);
    expect(runtime).toBeDefined();
    expect(runtime?.getIsRunning()).toBe(true);

    // Enviar un input desde P1 y P2
    p1.client.send(
      JSON.stringify({
        type: 'player_input',
        input: {
          leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false,
          softDropHeld: false, hardDrop: false,
        },
      }),
    );

    p2.client.send(
      JSON.stringify({
        type: 'player_input',
        input: {
          leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
          softDropHeld: true, hardDrop: false,
        },
      }),
    );

    // Esperar mensaje game_state de broadcast a P1 (el estado 0 síncrono inicial)
    const p1GameState = await p1.nextMessage();
    expect(p1GameState.type).toBe('game_state');
    if (p1GameState.type === 'game_state') {
      expect(p1GameState.step).toBeGreaterThanOrEqual(0);
      expect(p1GameState.self).toBeDefined();
      expect(p1GameState.opponent).toBeDefined();
      expect(p1GameState.selfState).toBeDefined();
      expect(p1GameState.opponentState).toBeDefined();
    }

    p1.client.close();
    p2.client.close();
  });

  it('detiene el runtime al desconectarse un jugador e informa al oponente', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    const code = (createMsg as Extract<ServerWsMessage, { type: 'room_created' }>).code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));

    await p2.nextMessage(); // room_joined
    await p1.nextMessage(); // room_ready
    await p2.nextMessage(); // room_ready
    await p1.nextMessage(); // battle_started
    await p2.nextMessage(); // battle_started

    const runtime = gameRuntimeRegistry.get(code);
    expect(runtime?.getIsRunning()).toBe(true);

    // Desconectar P1
    p1.client.close();

    const p2Disc = await p2.nextMessage();
    // P2 puede recibir game_state justo antes de player_disconnected o directamente player_disconnected
    let discMsg = p2Disc;
    while (discMsg.type === 'game_state') {
      discMsg = await p2.nextMessage();
    }

    expect(discMsg).toEqual({
      type: 'player_disconnected',
      reason: 'opponent_left',
    });

    // Verificar que el runtime se detuvo y se eliminó de la registry
    expect(gameRuntimeRegistry.get(code)).toBeUndefined();

    p2.client.close();
  });
});
