/**
 * Herramienta ligera de diagnóstico de entrada para desarrollo.
 *
 * Solo se activa con `?inputDebug=1` en la URL y exclusivamente
 * cuando `import.meta.env.DEV` es true.
 *
 * No afecta al comportamiento funcional del juego.
 * No produce salida cuando está desactivada.
 * Centraliza todo el logging bajo el prefijo `[Rautfall input]`.
 *
 * Tipos de registro:
 * - keyboard: eventos keydown/keyup reales.
 * - adapter: entrada enviada a engine.step() cuando hay actividad relevante.
 * - engine-result: resultado observable de un paso lógico que produjo cambio real
 *   o contenía una acción de flanco (pulsación, rotación, hard drop).
 * - engine-events: eventos drenados al final del frame cuando contienen
 *   pieceLocked, pieceSpawned, linesCleared o gameOver.
 *   Máximo uno por frame.
 * - lifecycle: create, shutdown, reset.
 *
 * La gravedad normal sin entrada no genera registro.
 * Pasos mantenidos sin cambio real no generan engine-result.
 */

// ── Activación ─────────────────────────────────────────────────────────

const isActive =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URL(window.location.href).searchParams.get('inputDebug') === '1';

// ── Tipos ──────────────────────────────────────────────────────────────

export type InputDebugKeyboardEvent = {
  source: 'keyboard';
  event: 'keydown' | 'keyup';
  code: string;
  repeat: boolean;
  timestamp: number;
  pendingHorizontalBefore: 'left' | 'right' | null;
  pendingHorizontalAfter: 'left' | 'right' | null;
};

export type InputDebugAdapterEvent = {
  source: 'adapter';
  logicalStep: number;
  stepIndex: number;
  totalSteps: number;
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  rotateClockwise: boolean;
  rotateCounterclockwise: boolean;
  hardDrop: boolean;
  pendingHorizontal: 'left' | 'right' | null;
  consumedHorizontal: boolean;
};

export type InputDebugResultEvent = {
  source: 'engine-result';
  step: number;
  pieceType: string | null;
  xBefore: number;
  xAfter: number;
  yBefore: number;
  yAfter: number;
  status: string;
};

export type InputDebugFrameEvent = {
  source: 'engine-events';
  step: number;
  eventTypes: readonly string[];
  pieceType: string | null;
  status: string;
};

export type InputDebugLifecycleEvent = {
  source: 'lifecycle';
  event: string;
  detail?: string;
};

export type DebugLogEntry =
  | InputDebugKeyboardEvent
  | InputDebugAdapterEvent
  | InputDebugResultEvent
  | InputDebugFrameEvent
  | InputDebugLifecycleEvent;

// ── Contexto para decidir relevancia de un resultado ───────────────────

export type ResultContext = {
  hadRelevantInput: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  xBefore: number;
  xAfter: number;
  yBefore: number;
  yAfter: number;
  pieceBefore: string | null;
  pieceAfter: string | null;
  statusBefore: string;
  statusAfter: string;
  /** true si la entrada del paso contenía un flanco de acción */
  hadEdgeAction: boolean;
};

/** Tipos de evento del motor importantes para engine-events */
export const IMPORTANT_EVENT_TYPES = ['pieceLocked', 'pieceSpawned', 'linesCleared', 'gameOver'] as const;

// ── Logger ─────────────────────────────────────────────────────────────

const PREFIX = '[Rautfall input]';

export function logDebug(entry: DebugLogEntry): void {
  if (!isActive) return;
  console.log(PREFIX, JSON.stringify(entry));
}

export function isInputDebugActive(): boolean {
  return isActive;
}

// ── Filtros ────────────────────────────────────────────────────────────

export function isAdapterRelevant(entry: InputDebugAdapterEvent): boolean {
  return (
    entry.leftHeld ||
    entry.rightHeld ||
    entry.leftPressed ||
    entry.rightPressed ||
    entry.softDropHeld ||
    entry.rotateClockwise ||
    entry.rotateCounterclockwise ||
    entry.hardDrop
  );
}

/**
 * Determina si el resultado de un paso lógico merece registro.
 * Se registra si hubo un cambio real o una acción de flanco.
 * Pasos mantenidos sin cambio no generan engine-result.
 */
export function shouldLogEngineResult(ctx: ResultContext): boolean {
  // Cambio real detectable
  if (ctx.xBefore !== ctx.xAfter) return true;
  if (ctx.yBefore !== ctx.yAfter && (ctx.softDropHeld || ctx.hardDrop)) return true;
  if (ctx.pieceBefore !== ctx.pieceAfter) return true;
  if (ctx.statusBefore !== ctx.statusAfter) return true;

  // Acción de flanco (pulsación, rotación, hard drop) — registrar incluso
  // si el movimiento fue bloqueado, para diagnosticar bloqueos.
  if (ctx.hadEdgeAction) return true;

  return false;
}

/**
 * Determina si una colección de tipos de evento del motor contiene
 * algún evento importante para engine-events.
 */
export function hasImportantEngineEvent(eventTypes: readonly string[]): boolean {
  return eventTypes.some((t) =>
    (IMPORTANT_EVENT_TYPES as readonly string[]).includes(t),
  );
}

/**
 * Construye un registro engine-events con los eventos importantes del frame.
 */
export function snapshotFrameEvents(
  step: number,
  eventTypes: readonly string[],
  pieceType: string | null,
  status: string,
): InputDebugFrameEvent {
  return {
    source: 'engine-events',
    step,
    eventTypes: [...eventTypes],
    pieceType,
    status,
  };
}

/**
 * Construye un snapshot plano de engine-result.
 */
export function snapshotResult(
  step: number,
  pieceType: string | null,
  xBefore: number,
  xAfter: number,
  yBefore: number,
  yAfter: number,
  status: string,
): InputDebugResultEvent {
  return {
    source: 'engine-result',
    step,
    pieceType,
    xBefore,
    xAfter,
    yBefore,
    yAfter,
    status,
  };
}
