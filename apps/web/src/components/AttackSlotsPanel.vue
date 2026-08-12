<script setup lang="ts">
/**
 * Módulo ATTACK SLOTS de la consola central (cartucho de sabotajes real,
 * Residuos en cola y efectos activos temporales).
 *
 * Extraído de CombatStatusPanel.vue para poder ordenar la consola como
 * ENERGY → SCORE → COMBO → ATTACK SLOTS sin alterar datos ni lógica.
 */

import { computed } from 'vue';
import type { ActiveEffectSnapshot, SabotageType } from '@rautfall/game-engine';

const props = withDefaults(
  defineProps<{
    storedSabotages?: readonly SabotageType[];
    pendingGarbage?: number;
    activeEffects?: readonly ActiveEffectSnapshot[];
  }>(),
  {
    storedSabotages: () => [],
    pendingGarbage: 0,
    activeEffects: () => [],
  },
);

const cartridgeDisplay = computed(() => {
  if (!props.storedSabotages || props.storedSabotages.length === 0) {
    return 'VACÍO';
  }
  return props.storedSabotages.join(', ').toUpperCase();
});

const activeEffectsDisplay = computed(() => {
  if (!props.activeEffects || props.activeEffects.length === 0) {
    return 'NINGUNO';
  }
  return props.activeEffects
    .map((e) => {
      if (e.type === 'sobrecarga') {
        return `SOBRECARGA ${Math.ceil(e.remainingMs / 1000)}s`;
      }
      if (e.type === 'polaridad') {
        const pText = e.remainingPieces === 1 ? 'PIEZA' : 'PIEZAS';
        return `POLARIDAD · ${e.remainingPieces} ${pText}`;
      }
      return (e as ActiveEffectSnapshot).type.toUpperCase();
    })
    .join(', ');
});
</script>

<template>
  <div class="rf-console-module attack-slots-module">
    <div class="rf-console-face">
      <span class="rf-console-label">ATTACK SLOTS</span>

      <div class="slots-vertical-list">
        <!-- Slot 1: Cartucho (Sabotajes) -->
        <div class="slot-tile" data-testid="simulated-cartridge">
          <div class="slot-badge-box slot-badge-box--amber">
            <div class="slot-badge-icon slot-badge-icon--cartridge" aria-hidden="true"></div>
          </div>
          <div class="slot-text-info">
            <span class="slot-name-label">CARTUCHO</span>
            <span class="slot-value-text" data-testid="cartridge-text">{{ cartridgeDisplay }}</span>
          </div>
        </div>

        <!-- Slot 2: Residuos (Garbage) -->
        <div class="slot-tile" data-testid="simulated-residues">
          <div class="slot-badge-box slot-badge-box--orange">
            <div class="slot-badge-icon slot-badge-icon--residue" aria-hidden="true"></div>
          </div>
          <div class="slot-text-info">
            <span class="slot-name-label">RESIDUOS EN COLA</span>
            <span class="slot-value-text residues-color" data-testid="residues-count">{{ props.pendingGarbage }}</span>
          </div>
        </div>

        <!-- Slot 3: Efectos activos -->
        <div v-if="activeEffectsDisplay !== 'NINGUNO'" class="slot-tile" data-testid="active-effects">
          <div class="slot-badge-box slot-badge-box--cyan">
            <div class="slot-badge-icon slot-badge-icon--effect" aria-hidden="true"></div>
          </div>
          <div class="slot-text-info">
            <span class="slot-name-label">EFECTOS ACTIVOS</span>
            <span class="slot-value-text effects-color" data-testid="active-effects-text">{{ activeEffectsDisplay }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attack-slots-module {
  width: 100%;
  box-sizing: border-box;
}

.slots-vertical-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.slot-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #0a0b0d;
  border: 1px solid #2e3036;
  border-radius: 4px;
  padding: 10px 12px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 -2px 6px rgba(0, 0, 0, 0.9),
    0 1px 2px rgba(0, 0, 0, 0.5);
}

.slot-badge-box {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 -2px 4px rgba(0, 0, 0, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.6);
}

.slot-badge-box--amber {
  background: linear-gradient(180deg, #5c3008, #2e1704);
  border-color: #f39c12;
}

.slot-badge-box--orange {
  background: linear-gradient(180deg, #5c2008, #2e0e04);
  border-color: #d35400;
}

.slot-badge-box--cyan {
  background: linear-gradient(180deg, #08405c, #041f2e);
  border-color: #00d4ff;
}

/* Pictogramas propios de CARTUCHO, RESIDUOS y EFECTOS (SVG dedicados),
   servidos desde public/ vía background-image (mismo patrón que el resto
   de iconos del proyecto) — un <img src="/assets/..."> en el template lo
   compila Vue como import de módulo ES y rompe la resolución tanto en
   Vitest como en el análisis de imports de Vite/Rollup. Tamaño alineado
   con el badge de 44px y con la altura del bloque de texto. */
.slot-badge-icon {
  width: 26px;
  height: 26px;
  display: block;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.slot-badge-icon--cartridge {
  background-image: url('/assets/icons/cartridge-charge.svg');
}

.slot-badge-icon--residue {
  background-image: url('/assets/icons/residue-inbound.svg');
}

.slot-badge-icon--effect {
  background-image: url('/assets/icons/effect-pulse.svg');
}

.slot-text-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.slot-name-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6b6f7b;
  text-transform: uppercase;
}

.slot-value-text {
  font-size: 1.4rem;
  font-weight: 800;
  font-family: monospace;
  color: #ffffff;
}

.residues-color {
  color: #e74c3c;
}

.effects-color {
  color: #00d4ff;
}
</style>
