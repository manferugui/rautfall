import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBattleSession,
  type BattleEvent,
} from '@rautfall/battle-engine';
import { prototypeConfig } from '@rautfall/game-config';
import {
  RoomGameRuntime,
  consumeNextStepInput,
  filterEventsForParticipant,
  createGameRuntimeRegistry,
  type HeldState,
  type OneshotAction,
} from '../../src/rooms/index.js';
import type { ServerWsMessage } from '@rautfall/contracts';

describe('RoomGameRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createTestSession() {
    return createBattleSession({
      seed: 12345,
      config: prototypeConfig,
    });
  }

  describe('consumeNextStepInput', () => {
    it('mantiene el estado held sostenido y no consume oneshots si la cola está vacía', () => {
      const held: HeldState = { leftHeld: true, rightHeld: false, softDropHeld: true };
      const queue: OneshotAction[] = [];

      const input = consumeNextStepInput(held, queue);

      expect(input.leftHeld).toBe(true);
      expect(input.rightHeld).toBe(false);
      expect(input.softDropHeld).toBe(true);
      expect(input.leftPressed).toBe(false);
      expect(input.rightPressed).toBe(false);
      expect(input.hardDrop).toBe(false);
      expect(input.rotateClockwise).toBeUndefined();
    });

    it('desencola exactamente una acción oneshot por llamada (máximo 1 oneshot por step)', () => {
      const held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };
      const queue: OneshotAction[] = ['rotateClockwise', 'hardDrop', 'hold'];

      const step1Input = consumeNextStepInput(held, queue);
      expect(step1Input.rotateClockwise).toBe(true);
      expect(step1Input.hardDrop).toBe(false);
      expect(step1Input.hold).toBeUndefined();
      expect(queue).toEqual(['hardDrop', 'hold']);

      const step2Input = consumeNextStepInput(held, queue);
      expect(step2Input.rotateClockwise).toBeUndefined();
      expect(step2Input.hardDrop).toBe(true);
      expect(step2Input.hold).toBeUndefined();
      expect(queue).toEqual(['hold']);

      const step3Input = consumeNextStepInput(held, queue);
      expect(step3Input.hold).toBe(true);
      expect(queue).toEqual([]);
    });

    it('ejecuta dos rotaciones rápidas en dos steps consecutivos de 10ms manteniendo multiplicidad', () => {
      const held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };
      const queue: OneshotAction[] = ['rotateClockwise', 'rotateClockwise'];

      const step1Input = consumeNextStepInput(held, queue);
      expect(step1Input.rotateClockwise).toBe(true);
      expect(queue).toEqual(['rotateClockwise']);

      const step2Input = consumeNextStepInput(held, queue);
      expect(step2Input.rotateClockwise).toBe(true);
      expect(queue).toEqual([]);
    });

    it('rotate y hardDrop pendientes en la cola nunca se ejecutan en el mismo step de 10ms', () => {
      const held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };
      const queue: OneshotAction[] = ['rotateClockwise', 'hardDrop'];

      const step1Input = consumeNextStepInput(held, queue);
      expect(step1Input.rotateClockwise).toBe(true);
      expect(step1Input.hardDrop).toBe(false);

      const step2Input = consumeNextStepInput(held, queue);
      expect(step2Input.hardDrop).toBe(true);
      expect(step2Input.rotateClockwise).toBeUndefined();
    });

    it('elimina de la cola leftPressed o rightPressed si held correspondiente ha pasado a false', () => {
      const held: HeldState = { leftHeld: false, rightHeld: false, softDropHeld: false };
      const queue: OneshotAction[] = ['leftPressed', 'rotateClockwise'];

      const stepInput = consumeNextStepInput(held, queue);
      expect(stepInput.leftPressed).toBe(false);
      expect(stepInput.rotateClockwise).toBe(true);
      expect(queue).toEqual([]);
    });

    it('limita la cola de oneshots pendientes a MAX_PENDING_ONESHOTS (32)', () => {
      const battle = createTestSession();
      const runtime = new RoomGameRuntime('LIMIT1', battle, () => {});

      for (let i = 0; i < 40; i++) {
        runtime.enqueueInput('playerOne', {
          leftHeld: false, rightHeld: false, softDropHeld: false,
          leftPressed: false, rightPressed: false, hardDrop: true,
        });
      }

      expect(runtime.getPendingQueue('playerOne').length).toBe(32);
    });
  });

  describe('filterEventsForParticipant', () => {
    it('no filtra nada si el jugador no está interferido', () => {
      const events: BattleEvent[] = [
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceMoved', step: 1, reason: 'horizontal' } },
        { type: 'sabotageRouted', step: 1, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' },
      ];

      const filtered = filterEventsForParticipant(events, 'playerOne', false);
      expect(filtered).toHaveLength(2);
    });

    it('oculta eventos visuales de pieza (movimiento, spawn, rotación, lock y hold) del rival si el jugador está interferido', () => {
      const events: BattleEvent[] = [
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceMoved', step: 1, reason: 'horizontal' } },
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceSpawned', step: 1, piece: 'I' } },
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceRotated', step: 1, orientation: 1 } },
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceLocked', step: 1, piece: 'I' } },
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'pieceHeld', step: 1, piece: 'O' } },
        { type: 'participantEvent', step: 1, participant: 'playerTwo', event: { type: 'linesCleared', step: 1, lines: 2, lineIndices: [0, 1] } },
        { type: 'sabotageRouted', step: 1, source: 'playerTwo', target: 'playerOne', sabotage: 'interferencia' },
      ];

      const filtered = filterEventsForParticipant(events, 'playerOne', true);
      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual({
        type: 'participantEvent',
        step: 1,
        participant: 'playerTwo',
        event: { type: 'linesCleared', step: 1, lines: 2, lineIndices: [0, 1] },
      });
      expect(filtered[1]).toEqual({
        type: 'sabotageRouted',
        step: 1,
        source: 'playerTwo',
        target: 'playerOne',
        sabotage: 'interferencia',
      });
    });
  });

  describe('RoomGameRuntime lifecycle y tick', () => {
    it('emite el game_state inicial de forma síncrona al arrancar', () => {
      const battle = createTestSession();
      const broadcastMessages: { recipient: string; msg: ServerWsMessage }[] = [];

      const runtime = new RoomGameRuntime('TEST_INIT', battle, (recipient, msg) => {
        broadcastMessages.push({ recipient, msg });
      });

      runtime.start();
      // Transmite inmediatamente el game_state inicial (step 0) a ambos jugadores
      expect(broadcastMessages).toHaveLength(2);
      expect(broadcastMessages[0]!.msg.type).toBe('game_state');
      expect((broadcastMessages[0]!.msg as unknown as { step: number }).step).toBe(0);

      runtime.stop();
    });

    it('inicia el bucle y ejecuta steps autoritativos al avanzar el tiempo', () => {
      const battle = createTestSession();
      const broadcastMessages: { recipient: string; msg: ServerWsMessage }[] = [];

      const runtime = new RoomGameRuntime('TEST1', battle, (recipient, msg) => {
        broadcastMessages.push({ recipient, msg });
      });

      runtime.start();
      expect(runtime.getIsRunning()).toBe(true);

      // Avanzar 50ms para disparar el tick y el primer broadcast (20 Hz)
      vi.advanceTimersByTime(50);

      expect(broadcastMessages.length).toBeGreaterThan(0);
      const gameState = broadcastMessages.find((m) => m.msg.type === 'game_state')?.msg;
      expect(gameState).toBeDefined();
      if (gameState?.type === 'game_state') {
        expect(gameState.step).toBeGreaterThanOrEqual(0);
        expect(gameState.status).toBe('running');
      }

      runtime.stop();
      expect(runtime.getIsRunning()).toBe(false);
    });

    it('detiene el runtime y emite battle_ended al finalizar la partida por game over', () => {
      const battle = createTestSession();
      const broadcastMessages: { recipient: string; msg: ServerWsMessage }[] = [];

      const runtime = new RoomGameRuntime('TEST2', battle, (recipient, msg) => {
        broadcastMessages.push({ recipient, msg });
      });

      runtime.start();

      // Forzar game over ejecutando steps a través de runtime.enqueueInput y stepLoop
      for (let i = 0; i < 50; i++) {
        runtime.enqueueInput('playerOne', {
          leftHeld: false, rightHeld: false, softDropHeld: false,
          leftPressed: false, rightPressed: false, hardDrop: true,
        });
        // Avanzar el acumulador manualmente 10ms en cada iteración
        (runtime as unknown as { accumulator: number }).accumulator += 10;
        runtime.stepLoop();
        if (!runtime.getIsRunning()) break;
      }

      const endedMsg = broadcastMessages.find((m) => m.msg.type === 'battle_ended');
      expect(endedMsg).toBeDefined();
      expect(runtime.getIsRunning()).toBe(false);
    });

    it('solo permite reanudar la partida al jugador que la pausó originalmente (P1 y P2)', () => {
      const battle = createTestSession();
      const broadcastMessages: { recipient: string; msg: ServerWsMessage }[] = [];

      const runtime = new RoomGameRuntime('TEST_PAUSE', battle, (recipient, msg) => {
        broadcastMessages.push({ recipient, msg });
      });

      runtime.start();
      expect(runtime.getIsPaused()).toBe(false);
      expect(runtime.getPausedBy()).toBeNull();

      // P1 encola input y pausa la partida
      runtime.enqueueInput('playerOne', {
        leftHeld: true, rightHeld: false, softDropHeld: false,
        leftPressed: true, rightPressed: false, hardDrop: false,
      });
      expect(runtime.getPendingQueue('playerOne').length).toBe(1);

      const pauseResult = runtime.togglePause('playerOne');
      expect(pauseResult).toBe(true);
      expect(runtime.getIsPaused()).toBe(true);
      expect(runtime.getPausedBy()).toBe('playerOne');
      expect(runtime.getPendingQueue('playerOne').length).toBe(0);

      // P2 intenta reanudar -> DEBE SER IGNORADO
      const p2ResumeAttempt = runtime.togglePause('playerTwo');
      expect(p2ResumeAttempt).toBe(false);
      expect(runtime.getIsPaused()).toBe(true);
      expect(runtime.getPausedBy()).toBe('playerOne');

      // P1 reanuda -> EXITO
      const p1ResumeResult = runtime.togglePause('playerOne');
      expect(p1ResumeResult).toBe(false);
      expect(runtime.getIsPaused()).toBe(false);
      expect(runtime.getPausedBy()).toBeNull();

      // Ahora P2 pausa la partida -> EXITO
      const p2PauseResult = runtime.togglePause('playerTwo');
      expect(p2PauseResult).toBe(true);
      expect(runtime.getIsPaused()).toBe(true);
      expect(runtime.getPausedBy()).toBe('playerTwo');

      // P1 intenta reanudar -> DEBE SER IGNORADO
      const p1ResumeAttempt = runtime.togglePause('playerOne');
      expect(p1ResumeAttempt).toBe(false);
      expect(runtime.getIsPaused()).toBe(true);
      expect(runtime.getPausedBy()).toBe('playerTwo');

      // P2 reanuda -> EXITO
      const p2ResumeResult = runtime.togglePause('playerTwo');
      expect(p2ResumeResult).toBe(false);
      expect(runtime.getIsPaused()).toBe(false);
      expect(runtime.getPausedBy()).toBeNull();

      runtime.stop();
    });
  });

  describe('GameRuntimeRegistry', () => {
    it('crea, recupera y detiene runtimes de forma independiente a PvPRoom', () => {
      const registry = createGameRuntimeRegistry();
      const battle = createTestSession();

      const runtime = registry.create('ROOM1', battle, () => {});
      expect(registry.get('ROOM1')).toBe(runtime);

      registry.stopAndRemove('ROOM1');
      expect(registry.get('ROOM1')).toBeUndefined();
      expect(runtime.getIsRunning()).toBe(false);
    });
  });
});
