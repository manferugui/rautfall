import type { OperatorReactionType } from './types';

/**
 * Mapa de URLs públicas de los 13 assets de reacciones vocales del operador.
 */
export const OPERATOR_REACTION_ASSET_URL_MAP: Record<OperatorReactionType, string> = {
  cabron: '/audio/operator-reactions/cabron.wav',
  no_me_jodas: '/audio/operator-reactions/no_me_jodas.wav',
  pero_que_coño: '/audio/operator-reactions/pero_que_coño.wav',
  hijo_puta: '/audio/operator-reactions/hijo_puta.wav',
  me_cago_en_todo: '/audio/operator-reactions/me_cago_en_todo.wav',
  joder: '/audio/operator-reactions/joder.wav',
  mierda: '/audio/operator-reactions/mierda.wav',
  eso_es_todo: '/audio/operator-reactions/eso_es_todo.wav',
  toma: '/audio/operator-reactions/toma.wav',
  no_no_no: '/audio/operator-reactions/no_no_no.wav',
  hostia_hostia: '/audio/operator-reactions/hostia_hostia.wav',
  jooooder: '/audio/operator-reactions/jooooder.wav',
  a_tomar_por_culo: '/audio/operator-reactions/a_tomar_por_culo.wav',
};

/**
 * Pools funcionales de reacciones vocales organizados por acontecimiento.
 */
export const REACTION_POOLS = {
  sabotageReceived: ['cabron', 'no_me_jodas', 'pero_que_coño'] as const,
  garbageApplied: ['hijo_puta', 'me_cago_en_todo', 'joder'] as const,
  attackBlocked: ['mierda', 'joder'] as const,
  defenseSuccess: ['eso_es_todo'] as const,
  attackLaunched: ['toma'] as const,
  criticalBoard: ['no_no_no', 'hostia_hostia'] as const,
  defeat: 'jooooder' as const,
  victory: 'a_tomar_por_culo' as const,
};
