# Informe de implementación — 0009b — Refinamiento visual del marco Tactical Industrial Dramatic

## Estado

- **Proyecto:** Rautfall
- **Revisión:** 0009b — revisión visual correctiva de `0009` (no es una tarea de mecánica nueva; no crea ni modifica ningún número de tarea funcional)
- **Fecha:** 2026-07-28
- **Alcance:** exclusivamente Vue, CSS y datos de presentación simulados de `apps/web`. Sin cambios en `packages/game-engine` ni `packages/game-config`.

## Resumen

`0009` dejó el layout Tactical funcionalmente completo (316 tests, tres zonas, componentes simulados aislados del dominio) pero con un acabado visual que se percibía como un dashboard técnico plano: paneles con apariencia de tarjeta web independiente, cabecera de tipo `<header>` convencional, mucho vacío negro alrededor del contenido y, sobre todo, un monitor rival minúsculo y casi cómico dentro de una zona desproporcionadamente vacía.

`0009b` corrige exclusivamente composición, escala, integración y acabado, sin tocar ninguna mecánica, ningún contrato del motor y ninguna lógica de `<script setup>` de los componentes reales (`GameCanvas.vue`, `NextPiecesPreview.vue` conservan su script y su template intactos). Los cambios se concentran en:

1. Una carcasa (`.tactical-chassis`) que agrupa cabecera y las tres zonas en una única máquina, con más masa visual y mejor aprovechamiento del viewport.
2. Una cabecera integrada como placa estructural, no como `<header>` web.
3. Un marco de tablero propio con cuatro niveles reales (carcasa · bisel con acento cian/ámbar/rojo según el estado real de sesión · hueco interior · canvas).
4. Una consola táctica única (`.tactical-console`) que sustituye las tarjetas sueltas de próximas piezas, estado de sesión, controles y combate por secciones internas separadas por divisores, dentro de una sola carcasa.
5. Un monitor rival rediseñado: celda más grande (10px → 16px, igual que `NextPiecesPreview`), patrón estático ampliado con perfil irregular ("skyline") en vez de filas completas, ranura de ventilación decorativa y tres líneas de telemetría simulada (enlace, sector, canal), todo fuera de `GamePresentationState` y del motor.
6. Detalles industriales distribuidos (no repetidos): remaches solo en la carcasa general, franja de advertencia solo en la cabecera, ranura de ventilación solo en el monitor rival.

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/App.vue` | Reescritura del layout: carcasa `.tactical-chassis` con remaches, cabecera en placa (`.title-tag`, `.hazard-strip`), marco de tablero en capas (`.board-column` → `.board-bezel` con acento dinámico por estado → `.canvas-wrapper`), consola táctica unificada (`.tactical-console` con `.console-section`/`.console-divider`), reubicación del aviso de ancho insuficiente al inicio del DOM (antes de la carcasa, para respetar el orden de pila §9.1 de `0009`), pie actualizado a "Prototipo técnico — 0009b". Sin cambios en `<script setup>`. |
| `apps/web/src/components/OpponentMonitor.vue` | Nueva estructura visual: ranura de ventilación, marco de tablero recesado, sección de telemetría simulada (enlace/sector/canal) fuera de `.opponent-board` (no afecta el conteo de celdas verificado por los tests). Sin cambios en la lógica del componente (sigue sin temporizadores ni props del motor). |
| `apps/web/src/components/CombatStatusPanel.vue` | Añadido un encabezado de módulo (`.module-heading` + `.module-badge` "PROTOTIPO") distinto de los tres badges `SIMULADO` existentes (se conservan exactamente los tres, uno por bloque). Eliminado el chrome de tarjeta independiente de cada bloque (`.combat-block` ya no tiene fondo/borde propios); añadidos divisores internos (`.combat-divider`). |
| `apps/web/src/components/NextPiecesPreview.vue` | Solo `<style scoped>`: eliminado el fondo/borde/sombra propios de `.next-pieces-preview` (ahora vive dentro de una sección de la consola táctica). Sin cambios en `<script setup>` ni en el template. |
| `apps/web/src/presentation/simulated-tactical-data.ts` | `OPPONENT_CELL_SIZE` de 10 a 16px. `OPPONENT_STATIC_BOARD` generado a partir de `OPPONENT_COLUMN_STACK_HEIGHTS` (perfil irregular por columna) en vez de filas completas literales; sigue siendo determinista, congelado y puramente presentacional. Nuevas constantes `SIMULATED_OPPONENT_LINK_STATUS`, `SIMULATED_OPPONENT_SECTOR`, `SIMULATED_OPPONENT_CHANNEL` para la señalética secundaria del monitor rival. |
| `apps/web/src/styles/tactical-theme.css` | Nuevos tokens: `--rf-shadow-chassis`, `--rf-shadow-recessed`, `--rf-rivet`. Ningún token existente se elimina ni cambia de valor. |
| `apps/web/src/App.test.ts` | Dos pruebas nuevas: existencia de `.tactical-chassis` agrupando las tres zonas reales, y verificación de que el marco del tablero (`.board-bezel--running/--paused/--gameOver`) sigue el estado real de sesión. Ninguna prueba existente se modifica (los `data-testid` no cambian). |
| `apps/web/src/components/OpponentMonitor.test.ts` | Una prueba nueva: la señalética simulada (enlace/sector/canal) es visible en el DOM. |
| `apps/web/src/components/CombatStatusPanel.test.ts` | Una prueba nueva: existe una identificación general de módulo prototipo, distinta y sin alterar el conteo de los tres badges `SIMULADO` por bloque. |
| `apps/web/src/presentation/simulated-tactical-data.test.ts` | Una prueba nueva: la señalética secundaria del rival es texto fijo no vacío. |
| `docs/project-status.md` | Nueva entrada para `0009b` como revisión visual de `0009` (ver más abajo). |

No se crea ningún componente nuevo. No se modifica ningún `data-testid` existente. No se modifica `packages/game-engine` ni `packages/game-config` (confirmado con `git status --short packages/game-engine packages/game-config`, sin salida).

## Análisis comparativo: boceto → captura anterior → resultado

| Aspecto | Boceto "B — Industrial Dramatic" | Captura anterior (0009) | Resultado (0009b) |
|---|---|---|---|
| Estructura general | Consola única con paneles encastrados | Tarjetas sueltas flotando sobre negro | Carcasa `.tactical-chassis` que agrupa cabecera y las tres zonas en una sola placa |
| Cabecera | Placa/rótulo industrial superior | `<h1>` + descriptor sin integración | Placa con tag anguloso (`clip-path`) + franja de advertencia decorativa, dentro del borde inferior de la carcasa |
| Tablero propio | Marco grueso, dominante | Bisel único, poca masa | 4 niveles (carcasa · bisel con acento por estado real · hueco recesado · canvas) |
| Columna central | Instrumentación agrupada | Tarjetas web independientes (próximas piezas, sesión, combate) | Consola única (`.tactical-console`) con secciones y divisores, sin chrome individual |
| Monitor rival | Presencia media, con datos de combate | Tablero 100×200px con enormes márgenes vacíos | Tablero 160×320px, perfil irregular, ventilación y telemetría simulada; columna ensanchada de 220 a 240px |
| Detalles industriales | Remaches, señalética, cortes | Ninguno | Remaches (carcasa), franja de advertencia (cabecera), ventilación (rival) — un detalle por panel, no repetidos |
| Vacío alrededor | Consola ocupa casi todo el encuadre | Mucho negro sin función | `max-width` de la app ampliado a 1440px, chasis con `padding` generoso y `game-layout` centrado; el vacío restante es margen de página, no vacío dentro de la composición |

## Decisiones de composición y escala

- Ancho máximo de la app: 1200px → 1440px.
- Ancho de la columna táctica: 300–380px → 320–400px.
- Ancho del monitor rival: 220px (fijo) → 240px (fijo).
- Tamaño de celda del tablero rival: 10px → 16px (igual que `NextPiecesPreview`, coherencia visual entre previsualizaciones).
- El tablero propio conserva su resolución lógica de Phaser (320×640, sin cambios): sigue siendo el elemento de mayor superficie y contraste continuo de color de toda la composición.
- El breakpoint de portátil compacto (760–1199px) pasa de `flex-wrap` (que no garantizaba el orden tablero-izquierda/columna-derecha-apilada) a un `grid` explícito de dos columnas (`auto` / `1fr`) con el tablero ocupando ambas filas de la izquierda y columna táctica + rival apiladas a la derecha, cumpliendo literalmente §9.1 de `0009`.
- El aviso de ancho insuficiente se movió al inicio del DOM de `.app` (antes de la carcasa) para que, en el suelo mínimo (`<760px`), aparezca siempre primero en la pila, como exige §9.1 de `0009` (antes dependía únicamente de estar oculto por CSS y su posición real en el flujo era posterior al layout).

## Cambios específicos del monitor rival

- `OPPONENT_CELL_SIZE`: 10 → 16px.
- `OPPONENT_STATIC_BOARD`: antes, 40 celdas repartidas en 5 filas completas/casi completas contiguas (filas 10–14). Ahora, 87 celdas generadas deterministamente a partir de `OPPONENT_COLUMN_STACK_HEIGHTS` (alturas por columna: `[10, 8, 11, 6, 9, 10, 5, 8, 11, 9]`), dando un perfil irregular tipo "skyline" que se lee como una partida congelada real, no como un bloque sólido flotante.
- Nueva ranura de ventilación decorativa (`.opponent-vent`) entre la cabecera y el tablero.
- Nueva sección de telemetría (`.opponent-telemetry`): enlace ("ENLACE ESTABLE", en cian), sector ("SECTOR 04") y canal ("CANAL TAC-2"), estática, sin lógica reactiva, fuera del elemento `.opponent-board` (no interfiere con el test que cuenta las celdas ocupadas).
- Ancho de columna: 220px → 240px.
- Se mantiene: sin `PieceType`/`getPieceShape` del motor, sin temporizadores, sin pieza activa, etiqueta `SIMULADO` y pie "Vista de prototipo — sin lógica de combate" sin cambios de texto.

## Cambios en cabecera, tablero propio y columna táctica

- **Cabecera**: pasa de `<header>` con `<h1>` suelto a una placa con borde inferior (parte de la carcasa), un `title-tag` con `clip-path` angular y acento ámbar a la izquierda del logotipo, y una franja de advertencia decorativa (`repeating-linear-gradient` ámbar/grafito) a la derecha. No se añade navegación, menú ni texto decorativo inventado (no se copian literalmente etiquetas tipo "UNIT B-07"/"SYS. 44A" de la referencia).
- **Tablero propio**: `.board-column` (carcasa, `graphite-800`) → `.board-bezel` (bisel con `linear-gradient` metal, que cambia a cian/ámbar/rojo según `gameState.status` vía la clase dinámica `board-bezel--${status}`) → `.canvas-wrapper` (hueco recesado con `--rf-shadow-recessed`) → canvas de Phaser (sin cambios). Esto resuelve además la deuda técnica anotada en el informe de `0009` (punto 4: el acento cian de "running" solo afectaba al texto, no al marco).
- **Columna táctica**: `NextPiecesPreview`, estado de sesión, controles/ayuda y `CombatStatusPanel` pasan de ser cuatro elementos con fondo/borde/sombra propios a cuatro `.console-section` dentro de una única `.tactical-console`, separadas por `.console-divider` (una línea de degradado sutil). El banner de `gameOver` se mantiene fuera de la consola (es un estado real, no un dato de instrumentación) y gana un acento de borde izquierdo en rojo.

## Detalles industriales añadidos

Distribuidos deliberadamente, uno por panel, sin repetir el mismo recurso:

- Remaches de esquina (`::before`/`::after`, 2 por panel) — únicamente en `.tactical-chassis`.
- Franja de advertencia (`repeating-linear-gradient` ámbar/grafito) — únicamente en la cabecera.
- Ranura de ventilación (`repeating-linear-gradient` fina) — únicamente en el monitor rival.
- Tag angular (`clip-path`) — únicamente en el logotipo de la cabecera.
- Acento de color dinámico del bisel del tablero — únicamente en el marco del tablero propio.

Ningún subpanel interno (tarjetas de sesión, bloques de combate, celdas de previsualización) lleva marcas decorativas propias, conforme a §10.7 de `0009`.

## Decisiones responsive

- Escritorio (`≥1200px`): tres columnas en fila dentro de la carcasa, sin cambios de umbral.
- Portátil compacto (`760–1199px`): se sustituye `flex-wrap` por un `grid` de dos columnas explícito (tablero ocupando dos filas a la izquierda; columna táctica y rival apiladas a la derecha, en ese orden), corrigiendo una ambigüedad de orden que `flex-wrap` no garantizaba.
- Suelo mínimo (`<760px`): sin cambios de umbral; se corrige el orden real del aviso de ancho insuficiente moviéndolo al inicio del DOM.
- No se ha modificado ningún valor de los dos puntos de corte (1200px, 760px): la inspección de código mostró que el problema era de disposición interna (`flex-wrap` vs `grid`) y de orden en el DOM, no de los umbrales en sí.

## Pruebas modificadas y añadidas

| Archivo | Pruebas nuevas | Motivo |
|---------|-----------------|--------|
| `App.test.ts` | 2 | Protege la existencia de la carcasa agrupando las tres zonas reales, y el acento dinámico del marco del tablero según el estado real de sesión. |
| `OpponentMonitor.test.ts` | 1 | Protege que la nueva señalética simulada es visible. |
| `CombatStatusPanel.test.ts` | 1 | Protege que la nueva identificación general de módulo no altera el contrato de los tres badges `SIMULADO` por bloque. |
| `simulated-tactical-data.test.ts` | 1 | Protege que las nuevas constantes de señalética son texto fijo no vacío. |

Ninguna prueba existente de `0009` se ha modificado ni roto: los `data-testid`, clases estructurales (`.pause-overlay`, `.opponent-cell`, `.opponent-board`, `.simulated-badge`, `.energy-segment`, `.preview-slot`, `.preview-order`, `.preview-type`, `.piece-grid`, `.piece-cell`) permanecen exactamente iguales.

**Número final de tests: 321** (316 previos de `0009` + 5 nuevos de `0009b`).

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 321 tests, todos pasan (16 archivos) |
| `pnpm lint` | Sin errores ni avisos |
| `pnpm typecheck` | Sin errores (`game-config`, `game-engine`, `apps/web`) |
| `pnpm build` | Build exitoso; único aviso: chunk de Phaser >500kB (deuda técnica aceptada desde `0004`, no bloqueante) |
| `git diff --check` | Sin errores de espacio en blanco |
| `git status --short packages/game-engine packages/game-config` | Sin salida — confirmado que ninguno de los dos paquetes fue modificado |

## Validación manual

Se inició `pnpm --filter @rautfall/web dev` (puerto 5175) y se confirmó mediante `curl` que la página raíz responde `200 OK` con el `<script type="module" src="/src/main.ts">` esperado y sin errores de compilación de Vite en el log del servidor. El servidor de desarrollo se detuvo al finalizar (`kill` del proceso, puerto liberado y verificado).

**Limitación explícita de esta sesión:** este entorno no dispone de ningún navegador headless (`chromium-cli`, Playwright, Puppeteer ni binario de Chromium/Chrome) para renderizar la página, tomar una captura real ni leer la consola del navegador. Por tanto:

- No se ha podido generar una captura final del resultado ni compararla visualmente pixel-a-pixel con el boceto o con la captura anterior, tal como pedía el punto 6 del procedimiento de trabajo.
- No se ha podido confirmar de forma automatizada la ausencia de errores/warnings de consola del navegador en tiempo de ejecución.
- El análisis comparativo de este informe se basa en la inspección directa del boceto y la captura anterior (ambas adjuntas a la conversación) contrastada con el HTML/CSS final leído y razonado componente a componente, no en una captura renderizada del resultado.

**Se solicita explícitamente al usuario** ejecutar `pnpm dev` y validar visualmente, punto por punto:

1. La aplicación se percibe como una consola industrial integrada, no como tarjetas sueltas.
2. El conjunto aprovecha mejor el viewport de escritorio.
3. La cabecera se percibe como parte de la carcasa.
4. El tablero propio domina la composición.
5. La columna táctica no se percibe como un dashboard.
6. El monitor rival ya no se percibe como una miniatura cómica: tiene presencia, legibilidad y escala razonable.
7. Se distinguen carcasa, placas y displays hundidos (especialmente en el marco del tablero propio).
8. Los detalles industriales (remaches, franja de advertencia, ventilación) son visibles pero contenidos, sin competir con el tablero.
9. No hay neón generalizado, bloom ni estética cyberpunk.
10. Pausa, reanudación y reinicio siguen funcionando exactamente igual que en `0008`/`0009`.
11. No aparecen errores nuevos en la consola del navegador.
12. Los tres puntos de corte responsive (`≥1200px`, `760–1199px`, `<760px`) se comportan según lo descrito en este informe.

## Desviaciones respecto de la instrucción de trabajo

- Punto 6 del procedimiento ("genera una captura final y compárala visualmente") no se pudo ejecutar por ausencia de herramientas de navegador headless en este entorno (ver "Validación manual" arriba). Se recomienda, si se desea repetir esta validación de forma automatizada en el futuro, evaluar instalar herramientas de captura headless en el entorno de ejecución — decisión explícitamente fuera del alcance de esta revisión (no se ha añadido ninguna dependencia).
- Se corrigió el orden del aviso de ancho insuficiente en el DOM (antes aparecía después de `.game-layout`, contradiciendo §9.1 de `0009` en el suelo mínimo). No estaba en el diagnóstico visual acordado explícitamente, pero es una corrección de composición/orden directamente relacionada con el alcance de esta revisión (aviso de ancho insuficiente, §9.1) y de riesgo mínimo (no cambia ningún `data-testid` ni comportamiento fuera de CSS).
- Se corrigió el mecanismo de apilado del breakpoint de portátil compacto (`flex-wrap` → `grid` de dos columnas) para cumplir literalmente el orden exigido por §9.1 de `0009` ("tablero a la izquierda; columna táctica y rival apilados a la derecha, en ese orden"), que el `flex-wrap` anterior no garantizaba de forma determinista. Documentado como deuda técnica pendiente de "ajuste fino" en el informe de `0009`; queda resuelto en `0009b`.

## Deuda técnica

- Persiste el aviso de chunk grande de Phaser (>500kB) en `pnpm build`, deuda aceptada desde `0004`.
- La validación visual real (captura de navegador, comparación pixel a pixel, lectura de consola en tiempo de ejecución) queda pendiente de ejecución manual por el usuario, según se detalla arriba.
- El perfil de alturas del tablero rival (`OPPONENT_COLUMN_STACK_HEIGHTS`) es un valor de diseño elegido a mano; si tras la validación visual del usuario se desea un perfil distinto, es un cambio de un solo array literal en `simulated-tactical-data.ts`, sin impacto en ningún contrato ni prueba (las pruebas derivan sus expectativas de la misma constante importada).

## Confirmación de alcance

- No se ha implementado ningún elemento del alcance excluido: no hay segundo motor, bot, energía real, sabotajes reales, hold, ghost piece, puntuación, combos, audio, animaciones avanzadas más allá de las transiciones ya existentes, Playwright, Pinia, Vue Router, ni dependencias nuevas.
- No se ha modificado `packages/game-engine` ni `packages/game-config` (confirmado por `git status --short` sobre ambos directorios, sin salida).
- No se ha añadido ninguna dependencia ni ninguna mecánica nueva; los cambios en `simulated-tactical-data.ts` son ajustes presentacionales de datos ya simulados (patrón del tablero rival, tamaño de celda, señalética textual), explícitamente permitidos por el alcance de esta revisión.
- No se ha modificado ningún `data-testid` existente ni la especificación inmutable de `0009`.
- No se ha hecho ningún commit durante esta revisión.
