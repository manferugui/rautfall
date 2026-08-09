import { describe, expect, it } from 'vitest';
import {
  isBattleDemoActive,
  isSuddenDeathDemoActive,
  isInterferenceDemoActive,
  createBattleDemoSession,
  BATTLE_DEMO_HELP,
} from './battle-demo';

describe('battle-demo', () => {
  it('isBattleDemoActive devuelve false cuando no está la query param ?battle-demo=1', () => {
    expect(isBattleDemoActive('?foo=bar')).toBe(false);
    expect(isBattleDemoActive('')).toBe(false);
  });

  it('isBattleDemoActive devuelve true cuando la query param ?battle-demo=1 está presente en DEV', () => {
    expect(isBattleDemoActive('?battle-demo=1')).toBe(true);
    expect(isBattleDemoActive('?foo=bar&battle-demo=1')).toBe(true);
  });

  it('isBattleDemoActive devuelve false si no está en entorno DEV (PROD guard)', () => {
    const originalDev = import.meta.env.DEV;
    try {
      (import.meta.env as { DEV: boolean }).DEV = false;
      expect(isBattleDemoActive('?battle-demo=1')).toBe(false);
    } finally {
      (import.meta.env as { DEV: boolean }).DEV = originalDev;
    }
  });

  it('isSuddenDeathDemoActive devuelve true solo cuando ?battle-demo=1&sudden-death-demo=1 están en DEV', () => {
    expect(isSuddenDeathDemoActive('?battle-demo=1&sudden-death-demo=1')).toBe(true);
    expect(isSuddenDeathDemoActive('?battle-demo=1')).toBe(false);
    expect(isSuddenDeathDemoActive('?sudden-death-demo=1')).toBe(false);
  });

  it('isInterferenceDemoActive devuelve true cuando ?battle-demo=1&interference-demo=1 o ?bot-sabotage=interferencia están en DEV', () => {
    expect(isInterferenceDemoActive('?battle-demo=1&interference-demo=1')).toBe(true);
    expect(isInterferenceDemoActive('?battle-demo=1&bot-sabotage=interferencia')).toBe(true);
    expect(isInterferenceDemoActive('?battle-demo=1')).toBe(false);
  });

  it('createBattleDemoSession instancia una BattleSession válida y precarga P1 si isInterferenceDemoActive es true', () => {
    const session = createBattleDemoSession({
      playerOneInitialState: { storedSabotages: ['interferencia', 'interferencia'] },
    });
    const snap = session.getSnapshot();

    expect(snap.step).toBe(0);
    expect(snap.status).toBe('running');
    expect(snap.winner).toBeNull();
    expect(snap.playerOne.storedSabotages).toEqual(['interferencia', 'interferencia']);
  });

  it('BATTLE_DEMO_HELP contiene el mensaje de ayuda', () => {
    expect(BATTLE_DEMO_HELP).toContain('Battle Demo');
  });
});
