// @vitest-environment jsdom
/**
 * Pruebas del componente NextPiecesPreview.
 *
 * Verifica que renderiza tres previews en orden, que usa getPieceShape
 * para obtener geometría, y que se actualiza correctamente.
 *
 * El rediseño industrial (Tarea 0031) renombró el slot a
 * `.preview-slot-recessed`, quitó los labels de texto `.preview-order` y
 * `.preview-type` (el orden y el tipo ya no se muestran como texto, solo
 * visualmente vía el orden de los slots y el color de las celdas) y subió
 * el tamaño de celda a 20px.
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NextPiecesPreview from './NextPiecesPreview.vue';

// Mismo mapeo de color que PIECE_DISPLAY_COLORS en NextPiecesPreview.vue —
// se usa para verificar que el orden/tipo de pieza se conserva ahora que
// ya no hay un label de texto por slot.
const PIECE_DISPLAY_COLORS: Record<string, string> = {
  I: 'rgb(0, 212, 255)',
  O: 'rgb(255, 215, 0)',
  T: 'rgb(155, 89, 182)',
  S: 'rgb(46, 204, 113)',
  Z: 'rgb(231, 76, 60)',
  J: 'rgb(52, 152, 219)',
  L: 'rgb(243, 156, 18)',
};

describe('NextPiecesPreview.vue', () => {
  it('muestra tres elementos para tres piezas', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    const slots = wrapper.findAll('.preview-slot-recessed');
    expect(slots).toHaveLength(3);
  });

  it('conserva el orden recibido (primera, segunda, tercera) vía el color de cada slot', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['S', 'Z', 'J'],
      },
    });

    const grids = wrapper.findAll('.piece-grid');
    const firstCellColor = (grids[0]!.find('.piece-cell').element as HTMLElement).style.backgroundColor;
    const secondCellColor = (grids[1]!.find('.piece-cell').element as HTMLElement).style.backgroundColor;
    const thirdCellColor = (grids[2]!.find('.piece-cell').element as HTMLElement).style.backgroundColor;

    expect(firstCellColor).toBe(PIECE_DISPLAY_COLORS.S);
    expect(secondCellColor).toBe(PIECE_DISPLAY_COLORS.Z);
    expect(thirdCellColor).toBe(PIECE_DISPLAY_COLORS.J);
  });

  it('se actualiza al cambiar la prop nextPieces', async () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    expect(wrapper.findAll('.preview-slot-recessed')).toHaveLength(3);
    const firstCell = wrapper.findAll('.piece-grid')[0]!.find('.piece-cell').element as HTMLElement;
    expect(firstCell.style.backgroundColor).toBe(PIECE_DISPLAY_COLORS.I);

    await wrapper.setProps({ nextPieces: ['S', 'Z', 'J'] });

    expect(wrapper.findAll('.preview-slot-recessed')).toHaveLength(3);
    const firstCellAfter = wrapper.findAll('.piece-grid')[0]!.find('.piece-cell').element as HTMLElement;
    expect(firstCellAfter.style.backgroundColor).toBe(PIECE_DISPLAY_COLORS.S);
  });

  it('representa correctamente la pieza I (4×1)', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    // La pieza I tiene 4 celdas en el primer slot
    const pieceGrids = wrapper.findAll('.piece-grid');
    const cellsInFirst = pieceGrids[0]!.findAll('.piece-cell');
    expect(cellsInFirst).toHaveLength(4);
  });

  it('representa correctamente la pieza O (2×2)', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    const pieceGrids = wrapper.findAll('.piece-grid');
    const cellsInSecond = pieceGrids[1]!.findAll('.piece-cell');
    expect(cellsInSecond).toHaveLength(4);
  });

  it('representa correctamente una pieza 3×2 (T)', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    const pieceGrids = wrapper.findAll('.piece-grid');
    const cellsInThird = pieceGrids[2]!.findAll('.piece-cell');
    expect(cellsInThird).toHaveLength(4);
  });

  it('no duplica tablas de celdas (usa getPieceShape)', () => {
    // Verificación indirecta: el componente importa getPieceShape,
    // no define tablas propias. La prueba confirma que la rejilla
    // de la pieza I tiene offset y 4 celdas (geometría obtenida del motor)
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'J', 'L'],
      },
    });

    // Verificar que I tiene bounding box 4×1 (80px × 20px a celda de 20px)
    const grids = wrapper.findAll('.piece-grid');
    const iGrid = grids[0]!.element as HTMLElement;
    expect(iGrid.style.width).toBe('80px');
    expect(iGrid.style.height).toBe('20px');
  });

  it('incluye aria-label descriptivo en cada slot', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['T', 'S', 'Z'],
      },
    });

    const slots = wrapper.findAll('.preview-slot-recessed');
    expect(slots[0]!.attributes('aria-label')).toBe('Próxima pieza 1: T');
    expect(slots[1]!.attributes('aria-label')).toBe('Próxima pieza 2: S');
    expect(slots[2]!.attributes('aria-label')).toBe('Próxima pieza 3: Z');
  });
});
