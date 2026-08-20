import { describe, it, expect, beforeEach } from 'vitest';
import type { GameStateServerMessage, WsEngineSnapshot } from '@rautfall/contracts';
import { PvPReactionSelector, isCriticalBoard } from './pvp-reaction-selector';


function createMockSnapshot(occupiedRows: number[] = []): WsEngineSnapshot {
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


  return {
    step: 10,
    elapsedMs: 500,
    status: 'running',
    board,
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

describe('PvPReactionSelector', () => {
  let currentTime: number;
  let randomValue: number;

  const mockNow = () => currentTime;
  const mockRandom = () => randomValue;

  beforeEach(() => {
    currentTime = 1000;
    randomValue = 0.1; // Por debajo de 0.35 para que las tiradas de probabilidad pasen
  });

  it('evalúa atómicamente la transición safe -> critical y respeta la secuencia safe->safe, safe->critical, critical->critical, critical->safe, critical->safe->critical', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    // 1. safe -> safe (fila 10 ocupada)
    const msgSafe1 = createMockGameState({ self: createMockSnapshot([10]) });
    expect(selector.evaluateGameState(msgSafe1, 'playerOne')).toBeNull();

    // 2. safe -> critical (fila 8 ocupada)
    currentTime = 2000;
    const msgCritical1 = createMockGameState({ self: createMockSnapshot([8]) });
    const reaction1 = selector.evaluateGameState(msgCritical1, 'playerOne');
    expect(['no_no_no', 'hostia_hostia']).toContain(reaction1);

    // 3. critical -> critical (avanza tiempo pero sigue en critical sin salir de cooldown)
    currentTime = 8000; // Cooldown superado, pero es critical -> critical
    const msgCritical2 = createMockGameState({ self: createMockSnapshot([8]) });
    expect(selector.evaluateGameState(msgCritical2, 'playerOne')).toBeNull();

    // 4. critical -> safe (limpieza de líneas)
    currentTime = 9000;
    const msgSafe2 = createMockGameState({ self: createMockSnapshot([12]) });
    expect(selector.evaluateGameState(msgSafe2, 'playerOne')).toBeNull();

    // 5. safe -> critical (vuelve a subir la pila)
    currentTime = 15000; // Cooldown de 5s superado
    const msgCritical3 = createMockGameState({ self: createMockSnapshot([7]) });
    const reaction2 = selector.evaluateGameState(msgCritical3, 'playerOne');
    expect(['no_no_no', 'hostia_hostia']).toContain(reaction2);
  });

  it('prioriza eventos de forma atómica por game_state (critical > garbageApplied > sabotageReceived > attackBlocked > attackLaunched)', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    // Tick con critical + garbageApplied + sabotageReceived
    const msg = createMockGameState({
      self: createMockSnapshot([6]), // Provoca transición critical
      events: [
        {
          type: 'participantEvent',
          step: 10,
          participant: 'playerOne',
          event: { type: 'garbageApplied', step: 10, linesCount: 2 },
        },
        {
          type: 'sabotageRouted',
          step: 10,
          source: 'playerTwo',
          target: 'playerOne',
          sabotage: 'sobrecarga',
        },
      ],
    });

    // Debe prevalecer critical (no_no_no o hostia_hostia)
    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(['no_no_no', 'hostia_hostia']).toContain(reaction);
  });

  it('mapea garbageApplied al pool de residuos cuando no hay critical', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]), // Tablero safe
      events: [
        {
          type: 'participantEvent',
          step: 10,
          participant: 'playerOne',
          event: { type: 'garbageApplied', step: 10, linesCount: 2 },
        },
      ],
    });

    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(['hijo_puta', 'me_cago_en_todo', 'joder']).toContain(reaction);
  });

  it('mapea sabotageRouted recibido al pool de sabotajes recibidos', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

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

    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(['cabron', 'no_me_jodas', 'pero_que_coño']).toContain(reaction);
  });

  it('mapea ataque propio bloqueado (sabotageBlocked con source=role) a mierda/joder', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

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

    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(['mierda', 'joder']).toContain(reaction);
  });

  it('mapea defensa propia exitosa (sabotageBlocked con target=role) a eso_es_todo', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

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

    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(reaction).toBe('eso_es_todo');
  });

  it('mapea ataque propio exclusivo (sabotageRouted con source=role) a toma', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg = createMockGameState({
      self: createMockSnapshot([12]),
      events: [
        {
          type: 'sabotageRouted',
          step: 10,
          source: 'playerOne',
          target: 'playerTwo',
          sabotage: 'residuos',
        },
      ],
    });

    const reaction = selector.evaluateGameState(msg, 'playerOne');
    expect(reaction).toBe('toma');
  });

  it('respeta el cooldown global de 5000 ms para reacciones normales', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    const msg1 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 10, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateGameState(msg1, 'playerOne')).toBe('toma');

    // Mismo evento a los 2 segundos (dentro de cooldown)
    currentTime = 3000;
    const msg2 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 12, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateGameState(msg2, 'playerOne')).toBeNull();

    // Evento transcurridos 5.001 ms desde el primer audio
    currentTime = 6001;
    const msg3 = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 15, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateGameState(msg3, 'playerOne')).toBe('toma');
  });

  it('hace que la reacción terminal (victoria/derrota) ignore el cooldown y se ejecute 100% una sola vez', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 5000 });

    // Disparar reacción normal
    const msgNormal = createMockGameState({
      events: [{ type: 'sabotageRouted', step: 10, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos' }],
    });
    expect(selector.evaluateGameState(msgNormal, 'playerOne')).toBe('toma');

    // 1 segundo después llega la victoria (ignora cooldown)
    currentTime = 2000;
    const msgVictory = createMockGameState({
      status: 'playerOneWon',
      winner: 'playerOne',
      events: [{ type: 'battleEnded', step: 15, winner: 'playerOne' }],
    });
    expect(selector.evaluateGameState(msgVictory, 'playerOne')).toBe('a_tomar_por_culo');

    // Siguiente frame con el mismo estado de victoria (se ejecuta solo 1 vez)
    currentTime = 2100;
    expect(selector.evaluateGameState(msgVictory, 'playerOne')).toBeNull();
  });

  it('mapea la derrota local a jooooder y el empate (draw) a silencio', () => {
    const selectorDefeat = new PvPReactionSelector({ now: mockNow, random: mockRandom });
    const msgDefeat = createMockGameState({
      status: 'playerTwoWon',
      winner: 'playerTwo',
      events: [{ type: 'battleEnded', step: 15, winner: 'playerTwo' }],
    });
    expect(selectorDefeat.evaluateGameState(msgDefeat, 'playerOne')).toBe('jooooder');

    const selectorDraw = new PvPReactionSelector({ now: mockNow, random: mockRandom });
    const msgDraw = createMockGameState({
      status: 'draw',
      winner: 'draw',
      events: [{ type: 'battleEnded', step: 15, winner: 'draw' }],
    });
    expect(selectorDraw.evaluateGameState(msgDraw, 'playerOne')).toBeNull();
  });

  it('evita la repetición inmediata de la última frase cuando existen alternativas en el pool', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom, cooldownMs: 0 });

    // Pool de attackBlocked: ['mierda', 'joder']
    const msgBlocked = createMockGameState({
      events: [{ type: 'sabotageBlocked', step: 10, source: 'playerOne', target: 'playerTwo', sabotage: 'residuos', reason: 'immunity' }],
    });

    const first = selector.evaluateGameState(msgBlocked, 'playerOne');
    expect(['mierda', 'joder']).toContain(first);

    currentTime = 1100;
    const second = selector.evaluateGameState(msgBlocked, 'playerOne');
    expect(['mierda', 'joder']).toContain(second);
    expect(second).not.toBe(first);
  });


  it('respeta la probabilidad inyectada y no reproduce si la tirada no supera el umbral', () => {
    randomValue = 0.99; // 99% fallará las probabilidades de 35%, 50% y 60%
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom });

    const msgGarbage = createMockGameState({
      events: [{ type: 'participantEvent', step: 10, participant: 'playerOne', event: { type: 'garbageApplied', step: 10, linesCount: 2 } }],
    });

    expect(selector.evaluateGameState(msgGarbage, 'playerOne')).toBeNull();
  });

  it('limpia el estado mediante reset()', () => {
    const selector = new PvPReactionSelector({ now: mockNow, random: mockRandom });

    const msgVictory = createMockGameState({
      status: 'playerOneWon',
      winner: 'playerOne',
      events: [{ type: 'battleEnded', step: 15, winner: 'playerOne' }],
    });
    expect(selector.evaluateGameState(msgVictory, 'playerOne')).toBe('a_tomar_por_culo');

    selector.reset();

    // Al resetear, puede volver a activarse una victoria para una nueva partida
    expect(selector.evaluateGameState(msgVictory, 'playerOne')).toBe('a_tomar_por_culo');
  });
});
