// @vitest-environment jsdom
/**
 * Pruebas del componente HeldPiecePreview.
 *
 * Verifica que muestra correctamente el estado vacío y la representación
 * de cada tipo de pieza mediante getPieceShape de @rautfall/game-engine.
 *
 * El rediseño industrial (Tarea 0031) quitó el label de texto `.piece-type`
 * (el tipo de pieza ya no se muestra como texto, solo visualmente vía las
 * celdas de color) y subió el tamaño de celda de 18px a 22px.
 */

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import HeldPiecePreview from './HeldPiecePreview.vue';
import { getPieceShape, type PieceType } from '@rautfall/game-engine';

const ALL_TYPES: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

describe('HeldPiecePreview.vue', () => {
  it('expone data-testid="held-piece-preview" en el contenedor raíz', () => {
    const wrapper = mount(HeldPiecePreview, {
      props: { heldPiece: null },
    });
    expect(wrapper.find('[data-testid="held-piece-preview"]').exists()).toBe(true);
  });

  it('con heldPiece=null muestra el texto VACÍO', () => {
    const wrapper = mount(HeldPiecePreview, {
      props: { heldPiece: null },
    });
    expect(wrapper.find('.empty-slot').exists()).toBe(true);
    expect(wrapper.find('.empty-text').text()).toBe('VACÍO');
  });

  it('con heldPiece=null no muestra la sección de pieza', () => {
    const wrapper = mount(HeldPiecePreview, {
      props: { heldPiece: null },
    });
    expect(wrapper.find('.piece-grid').exists()).toBe(false);
  });

  it.each(ALL_TYPES)('representa exactamente cuatro celdas para la pieza %s', (type) => {
    const wrapper = mount(HeldPiecePreview, {
      props: { heldPiece: type },
    });
    const cells = wrapper.findAll('.piece-cell');
    expect(cells).toHaveLength(4);
  });

  it('usa getPieceShape para obtener la geometría de cada pieza', () => {
    for (const type of ALL_TYPES) {
      const wrapper = mount(HeldPiecePreview, {
        props: { heldPiece: type },
      });
      const shape = getPieceShape(type);
      const grid = wrapper.find('.piece-grid').element as HTMLElement;
      const expectedWidth = shape.width * 22;
      const expectedHeight = shape.height * 22;
      expect(grid.style.width).toBe(`${expectedWidth}px`);
      expect(grid.style.height).toBe(`${expectedHeight}px`);
    }
  });

  it('no contiene geometría propia (las celdas se derivan de getPieceShape)', () => {
    const wrapper = mount(HeldPiecePreview, {
      props: { heldPiece: 'T' },
    });
    const cells = wrapper.findAll('.piece-cell');
    expect(cells).toHaveLength(4);
    // Verificar posiciones absolutas dentro de la rejilla
    for (const cell of cells) {
      const style = cell.attributes('style') ?? '';
      expect(style).toContain('position: absolute');
    }
  });
});
