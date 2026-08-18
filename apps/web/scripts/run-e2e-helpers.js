import http from 'node:http';

/**
 * Verifica si un código de estado HTTP se considera satisfactorio (2xx o 3xx).
 * @param {number} status
 * @returns {boolean}
 */
export function isStatusOk(status) {
  return status >= 200 && status < 400;
}

/**
 * Realiza una petición GET HTTP simple con timeout individual usando node:http.
 * @param {string} urlStr
 * @param {number} timeoutMs
 * @returns {Promise<number>}
 */
export function requestStatus(urlStr, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get(urlStr, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 500);
    });
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Espera de forma activa a que una URL responda con un estado HTTP 2xx/3xx.
 *
 * @param {string} url - URL a verificar.
 * @param {object} [options]
 * @param {number} [options.timeoutMs=60000] - Tiempo límite total en ms.
 * @param {number} [options.intervalMs=250] - Intervalo entre reintentos en ms.
 * @param {number} [options.requestTimeoutMs=3000] - Timeout por intento individual.
 * @param {import('node:child_process').ChildProcess | null} [options.childProcess=null] - Proceso del servidor para abortar si muere antes.
 * @param {(url: string, timeoutMs: number) => Promise<number>} [options.requestImpl] - Implementación inyectable para pruebas.
 */
export async function waitForHttp(url, options = {}) {
  const {
    timeoutMs = 60_000,
    intervalMs = 250,
    requestTimeoutMs = 3_000,
    childProcess = null,
    requestImpl = requestStatus,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (
      childProcess &&
      (childProcess.exitCode !== null || childProcess.signalCode !== null)
    ) {
      throw new Error(
        `El proceso del servidor finalizó de forma inesperada con código ${childProcess.exitCode} (señal: ${childProcess.signalCode}) mientras se esperaba ${url}.`
      );
    }

    try {
      const statusCode = await requestImpl(url, requestTimeoutMs);
      if (isStatusOk(statusCode)) {
        return;
      }
    } catch {
      // Ignorar errores de conexión y reintentar
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `Timeout de ${timeoutMs}ms esperando disponibilidad HTTP en ${url}`
  );
}
