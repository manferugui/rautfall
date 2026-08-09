<script setup lang="ts">
/**
 * Componente Lanzador de Escenarios de Desarrollo (DEV Demo Launcher).
 *
 * Exclusivo para entorno de desarrollo (`import.meta.env.DEV === true`).
 * Muestra el registro centralizado de demos en el menú principal y
 * permite navegar directamente construyendo URLs limpias desde cero.
 */

import { DEV_DEMOS, buildDemoTargetUrl, type DevDemoDefinition, type DevDemoCategory } from '../dev/dev-demos';

function categoryLabel(category: DevDemoCategory): string {
  switch (category) {
    case 'battle':
      return 'BATALLA 2P';
    case 'mechanics':
      return 'MECÁNICAS 1P';
    case 'audio':
      return 'AUDIO LAB';
  }
}

function launchDemo(demo: DevDemoDefinition): void {
  const targetUrl = buildDemoTargetUrl(demo.query);
  if (typeof window !== 'undefined') {
    window.location.href = targetUrl;
  }
}

function returnToMenu(): void {
  const cleanUrl = buildDemoTargetUrl({});
  if (typeof window !== 'undefined') {
    window.location.href = cleanUrl;
  }
}
</script>

<template>
  <div class="dev-demo-launcher" data-testid="dev-demo-launcher">
    <div class="launcher-header">
      <h2 class="launcher-title">DEV Demo Launcher</h2>
      <button
        type="button"
        class="return-menu-btn"
        data-testid="return-to-menu-button"
        @click="returnToMenu"
      >
        Volver al menú
      </button>
    </div>

    <div class="demos-grid">
      <div
        v-for="demo in DEV_DEMOS"
        :key="demo.id"
        class="demo-card"
        :data-testid="`demo-card-${demo.id}`"
      >
        <div class="demo-info">
          <div class="demo-title-row">
            <span class="demo-label">{{ demo.label }}</span>
            <span class="category-badge" :data-category="demo.category">
              {{ categoryLabel(demo.category) }}
            </span>
          </div>
          <p class="demo-description">{{ demo.description }}</p>
        </div>
        <button
          type="button"
          class="launch-btn"
          :data-testid="`launch-${demo.id}`"
          @click="launchDemo(demo)"
        >
          Abrir
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dev-demo-launcher {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: var(--rf-color-graphite-900, #17181a);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-md, 6px);
  padding: 1.25rem;
}

.launcher-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.launcher-title {
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--rf-color-amber, #f39c12);
  margin: 0;
}

.return-menu-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
}

.return-menu-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-cyan, #00d4ff);
}

.demos-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.demo-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--rf-color-graphite-800, #1f2023);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  border-radius: var(--rf-radius-sm, 3px);
}

.demo-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.demo-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.demo-label {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--rf-color-text-primary, #e8e8ec);
}

.category-badge {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 2px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
}

.category-badge[data-category="battle"] {
  color: var(--rf-color-cyan, #00d4ff);
  border-color: var(--rf-color-cyan, #00d4ff);
}

.category-badge[data-category="audio"] {
  color: var(--rf-color-amber, #f39c12);
  border-color: var(--rf-color-amber, #f39c12);
}

.demo-description {
  font-size: 0.75rem;
  color: var(--rf-color-text-muted, rgba(232, 232, 236, 0.6));
  margin: 0;
}

.launch-btn {
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--rf-color-graphite-700, #28292c);
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  color: var(--rf-color-text-primary, #e8e8ec);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  white-space: nowrap;
}

.launch-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-cyan, #00d4ff);
  color: var(--rf-color-cyan, #00d4ff);
}
</style>
