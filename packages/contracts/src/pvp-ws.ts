import { Type, type Static } from '@sinclair/typebox';

/**
 * Esquema de entrada de control enviada por el cliente.
 */
export const WsStepInputSchema = Type.Object({
  leftHeld: Type.Boolean(),
  rightHeld: Type.Boolean(),
  leftPressed: Type.Boolean(),
  rightPressed: Type.Boolean(),
  softDropHeld: Type.Boolean(),
  hardDrop: Type.Boolean(),
  rotateClockwise: Type.Optional(Type.Boolean()),
  rotateCounterclockwise: Type.Optional(Type.Boolean()),
  hold: Type.Optional(Type.Boolean()),
  triggerSabotage: Type.Optional(Type.Boolean()),
});

export type WsStepInput = Static<typeof WsStepInputSchema>;

/**
 * Esquema de mensaje enviado por el cliente para solicitar la creación de una sala.
 */
export const CreateRoomClientMessageSchema = Type.Object({
  type: Type.Literal('create_room'),
});

export type CreateRoomClientMessage = Static<typeof CreateRoomClientMessageSchema>;

/**
 * Esquema de mensaje enviado por el cliente para unirse a una sala existente.
 */
export const JoinRoomClientMessageSchema = Type.Object({
  type: Type.Literal('join_room'),
  code: Type.String({ minLength: 1 }),
});

export type JoinRoomClientMessage = Static<typeof JoinRoomClientMessageSchema>;

/**
 * Esquema de mensaje enviado por el cliente para transmitir intenciones de input en partida.
 */
export const PlayerInputClientMessageSchema = Type.Object({
  type: Type.Literal('player_input'),
  input: WsStepInputSchema,
});

export type PlayerInputClientMessage = Static<typeof PlayerInputClientMessageSchema>;

/**
 * Esquema de mensaje enviado por el cliente para solicitar alternar la pausa en partida online.
 */
export const TogglePauseClientMessageSchema = Type.Object({
  type: Type.Literal('toggle_pause'),
});

export type TogglePauseClientMessage = Static<typeof TogglePauseClientMessageSchema>;

/**
 * Esquema de mensaje enviado por el cliente para solicitar revancha en la misma sala.
 */
export const RequestRematchClientMessageSchema = Type.Object({
  type: Type.Literal('request_rematch'),
});

export type RequestRematchClientMessage = Static<typeof RequestRematchClientMessageSchema>;

/**
 * Unión discriminada para mensajes de entrada (Cliente -> Servidor).
 */
export const ClientWsMessageSchema = Type.Union([
  CreateRoomClientMessageSchema,
  JoinRoomClientMessageSchema,
  PlayerInputClientMessageSchema,
  TogglePauseClientMessageSchema,
  RequestRematchClientMessageSchema,
]);

export type ClientWsMessage = Static<typeof ClientWsMessageSchema>;

/**
 * Respuesta del servidor tras la creación exitosa de la sala (enviado a P1).
 */
export const RoomCreatedServerMessageSchema = Type.Object({
  type: Type.Literal('room_created'),
  code: Type.String(),
  role: Type.Literal('playerOne'),
});

export type RoomCreatedServerMessage = Static<typeof RoomCreatedServerMessageSchema>;

/**
 * Respuesta del servidor tras unirse con éxito a la sala (enviado a P2).
 */
export const RoomJoinedServerMessageSchema = Type.Object({
  type: Type.Literal('room_joined'),
  code: Type.String(),
  role: Type.Literal('playerTwo'),
});

export type RoomJoinedServerMessage = Static<typeof RoomJoinedServerMessageSchema>;

/**
 * Notificación del servidor comunicando que ambos jugadores están presentes (enviado a P1 y P2).
 */
export const RoomReadyServerMessageSchema = Type.Object({
  type: Type.Literal('room_ready'),
  code: Type.String(),
});

export type RoomReadyServerMessage = Static<typeof RoomReadyServerMessageSchema>;

/**
 * Notificación de inicio de batalla autoritativa enviada a cada jugador con su rol.
 */
export const BattleStartedServerMessageSchema = Type.Object({
  type: Type.Literal('battle_started'),
  role: Type.Union([Type.Literal('playerOne'), Type.Literal('playerTwo')]),
});

export type BattleStartedServerMessage = Static<typeof BattleStartedServerMessageSchema>;

/**
 * Tipos y esquemas DTO explícitos para el estado de partida.
 */
export const WsSabotageTypeSchema = Type.Union([
  Type.Literal('residuos'),
  Type.Literal('sobrecarga'),
  Type.Literal('polaridad'),
  Type.Literal('interferencia'),
]);

export type WsSabotageType = Static<typeof WsSabotageTypeSchema>;

export const WsParticipantRoleSchema = Type.Union([
  Type.Literal('playerOne'),
  Type.Literal('playerTwo'),
]);

export type WsParticipantRole = Static<typeof WsParticipantRoleSchema>;

export const WsEngineActiveEffectSchema = Type.Union([
  Type.Object({
    type: Type.Literal('sobrecarga'),
    remainingMs: Type.Integer({ minimum: 0 }),
  }),
  Type.Object({
    type: Type.Literal('polaridad'),
    remainingPieces: Type.Union([Type.Literal(1), Type.Literal(2)]),
  }),
]);

export type WsEngineActiveEffect = Static<typeof WsEngineActiveEffectSchema>;

export const WsParticipantActiveEffectSchema = Type.Object({
  type: Type.Literal('interferencia'),
  remainingMs: Type.Integer({ minimum: 0 }),
});

export type WsParticipantActiveEffect = Static<typeof WsParticipantActiveEffectSchema>;

export const WsEngineEventSchema = Type.Union([
  Type.Object({ type: Type.Literal('pieceSpawned'), step: Type.Integer(), piece: Type.String() }),
  Type.Object({ type: Type.Literal('pieceMoved'), step: Type.Integer(), reason: Type.String() }),
  Type.Object({ type: Type.Literal('pieceLocked'), step: Type.Integer(), piece: Type.String() }),
  Type.Object({
    type: Type.Literal('linesCleared'),
    step: Type.Integer(),
    lines: Type.Integer(),
    lineIndices: Type.Array(Type.Integer()),
  }),
  Type.Object({ type: Type.Literal('gameOver'), step: Type.Integer(), reason: Type.String() }),
  Type.Object({ type: Type.Literal('pieceRotated'), step: Type.Integer(), orientation: Type.Integer() }),
  Type.Object({ type: Type.Literal('pieceHeld'), step: Type.Integer(), piece: Type.String() }),
  Type.Object({ type: Type.Literal('sabotageTriggered'), step: Type.Integer(), sabotage: WsSabotageTypeSchema }),
  Type.Object({ type: Type.Literal('garbageApplied'), step: Type.Integer(), linesCount: Type.Integer() }),
  Type.Object({
    type: Type.Literal('levelUp'),
    step: Type.Integer(),
    previousLevel: Type.Integer(),
    newLevel: Type.Integer(),
    baseGravityCellsPerSecond: Type.Number(),
  }),
]);

export type WsEngineEvent = Static<typeof WsEngineEventSchema>;

export const WsBattleEventSchema = Type.Union([
  Type.Object({ type: Type.Literal('battleStarted'), step: Type.Integer() }),
  Type.Object({ type: Type.Literal('battleReset'), step: Type.Integer() }),
  Type.Object({
    type: Type.Literal('participantEvent'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    event: WsEngineEventSchema,
  }),
  Type.Object({
    type: Type.Literal('sabotageRouted'),
    step: Type.Integer(),
    source: WsParticipantRoleSchema,
    target: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
  }),
  Type.Object({
    type: Type.Literal('warningStarted'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
    durationMs: Type.Integer(),
  }),
  Type.Object({
    type: Type.Literal('warningExpired'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
  }),
  Type.Object({
    type: Type.Literal('sabotageBlocked'),
    step: Type.Integer(),
    target: WsParticipantRoleSchema,
    source: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
    reason: Type.Union([Type.Literal('immunity'), Type.Literal('alreadyActive'), Type.Literal('warningPending')]),
  }),
  Type.Object({
    type: Type.Literal('immunityStarted'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
    durationMs: Type.Integer(),
  }),
  Type.Object({
    type: Type.Literal('immunityExpired'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    sabotage: WsSabotageTypeSchema,
  }),
  Type.Object({
    type: Type.Literal('interferenciaStarted'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
    durationMs: Type.Integer(),
  }),
  Type.Object({
    type: Type.Literal('interferenciaExpired'),
    step: Type.Integer(),
    participant: WsParticipantRoleSchema,
  }),
  Type.Object({
    type: Type.Literal('battleEnded'),
    step: Type.Integer(),
    winner: Type.Union([Type.Literal('playerOne'), Type.Literal('playerTwo'), Type.Literal('draw')]),
  }),
  Type.Object({ type: Type.Literal('suddenDeathWarning'), step: Type.Integer(), warningRemainingMs: Type.Integer() }),
  Type.Object({ type: Type.Literal('suddenDeathStarted'), step: Type.Integer() }),
  Type.Object({
    type: Type.Literal('suddenDeathPhaseChanged'),
    step: Type.Integer(),
    phase: Type.Union([Type.Literal('phase1'), Type.Literal('phase2'), Type.Literal('phase3')]),
    gravityMultiplier: Type.Number(),
  }),
]);

export type WsBattleEvent = Static<typeof WsBattleEventSchema>;

export const WsEngineSnapshotSchema = Type.Object({
  step: Type.Integer(),
  elapsedMs: Type.Integer(),
  status: Type.Union([Type.Literal('running'), Type.Literal('gameOver')]),
  board: Type.Array(Type.Array(Type.Union([
    Type.Literal('I'), Type.Literal('O'), Type.Literal('T'),
    Type.Literal('S'), Type.Literal('Z'), Type.Literal('J'), Type.Literal('L'),
    Type.Literal('garbage'), Type.Null()
  ]))),
  activePiece: Type.Union([
    Type.Object({
      pieceId: Type.Integer(),
      type: Type.String(),
      x: Type.Integer(),
      y: Type.Integer(),
      orientation: Type.Integer(),
      cells: Type.Array(Type.Object({ x: Type.Integer(), y: Type.Integer() })),
      grounded: Type.Boolean(),
      landingCells: Type.Array(Type.Object({ x: Type.Integer(), y: Type.Integer() })),
      holdUsed: Type.Boolean(),
    }),
    Type.Null(),
  ]),
  nextPieces: Type.Array(Type.String()),
  clearedLines: Type.Integer(),
  heldPiece: Type.Union([Type.String(), Type.Null()]),
  score: Type.Integer(),
  combo: Type.Integer(),
  backToBack: Type.Integer(),
  combatEnergy: Type.Number(),
  storedSabotages: Type.Array(WsSabotageTypeSchema),
  pendingGarbage: Type.Integer(),
  activeEffects: Type.Array(WsEngineActiveEffectSchema),
  level: Type.Integer(),
});

export type WsEngineSnapshot = Static<typeof WsEngineSnapshotSchema>;

export const WsParticipantStateSchema = Type.Object({
  warnings: Type.Array(Type.Object({ sabotage: WsSabotageTypeSchema, remainingMs: Type.Integer() })),
  immunities: Type.Array(Type.Object({ sabotage: WsSabotageTypeSchema, remainingMs: Type.Integer() })),
  activeEffects: Type.Array(WsParticipantActiveEffectSchema),
  isInterfered: Type.Boolean(),
  interferenciaRemainingMs: Type.Integer(),
});

export type WsParticipantState = Static<typeof WsParticipantStateSchema>;

/**
 * Notificación periódica de estado de juego autoritativo enviada a cada cliente.
 */
export const GameStateServerMessageSchema = Type.Object({
  type: Type.Literal('game_state'),
  step: Type.Integer(),
  elapsedMs: Type.Integer(),
  status: Type.Union([
    Type.Literal('running'), Type.Literal('paused'), Type.Literal('playerOneWon'),
    Type.Literal('playerTwoWon'), Type.Literal('draw')
  ]),
  pausedBy: Type.Union([
    Type.Literal('playerOne'), Type.Literal('playerTwo'), Type.Null()
  ]),
  winner: Type.Union([
    Type.Literal('playerOne'), Type.Literal('playerTwo'),
    Type.Literal('draw'), Type.Null()
  ]),
  suddenDeath: Type.Object({
    phase: Type.String(),
    warningRemainingMs: Type.Integer(),
    activeElapsedMs: Type.Integer(),
    gravityMultiplier: Type.Number(),
    energyMultiplier: Type.Number(),
  }),
  self: WsEngineSnapshotSchema,
  opponent: WsEngineSnapshotSchema,
  selfState: WsParticipantStateSchema,
  opponentState: WsParticipantStateSchema,
  events: Type.Array(WsBattleEventSchema),
});

export type GameStateServerMessage = Static<typeof GameStateServerMessageSchema>;

/**
 * Notificación final de fin de partida enviada a ambos jugadores.
 */
export const BattleEndedServerMessageSchema = Type.Object({
  type: Type.Literal('battle_ended'),
  winner: Type.Union([Type.Literal('playerOne'), Type.Literal('playerTwo'), Type.Literal('draw')]),
  finalSnapshot: Type.Any(),
});

export type BattleEndedServerMessage = Static<typeof BattleEndedServerMessageSchema>;

/**
 * Notificación enviada cuando un jugador solicita revancha en la misma sala.
 */
export const RematchRequestedServerMessageSchema = Type.Object({
  type: Type.Literal('rematch_requested'),
  requestedBy: WsParticipantRoleSchema,
});

export type RematchRequestedServerMessage = Static<typeof RematchRequestedServerMessageSchema>;

/**
 * Notificación enviada al oponente cuando la otra conexión se cierra.
 */
export const PlayerDisconnectedServerMessageSchema = Type.Object({
  type: Type.Literal('player_disconnected'),
  reason: Type.Literal('opponent_left'),
});

export type PlayerDisconnectedServerMessage = Static<typeof PlayerDisconnectedServerMessageSchema>;

/**
 * Respuesta de error enviada al cliente.
 */
export const ErrorServerMessageSchema = Type.Object({
  type: Type.Literal('error'),
  code: Type.String(),
  message: Type.String(),
});

export type ErrorServerMessage = Static<typeof ErrorServerMessageSchema>;

/**
 * Unión discriminada para mensajes de salida (Servidor -> Cliente).
 */
export const ServerWsMessageSchema = Type.Union([
  RoomCreatedServerMessageSchema,
  RoomJoinedServerMessageSchema,
  RoomReadyServerMessageSchema,
  BattleStartedServerMessageSchema,
  GameStateServerMessageSchema,
  BattleEndedServerMessageSchema,
  RematchRequestedServerMessageSchema,
  PlayerDisconnectedServerMessageSchema,
  ErrorServerMessageSchema,
]);

export type ServerWsMessage = Static<typeof ServerWsMessageSchema>;
