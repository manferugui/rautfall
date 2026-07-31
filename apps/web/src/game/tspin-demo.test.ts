// @vitest-environment jsdom
/**
 * Pruebas del escenario de desarrollo de T-Spin.
 */
import { describe, expect, it, vi } from 'vitest';

const { demoMock, mockSpies } = vi.hoisted(() => ({
  demoMock: { active: false },
  mockSpies: {
    createTSpinDemoEngine: vi.fn(),
  }
}));

vi.mock('./tspin-demo', async (importOriginal) => {
  const original = await importOriginal<typeof import('./tspin-demo')>();
  return {
    ...original,
    isTSpinDemoActive: (override?: string) => {
      if (override !== undefined) {
        return original.isTSpinDemoActive(override);
      }
      return demoMock.active;
    },
    createTSpinDemoEngine: (...args: Parameters<typeof original.createTSpinDemoEngine>) => {
      mockSpies.createTSpinDemoEngine(...args);
      return original.createTSpinDemoEngine(...args);
    }
  };
});

vi.mock('phaser', () => {
  return {
    default: {
      Scene: class DummyScene {
        events = {
          once: vi.fn(),
          off: vi.fn(),
        };
        input = {
          keyboard: {
            on: vi.fn(),
            off: vi.fn(),
          },
        };
      },
      Input: {
        Keyboard: {
          JustDown: vi.fn().mockReturnValue(false),
          KeyCodes: {
            LEFT: 1, RIGHT: 2, UP: 3, DOWN: 4, SPACE: 5, Z: 6, R: 7, ESC: 8, C: 9
          }
        }
      }
    }
  };
});

describe('isTSpinDemoActive (URL parsing)', () => {
  it('parámetro correcto con searchOverride detecta en DEV', async () => {
    const { isTSpinDemoActive } = await import('./tspin-demo');
    expect(isTSpinDemoActive('?tspin-demo=1')).toBe(true);
  });

  it('ausencia de parámetro no detecta', async () => {
    const { isTSpinDemoActive } = await import('./tspin-demo');
    expect(isTSpinDemoActive('')).toBe(false);
  });

  it('valor incorrecto no detecta', async () => {
    const { isTSpinDemoActive } = await import('./tspin-demo');
    expect(isTSpinDemoActive('?tspin-demo=0')).toBe(false);
  });
});

describe('estado inicial del escenario', () => {
  it('prepara tablero, pieza T, esquinas y contadores exactos', async () => {
    const { getTSpinDemoState } = await import('./tspin-demo');
    const state = getTSpinDemoState();

    expect(state.activePiece.type).toBe('T');
    expect(state.activePiece.x).toBe(3);
    expect(state.activePiece.y).toBe(15);
    expect(state.activePiece.orientation).toBe(0); // Spawn
    expect(state.nextPieces).toEqual(['I', 'O', 'L']);
    expect(state.heldPiece).toBeNull();
    // Esquinas ocupadas
    expect(state.board[17]![3]).not.toBeNull();
    expect(state.board[17]![5]).not.toBeNull();
    expect(state.board[15]![3]).not.toBeNull();
    expect(state.board[15]![5]).not.toBeNull();
    // Celdas de la T libres
    expect(state.board[15]![4]).toBeNull();
    expect(state.board[16]![3]).toBeNull();
    expect(state.board[16]![4]).toBeNull();
    expect(state.board[16]![5]).toBeNull();
  });
});

describe('resultado exacto del escenario', () => {
  it('↑ + Space produce T-Spin sin líneas: score 400, combo 0, backToBack 0', async () => {
    const { createTSpinDemoEngine } = await import('./tspin-demo');
    const engine = createTSpinDemoEngine();
    engine.drainEvents();

    const before = engine.getSnapshot();
    expect(before.score).toBe(0);
    expect(before.combo).toBe(0);
    expect(before.backToBack).toBe(0);
    expect(before.activePiece?.type).toBe('T');

    // Paso 1: rotación horaria
    engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true });
    engine.drainEvents();

    // Paso 2: hard drop (distancia 0)
    engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true });

    const after = engine.getSnapshot();
    expect(after.score).toBe(400);
    expect(after.combo).toBe(0);
    expect(after.backToBack).toBe(0);
  });

  it('↑ + delay + Space (simulación manual) produce exactamente T-Spin sin líneas: score 400', async () => {
    const { createTSpinDemoEngine } = await import('./tspin-demo');
    const engine = createTSpinDemoEngine();
    engine.drainEvents();

    // Paso 1: rotación horaria
    engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true });
    engine.drainEvents();

    // Simular delay de 30 ticks de 10ms (300ms)
    for (let i = 0; i < 30; i++) {
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false });
    }

    // Paso 3: hard drop
    engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true });

    const after = engine.getSnapshot();
    expect(after.score).toBe(400);
    expect(after.combo).toBe(0);
    expect(after.backToBack).toBe(0);
  });

  it('es reproducible: dos motores con la misma secuencia producen el mismo resultado', async () => {
    const { createTSpinDemoEngine } = await import('./tspin-demo');
    const run = () => {
      const engine = createTSpinDemoEngine();
      engine.drainEvents();
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true });
      engine.drainEvents();
      engine.step({ leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true });
      return engine.getSnapshot();
    };
    const a = run();
    const b = run();
    expect(a.score).toBe(b.score);
    expect(a.combo).toBe(b.combo);
    expect(a.backToBack).toBe(b.backToBack);
  });
});

describe('TSPIN_DEMO_HELP', () => {
  it('documenta la secuencia y el resultado esperado', async () => {
    const { TSPIN_DEMO_HELP } = await import('./tspin-demo');
    expect(TSPIN_DEMO_HELP).toContain('score final: 400');
    expect(TSPIN_DEMO_HELP).toContain('combo final: 0');
    expect(TSPIN_DEMO_HELP).toContain('backToBack final: 0');
  });
});

describe('GameScene - conexión con tspin-demo', () => {
  it('usa el motor de demo cuando isTSpinDemoActive es true', async () => {
    const { GameScene } = await import('./scenes/GameScene');
    const gameEngine = await import('@rautfall/game-engine');

    demoMock.active = true;
    mockSpies.createTSpinDemoEngine.mockClear();
    const spyNormal = vi.spyOn(gameEngine, 'createGameEngine');

    const scene = new GameScene();
    const mockKey = { isDown: false };
    const sceneObj = scene as unknown as { cursors: unknown; resetEngine: () => void };
    sceneObj.cursors = {
      left: mockKey,
      right: mockKey,
      up: mockKey,
      down: mockKey,
      space: mockKey,
      z: mockKey,
      r: mockKey,
      esc: mockKey,
      c: mockKey,
    };

    sceneObj.resetEngine();

    expect(mockSpies.createTSpinDemoEngine).toHaveBeenCalledTimes(1);
    expect(spyNormal).toHaveBeenCalled();
    expect(spyNormal.mock.calls[0]![1]).toBeDefined(); // initialState de demo

    spyNormal.mockRestore();
  });

  it('usa el motor normal cuando isTSpinDemoActive es false', async () => {
    const { GameScene } = await import('./scenes/GameScene');
    const gameEngine = await import('@rautfall/game-engine');

    demoMock.active = false;
    mockSpies.createTSpinDemoEngine.mockClear();
    const spyNormal = vi.spyOn(gameEngine, 'createGameEngine');

    const scene = new GameScene();
    const mockKey = { isDown: false };
    const sceneObj = scene as unknown as { cursors: unknown; resetEngine: () => void };
    sceneObj.cursors = {
      left: mockKey,
      right: mockKey,
      up: mockKey,
      down: mockKey,
      space: mockKey,
      z: mockKey,
      r: mockKey,
      esc: mockKey,
      c: mockKey,
    };

    sceneObj.resetEngine();

    expect(mockSpies.createTSpinDemoEngine).not.toHaveBeenCalled();
    expect(spyNormal).toHaveBeenCalled();
    expect(spyNormal.mock.calls[0]![1]).toBeUndefined(); // sin initialState

    spyNormal.mockRestore();
  });
});

