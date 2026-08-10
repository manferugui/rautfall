import type {
  CreateMatchInput,
  MatchRecord,
  RankingEntry,
  HealthResponse,
  ErrorResponse,
} from '@rautfall/contracts';

export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // En compilación de producción sin variable explícita, se usa URL relativa safe for same-origin reverse-proxy
  if (import.meta.env.PROD) {
    return '';
  }
  // En desarrollo local o tests, fallback al servidor API local en puerto 3000
  return 'http://localhost:3000';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;

  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      `No se pudo conectar con el servidor de Rautfall API: ${err instanceof Error ? err.message : 'fallo de red'}`,
    );
  }

  if (!response.ok) {
    let errorData: ErrorResponse | undefined;
    try {
      errorData = (await response.json()) as ErrorResponse;
    } catch {
      // Ignorar error de parsing JSON si la respuesta no es JSON
    }

    throw new ApiClientError(
      response.status,
      errorData?.code || 'HTTP_ERROR',
      errorData?.message || `Error HTTP ${response.status}: ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Registra una partida terminada en la API.
 */
export async function submitMatch(input: CreateMatchInput): Promise<MatchRecord> {
  return request<MatchRecord>('/api/matches', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Consulta el historial de partidas recientes de un jugador.
 */
export async function getMatchHistory(playerId: string, limit = 20): Promise<MatchRecord[]> {
  const query = new URLSearchParams({
    playerId,
    limit: limit.toString(),
  });
  return request<MatchRecord[]>(`/api/matches?${query.toString()}`, {
    method: 'GET',
  });
}

/**
 * Consulta el ranking por modo de juego (training o battle).
 */
export async function getRanking(mode: 'training' | 'battle', limit = 20): Promise<RankingEntry[]> {
  const query = new URLSearchParams({
    mode,
    limit: limit.toString(),
  });
  return request<RankingEntry[]>(`/api/ranking?${query.toString()}`, {
    method: 'GET',
  });
}

/**
 * Consulta el estado técnico de readiness del servidor API.
 */
export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', {
    method: 'GET',
  });
}
