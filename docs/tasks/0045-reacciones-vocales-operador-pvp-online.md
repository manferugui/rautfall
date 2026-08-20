# Tarea 0045 — Reacciones vocales automáticas del operador en PvP Online

## Objetivo

Implementar las reacciones vocales automáticas y humorísticas del operador en el modo PvP Online, utilizando los 13 activos de audio WAV aprobados y ubicados en `apps/web/public/audio/operator-reactions/`.

Las voces reaccionan de forma puramente audiovisual local a acontecimientos reales de la partida multijugador PvP online, evaluando atómicamente cada mensaje `game_state` enviado por el servidor autoritativo sin modificar motores de juego, protocolo WebSocket, backend ni persistencia.

## Requisitos

### 1. Extensión del Subsistema de Audio (`apps/web/src/audio/`)
- Definición de `OperatorReactionType` con los 13 identificadores aprobados (`cabron`, `no_me_jodas`, `pero_que_coño`, `hijo_puta`, `me_cago_en_todo`, `joder`, `mierda`, `eso_es_todo`, `toma`, `no_no_no`, `hostia_hostia`, `jooooder`, `a_tomar_por_culo`).
- Registro del mapa de URLs `OPERATOR_REACTION_ASSET_URL_MAP` apuntando a `/audio/operator-reactions/<id>.wav`.
- Extensión de `AudioService` y `AudioManager` con precarga asíncrona (`loadReactionBufferAsset`, `preloadAssets`), registro en memoria (`reactionAudioBufferMap`) y método de reproducción `playOperatorReaction(type)`.
- Reutilización estricta del `AudioContext` singleton y del bus `sfxGain`, respetando `isSfxEnabled()` y el silencio global (`isMuted()`).

### 2. Selector Puro de Reacciones (`apps/web/src/audio/pvp-reaction-selector.ts`)
- Evaluación **atómica por `game_state`**: se deriva la categoría suprema y se selecciona **como máximo UNA reacción vocal** por actualización.
- Función pura `isCriticalBoard(snapshot)` que verifica si existe al menos una celda ocupada en la fila 8 o por encima de ella (`y <= 8`) en la cuadrícula de 24 filas del jugador local.
- Detección de la transición presentacional `safe -> critical`.
- Jerarquía de prioridades estricta:
  `terminal` > `critical` > `garbageApplied` > `sabotaje recibido` > `ataque bloqueado / defensa` > `ataque propio`.
- Regla de ataque propio: Basado exclusivamente en el hecho contractual `sabotageRouted` con `source === role` (pool `toma`).
- Cooldown global de 5.000 ms para reacciones no terminales.
- Probabilidades inyectables:
  - `garbageApplied`: 60 %
  - `critical`: 50 %
  - `sabotageReceived` / `attackBlocked` / `defenseSuccess` / `attackLaunched`: 35 %
  - `terminal`: 100 %
- Las reacciones terminales (`victory` / `defeat`) ignoran el cooldown global y se ejecutan una sola vez por partida (`terminalTriggered`). El resultado `draw` es silencioso.
- Evitación de repetición inmediata de la última frase cuando el pool disponga de 2 o más opciones.
- Método `reset()` para reiniciar el estado entre sesiones.

### 3. Integración y Aislamiento en PvP Online (`GameScene.ts`)
- Activación **exclusiva** cuando `this.mode === 'online'`.
- En el callback `onlineSession.onGameState`, invocar `pvpReactionSelector.evaluateGameState(msg, role)` e invocar `playOperatorReaction` si procede.
- Limpieza completa del selector al destruir/reiniciar la escena.
- Sin efectos en los modos Entrenamiento (1P), Batalla vs Bot local (2P), History, Ranking ni pantallas de menú.

## Fuera de Alcance

- Modificación de los archivos WAV de audio existentes.
- Modificación de `@rautfall/game-engine`, `@rautfall/battle-engine`, `@rautfall/contracts`, backend `apps/api` o esquemas de base de datos.
- Envío de nombres de reacción o mensajes vocales sobre el protocolo WebSocket.
- Pruebas E2E de audio con Playwright.
