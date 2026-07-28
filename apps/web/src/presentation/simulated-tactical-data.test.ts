/**
 * Pruebas del módulo de datos de presentación simulados.
 *
 * Ver docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md §21.3.
 */

import { describe, expect, it } from 'vitest';
import {
  OPPONENT_STATIC_BOARD,
  OPPONENT_BOARD_COLS,
  OPPONENT_BOARD_ROWS,
  SIMULATED_ENERGY_SEGMENTS,
  SIMULATED_ENERGY_ACTIVE,
  SIMULATED_RESIDUES_COUNT,
  SIMULATED_OPPONENT_LINK_STATUS,
  SIMULATED_OPPONENT_SECTOR,
  SIMULATED_OPPONENT_CHANNEL,
} from './simulated-tactical-data';

describe('simulated-tactical-data', () => {
  it('OPPONENT_STATIC_BOARD está congelado', () => {
    expect(Object.isFrozen(OPPONENT_STATIC_BOARD)).toBe(true);
  });

  it('todas las coordenadas del tablero rival están dentro de los límites 10×20', () => {
    for (const cell of OPPONENT_STATIC_BOARD) {
      expect(cell.x).toBeGreaterThanOrEqual(0);
      expect(cell.x).toBeLessThan(OPPONENT_BOARD_COLS);
      expect(cell.y).toBeGreaterThanOrEqual(0);
      expect(cell.y).toBeLessThan(OPPONENT_BOARD_ROWS);
    }
  });

  it('no hay coordenadas duplicadas en OPPONENT_STATIC_BOARD', () => {
    const seen = new Set<string>();
    for (const cell of OPPONENT_STATIC_BOARD) {
      const key = `${cell.x},${cell.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('ENERGY_SEGMENTS es coherente con ENERGY_ACTIVE', () => {
    expect(SIMULATED_ENERGY_ACTIVE).toBeLessThanOrEqual(SIMULATED_ENERGY_SEGMENTS);
    expect(SIMULATED_ENERGY_SEGMENTS).toBeGreaterThan(0);
  });

  it('RESIDUES_COUNT es un número', () => {
    expect(typeof SIMULATED_RESIDUES_COUNT).toBe('number');
  });

  it('la señalética secundaria del rival es texto fijo no vacío', () => {
    expect(SIMULATED_OPPONENT_LINK_STATUS.length).toBeGreaterThan(0);
    expect(SIMULATED_OPPONENT_SECTOR.length).toBeGreaterThan(0);
    expect(SIMULATED_OPPONENT_CHANNEL.length).toBeGreaterThan(0);
  });
});
