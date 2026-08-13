import { describe, expect, it } from 'vitest';
import { createBattleSession } from '@rautfall/battle-engine';
import { prototypeConfig } from '@rautfall/game-config';
import {
  isBattleDemoActive,
  isSuddenDeathDemoActive,
  isInterferenceDemoActive,
  createBattleDemoSession,
  BATTLE_DEMO_INITIAL_SABOTAGES,
  BATTLE_DEMO_HELP,
} from './battle-demo';

function makeStepInput(triggerSabotage = false) {
  return {
    leftHeld: false,
    rightHeld: false,
    leftPressed: false,
    rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
    triggerSabotage,
  };
}

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

  it('createBattleDemoSession en ?battle-demo=1 precarga P1 con la secuencia completa de 4 sabotajes', () => {
    const session = createBattleDemoSession();
    const snap = session.getSnapshot();

    expect(snap.step).toBe(0);
    expect(snap.status).toBe('running');
    expect(snap.playerOne.storedSabotages).toEqual(['residuos', 'sobrecarga', 'polaridad', 'interferencia']);
  });

  it('disparar A consume los sabotajes del cartucho uno a uno vía el flujo real del motor', () => {
    const session = createBattleDemoSession();

    // 1. Disparar primer sabotaje (residuos)
    session.step({ playerOne: makeStepInput(true), playerTwo: makeStepInput(false) });
    const events1 = session.drainEvents();
    expect(events1.some((e) => e.type === 'sabotageRouted' && e.sabotage === 'residuos')).toBe(true);
    expect(session.getSnapshot().playerOne.storedSabotages).toEqual(['sobrecarga', 'polaridad', 'interferencia']);

    // 2. Disparar segundo sabotaje (sobrecarga)
    session.step({ playerOne: makeStepInput(true), playerTwo: makeStepInput(false) });
    const events2 = session.drainEvents();
    expect(events2.some((e) => e.type === 'sabotageRouted' && e.sabotage === 'sobrecarga')).toBe(true);
    expect(session.getSnapshot().playerOne.storedSabotages).toEqual(['polaridad', 'interferencia']);
  });

  it('recrear/resetear la sesión con createBattleDemoSession restaura la carga inicial completa', () => {
    const session = createBattleDemoSession();
    session.step({ playerOne: makeStepInput(true), playerTwo: makeStepInput(false) });
    expect(session.getSnapshot().playerOne.storedSabotages).toHaveLength(3);

    // Reset DEV (equivalente a tecla 0 o reinicio)
    const resetSession = createBattleDemoSession();
    expect(resetSession.getSnapshot().playerOne.storedSabotages).toEqual(BATTLE_DEMO_INITIAL_SABOTAGES);
  });

  it('fuera de la demo (partida normal de producción), P1 arranca sin sabotajes precargados', () => {
    const prodSession = createBattleSession({ seed: 42, config: prototypeConfig });
    expect(prodSession.getSnapshot().playerOne.storedSabotages).toEqual([]);
  });

  it('BATTLE_DEMO_HELP contiene el mensaje de ayuda actualizado', () => {
    expect(BATTLE_DEMO_HELP).toContain('Battle Demo');
    expect(BATTLE_DEMO_HELP).toContain('Pulsar 0');
  });
});
