import { FormatRegistry, Type, type Static } from '@sinclair/typebox';

// Registrar validadores de formato para Value.Check en TypeBox
if (!FormatRegistry.Has('uuid')) {
  FormatRegistry.Set('uuid', (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  );
}

if (!FormatRegistry.Has('date-time')) {
  FormatRegistry.Set('date-time', (value) =>
    !isNaN(Date.parse(value)),
  );
}

/**
 * Esquema estandarizado de respuesta de error HTTP.
 */
export const ErrorResponseSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * Esquema de respuesta del endpoint GET /api/health.
 */
export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
  timestamp: Type.String({ format: 'date-time' }),
  database: Type.Union([Type.Literal('connected'), Type.Literal('disconnected')]),
});

export type HealthResponse = Static<typeof HealthResponseSchema>;
