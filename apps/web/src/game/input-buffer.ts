/**
 * Gestión de entrada de teclado para el juego.
 *
 * Traduce el estado de teclas Phaser a un StepInput del motor.
 * Reglas:
 * - Movimiento horizontal solo por nueva pulsación (flanco de bajada).
 * - Rotación y hard drop son acciones de pulsación única.
 * - Una acción discreta se consume en un solo paso aunque el mismo frame
 *   ejecute varios pasos lógicos.
 * - Si izquierda y derecha están presionadas simultáneamente, horizontal = 0.
 * - Nunca se envían ambas rotaciones simultáneamente.
 */

import type { StepInput } from '@rautfall/game-engine';

export type KeyState = {
  justPressedLeft: boolean;
  justPressedRight: boolean;
  isDownLeft: boolean;
  isDownRight: boolean;
  justPressedUp: boolean;
  justPressedZ: boolean;
  justPressedSpace: boolean;
};

/**
 * Construye un StepInput a partir del estado de teclas y devuelve un
 * objeto con el input y el estado de "consumido" para las acciones discretas.
 *
 * @param keys          estado de teclas del frame actual
 * @param consumedThisFrame  conjunto de acciones ya consumidas en este frame
 * @returns [StepInput, consumedUpdated]
 */
export function buildStepInput(
  keys: KeyState,
  consumedThisFrame: {
    horizontal: boolean;
    clockwise: boolean;
    counterclockwise: boolean;
    hardDrop: boolean;
  },
): [StepInput, { horizontal: boolean; clockwise: boolean; counterclockwise: boolean; hardDrop: boolean }] {
  // Movimiento horizontal: solo por nueva pulsación, no repetir si ya se consumió
  let horizontal: -1 | 0 | 1 = 0;
  const leftPressed = keys.justPressedLeft;
  const rightPressed = keys.justPressedRight;
  const bothPressed = keys.isDownLeft && keys.isDownRight;

  let consumedHorizontal = consumedThisFrame.horizontal;
  if (!consumedThisFrame.horizontal) {
    if (bothPressed) {
      horizontal = 0;
      consumedHorizontal = true;
    } else if (leftPressed && !rightPressed) {
      horizontal = -1;
      consumedHorizontal = true;
    } else if (rightPressed && !leftPressed) {
      horizontal = 1;
      consumedHorizontal = true;
    }
  }

  // Rotación horaria (ArrowUp)
  let rotateClockwise = false;
  let consumedClockwise = consumedThisFrame.clockwise;
  if (!consumedThisFrame.clockwise && keys.justPressedUp) {
    rotateClockwise = true;
    consumedClockwise = true;
  }

  // Rotación antihoraria (Z)
  let rotateCounterclockwise = false;
  let consumedCounterclockwise = consumedThisFrame.counterclockwise;
  if (!consumedThisFrame.counterclockwise && keys.justPressedZ) {
    rotateCounterclockwise = true;
    consumedCounterclockwise = true;
  }

  // Hard drop (Space)
  let hardDrop = false;
  let consumedHardDrop = consumedThisFrame.hardDrop;
  if (!consumedThisFrame.hardDrop && keys.justPressedSpace) {
    hardDrop = true;
    consumedHardDrop = true;
  }

  // Si ambas rotaciones se disparan en el mismo frame, ninguna se envía
  if (rotateClockwise && rotateCounterclockwise) {
    rotateClockwise = false;
    rotateCounterclockwise = false;
  }

  return [
    { horizontal, hardDrop, rotateClockwise, rotateCounterclockwise },
    {
      horizontal: consumedHorizontal,
      clockwise: consumedClockwise,
      counterclockwise: consumedCounterclockwise,
      hardDrop: consumedHardDrop,
    },
  ];
}
