# 0009 — Marco Tactical e identidad visual Industrial Dramatic

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0009 — Marco Tactical e identidad visual Industrial Dramatic
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0009`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para la batalla, el bot, la energía real o los sabotajes reales pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0009-marco-tactical-identidad-visual-industrial-dramatic.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0009-marco-tactical-identidad-visual-industrial-dramatic.md) (ver §24), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Consolidar la pantalla de partida actual (hoy un panel técnico plano, sin dirección de arte) en un **layout Tactical de escritorio** con **identidad visual Industrial Dramatic**, sin añadir ninguna mecánica jugable ni estado de dominio nuevo.

Al terminar la tarea:

- el tablero propio (Phaser) sigue siendo la única representación jugable real y pasa a ser el elemento visualmente dominante de una composición de tres zonas (tablero propio · columna táctica · monitor rival);
- las tres próximas piezas reales (`NextPiecesPreview.vue`) y los tres estados reales de sesión (`running`, `paused`, `gameOver`) se integran dentro de esa composición, restilados, sin cambiar su lógica;
- aparecen, como prototipo visual explícitamente simulado, un monitor rival, un indicador de energía, un cartucho de sabotaje y un indicador de Residuos, ninguno conectado a lógica de dominio real;
- la aplicación adopta una paleta, tipografía, profundidad y lenguaje de bordes/paneles coherentes con «Industrial Dramatic», sustituyendo la estética azul-marino plana actual;
- `packages/game-engine` y `packages/game-config` no cambian en absoluto.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo                                        ✅ Completada
0002 — Motor de juego determinista                                ✅ Completada
0003 — Rotación SRS                                                ✅ Completada
0004 — Integración de Phaser                                       ✅ Completada
0005 — DAS, ARR y soft drop                                         ✅ Completada
0006 — Lock delay y fijación diferida                               ✅ Completada
0007 — Cola de próximas piezas y preview técnico provisional        ✅ Completada
0008 — Pausa, reanudación y reinicio coordinados                   ✅ Completada
0009 — Marco Tactical e identidad visual Industrial Dramatic       ← Esta tarea
```

Esta tarea no incluye: hold, ghost piece, puntuación, combos, T-Spins, back-to-back, energía real, cartuchos reales, sabotajes reales, batalla real, segundo motor, bot, muerte súbita, audio, backend, Pinia, Vue Router, Playwright, CI/CD, corrección del aviso de chunk de Phaser, ni soporte táctil o mobile. Ver §7 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — secciones «Decisión visual: dirección Industrial Dramatic» (rasgos a conservar, límites visuales), «Jerarquía visual de batalla» (layouts Tactical/Duel, reglas de Tactical), «Representación de sabotajes» (cartuchos industriales, código visual por color), «Alcance de dispositivos» (MVP centrado en escritorio, aviso en dispositivos sin ancho suficiente), y «Primera puerta de ejecución»/«Layout Tactical de esta fase» (qué es funcional y qué es simulado en esta primera iteración).
- [docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md) — canvas lógico 320×640, fondo transparente, responsabilidades Vue/Phaser, ausencia de HUD dentro del canvas.
- [docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md](0007-cola-proximas-piezas-preview-tecnico.md) — decisión ya tomada y validada de resolver previsualizaciones con Vue+CSS (no Phaser, no SVG), criterios que esta tarea reutiliza para el monitor rival y el panel de combate (§20 de ese documento).
- [docs/tasks/0008-pausa-reanudacion-reinicio-coordinados.md](0008-pausa-reanudacion-reinicio-coordinados.md) — `SessionStatus`, overlay de pausa, botones Pausar/Reanudar y Reiniciar, banner de `gameOver`, todos reales y que esta tarea conserva funcionalmente.
- `apps/web/src/App.vue`, `apps/web/src/App.test.ts`, `apps/web/src/components/GameCanvas.vue`, `apps/web/src/components/GameCanvas.test.ts`, `apps/web/src/components/NextPiecesPreview.vue`, `apps/web/src/components/NextPiecesPreview.test.ts`, `apps/web/src/game/types.ts`, `apps/web/src/game/coordinates.ts` — implementación web real tras `0008` (todos inspeccionados íntegros, ver §4).
- La referencia visual aportada por el usuario (mockup «B — Industrial Dramatic», panel de consola industrial con tablero propio, HOLD, NEXT, ENERGY/SCORE/COMBO/ATTACK SLOTS y monitor OPPONENT). Se trata como dirección de arte, no como layout literal ni especificación funcional (ver §5).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto (298 tests, siguiente tarea abierta a decisión).

## 4. Inspección previa (confirmada por lectura directa del código real)

### 4.1 Estructura y estilo actuales de `App.vue`

- `App.vue` renderiza hoy: título `<h1>Rautfall</h1>`, un bloque de error condicional, un `.game-layout` flex con dos hijos (`.canvas-wrapper` con `<GameCanvas>` y el overlay `.pause-overlay`; `.info-panel` con `.info-grid` de tres tarjetas técnicas `status`/`step`/`elapsedMs`, `<NextPiecesPreview>`, `.actions` con los botones Pausar/Reanudar y Reiniciar, `.controls-help` con la lista de teclas, y el banner `.game-over-banner`), y un `<p class="footnote">Prototipo técnico — 0008</p>`.
- Paleta actual (todos los valores están hoy dispersos como literales en el `<style>` global de `App.vue` y en el `<style scoped>` de `NextPiecesPreview.vue`, sin ninguna variable CSS compartida): fondo `#1a1a2e`, paneles `#16213e`, acento de botón/borde `#0f3460`/`#1a4a8a`, texto `#e0e0e0`/`#ffffff`, error `#3d1f1f`/`#ff6b6b`, `game-over-banner` en `#8b0000`. Es una estética azul-marino plana, sin relación con Industrial Dramatic.
- `NextPiecesPreview.vue` ya usa una paleta de color por tipo de pieza (`PIECE_DISPLAY_COLORS`) que **sí** es reutilizable como acento cian/ámbar/rojo consistente en toda la aplicación (`I: '#00d4ff'` cian, `L: '#f39c12'` ámbar, `Z: '#e74c3c'` rojo), evitando inventar una paleta nueva y desconectada (§10.2).
- `GameCanvas.vue` fija `.game-container` a `width: 320px; height: 640px` en CSS (coincide exactamente con `CANVAS_WIDTH`/`CANVAS_HEIGHT` de `coordinates.ts`), con `position: relative` para que `.pause-overlay` (definido en `App.vue`, posicionado sobre `.canvas-wrapper`) se superponga correctamente.
- No existe hoy ningún archivo de estilos compartido, ninguna variable CSS (`:root`), ningún componente `OpponentMonitor`/`CombatStatusPanel`/equivalente, ninguna lógica de ancho mínimo ni ningún aviso de ancho insuficiente.
- `apps/web/src/App.test.ts` selecciona los botones mediante `button:first-child` (Pausar/Reanudar) y `button:last-child` (Reiniciar) dentro de `.actions`, y localiza el componente `NextPiecesPreview` mediante `wrapper.findComponent({ name: 'NextPiecesPreview' })`. Estos selectores son frágiles frente a una reestructuración del layout (§21.4).

### 4.2 Lo que ya es real y no debe reimplementarse

- Tablero propio: renderizado íntegramente por Phaser desde `getSnapshot()` (0004–0008), sin cambios de esta tarea.
- Tres próximas piezas: `NextPiecesPreview.vue`, alimentado por `GamePresentationState.nextPieces`, usando `getPieceShape` de `@rautfall/game-engine` (0007).
- Estado de sesión: `SessionStatus = 'running' | 'paused' | 'gameOver'` (0008), expuesto en `GamePresentationState.status`, con overlay de pausa y banner de `gameOver` ya funcionales.
- Controles reales: botón Pausar/Reanudar (`controller.togglePause()`), botón Reiniciar (`controller.reset()`), tecla `Esc`, tecla `R`; ninguno cambia de comportamiento en esta tarea.

### 4.3 Lo que no existe y esta tarea puede añadir sin tocar el motor

- Ningún dato de rival, energía, cartucho o Residuos existe en ningún paquete. `packages/game-engine` no expone (ni debe exponer tras esta tarea) ningún tipo de energía, sabotaje o segundo jugador. Confirmado por lectura de `packages/game-engine/src/index.ts`: `EngineSnapshot` no tiene, y esta tarea no le añade, ningún campo relativo a combate.

## 5. Referencia visual: qué se conserva y qué se adapta o se excluye

La imagen de referencia («B — INDUSTRIAL DRAMATIC») es dirección de arte, no layout literal ni especificación funcional. Se usa para fijar reglas técnicas verificables (§10), no para copiar textos, números o proporciones.

### 5.1 Se conserva conceptualmente

- Estructura de consola o maquinaria industrial: paneles claramente encastrados, con marco exterior distinto del fondo de la página.
- Superficies de grafito y metal oscuro, con profundidad (paneles hundidos/realzados mediante sombra, no planos).
- Desgaste contenido: alguna veta o textura sutil de metal es aceptable; no se acepta suciedad, arañazos o ruido visual denso.
- Juntas, tornillos, respiraderos y señalética técnica discretos: como mucho, pequeñas marcas decorativas en las esquinas de los paneles principales (§10.7), nunca repetidas en cada elemento.
- Tablero propio dominante en tamaño y posición.
- Una columna o zona intermedia de instrumentación entre el tablero propio y el monitor rival.
- Monitor rival claramente separado y de menor peso visual que el tablero propio.
- Bloques de colores vivos (las piezas, ya resueltas por Phaser y por `NextPiecesPreview`) sobre un entorno sobrio.
- Tipografía técnica/condensada para rótulos y cabeceras.
- Cian para estado activo/energía, ámbar para avisos/acciones, rojo para peligro (§10.2).
- Jerarquía visual fuerte: el área de juego no compite con la decoración (§12).

### 5.2 Se adapta

- La columna `NEXT` de la referencia (a la derecha del tablero) se sustituye por el componente real `NextPiecesPreview.vue` ya existente, reestilado, integrado dentro de la columna táctica (§15).
- El panel `ENERGY`/`SCORE`/`COMBO`/`ATTACK SLOTS` de la referencia se sustituye por un panel de combate **simulado**, con datos fijos y etiquetados como prototipo (§18), sin score ni combo reales.
- El panel `OPPONENT` con tablero en vivo se sustituye por un monitor rival **estático** (§17), sin segundo motor, sin animación, sin actualización.
- El panel inferior `VS 1-0 / BEST OF 3` se elimina por completo: no hay marcador competitivo real ni concepto de sesión "best of 3" en el proyecto en este punto.
- Los rótulos decorativos superiores (`B — INDUSTRIAL DRAMATIC`, `UNIT B-07`, `SYS. 44A`, `PWR. 220V`) se sustituyen por rotulación propia mínima y coherente con el proyecto real (título `Rautfall`, descriptor `Build. Disrupt. Survive.`, y las etiquetas de estado/controles ya reales), no por texto decorativo inventado sin relación con el producto.

### 5.3 No se copia literalmente (excluido)

- `HOLD`: la mecánica de reserva no existe (§7); no se incluye ninguna ranura de hold, ni vacía ni simulada, para no sugerir una funcionalidad inexistente.
- Cualquier número de `SCORE`, `COMBO` o `ATTACK SLOTS` como si fuera un dato real conectado al motor.
- El marcador `VS 1 - 0` y `BEST OF 3`.
- Proporciones exactas de la maqueta cuando dificulten el layout real (el tablero propio en Rautfall es un canvas Phaser de proporción fija 1:2 exacta —320×640—, no una imagen recortable; la composición se adapta a esa proporción real, no al revés).
- Cualquier textura, veta o detalle que reduzca la legibilidad del tablero, de las próximas piezas o de los textos de estado.

## 6. Alcance incluido

- Layout Tactical de escritorio en tres zonas (tablero propio · columna táctica · monitor rival), con composición, anchuras, orden y alineaciones cerradas (§8).
- Reglas de adaptación a portátil y un suelo de ancho mínimo con aviso explícito, sin responsive agresivo (§9).
- Sistema de tokens visuales Industrial Dramatic (paleta, tipografía, bordes, radios, sombras, densidad de detalle) centralizado en una hoja de variables CSS nueva y pequeña (§10).
- Restilado completo de `App.vue`, `NextPiecesPreview.vue` y `GameCanvas.vue` (solo su marco exterior CSS) según esos tokens, sin cambiar su lógica.
- Dos componentes Vue nuevos, provisionales y simulados: `OpponentMonitor.vue` (monitor rival estático, §17) y `CombatStatusPanel.vue` (energía, cartucho y Residuos simulados, §18).
- Un módulo de datos de presentación simulados, puro y explícito (§19).
- Un aviso de ancho insuficiente, resuelto solo con CSS (§9.3).
- Migración de los selectores frágiles de `App.test.ts` a atributos `data-testid` estables (§21.4).
- Pruebas nuevas y ampliadas para paneles, integración de próximas piezas, overlays, controles, monitor rival simulado, panel de combate simulado y aviso de ancho insuficiente (§21).
- Validación manual explícita del resultado visual (§22).

## 7. Alcance explícitamente excluido

No pertenece a `0009`:

- Segundo motor, bot, batalla real, energía real, sabotajes reales, cartuchos reales, muerte súbita real.
- Hold / reserva de pieza, ghost piece, puntuación real, combos reales, T-Spins, back-to-back.
- Audio, animaciones avanzadas o partículas más allá de transiciones CSS simples ya existentes (hover de botones).
- Layout `Duel`, selector de layout, pantalla de Ajustes.
- Playwright, snapshots visuales por píxel, pruebas de regresión visual automatizadas.
- Backend, persistencia, autenticación, ranking, historial, Pinia, Vue Router.
- Sistema de diseño completo, librería de componentes, framework CSS nuevo.
- Recursos gráficos rasterizados (PNG/JPG) como base del layout; ningún asset binario nuevo.
- Refactor general de `GameScene.ts`, del adaptador temporal, del guardián de entrada o de cualquier lógica ya cerrada en `0004`–`0008`.
- Corrección del aviso de chunk grande de Phaser (deuda técnica aceptada desde `0004`, se mantiene).
- Controles táctiles, gamepad, remapeo de teclas, soporte mobile, PWA.
- Cualquier cambio de contrato en `packages/game-engine` o `packages/game-config`. Ninguno de los dos paquetes se modifica en esta tarea.
- Nuevas propiedades en `GamePresentationState` o en `PhaserGameController`: esta tarea no necesita ninguna (los datos simulados no dependen de Phaser ni del motor, ver §19).
- CI/CD.

## 8. Layout Tactical: composición de escritorio

### 8.1 Zonas y jerarquía

Tres zonas dispuestas horizontalmente, de izquierda a derecha, en este orden fijo:

1. **Tablero propio** (dominante): marco exterior alrededor de `<GameCanvas>` (§16). Ancho de columna fijo, ajustado al canvas real (320 px) más el marco industrial (§16): **360 px**.
2. **Columna táctica** (secundaria, informativa): de arriba abajo, `NextPiecesPreview` restilado (§15), panel de estado de sesión y controles (info existente: `status`/`step`/`elapsedMs`, botones Pausar/Reanudar y Reiniciar, ayuda de teclas — ya reales, solo reestilados), y `CombatStatusPanel` simulado (§18). Ancho flexible con mínimo **300 px** y máximo **380 px**.
3. **Monitor rival** (secundario, menor peso visual): `OpponentMonitor` (§17). Ancho fijo **220 px**, claramente más estrecho que el tablero propio, reforzando que es secundario.

Separación entre zonas: **24 px** de espacio (`gap`) constante. Alineación superior (`align-items: flex-start`) para que las tres columnas arranquen a la misma altura, igual que hace hoy `.game-layout`.

### 8.2 Orden de lectura pretendido

El usuario debe mirar primero el tablero propio (mayor tamaño, posición izquierda, mayor contraste), después la columna táctica (próximas piezas y estado, tamaño medio), y por último el monitor rival (menor tamaño, posición derecha, color más apagado salvo su etiqueta de "simulado"). Este orden se refuerza con tamaño, posición y saturación de color, no solo con la disposición (§12).

### 8.3 Cabecera y pie mínimos

Se conserva una cabecera mínima con el título `Rautfall` (restilado como logotipo tipográfico, §10.5) y, opcionalmente, el descriptor `Build. Disrupt. Survive.` en tipografía secundaria más pequeña, ambos ya coherentes con `docs/rautfall.md` («Logotipo»). No se añade navegación, menú ni acciones nuevas en la cabecera. El pie (`.footnote`) se conserva, actualizando su texto a `Prototipo técnico — 0009`.

### 8.4 Reutilización de contenedor existente

`.game-layout` (hoy un flex de dos hijos) se amplía a un flex/grid de tres columnas según §8.1; `.canvas-wrapper` conserva su rol como contenedor del tablero propio (zona 1); `.info-panel` se conserva como columna táctica (zona 2), ganando el nuevo `CombatStatusPanel` al final; se añade un tercer hijo hermano para el monitor rival (zona 3). No se introduce un contenedor de layout genérico ni un sistema de grid reutilizable para pantallas futuras: es el layout concreto de esta pantalla.

## 9. Layout Tactical: adaptación a portátil y aviso de ancho insuficiente

### 9.1 Umbrales cerrados

Se definen exactamente dos puntos de corte, basados en el ancho del viewport (`@media (max-width: ...)`), sin lógica de redimensionado por JavaScript:

| Rango de ancho de viewport | Nombre | Comportamiento |
| --- | ---: | --- |
| `≥ 1200px` | Tactical de escritorio | Tres columnas en fila, según §8.1. |
| `760px – 1199px` | Portátil compacto | Dos columnas: tablero propio a la izquierda (ancho fijo, sin deformarse); a la derecha, una única columna apilada que contiene primero la columna táctica completa y después el monitor rival, en ese orden. |
| `< 760px` | Suelo mínimo | Una sola columna apilada, en orden: aviso de ancho insuficiente (fijo, siempre visible) → tablero propio → columna táctica → monitor rival. No se aplica ninguna otra optimización de espacio más allá de esta pila. |

### 9.2 Por qué estos umbrales

- `1200px` es el primer punto en el que las tres columnas (360 + 300 + 220 px de contenido más dos separaciones de 24 px, ≈ 928 px de contenido) caben con margen cómodo dentro de un viewport de escritorio típico sin apretar los paneles a su ancho mínimo.
- `760px` es un suelo deliberadamente bajo: por debajo de ese ancho, un portátil o ventana ya no ofrece una experiencia táctica cómoda, pero el tablero propio (360 px de marco) sigue cabiendo sin recortarse ni deformarse en la mayoría de portátiles reales. No se persigue soportar anchos de tableta o móvil.
- No existe un tercer nivel de reflow adicional: por debajo de 760 px la solución es "avisar y apilar", no "seguir optimizando".

### 9.3 Aviso de ancho insuficiente

- Se añade un elemento siempre presente en el DOM, con `data-testid="width-warning"`, texto fijo (por ejemplo: «Rautfall Tactical está pensado para escritorio o portátil con más ancho de pantalla. La experiencia puede resultar incómoda por debajo de 760 px.») y `role="status"`.
- Visibilidad exclusivamente mediante CSS: oculto por defecto (`display: none`), mostrado únicamente dentro de `@media (max-width: 759px)` (`display: flex` o equivalente). No se usa `window.innerWidth`, `matchMedia` en JavaScript, ni ningún listener de `resize`: la detección de ancho es responsabilidad nativa de CSS, coherente con «sin responsive agresivo» y con la facilidad de prueba estructural (§21.1).
- El aviso no bloquea la interacción ni sustituye el layout por una pantalla vacía: el suelo mínimo (§9.1) sigue mostrando la partida apilada debajo del aviso.
- No se añade ninguna lógica de descartar/cerrar el aviso: es puramente informativo y reaparece si la ventana vuelve a estrecharse.

### 9.4 Lo que no se resuelve

- No hay layout específico para pantallas táctiles ni para anchos de tableta/móvil.
- No se reordenan las zonas de forma distinta a la pila vertical fija de §9.1.
- No se ofrece un control de usuario para elegir el layout o para descartar el aviso.

## 10. Dirección visual Industrial Dramatic: tokens y reglas técnicas

### 10.1 Ubicación de los tokens

Se crea `apps/web/src/styles/tactical-theme.css`, un único archivo con variables CSS (`:root { --rf-... }`) y sin clases ni selectores de componente. Se importa una sola vez desde `apps/web/src/main.ts`. Esto evita duplicar los mismos valores de color/sombra en `App.vue`, `NextPiecesPreview.vue`, `OpponentMonitor.vue` y `CombatStatusPanel.vue` (hoy los colores ya están duplicados de forma incipiente entre `App.vue` y `NextPiecesPreview.vue`, ver §4.1) y es la abstracción mínima justificada por una necesidad real de coherencia entre al menos cuatro archivos. No es un sistema de diseño: no define componentes, mixins, ni utilidades de layout.

### 10.2 Paleta aproximada

| Token | Valor aproximado | Uso |
| --- | --- | --- |
| `--rf-color-void` | `#0b0b0d` | Fondo de página, fuera de los paneles. |
| `--rf-color-graphite-900` | `#17181a` | Base de paneles hundidos (tablero, monitor rival). |
| `--rf-color-graphite-800` | `#1f2023` | Base de paneles principales (columna táctica). |
| `--rf-color-graphite-700` | `#28292c` | Tarjetas/subpaneles dentro de un panel principal. |
| `--rf-color-metal-600` | `#3a3b3f` | Bordes y bisel de paneles. |
| `--rf-color-metal-400` | `#55565b` | Realce superior de bisel (highlight sutil). |
| `--rf-color-cyan` | `#00d4ff` | Estado activo (`running`), energía, foco. Reutiliza el color ya usado para la pieza `I` en `NextPiecesPreview`. |
| `--rf-color-amber` | `#f39c12` | Avisos, pausa, acciones, cartucho. Reutiliza el color ya usado para la pieza `L`. |
| `--rf-color-red` | `#e74c3c` | Peligro, `gameOver`, Residuos. Reutiliza el color ya usado para la pieza `Z`. |
| `--rf-color-text-primary` | `#e8e8ec` | Texto principal. |
| `--rf-color-text-muted` | `rgba(232,232,236,0.6)` | Texto secundario, etiquetas. |

Reutilizar los tres acentos (cian/ámbar/rojo) ya presentes en `PIECE_DISPLAY_COLORS` no es casualidad: resuelve la ambigüedad de qué "cian/ámbar/rojo" exacto usar sin inventar una segunda paleta de acento desconectada de la que el jugador ya ve en las piezas y en la previsualización.

### 10.3 Tratamiento de fondos y materiales

- Fondo de página: `--rf-color-void`, sin degradado llamativo; puede llevar un degradado radial muy sutil (variación de brillo ±4%) para insinuar textura de metal, nunca un patrón de ruido/textura de imagen.
- Paneles: `--rf-color-graphite-800`/`900`, nunca un color plano soso ni un blanco/gris claro (eso sería "dashboard empresarial", antipatrón, §11).
- Ningún panel es completamente plano: todos llevan al menos un borde `--rf-color-metal-600` de 1–2 px y una sombra (§10.4).

### 10.4 Profundidad y sombras

- Bisel estándar de panel: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35);` (valores orientativos; la implementación puede ajustar magnitudes siempre que preserve el efecto: un realce superior tenue, una sombra interior inferior y una sombra exterior de contacto).
- El marco del tablero propio (§16) usa un bisel más pronunciado que los paneles de la columna táctica, para reforzar que es el elemento dominante.
- El monitor rival usa un bisel más plano/apagado (menor contraste de sombra) que el tablero propio, reforzando que es secundario (§12).

### 10.5 Bordes, radios y tipografía

- Radios pequeños y consistentes: `--rf-radius-sm: 3px` (botones, chips, celdas), `--rf-radius-md: 6px` (paneles). Nunca radios grandes tipo "pill" ni esquinas totalmente cuadradas en paneles principales.
- Tipografía: no se añade ninguna fuente externa ni dependencia nueva (ninguna hoja de Google Fonts, ningún paquete npm de tipografía). Se usa la pila de sistema ya disponible (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`, ya presente en `App.vue`), aplicando **mayúsculas, `letter-spacing` positivo (0.05–0.12em) y `font-weight: 700`** en cabeceras y etiquetas de estado para lograr una lectura "técnica/condensada" sin depender de una fuente condensada real. Los valores numéricos/técnicos (`step`, `elapsedMs`, energía, etc.) conservan la fuente monoespaciada ya usada hoy (`font-family: monospace` en `.value`).
- Escala tipográfica relativa aproximada: cabeceras de panel `0.75rem` con `letter-spacing` (ya es el tamaño actual de `.label`/`.controls-help h2`, se conserva); valores/datos `1.125rem` monoespaciado (ya es el tamaño actual de `.value`, se conserva); título `Rautfall` `1.5–1.75rem` en mayúsculas con tracking; texto de ayuda/controles `0.8125rem` (ya existente, se conserva).

### 10.6 Contraste y legibilidad

- Contraste mínimo AA aproximado entre `--rf-color-text-primary`/`--rf-color-text-muted` y los fondos de panel (`--rf-color-graphite-700/800/900`): no se reduce la legibilidad actual de `status`/`step`/`elapsedMs`/próximas piezas/ayuda de controles.
- Ningún texto se coloca directamente sobre el fondo de página (`--rf-color-void`) salvo el título y el pie, que ya usan colores claros suficientemente contrastados.

### 10.7 Densidad de detalle industrial y desgaste

- Como máximo, cada panel principal (tablero propio, columna táctica, monitor rival) puede llevar una marca decorativa discreta por esquina (por ejemplo, un pequeño punto o cruz que insinúe un tornillo, mediante `radial-gradient` o un `::before`/`::after` de pocos píxeles), nunca más de cuatro marcas por panel y nunca en subpaneles internos (tarjetas, botones, celdas de previsualización).
- No se añade textura de veta de metal mediante imágenes; si se desea alguna variación, se limita a un `background: linear-gradient(...)` sutil, sin imágenes rasterizadas.
- El desgaste se limita a la sombra/bisel (§10.4); no hay manchas, arañazos ni ruido.

### 10.8 Acentos cian/ámbar/rojo

- Cian: borde/resplandor sutil del marco del tablero propio mientras `status === 'running'`; barra de energía simulada.
- Ámbar: overlay de pausa (texto/borde), estado del botón Pausar/Reanudar, cartucho simulado.
- Rojo: banner de `gameOver`, indicador de Residuos simulado.
- Los acentos se reservan para estos usos puntuales; no se aplican como color de fondo general de ningún panel grande (evita el "neón generalizado", §11).

## 11. Antipatrones visuales explícitos

No se acepta ninguno de los siguientes:

- Resplandor (`bloom`) o halo permanente alrededor de paneles, textos o botones.
- Neón generalizado o marcos de borde luminoso en todos los elementos.
- Estética cyberpunk/discoteca (gradientes multicolor saturados, líneas de neón cruzadas).
- Aspecto de dashboard empresarial: paneles blancos/grises claros, tarjetas planas sin bisel, iconografía corporativa genérica.
- Paneles completamente planos sin sombra ni borde.
- Metal brillante tipo cromado (reflejos especulares intensos, degradados plateados brillantes).
- Texturas o ruido excesivo que reduzcan la legibilidad del tablero, las próximas piezas o cualquier texto de estado.
- Decoración industrial (tornillos, respiraderos, marcas técnicas) que compita visualmente con el tablero o se repita de forma excesiva (más de una marca discreta por esquina de panel principal, §10.7).
- Contrastes de texto pobres (texto oscuro sobre fondo oscuro, o acentos de color usados como color de texto de cuerpo).
- Tipografías juguetonas, redondeadas o infantiles.
- Iconografía caricaturesca o ilustrativa (no se añaden iconos nuevos en esta tarea salvo, como mucho, formas geométricas simples ya cubiertas por CSS; no se introduce una librería de iconos).
- Animaciones innecesarias: no se añaden transiciones más allá de las de hover/disabled ya existentes en los botones; el monitor rival y los paneles simulados son estáticos, sin parpadeo, pulso o movimiento periódico.

## 12. Jerarquía visual

- **Domina**: el tablero propio (Phaser). Mayor tamaño, mayor contraste de bisel, posición izquierda, acento cian activo mientras `running`.
- **Secundario, con peso propio**: la columna táctica (próximas piezas reales, estado de sesión real, controles reales, panel de combate simulado). Tamaño medio, bisel estándar.
- **Terciario, deliberadamente menor**: el monitor rival simulado. Menor ancho, bisel más apagado, etiqueta "SIMULADO" siempre visible.
- **Puramente decorativo**: marcas de esquina, veta sutil de fondo, tracking tipográfico. Nunca deben captar la atención antes que el tablero o los datos reales.
- El usuario debe poder distinguir en menos de dos segundos qué es real (tablero, próximas piezas, estado de sesión, controles) de qué es simulado (monitor rival, energía, cartucho, Residuos), gracias a la etiqueta explícita de simulación y al menor peso visual de esa zona (§17, §18).
- Ningún elemento decorativo o simulado puede tener mayor tamaño, saturación o brillo que el tablero propio.

## 13. Integración del estado real de sesión

- `status` (`SessionStatus`) sigue siendo la única fuente de verdad, expuesta exactamente igual que hoy en `GamePresentationState` (sin cambios de contrato).
- Se muestra en la misma tarjeta técnica ya existente (`.info-item` con `status`/`step`/`elapsedMs`), reestilada según §10, dentro de la columna táctica.
- El overlay de pausa (`.pause-overlay`) se conserva estructural y funcionalmente idéntico (mismo `v-if="gameState.status === 'paused'"`, mismo `pointer-events: none`, mismo `role="status"`/`aria-live="polite"`), cambiando únicamente su estilo visual: texto `PAUSA` en `--rf-color-amber` sobre fondo semitransparente grafito (en vez de blanco puro sobre azul-marino), coherente con "ámbar para avisos" (§10.8).
- El banner de `gameOver` (`.game-over-banner`) se conserva estructural y funcionalmente idéntico, cambiando su estilo a `--rf-color-red` sobre `--rf-color-graphite-900` con borde, en vez del rojo plano actual (`#8b0000`).
- No se introduce ningún overlay o indicador adicional para `running`: el marco del tablero propio con acento cian (§10.8, §16) ya comunica visualmente que la partida está activa, sin añadir un tercer overlay.
- El overlay de pausa nunca puede coexistir visualmente con el banner de `gameOver` (ya es así hoy por construcción de `computeSessionStatus`, §8 de `0008`): esta tarea no toca esa regla.

## 14. Overlays y controles reales

- Se mantienen en su ubicación actual (superpuestos al `.canvas-wrapper` para el overlay de pausa; dentro de `.info-panel`/columna táctica para el banner de `gameOver`, los botones y la ayuda de controles), solo reestilados. No se recolocan fuera de la columna táctica ni se trasladan al monitor rival.
- Los botones Pausar/Reanudar y Reiniciar conservan exactamente su lógica (`controller.togglePause()`, `controller.reset()`), su condición de `disabled` durante `gameOver` para el de pausa, y su disponibilidad en los tres estados para el de reinicio.
- Se añaden atributos `data-testid="pause-toggle"` y `data-testid="reset-button"` a ambos botones (§21.4), sin cambiar su texto, orden relativo ni comportamiento.
- La ayuda de controles (`.controls-help`) se conserva con el mismo contenido textual, reestilada según §10.5 (cabecera en mayúsculas con tracking, `<kbd>` con bisel metálico ligero en vez del azul actual).
- No se introduce ninguna lógica nueva de sesión, ningún atajo de teclado nuevo, ningún botón adicional.

## 15. Próximas piezas

- `NextPiecesPreview.vue` se mantiene como componente y se reestila únicamente en su `<style scoped>` (fondo, bordes, tipografía de cabecera y de orden/tipo según §10), sin tocar su `<script setup>`: la prop `nextPieces`, el uso de `getPieceShape`, el cálculo de `previews` y la plantilla (estructura de `<ol>`/`<li>`, `piece-grid`, `piece-cell`) no cambian.
- Se integra dentro de la columna táctica, como primer elemento visual de esa columna (antes del panel de estado/controles), reflejando su posición equivalente a `NEXT` en la referencia visual.
- No se convierte en un concepto de `hold`: sigue mostrando únicamente las tres próximas piezas reales, en el mismo orden.
- Ninguna prueba existente de `NextPiecesPreview.test.ts` debe romperse por el restilado (no cambia ninguna estructura de DOM verificable por esas pruebas, solo clases/estilos ya cubiertos o no cubiertos por ellas).

## 16. Tablero propio y Phaser: marco exterior

- El canvas de Phaser conserva su resolución lógica 320×640, su fondo transparente y su escalado `Phaser.Scale.FIT`/`CENTER_BOTH`: esta tarea no modifica `create-phaser-game.ts` ni `GameScene.ts`.
- `.canvas-wrapper` (o un nuevo contenedor CSS que lo envuelva sin alterar `GameCanvas.vue`) gana el marco industrial: bisel pronunciado (§10.4), borde `--rf-color-metal-600`, fondo `--rf-color-graphite-900` visible como "carcasa" alrededor del canvas transparente, y como mucho cuatro marcas decorativas de esquina (§10.7).
- El acento cian de "partida activa" (§10.8) se aplica como un borde o resplandor sutil y **no permanente en todos los estados**: visible mientras `status === 'running'`, atenuado o ausente durante `paused`/`gameOver` (para no contradecir esos estados con un acento que sugiere actividad).
- No se cambia el tamaño lógico del canvas ni se introduce un segundo canvas. El ancho de columna de 360 px (§8.1) es el marco (bisel + padding) alrededor de los 320 px reales del canvas, no una ampliación del área jugable.
- Elementos que deben seguir perteneciendo a Vue y no a Phaser: el marco/carcasa, el overlay de pausa, el banner de `gameOver`, el monitor rival, el panel de combate simulado, toda la señalética general. Phaser sigue sin dibujar ningún HUD ni ningún dato ajeno al tablero y la pieza activa.

## 17. Monitor rival simulado

### 17.1 Naturaleza

`OpponentMonitor.vue` (nuevo componente, `apps/web/src/components/OpponentMonitor.vue`):

- Sin props obligatorias relacionadas con el motor; recibe, como mucho, datos ya congelados del módulo de presentación simulada (§19).
- Sin `setInterval`, `setTimeout`, `requestAnimationFrame` ni ninguna suscripción a eventos del motor o de Phaser. Se renderiza una vez y no cambia mientras el componente permanece montado.
- Sin segundo motor, sin segunda instancia de Phaser, sin PRNG propio.

### 17.2 Contenido

- Cabecera con el texto `RIVAL` (o equivalente) y una etiqueta visual y textual `SIMULADO` (clase `.simulated-badge`, reutilizable también en `CombatStatusPanel`, con fondo `--rf-color-metal-600` y texto en mayúsculas), de modo que la naturaleza simulada no dependa únicamente del color.
- Un tablero estático: una rejilla de **10 columnas × 20 filas** (misma proporción que el tablero real, para reforzar el paralelismo visual), renderizada con `<div>`s CSS (mismo enfoque ya validado en `0007` §20 para `NextPiecesPreview`: sin SVG, sin Phaser, sin canvas adicional), con celda más pequeña que la real (por ejemplo, 8–10 px) para mantener el monitor rival visualmente más pequeño que el tablero propio.
- El contenido de la rejilla es una composición fija y predefinida (un patrón de celdas ocupadas codificado como literal en el módulo de datos simulados, §19), representando una pila de bloques a media altura, **sin ninguna pieza activa dibujada encima**: se decide deliberadamente no representar una pieza "en juego" para no sugerir una partida en curso (a diferencia de la referencia visual, que sí muestra una pieza activa).
- Un pie de texto estático breve (por ejemplo: «Vista de prototipo — sin lógica de combate») que refuerza textualmente la naturaleza simulada.
- Ningún número de energía, cartuchos o líneas del rival: eso pertenece al panel de combate (§18) o queda fuera de alcance si es específico del rival (por ejemplo, no se muestra un "número de cartuchos del rival", concepto real de `docs/rautfall.md` que no pertenece a esta tarea).

### 17.3 Restricciones

- No se usa `PieceType` ni `getPieceShape` de `@rautfall/game-engine`: el patrón estático es puramente visual y no debe sugerir que procede del motor. Los colores de celda pueden reutilizar los mismos valores hexadecimales que `PIECE_DISPLAY_COLORS` por coherencia visual, pero como constantes propias del módulo de presentación simulada (§19), no como una dependencia del paquete de dominio.
- No se implementa ninguna variante de "estado del rival" (por ejemplo, alternar entre distintos patrones): un único patrón fijo es suficiente y evita sugerir actividad.

## 18. Energía, cartucho y Residuos simulados

### 18.1 `CombatStatusPanel.vue`

Nuevo componente, `apps/web/src/components/CombatStatusPanel.vue`, integrado como último elemento de la columna táctica. Agrupa los tres indicadores en un único panel (no se crea un componente por indicador, para no atomizar innecesariamente, §11 de este documento y de `AGENTS.md`):

- **Energía simulada**: una barra segmentada (por ejemplo, 5–8 segmentos) con un valor fijo (por ejemplo, 3 de 7 segmentos activos en `--rf-color-cyan`, el resto apagados), y una etiqueta `ENERGÍA` con el badge `SIMULADO`.
- **Cartucho simulado**: una única ranura (no dos, para no sugerir el límite real de dos cartuchos de `docs/rautfall.md` como si ya estuviera implementado) con un rótulo corto fijo (por ejemplo, «Cartucho — prototipo») en `--rf-color-amber`, sin icono de sabotaje concreto (Sobrecarga/Interferencia/Residuos/Polaridad inversa), para no anticipar cuál de los cuatro sabotajes reales se implementará primero.
- **Indicador de Residuos**: un contador fijo (por ejemplo, «Residuos: 0») en `--rf-color-red`, con un icono simple de fila compactada resuelto mediante CSS (por ejemplo, un pequeño bloque de barras), sin animación.
- Cada uno de los tres bloques lleva su propio `data-testid` (`data-testid="simulated-energy"`, `data-testid="simulated-cartridge"`, `data-testid="simulated-residues"`) y su badge `SIMULADO`/`PROTOTIPO` visible.

### 18.2 Restricciones

- Ningún valor cambia nunca: no hay lógica que incremente la energía, inserte un cartucho o aumente Residuos. Son literales congelados (§19).
- No se crea ningún tipo de dominio (`Sabotage`, `Attack`, `Energy`, etc.) en ningún paquete.
- No se añade ningún evento, store ni composable reactivo para este panel: recibe sus datos como props simples derivadas del módulo de presentación simulada, o los importa directamente si no requieren ninguna variación (decisión de implementación menor, sin impacto de contrato).
- El panel no reacciona a `GamePresentationState` de ninguna forma: los datos simulados son completamente independientes del estado real de la partida propia.

## 19. Estado y tipado de los datos simulados

- Se crea `apps/web/src/presentation/simulated-tactical-data.ts`, un módulo puro (sin Vue, sin Phaser, sin motor) que exporta constantes `Object.freeze`d:
  - un patrón fijo de celdas ocupadas para el monitor rival (por ejemplo, `OPPONENT_STATIC_BOARD: ReadonlyArray<Readonly<{ x: number; y: number; color: string }>>`);
  - valores fijos para energía, cartucho y Residuos (por ejemplo, `SIMULATED_ENERGY_SEGMENTS = 7`, `SIMULATED_ENERGY_ACTIVE = 3`, `SIMULATED_CARTRIDGE_LABEL`, `SIMULATED_RESIDUES_COUNT = 0`);
  - los colores propios de celda del monitor rival (constantes locales, no importadas de `@rautfall/game-engine`, ver §17.3).
- Este módulo vive en `apps/web`, no en `packages/game-engine` ni en `packages/game-config`: es presentación de prototipo, no dominio.
- No se amplía `GamePresentationState` con ningún campo simulado: los datos simulados no proceden de Phaser ni del motor, por lo que no tienen motivo para pasar por ese canal (a diferencia de `nextPieces`, que sí es un dato real del motor).
- No se crea ningún store (Pinia u otro), ningún composable reactivo, ningún evento: los tipos son literales estáticos consumidos directamente por los componentes nuevos.

## 20. División de componentes: decisión

Tras inspeccionar el estado actual de `App.vue` (§4.1, hoy ~270 líneas entre plantilla y estilos, sin componentes de responsabilidad de combate ni de rival), se decide:

- **Se amplía `App.vue` de forma moderada** para el layout general de tres columnas (§8) y para los elementos ya reales que ya vivían allí (estado de sesión, controles, ayuda de teclas, overlay de pausa, banner de `gameOver`): estos elementos no ganan una responsabilidad nueva, solo se reestilan y se reubican dentro de la nueva composición, por lo que no justifican una extracción adicional (evita atomizar paneles sin necesidad, §11 de `AGENTS.md`).
- **Se extraen dos componentes nuevos** porque introducen una frontera de responsabilidad real y nueva que no existía: `OpponentMonitor.vue` (monitor rival simulado, §17) y `CombatStatusPanel.vue` (energía/cartucho/Residuos simulados, §18). Ambos son unidades de presentación autocontenidas, con datos propios (§19), sin relación con el ciclo de vida de Phaser ni con `GamePresentationState`, y con pruebas propias más simples de aislar (§21.2) que si vivieran inline en `App.vue`.
- **No se extrae** un componente para el marco/carcasa del tablero propio (§16): es CSS aplicado sobre el `.canvas-wrapper` ya existente, sin lógica ni datos propios; extraerlo sería un componente artificial por un bloque puramente decorativo.
- **No se extrae** un componente para el aviso de ancho insuficiente (§9.3): es un único elemento estático con CSS de visibilidad condicional, sin lógica; vive directamente en `App.vue`.
- **`NextPiecesPreview.vue` y `GameCanvas.vue` no se dividen further**: conservan su responsabilidad actual, solo reestilada.

## 21. Estrategia de pruebas

Pruebas proporcionadas al riesgo: sin Playwright, sin snapshots visuales, sin verificar píxeles, colores exactos ni valores de sombra/gradiente. Se prueba **estructura, presencia, props e integración**, no apariencia.

### 21.1 `OpponentMonitor.vue` — `apps/web/src/components/OpponentMonitor.test.ts` (nuevo)

- Renderiza la etiqueta textual `SIMULADO` (o equivalente) de forma visible en el DOM.
- Renderiza el tablero estático con el número de celdas ocupadas esperado según `OPPONENT_STATIC_BOARD`.
- No contiene ninguna pieza activa distinguible (no se renderiza ningún elemento adicional más allá del patrón estático).
- El contenido no cambia tras avanzar temporizadores simulados (`vi.useFakeTimers()`, `vi.advanceTimersByTime(...)`): se captura el HTML tras montar, se avanza el tiempo, y se comprueba que el HTML permanece idéntico, como evidencia de que no hay temporizadores ni animaciones activas.

### 21.2 `CombatStatusPanel.vue` — `apps/web/src/components/CombatStatusPanel.test.ts` (nuevo)

- Renderiza los tres bloques (`data-testid="simulated-energy"`, `"simulated-cartridge"`, `"simulated-residues"`).
- Cada bloque muestra su badge `SIMULADO`/`PROTOTIPO`.
- Los valores mostrados coinciden con las constantes de `simulated-tactical-data.ts` (evita hardcodear el valor dos veces: el test importa las mismas constantes que el componente).
- El contenido no cambia tras remontar el componente dos veces (no hay estado interno mutable, aleatoriedad ni dependencia de tiempo).

### 21.3 `simulated-tactical-data.ts` — `apps/web/src/presentation/simulated-tactical-data.test.ts` (nuevo, mínimo)

- Los objetos exportados están congelados (`Object.isFrozen`).
- El patrón del tablero rival tiene coordenadas dentro de los límites declarados (10×20) y no contiene duplicados.

### 21.4 `App.vue` — ampliación de `apps/web/src/App.test.ts`

- Sustituir los selectores `button:first-child`/`button:last-child` por `[data-testid="pause-toggle"]`/`[data-testid="reset-button"]` en todas las pruebas existentes que los usan hoy (§4.1), preservando exactamente las mismas aserciones de comportamiento (texto, `disabled`, invocación del controlador).
- Nueva prueba: existen las tres zonas del layout Tactical (por ejemplo, mediante `data-testid="own-board-column"`, `"tactical-column"`, `"opponent-column"`, o selectores de clase equivalentes ya usados por el layout).
- Nueva prueba: `OpponentMonitor` está presente dentro de la columna de monitor rival.
- Nueva prueba: `CombatStatusPanel` está presente dentro de la columna táctica, después de `NextPiecesPreview` y de los controles.
- Nueva prueba: el elemento `[data-testid="width-warning"]` existe en el DOM (su visibilidad real depende de CSS y no se prueba aquí, ver §22).
- Las pruebas ya existentes sobre `NextPiecesPreview` (props, integración), overlay de pausa y banner de `gameOver` (§0008) se conservan sin romperse; se ajustan únicamente los selectores frágiles ya mencionados.

### 21.5 `NextPiecesPreview.test.ts` y `GameCanvas.test.ts`

- No requieren cambios funcionales: el restilado no altera su DOM verificable. Se revisan tras la implementación para confirmar que siguen en verde sin modificación (si alguna aserción dependiera accidentalmente de un valor de estilo hoy, se ajusta al cambio mínimo necesario).

### 21.6 Qué se prueba solo manualmente

- Legibilidad y jerarquía visual real (§12).
- Aspecto de la paleta, sombras, biseles y tracking tipográfico (§10).
- Comportamiento real de los tres puntos de corte de ancho (§9) y de la visibilidad CSS del aviso (§9.3).
- Percepción de que el rival y los indicadores de combate son claramente simulados y no reales (§17, §18).
- Ausencia de errores de consola.

## 22. Validación manual requerida

A ejecutar con `pnpm dev`, documentando el resultado punto por punto en el informe final:

- El tablero propio sigue siendo el elemento visualmente dominante de la pantalla.
- La identidad Industrial Dramatic se percibe (grafito, metal, biseles, acentos cian/ámbar/rojo) sin perder legibilidad de ningún texto o dato.
- Las tres próximas piezas siguen viéndose con claridad dentro de la columna táctica.
- Pausar, reanudar y reiniciar siguen funcionando exactamente igual que en `0008`, con el overlay y el banner reestilados pero coherentes con el estado real.
- El monitor rival no se confunde en ningún momento con una partida real: no hay pieza activa, no hay cambios, la etiqueta "SIMULADO" es visible.
- Energía, cartucho y Residuos se leen claramente como elementos de prototipo, no como datos de una partida en curso.
- El layout de escritorio (`≥1200px`) muestra las tres columnas en fila, en el orden y con las proporciones descritas en §8.
- El layout de portátil compacto (`760–1199px`) apila columna táctica y monitor rival a la derecha del tablero, sin deformar el tablero.
- Por debajo de `760px`, aparece el aviso de ancho insuficiente y el layout se apila en una sola columna sin recortes ni solapamientos.
- No aparecen errores ni warnings nuevos en la consola del navegador (el aviso de chunk de Phaser en build sigue siendo el único warning aceptado, y no es un error de consola en tiempo de ejecución).

## 23. Comandos de validación final

Antes de declarar la tarea completada, ejecutar desde la raíz:

```text
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Todos deben finalizar correctamente. El aviso de chunk grande de Phaser (>500 kB) permanece aceptado como deuda técnica y no bloquea el build. Además, revisar:

- `git diff --check` sin errores de espacio en blanco.
- No existen imports profundos entre paquetes.
- `packages/game-engine` y `packages/game-config` no tienen ninguna modificación.
- No hay código muerto: ninguna clase CSS, componente o constante sin uso tras el restilado.
- No se ha ampliado el alcance más allá de lo descrito en §6/§7.
- No hay errores ni avisos de lint ignorados.

## 24. Actualizaciones de documentación

Este documento ([docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md](0009-marco-tactical-identidad-visual-industrial-dramatic.md)) es la especificación de la tarea y permanece inmutable durante y después de la implementación.

Al finalizar la implementación, se debe crear [docs/implementation/0009-marco-tactical-identidad-visual-industrial-dramatic.md](../implementation/0009-marco-tactical-identidad-visual-industrial-dramatic.md) como informe de implementación independiente, con:

- resumen;
- archivos creados y modificados;
- componentes extraídos y componentes deliberadamente no extraídos, con su motivo;
- decisiones finales de layout (anchuras, puntos de corte reales usados);
- decisiones finales de paleta y estilo (valores exactos de los tokens CSS);
- inventario de paneles reales frente a simulados;
- cómo se integró el marco exterior del tablero propio con Phaser;
- pruebas añadidas y modificadas, con el detalle de la migración de selectores de `App.test.ts`;
- número final de tests;
- comandos ejecutados y resultados;
- desviaciones respecto de esta especificación, si las hubo;
- deuda técnica identificada (incluida, si aplica, cualquier ajuste pendiente de los umbrales de ancho tras la validación manual);
- validación manual (§22) documentada punto por punto;
- confirmación explícita de que no se implementó ningún elemento del alcance excluido (§7);
- confirmación explícita de que `packages/game-engine` y `packages/game-config` no se modificaron;
- actualización de [docs/project-status.md](../project-status.md) (estado, fecha, resultado resumido, referencia al informe);
- confirmación de que no se hicieron commits durante la implementación.

## 25. Próxima tarea prevista

No se fija una `0010` definitiva. La siguiente tarea se decidirá después de:

- validar visualmente en el navegador el marco Tactical resultante de `0009`;
- revisar si la identidad Industrial Dramatic y la jerarquía visual funcionan como se pretendía sin comprometer la jugabilidad;
- decidir, a la vista de `docs/rautfall.md` y del estado real, entre candidatas razonables como hold, ghost piece, puntuación/combos, o el primer sabotaje real (Residuos) sustituyendo su versión simulada.
