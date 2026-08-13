const PLAYER_ID_KEY = 'rautfall_player_id';
const PLAYER_TAG_KEY = 'rautfall_player_tag';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => {
    const num = Number(c);
    return (num ^ (Math.random() * 16 >> (num / 4))).toString(16);
  });
}

/**
 * Obtiene o genera el UUID de jugador anónimo local.
 * Mantiene intacto rautfall_player_id como clave persistente.
 */
export function getOrCreatePlayerId(): string {
  let playerId = localStorage.getItem(PLAYER_ID_KEY);
  if (!playerId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId)) {
    playerId = generateUuid();
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  }
  return playerId;
}

/**
 * Valida si un tag tiene exactamente 3 caracteres alfanuméricos A-Z y 0-9.
 */
export function isValidPlayerTag(tag: string | null | undefined): boolean {
  if (!tag) return false;
  return /^[A-Z0-9]{3}$/.test(tag);
}

/**
 * Obtiene el tag de jugador almacenado en local storage si existe y es válido.
 */
export function getPlayerTag(): string | null {
  const tag = localStorage.getItem(PLAYER_TAG_KEY);
  if (tag && isValidPlayerTag(tag.toUpperCase())) {
    return tag.toUpperCase();
  }
  return null;
}

/**
 * Comprueba si el jugador local tiene configurado un tag válido de 3 caracteres.
 */
export function hasPlayerTag(): boolean {
  return getPlayerTag() !== null;
}

/**
 * Normaliza y guarda el tag de jugador (exactamente 3 caracteres A-Z, 0-9).
 */
export function setPlayerTag(rawTag: string): string {
  const normalized = rawTag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (isValidPlayerTag(normalized)) {
    localStorage.setItem(PLAYER_TAG_KEY, normalized);
    return normalized;
  }
  return '';
}

/**
 * Obtiene la identidad visible del jugador (tag de 3 caracteres).
 * Si aún no se ha configurado el tag, devuelve un fallback neutro defensivo temporal ("---").
 */
export function getPlayerName(): string {
  const tag = getPlayerTag();
  if (tag) {
    return tag;
  }
  return '---';
}

