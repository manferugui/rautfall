import { describe, expect, it } from 'vitest';
import { armReleaseGuard, clearReleaseGuardKey, resolveHeld, NO_RELEASE_GUARD, type ReleaseGuard } from './input-release-guard';

describe('armReleaseGuard', () => {
  it('crea un guardián con las teclas pulsadas en true y el resto en false', () => {
    const guard = armReleaseGuard({ left: true, right: false, softDrop: false });
    expect(guard.left).toBe(true);
    expect(guard.right).toBe(false);
    expect(guard.softDrop).toBe(false);
  });
});

describe('resolveHeld', () => {
  it('devuelve false cuando la tecla está bloqueada aunque isDown sea true', () => {
    const guard: ReleaseGuard = Object.freeze({ left: true, right: false, softDrop: false });
    expect(resolveHeld(guard, 'left', true)).toBe(false);
  });

  it('devuelve true cuando no está bloqueada e isDown es true', () => {
    const guard: ReleaseGuard = Object.freeze({ left: false, right: false, softDrop: false });
    expect(resolveHeld(guard, 'left', true)).toBe(true);
  });

  it('devuelve false con NO_RELEASE_GUARD cuando isDown es false', () => {
    expect(resolveHeld(NO_RELEASE_GUARD, 'right', false)).toBe(false);
  });
});

describe('clearReleaseGuardKey', () => {
  it('limpia solo la tecla indicada dejando las demás intactas', () => {
    const guard: ReleaseGuard = Object.freeze({ left: true, right: true, softDrop: false });
    const updated = clearReleaseGuardKey(guard, 'left');
    expect(updated.left).toBe(false);
    expect(updated.right).toBe(true);
    expect(updated.softDrop).toBe(false);
  });

  it('es no-op cuando la tecla ya está en false', () => {
    const guard: ReleaseGuard = Object.freeze({ left: false, right: true, softDrop: false });
    const updated = clearReleaseGuardKey(guard, 'left');
    expect(updated).toBe(guard);
  });
});

describe('integración armReleaseGuard + clearReleaseGuardKey + resolveHeld', () => {
  it('tras armar, limpiar y resolver refleja el isDown real', () => {
    let guard = armReleaseGuard({ left: true, right: false, softDrop: false });
    // Mientras está bloqueada, isDown=true se ignora
    expect(resolveHeld(guard, 'left', true)).toBe(false);
    // Se suelta físicamente y luego se limpia el guardián
    guard = clearReleaseGuardKey(guard, 'left');
    // Ahora con isDown=false (tecla ya no pulsada) devuelve false
    expect(resolveHeld(guard, 'left', false)).toBe(false);
    // Vuelve a pulsarse
    expect(resolveHeld(guard, 'left', true)).toBe(true);
  });
});
