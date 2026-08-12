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
  <div class="held-piece-module" data-testid="held-piece-preview">
    <!-- Placa base: bisel doble, chaflanes y tornillería mediante asset del kit industrial -->
    <div class="hold-plate" aria-hidden="true"></div>

    <!-- Tornillos visibles, uno por esquina, escala legible a 1920x1080 -->
    <div class="hold-bolt hold-bolt--tl" aria-hidden="true"></div>
    <div class="hold-bolt hold-bolt--tr" aria-hidden="true"></div>
    <div class="hold-bolt hold-bolt--bl" aria-hidden="true"></div>
    <div class="hold-bolt hold-bolt--br" aria-hidden="true"></div>

    <!-- Marco interior + hueco oscuro profundamente hundido -->
    <div class="hold-inner-frame">
      <div class="hold-cavity">
        <div v-if="heldPiece && shape" class="piece-display">
          <div
            class="piece-grid"
            :style="{
              width: shape.width * 22 + 'px',
              height: shape.height * 22 + 'px',
            }"
          >
            <div
              v-for="(cell, idx) in shape.cells"
              :key="idx"
              class="piece-cell"
              :style="{
                position: 'absolute',
                left: cell.x * 22 + 'px',
                top: cell.y * 22 + 'px',
                width: '22px',
                height: '22px',
                backgroundColor: pieceColors[heldPiece],
              }"
            ></div>
          </div>
        </div>
        <div v-else class="empty-slot">
          <span class="empty-text">VACÍO</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.held-piece-module {
  position: relative;
  box-sizing: border-box;
  width: 132px;
  height: 168px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 25px 10px 11px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
  flex-shrink: 0;
}

/* PLACA: chapa base + BISEL doblado (chaflanes + resalte superior/sombra inferior) vía asset. */
.hold-plate {
  position: absolute;
  inset: 0;
  background-image: url('/assets/industrial-kit/module-bezel.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.65));
  z-index: 0;
}

.hold-bolt {
  position: absolute;
  width: 11px;
  height: 11px;
  background-image: url('/assets/industrial-kit/rivet-bolt.svg');
  background-size: 100% 100%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.9));
  z-index: 4;
}

.hold-bolt--tl { top: 5px; left: 6px; }
.hold-bolt--tr { top: 5px; right: 6px; }
.hold-bolt--bl { bottom: 5px; left: 6px; }
.hold-bolt--br { bottom: 5px; right: 6px; }

/* MARCO INTERIOR: rebaje metálico entre el bisel exterior y el hueco oscuro. */
.hold-inner-frame {
  position: relative;
  z-index: 2;
  box-sizing: border-box;
  flex: 1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  background: linear-gradient(135deg, #4a4d55 0%, #23252a 100%);
  border-radius: 3px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.15),
    inset 0 -1px 2px rgba(0, 0, 0, 0.6);
}

/* HUECO OSCURO: cavidad profundamente hundida, con highlight mínimo inferior/derecho. */
.hold-cavity {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #06070a;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
  background-size: 10px 10px;
  border-radius: 2px;
  box-shadow:
    inset 0 5px 14px rgba(0, 0, 0, 0.98),
    inset 0 0 0 1px rgba(0, 0, 0, 0.95),
    inset -2px -2px 4px rgba(0, 0, 0, 0.9),
    inset -1px -1px 2px rgba(255, 255, 255, 0.04);
}

.piece-display {
  display: flex;
  align-items: center;
  justify-content: center;
}

.piece-grid {
  position: relative;
}

.piece-cell {
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

.empty-slot {
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text {
  font-size: 0.6875rem;
  font-weight: 700;
  color: rgba(232, 232, 236, 0.25);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
