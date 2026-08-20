import { describe, it, expect, beforeEach } from 'vitest';
import type { GameStateServerMessage, WsEngineSnapshot } from '@rautfall/contracts';
import type { BattleEvent, BattleSnapshot } from '@rautfall/battle-engine';

import { CombatReactionSelector, isCriticalBoard } from './combat-reaction-selector';

function createMockBoard(occupiedRows: number[] = []): Array<Array<'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'garbage' | null>> {
  const board: Array<Array<'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L' | 'garbage' | null>> = Array.from({ length: 24 }, () =>
    Array.from({ length: 10 }, () => null)
  );

  for (const r of occupiedRows) {
    if (r >= 0 && r < 24) {
      const row = board[r];
      if (row) {
        row[0] = 'I';
      }
    }
  }

  return board;
}

function createMockSnapshot(occupiedRows: number[] = []): WsEngineSnapshot {
  return {
    step: 10,
    elapsedMs: 500,
    status: 'running',
    board: createMockBoard(occupiedRows),
    activePiece: null,
    nextPieces: ['I', 'O', 'T'],
    clearedLines: 0,
    heldPiece: null,
    score: 0,
    combo: 0,
    backToBack: 0,
    combatEnergy: 0,
    storedSabotages: [],
    pendingGarbage: 0,
    activeEffects: [],
    level: 1,
  };
}

function createMockGameState(overrides: Partial<GameStateServerMessage> = {}): GameStateServerMessage {
  return {
    type: 'game_state',
    step: 10,
    elapsedMs: 500,
    status: 'running',
    pausedBy: null,
    winner: null,
    suddenDeath: {
      phase: 'inactive',
      warningRemainingMs: 0,
      activeElapsedMs: 0,
      gravityMultiplier: 1,
      energyMultiplier: 1,
    },
    self: createMockSnapshot(),
    opponent: createMockSnapshot(),
    selfState: {
      warnings: [],
      immunities: [],
      activeEffects: [],
      isInterfered: false,
      interferenciaRemainingMs: 0,
    },
    opponentState: {
      warnings: [],
      immunities: [],
      activeEffects: [],
      isInterfered: false,
      interferenciaRemainingMs: 0,
    },
    events: [],
    ...overrides,
  };
}

describe('isCriticalBoard', () => {
  it('identifica correctamente cuando el tablero está en estado seguro (sin celdas en y <= 8)', () => {
    const snapshot = createMockSnapshot([9, 10, 15, 20]);
    expect(isCriticalBoard(snapshot)).toBe(false);
  });

  it('identifica correctamente estado crítico cuando hay celdas en y <= 8', () => {
    const snapshotCriticalRow8 = createMockSnapshot([8, 12, 15]);
    expect(isCriticalBoard(snapshotCriticalRow8)).toBe(true);

    const snapshotCriticalRow4 = createMockSnapshot([4, 10]);
    expect(isCriticalBoard(snapshotCriticalRow4)).toBe(true);

    const snapshotCriticalHiddenRow0 = createMockSnapshot([0]);
    expect(isCriticalBoard(snapshotCriticalHiddenRow0)).toBe(true);
  });
});

describe('CombatReactionSelector', () => {
  let currentTime: number;
  let randomValue: number;

  const mockNow = () => currentTime;
  const mockRandom = () => randomValue;

  beforeEach(() => {
    currentTime = 1000;
    randomValue = 0.1; // Por debajo de 0.35 para pasar las tiradas de probabilidad
  });

  it('evalúa atómicamente la transición safe -> critical y respeta la secuencia safe->safe, safe->critical, critical->critical, critical->safe, critical->safe->critical', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    // 1. safe -> safe (fila 10 ocupada)
    const msgSafe1 = createMockGameState({ self: createMockSnapshot([10]) });
    expect(selector.evaluateCombatState({ status: msgSafe1.status, winner: msgSafe1.winner, selfSnapshot: msgSafe1.self, events: msgSafe1.events, role: 'playerOne' })).toBeNull();

    // 2. safe -> critical (fila 8 ocupada)
    currentTime = 2000;
    const msgCritical1 = createMockGameState({ self: createMockSnapshot([8]) });
    const reaction1 = selector.evaluateCombatState({ status: msgCritical1.status, winner: msgCritical1.winner, selfSnapshot: msgCritical1.self, events: msgCritical1.events, role: 'playerOne' });
    expect(['no_no_no', 'hostia_hostia']).toContain(reaction1);

    // 3. critical -> critical (avanza tiempo pero sigue en critical sin salir de cooldown)
    currentTime = 8000;
    const msgCritical2 = createMockGameState({ self: createMockSnapshot([8]) });
    expect(selector.evaluateCombatState({ status: msgCritical2.status, winner: msgCritical2.winner, selfSnapshot: msgCritical2.self, events: msgCritical2.events, role: 'playerOne' })).toBeNull();

    // 4. critical -> safe (limpieza de líneas)
    currentTime = 9000;
    const msgSafe2 = createMockGameState({ self: createMockSnapshot([12]) });
    expect(selector.evaluateCombatState({ status: msgSafe2.status, winner: msgSafe2.winner, selfSnapshot: msgSafe2.self, events: msgSafe2.events, role: 'playerOne' })).toBeNull();

    // 5. safe -> critical (vuelve a subir la pila)
    currentTime = 15000;
    const msgCritical3 = createMockGameState({ self: createMockSnapshot([7]) });
    const reaction2 = selector.evaluateCombatState({ status: msgCritical3.status, winner: msgCritical3.winner, selfSnapshot: msgCritical3.self, events: msgCritical3.events, role: 'playerOne' });
    expect(['no_no_no', 'hostia_hostia']).toContain(reaction2);
  });

  it('evalúa correctamente eventos locales de Battle vs Bot para playerOne (humano)', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const localSnapshot: Partial<BattleSnapshot> = {
      status: 'running',
      winner: null,
      playerOne: createMockSnapshot([12]) as unknown as BattleSnapshot['playerOne'],
      playerTwo: createMockSnapshot([12]) as unknown as BattleSnapshot['playerTwo'],
    };


    const localEvents: BattleEvent[] = [
      {
        type: 'sabotageRouted',
        step: 10,
        source: 'playerOne',
        target: 'playerTwo',
        sabotage: 'residuos',
      },
    ];

    const reaction = selector.evaluateCombatState({
      status: localSnapshot.status,
      winner: localSnapshot.winner,
      selfSnapshot: localSnapshot.playerOne,
      events: localEvents,
      role: 'playerOne',
    });

    expect(reaction).toBe('toma');
  });

  it('ignora completamente eventos y estados que atañen exclusivamente al bot (playerTwo)', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const localEventsBot: BattleEvent[] = [
      {
        type: 'participantEvent',
        step: 10,
        participant: 'playerTwo',
        event: { type: 'garbageApplied', step: 10, linesCount: 2 },
      },
    ];

    const reaction = selector.evaluateCombatState({
      status: 'running',
      winner: null,
      selfSnapshot: createMockSnapshot([14]),
      events: localEventsBot,
      role: 'playerOne',
    });

    expect(reaction).toBeNull();
  });

  it('mapea garbageApplied al pool de residuos cuando no hay critical', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]),
      events: [
        {
          type: 'participantEvent',
          step: 10,
          participant: 'playerOne',
          event: { type: 'garbageApplied', step: 10, linesCount: 2 },
        },
      ],
    });

    const reaction = selector.evaluateCombatState({ status: msg.status, winner: msg.winner, selfSnapshot: msg.self, events: msg.events, role: 'playerOne' });
    expect(['hijo_puta', 'me_cago_en_todo', 'joder']).toContain(reaction);
  });

  it('mapea sabotageRouted recibido al pool de sabotajes recibidos', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]),
      events: [
        {
          type: 'sabotageRouted',
          step: 10,
          source: 'playerTwo',
          target: 'playerOne',
          sabotage: 'polaridad',
        },
      ],
    });

    const reaction = selector.evaluateCombatState({ status: msg.status, winner: msg.winner, selfSnapshot: msg.self, events: msg.events, role: 'playerOne' });
    expect(['cabron', 'no_me_jodas', 'pero_que_coño']).toContain(reaction);
  });

  it('mapea ataque propio bloqueado (sabotageBlocked con source=role) a mierda/joder', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]),
      events: [
        {
          type: 'sabotageBlocked',
          step: 10,
          source: 'playerOne',
          target: 'playerTwo',
          sabotage: 'sobrecarga',
          reason: 'immunity',
        },
      ],
    });

    const reaction = selector.evaluateCombatState({ status: msg.status, winner: msg.winner, selfSnapshot: msg.self, events: msg.events, role: 'playerOne' });
    expect(['mierda', 'joder']).toContain(reaction);
  });

  it('mapea defensa propia exitosa (sabotageBlocked con target=role) a eso_es_todo', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]),
      events: [
        {
          type: 'sabotageBlocked',
          step: 10,
          source: 'playerTwo',
          target: 'playerOne',
          sabotage: 'sobrecarga',
          reason: 'immunity',
        },
      ],
    });

    const reaction = selector.evaluateCombatState({ status: msg.status, winner: msg.winner, selfSnapshot: msg.self, events: msg.events, role: 'playerOne' });
    expect(reaction).toBe('eso_es_todo');
  });

  it('mapea victoria del humano a a_tomar_por_culo y derrota a jooooder (draw silencioso)', () => {
    const selectorVictory = new CombatReactionSelector({ now: mockNow, random: mockRandom });
    expect(selectorVictory.evaluateCombatState({ status: 'playerOneWon', winner: 'playerOne', role: 'playerOne' })).toBe('a_tomar_por_culo');

    const selectorDefeat = new CombatReactionSelector({ now: mockNow, random: mockRandom });
    expect(selectorDefeat.evaluateCombatState({ status: 'playerTwoWon', winner: 'playerTwo', role: 'playerOne' })).toBe('jooooder');

    const selectorDraw = new CombatReactionSelector({ now: mockNow, random: mockRandom });
    expect(selectorDraw.evaluateCombatState({ status: 'draw', winner: 'draw', role: 'playerOne' })).toBeNull();
  });

  it('respeta el cooldown global de 5000 ms para reacciones normales', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg1 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 10, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateCombatState({ status: msg1.status, winner: msg1.winner, selfSnapshot: msg1.self, events: msg1.events, role: 'playerOne' })).toBe('toma');

    // Mismo evento a los 2 segundos (dentro de cooldown)
    currentTime = 3000;
    const msg2 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 12, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateCombatState({ status: msg2.status, winner: msg2.winner, selfSnapshot: msg2.self, events: msg2.events, role: 'playerOne' })).toBeNull();

    // Evento transcurridos 5.001 ms desde el primer audio
    currentTime = 6001;
    const msg3 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 15, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateCombatState({ status: msg3.status, winner: msg3.winner, selfSnapshot: msg3.self, events: msg3.events, role: 'playerOne' })).toBe('toma');
  });

  it('evita la repetición inmediata de la última frase cuando existen alternativas en el pool', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 0 });

    const msgBlocked = createMockGameState({
      events: [{ type: 'sabotageBlocked', step: 10, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos', reason: 'immunity' }],
    });

    const first = selector.evaluateCombatState({ status: msgBlocked.status, winner: msgBlocked.winner, selfSnapshot: msgBlocked.self, events: msgBlocked.events, role: 'playerOne' });
    expect(['mierda', 'joder']).toContain(first);

    currentTime = 1100;
    const second = selector.evaluateCombatState({ status: msgBlocked.status, winner: msgBlocked.winner, selfSnapshot: msgBlocked.self, events: msgBlocked.events, role: 'playerOne' });
    expect(['mierda', 'joder']).toContain(second);
    expect(second).not.toBe(first);
  });

  it('limpia el estado mediante reset()', () => {
    const selector = new CombatReactionSelector({ now: mockNow, random: mockRandom });

    expect(selector.evaluateCombatState({ status: 'playerOneWon', winner: 'playerOne', role: 'playerOne' })).toBe('a_tomar_por_culo');

    selector.reset();

    expect(selector.evaluateCombatState({ status: 'playerOneWon', winner: 'playerOne', role: 'playerOne' })).toBe('a_tomar_por_culo');
  });
});
