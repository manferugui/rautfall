/**
 * Transformación de coordenadas del tablero interno (10×24) a píxeles del
 * canvas (10×20 visibles).
 */

export const CELL_SIZE = 32;
export const HIDDEN_ROWS = 4;
export const VISIBLE_ROWS = 20;
export const VISIBLE_COLS = 10;

/** Ancho lógico del canvas: 10 columnas × 32 px */
export const CANVAS_WIDTH = VISIBLE_COLS * CELL_SIZE; // 320
/** Alto lógico del canvas: 20 filas visibles × 32 px */
export const CANVAS_HEIGHT = VISIBLE_ROWS * CELL_SIZE; // 640

/**
 * Convierte coordenada de columna del tablero (0-9) a píxel x del canvas.
 */
export function boardXToCanvas(x: number): number {
  return x * CELL_SIZE;
}

/**
 * Convierte coordenada de fila interna del tablero (0-23) a píxel y del canvas,
 * teniendo en cuenta que solo las filas 4-23 son visibles.
 * Internamente fila 4 → canvas y=0, fila 23 → canvas y=19.
 *
 * @param internalY fila en coordenadas del motor (0-23)
 * @returns coordenada y en píxeles, o -1 si la fila es oculta
 */
export function boardYToCanvas(internalY: number): number {
  return (internalY - HIDDEN_ROWS) * CELL_SIZE;
}

/**
 * Indica si una fila interna (0-23) es visible en el canvas.
 */
export function isRowVisible(internalY: number): boolean {
  return internalY >= HIDDEN_ROWS && internalY < HIDDEN_ROWS + VISIBLE_ROWS;
}
