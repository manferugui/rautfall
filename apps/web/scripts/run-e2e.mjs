import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { waitForHttp } from './run-e2e-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const HOST = '127.0.0.1';
const API_PORT = process.env.PORT || '3010';
const WEB_PORT = process.env.WEB_PORT || '5180';

const API_HEALTH_URL = `http://${HOST}:${API_PORT}/api/health`;
const WEB_URL = `http://${HOST}:${WEB_PORT}/`;

const apiEnv = {
  ...process.env,
  PORT: String(API_PORT),
  HOST,
  CORS_ORIGIN: `http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT}`,
};

if (process.env.DATABASE_URL) {
  apiEnv.DATABASE_URL = process.env.DATABASE_URL;
}

const webEnv = {
  ...process.env,
  VITE_API_BASE_URL: `http://${HOST}:${API_PORT}`,
};

let apiChild = null;
let webChild = null;
let isCleaningUp = false;

function stopProcessGroup(child, signal = 'SIGTERM') {
  if (!child || !child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (err) {
    if (err.code !== 'ESRCH') {
      // Ignorar error si el proceso ya ha finalizado
    }
  }
}

async function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;

  if (apiChild) stopProcessGroup(apiChild, 'SIGTERM');
  if (webChild) stopProcessGroup(webChild, 'SIGTERM');

  await new Promise((resolve) => setTimeout(resolve, 300));

  if (apiChild) stopProcessGroup(apiChild, 'SIGKILL');
  if (webChild) stopProcessGroup(webChild, 'SIGKILL');
}

const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const signalHandlers = new Map();

signals.forEach((signal) => {
  const handler = async () => {
    console.log(`\n[E2E Runner] Recibida señal ${signal}, cerrando servidores...`);
    await cleanup();
    process.exit(1);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
});

function removeSignalHandlers() {
  signals.forEach((signal) => {
    const handler = signalHandlers.get(signal);
    if (handler) process.removeListener(signal, handler);
  });
}

async function main() {
  let exitCode = 0;

  try {
    console.log('[E2E Runner] Arrancando API E2E (puerto 3010)...');
    apiChild = spawn(
      'pnpm',
      ['--filter', '@rautfall/api', 'exec', 'tsx', 'src/server.ts'],
      {
        cwd: WORKSPACE_ROOT,
        env: apiEnv,
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit'],
      }
    );

    console.log('[E2E Runner] Esperando disponibilidad de API health...');
    await waitForHttp(API_HEALTH_URL, {
      timeoutMs: 60_000,
      intervalMs: 250,
      requestTimeoutMs: 3_000,
      childProcess: apiChild,
    });
    console.log('[E2E Runner] API lista.');

    console.log('[E2E Runner] Arrancando Vite E2E (puerto 5180)...');
    webChild = spawn(
      'pnpm',
      [
        '--filter',
        '@rautfall/web',
        'exec',
        'vite',
        '--host',
        HOST,
        '--port',
        String(WEB_PORT),
        '--strictPort',
      ],
      {
        cwd: WORKSPACE_ROOT,
        env: webEnv,
        detached: true,
        stdio: ['ignore', 'inherit', 'inherit'],
      }
    );

    console.log('[E2E Runner] Esperando disponibilidad de Frontend...');
    await waitForHttp(WEB_URL, {
      timeoutMs: 60_000,
      intervalMs: 250,
      requestTimeoutMs: 3_000,
      childProcess: webChild,
    });
    console.log('[E2E Runner] Frontend listo.');

    console.log('[E2E Runner] Ejecutando Playwright test...');
    const extraArgs = process.argv.slice(2);
    const playwrightChild = spawn(
      'pnpm',
      ['--filter', '@rautfall/web', 'exec', 'playwright', 'test', ...extraArgs],
      {
        cwd: WORKSPACE_ROOT,
        env: process.env,
        stdio: 'inherit',
      }
    );

    exitCode = await new Promise((resolve) => {
      playwrightChild.on('close', (code) => {
        resolve(code ?? 1);
      });
      playwrightChild.on('error', (err) => {
        console.error('[E2E Runner] Error al ejecutar Playwright:', err);
        resolve(1);
      });
    });
  } catch (error) {
    console.error('[E2E Runner] Error en la infraestructura E2E:', error.message);
    exitCode = 1;
  } finally {
    console.log('[E2E Runner] Deteniendo servidores E2E...');
    await cleanup();
    removeSignalHandlers();
    console.log('[E2E Runner] Servidores finalizados.');
    process.exit(exitCode);
  }
}

main();
