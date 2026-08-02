import { describe, expect, it } from 'vitest';
import { createGameEngine, Orientation, type StepInput } from '@rautfall/game-engine';
import { prototypeConfig } from '@rautfall/game-config';
import {
  searchPlacements,
  computeBoardFingerprint,
  compareCandidates,
  BOT_MAX_SEARCH_NODES,
} from './placement-search';
import type { PlacementCandidate } from './types';

function makeValidOptions(seed = 42) {
  return { seed, config: prototypeConfig };
}

describe('placement-search', () => {
  it('encuentra colocaciones legales y produce un candidato óptimo para el estado inicial', () => {
    const engine = createGameEngine(makeValidOptions());
    const result = searchPlacements(engine);

    expect(result.bestCandidate).not.toBeNull();
    expect(result.bestCandidate?.isGameOver).toBe(false);
    expect(result.allCandidates.length).toBeGreaterThan(0);
    expect(result.searchMetrics.nodesExplored).toBeGreaterThan(0);
    expect(result.searchMetrics.nodesExplored).toBeLessThanOrEqual(BOT_MAX_SEARCH_NODES);
  });

  it('no muta el motor raíz durante la búsqueda', () => {
    const engine = createGameEngine(makeValidOptions());
    const snapBefore = engine.getSnapshot();

    searchPlacements(engine);

    expect(engine.getSnapshot()).toEqual(snapBefore);
  });

  it('descarta candidatos terminales cuando existe al menos una alternativa no terminal', () => {
    const candDead: PlacementCandidate = {
      targetPlacement: { x: 3, y: 0, orientation: Orientation.Spawn },
      actions: ['hardDrop'],
      heuristicScore: 500,
      linesCleared: 4, // limpia un Tetris pero muere por spawnBlocked
      resultingHoles: 0,
      newHoles: 0,
      maxHeight: 20,
      topOutRisk: 7,
      hiddenRowOccupancy: 2,
      isGameOver: true,
      gameOverReason: 'spawnBlocked',
      boardFingerprint: 'fpDead',
    };

    const candSurvive: PlacementCandidate = {
      targetPlacement: { x: 0, y: 20, orientation: Orientation.Spawn },
      actions: ['left', 'left', 'hardDrop'],
      heuristicScore: 50,
      linesCleared: 0, // no limpia nada pero sobrevive
      resultingHoles: 0,
      newHoles: 0,
      maxHeight: 2,
      topOutRisk: 0,
      hiddenRowOccupancy: 0,
      isGameOver: false,
      gameOverReason: null,
      boardFingerprint: 'fpSurvive',
    };

    // candSurvive debe vencer a candDead en la comparación canónica
    expect(compareCandidates(candSurvive, candDead)).toBeLessThan(0);
    expect(compareCandidates(candDead, candSurvive)).toBeGreaterThan(0);
  });

  it('evita crear huecos nuevos sacrificando altura si es necesario', () => {
    const candHole: PlacementCandidate = {
      targetPlacement: { x: 2, y: 18, orientation: Orientation.Spawn },
      actions: ['hardDrop'],
      heuristicScore: 80,
      linesCleared: 0,
      resultingHoles: 1,
      newHoles: 1,
      maxHeight: 4,
      topOutRisk: 0,
      hiddenRowOccupancy: 0,
      isGameOver: false,
      gameOverReason: null,
      boardFingerprint: 'fpHole',
    };

    const candClean: PlacementCandidate = {
      targetPlacement: { x: 0, y: 17, orientation: Orientation.Spawn },
      actions: ['left', 'hardDrop'],
      heuristicScore: 100,
      linesCleared: 0,
      resultingHoles: 0,
      newHoles: 0, // 0 huecos nuevos
      maxHeight: 5,
      topOutRisk: 0,
      hiddenRowOccupancy: 0,
      isGameOver: false,
      gameOverReason: null,
      boardFingerprint: 'fpClean',
    };

    expect(compareCandidates(candClean, candHole)).toBeLessThan(0);
  });

  it('ejecutar la secuencia de acciones del candidato óptimo sobre un clon produce el snapshot esperado', () => {
    const engine = createGameEngine(makeValidOptions());
    const result = searchPlacements(engine);
    const best = result.bestCandidate!;

    const clone = engine.clone();
    for (const action of best.actions) {
      let input: StepInput;
      if (action === 'rotateClockwise') {
        input = { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateClockwise: true };
      } else if (action === 'rotateCounterClockwise') {
        input = { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: false, rotateCounterclockwise: true };
      } else if (action === 'left') {
        input = { leftHeld: true, rightHeld: false, leftPressed: true, rightPressed: false, softDropHeld: false, hardDrop: false };
      } else if (action === 'right') {
        input = { leftHeld: false, rightHeld: true, leftPressed: false, rightPressed: true, softDropHeld: false, hardDrop: false };
      } else {
        input = { leftHeld: false, rightHeld: false, leftPressed: false, rightPressed: false, softDropHeld: false, hardDrop: true };
      }
      clone.step(input);
    }

    const finalSnap = clone.getSnapshot();
    const finalFingerprint = computeBoardFingerprint(finalSnap.board);
    expect(finalFingerprint).toBe(best.boardFingerprint);
  });

  it('respeta el límite de nodos maxSearchNodes', () => {
    const engine = createGameEngine(makeValidOptions());
    const result = searchPlacements(engine, { maxSearchNodes: 5 });

    expect(result.searchMetrics.nodesExplored).toBeLessThanOrEqual(5);
    expect(result.searchMetrics.reachedNodeLimit).toBe(true);
  });
});
