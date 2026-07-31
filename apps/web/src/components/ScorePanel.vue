<template>
  <div class="score-panel" data-testid="score-panel">
    <div class="score-panel__row">
      <span class="score-panel__label">Puntuacion</span>
      <span class="score-panel__value" data-testid="score-value">{{ score }}</span>
    </div>
    <div class="score-panel__row">
      <span class="score-panel__label">Combo</span>
      <span class="score-panel__value" data-testid="combo-value">{{ combo >= 1 ? combo : '\u2014' }}</span>
    </div>
    <div class="score-panel__row">
      <span class="score-panel__label">Back-to-Back</span>
      <span class="score-panel__value" data-testid="backToBack-value">{{ backToBack > 0 ? backToBack : '\u2014' }}</span>
    </div>
    <div class="score-panel__row">
      <span class="score-panel__label">Energia</span>
      <span class="score-panel__value" data-testid="combatEnergy-value">{{ combatEnergy }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    score: number;
    combo: number;
    backToBack: number;
    combatEnergy?: number;
  }>(),
  {
    combatEnergy: 0,
  },
);
</script>

<style scoped>
.score-panel {
  padding: 0.25rem 0;
}

.score-panel__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.125rem 0;
}

.score-panel__label {
  color: var(--color-text-muted, #8899aa);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.score-panel__value {
  color: var(--color-accent, #00d4ff);
  font-size: 0.85rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
