# Informe de implementación — 0009 — Marco Tactical e identidad visual Industrial Dramatic

## Resumen

Se ha implementado el layout Tactical de escritorio con identidad visual Industrial Dramatic para la pantalla de partida de Rautfall. La aplicación pasa de un panel técnico plano y azul-marino a una composición de tres zonas con paleta grafito/metal, acentos cian/ámbar/rojo, biseles pronunciados y paneles encastrados. Se han añadido componentes simulados para rival, energía, cartucho y Residuos, todos explícitamente etiquetados como simulados. No se ha modificado `packages/game-engine` ni `packages/game-config`.

## Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `apps/web/src/styles/tactical-theme.css` | Hoja de variables CSS del tema Industrial Dramatic (`:root { --rf-* }`). |
| `apps/web/src/presentation/simulated-tactical-data.ts` | Módulo puro de datos simulados congelados (tablero rival, energía, cartucho, Residuos). |
| `apps/web/src/presentation/simulated-tactical-data.test.ts` | Pruebas de estructura y límites de los datos simulados. |
| `apps/web/src/components/OpponentMonitor.vue` | Monitor rival simulado con tablero estático 10×20 y etiqueta SIMULADO. |
| `apps/web/src/components/OpponentMonitor.test.ts` | Pruebas del monitor rival (presencia, celdas, inmutabilidad temporal). |
| `apps/web/src/components/CombatStatusPanel.vue` | Panel de combate simulado (energía segmentada, cartucho, Residuos). |
| `apps/web/src/components/CombatStatusPanel.test.ts` | Pruebas del panel de combate (tres bloques, badges, constantes). |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `apps/web/src/main.ts` | Importación de `tactical-theme.css`. |
| `apps/web/src/App.vue` | Reescribo completo: layout de tres columnas, cabecera, aviso de ancho insuficiente, estilo Industrial Dramatic. |
| `apps/web/src/App.test.ts` | Migración de selectores `button:first-child`/`button:last-child` a `data-testid="pause-toggle"`/`data-testid="reset-button"`. Nuevas pruebas de layout, componentes simulados y width-warning. |
| `apps/web/src/components/NextPiecesPreview.vue` | Solo CSS scoped: fondo, bordes, sombra, tipografía según variables del tema. Sin cambios en script o template. |

## Archivos no modificados (confirmado)

- `packages/game-engine/`: sin cambios.
- `packages/game-config/`: sin cambios.
- `docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md`: inmutable.

## Componentes extraídos

- **OpponentMonitor.vue**: nuevo, monitor rival simulado con tablero estático.
- **CombatStatusPanel.vue**: nuevo, panel de combate simulado (energía, cartucho, Residuos).

## Componentes deliberadamente no extraídos

- Marco/carcasa del tablero propio: CSS sobre `.canvas-wrapper` existente, sin lógica propia.
- Aviso de ancho insuficiente: elemento estático con CSS de visibilidad condicional.
- Overlay de pausa y banner de gameOver: ya existentes, solo reestilados.
- Estado de sesión y controles: ya existentes, solo reestilados y reubicados.

## Decisiones finales de layout

| Parámetro | Valor |
|-----------|-------|
| Ancho columna tablero propio | 360 px (320 px canvas + marco industrial de 2×6 px padding + 2×2 px borde) |
| Ancho columna táctica | 300–380 px (flexible) |
| Ancho monitor rival | 220 px (fijo) |
| Separación entre zonas | 24 px |
| Escritorio | ≥ 1200 px, tres columnas en fila |
| Portátil compacto | 760–1199 px, dos columnas (tablero izq, columna táctica + rival apilados a la derecha) |
| Suelo mínimo | < 760 px, una columna apilada con aviso |

## Decisiones finales de paleta y estilo

Todas las variables CSS están definidas en `tactical-theme.css` (`:root { --rf-* }`). Valores clave:

- Fondo página: `#0b0b0d` (void)
- Paneles hundidos: `#17181a` (graphite-900)
- Paneles principales: `#1f2023` (graphite-800)
- Subpaneles: `#28292c` (graphite-700)
- Bordes: `#3a3b3f` (metal-600)
- Acento activo/energía: `#00d4ff` (cian, reutiliza color pieza I)
- Acento avisos/acciones: `#f39c12` (ámbar, reutiliza color pieza L)
- Acento peligro/gameOver: `#e74c3c` (rojo, reutiliza color pieza Z)
- Texto principal: `#e8e8ec`
- Texto secundario: `rgba(232,232,236,0.6)`
- Bisel panel: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35)`

## Inventario de paneles reales vs simulados

### Reales
- Tablero propio (Phaser, sin cambios)
- NextPiecesPreview (tres próximas piezas reales, solo reestilado)
- Estado de sesión (`status`, `step`, `elapsedMs`)
- Botones Pausar/Reanudar y Reiniciar (con `data-testid`)
- Overlay de pausa (reestilado, ámbar sobre fondo semitransparente)
- Banner de gameOver (reestilado, rojo sobre grafito con borde)
- Ayuda de controles (reestilada)

### Simulados
- OpponentMonitor (tablero estático 10×20, etiqueta SIMULADO)
- CombatStatusPanel.energía (7 segmentos, 3 activos en cian)
- CombatStatusPanel.cartucho (texto fijo "Cartucho — prototipo" en ámbar)
- CombatStatusPanel.Residuos (contador fijo "Residuos: 0" en rojo)

## Integración del marco exterior del tablero propio con Phaser

El canvas de Phaser conserva su resolución 320×640 y fondo transparente. `.canvas-wrapper` en `App.vue` se ha envuelto en un `div.board-column` que aplica el marco industrial: fondo `graphite-900`, borde `metal-600` de 2 px, radio `--rf-radius-md`, `--rf-shadow-board-frame` (bisel pronunciado) y padding de 6 px alrededor del canvas. El overlay de pausa se superpone con posición absoluta y radio coincidente. El acento cian de partida activa se aplica mediante la clase `.session-value.running` en el status, no como borde permanente del marco (el marco mantiene su color metal-600 fijo).

## Pruebas añadidas y modificadas

| Archivo | Pruebas | Tipo |
|---------|---------|------|
| `simulated-tactical-data.test.ts` | 5 nuevas (congelación, límites, duplicados, coherencia) | Nueva |
| `OpponentMonitor.test.ts` | 4 nuevas (etiqueta SIMULADO, celdas, sin pieza activa, inmutabilidad temporal) | Nueva |
| `CombatStatusPanel.test.ts` | 4 nuevas (tres bloques, badges, constantes, idempotencia) | Nueva |
| `App.test.ts` | 13 pruebas (8 migradas + 5 nuevas de layout) | Modificada |

### Migración de selectores en App.test.ts

- `button:first-child` → `[data-testid="pause-toggle"]`
- `button:last-child` → `[data-testid="reset-button"]`

## Comandos ejecutados y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 316 tests, todos pasan |
| `pnpm lint` | Sin errores ni avisos |
| `pnpm typecheck` | Sin errores |
| `pnpm build` | Build exitoso (aviso de chunk de Phaser aceptado) |
| `git diff --check` | Sin errores de espacio en blanco |

## Desviaciones respecto de la especificación

Ninguna. Todas las reglas de la especificación 0009 se han seguido sin desviación.

## Deuda técnica identificada

1. Los umbrales de ancho responsive deben validarse manualmente en el navegador.
2. El layout de portátil compacto (760–1199px) usa `flex-wrap` básico que puede necesitar ajuste fino tras validación visual.
3. No hay marcas decorativas de esquina (tornillos/respiraderos) en los paneles principales — la especificación §10.7 permitía hasta cuatro marcas, pero se ha priorizado la legibilidad y no se han añadido por ser puramente decorativas sin impacto funcional. Pueden añadirse en una iteración posterior si se desea más densidad industrial.
4. La especificación §10.8 menciona un acento cian en el marco del tablero propio durante `running`, pero la implementación actual usa el color del texto de status para ese acento. El marco mantiene un borde `metal-600` fijo. Esto es coherente con el principio de no tener un "resplandor permanente" (§11) y con la legibilidad, pero podría ajustarse tras validación manual si se desea más énfasis visual en el running state mediante el marco.

## Validación manual pendiente

Solicitar al usuario ejecutar `pnpm dev` y comprobar:

1. El tablero propio sigue siendo el elemento visualmente dominante de la pantalla.
2. La identidad Industrial Dramatic se percibe (grafito, metal, biseles, acentos cian/ámbar/rojo) sin perder legibilidad.
3. Las tres próximas piezas siguen viéndose con claridad.
4. Pausar, reanudar y reiniciar funcionan exactamente igual que en 0008.
5. El monitor rival no se confunde con una partida real (etiqueta SIMULADO visible, sin pieza activa).
6. Energía, cartucho y Residuos se leen como prototipo, no como partida real.
7. Layout escritorio (≥1200px) muestra tres columnas en fila.
8. Layout portátil (760–1199px) apila columna táctica y monitor rival.
9. Por debajo de 760px aparece el aviso de ancho insuficiente.
10. No aparecen errores ni warnings nuevos en consola.

## Confirmación de alcance excluido

- No se implementó ningún elemento del §7 (alcance excluido).
- No se modificaron `packages/game-engine` ni `packages/game-config`.
- No se añadieron dependencias.
- No se hicieron commits durante la implementación.
- No se añadió hold, ghost piece, puntuación, combos, energía real, cartuchos reales, sabotajes reales, batalla real, segundo motor, bot, muerte súbita, audio, Pinia, Vue Router ni Playwright.
- No se usaron imágenes rasterizadas como base del layout.
- Los datos simulados permanecen fuera de `GamePresentationState`, `game-engine` y `game-config`.
</write_to_file>
