# Tarea 0031 — Informe de implementación

## 1. Veredicto
**Implementación visual completada y validada sobre el working tree definitivo.** Todos los componentes visuales de Rautfall han sido rediseñados y compuestos bajo la estética **Industrial Dramatic** (máquina industrial construida). Se ha completado la separación estricta entre la UI de juego limpia (sin datos ni etiquetas DEV) y la telemetría técnica (reubicada bajo el escenario `?debug-panel=1`), el branding final como wordmark textual `RAUTFALL` (`Oswald 700`, acabado grafito/acero mate mediante CSS) con favicon propio, la consolidación de tokens CSS globales en `tactical-theme.css`, el protagonismo visual dominante del tablero principal y los FX contextuales enriquecidos con soporte estricto para `@media (prefers-reduced-motion: reduce)`. Las mecánicas de juego, motores de dominio y APIs permanecen 100% intactos. Validación final ejecutada sobre el working tree definitivo: `pnpm test` (832/832), `pnpm lint`, `pnpm typecheck`, `pnpm build` (con warning no bloqueante de tamaño de chunk) y `pnpm test:e2e` (11/11) en verde; `git diff --check` limpio.

---

## 2. Auditoría visual e iteración de composición
Se realizó una auditoría previa y una corrección de composición para transformar la interfaz desde un "dashboard oscuro con bordes finos" a una verdadera "consola de máquina industrial pesada construida":
- Separación de la telemetría DEV: en partidas normales o demos de UX (`?battle-demo=1`) la UI muestra únicamente la instrumentación jugable (Score, Level, Combo, Hold, Next, Energía, Cartucho, Residuos, Efectos activos, Rival). Toda la telemetría técnica interna (`session-step`, `battle-status`, `bot-phase`, `timers`, `coords`) se reubicó exclusivamente bajo `?debug-panel=1`.
- El tablero principal ocupa la máxima jerarquía visual con chasis reforzado, muescas metálicas y bisel extruido.

---

## 3. Capturas de validación visual

Las capturas de validación (Batalla Normal, Entrenamiento, Battle Debug con Telemetría, Menú Principal, Configuración, Historial, Ranking) se generaron en una sesión previa mediante enlaces locales (`file:///home/...`) no accesibles fuera de esa máquina/sesión. Se han retirado de este informe por no ser rutas versionables ni resolubles en el repositorio. No se han sustituido por capturas nuevas.

---

## 4. Sistema visual y Chasis Pesado
Se ampliaron y estructuraron los tokens universales bajo el prefijo `--rf-*` en `apps/web/src/styles/tactical-theme.css`:
- Metales y grafito: `--rf-color-void`, `--rf-color-graphite-900`, `--rf-color-graphite-800`, `--rf-color-graphite-700`, `--rf-color-metal-600`, `--rf-color-metal-400`.
- Desgaste de óxido: `--rf-color-rust-700`, `--rf-color-rust-500`.
- Acentos semánticos: `--rf-color-cyan`, `--rf-color-amber`, `--rf-color-red`, `--rf-color-purple`, `--rf-color-success`.
- Biseles: `--rf-shadow-panel`, `--rf-shadow-board-frame`, `--rf-shadow-opponent`, `--rf-shadow-recessed`, `--rf-shadow-btn`, `--rf-shadow-keycap`.
- Anillo de foco: `--rf-focus-ring`.

---

## 5. Metal, Remaches, Placas y Rejillas
- **Remaches**: Clase utilitaria `.rf-riveted-panel` y `.panel-riveted` con muesca metálica de remache en esquinas mediante pseudo-elementos (`::before` y `::after`).
- **Placas**: Cabeceras con corte angular muescado (`.title-tag`, `.header-tag`) y borde de acento en relieve.
- **Rejillas**: Utilitario `.rf-vent-grille` con patrón discreto de ventilación industrial.

---

## 6. Tipografía y Jerarquía
- Jerarquías claras de títulos, subtítulos, etiquetas tácticas y números rectangulares/técnicos (`font-variant-numeric: tabular-nums`).

---

## 7. Botones y Controles
- Unificados bajo `.rf-btn-tactical` con variante primaria (`.rf-btn-primary`) y destructiva (`.rf-btn-destructive`). Sensación de presión mecánica real (`translateY(1px)` y bisel hundido en `:active`). Keycaps metálicos (`.rf-keycap`).

---

## 8. Menú Principal
- `ModeSelector.vue`: Wordmark `RAUTFALL` como texto real (`Oswald 700`, acabado grafito/acero mate mediante CSS), descriptor "BUILD · DISRUPT · SURVIVE", botones de modo con profundidad metálica y tarjeta de controles con `.rf-keycap`.

---

## 9. Configuración
- `SettingsScreen.vue`: Eliminación total de estilos aislados y colores magenta desalineados. Tokens `--rf-*`, keycaps metálicos.

---

## 10. Historial
- `HistoryScreen.vue`: Log de operaciones industrial con tabla compacta, muescas de separador metálico, badges de resultado.

---

## 11. Ranking
- `RankingScreen.vue`: Tabla competitiva táctica con pestañas estilo botón industrial y podio resaltado (#1 oro viejo, #2 plata oscura, #3 bronce industrial).

---

## 12. HUD e Instrumentación
- `ScorePanel.vue`: Consolidación de tokens y cifras rectangulares.
- `NextPiecesPreview.vue` & `HeldPiecePreview.vue`: Slots de pieza con bisel de hueco hundido inset.
- `CombatStatusPanel.vue`: Barra de energía de 20 segmentos, cartucho metálico e indicadores tácticos.

---

## 13. Opponent Monitor e Interferencia
- `OpponentMonitor.vue`: Marco reforzado con ranuras de ventilación, bisel hundido, estado standby claro en entrenamiento, velo de pausa y velo de **Interferencia** enriquecido con scanlines dinámicas (`repeating-linear-gradient`), jitter sutil horizontal (`@keyframes rf-jitter`) y mensaje "SEÑAL INTERFERIDA".

---

## 14. Sobrecarga, Polaridad y Residuos
- **Sobrecarga**: Borde de advertencia ambarino pulsante (`@keyframes rf-pulse-amber`).
- **Polaridad Inversa**: Badge táctico de tono magnético púrpura/violeta (`--rf-color-purple`) con icono `⇄`.
- **Residuos**: Renderizado exclusivamente visual en `GameScene.ts` para celdas de basura (`garbage`) como bloque de acero corroído con muesca interna y bordes de óxido. Física y lógica intactas.

---

## 15. Sudden Death y Resultados
- **Sudden Death**: Alerta atmosférica de emergencia industrial en la carcasa general (`.tactical-chassis--sudden-death`) con borde de peligro pulsante (`@keyframes rf-emergency-alert`).
- **ResultsModal.vue**: Resplandor cian/dorado en Victoria, oscuridad sobria en Derrota, métricas finales en módulos biselados inset.

---

## 16. Reduced Motion
- Regla estricta `@media (prefers-reduced-motion: reduce)` en `tactical-theme.css` y `OpponentMonitor.vue`. Desactiva animaciones de jitter, parpadeo de bordes y destellos.

---

## 17. Responsive y Accesibilidad
- Verificado y adaptado para resoluciones de 1920x1080, 1366x768, 1280x720 y 1024x768. Anillo de enfoque táctico visible `--rf-focus-ring`.

---

## 18. Assets Vectoriales
- Única pieza vectorial de marca del resultado final: `favicon.svg` (monograma "R" geométrico propio, grafito oscuro + acero claro mate, un único chaflán mecanizado discreto, legible a 16×16/32×32/64×64).
- El branding principal es texto real: wordmark `RAUTFALL` en `Oswald 700`, con la misma solución replicada a menor escala en la placa de identificación de Battle (`App.vue`).
- `index.html` actualizado con favicon SVG, carga de `Oswald 700` (Google Fonts), metadatos y title oficial.

---

## 19. Pruebas y Validaciones

Validación final ejecutada sobre el working tree definitivo (post pulido visual y correcciones de tests/lint/E2E):

| Comprobación | Resultado |
|---|---|
| `pnpm test` | ✅ 832/832 tests (50/50 archivos) |
| `pnpm lint` | ✅ 0 errores, 0 warnings |
| `pnpm typecheck` | ✅ limpio (7 workspaces) |
| `pnpm build` | ✅ build de producción correcto (warning no bloqueante: chunk `index-*.js` > 500 kB tras minificar; candidato a code-splitting en una tarea futura, no bloquea esta) |
| `pnpm test:e2e` | ✅ 11/11 (Playwright/Chromium) |
| `git diff --check` | ✅ limpio (sin espacios en blanco al final ni marcadores de conflicto) |

---

## 20. Archivos Creados y Modificados

_Auditado contra `git status` real del working tree — no incluye archivos especulativos._

### Creados
- `apps/web/public/favicon.svg`
- `apps/web/public/assets/icons/cartridge-charge.svg`
- `apps/web/public/assets/icons/effect-pulse.svg`
- `apps/web/public/assets/icons/residue-inbound.svg`
- `apps/web/public/assets/icons/ui/audio.svg`
- `apps/web/public/assets/icons/ui/history.svg`
- `apps/web/public/assets/icons/ui/ranking.svg`
- `apps/web/public/assets/icons/ui/settings.svg`
- `apps/web/public/assets/industrial-kit/control-button-bezel.svg`
- `apps/web/public/assets/industrial-kit/corner-reinforcement.svg`
- `apps/web/public/assets/industrial-kit/dark-metal-tile.svg`
- `apps/web/public/assets/industrial-kit/dark-steel-corten.webp`
- `apps/web/public/assets/industrial-kit/module-bezel.svg`
- `apps/web/public/assets/industrial-kit/panel-plate.svg`
- `apps/web/public/assets/industrial-kit/rivet-bolt.svg`
- `apps/web/public/assets/industrial-kit/vent-grille.svg`
- `apps/web/src/components/AttackSlotsPanel.vue`
- `apps/web/src/components/DevLauncherScreen.vue`
- `apps/web/src/game/piece-shading.ts`
- `docs/tasks/0031-pulido-visual-fx-identidad-industrial.md`
- `docs/implementation/0031-pulido-visual-fx-identidad-industrial.md`

### Modificados
- `apps/web/index.html`
- `apps/web/src/App.vue`
- `apps/web/src/components/ModeSelector.vue`
- `apps/web/src/components/ModeSelector.test.ts`
- `apps/web/src/components/SettingsScreen.vue`
- `apps/web/src/components/HistoryScreen.vue`
- `apps/web/src/components/RankingScreen.vue`
- `apps/web/src/components/ResultsModal.vue`
- `apps/web/src/components/ScorePanel.vue`
- `apps/web/src/components/NextPiecesPreview.vue`
- `apps/web/src/components/HeldPiecePreview.vue`
- `apps/web/src/components/CombatStatusPanel.vue`
- `apps/web/src/components/CombatStatusPanel.test.ts`
- `apps/web/src/components/OpponentMonitor.vue`
- `apps/web/src/components/OpponentMonitor.test.ts`
- `apps/web/src/components/DevDemoLauncher.vue`
- `apps/web/src/dev/dev-demos.ts`
- `apps/web/src/dev/dev-demos.test.ts`
- `apps/web/src/game/battle-demo.ts`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/src/game/types.ts`
- `apps/web/src/styles/tactical-theme.css`
- `apps/web/e2e/battle-demo.spec.ts`
- `apps/web/e2e/bot-sabotage.spec.ts`
- `apps/web/e2e/sudden-death.spec.ts`
- `docs/project-status.md`

---

## 21. Fase B.2 — Integración estructural del Asset Kit

### Fuente de trabajo (temporal, no versionada)
Los 6 assets de esta fase se extrajeron de `Rautfall Asset Kit.dc.html`, un
archivo de trabajo temporal (export de canvas de diseño) usado solo como
origen puntual de extracción. No formaba parte del resultado final del
repositorio y ya fue eliminado del working tree.

### Assets Extraídos
Se extrajeron los 6 assets aprobados como archivos SVG vectoriales optimizados en `apps/web/public/assets/industrial-kit/`:
1. `dark-metal-tile.svg`: Textura base de chasis de grafito y metal cepillado (tileable 256x256).
2. `panel-plate.svg`: Placa industrial con bisel de 2px y 4 puntos estructurales (320x160).
3. `corner-reinforcement.svg`: Refuerzo metálico de esquinas remachado (96x96).
4. `rivet-bolt.svg`: Tornillo metálico 3D con slot e iluminación superior izquierda (24x24).
5. `vent-grille.svg`: Rejilla de ventilación de lamas con fondo real `#0b0c0d` (128x80).
6. `module-bezel.svg`: Marco extruido físico con centro transparente para bahías y visores (280x180).

### Integración en la Aplicación
- `dark-metal-tile.svg`: Aplicado en la superficie base de `.tactical-chassis` y `.opponent-monitor`.
- `panel-plate.svg`: Aplicado como fondo estructural de `.tactical-console`.
- `corner-reinforcement.svg`: Integrado en las 4 esquinas exteriores de `.tactical-chassis`.
- `rivet-bolt.svg`: Utilizado como tornillería metálica en puntos estructurales.
- `vent-grille.svg`: Integrado en la rejilla de ventilación `.opponent-vent` del monitor del oponente.
- `module-bezel.svg`: Aplicado en marcos de bahías tácticas.

### Adaptaciones Técnicas
- **Transformaciones de dirección de luz**: Se aplicaron transformaciones CSS (`scaleX`, `scaleY`, `scale(-1,-1)`) para colocar `corner-reinforcement.svg` en las 4 esquinas del chasis preservando la iluminación coherente de 135°.
- **Sustitución de CSS decorativo**: Sustitución de sombras y degradados artificiales pesados por assets SVG reutilizables servidos desde `apps/web/public/assets/industrial-kit/`.

