export type ReleaseGuardKey = 'left' | 'right' | 'softDrop';

/** Bandera por tecla: true mientras la tecla debe ignorarse hasta observar su keyup real. */
export type ReleaseGuard = Readonly<{
  left: boolean;
  right: boolean;
  softDrop: boolean;
}>;

export const NO_RELEASE_GUARD: ReleaseGuard = Object.freeze({ left: false, right: false, softDrop: false });

/** Arma el guardián a partir del estado físico ("isDown") observado en el instante de la transición. */
export function armReleaseGuard(currentlyHeld: { left: boolean; right: boolean; softDrop: boolean }): ReleaseGuard {
  return Object.freeze({ ...currentlyHeld });
}

/** Limpia la bandera de una tecla concreta (se invoca desde el listener real de `keyup`). */
export function clearReleaseGuardKey(guard: ReleaseGuard, key: ReleaseGuardKey): ReleaseGuard {
  if (!guard[key]) return guard;
  return Object.freeze({ ...guard, [key]: false });
}

/** Valor efectivo de "held" que debe llegar al motor: `false` mientras la tecla esté bloqueada. */
export function resolveHeld(guard: ReleaseGuard, key: ReleaseGuardKey, isDown: boolean): boolean {
  return guard[key] ? false : isDown;
}
