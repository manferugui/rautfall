import { describe, expect, it } from 'vitest';

import {
  GameConfigValidationError,
  parseGameConfig,
  prototypeConfig,
} from './index';

const validConfig = {
  version: 'test-config',
  fixedStepMs: 20,
  dasMs: 160,
  arrMs: 60,
  gravityCellsPerSecond: 1,
  softDropCellsPerSecond: 20,
  lockDelayMs: 500,
  maxLockResets: 15,
};

describe('parseGameConfig', () => {
  it('returns a valid configuration', () => {
    expect(parseGameConfig(validConfig)).toEqual(validConfig);
  });

  it('rejects an unknown property', () => {
    expectValidationIssue(
      { ...validConfig, unexpected: true },
      'unexpected',
      'UNKNOWN_PROPERTY',
    );
  });

  it('rejects a missing required property', () => {
    const { version: _, ...input } = validConfig;

    expectValidationIssue(input, 'version', 'REQUIRED');
  });

  it.each([0, -10])('rejects invalid fixedStepMs: %s', (fixedStepMs) => {
    expectValidationIssue(
      { ...validConfig, fixedStepMs },
      'fixedStepMs',
      'OUT_OF_RANGE',
    );
  });

  it('rejects values not divisible by fixedStepMs', () => {
    expectValidationIssue(
      { ...validConfig, dasMs: 150 },
      'dasMs',
      'RELATIONAL_VIOLATION',
    );
  });

  it('rejects soft drop speed not greater than gravity', () => {
    expectValidationIssue(
      {
        ...validConfig,
        gravityCellsPerSecond: 20,
        softDropCellsPerSecond: 20,
      },
      'softDropCellsPerSecond',
      'RELATIONAL_VIOLATION',
    );
  });

  it.each([0, -1])('rejects non-positive maxLockResets: %s', (maxLockResets) => {
    expectValidationIssue(
      { ...validConfig, maxLockResets },
      'maxLockResets',
      'OUT_OF_RANGE',
    );
  });

  it('rejects a non-integer maxLockResets', () => {
    expectValidationIssue(
      { ...validConfig, maxLockResets: 1.5 },
      'maxLockResets',
      'TYPE_MISMATCH',
    );
  });

  it('does not replace invalid values with defaults', () => {
    expect(() =>
      parseGameConfig({ ...validConfig, fixedStepMs: 0 }),
    ).toThrow(GameConfigValidationError);
  });
});

describe('prototypeConfig', () => {
  it('contains the agreed prototype values', () => {
    expect(prototypeConfig).toEqual({
      version: 'prototype-0001',
      fixedStepMs: 10,
      dasMs: 150,
      arrMs: 50,
      gravityCellsPerSecond: 1,
      softDropCellsPerSecond: 20,
      lockDelayMs: 500,
      maxLockResets: 15,
    });
  });
});

function expectValidationIssue(
  input: unknown,
  path: string,
  code: string,
): void {
  try {
    parseGameConfig(input);
    throw new Error('Expected configuration validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(GameConfigValidationError);

    const validationError = error as GameConfigValidationError;

    expect(validationError.code).toBe('INVALID_GAME_CONFIG');
    expect(validationError.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path,
          code,
          message: expect.any(String),
        }),
      ]),
    );
  }
}
