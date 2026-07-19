import { describe, expect, it, vi } from 'vitest';
import {
  logDebug,
  isInputDebugActive,
  snapshotResult,
  snapshotFrameEvents,
  isAdapterRelevant,
  shouldLogEngineResult,
  hasImportantEngineEvent,
  type ResultContext,
} from './input-debug';

describe('input-debug', () => {
  it('está desactivada sin ?inputDebug=1 en la URL', () => {
    expect(isInputDebugActive()).toBe(false);
  });

  it('logDebug no produce salida cuando está desactivado', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logDebug({ source: 'keyboard', event: 'keydown', code: 'ArrowLeft', repeat: false, timestamp: 123, pendingHorizontalBefore: null, pendingHorizontalAfter: 'left' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  describe('isAdapterRelevant', () => {
    function neutralEntry() {
      return {
        source: 'adapter' as const,
        logicalStep: 0,
        stepIndex: 0,
        totalSteps: 1,
        leftHeld: false,
        rightHeld: false,
        leftPressed: false,
        rightPressed: false,
        softDropHeld: false,
        rotateClockwise: false,
        rotateCounterclockwise: false,
        hardDrop: false,
        pendingHorizontal: null,
        consumedHorizontal: false,
      };
    }

    it('un paso neutro (todo false) no es relevante', () => {
      expect(isAdapterRelevant(neutralEntry())).toBe(false);
    });

    it('leftHeld true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), leftHeld: true })).toBe(true);
    });

    it('rightHeld true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), rightHeld: true })).toBe(true);
    });

    it('leftPressed true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), leftPressed: true, leftHeld: true })).toBe(true);
    });

    it('rightPressed true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), rightPressed: true, rightHeld: true })).toBe(true);
    });

    it('softDropHeld true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), softDropHeld: true })).toBe(true);
    });

    it('rotateClockwise true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), rotateClockwise: true })).toBe(true);
    });

    it('rotateCounterclockwise true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), rotateCounterclockwise: true })).toBe(true);
    });

    it('hardDrop true es relevante', () => {
      expect(isAdapterRelevant({ ...neutralEntry(), hardDrop: true })).toBe(true);
    });
  });

  describe('shouldLogEngineResult', () => {
    function neutralCtx(): ResultContext {
      return {
        hadRelevantInput: false,
        softDropHeld: false,
        hardDrop: false,
        xBefore: 3,
        xAfter: 3,
        yBefore: 5,
        yAfter: 5,
        pieceBefore: 'T',
        pieceAfter: 'T',
        statusBefore: 'running',
        statusAfter: 'running',
        hadEdgeAction: false,
      };
    }

    it('sin cambios en nada y sin flanco no es relevante', () => {
      expect(shouldLogEngineResult(neutralCtx())).toBe(false);
    });

    it('hadRelevantInput sin cambio real no es relevante (mantenido sin movimiento)', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), hadRelevantInput: true })).toBe(false);
    });

    it('cambio de x horizontal sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), xAfter: 2 })).toBe(true);
    });

    it('cambio de y por gravedad normal (sin soft drop ni hard drop) no es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), yAfter: 6 })).toBe(false);
    });

    it('cambio de y con soft drop sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), yAfter: 6, softDropHeld: true })).toBe(true);
    });

    it('cambio de y con hard drop sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), yAfter: 6, hardDrop: true })).toBe(true);
    });

    it('cambio de pieza sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), pieceAfter: 'I' })).toBe(true);
    });

    it('cambio de estado sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), statusAfter: 'gameOver' })).toBe(true);
    });

    it('hadEdgeAction true (leftPressed) sin cambio sí es relevante (bloqueo)', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), hadEdgeAction: true })).toBe(true);
    });

    it('hadEdgeAction por hardDrop sin cambio sí es relevante', () => {
      expect(shouldLogEngineResult({ ...neutralCtx(), hadEdgeAction: true })).toBe(true);
    });
  });

  describe('hasImportantEngineEvent', () => {
    it('pieceLocked es importante', () => {
      expect(hasImportantEngineEvent(['pieceLocked'])).toBe(true);
    });

    it('pieceSpawned es importante', () => {
      expect(hasImportantEngineEvent(['pieceSpawned'])).toBe(true);
    });

    it('linesCleared es importante', () => {
      expect(hasImportantEngineEvent(['linesCleared'])).toBe(true);
    });

    it('gameOver es importante', () => {
      expect(hasImportantEngineEvent(['gameOver'])).toBe(true);
    });

    it('varios eventos incluyendo uno importante', () => {
      expect(hasImportantEngineEvent(['pieceMoved', 'pieceLocked', 'pieceMoved'])).toBe(true);
    });

    it('eventos no importantes no activan el filtro', () => {
      expect(hasImportantEngineEvent(['pieceMoved', 'pieceRotated', 'engineStarted'])).toBe(false);
    });

    it('array vacío no activa el filtro', () => {
      expect(hasImportantEngineEvent([])).toBe(false);
    });
  });

  describe('engine-events', () => {
    it('snapshotFrameEvents produce datos planos', () => {
      const e = snapshotFrameEvents(10, ['pieceLocked', 'pieceSpawned'], 'Z', 'running');
      expect(e.source).toBe('engine-events');
      expect(e.step).toBe(10);
      expect(e.eventTypes).toEqual(['pieceLocked', 'pieceSpawned']);
      expect(e.pieceType).toBe('Z');
      expect(e.status).toBe('running');
    });

    it('eventTypes es una copia (no muta el original)', () => {
      const original = ['pieceLocked'];
      const e = snapshotFrameEvents(5, original, 'T', 'running');
      original.push('pieceSpawned');
      expect(e.eventTypes).toEqual(['pieceLocked']);
    });
  });

  it('snapshotResult produce datos planos', () => {
    const r = snapshotResult(10, 'T', 3, 2, 5, 5, 'running');
    expect(r).toEqual({
      source: 'engine-result',
      step: 10,
      pieceType: 'T',
      xBefore: 3,
      xAfter: 2,
      yBefore: 5,
      yAfter: 5,
      status: 'running',
    });
    expect(typeof r.step).toBe('number');
    expect(typeof r.xBefore).toBe('number');
  });

  it('logDebug no muta el objeto recibido', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const entry = { source: 'lifecycle' as const, event: 'create' as const };
    const frozen = Object.freeze({ ...entry });
    logDebug(frozen);
    spy.mockRestore();
  });

  it('snapshotResult con valores nulos', () => {
    const r = snapshotResult(0, null, 0, 0, 0, 0, 'gameOver');
    expect(r.pieceType).toBeNull();
    expect(r.status).toBe('gameOver');
  });
});
