import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from '../apps/api/src/app.js';

const { fastify } = buildApp();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await fastify.ready();
  fastify.server.emit('request', req, res);
}
