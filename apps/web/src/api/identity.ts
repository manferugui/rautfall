const PLAYER_ID_KEY = 'rautfall_player_id';
const PLAYER_NAME_KEY = 'rautfall_player_name';

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
 * Obtiene el alias del jugador o deriva uno estable a partir de su UUID (ej. "Jugador-A7F2").
 */
export function getPlayerName(playerId?: string): string {
  const customName = localStorage.getItem(PLAYER_NAME_KEY);
  if (customName && customName.trim().length > 0) {
    return customName.trim().slice(0, 30);
  }

  const id = playerId || getOrCreatePlayerId();
  const suffix = id.replace(/-/g, '').slice(-4).toUpperCase();
  return `Jugador-${suffix}`;
}
