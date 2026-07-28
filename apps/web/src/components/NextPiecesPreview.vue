<script setup lang="ts">
/**
 * Componente técnico provisional que muestra las tres próximas piezas.
 *
 * Responsabilidades:
 * - Recibir `nextPieces` como prop (tres PieceType).
 * - Mostrar cada pieza con su geometría real, obtenida exclusivamente
 *   vía `getPieceShape()` desde `@rautfall/game-engine`.
 * - No mantener cola paralela, no generar piezas, no replicar tablas.
 * - Identificar orden mediante texto (1, 2, 3) además del color.
 */

import { computed } from 'vue';
import { getPieceShape, type PieceType } from '@rautfall/game-engine';

const props = defineProps<{
  nextPieces: readonly PieceType[];
}>();

const PIECE_DISPLAY_COLORS: Record<PieceType, string> = {
  I: '#00d4ff',
  O: '#ffd700',
  T: '#9b59b6',
  S: '#2ecc71',
  Z: '#e74c3c',
  J: '#3498db',
  L: '#f39c12',
};

const CELL_SIZE_PX = 16;

interface PreviewPiece {
  type: PieceType;
  label: string;
  color: string;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  width: number;
  height: number;
}

const previews = computed<PreviewPiece[]>(() => {
  return props.nextPieces.map((type) => {
    const shape = getPieceShape(type);
    return {
      type,
      label: type,
      color: PIECE_DISPLAY_COLORS[type],
      cells: shape.cells,
      width: shape.width,
      height: shape.height,
    };
  });
});
</script>

<template>
  <div class="next-pieces-preview" data-testid="next-pieces-preview">
    <h2 class="preview-heading">Próximas piezas</h2>
    <ol class="preview-list">
      <li
        v-for="(preview, index) in previews"
        :key="index"
        class="preview-slot"
        :aria-label="`Próxima pieza ${index + 1}: ${preview.label}`"
      >
        <span class="preview-order">{{ index + 1 }}.</span>
        <span class="preview-type">{{ preview.label }}</span>
        <div
          class="piece-grid"
          :style="{
            width: preview.width * CELL_SIZE_PX + 'px',
            height: preview.height * CELL_SIZE_PX + 'px',
          }"
        >
          <div
            v-for="(cell, cellIndex) in preview.cells"
            :key="cellIndex"
            class="piece-cell"
            :style="{
              left: cell.x * CELL_SIZE_PX + 'px',
              top: cell.y * CELL_SIZE_PX + 'px',
              width: CELL_SIZE_PX + 'px',
              height: CELL_SIZE_PX + 'px',
              backgroundColor: preview.color,
            }"
          ></div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.preview-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.625rem;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.preview-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-slot {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-order {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
  min-width: 1rem;
}

.preview-type {
  font-size: 0.75rem;
  font-family: monospace;
  color: var(--rf-color-text-primary, #e8e8ec);
  min-width: 1rem;
}

.piece-grid {
  position: relative;
  flex-shrink: 0;
}

.piece-cell {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}
</style>
