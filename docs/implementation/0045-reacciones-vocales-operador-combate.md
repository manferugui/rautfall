# Informe de Implementación — Tarea 0045: Reacciones vocales automáticas del operador en combate

## Resumen

Las reacciones vocales automáticas del operador están activadas en los modos de combate **Battle vs Bot Local** y **PvP Online** en `apps/web`.


Las voces proporcionan feedback sonoro humorístico y macarra exclusivamente en la presentación del cliente local ante hechos reales ocurridos durante la partida multijugador o contra bot, sin modificar los motores de dominio, el protocolo WebSocket, el backend autoritativo ni la persistencia de datos.

El diseño se estructura en tres componentes desacoplados:
1. **Subsistema de audio (`AudioManager` + `operator-reactions.ts`):** Precarga, almacenamiento en memoria y reproducción de los 13 activos WAV existentes (`apps/web/public/audio/operator-reactions/`) a través del bus `sfxGain` y el `AudioContext` singleton preexistente, respetando la configuración de silencio global (`isMuted()`) y efectos de sonido (`isSfxEnabled()`).
2. **Selector y controlador puro de reacciones en combate (`CombatReactionSelector`):** Módulo 100% testeable de forma determinista que evalúa una entrada normalizada `CombatEvaluationInput`. Aplica una jerarquía de prioridades estricta, la función de estado presentacional `isCriticalBoard`, cooldown global de 5.000 ms, evitación de repetición inmediata y probabilidades inyectables.
3. **Integración aislada en `GameScene.ts`:** Evaluación en el bucle local de **Battle vs Bot** (`mode === 'battle'`) evaluando atómicamente los eventos del humano (`playerOne`) sin que el bot (`playerTwo`) genere voces, y en **PvP Online** (`mode === 'online'`). Modos Training y Demos DEV permanecen totalmente excluidos.

---

## Archivos Creados, Renombrados y Modificados

### Archivos Creados y Renombrados
- `docs/tasks/0045-reacciones-vocales-operador-combate.md`: Especificación técnica inmutable de la Tarea 0045 (renombrada desde `pvp-online`).
- `docs/implementation/0045-reacciones-vocales-operador-combate.md`: El presente informe de implementación (renombrado desde `pvp-online`).
- `apps/web/src/audio/combat-reaction-selector.ts`: Controlador/selector puro `CombatReactionSelector` e `isCriticalBoard` (generalizado desde `pvp-reaction-selector.ts`).
- `apps/web/src/audio/combat-reaction-selector.test.ts`: Suite de pruebas unitarias exhaustivas para Battle vs Bot y PvP Online.
- `apps/web/src/audio/operator-reactions.ts`: Mapa de activos de las 13 muestras WAV y definición de pools de reacciones.

### Archivos Modificados
- `apps/web/src/audio/types.ts`: Incorporado el tipo `OperatorReactionType` y la declaración de `playOperatorReaction` en la interfaz `AudioService`.
- `apps/web/src/audio/audio-manager.ts`: Implementación de precarga, almacenamiento en mapa y reproducción de muestras WAV en `AudioManager`.
- `apps/web/src/audio/index.ts`: Exportación pública de `operator-reactions` y `combat-reaction-selector`.
- `apps/web/src/audio/audio-manager.test.ts`: Pruebas de integración de carga de muestras de reacción y respeto del estado de silencio.
- `apps/web/src/game/scenes/GameScene.ts`: Integración de `CombatReactionSelector` para Battle vs Bot local y PvP Online.
- `apps/web/src/game/scenes/GameScene.test.ts`: Pruebas unitarias de la escena para Battle vs Bot, bot silencioso y Training.
- `docs/project-status.md`: Actualización del estado general del proyecto.

---

## Mapping Final Evento -> Reacción en Combate

| Acontecimiento en Combate | Condición Exacta (Humano / `role = 'playerOne'`) | Pool / Reacción | Probabilidad | Cooldown |
| :--- | :--- | :--- | :---: | :---: |
| **Victoria humana** | `winner === role` (`playerOne`) | `a_tomar_por_culo` | 100 % | Ignora |
| **Derrota humana** | `winner !== role` (`playerTwo`) | `jooooder` | 100 % | Ignora |
| **Empate (Draw)** | `winner === 'draw'` / `status === 'draw'` | *Silencio (Sin reacción)* | — | — |
| **Entrada en estado crítico** | Transición `safe -> critical` (`isCriticalBoard`) | `no_no_no`, `hostia_hostia` | 50 % | 5.000 ms |
| **Garbage aplicado al humano** | `participantEvent` (`participant === role`, `garbageApplied`) | `hijo_puta`, `me_cago_en_todo`, `joder` | 60 % | 5.000 ms |
| **Sabotaje recibido por humano** | `sabotageRouted` (`target === role`) | `cabron`, `no_me_jodas`, `pero_que_coño` | 35 % | 5.000 ms |
| **Ataque humano bloqueado** | `sabotageBlocked` (`source === role`) | `mierda`, `joder` | 35 % | 5.000 ms |
| **Defensa humana exitosa** | `sabotageBlocked` (`target === role`) | `eso_es_todo` | 35 % | 5.000 ms |
| **Ataque humano enviado** | `sabotageRouted` (`source === role`) | `toma` | 35 % | 5.000 ms |

---

## Definición Unificada de Critical Board (`isCriticalBoard`)

Function pura que evalúa la ocupación del tablero del jugador humano:

$$\text{isCriticalBoard}(target) \iff \exists y \le 8, x \in [0, 9] : \text{board}[y][x] \neq \text{null}$$

- **Definición:** Existe al menos una celda ocupada en la fila 8 o por encima de ella (dentro de las coordenadas reales del tablero de 24 filas, donde $y \in [0, 3]$ son ocultas y $y \in [4, 23]$ son visibles), indicando que la pila ha alcanzado la zona crítica superior.
- **Disparo:** Se activa únicamente en la transición de flanco ascendente `safe -> critical`.
- **Compatibilidad:** 100 % compatible tanto con `WsEngineSnapshot` (online) como con `EngineSnapshot` de `BattleSession` (local).

---

## Pruebas Añadidas y Modificadas

- `apps/web/src/audio/combat-reaction-selector.test.ts`:
  - 14 pruebas unitarias que verifican la evaluación atómica con payloads DTO de `BattleSession` local y WebSocket online, exclusión de eventos del bot (`playerTwo`), mapping de eventos, cooldown global, repetición y victorias/derrotas.
- `apps/web/src/game/scenes/GameScene.test.ts`:
  - 3 nuevas pruebas unitarias comprobando que Battle vs Bot dispara voces para el humano, que el bot permanece silencioso y que Training no activa ninguna voz.
- `apps/web/src/audio/audio-manager.test.ts`:
  - 3 pruebas de integración de carga de muestras WAV y respeto de silencio.

---

## Confirmación de Alcance Excluido

- NO se modificó ningún archivo WAV existente.
- NO se modificó `@rautfall/game-engine`, `@rautfall/battle-engine`, `@rautfall/contracts`, backend `apps/api` ni la base de datos.
- NO se añadieron pruebas E2E multi-navegador de audio en Playwright.
- NO se añadieron mensajes adicionales sobre el protocolo WebSocket.
