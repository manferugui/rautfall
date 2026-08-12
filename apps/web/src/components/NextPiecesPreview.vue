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
    <div class="next-header">
      <span class="preview-heading">NEXT</span>
    </div>
    <div class="preview-slots-container">
      <div
        v-for="(preview, index) in previews"
        :key="index"
        class="preview-slot-recessed"
        :aria-label="`Próxima pieza ${index + 1}: ${preview.label}`"
      >
        <div
          class="piece-grid"
          :style="{
            width: preview.width * 20 + 'px',
            height: preview.height * 20 + 'px',
          }"
        >
          <div
            v-for="(cell, cellIndex) in preview.cells"
            :key="cellIndex"
            class="piece-cell"
            :style="{
              left: cell.x * 20 + 'px',
              top: cell.y * 20 + 'px',
              width: '20px',
              height: '20px',
              backgroundColor: preview.color,
            }"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.next-pieces-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.next-header {
  width: 100%;
  text-align: center;
  padding: 4px 0 8px;
}

.preview-heading {
  font-size: 0.8125rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #a0a4b0;
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
}

.preview-slots-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  align-items: center;
}

.preview-slot-recessed {
  width: 110px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #08090b;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 10px 10px;
  border: 2px solid #1c1e22;
  border-radius: 4px;
  box-shadow:
    inset 0 4px 12px rgba(0, 0, 0, 0.95),
    inset 0 0 0 1px rgba(0, 0, 0, 0.9),
    0 1px 0 rgba(255, 255, 255, 0.08);
}

.piece-grid {
  position: relative;
}

.piece-cell {
  position: absolute;
  box-sizing: border-box;
  border-top: 1px solid rgba(255, 255, 255, 0.28);
  border-left: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  border-right: 1px solid rgba(0, 0, 0, 0.5);
  background-image: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.16) 0%,
    rgba(255, 255, 255, 0) 38%,
    rgba(0, 0, 0, 0) 62%,
    rgba(0, 0, 0, 0.22) 100%
  );
  box-shadow:
    inset 1px 1px 0 rgba(255, 255, 255, 0.22),
    inset -1px -1px 2px rgba(0, 0, 0, 0.4);
  border-radius: 2px;
}
</style>
