/**
 * Fuente única de verdad para el registro centralizado de escenarios de desarrollo (DEV Demos).
 *
 * Solo debe ser consumido en entorno de desarrollo (`import.meta.env.DEV === true`).
 */

export type DevDemoCategory = 'battle' | 'mechanics' | 'audio';

export type DevDemoDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  category: DevDemoCategory;
  query: Readonly<Record<string, string>>;
}>;

export const DEV_DEMOS: readonly DevDemoDefinition[] = [
  {
    id: 'battle-2p',
    label: 'Batalla Local 2P',
    description: 'Partida estándar 2P contra DeterministicBot con semilla 42',
    category: 'battle',
    query: { 'battle-demo': '1' },
  },
  {
    id: 'battle-debug-2p',
    label: 'Inspector de Batalla 2P (Telemetría DEV)',
    description: 'Batalla 2P con panel de telemetría técnica completa (timers, bot phase, step, coords)',
    category: 'battle',
    query: { 'battle-demo': '1', 'debug-panel': '1' },
  },
  {
    id: 'sudden-death-2p',
    label: 'Muerte Súbita 2P',
    description: 'Batalla 2P iniciada a los 04:40 min con aviso de Muerte Súbita',
    category: 'battle',
    query: { 'battle-demo': '1', 'sudden-death-demo': '1' },
  },
  {
    id: 'interference-2p',
    label: 'Interferencia 2P',
    description: 'Batalla 2P con P1 equipado con 2 sabotajes de interferencia',
    category: 'battle',
    query: { 'battle-demo': '1', 'interference-demo': '1' },
  },
  {
    id: 'bot-sabotage-residues-2p',
    label: 'Bot Sabotaje Residuos 2P',
    description: 'Batalla 2P con P2 equipado con cartucho de residuos',
    category: 'battle',
    query: { 'battle-demo': '1', 'bot-sabotage': 'residuos' },
  },
  {
    id: 'bot-sabotage-high-2p',
    label: 'Bot Sabotaje High Board 2P',
    description: 'Batalla 2P con tablero de P1 elevado con basura y P2 equipado',
    category: 'battle',
    query: { 'battle-demo': '1', 'bot-sabotage': 'high' },
  },
  {
    id: 'sabotage-residues-1p',
    label: 'Sabotaje Residuos 1P',
    description: 'Entrenamiento 1P con cartucho de residuos listo para lanzar (tecla A)',
    category: 'mechanics',
    query: { 'sabotage-demo': '1' },
  },
  {
    id: 'garbage-board-1p',
    label: 'Residuos en Tablero 1P',
    description: 'Entrenamiento 1P con 2 filas de basura encoladas y celdas base',
    category: 'mechanics',
    query: { 'garbage-demo': '1' },
  },
  {
    id: 'overload-1p',
    label: 'Sobrecarga 1P',
    description: 'Entrenamiento 1P con efecto sobrecarga activo (10s, gravedad 3x)',
    category: 'mechanics',
    query: { 'overload-demo': '1' },
  },
  {
    id: 'polarity-1p',
    label: 'Polaridad Inversa 1P',
    description: 'Entrenamiento 1P con controles horizontales y giros invertidos',
    category: 'mechanics',
    query: { 'polarity-demo': '1' },
  },
  {
    id: 'tspin-setup-1p',
    label: 'T-Spin Setup 1P',
    description: 'Tablero preparado con pieza T activa y 4 esquinas ocupadas',
    category: 'mechanics',
    query: { 'tspin-demo': '1' },
  },
  {
    id: 'level-1-1p',
    label: 'Nivel 1 - Gravedad Progresiva',
    description: 'Progresión de nivel arrancando en Nivel 1 con 9 líneas limpiadas',
    category: 'mechanics',
    query: { 'level-demo': '1' },
  },
  {
    id: 'level-10-1p',
    label: 'Nivel 10 - Alta Gravedad',
    description: 'Entrenamiento en Nivel 10 con gravedad pasiva de 10.0 c/s',
    category: 'mechanics',
    query: { 'level-demo': '10' },
  },
  {
    id: 'warning-fx-1p',
    label: 'Warning FX Demo 1P',
    description: 'Banco de pruebas reproducible para warnings de sabotaje (Sobrecarga, Polaridad, Interferencia)',
    category: 'mechanics',
    query: { 'warning-demo': '1' },
  },
  {
    id: 'audio-lab',
    label: 'Audio Lab (SFX & Music)',
    description: 'Audición/exportación de SFX sintéticos y reproductor de música BGM',
    category: 'audio',
    query: { 'sfx-lab': '1' },
  },
] as const;

/**
 * Construye una URL limpia desde cero para un escenario DEV.
 * Evita acumular o combinar query params DEV de ejecuciones anteriores.
 */
export function buildDemoTargetUrl(
  query: Readonly<Record<string, string>>,
  currentPathname?: string,
): string {
  const pathname =
    currentPathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const params = new URLSearchParams(query);
  const searchString = params.toString();
  return searchString ? `${pathname}?${searchString}` : pathname;
}

export const DEV_QUERY_PARAMS: readonly string[] = [
  'battle-demo',
  'debug-panel',
  'sudden-death-demo',
  'interference-demo',
  'bot-sabotage',
  'sabotage-demo',
  'garbage-demo',
  'overload-demo',
  'polarity-demo',
  'warning-demo',
  'tspin-demo',
  'level-demo',
  'sfx-lab',
] as const;

/**
 * Elimina todos los parámetros de consulta DEV conocidos de una URL.
 * Mantiene la ruta (pathname), parámetros no DEV y hash intactos.
 */
export function clearDevDemoQueryParams(urlStr: string): string {
  try {
    const url = new URL(urlStr, 'http://localhost');
    for (const param of DEV_QUERY_PARAMS) {
      url.searchParams.delete(param);
    }
    const search = url.searchParams.toString();
    return `${url.pathname}${search ? `?${search}` : ''}${url.hash}`;
  } catch {
    return urlStr;
  }
}
