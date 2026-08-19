import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { buildApp } from '../../src/app.js';
import type { RoomManager } from '../../src/rooms/index.js';
import type { ServerWsMessage } from '@rautfall/contracts';
import type { AppDatabase } from '../../src/db/index.js';
import type { MatchesRepository } from '../../src/repositories/matches-repository.js';

describe('Rutas WebSocket para salas privadas PvP (/ws/rooms)', () => {
  let fastify: FastifyInstance;
  let roomManager: RoomManager;
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
    roomManager = appObj.roomManager;
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

      client.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString('utf-8')) as ServerWsMessage;
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

  it('permite abrir una conexión WebSocket correctamente', async () => {
    const { client } = await connectWs();
    expect(client.readyState).toBe(WebSocket.OPEN);
    client.close();
  });

  it('permite a P1 crear una sala y recibe código de 5 caracteres', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));

    const msg = await p1.nextMessage();
    expect(msg).toEqual({
      type: 'room_created',
      code: expect.stringMatching(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/),
      role: 'playerOne',
    });

    if (msg.type === 'room_created') {
      const room = roomManager.getRoom(msg.code);
      expect(room).toBeDefined();
      expect(room?.status).toBe('waiting_for_player');
    }

    p1.client.close();
  });

  it('permite a P2 unirse con el código y notifica ready a ambos', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));

    const createMsg = await p1.nextMessage();
    expect(createMsg.type).toBe('room_created');
    if (createMsg.type !== 'room_created') return;

    const code = createMsg.code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));

    const joinMsg = await p2.nextMessage();
    expect(joinMsg).toEqual({
      type: 'room_joined',
      code,
      role: 'playerTwo',
    });

    const p1ReadyMsg = await p1.nextMessage();
    expect(p1ReadyMsg).toEqual({
      type: 'room_ready',
      code,
    });

    const p2ReadyMsg = await p2.nextMessage();
    expect(p2ReadyMsg).toEqual({
      type: 'room_ready',
      code,
    });

    const room = roomManager.getRoom(code);
    expect(room?.status).toBe('ready');
    expect(room?.battleSession).toBeDefined();

    p1.client.close();
    p2.client.close();
  });

  it('devuelve error ROOM_NOT_FOUND al intentar unirse a un código inexistente', async () => {
    const p = await connectWs();
    p.client.send(JSON.stringify({ type: 'join_room', code: 'XXXXX' }));

    const msg = await p.nextMessage();
    expect(msg).toEqual({
      type: 'error',
      code: 'ROOM_NOT_FOUND',
      message: expect.stringContaining("Room with code 'XXXXX' was not found."),
    });

    p.client.close();
  });

  it('devuelve error ROOM_NOT_WAITING al intentar unirse a una sala que ya está ready', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    if (createMsg.type !== 'room_created') return;
    const code = createMsg.code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));
    await p2.nextMessage(); // room_joined

    const p3 = await connectWs();
    p3.client.send(JSON.stringify({ type: 'join_room', code }));

    const errorMsg = await p3.nextMessage();
    expect(errorMsg).toEqual({
      type: 'error',
      code: 'ROOM_NOT_WAITING',
      message: expect.stringContaining('Cannot join room'),
    });

    p1.client.close();
    p2.client.close();
    p3.client.close();
  });

  it('devuelve error ALREADY_IN_ROOM si la conexión intenta crear o unirse a otra sala', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    await p1.nextMessage(); // room_created

    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const errorMsg = await p1.nextMessage();
    expect(errorMsg).toEqual({
      type: 'error',
      code: 'ALREADY_IN_ROOM',
      message: 'Connection is already associated with a room.',
    });

    p1.client.close();
  });

  it('devuelve error INVALID_JSON ante un payload no parseable', async () => {
    const p = await connectWs();
    p.client.send('invalid-json-content');

    const errorMsg = await p.nextMessage();
    expect(errorMsg).toEqual({
      type: 'error',
      code: 'INVALID_JSON',
      message: 'Failed to parse WebSocket message as valid JSON.',
    });

    p.client.close();
  });

  it('devuelve error BAD_REQUEST ante un mensaje que no cumple el contrato', async () => {
    const p = await connectWs();
    p.client.send(JSON.stringify({ type: 'unknown_type' }));

    const errorMsg = await p.nextMessage();
    expect(errorMsg).toEqual({
      type: 'error',
      code: 'BAD_REQUEST',
      message: 'WebSocket message payload does not match contract schema.',
    });

    p.client.close();
  });

  it('mantiene aislamiento completo entre dos salas distintas', async () => {
    const p1A = await connectWs();
    p1A.client.send(JSON.stringify({ type: 'create_room' }));
    const createA = await p1A.nextMessage();
    if (createA.type !== 'room_created') return;

    const p1B = await connectWs();
    p1B.client.send(JSON.stringify({ type: 'create_room' }));
    const createB = await p1B.nextMessage();
    if (createB.type !== 'room_created') return;

    expect(createA.code).not.toBe(createB.code);

    const p2A = await connectWs();
    p2A.client.send(JSON.stringify({ type: 'join_room', code: createA.code }));
    await p2A.nextMessage(); // room_joined

    const readyA = await p1A.nextMessage();
    expect(readyA).toEqual({ type: 'room_ready', code: createA.code });

    // p1B no debe haber recibido ninguna notificación de ready de la sala A
    expect(p1B.messages.length).toBe(0);

    p1A.client.close();
    p1B.client.close();
    p2A.client.close();
  });

  it('notifica player_disconnected al oponente y destruye la sala al cerrarse la conexión', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    if (createMsg.type !== 'room_created') return;
    const code = createMsg.code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));
    await p2.nextMessage(); // room_joined
    await p1.nextMessage(); // room_ready
    await p2.nextMessage(); // room_ready
    await p1.nextMessage(); // battle_started
    await p2.nextMessage(); // battle_started

    // P1 se desconecta
    p1.client.close();

    let disconnectMsg = await p2.nextMessage();
    while (disconnectMsg.type === 'game_state') {
      disconnectMsg = await p2.nextMessage();
    }
    expect(disconnectMsg).toEqual({
      type: 'player_disconnected',
      reason: 'opponent_left',
    });

    // Verificar que la sala fue eliminada de RoomManager
    expect(roomManager.getRoom(code)).toBeUndefined();

    p2.client.close();
  });

  it('libera la conexión del oponente (P2) permitiéndole crear una nueva sala tras la desconexión de P1', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    if (createMsg.type !== 'room_created') return;
    const code = createMsg.code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));
    await p2.nextMessage(); // room_joined
    await p1.nextMessage(); // room_ready
    await p2.nextMessage(); // room_ready
    await p1.nextMessage(); // battle_started
    await p2.nextMessage(); // battle_started

    // P1 se desconecta
    p1.client.close();
    let disconnectMsg = await p2.nextMessage();
    while (disconnectMsg.type === 'game_state') {
      disconnectMsg = await p2.nextMessage();
    }
    expect(disconnectMsg).toEqual({
      type: 'player_disconnected',
      reason: 'opponent_left',
    });

    // P2 debe estar liberado y poder crear una nueva sala en su misma conexión WebSocket
    p2.client.send(JSON.stringify({ type: 'create_room' }));
    const newCreateMsg = await p2.nextMessage();

    expect(newCreateMsg).toEqual({
      type: 'room_created',
      code: expect.stringMatching(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/),
      role: 'playerOne',
    });

    p2.client.close();
  });

  it('libera la conexión del oponente (P1) permitiéndole crear una nueva sala tras la desconexión de P2', async () => {
    const p1 = await connectWs();
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const createMsg = await p1.nextMessage();
    if (createMsg.type !== 'room_created') return;
    const code = createMsg.code;

    const p2 = await connectWs();
    p2.client.send(JSON.stringify({ type: 'join_room', code }));
    await p2.nextMessage(); // room_joined
    await p1.nextMessage(); // room_ready
    await p2.nextMessage(); // room_ready
    await p1.nextMessage(); // battle_started
    await p2.nextMessage(); // battle_started

    // P2 se desconecta
    p2.client.close();
    let disconnectMsg = await p1.nextMessage();
    while (disconnectMsg.type === 'game_state') {
      disconnectMsg = await p1.nextMessage();
    }
    expect(disconnectMsg).toEqual({
      type: 'player_disconnected',
      reason: 'opponent_left',
    });

    // P1 debe estar liberado y poder crear una nueva sala en su misma conexión WebSocket
    p1.client.send(JSON.stringify({ type: 'create_room' }));
    const newCreateMsg = await p1.nextMessage();

    expect(newCreateMsg).toEqual({
      type: 'room_created',
      code: expect.stringMatching(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/),
      role: 'playerOne',
    });

    p1.client.close();
  });
});
