import { describe, expect, it } from 'vitest';
import { isBattleDemoActive, createBattleDemoSession, BATTLE_DEMO_HELP } from './battle-demo';

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

  it('createBattleDemoSession instancia una BattleSession válida', () => {
    const session = createBattleDemoSession();
    const snap = session.getSnapshot();

    expect(snap.step).toBe(0);
    expect(snap.status).toBe('running');
    expect(snap.winner).toBeNull();
    expect(snap.playerOne.seed).toBe(42);
    expect(snap.playerTwo.seed).toBe(42);
  });

  it('BATTLE_DEMO_HELP contiene el mensaje de ayuda', () => {
    expect(BATTLE_DEMO_HELP).toContain('Battle Demo');
  });
});
