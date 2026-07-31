/**
 * Gestión de entrada de teclado para el juego.
 *
 * Traduce el estado de teclas Phaser a un StepInput del motor.
 * Responsabilidades:
 * - Detectar flancos de pulsación para teclas de acción discreta (rotación, hard drop, hold)
 *   y teclas de dirección horizontal.
 * - Conservar estado mantenido (held) para izquierda, derecha y soft drop.
 * - Entregar cada flanco una sola vez (mecanismo consumed).
 * - No contiene lógica de repetición horizontal (DAS/ARR), ni de soft drop,
 *   ni de prioridad horizontal: todo eso es responsabilidad exclusiva del motor.
 */

import type { StepInput } from '@rautfall/game-engine';

export type KeyState = {
  horizontalPressed: 'left' | 'right' | null;
  leftHeld: boolean;
  rightHeld: boolean;
  justPressedUp: boolean;
  justPressedZ: boolean;
  justPressedSpace: boolean;
  justPressedC: boolean;
  justPressedA: boolean;
  softDropHeld: boolean;
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
    hold: boolean;
    triggerSabotage: boolean;
  },
): [StepInput, { horizontal: boolean; clockwise: boolean; counterclockwise: boolean; hardDrop: boolean; hold: boolean; triggerSabotage: boolean }] {
  // Estado mantenido horizontal (siempre el real, independientemente de consumed)
  const leftHeld = keys.leftHeld;
  const rightHeld = keys.rightHeld;

  // Flancos horizontales: un único flanco direccional garantizado por el productor (GameScene),
  // o null si no hay flanco. Se consume una sola vez.
  let leftPressed = false;
  let rightPressed = false;
  let consumedHorizontal = consumedThisFrame.horizontal;

  if (!consumedThisFrame.horizontal && keys.horizontalPressed !== null) {
    if (keys.horizontalPressed === 'left') {
      leftPressed = true;
    } else {
      rightPressed = true;
    }
    consumedHorizontal = true;
  }

  // Soft drop: estado mantenido, no hay flanco, no se consume
  const softDropHeld = keys.softDropHeld;

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

  // Reserva (C)
  const hold = !consumedThisFrame.hold && keys.justPressedC;
  const consumedHold = consumedThisFrame.hold || hold;

  // Lanzamiento de sabotaje (A)
  const triggerSabotage = !consumedThisFrame.triggerSabotage && keys.justPressedA;
  const consumedTriggerSabotage = consumedThisFrame.triggerSabotage || triggerSabotage;

  const stepInput: StepInput = {
    leftHeld, rightHeld, leftPressed, rightPressed, softDropHeld, hardDrop,
    rotateClockwise, rotateCounterclockwise,
  };
  if (hold) {
    stepInput.hold = true;
  }
  if (triggerSabotage) {
    stepInput.triggerSabotage = true;
  }

  return [
    stepInput,
    {
      horizontal: consumedHorizontal,
      clockwise: consumedClockwise,
      counterclockwise: consumedCounterclockwise,
      hardDrop: consumedHardDrop,
      hold: consumedHold,
      triggerSabotage: consumedTriggerSabotage,
    },
  ];
}
