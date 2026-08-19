import { Type, type Static } from '@sinclair/typebox';

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
 * Unión discriminada para mensajes de entrada (Cliente -> Servidor).
 */
export const ClientWsMessageSchema = Type.Union([
  CreateRoomClientMessageSchema,
  JoinRoomClientMessageSchema,
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
  PlayerDisconnectedServerMessageSchema,
  ErrorServerMessageSchema,
]);

export type ServerWsMessage = Static<typeof ServerWsMessageSchema>;
