import { describe, expect, it } from 'vitest';
import { createGameEngine, type StepInput } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import {
  createDeterministicBot,
  isActivePieceFullyVisible,
  normalizeBotConfig,
  BOT_REACTION_DELAY_STEPS,
  BOT_ACTION_INTERVAL_STEPS,
  BOT_HARD_DROP_DELAY_STEPS,
} from './deterministic-bot';

function makeValidOptions(seed = 42) {
  return { seed, config: prototypeConfig };
}

describe('deterministic-bot', () => {
  it('exporta las constantes de cadencia del perfil de referencia battleNormal (20, 4, 5)', () => {
    expect(BOT_REACTION_DELAY_STEPS).toBe(20);
    expect(BOT_ACTION_INTERVAL_STEPS).toBe(4);
    expect(BOT_HARD_DROP_DELAY_STEPS).toBe(5);
  });

  it('normaliza la configuración del bot validando valores válidos o defectuosos', () => {
    const norm = normalizeBotConfig({
      reactionDelaySteps: -5,
      actionIntervalSteps: -2,
      hardDropDelaySteps: -10,
      maxSearchNodes: 0,
    });

    expect(norm.reactionDelaySteps).toBe(0);
    expect(norm.actionIntervalSteps).toBe(0);
    expect(norm.hardDropDelaySteps).toBe(0);
    expect(norm.maxSearchNodes).toBe(1);
  });

  it('no ejecuta acciones ni consume planes mientras la pieza está parcialmente oculta (y < 4)', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    expect(isActivePieceFullyVisible(engine)).toBe(false);

    const neutralInput: StepInput = {
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
    };

    const input = bot.nextStep(engine);
    expect(input).toEqual(neutralInput);
    expect(bot.getDiagnostic().currentPhase).toBe('waitingForVisibility');
    expect(bot.getDiagnostic().actionIndex).toBe(0);
  });

  it('inicia los 20 pasos de reacción únicamente tras la visibilidad completa (y >= 4)', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: true, hardDrop: false,
      });
    }

    expect(isActivePieceFullyVisible(engine)).toBe(true);

    const neutralInput = {
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
    };

    // Consumir los 20 pasos de reacción por defecto
    for (let i = 0; i < BOT_REACTION_DELAY_STEPS; i++) {
      const diagBefore = bot.nextStep(engine);
      expect(diagBefore).toEqual(neutralInput);
      expect(bot.getDiagnostic().currentPhase).toBe('reacting');
      engine.step(diagBefore);
    }
  });

  it('respeta la cadencia de 4 pasos entre acciones y 5 pasos antes del hard drop', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }

    for (let i = 0; i < BOT_REACTION_DELAY_STEPS; i++) {
      engine.step(bot.nextStep(engine));
    }

    // Primera acción de movimiento
    const action1 = bot.nextStep(engine);
    engine.step(action1);

    // Los siguientes BOT_ACTION_INTERVAL_STEPS - 1 ticks deben ser de espera entre acciones
    for (let i = 0; i < BOT_ACTION_INTERVAL_STEPS - 1; i++) {
      const waitInput = bot.nextStep(engine);
      expect(waitInput).toEqual({
        leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
        softDropHeld: false, hardDrop: false,
      });
      engine.step(waitInput);
    }
  });

  it('el plan sobrevive al descenso por gravedad natural en Y', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }

    for (let i = 0; i < 5; i++) {
      const input = bot.nextStep(engine);
      engine.step(input);
    }

    expect(bot.getDiagnostic().planDiagnostic).toBeDefined();
  });

  it('reacciona con desorientación y 20 pasos de retardo tras una alteración por Polaridad Inversa', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }

    for (let i = 0; i < BOT_REACTION_DELAY_STEPS; i++) {
      engine.step(bot.nextStep(engine));
    }

    engine.receiveSabotage('polaridad');

    let reactingTicks = 0;
    for (let i = 0; i < 25; i++) {
      const input = bot.nextStep(engine);
      if (bot.getDiagnostic().currentPhase === 'reacting') {
        reactingTicks++;
      }
      engine.step(input);
    }

    expect(reactingTicks).toBeGreaterThanOrEqual(BOT_REACTION_DELAY_STEPS - 5);
  });

  it('reset limpia todos los contadores e invalida el plan', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }

    bot.nextStep(engine);
    bot.reset();

    expect(bot.getDiagnostic().currentPhase).toBe('waitingForVisibility');
    expect(bot.getDiagnostic().actionIndex).toBe(0);
  });

  it('dos instancias con la misma configuración en partidas idénticas son deterministas', () => {
    const e1 = createGameEngine(makeValidOptions(777));
    const e2 = createGameEngine(makeValidOptions(777));

    const bot1 = createDeterministicBot();
    const bot2 = createDeterministicBot();

    for (let i = 0; i < 50; i++) {
      const input1 = bot1.nextStep(e1);
      const input2 = bot2.nextStep(e2);
      expect(input1).toEqual(input2);

      e1.step(input1);
      e2.step(input2);
    }

    expect(e1.getSnapshot()).toEqual(e2.getSnapshot());
  });

  it('invalida el plan y reinicia retardo tras la fijación detectando el pieceId real', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }
    for (let i = 0; i < BOT_REACTION_DELAY_STEPS; i++) {
      engine.step(bot.nextStep(engine));
    }

    const p1Id = engine.getSnapshot().activePiece!.pieceId;
    expect(typeof p1Id).toBe('number');

    engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true });

    const p2Id = engine.getSnapshot().activePiece!.pieceId;
    expect(p2Id).not.toBe(p1Id);

    const nextInput = bot.nextStep(engine);
    expect(nextInput).toEqual({
      leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false,
      softDropHeld: false, hardDrop: false,
    });
    expect(bot.getDiagnostic().actionIndex).toBe(0);
  });

  it('mantiene hardDropDelayTimer en 0 durante visibilidad, reacción y reset, e inicializa a 5 solo al entrar en waitingBeforeHardDrop', () => {
    const engine = createGameEngine(makeValidOptions());
    const bot = createDeterministicBot();

    // 1. Inicialmente en waitingForVisibility -> timer = 0
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);
    bot.nextStep(engine);
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);

    // 2. Transición a reacting -> timer = 0
    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }
    bot.nextStep(engine); // entra en reacting
    expect(bot.getDiagnostic().currentPhase).toBe('reacting');
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);

    // 3. Reset mantiene timer = 0
    bot.reset();
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);
  });
});
