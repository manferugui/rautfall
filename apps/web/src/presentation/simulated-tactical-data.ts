/**
 * Datos de presentación simulados para el layout Tactical.
 *
 * Este módulo exporta constantes congeladas (Object.freeze) que alimentan
 * OpponentMonitor.vue y CombatStatusPanel.vue.
 *
 * Reglas:
 * - Es código de presentación puro: no depende de Vue, Phaser ni del motor.
 * - No se importa engine ni game-config (ver §17.3, §19 de 0009).
 * - Los valores son literales fijos; no cambian nunca durante la ejecución.
 * - No se amplía GamePresentationState con estos datos: no proceden de Phaser.
 */

/** Número total de columnas del tablero rival. */
export const OPPONENT_BOARD_COLS = 10;

/** Número total de filas del tablero rival. */
export const OPPONENT_BOARD_ROWS = 20;

/** Tamaño en píxeles de cada celda del monitor rival (coincide con NextPiecesPreview). */
export const OPPONENT_CELL_SIZE = 16;

/**
 * Altura ocupada (en filas, contadas desde la base) de cada una de las
 * OPPONENT_BOARD_COLS columnas del tablero rival simulado. Define un
 * perfil irregular ("skyline") en vez de filas completas, para que la
 * pila se lea como una partida real congelada y no como un bloque sólido.
 */
const OPPONENT_COLUMN_STACK_HEIGHTS: readonly number[] = [10, 8, 11, 6, 9, 10, 5, 8, 11, 9];

/** Paleta de color por celda del rival, propia de este módulo (no importada del motor). */
const OPPONENT_CELL_PALETTE: readonly string[] = [
  '#3498db',
  '#e74c3c',
  '#f39c12',
  '#00d4ff',
  '#2ecc71',
  '#9b59b6',
];

function buildOpponentStaticBoard(): ReadonlyArray<Readonly<{ x: number; y: number; color: string }>> {
  const cells: Array<Readonly<{ x: number; y: number; color: string }>> = [];
  OPPONENT_COLUMN_STACK_HEIGHTS.forEach((height, x) => {
    for (let y = OPPONENT_BOARD_ROWS - height; y < OPPONENT_BOARD_ROWS; y++) {
      const color = OPPONENT_CELL_PALETTE[(x + y) % OPPONENT_CELL_PALETTE.length]!;
      cells.push(Object.freeze({ x, y, color }));
    }
  });
  return Object.freeze(cells);
}

/**
 * Coordenadas y color de cada celda ocupada del tablero rival simulado.
 * Representa una pila estática a media altura con perfil irregular, sin
 * pieza activa. Generada una sola vez a partir de OPPONENT_COLUMN_STACK_HEIGHTS
 * (determinista, congelada, puramente presentacional).
 */
export const OPPONENT_STATIC_BOARD = buildOpponentStaticBoard();

/** Estado de enlace simulado del monitor rival (señalética secundaria, sin lógica reactiva). */
export const SIMULATED_OPPONENT_LINK_STATUS = 'ENLACE ESTABLE';

/** Sector simulado del monitor rival (señalética secundaria, sin lógica reactiva). */
export const SIMULATED_OPPONENT_SECTOR = 'SECTOR 04';

/** Canal simulado del monitor rival (señalética secundaria, sin lógica reactiva). */
export const SIMULATED_OPPONENT_CHANNEL = 'CANAL TAC-2';

/** Número de segmentos totales de la barra de energía. */
export const SIMULATED_ENERGY_SEGMENTS = 20;

/** Número de segmentos activos iniciales (sin energía). */
export const SIMULATED_ENERGY_ACTIVE = 0;

/** Texto fijo del cartucho simulado. */
export const SIMULATED_CARTRIDGE_LABEL = 'Cartucho — prototipo';

/** Valor fijo del contador de Residuos. */
export const SIMULATED_RESIDUES_COUNT = 0;
