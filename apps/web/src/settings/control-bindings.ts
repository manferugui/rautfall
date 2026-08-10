/**
 * Fuente única de verdad para el mapeo de teclas y acciones de control en Rautfall.
 *
 * Responsabilidades:
 * - Definir las 8 acciones de gameplay configurables.
 * - Definir los valores predeterminados basados en KeyboardEvent.code.
 * - Validar de forma estricta los códigos de tecla remapeables y rechazar teclas reservadas.
 * - Formatear los nombres de tecla legibles para la interfaz de usuario.
 * - Detectar duplicados de teclas entre acciones.
 */

export type ControlAction =
  | 'moveLeft'
  | 'moveRight'
  | 'softDrop'
  | 'hardDrop'
  | 'rotateClockwise'
  | 'rotateCounterClockwise'
  | 'hold'
  | 'triggerSabotage';

export type ControlBindings = Readonly<Record<ControlAction, string>>;

export const CONTROL_ACTIONS: readonly ControlAction[] = Object.freeze([
  'moveLeft',
  'moveRight',
  'softDrop',
  'hardDrop',
  'rotateClockwise',
  'rotateCounterClockwise',
  'hold',
  'triggerSabotage',
]);

export const DEFAULT_CONTROL_BINDINGS: ControlBindings = Object.freeze({
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  softDrop: 'ArrowDown',
  hardDrop: 'Space',
  rotateClockwise: 'ArrowUp',
  rotateCounterClockwise: 'KeyZ',
  hold: 'KeyC',
  triggerSabotage: 'KeyA',
});

export const ACTION_LABELS: Readonly<Record<ControlAction, string>> = Object.freeze({
  moveLeft: 'Mover a la izquierda',
  moveRight: 'Mover a la derecha',
  softDrop: 'Caída suave (Soft Drop)',
  hardDrop: 'Caída instantánea (Hard Drop)',
  rotateClockwise: 'Rotación horaria (CW)',
  rotateCounterClockwise: 'Rotación antihoraria (CCW)',
  hold: 'Reserva de pieza (Hold)',
  triggerSabotage: 'Lanzar sabotaje táctico',
});

const RESERVED_CODES: ReadonlySet<string> = new Set([
  'Escape',
  'KeyR', // Reservada fijamente para Reset de partida
  'Tab',
  'MetaLeft',
  'MetaRight',
  'ContextMenu',
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

const ALLOWED_EXPLICIT_CODES: ReadonlySet<string> = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'Space', 'Enter',
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
  'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadDecimal', 'NumpadEnter',
  'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Slash', 'Backquote',
  'BracketLeft', 'Backslash', 'BracketRight', 'Quote',
]);

/**
 * Comprueba si un valor de KeyboardEvent.code puede utilizarse como binding configurable.
 * Rechaza explícitamente cadenas vacías, tipos no string, códigos no remapeables y teclas reservadas.
 */
export function isRemappableControlCode(code: unknown): boolean {
  if (typeof code !== 'string') return false;
  const trimmed = code.trim();
  if (trimmed === '' || RESERVED_CODES.has(trimmed)) {
    return false;
  }
  if (ALLOWED_EXPLICIT_CODES.has(trimmed)) {
    return true;
  }
  if (/^Key[A-Z]$/.test(trimmed)) {
    return true;
  }
  if (/^Digit[0-9]$/.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Devuelve la ControlAction configurada para un determinado KeyboardEvent.code, o null si no está asignado.
 */
export function getActionByCode(bindings: ControlBindings, code: string): ControlAction | null {
  for (const action of CONTROL_ACTIONS) {
    if (bindings[action] === code) {
      return action;
    }
  }
  return null;
}

/**
 * Devuelve un nombre legible en español para un KeyboardEvent.code.
 */
export function formatKeyDisplay(code: string): string {
  if (!code || typeof code !== 'string') return '';
  const trimmed = code.trim();

  if (trimmed.startsWith('Key')) {
    return trimmed.slice(3);
  }
  if (trimmed.startsWith('Digit')) {
    return trimmed.slice(5);
  }

  switch (trimmed) {
    case 'ArrowLeft':
      return '←';
    case 'ArrowRight':
      return '→';
    case 'ArrowUp':
      return '↑';
    case 'ArrowDown':
      return '↓';
    case 'ShiftLeft':
      return 'Shift Izq';
    case 'ShiftRight':
      return 'Shift Der';
    case 'ControlLeft':
      return 'Ctrl Izq';
    case 'ControlRight':
      return 'Ctrl Der';
    case 'AltLeft':
      return 'Alt Izq';
    case 'AltRight':
      return 'Alt Der';
    case 'Space':
      return 'Espacio';
    case 'Enter':
      return 'Enter';
    case 'Escape':
      return 'Esc';
    case 'Numpad0': case 'Numpad1': case 'Numpad2': case 'Numpad3': case 'Numpad4':
    case 'Numpad5': case 'Numpad6': case 'Numpad7': case 'Numpad8': case 'Numpad9':
      return `Numpad ${trimmed.slice(6)}`;
    case 'NumpadAdd':
      return 'Numpad +';
    case 'NumpadSubtract':
      return 'Numpad -';
    case 'NumpadMultiply':
      return 'Numpad ×';
    case 'NumpadDivide':
      return 'Numpad /';
    case 'NumpadDecimal':
      return 'Numpad .';
    case 'NumpadEnter':
      return 'Numpad Enter';
    case 'Semicolon':
      return ';';
    case 'Comma':
      return ',';
    case 'Period':
      return '.';
    case 'Slash':
      return '/';
    case 'Backslash':
      return '\\';
    case 'BracketLeft':
      return '[';
    case 'BracketRight':
      return ']';
    case 'Quote':
      return "'";
    case 'Backquote':
      return '`';
    case 'Minus':
      return '-';
    case 'Equal':
      return '=';
    default:
      return trimmed;
  }
}

/**
 * Comprueba si `code` ya está asignado a otra acción distinta de `actionToChange`.
 * Devuelve la `ControlAction` que utiliza la tecla si existe un conflicto, o `null` si la tecla está libre.
 */
export function findDuplicateAction(
  bindings: ControlBindings,
  actionToChange: ControlAction,
  newCode: string,
): ControlAction | null {
  for (const action of CONTROL_ACTIONS) {
    if (action !== actionToChange && bindings[action] === newCode) {
      return action;
    }
  }
  return null;
}
