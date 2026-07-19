// @vitest-environment jsdom
/**
 * Pruebas del componente NextPiecesPreview.
 *
 * Verifica que renderiza tres previews en orden, que usa getPieceShape
 * para obtener geometría, y que se actualiza correctamente.
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import NextPiecesPreview from './NextPiecesPreview.vue';

describe('NextPiecesPreview.vue', () => {
  it('muestra tres elementos para tres piezas', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    const slots = wrapper.findAll('.preview-slot');
    expect(slots).toHaveLength(3);
  });

  it('conserva el orden recibido (primera, segunda, tercera)', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['S', 'Z', 'J'],
      },
    });

    const orderLabels = wrapper.findAll('.preview-order');
    expect(orderLabels[0]!.text()).toBe('1.');
    expect(orderLabels[1]!.text()).toBe('2.');
    expect(orderLabels[2]!.text()).toBe('3.');
  });

  it('muestra el tipo de cada pieza como texto', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['L', 'J', 'I'],
      },
    });

    const typeLabels = wrapper.findAll('.preview-type');
    expect(typeLabels[0]!.text()).toBe('L');
    expect(typeLabels[1]!.text()).toBe('J');
    expect(typeLabels[2]!.text()).toBe('I');
  });

  it('se actualiza al cambiar la prop nextPieces', async () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['I', 'O', 'T'],
      },
    });

    expect(wrapper.findAll('.preview-slot')).toHaveLength(3);
    expect(wrapper.find('.preview-type').text()).toBe('I');

    await wrapper.setProps({ nextPieces: ['S', 'Z', 'J'] });

    expect(wrapper.findAll('.preview-slot')).toHaveLength(3);
    expect(wrapper.find('.preview-type').text()).toBe('S');
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

    // Verificar que I tiene bounding box 4×1 (64px × 16px)
    const grids = wrapper.findAll('.piece-grid');
    const iGrid = grids[0]!.element as HTMLElement;
    expect(iGrid.style.width).toBe('64px');
    expect(iGrid.style.height).toBe('16px');
  });

  it('incluye aria-label descriptivo en cada slot', () => {
    const wrapper = mount(NextPiecesPreview, {
      props: {
        nextPieces: ['T', 'S', 'Z'],
      },
    });

    const slots = wrapper.findAll('.preview-slot');
    expect(slots[0]!.attributes('aria-label')).toBe('Próxima pieza 1: T');
    expect(slots[1]!.attributes('aria-label')).toBe('Próxima pieza 2: S');
    expect(slots[2]!.attributes('aria-label')).toBe('Próxima pieza 3: Z');
  });
});
