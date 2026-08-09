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
      expect(snap.step).toBe(1);
      expect(snap.status).toBe('running');
    });
  });

  describe('Tarea 0024 — Muerte súbita determinista', () => {
    it('transiciona correctamente por las fronteras temporales exactas de 04:45, 05:00, 05:30 y 06:00', () => {
      // 1. Frontera de aviso 04:45 (285.000 ms)
      const battleWarning = createBattleSession(makeValidOptions({ initialElapsedMs: 284_990 }));
      expect(battleWarning.getSnapshot().suddenDeath.phase).toBe('inactive');
      const snapWarning = battleWarning.step(emptyBattleInput());
      expect(snapWarning.suddenDeath.phase).toBe('warning');
      expect(snapWarning.suddenDeath.warningRemainingMs).toBe(15000);
      expect(battleWarning.drainEvents().filter((e) => e.type === 'suddenDeathWarning')).toHaveLength(1);

      // 2. Frontera de phase1 05:00 (300.000 ms)
      const battlePhase1 = createBattleSession(makeValidOptions({ initialElapsedMs: 299_990 }));
      expect(battlePhase1.getSnapshot().suddenDeath.phase).toBe('warning');
      const snapPhase1 = battlePhase1.step(emptyBattleInput());
      expect(snapPhase1.suddenDeath.phase).toBe('phase1');
      expect(snapPhase1.suddenDeath.gravityMultiplier).toBe(1.15);
      expect(snapPhase1.suddenDeath.energyMultiplier).toBe(1.20);
      expect(battlePhase1.drainEvents().filter((e) => e.type === 'suddenDeathStarted')).toHaveLength(1);

      // 3. Frontera de phase2 05:30 (330.000 ms)
      const battlePhase2 = createBattleSession(makeValidOptions({ initialElapsedMs: 329_990 }));
      expect(battlePhase2.getSnapshot().suddenDeath.phase).toBe('phase1');
      const snapPhase2 = battlePhase2.step(emptyBattleInput());
      expect(snapPhase2.suddenDeath.phase).toBe('phase2');
      expect(snapPhase2.suddenDeath.gravityMultiplier).toBe(1.30);
      expect(snapPhase2.suddenDeath.energyMultiplier).toBe(1.20);
      expect(battlePhase2.drainEvents().filter((e) => e.type === 'suddenDeathPhaseChanged')).toHaveLength(1);

      // 4. Frontera de phase3 06:00 (360.000 ms)
      const battlePhase3 = createBattleSession(makeValidOptions({ initialElapsedMs: 359_990 }));
      expect(battlePhase3.getSnapshot().suddenDeath.phase).toBe('phase2');
      const snapPhase3 = battlePhase3.step(emptyBattleInput());
      expect(snapPhase3.suddenDeath.phase).toBe('phase3');
      expect(snapPhase3.suddenDeath.gravityMultiplier).toBe(1.50);
      expect(snapPhase3.suddenDeath.energyMultiplier).toBe(1.20);
      expect(battlePhase3.drainEvents().filter((e) => e.type === 'suddenDeathPhaseChanged')).toHaveLength(1);
    });

    it('aplica multiplicadores de presión simétricos y compuestos sobre ambos participantes', () => {
      const battle = createBattleSession(makeValidOptions({ initialElapsedMs: 300_000 }));
      const snap = battle.step(emptyBattleInput());
      expect(snap.playerOne.activeGravityCellsPerSecond).toBe(1.0 * 1.15);
      expect(snap.playerTwo.activeGravityCellsPerSecond).toBe(1.0 * 1.15);
    });

    it('conserva la condición de victoria por top-out de un participante', () => {
      const battle = createBattleSession(makeValidOptions());

      // Llenar tablero de P1 hasta provocar gameOver
      const p1Engine = battle.getEngine('playerOne');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');
      p1Engine.receiveSabotage('residuos');

      let lastSnap = battle.getSnapshot();
      while (lastSnap.status === 'running') {
        lastSnap = battle.step(emptyBattleInput());
      }

      expect(lastSnap.status).toBe('playerTwoWon');
      expect(lastSnap.winner).toBe('playerTwo');

      // Verificación de ausencia de avance tras finalizar
      expect(() => battle.step(emptyBattleInput())).toThrow('Battle is not running');
    });

    it('resuelve empate (draw) si ambos participantes mueren en el mismo paso global', () => {
      const battle = createBattleSession(makeValidOptions());

      // Llenar tableros de P1 y P2 simultáneamente
      const p1Engine = battle.getEngine('playerOne');
      const p2Engine = battle.getEngine('playerTwo');
      for (let i = 0; i < 11; i++) {
        p1Engine.receiveSabotage('residuos');
        p2Engine.receiveSabotage('residuos');
      }

      let lastSnap = battle.getSnapshot();
      while (lastSnap.status === 'running') {
        lastSnap = battle.step(emptyBattleInput());
      }

      expect(lastSnap.status).toBe('draw');
      expect(lastSnap.winner).toBe('draw');
    });

    it('reset restaura el estado de Muerte Súbita respetando initialElapsedMs', () => {
      const options = makeValidOptions({ initialElapsedMs: 300_000 });
      const battle = createBattleSession(options);
      expect(battle.getSnapshot().suddenDeath.phase).toBe('phase1');

      const resetSnap = battle.reset();
      expect(resetSnap.suddenDeath.phase).toBe('phase1');
      expect(resetSnap.elapsedMs).toBe(300_000);
    });

    it('valida que initialElapsedMs deba ser un número finito no negativo si está definido', () => {
      expect(() => {
        createBattleSession(makeValidOptions({ initialElapsedMs: -500 }));
      }).toThrow('initialElapsedMs must be a non-negative finite number');

      expect(() => {
        createBattleSession(makeValidOptions({ initialElapsedMs: NaN }));
      }).toThrow('initialElapsedMs must be a non-negative finite number');
    });
  });

  describe('Tarea 0027 — Protecciones y mecánicas pendientes de combate', () => {
    it('1. Warning: un sabotaje temporal (sobrecarga) entra en warning de 750 ms y no actúa hasta expirar', () => {
      const battle = createBattleSession(makeValidOptions());
      const p1Engine = battle.getEngine('playerOne');
      const fixedMs = prototypeConfig.fixedStepMs;
      const warningSteps = Math.ceil(750 / fixedMs);

      // Simular cartucho de P1 con sobrecarga
      p1Engine.receiveSabotage('sobrecarga'); // esto añade sobrecarga a P1, lo reseteamos o disparamos
      // Crear un estado donde P1 tiene storedSabotages = ['sobrecarga']
      const p1Initial = { storedSabotages: ['sobrecarga' as const] };
      const battle2 = createBattleSession(makeValidOptions({ playerOneInitialState: p1Initial }));
      battle2.drainEvents();

      // P1 dispara el sabotaje
      battle2.step({
        playerOne: { ...emptyInput(), triggerSabotage: true },
        playerTwo: emptyInput(),
      });

      const events = battle2.drainEvents();
      const warningStart = events.find((e) => e.type === 'warningStarted');
      expect(warningStart).toBeDefined();
      if (warningStart && warningStart.type === 'warningStarted') {
        expect(warningStart.participant).toBe('playerTwo');
        expect(warningStart.sabotage).toBe('sobrecarga');
        expect(warningStart.durationMs).toBe(750);
      }

      // Durante los pasos de warning (< warningSteps), sobrecarga NO está activa en P2
      for (let s = 1; s < warningSteps; s++) {
        const snap = battle2.step(emptyBattleInput());
        expect(snap.playerTwo.activeEffects.some((e) => e.type === 'sobrecarga')).toBe(false);
        expect(snap.playerTwoState.warnings).toHaveLength(1);
      }

      // En el paso exacto en que expira el warning, se emite warningExpired y sobrecarga pasa a estar activa en P2
      const finalSnap = battle2.step(emptyBattleInput());
      const finalEvents = battle2.drainEvents();
      expect(finalEvents.some((e) => e.type === 'warningExpired')).toBe(true);
      expect(finalSnap.playerTwo.activeEffects.some((e) => e.type === 'sobrecarga')).toBe(true);
    });

    it('2. Bloqueo de duplicados: warning ya pendiente o efecto ya activo rechaza nuevo sabotaje con sabotageBlocked', () => {
      const p1Initial = { storedSabotages: ['sobrecarga' as const, 'sobrecarga' as const] };
      const battle = createBattleSession(makeValidOptions({ playerOneInitialState: p1Initial }));
      battle.drainEvents();

      // P1 dispara primer sobrecarga -> inicia warning en P2
      battle.step({
        playerOne: { ...emptyInput(), triggerSabotage: true },
        playerTwo: emptyInput(),
      });

      // P1 dispara segundo sobrecarga en el paso siguiente mientras warning está pendiente -> sabotageBlocked (warningPending)
      battle.step({
        playerOne: { ...emptyInput(), triggerSabotage: true },
        playerTwo: emptyInput(),
      });

      const events = battle.drainEvents();
      const blocked = events.find((e) => e.type === 'sabotageBlocked');
      expect(blocked).toBeDefined();
      if (blocked && blocked.type === 'sabotageBlocked') {
        expect(blocked.target).toBe('playerTwo');
        expect(blocked.sabotage).toBe('sobrecarga');
        expect(blocked.reason).toBe('warningPending');
      }
    });

    it('3. Inmunidad post-efecto: al expirar un efecto (interferencia), P2 gana 4.000 ms de inmunidad', () => {
      const fixedMs = prototypeConfig.fixedStepMs;
      const warningSteps = Math.ceil(750 / fixedMs);
      const interferenciaSteps = Math.ceil(5000 / fixedMs);

      const p1Initial = { storedSabotages: ['interferencia' as const, 'interferencia' as const] };
      const battle = createBattleSession(makeValidOptions({ playerOneInitialState: p1Initial }));
      battle.drainEvents();

      // P1 dispara Interferencia
      battle.step({
        playerOne: { ...emptyInput(), triggerSabotage: true },
        playerTwo: emptyInput(),
      });

      // Avanzar warning (750 ms)
      for (let i = 0; i < warningSteps; i++) {
        battle.step(emptyBattleInput());
      }
      expect(battle.getSnapshot().playerTwoState.isInterfered).toBe(true);

      // Avanzar Interferencia hasta expirar (5000 ms)
      for (let i = 0; i < interferenciaSteps; i++) {
        battle.step(emptyBattleInput());
      }

      const snapAfterExp = battle.getSnapshot();
      expect(snapAfterExp.playerTwoState.isInterfered).toBe(false);
      expect(snapAfterExp.playerTwoState.immunities).toHaveLength(1);
      expect(snapAfterExp.playerTwoState.immunities[0]!.sabotage).toBe('interferencia');
      expect(snapAfterExp.playerTwoState.immunities[0]!.remainingMs).toBe(4000);

      // Intentar disparar segunda Interferencia durante inmunidad
      battle.step({
        playerOne: { ...emptyInput(), triggerSabotage: true },
        playerTwo: emptyInput(),
      });

      const events = battle.drainEvents();
      const blocked = events.find((e) => e.type === 'sabotageBlocked');
      expect(blocked).toBeDefined();
      if (blocked && blocked.type === 'sabotageBlocked') {
        expect(blocked.reason).toBe('immunity');
      }
    });

    it('4. Reataques frente a inmunidad: 1 step antes (bloqueado), paso exacto (permite warning) y 1 step después (permite warning)', () => {
      const fixedMs = prototypeConfig.fixedStepMs;
      const warningSteps = Math.ceil(750 / fixedMs);
      const interferenciaSteps = Math.ceil(5000 / fixedMs);
      const immunitySteps = Math.ceil(4000 / fixedMs);

      // Probamos reataque en paso exacto de expiración de inmunidad
      const p1Initial = { storedSabotages: ['interferencia' as const, 'interferencia' as const] };
      const battle = createBattleSession(makeValidOptions({ playerOneInitialState: p1Initial }));
      battle.drainEvents();

      battle.step({ playerOne: { ...emptyInput(), triggerSabotage: true }, playerTwo: emptyInput() });
      for (let i = 0; i < warningSteps + interferenciaSteps; i++) {
        battle.step(emptyBattleInput());
      }

      // En este momento la inmunidad de P2 para interferencia durará exactamente immunitySteps
      // Avanzar immunitySteps - 1 pasos (quedará 1 paso de inmunidad)
      for (let i = 0; i < immunitySteps - 1; i++) {
        battle.step(emptyBattleInput());
      }
      expect(battle.getSnapshot().playerTwoState.immunities).toHaveLength(1);

      // Disparar en el paso en que expira la inmunidad (paso exacto)
      battle.step({ playerOne: { ...emptyInput(), triggerSabotage: true }, playerTwo: emptyInput() });
      const events = battle.drainEvents();

      // Como la inmunidad expira en step 4.b, en step 8 cuando se rutea la inmunidad ya ha expirado, permitiendo el nuevo warning
      const warningEvent = events.find((e) => e.type === 'warningStarted');
      expect(warningEvent).toBeDefined();
    });

    it('5. Congelación de percepción unívoca al activar Interferencia y test explícito de cambio en el mismo step', () => {
      const fixedMs = prototypeConfig.fixedStepMs;
      const warningSteps = Math.ceil(750 / fixedMs);

      const p2Initial = { storedSabotages: ['interferencia' as const] };
      const battle = createBattleSession(makeValidOptions({ playerTwoInitialState: p2Initial }));
      battle.drainEvents();

      // P2 dispara Interferencia hacia P1
      battle.step({ playerOne: emptyInput(), playerTwo: { ...emptyInput(), triggerSabotage: true } });

      // Avanzar warning-1 pasos. En el paso previo a la activación, capturar la percepción de P1 sobre P2
      for (let i = 0; i < warningSteps - 1; i++) {
        battle.step(emptyBattleInput());
      }

      const perceptionBeforeActivation = battle.getPerceivedOpponentSnapshot('playerOne');

      // En el paso de activación (expira warning), P2 (el rival) realiza un movimiento y fija pieza, cambiando su tablero real
      battle.step({
        playerOne: emptyInput(),
        playerTwo: { ...emptyInput(), hardDrop: true },
      });

      const events = battle.drainEvents();
      expect(events.some((e) => e.type === 'interferenciaStarted')).toBe(true);
      expect(battle.getSnapshot().playerOneState.isInterfered).toBe(true);

      // Obtener la percepción de P1 sobre P2 inmediatamente tras el step de activación
      const perceptionAfterActivation = battle.getPerceivedOpponentSnapshot('playerOne');

      // VERIFICACIÓN CLAVE: La percepción de P1 conserva la foto PREVIA y NO ha incorporado el hardDrop ni los cambios reales de P2 de ese mismo step
      expect(perceptionAfterActivation.activePiece?.pieceId).toBe(perceptionBeforeActivation.activePiece?.pieceId);
      expect(perceptionAfterActivation.clearedLines).toBe(perceptionBeforeActivation.clearedLines);
      expect(perceptionAfterActivation.score).toBe(perceptionBeforeActivation.score);

      // El estado real de P2 sí ha cambiado (pieza diferente/fijada)
      const realP2Snap = battle.getEngine('playerTwo').getSnapshot();
      expect(realP2Snap.activePiece?.pieceId).not.toBe(perceptionAfterActivation.activePiece?.pieceId);
    });
  });
});
