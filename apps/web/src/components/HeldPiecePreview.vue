<script setup lang="ts">
import { computed } from 'vue';
import { getPieceShape, type PieceType } from '@rautfall/game-engine';

const props = defineProps<{
  heldPiece: PieceType | null;
}>();

const pieceColors: Record<PieceType, string> = {
  I: '#00d4ff',
  O: '#ffd700',
  T: '#9b59b6',
  S: '#2ecc71',
  Z: '#e74c3c',
  J: '#3498db',
  L: '#f39c12',
};

const shape = computed(() => {
  if (!props.heldPiece) return null;
  return getPieceShape(props.heldPiece);
});
</script>

<template>
  <div class="held-piece-preview" data-testid="held-piece-preview">
    <span class="preview-label">Reserva</span>
    <div v-if="heldPiece && shape" class="piece-display">
      <div class="piece-grid" :style="{ width: shape.width * 18 + 'px', height: shape.height * 18 + 'px' }">
        <div
          v-for="(cell, idx) in shape.cells"
          :key="idx"
          class="piece-cell"
          :style="{
            position: 'absolute',
            left: cell.x * 18 + 'px',
            top: cell.y * 18 + 'px',
            width: '18px',
            height: '18px',
            backgroundColor: pieceColors[heldPiece],
            border: '1px solid rgba(0,0,0,0.3)',
          }"
        ></div>
      </div>
      <span class="piece-type">{{ heldPiece }}</span>
    </div>
    <div v-else class="empty-slot">
      <span class="empty-text">Vacío</span>
    </div>
  </div>
</template>

<style scoped>
.held-piece-preview {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.preview-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.6));
}

.piece-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.piece-grid {
  position: relative;
}

.piece-cell {
  box-sizing: border-box;
}

.piece-type {
  font-size: 0.8125rem;
  font-family: monospace;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 54px;
  border: 1px dashed var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
}

.empty-text {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232,232,236,0.4));
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
</style>
