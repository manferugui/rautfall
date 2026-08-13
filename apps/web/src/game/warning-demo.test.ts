import { describe, it, expect } from 'vitest';
import { prototypeConfig } from '@rautfall/game-config';
import {
  isWarningDemoActive,
  createWarningDemoSession,
  prepareWarningDemoSabotage,
  WARNING_DEMO_HELP,
} from './warning-demo';

function emptyInput() {
  return {
    leftHeld: false,
    rightHeld: false,
    leftPressed: false,
    rightPressed: false,
    softDropHeld: false,
    hardDrop: false,
  };
}

describe('warning-demo (URL parsing y sesión DEV)', () => {
  it('el parámetro ?warning-demo=1 se reconoce solo en desarrollo', () => {
    expect(isWarningDemoActive('?warning-demo=1')).toBe(true);
    expect(isWarningDemoActive('?warning-demo=1&other=abc')).toBe(true);
    expect(isWarningDemoActive('?other=1&warning-demo=1')).toBe(true);

    expect(isWarningDemoActive('')).toBe(false);
    expect(isWarningDemoActive('?battle-demo=1')).toBe(false);
    expect(isWarningDemoActive('?warning-demo=2')).toBe(false);
    expect(isWarningDemoActive('?warning-demo=0')).toBe(false);
    expect(isWarningDemoActive('?warning-demo=true')).toBe(false);
  });

  it('createWarningDemoSession instancia una BattleSession real con semilla 42 por defecto', () => {
    const session = createWarningDemoSession();
    const snap = session.getSnapshot();

    expect(snap.status).toBe('running');
    expect(snap.step).toBe(0);
    expect(snap.playerOne.seed).toBe(42);
    expect(snap.playerTwo.seed).toBe(42);
  });

  it('createWarningDemoSession permite sobreescribir opciones de forma explícita para tests', () => {
    const session = createWarningDemoSession({ seed: 100 });
    const snap = session.getSnapshot();

    expect(snap.playerOne.seed).toBe(100);
    expect(snap.playerTwo.seed).toBe(100);
  });

  it('WARNING_DEMO_HELP contiene el mensaje de ayuda de la demo', () => {
    expect(WARNING_DEMO_HELP).toContain('Warning FX Demo');
    expect(WARNING_DEMO_HELP).toContain('Tecla 1 → SOBRECARGA contra P1');
    expect(WARNING_DEMO_HELP).toContain('Tecla 2 → POLARIDAD contra P1');
    expect(WARNING_DEMO_HELP).toContain('Tecla 3 → INTERFERENCIA contra P1');
    expect(WARNING_DEMO_HELP).toContain('Tecla 0 → RESET DEV de la demo');
  });

  describe('prepareWarningDemoSabotage & Flujo Real de BattleSession', () => {
    it('prepara P2 con el sabotaje conservando semilla, paso de sesión, P1 y warnings/inmunidades de P1', () => {
      const session = createWarningDemoSession({ seed: 42 });

      // Avanzar 10 pasos iniciales
      for (let i = 0; i < 10; i++) {
        session.step({ playerOne: emptyInput(), playerTwo: emptyInput() });
      }

      const snapBefore = session.getSnapshot();
      expect(snapBefore.step).toBe(10);
      expect(snapBefore.elapsedMs).toBe(100);
      expect(snapBefore.playerOne.seed).toBe(42);

      // Preparar P2 con sobrecarga
      prepareWarningDemoSabotage(session, 'sobrecarga');

      const snapAfterEquip = session.getSnapshot();
      expect(snapAfterEquip.step).toBe(10);
      expect(snapAfterEquip.elapsedMs).toBe(100);
      expect(snapAfterEquip.playerOne.step).toBe(10);
      expect(snapAfterEquip.playerOne.seed).toBe(42);
      expect(session.getEngine('playerTwo').getSnapshot().storedSabotages).toEqual(['sobrecarga']);
      expect(session.getEngine('playerTwo').getSnapshot().seed).toBe(42);
    });

    it('verificación explícita de fixed step: 750 ms = 75 pasos de 10 ms (74 pasos activo, en paso 75 expira)', () => {
      const session = createWarningDemoSession();
      session.drainEvents();

      // 1. Preparar P2 con sobrecarga y disparar
      prepareWarningDemoSabotage(session, 'sobrecarga');
      session.step({
        playerOne: emptyInput(),
        playerTwo: { ...emptyInput(), triggerSabotage: true },
      });

      const events = session.drainEvents();
      expect(events.some((e) => e.type === 'sabotageRouted')).toBe(true);
      expect(events.some((e) => e.type === 'warningStarted')).toBe(true);

      const snap1 = session.getSnapshot();
      expect(snap1.playerOneState.warnings).toHaveLength(1);
      expect(snap1.playerOneState.warnings[0]!.sabotage).toBe('sobrecarga');
      expect(snap1.playerOneState.warnings[0]!.remainingMs).toBe(750);

      const fixedMs = prototypeConfig.fixedStepMs; // 10 ms
      const totalWarningSteps = Math.ceil(750 / fixedMs); // 75 pasos
      expect(fixedMs).toBe(10);
      expect(totalWarningSteps).toBe(75);

      // 2. Durante 74 pasos adicionales (total 74 transiciones tras el disparo = 740 ms restantes desde 740ms), el warning permanece activo
      for (let i = 0; i < totalWarningSteps - 1; i++) {
        const snap = session.step({ playerOne: emptyInput(), playerTwo: emptyInput() });
        expect(snap.playerOneState.warnings).toHaveLength(1);
        expect(snap.playerOne.activeEffects.some((e) => e.type === 'sobrecarga')).toBe(false);
      }

      // 3. En el paso 75 exacto, ocurre warningExpired y el warning deja de estar en playerOneState.warnings
      const finalSnap = session.step({ playerOne: emptyInput(), playerTwo: emptyInput() });
      const finalEvents = session.drainEvents();

      expect(finalEvents.some((e) => e.type === 'warningExpired')).toBe(true);
      expect(finalSnap.playerOneState.warnings).toHaveLength(0);
      expect(finalSnap.playerOne.activeEffects.some((e) => e.type === 'sobrecarga')).toBe(true);
    });
  });
});
