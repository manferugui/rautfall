# Task 0032 — Operator Tag de 3 caracteres y firma arcade postpartida

## Objetivo

Convertir la identidad visible del usuario en un **Operator Tag de 3 caracteres** inspirado en la introducción de iniciales de máquinas arcade.

El tag funciona como una **firma de iniciales postpartida** integrada directamente dentro de la pantalla de Resultados (`ResultsModal.vue`), eliminando cualquier overlay flotante o bloqueo previo a la navegación.

> El Operator Tag de 3 caracteres es una identidad visual local provisional inspirada en la introducción de iniciales de máquinas arcade. Se solicita en el flujo postpartida para firmar resultados y no constituye autenticación ni sustituye el modelo definitivo de cuentas previsto para Rautfall.

## Alcance

* **Navegación libre sin bloqueos:** Batalla (vs Bot), Entrenamiento (1P), Ranking, Historial y Menú Principal son 100% accesibles sin solicitar tag previo.
* **Separación estricta de identidades:** Mantenimiento de `rautfall_player_id` (UUID v4) como identidad técnica interna inmutable. `rautfall_player_tag` almacena la firma local provisional de 3 caracteres (`[A-Z0-9]{3}`).
* **Pantalla única de Results:** Al finalizar una partida (`gameOver` o batalla terminada), el jugador contempla la consola de Resultados (`ResultsModal.vue`) que integra físicamente:
  1. Resultado del juego (`ENTRENAMIENTO FINALIZADO`, `VICTORIA`, `DERROTA`, `EMPATE`).
  2. Puntuación final, nivel alcanzado, tiempo y líneas eliminadas reales (`linesCleared`).
  3. Módulo de Firma de Operador con las 3 celdas arcade (`[ R ] [ A ] [ U ]`).
  4. Acción principal: `[ CONFIRMAR RESULTADO ]`.
  5. Acciones secundarias: `[ VOLVER A JUGAR ]` y `[ MENÚ PRINCIPAL ]`.
* **Respuesta de teclado única (Regresión del bug de múltiples celdas):** Una pulsación física de tecla introduce exactamente una inicial en una celda. Se ignora `event.repeat` para evitar autorepetición del sistema operativo al mantener pulsada la tecla.
* **Persistencia local diferida:** El tag editado en `ResultsModal` se guarda localmente en `localStorage` únicamente **después** de que el envío POST a la API responda exitosamente. Un error de red conserva las iniciales editadas en pantalla sin alterar la identidad previa guardada.
* **Limpieza de resultados no confirmados:** Abandonar Results mediante `VOLVER A JUGAR` o `MENÚ PRINCIPAL` limpia `pendingMatchResult.value = null` sin enviar datos ni persisitr iniciales parciales.
* **Navegación automática a Ranking:** Tras un POST exitoso a la API, la aplicación cierra Resultados y navega automáticamente a `RankingScreen` en el modo de la partida recién jugada (Entrenamiento o Batalla), realizando una consulta real al servidor.
* **Métrica real de `linesCleared`:** Se utiliza la métrica real de líneas acumuladas procedente del motor de juego (`state.clearedLines`), sin derivarla de la puntuación.

## Fuera de Alcance

* Sistemas de autenticación (cuentas, email, contraseña, JWT, OAuth, sesiones).
* Cambios en los contratos públicos `@rautfall/contracts`.
* Modificación de la lógica del motor `@rautfall/game-engine` o `@rautfall/battle-engine`.

## Criterios de Aceptación

1. Batalla vs Bot e Inicia sin solicitar tag.
2. Entrenamiento 1P inicia sin solicitar tag.
3. Historial y Ranking abren libremente sin tag.
4. Al producirse Game Over, `ResultsModal` integra las iniciales directamente en la misma pantalla sin abrir un segundo popup.
5. Una sola pulsación de tecla añade exactamente una inicial en la celda correspondiente (`[R] [_] [_]`).
6. Mantener pulsada una tecla ignora `event.repeat` y no produce `RRR`.
7. `Backspace` borra exactamente un carácter por pulsación.
8. La confirmación del resultado solo se habilita con 3 caracteres alfanuméricos válidos.
9. `rautfall_player_tag` en `localStorage` se actualiza únicamente tras un POST exitoso a la API.
10. Si el POST falla, Results permanece abierto en estado de error permitiendo reintentar.
11. Abandonar Results (`VOLVER A JUGAR` o `MENÚ PRINCIPAL`) descarta el resultado pendiente sin enviar datos a la API ni modificar `localStorage`.
12. Tras un guardado exitoso, la aplicación navega automáticamente a `RankingScreen` en el modo correspondiente (Entrenamiento o Batalla).
13. `linesCleared` utiliza la métrica real `state.clearedLines` del motor.
14. El UUID interno persistente no se altera ni se regenera al crear o modificar el tag.
