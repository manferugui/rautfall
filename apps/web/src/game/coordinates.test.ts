import { describe, expect, it } from 'vitest';
import {
  boardXToCanvas,
  boardYToCanvas,
  isRowVisible,
  CELL_SIZE,
  HIDDEN_ROWS,
} from './coordinates';

describe('coordenadas y visibilidad', () => {
  it('filas 0 a 3 se excluyen (no visibles)', () => {
    for (let y = 0; y < HIDDEN_ROWS; y++) {
      expect(isRowVisible(y)).toBe(false);
    }
  });

  it('fila interna 4 se convierte en visible 0', () => {
    expect(isRowVisible(4)).toBe(true);
    expect(boardYToCanvas(4)).toBe(0);
  });

  it('fila interna 23 se convierte en visible 19', () => {
    expect(isRowVisible(23)).toBe(true);
    expect(boardYToCanvas(23)).toBe(19 * CELL_SIZE);
  });

  it('coordenada x se convierte correctamente a píxeles', () => {
    expect(boardXToCanvas(0)).toBe(0);
    expect(boardXToCanvas(3)).toBe(3 * CELL_SIZE);
    expect(boardXToCanvas(5)).toBe(5 * CELL_SIZE);
    expect(boardXToCanvas(9)).toBe(9 * CELL_SIZE);
  });

  it('coordenada visible y se convierte correctamente a píxeles', () => {
    for (let internalY = HIDDEN_ROWS; internalY < 24; internalY++) {
      const expectedY = (internalY - HIDDEN_ROWS) * CELL_SIZE;
      expect(boardYToCanvas(internalY)).toBe(expectedY);
    }
  });
});
