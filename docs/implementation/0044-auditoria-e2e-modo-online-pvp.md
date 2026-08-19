# Informe de Implementación — Task 0044: Auditoría E2E del modo PvP Online y correcciones de integración

## Resumen

Esta tarea completa la verificación E2E real y la estabilización del modo PvP Online autoritativo (Tareas 0040-0043), abordando la reactividad síncrona cliente-servidor, las asimetrías de rol P1/P2, la pausa autoritativa, la revancha en la misma sala, la desconexión de rival y la experiencia de usuario en el menú principal.

Se ha creado la suite de pruebas E2E `apps/web/e2e/online-pvp.spec.ts` utilizando dos contextos de navegador Playwright independientes contra el servidor API/WebSocket real, sustituyendo la verificación basada únicamente en mocks unitarios aislados por una auditoría de integración real.

---

## Archivos Creados y Modificados

- **Nuevos archivos**:
  - `apps/web/e2e/online-pvp.spec.ts`: Test E2E Playwright de PvP real con 2 navegadores independientes.
  - `apps/web/src/components/OpponentDisconnectedModal.vue`: Modal industrial bloqueante desplegada inmediatamente cuando el oponente abandona la partida en `/battle`.
  - `apps/web/src/components/BotDifficultyModal.vue`: Modal industrial para la selección directa de la dificultad del bot en Batalla Táctica.
  - `apps/web/src/components/ControlsModal.vue` y `ControlsModal.test.ts`: Modal dedicada para la consulta de controles de teclado desde la barra de utilidades.

- **Modificados**:
  - `packages/contracts/src/pvp-ws.ts`: Esquemas de mensaje para revancha (`request_rematch`, `rematch_requested`).
  - `apps/api/src/rooms/room-manager.ts` & `errors.ts`: Método `resetRoomBattleSession` para reiniciar la sesión de combate conservando la misma sala y sockets con una nueva semilla uint32.
  - `apps/api/src/routes/rooms-ws.ts`: Gestión autoritativa del conjunto de solicitudes de revancha (`rematchRequests`), comprobación idempotente de roles P1/P2 y reinicio autoritativo de partida.
  - `apps/web/src/api/pvp-ws-client.ts`: Métodos y listeners para la revancha y confirmaciones del servidor.
  - `apps/web/src/api/online-game-session.ts`: Gestión de `rematchRequests`, getters de estado y hooks de desconexión.
  - `apps/web/src/App.vue`: Estado reactivo explícito (`onlineSessionStatus`, `onlineRematchRequests`) para sincronización instantánea de UI Vue entre P1 y P2; ocultación de `REINICIAR` en modo `online`; integración de `OpponentDisconnectedModal` y `BotDifficultyModal`.
  - `apps/web/src/components/ModeSelector.vue`: Eliminación del bloque estático permanente de `BOT PROFILE` y apertura condicional de `BotDifficultyModal` al pulsar `BATALLA TÁCTICA`.
  - `apps/web/src/components/ResultsModal.vue`: Soporte para la secuencia de revancha con confirmaciones autoritativas y botón `ACEPTAR REVANCHA` / `ESPERANDO AL RIVAL...`.
  - Pruebas unitarias e integración ajustadas: `App.test.ts`, `ModeSelector.test.ts`, `OnlineRoomModal.test.ts`, `BoardBezelWarning.test.ts`, `client.test.ts`, `navigation-flow.spec.ts`.

---

## Decisiones Relevantes

1. **Prueba E2E con dos navegadores reales (`online-pvp.spec.ts`)**:
   - Se utilizan dos `BrowserContexts` Playwright que ejecutan clientes reales sobre HTTP/Vite (`:5180`) conectándose al servidor Fastify WebSocket (`:3010`).
   - Se verifica la secuencia completa: P1 crea sala $\to$ P1 obtiene el código $\to$ P2 se une con dicho código $\to$ ambos entran a la batalla autoritativa $\to$ avance de ticks $\to$ pausa de P1 deshabilita la reanudación en P2 y autoriza únicamente a P1 $\to$ despausa $\to$ abandono de P1 notifica a P2 y muestra `OpponentDisconnectedModal`.

2. **Garantía de reactividad síncrona en Vue (`App.vue`)**:
   - Se solucionó la asimetría P1/P2 convirtiendo las lecturas de la clase no reactiva `OnlineGameSession` en referencias reactivas de Vue (`onlineSessionStatus`, `onlineRematchRequests`), garantizando la actualización instantánea de la UI en ambos clientes al recibir mensajes del WebSocket.

3. **Revancha autoritativa idempotente en la misma sala**:
   - `RoomManager.resetRoomBattleSession(code)` restablece la sala en estado `ready` instanciando un nuevo `BattleSession` con semilla aleatoria uint32 independiente. El servidor espera la aceptación explícita e idempotente de ambos jugadores (`Set<'playerOne' | 'playerTwo'>`) antes de emitir `battle_started` y lanzar un nuevo `RoomGameRuntime`.

4. **Experiencia de Usuario e Interfaz Industrial**:
   - La opción `REINICIAR` queda oculta en partidas online por carecer de semántica válida.
   - El selector de dificultad de Bot pasa del menú principal a una modal emergente `BotDifficultyModal.vue` que se abre al pulsar `BATALLA TÁCTICA`.

---

## Resultados de las Validaciones

Todas las validaciones requeridas por `AGENTS.md` han sido ejecutadas desde la raíz y han finalizado con éxito:

```bash
pnpm test          # ✅ 1057 tests unitarios/integración pasados (66 archivos)
pnpm test:e2e      # ✅ 23 tests E2E de Playwright pasados (incluyendo online-pvp.spec.ts)
pnpm lint          # ✅ 0 errores, 0 avisos (ESLint limpio)
pnpm typecheck     # ✅ TypeScript / vue-tsc sin errores en todos los paquetes y aplicaciones
pnpm build         # ✅ Compilación de producción exitosa (@rautfall/contracts y @rautfall/web)
git diff --check   # ✅ 0 errores de formato o espacios en blanco
```
