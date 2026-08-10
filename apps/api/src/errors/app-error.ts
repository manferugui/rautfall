import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function handleAppError(
  error: FastifyError | AppError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    void reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
    return;
  }

  // Errores de validación de Fastify (400 Bad Request)
  if ('statusCode' in error && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    void reply.status(error.statusCode).send({
      code: error.code || 'BAD_REQUEST',
      message: error.message,
    });
    return;
  }

  // Errores internos de servidor (500 Internal Server Error sined)
  reply.log.error(error);
  void reply.status(500).send({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred.',
  });
}
