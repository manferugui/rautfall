import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const gameConfigSchema = Type.Object(
  {
    version: Type.String({ minLength: 1 }),
    fixedStepMs: Type.Number({ exclusiveMinimum: 0 }),
    dasMs: Type.Number({ minimum: 0 }),
    arrMs: Type.Number({ minimum: 0 }),
    gravityCellsPerSecond: Type.Number({ exclusiveMinimum: 0 }),
    softDropCellsPerSecond: Type.Number({ exclusiveMinimum: 0 }),
    lockDelayMs: Type.Number({ minimum: 0 }),
    maxLockResets: Type.Integer({ minimum: 1 }),
  },
  {
    additionalProperties: false,
  },
);

export type GameConfig = Static<typeof gameConfigSchema>;

export type GameConfigValidationIssueCode =
  | 'UNKNOWN_PROPERTY'
  | 'REQUIRED'
  | 'TYPE_MISMATCH'
  | 'OUT_OF_RANGE'
  | 'RELATIONAL_VIOLATION';

export type GameConfigValidationIssue = {
  path: string;
  code: GameConfigValidationIssueCode;
  message: string;
};

export class GameConfigValidationError extends Error {
  readonly code = 'INVALID_GAME_CONFIG';
  readonly issues: readonly GameConfigValidationIssue[];

  constructor(issues: readonly GameConfigValidationIssue[]) {
    super('Game configuration is invalid');
    this.name = 'GameConfigValidationError';
    this.issues = issues;
  }
}

export const prototypeConfig: GameConfig = {
  version: 'prototype-0001',
  fixedStepMs: 10,
  dasMs: 150,
  arrMs: 50,
  gravityCellsPerSecond: 1,
  softDropCellsPerSecond: 20,
  lockDelayMs: 500,
  maxLockResets: 15,
};

export function parseGameConfig(input: unknown): GameConfig {
  const issues = collectStructuralIssues(input);

  if (issues.length > 0) {
    throw new GameConfigValidationError(issues);
  }

  const config = input as GameConfig;
  const relationalIssues = collectRelationalIssues(config);

  if (relationalIssues.length > 0) {
    throw new GameConfigValidationError(relationalIssues);
  }

  return config;
}

function collectStructuralIssues(input: unknown): GameConfigValidationIssue[] {
  return [...Value.Errors(gameConfigSchema, input)].map((error) => ({
    path: normalizePath(error.path),
    code: mapStructuralError(error),
    message: error.message,
  }));
}

function collectRelationalIssues(config: GameConfig): GameConfigValidationIssue[] {
  const issues: GameConfigValidationIssue[] = [];

  if (config.dasMs % config.fixedStepMs !== 0) {
    issues.push({
      path: 'dasMs',
      code: 'RELATIONAL_VIOLATION',
      message: 'dasMs must be divisible by fixedStepMs',
    });
  }

  if (config.arrMs % config.fixedStepMs !== 0) {
    issues.push({
      path: 'arrMs',
      code: 'RELATIONAL_VIOLATION',
      message: 'arrMs must be divisible by fixedStepMs',
    });
  }

  if (config.lockDelayMs % config.fixedStepMs !== 0) {
    issues.push({
      path: 'lockDelayMs',
      code: 'RELATIONAL_VIOLATION',
      message: 'lockDelayMs must be divisible by fixedStepMs',
    });
  }

  if (config.softDropCellsPerSecond <= config.gravityCellsPerSecond) {
    issues.push({
      path: 'softDropCellsPerSecond',
      code: 'RELATIONAL_VIOLATION',
      message: 'softDropCellsPerSecond must be greater than gravityCellsPerSecond',
    });
  }

  return issues;
}

function normalizePath(path: string): string {
  return path.replace(/^\//, '').replaceAll('/', '.');
}

type StructuralValidationError = {
  message: string;
  schema: Record<string, unknown>;
  value: unknown;
};

function mapStructuralError(
  error: StructuralValidationError,
): GameConfigValidationIssueCode {
  if (error.message.startsWith('Unexpected property')) {
    return 'UNKNOWN_PROPERTY';
  }

  if (error.message.startsWith('Expected required property')) {
    return 'REQUIRED';
  }

  if (
    typeof error.value === 'number' &&
    error.schema.type === 'integer' &&
    !Number.isInteger(error.value)
  ) {
    return 'TYPE_MISMATCH';
  }

  if (
    typeof error.value === 'number' &&
    ('minimum' in error.schema ||
      'exclusiveMinimum' in error.schema ||
      'maximum' in error.schema ||
      'exclusiveMaximum' in error.schema)
  ) {
    return 'OUT_OF_RANGE';
  }

  return 'TYPE_MISMATCH';
}
