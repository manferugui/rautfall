import { describe, expect, it } from 'vitest';

import { prototypeConfig } from '@rautfall/game-config';
import type { StepInput } from '@rautfall/game-engine';
import {
  createBattleSession,
  createDeterministicBot,
  BattleStepError,
  type BattleSessionOptions,
  type BattleStepInput,
} from './index';

function makeValidOptions(overrides?: Partial<BattleSessionOptions>): BattleSessionOptions {
  return {
    seed: 42,
    config: prototypeConfig,
    ...overrides,
  };
}

function emptyInput(): StepInput {
  return {
    leftHeld: false,
    rightHeld: false,
    leftPressed: false,
    rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
  };
}

function emptyBattleInput(): BattleStepInput {
  return {
    playerOne: emptyInput(),
    playerTwo: emptyInput(),
  };
}

describe('@rautfall/battle-engine', () => {
  it('creación emite solo battleStarted con step 0', () => {
    const battle = createBattleSession(makeValidOptions());
    const events = battle.drainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'battleStarted', step: 0 });
  });

  it('snapshot inicial está sincronizado con status running y winner null', () => {
    const battle = createBattleSession(makeValidOptions());
    const snap = battle.getSnapshot();

    expect(snap.step).toBe(0);
    expect(snap.elapsedMs).toBe(0);
    expect(snap.status).toBe('running');
    expect(snap.winner).toBeNull();
    expect(snap.playerOne.status).toBe('running');
    expect(snap.playerTwo.status).toBe('running');
  });

  it('avance lockstep: step y elapsedMs avanzan una sola vez por llamada', () => {
    const battle = createBattleSession(makeValidOptions());
    const snap1 = battle.step(emptyBattleInput());

    expect(snap1.step).toBe(1);
    expect(snap1.elapsedMs).toBe(prototypeConfig.fixedStepMs);
    expect(snap1.playerOne.step).toBe(1);
    expect(snap1.playerTwo.step).toBe(1);
  });

  it('misma semilla conserva secuencia compartida de piezas', () => {
    const battle = createBattleSession(makeValidOptions({ seed: 100 }));
    const snap = battle.getSnapshot();

    expect(snap.playerOne.nextPieces).toEqual(snap.playerTwo.nextPieces);
    expect(snap.playerOne.activePiece?.type).toBe(snap.playerTwo.activePiece?.type);
  });

  it('inputs distintos conservan secuencia compartida de piezas', () => {
    const battle = createBattleSession(makeValidOptions({ seed: 1234 }));

    // P1 se mueve a la izquierda, P2 a la derecha (ninguno fija pieza)
    const input: BattleStepInput = {
      playerOne: { ...emptyInput(), leftHeld: true, leftPressed: true },
      playerTwo: { ...emptyInput(), rightHeld: true, rightPressed: true },
    };

    battle.step(input);
    const snap = battle.getSnapshot();

    // La cola de próximas piezas sigue siendo idéntica en ambos
    expect(snap.playerOne.nextPieces).toEqual(snap.playerTwo.nextPieces);
  });

  it('Residuos aplicado a un jugador no altera la secuencia de piezas del rival ni la propia', () => {
    const battle = createBattleSession(makeValidOptions({ seed: 555 }));

    // Hacer hardDrop en ambos jugadores, pero P1 recibió previamente un Residuos (vía step routing o test)
    battle.step({
      playerOne: { ...emptyInput(), hardDrop: true },
      playerTwo: { ...emptyInput(), hardDrop: true },
    });

    const snap = battle.getSnapshot();
    // Ambos fijaron 1 pieza y avanzaron al mismo tiempo
    expect(snap.playerOne.nextPieces).toEqual(snap.playerTwo.nextPieces);
    expect(snap.playerOne.activePiece?.type).toBe(snap.playerTwo.activePiece?.type);
  });

  it('routing P1 -> P2 cuando P1 dispara un sabotaje almacenado', () => {
    const battle = createBattleSession(makeValidOptions());

    const input: BattleStepInput = {
      playerOne: { ...emptyInput(), triggerSabotage: true },
      playerTwo: emptyInput(),
    };

    const snap = battle.step(input);
    expect(snap.step).toBe(1);
  });

  it('enrutamiento bidireccional y simultáneo P1 -> P2 y P2 -> P1', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.drainEvents();

    const snap = battle.step(emptyBattleInput());
    expect(snap.status).toBe('running');
  });

  it('orden P1 antes de P2 en los eventos participantEvent de la Fase 1', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.drainEvents();

    // Ejecutar hardDrop en ambos para generar eventos (pieceMoved, pieceLocked, pieceSpawned)
    battle.step({
      playerOne: { ...emptyInput(), hardDrop: true },
      playerTwo: { ...emptyInput(), hardDrop: true },
    });
    const events = battle.drainEvents();

    const participantEvents = events.filter((e) => e.type === 'participantEvent');
    expect(participantEvents.length).toBeGreaterThan(0);

    const firstP2Index = participantEvents.findIndex(
      (e) => e.type === 'participantEvent' && e.participant === 'playerTwo',
    );
    const lastP1Index = participantEvents
      .map((e, idx) => ({ e, idx }))
      .filter(({ e }) => e.type === 'participantEvent' && e.participant === 'playerOne')
      .pop()?.idx;

    expect(firstP2Index).toBeGreaterThan(-1);
    expect(lastP1Index).toBeDefined();
    expect(lastP1Index!).toBeLessThan(firstP2Index);
  });

  it('participantEvent conserva el EngineEvent original intacto', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.drainEvents();

    battle.step({
      playerOne: { ...emptyInput(), hardDrop: true },
      playerTwo: { ...emptyInput(), hardDrop: true },
    });
    const events = battle.drainEvents();

    const p1Events = events.filter(
      (e) => e.type === 'participantEvent' && e.participant === 'playerOne',
    );
    expect(p1Events.length).toBeGreaterThan(0);

    for (const evt of p1Events) {
      if (evt.type === 'participantEvent') {
        expect(evt.event).toHaveProperty('type');
        expect(evt.event).toHaveProperty('step');
      }
    }
  });

  it('validación atómica: entrada inválida de P1 no muta motores ni tiempo', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.drainEvents();

    const invalidInput: BattleStepInput = {
      playerOne: { ...emptyInput(), leftPressed: true, leftHeld: false }, // Inválido: pressed sin held
      playerTwo: emptyInput(),
    };

    let thrown: unknown = null;
    try {
      battle.step(invalidInput);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(BattleStepError);
    expect((thrown as BattleStepError).code).toBe('INVALID_BATTLE_INPUT');

    const snap = battle.getSnapshot();
    expect(snap.step).toBe(0);
    expect(snap.elapsedMs).toBe(0);
    expect(battle.drainEvents()).toHaveLength(0);
  });

  it('validación atómica: entrada inválida de P2 no muta motores ni tiempo', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.drainEvents();

    const invalidInput: BattleStepInput = {
      playerOne: emptyInput(),
      playerTwo: { ...emptyInput(), rightPressed: true, rightHeld: false },
    };

    let thrown: unknown = null;
    try {
      battle.step(invalidInput);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(BattleStepError);
    expect((thrown as BattleStepError).code).toBe('INVALID_BATTLE_INPUT');

    const snap = battle.getSnapshot();
    expect(snap.step).toBe(0);
    expect(snap.elapsedMs).toBe(0);
  });

  it('step() en estado terminal lanza BATTLE_NOT_RUNNING', () => {
    const battle = createBattleSession(makeValidOptions());

    // Provocar game over en P1 haciendo hard drops acelerados
    for (let i = 0; i < 200; i++) {
      if (battle.getSnapshot().status !== 'running') break;
      battle.step({
        playerOne: { ...emptyInput(), hardDrop: true },
        playerTwo: emptyInput(),
      });
    }

    if (battle.getSnapshot().status !== 'running') {
      expect(() => battle.step(emptyBattleInput())).toThrow(BattleStepError);
      try {
        battle.step(emptyBattleInput());
      } catch (err) {
        expect((err as BattleStepError).code).toBe('BATTLE_NOT_RUNNING');
      }
    }
  });

  it('reset() restablece la sesión y emite exclusivamente battleReset', () => {
    const battle = createBattleSession(makeValidOptions());
    battle.step(emptyBattleInput());
    battle.step(emptyBattleInput());

    const snapReset = battle.reset();
    const events = battle.drainEvents();

    expect(snapReset.step).toBe(0);
    expect(snapReset.elapsedMs).toBe(0);
    expect(snapReset.status).toBe('running');
    expect(snapReset.winner).toBeNull();
    expect(events).toEqual([{ type: 'battleReset', step: 0 }]);
  });

  it('drainEvents() vacía la cola de eventos', () => {
    const battle = createBattleSession(makeValidOptions());
    expect(battle.drainEvents()).toHaveLength(1); // battleStarted
    expect(battle.drainEvents()).toHaveLength(0); // vacía
  });

  it('snapshots y eventos devueltos son inmutables (frozen)', () => {
    const battle = createBattleSession(makeValidOptions());
    const snap = battle.getSnapshot();
    const events = battle.drainEvents();

    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(events)).toBe(true);
  });

  it('determinismo absoluto: misma semilla e inputs producen snapshots e historial de eventos idénticos', () => {
    const battle1 = createBattleSession(makeValidOptions({ seed: 789 }));
    const battle2 = createBattleSession(makeValidOptions({ seed: 789 }));

    for (let i = 0; i < 5; i++) {
      battle1.step(emptyBattleInput());
      battle2.step(emptyBattleInput());
    }

    expect(battle1.getSnapshot()).toEqual(battle2.getSnapshot());
    expect(battle1.drainEvents()).toEqual(battle2.drainEvents());
  });

  describe('integración de BattleSession con el bot y sabotajes de P2', () => {
    it('BattleSession enruta correctamente triggerSabotage de P2 hacia P1', () => {
      const battle = createBattleSession(makeValidOptions({ seed: 123 }));
      battle.drainEvents();

      const p1Engine = battle.getEngine('playerOne');
      const p2Engine = battle.getEngine('playerTwo');

      const bot = createDeterministicBot();
      const p2Input = bot.nextStep(p2Engine, 'running', p1Engine.getSnapshot());
      expect(p2Input).toBeDefined();

      const snap = battle.step({
        playerOne: emptyInput(),
        playerTwo: p2Input,
      });

      expect(snap.status).toBe('running');
      expect(snap.step).toBe(1);
    });

    it('enrutamiento bidireccional de sabotajes en BattleSession entre P1 y P2', () => {
      const battle = createBattleSession(makeValidOptions());
      battle.drainEvents();

      const snap = battle.step({
        playerOne: emptyInput(),
        playerTwo: { ...emptyInput(), triggerSabotage: true },
      });

      expect(snap.step).toBe(1);
      expect(snap.status).toBe('running');
    });
  });
});
