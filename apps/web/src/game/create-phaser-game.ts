/**
 * Factoría que centraliza la creación de Phaser.Game.
 *
 * Recibe el elemento contenedor y los callbacks, y devuelve un controlador
 * tipado pequeño (PhaserGameController) con reset(), togglePause() y destroy().
 */

import Phaser from 'phaser';
import { GameScene, type GameSceneCallbacks } from './scenes/GameScene';
import type { GameMode, GamePresentationState, PhaserGameController } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './coordinates';

export type CreatePhaserGameOptions = {
  /** Elemento DOM que contendrá el canvas de Phaser. */
  parent: HTMLElement;
  /** Modo de juego seleccionado para la sesión ('training' | 'battle'). */
  mode?: GameMode;
  /** Callback para notificar cambios de estado a Vue. */
  onStateUpdate: (state: GamePresentationState) => void;
};

/**
 * Crea una única instancia de Phaser.Game con la configuración del prototipo.
 * Devuelve un controlador con `reset()` y `destroy()`.
 */
export function createPhaserGame(options: CreatePhaserGameOptions): PhaserGameController {
  const sceneCallbacks: GameSceneCallbacks = {
    onStateUpdate: options.onStateUpdate,
  };

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    parent: options.parent,
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [],
    input: {
      keyboard: true,
    },
    pixelArt: true,
    roundPixels: true,
  });

  // Añadir la escena dinámicamente para poder pasarle datos
  game.scene.add('GameScene', GameScene, true, {
    callbacks: sceneCallbacks,
    mode: options.mode ?? 'training',
  });

  return {
    reset(): void {
      const scene = game.scene.getScene('GameScene') as GameScene | null;
      if (scene) {
        scene.resetGame();
      }
    },
    togglePause(): void {
      const scene = game.scene.getScene('GameScene') as GameScene | null;
      if (scene) {
        scene.togglePause();
      }
    },
    destroy(): void {
      game.destroy(true);
    },
  };
}
