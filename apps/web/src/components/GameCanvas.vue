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

import type { BotProfileId } from '@rautfall/battle-engine';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { GameMode, GamePresentationState, PhaserGameController } from '../game/types';

const props = defineProps<{
  onStateUpdate: (state: GamePresentationState) => void;
  mode?: GameMode;
  botProfile?: BotProfileId;
  seed?: number;
}>();

const emit = defineEmits<{
  (e: 'controllerReady', controller: PhaserGameController): void;
}>();

const gameContainer = ref<HTMLElement | null>(null);
let controller: PhaserGameController | null = null;
let isUnmounted = false;

onMounted(async () => {
  if (!gameContainer.value || controller) return;

  const { createPhaserGame } = await import('../game/create-phaser-game');
  if (isUnmounted || !gameContainer.value) return;

  controller = createPhaserGame({
    parent: gameContainer.value,
    mode: props.mode ?? 'training',
    botProfile: props.botProfile,
    seed: props.seed,
    onStateUpdate: (state: GamePresentationState) => {
      props.onStateUpdate(state);
    },
  });

  emit('controllerReady', controller);
});

onBeforeUnmount(() => {
  isUnmounted = true;
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
