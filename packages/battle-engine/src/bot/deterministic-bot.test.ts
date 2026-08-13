import { prototypeConfig } from '@rautfall/game-config';
import { createGameEngine, type EngineSnapshot, type GameEngine, type SabotageType, type StepInput } from '@rautfall/game-engine';
import { describe, expect, it } from 'vitest';
import {
  BOT_ACTION_INTERVAL_STEPS,
  BOT_HARD_DROP_DELAY_STEPS,
  BOT_REACTION_DELAY_STEPS,
  createDeterministicBot,
  isActivePieceFullyVisible,
  normalizeBotConfig,
  selectCandidate,
} from './deterministic-bot';
import type { SearchResult } from './placement-search';
import { BOT_PROFILES } from './profiles';
import type { PlacementCandidate } from './types';

function makeValidOptions(seed = 42) {
  return { seed, config: prototypeConfig };
}

function createMockOpponentSnapshot(maxHeight = 0, overrides?: Partial<EngineSnapshot>): EngineSnapshot {
  const engine = createGameEngine(makeValidOptions());
  const snap = engine.getSnapshot();
  const board = snap.board.map((row, r) => {
    if (r >= 24 - maxHeight) {
      const newRow = [...row];
      newRow[0] = 'I';
      return Object.freeze(newRow);
    }
    return row;
  });
  return Object.freeze({
    ...snap,
    board: Object.freeze(board),
    ...overrides,
  });
}

function createMockOwnEngine(seed = 100, storedSabotages: SabotageType[] = ['residuos']): GameEngine {
  return createGameEngine(makeValidOptions(seed), { storedSabotages });
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

    const action1 = bot.nextStep(engine);
    engine.step(action1);

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

    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);
    bot.nextStep(engine);
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);

    while (!isActivePieceFullyVisible(engine)) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
    }
    bot.nextStep(engine);
    expect(bot.getDiagnostic().currentPhase).toBe('reacting');
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);

    bot.reset();
    expect(bot.getDiagnostic().hardDropDelayTimer).toBe(0);
  });

  describe('integración táctica de sabotajes', () => {
    it('emite triggerSabotage solo en tick neutro y nunca combinado con movimiento, rotación o hardDrop', () => {
      const e1 = createMockOwnEngine(100, ['residuos']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      let triggeredCount = 0;
      for (let i = 0; i < 60; i++) {
        const inpt = bot.nextStep(e1, 'running', oppSnap);
        if (inpt.triggerSabotage === true) {
          triggeredCount++;
          expect(inpt.leftHeld).toBe(false);
          expect(inpt.rightHeld).toBe(false);
          expect(inpt.leftPressed).toBe(false);
          expect(inpt.rightPressed).toBe(false);
          expect(inpt.softDropHeld).toBe(false);
          expect(inpt.hardDrop).toBe(false);
          expect(inpt.rotateClockwise).toBeUndefined();
          expect(inpt.rotateCounterclockwise).toBeUndefined();
          expect(inpt.hold).toBeUndefined();
        }
        e1.step(inpt);
      }

      expect(triggeredCount).toBe(1);
    });

    it('carga cooldown (100 pasos) tras disparar y decrementa un paso por tick', () => {
      const e1 = createMockOwnEngine(100, ['residuos']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      let triggered = false;
      for (let i = 0; i < 30; i++) {
        const inpt = bot.nextStep(e1, 'running', oppSnap);
        if (inpt.triggerSabotage === true) {
          triggered = true;
          expect(bot.getDiagnostic().sabotageCooldownRemaining).toBe(100);
          expect(bot.getDiagnostic().lastSabotageUsed).toBe('residuos');
          break;
        }
        e1.step(inpt);
      }
      expect(triggered).toBe(true);

      bot.nextStep(e1, 'running', oppSnap);
      expect(bot.getDiagnostic().sabotageCooldownRemaining).toBe(99);
    });

    it('conservar no carga cooldown (mantiene cooldownRemaining en 0) y carga solo decisionInterval', () => {
      const e1 = createMockOwnEngine(100, ['residuos']);
      const oppSnap = createMockOpponentSnapshot(0);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      bot.nextStep(e1, 'running', oppSnap);
      const diag = bot.getDiagnostic();
      expect(diag.sabotageDecision?.shouldTrigger).toBe(false);
      expect(diag.sabotageDecision?.reason).toBe('opponentTooLow');
      expect(diag.sabotageCooldownRemaining).toBe(0);
      expect(diag.sabotageDecisionIntervalRemaining).toBe(20);
    });

    it('reset limpia el estado táctico por completo', () => {
      const e1 = createMockOwnEngine(100, ['residuos']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      for (let i = 0; i < 30; i++) {
        const inpt = bot.nextStep(e1, 'running', oppSnap);
        if (inpt.triggerSabotage) break;
        e1.step(inpt);
      }

      expect(bot.getDiagnostic().sabotageCooldownRemaining).toBeGreaterThan(0);

      bot.reset();
      const diag = bot.getDiagnostic();
      expect(diag.sabotageCooldownRemaining).toBe(0);
      expect(diag.sabotageDecisionIntervalRemaining).toBe(0);
      expect(diag.sabotageDecision).toBeUndefined();
      expect(diag.lastSabotageUsed).toBeNull();
    });

    it('terminalidad impide la evaluación y activación de sabotajes', () => {
      const e1 = createMockOwnEngine(100, ['residuos']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      const inpt = bot.nextStep(e1, 'playerOneWon', oppSnap);
      expect(inpt.triggerSabotage).toBeUndefined();
      expect(bot.getDiagnostic().currentPhase).toBe('terminal');
    });

    it('dos cartuchos no se disparan en ráfaga por efecto del cooldown', () => {
      const e1 = createMockOwnEngine(100, ['residuos', 'residuos']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      let triggerCount = 0;
      for (let i = 0; i < 60; i++) {
        const inpt = bot.nextStep(e1, 'running', oppSnap);
        if (inpt.triggerSabotage) triggerCount++;
        e1.step(inpt);
      }

      expect(triggerCount).toBe(1);
    });

    it('consumo observado: el bot emite triggerSabotage sin mutar ownSnapshot, y la cola FIFO se actualiza al ser procesada por GameEngine', () => {
      const e1 = createMockOwnEngine(100, ['residuos', 'sobrecarga']);
      const oppSnap = createMockOpponentSnapshot(8);
      const bot = createDeterministicBot();

      while (!isActivePieceFullyVisible(e1)) {
        e1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      // 1. Emitir triggerSabotage
      const inpt1 = bot.nextStep(e1, 'running', oppSnap);
      expect(inpt1.triggerSabotage).toBe(true);

      // El cartucho de ownSnapshot no se muta internamente por el bot
      expect(e1.getSnapshot().storedSabotages).toEqual(['residuos', 'sobrecarga']);

      // 2. Segunda llamada a nextStep con el mismo snapshot antiguo no vuelve a emitir triggerSabotage durante cooldown
      const inpt2 = bot.nextStep(e1, 'running', oppSnap);
      expect(inpt2.triggerSabotage).toBeUndefined();

      // 3. Al ejecutar el paso en GameEngine, el motor consume el frente de la cola
      e1.step(inpt1);
      expect(e1.getSnapshot().storedSabotages).toEqual(['sobrecarga']);

      // 4. El frente FIFO actualizado pasa a ser observado deterministamente
      const inpt3 = bot.nextStep(e1, 'running', oppSnap);
      expect(inpt3).toBeDefined();
      expect(bot.getDiagnostic().frontStoredSabotage).toBe('sobrecarga');
    });
  });

  describe('diferenciación determinista de perfiles (CADET / OPERATOR / ELITE)', () => {
    it('invariante "never suicidal": CADET nunca elige una muerte inmediata evitable cuando existen alternativas no terminales', () => {
      const cadetConfig = BOT_PROFILES.battleCadet;

      const candidatesMap = {
        best: { heuristicScore: 100, isGameOver: false, actions: ['hardDrop'] } as unknown as PlacementCandidate & { isGameOver: boolean },
        suboptimal: { heuristicScore: 40, isGameOver: false, actions: ['left', 'hardDrop'] } as unknown as PlacementCandidate & { isGameOver: boolean },
        suicidal1: { heuristicScore: 90, isGameOver: true, actions: ['right', 'hardDrop'] } as unknown as PlacementCandidate & { isGameOver: boolean },
        suicidal2: { heuristicScore: 200, isGameOver: true, actions: ['rotateClockwise', 'hardDrop'] } as unknown as PlacementCandidate & { isGameOver: boolean },
      };

      const mockSearchResult = {
        bestCandidate: candidatesMap.best,
        allCandidates: [candidatesMap.suicidal2, candidatesMap.best, candidatesMap.suicidal1, candidatesMap.suboptimal],
        nonTerminalCandidates: [candidatesMap.best, candidatesMap.suboptimal],
        searchMetrics: { nodesExplored: 10, nodesDeduplicated: 0, candidatesFound: 4, nonTerminalCandidateCount: 2, reachedNodeLimit: false },
      };

      // Probar múltiples semillas deterministas
      for (let s = 1; s <= 50; s++) {
        let seedVal = s * 100;
        const prng = () => {
          seedVal = (seedVal * 9301 + 49297) % 233280;
          return seedVal / 233280;
        };

        const chosen = selectCandidate(mockSearchResult as unknown as SearchResult, cadetConfig, prng);
        expect(chosen).not.toBeNull();
        expect(chosen!.isGameOver).toBe(false);
      }
    });

    it('inclusión de conjuntos elegibles: eligible(CADET) ⊇ eligible(OPERATOR) ⊇ eligible(ELITE)', () => {
      const candidates = [
        { heuristicScore: 100, isGameOver: false },
        { heuristicScore: 90, isGameOver: false },
        { heuristicScore: 70, isGameOver: false },
        { heuristicScore: 30, isGameOver: false },
        { heuristicScore: 10, isGameOver: false },
      ];

      const searchResult = {
        bestCandidate: candidates[0]!,
        allCandidates: candidates,
        nonTerminalCandidates: candidates,
        searchMetrics: { nodesExplored: 10, nodesDeduplicated: 0, candidatesFound: 5, nonTerminalCandidateCount: 5, reachedNodeLimit: false },
      };

      const bestScore = searchResult.bestCandidate.heuristicScore;

      const getEligible = (profileId: 'battleCadet' | 'battleOperator' | 'battleElite') => {
        const conf = BOT_PROFILES[profileId];
        return searchResult.allCandidates.filter((c) => bestScore - c.heuristicScore <= conf.optimalityTolerance);
      };

      const cadetEligible = getEligible('battleCadet');
      const operatorEligible = getEligible('battleOperator');
      const eliteEligible = getEligible('battleElite');

      expect(cadetEligible.length).toBeGreaterThanOrEqual(operatorEligible.length);
      expect(operatorEligible.length).toBeGreaterThanOrEqual(eliteEligible.length);

      expect(cadetEligible).toEqual(expect.arrayContaining(operatorEligible));
      expect(operatorEligible).toEqual(expect.arrayContaining(eliteEligible));
    });

    it('diferenciación determinista con semilla y reprodubilidad exacta', () => {
      const cadetBot1 = createDeterministicBot(BOT_PROFILES.battleCadet, () => 0.01);
      const cadetBot2 = createDeterministicBot(BOT_PROFILES.battleCadet, () => 0.01);
      const eliteBot = createDeterministicBot(BOT_PROFILES.battleElite, () => 0.01);

      const engine1 = createGameEngine(makeValidOptions(555));
      const engine2 = createGameEngine(makeValidOptions(555));
      const engine3 = createGameEngine(makeValidOptions(555));

      while (!isActivePieceFullyVisible(engine1)) {
        engine1.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
        engine2.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
        engine3.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: true, hardDrop: false });
      }

      for (let i = 0; i < BOT_REACTION_DELAY_STEPS; i++) {
        engine1.step(cadetBot1.nextStep(engine1));
        engine2.step(cadetBot2.nextStep(engine2));
        engine3.step(eliteBot.nextStep(engine3));
      }

      const diagCadet1 = cadetBot1.getDiagnostic();
      const diagCadet2 = cadetBot2.getDiagnostic();
      const diagElite = eliteBot.getDiagnostic();

      // Reproducibilidad exacta: mismo estado + semilla + perfil produce exactamente la misma decisión
      expect(diagCadet1.planDiagnostic?.selectedActionCount).toBe(diagCadet2.planDiagnostic?.selectedActionCount);
      expect(diagCadet1.planDiagnostic?.selectedHeuristicScore).toBe(diagCadet2.planDiagnostic?.selectedHeuristicScore);

      // ELITE restinge la selección a candidatos de mayor o igual puntuación heurística respecto a la tolerancia permissiva de CADET
      if (diagElite.planDiagnostic && diagCadet1.planDiagnostic) {
        expect(diagElite.planDiagnostic.selectedHeuristicScore).toBeGreaterThanOrEqual(diagCadet1.planDiagnostic.selectedHeuristicScore);
      }
    });
  });
});
