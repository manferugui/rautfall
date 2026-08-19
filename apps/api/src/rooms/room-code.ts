import { RoomError } from './errors.js';

export const UNAMBIGUOUS_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 5;
export const MAX_CODE_GENERATION_ATTEMPTS = 10;

/**
 * Genera un código de sala corto y fácil de compartir usando un alfabeto inequívoco.
 *
 * @param existsFn Función para verificar si un código ya existe en el almacenamiento.
 * @param rngFn Generador de números aleatorios en [0, 1), por defecto Math.random.
 * @returns Un código de sala único de 5 caracteres.
 * @throws {RoomError} 'ROOM_CODE_GENERATION_FAILED' si se supera el número máximo de reintentos.
 */
export function generateRoomCode(
  existsFn: (code: string) => boolean,
  rngFn: () => number = Math.random,
): string {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      const randomIndex = Math.floor(rngFn() * UNAMBIGUOUS_ALPHABET.length);
      code += UNAMBIGUOUS_ALPHABET[randomIndex];
    }

    if (!existsFn(code)) {
      return code;
    }
  }

  throw new RoomError(
    'ROOM_CODE_GENERATION_FAILED',
    'Failed to generate a unique room code after maximum attempts.',
  );
}
