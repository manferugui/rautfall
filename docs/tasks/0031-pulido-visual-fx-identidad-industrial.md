# Tarea 0031 — Pulido visual, FX e identidad industrial del MVP

## Objetivo

Llevar el MVP de Rautfall a un acabado visual coherente con su identidad Industrial Dramatic, reforzando:
- metal;
- óxido;
- remaches;
- placas;
- rejillas;
- señalética;
- desgaste;
- luces de alerta;
- profundidad de paneles;
- FX contextuales;
- branding de marca (wordmark textual RAUTFALL, descriptor, favicon propio);
- coherencia entre todas las pantallas.

No añadir nuevas mecánicas.
No modificar `game-engine` ni `battle-engine`.
No rediseñar la arquitectura.
No convertir la tarea en una colección de efectos arbitrarios.

---

## 1. Auditoría visual previa obligatoria

### Componentes visuales auditados
1. **ModeSelector.vue (Menú Principal)**: estructura de tarjetas plana, sin superficie metálica ni identidad de marca en la cabecera.
2. **SettingsScreen.vue (Configuración)**: tabla de remapeo funcional con estilos aislados y colores fuera de los tokens `--rf-*`.
3. **HistoryScreen.vue (Historial)**: registros de partidas en tabla con apariencia estándar web.
4. **RankingScreen.vue (Ranking)**: pestañas de modo con badges de ranking simples.
5. **ResultsModal.vue (Resultados)**: modal de métricas finales sin impacto visual de victoria/derrota.
6. **HUD & Consola Táctica** (`ScorePanel.vue`, `NextPiecesPreview.vue`, `HeldPiecePreview.vue`, `CombatStatusPanel.vue`): layout en columna táctica ya unificado, pendiente de consolidar tokens y biseles.
7. **OpponentMonitor.vue (Monitor Rival)**: celdas del rival 10×20 con overlays básicos de pausa, standby e interferencia.
8. **Overlays de sabotajes & Warnings**: basados en badges o banners directos, sin señalización de advertencia industrial.
9. **Sudden Death**: evento de dominio con cambio de música, sin presencia atmosférica en la UI.
10. **GameScene.ts & Renderizado Phaser (Residuos)**: celdas dibujadas como rectángulos simples, basura en gris plano.
11. **Herramientas DEV** (`DevDemoLauncher.vue`, `SfxLab.vue`): funcionan correctamente detrás de `import.meta.env.DEV`.

---

## 2. Branding e Identidad de Marca completa

### Dirección de Marca (Industrial Dramatic)
La marca de Rautfall transmite:
- maquinaria pesada;
- estructura modular y bloques estructurales;
- caída e impacto táctico;
- competición táctica;
- acero, biselado y desgaste sobrio.

A evitar estrictamente:
- engranajes genéricos;
- logos de esports genéricos;
- calaveras u elementos orgánicos;
- estética militar realista o bélica;
- cyberpunk neon con magenta/rosa reluciente;
- exceso de detalle que impida escalabilidad;
- copiar marcas o referentes existentes.

### Piezas de Branding — decisión final
1. **Wordmark principal**: texto real `RAUTFALL`, `Oswald 700`, acabado
   grafito/acero mate mediante CSS (`background-clip: text` + degradado de
   tono estrecho, bisel muy contenido vía `text-shadow`).
2. **Descriptor**: "BUILD · DISRUPT · SURVIVE" bajo el wordmark, en el menú
   principal únicamente.
3. **Favicon (`favicon.svg`)**: monograma "R" geométrico propio, grafito
   oscuro + acero claro mate, un único chaflán mecanizado discreto, legible
   a 16×16/32×32/64×64. Integrado en `index.html` con
   `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`.
4. No existen `isotype.svg`, `logo-full.svg` ni `logo-monochrome.svg`, ni
   isotipo independiente, en el resultado final: se exploraron durante la
   tarea y se descartaron a favor del texto real.

### Integración de Branding en la Aplicación
- **ModeSelector (Menú Principal)**: `<h1>RAUTFALL</h1>` en `Oswald 700` como
  wordmark, con el descriptor debajo, dentro de la placa atornillada ya
  existente (`.rf-console-module`/`.rf-console-face`).
- **Cabecera Battle (`App.vue`)**: mismo texto `RAUTFALL`/`Oswald 700`, a
  tamaño claramente menor, dentro de `.header-badge-title` como placa de
  identificación de chasis — sin descriptor.
- **Pantallas Secundarias (`SettingsScreen.vue`, `HistoryScreen.vue`,
  `RankingScreen.vue`, `ResultsModal.vue`)**: identidad visual por tokens
  `--rf-*` y chrome industrial compartido (paneles, remaches, bordes),
  coherente con el resto de la aplicación.
- **HTML Meta (`index.html`)**: favicon SVG propio, carga global de
  `Oswald 700` (Google Fonts — `preconnect` + un único `<link>` al peso 700)
  y meta description.

---

## 3. Principios visuales: Industrial Dramatic

- **Sensaciones a transmitir**: Maquinaria pesada, acero, desgaste, tensión, interfaz táctica, ingeniería de campo, competición.
- **A evitar**: Cyberpunk genérico con luces de neón magenta/rosa, UI sci-fi limpia o hiper-futurista, exceso de glow, steampunk, horror o texturas sucias que dificulten la lectura.
- **Legibilidad y accesibilidad**: Mantener contraste elevado, tipografía limpia, navegación por teclado visible (`:focus-visible`) y soporte estricto de `prefers-reduced-motion`.

---

## 4. Propuesta de Sistema Visual Base (`tactical-theme.css`)

Consolidación de tokens globales bajo el prefijo `--rf-*`:
- **Gama de Metales y Óxido**:
  - `--rf-color-void`: `#0b0b0d`
  - `--rf-color-graphite-900`: `#141517`
  - `--rf-color-graphite-800`: `#1c1d20`
  - `--rf-color-graphite-700`: `#25262a`
  - `--rf-color-metal-600`: `#3a3c42`
  - `--rf-color-metal-400`: `#5a5c64`
  - `--rf-color-metal-highlight`: `rgba(255, 255, 255, 0.12)`
  - `--rf-color-rust-700`: `#5c2a18`
  - `--rf-color-rust-500`: `#8b3a1b`
- **Acentos Tácticos Semánticos**:
  - `--rf-color-cyan`: `#00d4ff` (P1 / Victoria / Selección)
  - `--rf-color-amber`: `#f39c12` (Advertencia / Pausa / Sobrecarga)
  - `--rf-color-red`: `#e74c3c` (Peligro / Game Over / Derrota / Residuos)
  - `--rf-color-purple`: `#a060d0` (Polaridad Inversa)
  - `--rf-color-success`: `#2ecc71`
- **Sombras y Biseles Industriales**:
  - `--rf-shadow-panel`: Bisel de panel principal elevado con muesca metálica.
  - `--rf-shadow-board-frame`: Bisel profundo reforzado para el tablero de juego.
  - `--rf-shadow-recessed`: Hueco hundido para pantallas y preview slots.
  - `--rf-focus-ring`: Anillo de enfoque táctico (`0 0 0 2px #00d4ff`).
- **Clases Utilitarias Industriales Reutilizables**:
  - `.rf-panel`: Superficie metálica con bisel y gradiente sutil.
  - `.rf-plate-header`: Placa de cabecera en relieve con corte angular muescado.
  - `.rf-riveted-panel`: Panel decorado con remaches de muesca metálica.
  - `.rf-vent-grille`: Rejilla de ventilación industrial.
  - `.rf-hazard-strip`: Franja de aviso con franjas diagonales semánticas.
  - `.rf-btn-tactical`: Botón mecánico unificado con sensación de presión.
  - `.rf-keycap`: Tecla física o badge de control con relieve de tecla metálica.

---

## 5. Tratamiento Específico por Elemento

### Metal y Profundidad
- Gradientes sutiles de top a bottom (`linear-gradient(180deg, var(--rf-color-graphite-800), var(--rf-color-graphite-900))`).
- Edge highlights de 1px en bordes superiores (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1)`).
- Sombras internas en contenedores hundidos (`inset 0 2px 8px rgba(0,0,0,0.8)`).

### Óxido, Desgaste y Remaches
- Toques controlados de desgaste en esquinas de bordes y franjas de advertencia con gradientes radiales de óxido.
- Remaches metálicos en esquinas de contenedores principales y placas mediante pseudo-elementos (`.panel-riveted`).

### Rejillas y Bandas de Advertencia
- Rejillas de ventilación discretas (`repeating-linear-gradient`) en separadores y cabeceras secundarias.
- Hazard stripes en Sudden Death, Warnings de sabotaje y zonas de alerta.

### Botones y Controles
- Botones unificados con profundidad mecánica, borde metálico, realce superior y estado pulsado con traslación `translateY(1px)`.
- Foco visible claro (`:focus-visible`) mediante `--rf-focus-ring`.

---

## 6. FX Contextuales Tácticos y Reduced Motion Estricto

1. **Interferencia (OpponentMonitor)**:
   - Normal: Jitter sutil horizontal (`@keyframes rf-jitter`), scanlines tácticas (`repeating-linear-gradient`), noise fósforo y aviso "SEÑAL INTERFERIDA".
   - Reduced Motion: Jitter y animación cancelados. Marco y aviso estático claro con alto contraste.
2. **Sobrecarga (Consola Táctica)**:
   - Normal: Parpadeo de borde ambarino de advertencia (`@keyframes rf-pulse-amber`) en indicadores.
   - Reduced Motion: Parpadeo cancelado. Borde e indicador ámbar fijo de alta visibilidad.
3. **Polaridad Inversa**:
   - Normal: Badge táctico magnético púrpura/violeta con pulso discreto.
   - Reduced Motion: Sin pulso. Badge e icono estáticos `⇄`.
4. **Residuos (Garbage Blocks en Phaser)**:
   - Representación exclusivamente visual: Bloque corroído/contaminado con contorno muescado gris oscuro u óxido y núcleo metálico gastado. Dominio y física 100% intactos.
5. **Sudden Death**:
   - Normal: Alerta visual de emergencia industrial en la carcasa con borde hazard pulsante en rojo/ámbar.
   - Reduced Motion: Sin pulso. Borde hazard estático rojo/ámbar visible.
6. **Victoria y Derrota (ResultsModal)**:
   - Normal: Victoria con brillo metálico cian/dorado; Derrota con señal mermada.
   - Reduced Motion: Transiciones y destellos atenuados o estáticos.

---

## 7. Componentes a Modificar

1. `apps/web/public/favicon.svg` [NUEVO] — Favicon oficial, monograma "R" propio.
2. `apps/web/index.html` — Integrar favicon.svg, meta description, title oficial y carga de `Oswald 700`.
3. `apps/web/src/styles/tactical-theme.css` — Ampliación de tokens, branding helpers y utilidades universales.
4. `apps/web/src/App.vue` — Carcasa general, layout, header con branding e indicador de Sudden Death.
5. `apps/web/src/components/ModeSelector.vue` — Integración del wordmark textual RAUTFALL, tarjetas metálicas, botones unificados.
6. `apps/web/src/components/SettingsScreen.vue` — Consolidación de tokens, eliminación de neón sci-fi, keycaps metálicos.
7. `apps/web/src/components/HistoryScreen.vue` — Estilo de log de operaciones industrial y tabla compacta.
8. `apps/web/src/components/RankingScreen.vue` — Clasificación táctica con badges metálicos de podio.
9. `apps/web/src/components/ResultsModal.vue` — Impacto visual de victoria/derrota y desglose de métricas con marca.
10. `apps/web/src/components/ScorePanel.vue` — Tokens CSS y tipografía técnica.
11. `apps/web/src/components/NextPiecesPreview.vue` — Bisel metálico inset para cada slot.
12. `apps/web/src/components/HeldPiecePreview.vue` — Bisel metálico inset para la reserva.
13. `apps/web/src/components/CombatStatusPanel.vue` — Barra de 20 segmentos con acabado táctico y parpadeo de alertas.
14. `apps/web/src/components/OpponentMonitor.vue` — Monitor industrial con scanlines, ventilación y velo de interferencia con jitter.
15. `apps/web/src/game/scenes/GameScene.ts` — Renderizado exclusivo visual de celdas de basura/residuos con estética corroída.

---

## 8. Plan de Verificación

### Pruebas Automatizadas
- `pnpm test` (suite completa Vitest).
- `pnpm lint` (ESLint limpio sin errores ni warnings).
- `pnpm typecheck` (TypeScript estricto).
- `pnpm build` (compilación de producción exitosa).
- `pnpm test:e2e` (suite completa de Playwright).
- `git diff --check` (sin espacios al final ni conflictos).

### Verificación Manual Visual (Smoke Visual)
- **Branding**: Comprobar wordmark RAUTFALL en el menú principal, descriptor del menú, placa RAUTFALL en la cabecera de Battle, favicon (monograma "R") en la pestaña del navegador, y coherencia visual del branding en las pantallas secundarias.
- **Navegación completa**: Menú principal, Configuración, Historial, Ranking, Modo Entrenamiento, Modo Batalla, Modal de Resultados.
- **Prueba de FX & Reduced Motion**:
  - Interferencia (comprobar jitter y comportamiento con `prefers-reduced-motion`).
  - Sobrecarga (comprobar parpadeo ámbar y su fijación en reduced motion).
  - Polaridad Inversa (comprobar badge púrpura táctico).
  - Residuos (comprobar celdas corroídas visuales en el tablero).
  - Sudden Death (comprobar atmósfera de alarma industrial).
  - Victoria/Derrota (comprobar resplandor / señal mermada en ResultsModal).
- **Responsive**: Verificar resoluciones 1920x1080, 1366x768, 1280x720 y 1024x768.
