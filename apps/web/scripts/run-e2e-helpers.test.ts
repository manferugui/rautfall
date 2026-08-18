import type { ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { isStatusOk, waitForHttp } from './run-e2e-helpers.js';

describe('isStatusOk', () => {
  it('devuelve true para respuestas HTTP 2xx y 3xx', () => {
    expect(isStatusOk(200)).toBe(true);
    expect(isStatusOk(201)).toBe(true);
    expect(isStatusOk(301)).toBe(true);
    expect(isStatusOk(302)).toBe(true);
  });

  it('devuelve false para respuestas de error 4xx, 5xx o no estándar', () => {
    expect(isStatusOk(100)).toBe(false);
    expect(isStatusOk(400)).toBe(false);
    expect(isStatusOk(404)).toBe(false);
    expect(isStatusOk(500)).toBe(false);
    expect(isStatusOk(503)).toBe(false);
  });
});

describe('waitForHttp', () => {
  it('resuelve cuando la URL responde con estado OK', async () => {
    const requestImpl = async () => 200;

    await expect(
      waitForHttp('http://127.0.0.1:3010/api/health', {
        timeoutMs: 1000,
        intervalMs: 10,
        requestImpl,
      })
    ).resolves.toBeUndefined();
  });

  it('reintenta hasta que responde OK tras fallos previos', async () => {
    let attempts = 0;
    const requestImpl = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Connection refused');
      }
      return 200;
    };

    await waitForHttp('http://127.0.0.1:5180/', {
      timeoutMs: 1000,
      intervalMs: 10,
      requestImpl,
    });

    expect(attempts).toBe(3);
  });

  it('lanza un error claro cuando se alcanza el timeout', async () => {
    const requestImpl = async () => {
      throw new Error('Connection refused');
    };

    await expect(
      waitForHttp('http://127.0.0.1:3010/api/health', {
        timeoutMs: 50,
        intervalMs: 10,
        requestImpl,
      })
    ).rejects.toThrow('Timeout de 50ms esperando disponibilidad HTTP');
  });

  it('lanza un error si el proceso hijo muere antes de estar disponible', async () => {
    const requestImpl = async () => {
      throw new Error('Connection refused');
    };

    const fakeChild = {
      exitCode: 1,
      signalCode: null,
    } as unknown as ChildProcess;

    await expect(
      waitForHttp('http://127.0.0.1:3010/api/health', {
        timeoutMs: 1000,
        intervalMs: 10,
        childProcess: fakeChild,
        requestImpl,
      })
    ).rejects.toThrow('finalizó de forma inesperada con código 1');
  });
});
