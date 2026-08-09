/**
 * Escenario de desarrollo para la audición y exportación de efectos de sonido sintéticos (SFX LAB).
 *
 * Disponible exclusivamente en entorno de desarrollo (`import.meta.env.DEV`) con la query parameter `?sfx-lab=1`.
 * En producción devuelve `false` incondicionalmente.
 */

export function isSfxLabActive(searchOverride?: string): boolean {
  if (typeof import.meta === 'undefined') return false;
  if (!import.meta.env) return false;
  if (!import.meta.env.DEV) return false;
  if (searchOverride === undefined && typeof window === 'undefined') return false;
  const search = searchOverride ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(search).get('sfx-lab') === '1';
}
