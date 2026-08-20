import type { OperatorReactionType } from './types';
import { REACTION_POOLS } from './operator-reactions';

/**
 * Candidato genérico a evento de combate para evaluación de reacciones vocales del operador.
 */
export type CombatEventCandidate = {
  type: string;
  source?: string;
  target?: string;
  participant?: string;
  reason?: string;
  event?: {
    type: string;
    linesCount?: number;
  } | null;
  winner?: string | 'draw' | null;
};


/**
 * Entrada normalizada para la evaluación atómica de reacciones vocales del operador en combate.
 * Desacoplada de WebSocket, GameStateServerMessage, BattleSession y Phaser.
 */
export type CombatEvaluationInput = {
  /** Estado global de la partida (ej: 'running', 'playerOneWon', 'playerTwoWon', 'draw'). */
  status?: string | null | undefined;
  /** Ganador de la partida ('playerOne' | 'playerTwo' | 'draw' | null). */
  winner?: string | null | undefined;
  /** Snapshot del jugador local/humano conteniendo la cuadrícula de su tablero. */
  selfSnapshot?: {
    board?: ReadonlyArray<ReadonlyArray<unknown>> | Array<Array<unknown>> | null | undefined;
  } | null | undefined;
  /** Conjunto de eventos producidos en el ciclo lógico a evaluar. */
  events?: ReadonlyArray<CombatEventCandidate> | null | undefined;
  /** Rol o participante correspondiente al jugador humano/local ('playerOne' | 'playerTwo'). */
  role: 'playerOne' | 'playerTwo';
};

/**
 * Función pura que evalúa si la pila del tablero del jugador indicado ha alcanzado la zona crítica superior.
 *
 * Convención de coordenadas reales del tablero en Rautfall:
 * - Tablero de 24 filas (`y = 0..23`), 10 columnas (`x = 0..9`).
 * - Filas `0..3` son ocultas (área de spawn y peligro superior).
 * - Filas `4..23` son las 20 filas visibles del tablero.
 *
 * Condición: Existe al menos una celda ocupada (`cell !== null`) en la fila 8 o por encima de ella
 * (`y <= 8`), indicando que la pila ha alcanzado la zona crítica superior.
 */
export function isCriticalBoard(target: { board?: ReadonlyArray<ReadonlyArray<unknown>> | Array<Array<unknown>> | null | undefined } | null | undefined): boolean {

  if (!target || !target.board) return false;
  return target.board.some((row, y) => y <= 8 && Array.isArray(row) && row.some((cell) => cell !== null));
}


export type CombatReactionSelectorOptions = {
  /** Tiempo de cooldown global en milisegundos entre reacciones normales (por defecto 5.000 ms). */
  cooldownMs?: number;
  /** Generador pseudoaleatorio inyectable para pruebas deterministas (devuelve flotante en [0, 1)). */
  random?: () => number;
  /** Función inyectable para obtener el tiempo actual en milisegundos. */
  now?: () => number;
};

/**
 * Selector y controlador puro de reacciones vocales del operador durante combate.
 * Funciona de forma idéntica en PvP Online y Battle vs Bot Local.
 *
 * Evalúa atómicamente la información de un ciclo de juego, derivando candidatos,
 * aplicando jerarquía estricta de prioridades, comprobando cooldown/probabilidad y
 * seleccionando como máximo UNA única reacción vocal por ciclo.
 */
export class CombatReactionSelector {
  private readonly cooldownMs: number;
  private readonly random: () => number;
  private readonly now: () => number;

  private wasCritical = false;
  private lastPlayedTimeMs = -Infinity;
  private lastReactionId: OperatorReactionType | null = null;
  private terminalTriggered = false;

  constructor(options: CombatReactionSelectorOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 5000;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  }

  /**
   * Restablece el estado interno del selector entre partidas/sesiones.
   */
  public reset(): void {
    this.wasCritical = false;
    this.lastPlayedTimeMs = -Infinity;
    this.lastReactionId = null;
    this.terminalTriggered = false;
  }

  /**
   * Evalúa atómicamente la información de combate recibida y devuelve la reacción vocal seleccionada (o null).
   */
  public evaluateCombatState(input: CombatEvaluationInput): OperatorReactionType | null {
    if (!input) return null;

    const { status, role, selfSnapshot } = input;
    const events = input.events ?? [];

    // 1. EVALUAR CANDIDATO TERMINAL (Prioridad absoluta)
    // Las reacciones terminales ignoran el cooldown global, tienen 100 % de probabilidad y se disparan solo 1 vez.
    const isEndedStatus = status === 'playerOneWon' || status === 'playerTwoWon' || status === 'draw';
    const hasEndedEvent = events.some((e) => e.type === 'battleEnded');

    if ((isEndedStatus || hasEndedEvent) && !this.terminalTriggered) {
      this.terminalTriggered = true;
      let winner = input.winner ?? null;

      if (!winner) {
        const battleEndedEvt = events.find((e) => e.type === 'battleEnded');
        if (battleEndedEvt) {
          winner = (battleEndedEvt.winner as string) ?? null;
        }
      }

      if (winner === role) {
        // Victoria del jugador humano/local
        const reaction: OperatorReactionType = REACTION_POOLS.victory;
        this.lastReactionId = reaction;
        this.lastPlayedTimeMs = this.now();
        return reaction;
      } else if (winner && winner !== 'draw') {
        // Derrota del jugador humano/local
        const reaction: OperatorReactionType = REACTION_POOLS.defeat;
        this.lastReactionId = reaction;
        this.lastPlayedTimeMs = this.now();
        return reaction;
      }
      // Draw (empate) -> Silencio absoluto
      return null;
    }

    // Si la partida ya ha terminado o la reacción terminal ha sido disparada, ignorar eventos posteriores
    if (this.terminalTriggered || status === 'playerOneWon' || status === 'playerTwoWon' || status === 'draw') {
      return null;
    }

    // 2. DETECTAR TRANSICIÓN EN TABLERO LOCAL (safe -> critical)
    const isCurrentlyCritical = isCriticalBoard(selfSnapshot);
    const isCriticalTransition = !this.wasCritical && isCurrentlyCritical;
    this.wasCritical = isCurrentlyCritical;

    // 3. COMPROBAR COOLDOWN GLOBAL PARA REACCIONES NO TERMINALES
    const currentTime = this.now();
    const isCooldownActive = currentTime - this.lastPlayedTimeMs < this.cooldownMs;
    if (isCooldownActive) {
      return null;
    }

    // 4. IDENTIFICAR CATEGORÍA SUPREMA SEGÚN PRIORIDAD EN ESTE TICK
    // Jerarquía estricta:
    // terminal > critical > garbageApplied > sabotaje recibido > ataque bloqueado / defensa > ataque propio
    let candidatePool: readonly OperatorReactionType[] = [];
    let candidateProbability = 0.35;
    let foundCategory = false;

    if (isCriticalTransition) {
      candidatePool = REACTION_POOLS.criticalBoard;
      candidateProbability = 0.50;
      foundCategory = true;
    } else {
      const hasGarbageApplied = events.some(
        (e) => e.type === 'participantEvent' && e.participant === role && e.event?.type === 'garbageApplied'
      );
      if (hasGarbageApplied) {
        candidatePool = REACTION_POOLS.garbageApplied;
        candidateProbability = 0.60;
        foundCategory = true;
      } else {
        const hasSabotageReceived = events.some((e) => e.type === 'sabotageRouted' && e.target === role);
        if (hasSabotageReceived) {
          candidatePool = REACTION_POOLS.sabotageReceived;
          candidateProbability = 0.35;
          foundCategory = true;
        } else {
          const attackBlockedEvent = events.find((e) => e.type === 'sabotageBlocked' && e.source === role);
          const defenseSuccessEvent = events.find((e) => e.type === 'sabotageBlocked' && e.target === role);

          if (attackBlockedEvent) {
            candidatePool = REACTION_POOLS.attackBlocked;
            candidateProbability = 0.35;
            foundCategory = true;
          } else if (defenseSuccessEvent) {
            candidatePool = REACTION_POOLS.defenseSuccess;
            candidateProbability = 0.35;
            foundCategory = true;
          } else {
            const hasAttackLaunched = events.some((e) => e.type === 'sabotageRouted' && e.source === role);
            if (hasAttackLaunched) {
              candidatePool = REACTION_POOLS.attackLaunched;
              candidateProbability = 0.35;
              foundCategory = true;
            }
          }
        }
      }
    }

    if (!foundCategory || candidatePool.length === 0) {
      return null;
    }

    // 5. EVALUAR PROBABILIDAD PARA LA CATEGORÍA SUPREMA DEL TICK
    const roll = this.random();
    if (roll >= candidateProbability) {
      return null;
    }

    // 6. SELECCIONAR REACCIÓN CON EVITACIÓN DE REPETICIÓN INMEDIATA
    let availablePool = [...candidatePool];
    if (availablePool.length > 1 && this.lastReactionId !== null) {
      const filtered = availablePool.filter((id) => id !== this.lastReactionId);
      if (filtered.length > 0) {
        availablePool = filtered;
      }
    }

    const selectedIndex = Math.floor(this.random() * availablePool.length);
    const selectedReaction = availablePool[selectedIndex] ?? null;

    if (!selectedReaction) {
      return null;
    }

    this.lastPlayedTimeMs = currentTime;
    this.lastReactionId = selectedReaction;

    return selectedReaction;
  }
}
