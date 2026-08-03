<script setup lang="ts">
/**
 * Componente de Menú Principal / Selector de Modos de Rautfall.
 *
 * Responsabilidades:
 * - Mostrar la identidad tipográfica y descriptor de Rautfall.
 * - Permitir la selección del modo de juego (Entrenamiento 1P o Batalla Local 2P contra IA).
 * - Exponer resumen de controles de teclado.
 * - No contiene enlaces ni elementos ficticios de características fuera del MVP.
 */

import type { GameMode } from '../game/types';

const emit = defineEmits<{
  (e: 'selectMode', mode: GameMode): void;
}>();
</script>

<template>
  <div class="mode-selector" data-testid="mode-selector">
    <div class="selector-header">
      <div class="title-tag">
        <h1 class="selector-title">Rautfall</h1>
      </div>
      <p class="selector-descriptor">Build. Disrupt. Survive.</p>
    </div>

    <div class="hazard-strip" aria-hidden="true"></div>

    <div class="mode-actions">
      <button
        type="button"
        class="mode-btn mode-btn--training"
        data-testid="start-training-button"
        @click="emit('selectMode', 'training')"
      >
        <span class="mode-btn-title">Modo Entrenamiento</span>
        <span class="mode-btn-sub">Práctica individual 1P sin sabotajes ni bot</span>
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--battle"
        data-testid="start-battle-button"
        @click="emit('selectMode', 'battle')"
      >
        <span class="mode-btn-title">Batalla contra la IA</span>
        <span class="mode-btn-sub">Combate táctico 2P determinista contra DeterministicBot</span>
      </button>
    </div>

    <div class="controls-card">
      <h2 class="controls-heading">Controles de teclado</h2>
      <ul class="controls-list">
        <li><kbd>&larr;</kbd> <kbd>&rarr;</kbd> Mover horizontalmente</li>
        <li><kbd>&uarr;</kbd> Rotación horaria (CW)</li>
        <li><kbd>Z</kbd> Rotación antihoraria (CCW)</li>
        <li><kbd>Space</kbd> Caída instantánea (Hard Drop)</li>
        <li><kbd>&darr;</kbd> Caída suave (Soft Drop)</li>
        <li><kbd>C</kbd> Reserva de pieza (Hold)</li>
        <li><kbd>A</kbd> Lanzar sabotaje táctico</li>
        <li><kbd>Esc</kbd> Pausar / Reanudar</li>
        <li><kbd>R</kbd> Reiniciar partida</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.mode-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  max-width: 540px;
  margin: 1.5rem auto;
  padding: 1.75rem;
  background: var(--rf-color-graphite-800, #1f2023);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: var(--rf-shadow-panel);
}

.selector-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.title-tag {
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-left: 4px solid var(--rf-color-amber, #f39c12);
  clip-path: polygon(0 0, 100% 0, 94% 100%, 0% 100%);
  padding: 0.5rem 2rem 0.5rem 1.25rem;
}

.selector-title {
  font-size: 2.25rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.selector-descriptor {
  font-size: 0.8125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.hazard-strip {
  width: 100%;
  height: 10px;
  border-radius: 2px;
  opacity: 0.6;
  background: repeating-linear-gradient(
    135deg,
    var(--rf-color-amber, #f39c12) 0 8px,
    var(--rf-color-graphite-900, #17181a) 8px 16px
  );
}

.mode-actions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 1rem 1.25rem;
  border-radius: var(--rf-radius-md, 6px);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  text-align: left;
}

.mode-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-cyan, #00d4ff);
  transform: translateY(-1px);
}

.mode-btn:active {
  transform: translateY(0);
}

.mode-btn-title {
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.mode-btn--battle .mode-btn-title {
  color: var(--rf-color-cyan, #00d4ff);
}

.mode-btn-sub {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
}

.controls-card {
  width: 100%;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
  padding: 1rem;
}

.controls-heading {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin-bottom: 0.75rem;
}

.controls-list {
  list-style: none;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem 1rem;
}

.controls-list li {
  font-size: 0.75rem;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.controls-list kbd {
  background: var(--rf-color-graphite-700, #28292c);
  padding: 1px 5px;
  border-radius: var(--rf-radius-sm, 3px);
  font-family: monospace;
  font-size: 0.75rem;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

@media (max-width: 600px) {
  .controls-list {
    grid-template-columns: 1fr;
  }
}
</style>
