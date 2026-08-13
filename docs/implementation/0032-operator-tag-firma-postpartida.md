# Informe de implementación — Task 0032: Operator Tag de 3 caracteres y firma arcade postpartida

## Resumen

Se ha completado la reestructuración UX definitiva del **Operator Tag de 3 caracteres**, integrando la firma de iniciales arcade directamente en la consola de resultados (`ResultsModal.vue`), solucionando la causa raíz del bug de duplicación de teclas en la entrada de iniciales y garantizando la persistencia diferida del tag únicamente tras la confirmación exitosa en la API.

> El Operator Tag de 3 caracteres es una identidad visual local provisional inspirada en la introducción de iniciales de máquinas arcade. Se solicita en el flujo postpartida para firmar resultados y no constituye autenticación ni sustituye el modelo definitivo de cuentas previsto para Rautfall.

## Causa Raíz del Bug de Teclado y Solución

* **Diagnóstico del problema:** Al presionar una sola tecla, el mismo carácter se introducía en varias celdas (ej. `[R] [R] [R]`).
* **Causa raíz demostrada:** La implementación anterior combinaba un manejador de entrada nativo `@input` en un `<input>` oculto enfocado con un listener global `window.addEventListener('keydown')`. Al presionar una tecla física, el manejador de `keydown` agregaba el carácter a la variable reactiva, y la respuesta del elemento nativo disparaba además un evento `@input`, duplicando la actualización por cada pulsación. Adicionalmente, no se filtraba la propiedad `event.repeat` del navegador.
* **Solución aplicada:**
  - En `ResultsModal.vue` (y en `OperatorTagModal.vue`), el manejador de `keydown` llama explícitamente a `event.preventDefault()` en todas las teclas interceptadas (caracteres alfanuméricos, `Backspace` y `Enter`). Esto cancela la inserción nativa del navegador en el `<input>`, impidiendo que se dispare el evento `@input` duplicado.
  - Se añadió la guarda `if (event.repeat) return;` para descartar los eventos de autorepetición generados por el sistema operativo al mantener una tecla pulsada.
  - Como resultado, **una sola pulsación física de tecla produce exactamente un carácter** (`[R] [_] [_]`), y mantener pulsada una tecla no produce autorepeticiones (`RRR`).

## Decisiones de Arquitectura y UX

1. **Unificación en una sola pantalla postpartida (`ResultsModal.vue`):**
   - Se eliminó el diálogo flotante `OperatorTagModal` del flujo postpartida.
   - Las 3 celdas arcade de iniciales (`[ R ] [ A ] [ U ]`) se maquetaron directamente en `ResultsModal.vue`, conservando la estética Industrial Dramatic (panel hundido inset, borde resplandeciente cian en la celda activa, tornillos mecánicos y tipografía monospace técnica).
   - Si no existe tag guardado previa o localmente, las celdas se muestran vacías (`[ _ ] [ _ ] [ _ ]`). Si existe, se cargan precargadas para su confirmación o edición directa.

2. **Persistencia local diferida de `rautfall_player_tag`:**
   - La edición de celdas en `ResultsModal` actualiza un estado local temporal `editableTag`.
   - `setPlayerTag(normalizedTag)` en `localStorage` se ejecuta únicamente **después** de que `submitMatch(payload)` a la API responda correctamente.
   - Si la API falla, Results permanece abierto mostrando `ERROR AL PERSISTIR (REINTENTABLE)` con las iniciales editadas intactas en pantalla y el tag persistente previo en `localStorage` sin modificar.

3. **Limpieza de resultados no confirmados:**
   - Pulsar `VOLVER A JUGAR` o `MENÚ PRINCIPAL` sin confirmar el resultado ejecuta `pendingMatchResult.value = null` sin realizar peticiones HTTP ni alterar `localStorage`.
   - Iniciar una nueva partida garantiza un estado totalmente limpio sin arrastrar datos de la partida anterior.

4. **Navegación y Ranking por Modo:**
   - Al completarse el guardado con éxito (`saveStatus = saved`), la aplicación captura el modo jugado (`matchData.mode`), limpia `pendingMatchResult` y conmuta `appScreen.value = 'ranking'` con `:initial-mode="rankingInitialMode"`, abriendo directamente la pestaña correspondiente (Entrenamiento o Batalla vs Bot).

5. **Auditoría de `linesCleared` y Nomenclatura:**
   - Se mantiene la métrica real `linesCleared: state.clearedLines` emitida por el motor `@rautfall/game-engine`.
   - Se actualizó la terminología visible en la UI y documentación de `Batalla (2P)` a `BATALLA VS BOT` / `BATALLA`.

## Archivos Modificados y Creados

* `docs/tasks/0032-operator-tag-firma-postpartida.md`: especificación formal actualizada.
* `apps/web/src/game/types.ts`: incorporación de `linesCleared?: number` a `GameResultSummary`.
* `apps/web/src/components/ResultsModal.vue`: pantalla postpartida unificada con firma arcade integrada, control de teclado con `event.preventDefault()` y `event.repeat`.
* `apps/web/src/components/ResultsModal.test.ts`: suite de pruebas unitarias actualizada con el test de regresión explícito `one physical key press adds exactly one tag character`.
* `apps/web/src/components/OperatorTagModal.vue`: corrección del bug de duplicación de teclas en el modal de Settings.
* `apps/web/src/App.vue`: orquestación de persisistencia diferida tras POST exitoso, captura de modo para Ranking y limpieza de `pendingMatchResult`.
* `apps/web/src/App.test.ts`: pruebas de integración del flujo postpartida unificado, persistencia diferida y abandono sin confirmar.
* `apps/web/e2e/operator-tag-flow.spec.ts`: prueba E2E de Playwright con verificación de una pulsación por celda y navegación a Ranking.
* `docs/project-status.md`: actualización del registro de la tarea 0032.

## Verificación de Comandos

- `pnpm test`: 843 tests Vitest pasando.
- `pnpm lint`: sin errores ni avisos.
- `pnpm typecheck`: 0 errores en el monorepo.
- `pnpm build`: compilación de producción exitosa.
- `pnpm --filter @rautfall/web test:e2e`: 12 escenarios Playwright en verde.
