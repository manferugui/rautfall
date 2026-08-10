import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { submitMatch, getMatchHistory, getRanking, getHealth, getApiBaseUrl, ApiClientError } from './client';
import type { CreateMatchInput } from '@rautfall/contracts';

describe('Cliente API HTTP (client.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validMatchInput: CreateMatchInput = {
    clientMatchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    playerId: '11111111-1111-4111-8111-111111111111',
    playerName: 'Jugador-1111',
    score: 1200,
    linesCleared: 8,
    durationMs: 30000,
    level: 1,
    mode: 'training',
    result: 'finished',
    opponentProfile: null,
  };

  it('resuelve correctamente la URL base según la variable de entorno o fallback seguro', () => {
    const url = getApiBaseUrl();
    expect(url).toBe('http://localhost:3000');
  });

  it('submitMatch envía POST a /api/matches y devuelve el registro', async () => {
    const mockRecord = { ...validMatchInput, id: '22222222-2222-4222-8222-222222222222', createdAt: new Date().toISOString() };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRecord,
    } as Response));

    const res = await submitMatch(validMatchInput);
    expect(res).toEqual(mockRecord);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/matches',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(validMatchInput),
      }),
    );
  });

  it('getMatchHistory envía GET /api/matches?playerId=...&limit=...', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response));

    await getMatchHistory('11111111-1111-4111-8111-111111111111', 10);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/matches?playerId=11111111-1111-4111-8111-111111111111&limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getRanking envía GET /api/ranking?mode=battle&limit=20', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response));

    await getRanking('battle', 20);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/ranking?mode=battle&limit=20',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('lanza ApiClientError ante error de red o status no OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ code: 'INVALID_PAYLOAD', message: 'Payload inválido' }),
    } as Response));

    await expect(getHealth()).rejects.toThrow(ApiClientError);
  });
});

