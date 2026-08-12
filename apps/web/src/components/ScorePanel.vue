<template>
  <div class="score-panel-assembly" data-testid="score-panel">
    <!-- Módulo SCORE -->
    <div class="rf-console-module score-module">
      <div class="rf-console-face">
        <span class="rf-console-label">SCORE</span>
        <div class="score-display-box">
          <span class="score-value-text" data-testid="score-value">{{ formattedScore }}</span>
        </div>
      </div>
    </div>

    <!-- Módulo COMBO & LEVEL -->
    <div class="rf-console-module combo-module">
      <div class="rf-console-face">
        <div class="combo-card-header">
          <span class="rf-console-label">COMBO</span>
          <span class="lvl-badge">LEVEL {{ level }}</span>
        </div>
        <div class="combo-value-box">
          <span class="combo-value-text" data-testid="combo-value">{{ combo >= 1 ? combo : 0 }}</span>
        </div>
        <div class="combo-led-bar">
          <div
            v-for="i in 7"
            :key="i"
            class="led-segment"
            :class="{ active: i <= Math.min(7, combo > 0 ? combo : 0) }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Accesibles sr-only para aserciones -->
    <span class="sr-only" data-testid="level-value">{{ level }}</span>
    <span class="sr-only" data-testid="gravity-value">{{ activeGravityCellsPerSecond.toFixed(2) }} c/s</span>
    <span class="sr-only" data-testid="backToBack-value">{{ backToBack > 0 ? backToBack : '—' }}</span>
    <span class="sr-only" data-testid="combatEnergy-value">{{ combatEnergy }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    score: number;
    combo: number;
    backToBack: number;
    combatEnergy?: number;
    level?: number;
    activeGravityCellsPerSecond?: number;
  }>(),
  {
    combatEnergy: 0,
    level: 1,
    activeGravityCellsPerSecond: 1.0,
  },
);

const formattedScore = computed(() => {
  // Sin separador de miles (Tarea 0031): la coma podía leerse como
  // decimal y no encajaba con la estética técnica de Rautfall.
  return String(props.score);
});
</script>

<style scoped>
.score-panel-assembly {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.score-module,
.combo-module {
  width: 100%;
  box-sizing: border-box;
}

.score-display-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 0 6px;
}

.score-value-text {
  font-size: 2.75rem;
  font-weight: 800;
  font-family: monospace;
  color: #ffffff;
  letter-spacing: 0.03em;
  text-shadow: 0 2px 5px rgba(0, 0, 0, 0.9);
}

.combo-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lvl-badge {
  font-size: 0.625rem;
  font-weight: 800;
  font-family: monospace;
  color: #00d4ff;
  letter-spacing: 0.06em;
  background: rgba(0, 212, 255, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(0, 212, 255, 0.3);
  margin-right: 5px;
}

.combo-value-box {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.combo-value-text {
  font-size: 2.1rem;
  font-weight: 800;
  font-family: monospace;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
}

.combo-led-bar {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 4px;
}

.led-segment {
  width: 20px;
  height: 11px;
  background: #0f1013;
  border: 1px solid #24262b;
  border-radius: 1px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.9);
}

.led-segment.active {
  background: linear-gradient(180deg, #f39c12, #d35400);
  border-color: #f39c12;
  box-shadow: 0 0 5px rgba(243, 156, 18, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}
</style>
