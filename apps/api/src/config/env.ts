import dotenv from 'dotenv';
import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

dotenv.config();

const EnvSchema = Type.Object({
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('test'),
    Type.Literal('production'),
  ], { default: 'development' }),
  PORT: Type.Number({ default: 3000 }),
  HOST: Type.String({ default: '0.0.0.0' }),
  DATABASE_URL: Type.String({ default: 'postgres://rautfall:rautfall@localhost:5432/rautfall' }),
  CORS_ORIGIN: Type.String({ default: 'http://localhost:5173' }),
});

export type ApiEnv = Static<typeof EnvSchema>;

export function getAppEnv(customEnv?: Record<string, string | undefined>): ApiEnv {
  const rawEnv = customEnv || process.env;
  const envObj = {
    NODE_ENV: rawEnv['NODE_ENV'] || 'development',
    PORT: rawEnv['PORT'] ? Number(rawEnv['PORT']) : 3000,
    HOST: rawEnv['HOST'] || '0.0.0.0',
    DATABASE_URL: rawEnv['DATABASE_URL'] || 'postgres://rautfall:rautfall@localhost:5432/rautfall',
    CORS_ORIGIN: rawEnv['CORS_ORIGIN'] || 'http://localhost:5173',
  };

  if (!Value.Check(EnvSchema, envObj)) {
    const errors = [...Value.Errors(EnvSchema, envObj)];
    throw new Error(`Invalid environment configuration: ${JSON.stringify(errors)}`);
  }

  return envObj;
}
