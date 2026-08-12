<script setup lang="ts">
/**
 * Pantalla DEV Tools / Demo Launcher.
 *
 * Responsabilidad única: mostrar el lanzador de escenarios de desarrollo
 * (`DevDemoLauncher.vue`) como una pantalla propia, separada del menú
 * principal. Exclusiva de entorno de desarrollo — este componente solo se
 * carga desde App.vue vía `defineAsyncComponent` condicionado a
 * `import.meta.env.DEV === true`; no existe guarda adicional aquí porque
 * el propio import ya se elimina del bundle de producción (no duplicar la
 * guarda, solo respetar la existente).
 */

import DevDemoLauncher from './DevDemoLauncher.vue';

defineEmits<{
  (e: 'backToMenu'): void;
}>();
</script>

<template>
  <div class="dev-frame" data-testid="dev-launcher-screen">
    <div class="dev-scroll-viewport">
      <div class="dev-content">
        <div class="dev-header">
          <div class="dev-header-title-group">
            <span class="dev-badge">DEV</span>
            <h1 class="dev-title">DEV TOOLS · DEMO LAUNCHER</h1>
          </div>
          <button
            type="button"
            class="dev-back-btn"
            data-testid="dev-back-to-menu-button"
            @click="$emit('backToMenu')"
          >
            Volver al menú
          </button>
        </div>

        <DevDemoLauncher />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Marco fijo: no hace scroll. Material técnico, deliberadamente con menos
   ornamentación que el menú principal (sin textura corten, sin remaches). */
.dev-frame {
  box-sizing: border-box;
  width: 100%;
  max-width: 860px;
  max-height: calc(100vh - 64px);
  margin: 2rem auto;
  background: var(--rf-color-graphite-900, #14151a);
  border: 2px solid var(--rf-color-metal-600, #3a3b3f);
  border-top: 2px solid rgba(243, 156, 18, 0.55);
  border-radius: var(--rf-radius-md, 6px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Único elemento con scroll. Aire propio antes de la scrollbar para que no
   toque el borde exterior del marco. */
.dev-scroll-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.5rem 0.85rem 1.5rem 1.75rem;
  scrollbar-width: thin;
  scrollbar-color: #4a4c54 #14151a;
}

.dev-scroll-viewport::-webkit-scrollbar {
  width: 9px;
}

.dev-scroll-viewport::-webkit-scrollbar-track {
  background: #14151a;
}

.dev-scroll-viewport::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #52545c 0%, #34363c 100%);
  border: 1px solid #0a0b0c;
  border-radius: 2px;
}

.dev-scroll-viewport::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #62646c 0%, #40424a 100%);
}

.dev-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding-right: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.dev-header {
  box-sizing: border-box;
  max-width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.dev-header-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.dev-badge {
  flex-shrink: 0;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 1px 6px;
  border-radius: 2px;
  color: #0b0b0d;
  background: var(--rf-color-amber, #f39c12);
}

.dev-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--rf-color-amber, #f39c12);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dev-back-btn {
  box-sizing: border-box;
  max-width: 100%;
  flex-shrink: 0;
  padding: 0.4rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid var(--rf-color-metal-600, #3a3b3f);
  background: var(--rf-color-graphite-700, #28292c);
  color: var(--rf-color-text-primary, #e8e8ec);
  border-radius: var(--rf-radius-sm, 3px);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.dev-back-btn:hover {
  background: var(--rf-color-graphite-800, #1f2023);
  border-color: var(--rf-color-cyan, #00d4ff);
}
</style>
