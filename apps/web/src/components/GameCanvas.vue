<script setup lang="ts">
/**
 * Componente Vue que contiene el canvas de Phaser.
 *
 * Responsabilidades:
 * - Contener el elemento padre del canvas (con tabindex para foco).
 * - Crear la instancia Phaser en onMounted.
 * - Destruir la instancia en onBeforeUnmount.
 * - Evitar instancias duplicadas.
 * - Conectar el resumen de estado con Vue mediante una prop reactiva.
 * - Exponer reset para que App.vue pueda invocarlo.
 */

import { ref, onMounted, onBeforeUnmount } from 'vue';
import { createPhaserGame } from '../game/create-phaser-game';
import type { GamePresentationState, PhaserGameController } from '../game/types';

const props = defineProps<{
  onStateUpdate: (state: GamePresentationState) => void;
}>();

const emit = defineEmits<{
  (e: 'controllerReady', controller: PhaserGameController): void;
}>();

const gameContainer = ref<HTMLElement | null>(null);
let controller: PhaserGameController | null = null;

onMounted(() => {
  if (!gameContainer.value || controller) return;

  controller = createPhaserGame({
    parent: gameContainer.value,
    onStateUpdate: (state: GamePresentationState) => {
      props.onStateUpdate(state);
    },
  });

  emit('controllerReady', controller);
});

onBeforeUnmount(() => {
  if (controller) {
    controller.destroy();
    controller = null;
  }
});
</script>

<template>
  <div
    ref="gameContainer"
    class="game-container"
    tabindex="0"
    data-testid="game-canvas"
  ></div>
</template>

<style scoped>
.game-container {
  width: 320px;
  height: 640px;
  outline: none;
  position: relative;
}
</style>
