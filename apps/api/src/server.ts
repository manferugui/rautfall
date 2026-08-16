import { buildApp } from './app.js';

async function startServer(): Promise<void> {
  const { fastify, env } = buildApp();

  try {
    const address = await fastify.listen({
      port: env.PORT,
      host: env.HOST,
    });
    fastify.log.info(`Servidor Rautfall API escuchando en ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

void startServer();
