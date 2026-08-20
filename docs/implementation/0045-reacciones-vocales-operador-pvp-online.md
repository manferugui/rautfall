# Informe de Implementación — Tarea 0045: Reacciones vocales automáticas del operador en PvP Online

## Resumen

Se ha completado la implementación del sistema audiovisual de reacciones vocales automáticas del operador para el modo PvP Online en `apps/web`.

Las voces proporcionan feedback sonoro humorístico y macarra exclusivamente en la presentación del cliente local ante hechos reales ocurridos en la partida PvP online, sin modificar los motores de dominio, el protocolo WebSocket, el backend autoritativo ni la persistencia de datos.

El diseño se ha estructurado en tres componentes desacoplados:
1. **Extensión del subsistema de audio (`AudioManager` + `operator-reactions.ts`):** Precarga, almacenamiento en memoria y reproducción de los 13 activos WAV existentes (`apps/web/public/audio/operator-reactions/`) a través del bus `sfxGain` y el `AudioContext` singleton preexistente, respetando la configuración de silencio global (`isMuted()`) y efectos de sonido (`isSfxEnabled()`).
2. **Selector y controlador puro de reacciones (`PvPReactionSelector`):** Módulo 100% testeable de forma determinista que evalúa atómicamente cada mensaje `game_state` enviado a 20 Hz por el servidor. Aplica una jerarquía de prioridades estricta, la función de estado presentacional `isCriticalBoard`, cooldown global de 5.000 ms, evitación de repetición inmediata y probabilidades inyectables.
3. **Integración aislada en `GameScene.ts`:** Evaluación exclusiva cuando `mode === 'online'`, derivando como máximo UNA única reacción vocal por tick y descartando ráfagas.

---

## Archivos Creados y Modificados

### Archivos Creados
- `docs/tasks/0045-reacciones-vocales-operador-pvp-online.md`: Especificación técnica inmutable de la Tarea 0045.
- `apps/web/src/audio/operator-reactions.ts`: Mapa de activos de las 13 muestras WAV y definición de pools de reacciones.
- `apps/web/src/audio/pvp-reaction-selector.ts`: Controlador/selector puro `PvPReactionSelector` y helper `isCriticalBoard`.
- `apps/web/src/audio/pvp-reaction-selector.test.ts`: Suite de pruebas unitarias exhaustivas del selector de reacciones.
- `docs/implementation/0045-reacciones-vocales-operador-pvp-online.md`: El presente informe de implementación.

### Archivos Modificados
- `apps/web/src/audio/types.ts`: Incorporado el tipo `OperatorReactionType` y la declaración de `playOperatorReaction` en la interfaz `AudioService`.
- `apps/web/src/audio/audio-manager.ts`: Implementación de precarga, almacenamiento en mapa y reproducción de muestras WAV en `AudioManager`.
- `apps/web/src/audio/index.ts`: Exportación pública de `operator-reactions` y `pvp-reaction-selector`.
- `apps/web/src/audio/audio-manager.test.ts`: Pruebas de integración de carga de muestras de reacción y respeto del estado de silencio.
- `apps/web/src/game/scenes/GameScene.ts`: Integración de `PvPReactionSelector` dentro del callback `onGameState` cuando `mode === 'online'`.
- `docs/project-status.md`: Actualización del estado general del proyecto.

---

## Mapping Final Evento -> Reacción

| Acontecimiento en la Partida PvP | Condición Contractual Exacta | Pool / Reacción | Probabilidad | Cooldown |
| :--- | :--- | :--- | :---: | :---: |
| **Victoria definitiva** | `status === 'playerOneWon'/'playerTwoWon'` y `winner === role` | `a_tomar_por_culo` | 100 % | Ignora |
| **Derrota definitiva** | `status === 'playerOneWon'/'playerTwoWon'` y `winner !== role` | `jooooder` | 100 % | Ignora |
| **Empate (Draw)** | `status === 'draw'` / `winner === 'draw'` | *Silencio (Sin reacción)* | — | — |
| **Entrada en estado crítico** | Transición `safe -> critical` (`isCriticalBoard`) | `no_no_no`, `hostia_hostia` | 50 % | 5.000 ms |
| **Garbage aplicado al local** | `participantEvent` (`participant === role`, `garbageApplied`) | `hijo_puta`, `me_cago_en_todo`, `joder` | 60 % | 5.000 ms |
| **Sabotaje recibido por local** | `sabotageRouted` (`target === role`) | `cabron`, `no_me_jodas`, `pero_que_coño` | 35 % | 5.000 ms |
| **Ataque propio bloqueado** | `sabotageBlocked` (`source === role`) | `mierda`, `joder` | 35 % | 5.000 ms |
| **Defensa propia exitosa** | `sabotageBlocked` (`target === role`) | `eso_es_todo` | 35 % | 5.000 ms |
| **Ataque propio enviado** | `sabotageRouted` (`source === role`) | `toma` | 35 % | 5.000 ms |

---

## Definición Final de Critical Board (`isCriticalBoard`)

Function pura que evalúa la ocupación del tablero del jugador local:

$$\text{isCriticalBoard}(snapshot) \iff \exists y \le 8, x \in [0, 9] : \text{board}[y][x] \neq \text{null}$$

- **Definición:** Existe al menos una celda ocupada en la fila 8 o por encima de ella (dentro de las coordenadas reales del tablero de 24 filas, donde $y \in [0, 3]$ son ocultas y $y \in [4, 23]$ son visibles), indicando que la pila ha alcanzado la zona crítica superior.
- **Disparo:** Se activa únicamente en la transición de flanco ascendente `safe -> critical`.
- **Cobertura de estados comprobada en pruebas:**
  - `safe -> safe`: Permanece silencioso.
  - `safe -> critical`: Evalúa disparo de voz.
  - `critical -> critical`: Permanece silencioso.
  - `critical -> safe`: Restablece el flag de transición.
  - `critical -> safe -> critical`: Permite evaluar una nueva reacción al volver a subir.

---

## Diseño Final de Cooldown, Prioridades y Probabilidad

1. **Evaluación Atómica por Game State:**
   Cada mensaje `game_state` enviado por el servidor a 20 Hz se evalúa en bloque. Se determina la categoría de mayor prioridad presente en el tick y se evalúa su tirada de probabilidad. Si se aprueba, se devuelve esa única reacción y finaliza la evaluación del tick, garantizando que se reproduce **como máximo UNA reacción vocal** por actualización y previniendo ráfagas sonoras.
2. **Jerarquía Estricta de Prioridades:**
   $$\text{Terminal} > \text{Critical} > \text{Garbage Aplicado} > \text{Sabotaje Recibido} > \text{Ataque Bloqueado / Defensa} > \text{Ataque Propio}$$
3. **Cooldown Global de 5.000 ms:**
   Las reacciones no terminales respetan un intervalo mínimo de 5.000 ms desde la última emisión. Las reacciones terminales ignoran el cooldown.
4. **No Repetición Inmediata:**
   Al seleccionar dentro de un pool con 2 o más frases disponibles, se excluye la última frase utilizada (`lastReactionId`).
5. **Aislamiento PvP Online:**
   `PvPReactionSelector` solo se ejecuta dentro de `GameScene.ts` cuando `mode === 'online'`. Se reinicia completamente en cada inicio y fin de sesión.

---

## Pruebas Añadidas

- `apps/web/src/audio/pvp-reaction-selector.test.ts`:
  - 13 pruebas unitarias que verifican la función `isCriticalBoard` (secuencia completa de 5 estados), mapping de eventos contractuales a pools, cooldown global de 5s, prioridad estricta en ticks compuestos, no repetición inmediata, victorias/derrotas terminales (una sola vez por partida, ignorando cooldown), empate silencioso, control de probabilidad por inyección y reseteo de estado.
- `apps/web/src/audio/audio-manager.test.ts`:
  - 3 nuevas pruebas de integración que comprueban la precarga, registro en memoria y reproducción de muestras vocales mediante `AudioManager`, así como el respeto estricto del estado de silencio (`sfxEnabled = false` / `isMuted()`).

---

## Confirmación de Alcance Excluido

- NO se modificó ningún archivo WAV existente.
- NO se modificó `@rautfall/game-engine`, `@rautfall/battle-engine`, `@rautfall/contracts`, backend `apps/api` ni la base de datos.
- NO se añadieron pruebas E2E multi-navegador de audio en Playwright.
- NO se añadieron mensajes adicionales sobre el protocolo WebSocket.
