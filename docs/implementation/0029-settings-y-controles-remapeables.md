# Tarea 0029 — Informe de implementación

## 1. Veredicto
**Completada con éxito.** Se ha creado e integrado una pantalla/flujo real de Settings con controles de teclado remapeables y persistencia local (`rautfall.settings.v1`), manteniendo aislamiento arquitectónico, determinismo de entrada, validación estricta y compatibilidad con Polaridad Inversa.

---

## 2. Auditoría Inicial y Diagnóstico de Regresión

- **Input actual**: `GameScene` registraba teclas hardcodeadas mediante `Phaser.Input.Keyboard.KeyCodes` y escuchaba eventos `keydown`/`keyup` de navegador filtrando por `event.code`.
- **Causa de la regresión inicial**:
  - En la primera versión de la tarea 0029, `GameScene.ts` pasaba directamente cadenas W3C `KeyboardEvent.code` (p. ej. `'ArrowLeft'`, `'KeyJ'`) a `Phaser.Input.Keyboard.KeyboardPlugin.addKey(string)`.
  - Phaser 3 busca la clave en su diccionario interno de enteros `Phaser.Input.Keyboard.KeyCodes` convirtiendo la cadena a mayúsculas (`KeyCodes['ARROWLEFT']`, `KeyCodes['KEYJ']`). Dado que los nombres en Phaser son enteros con identificadores cortos (`LEFT` = 37, `J` = 74), la búsqueda devolvió `undefined`.
  - Como consecuencia, las instancias de `Phaser.Input.Keyboard.Key` de `this.cursors` quedaron vinculadas a `keyCode: undefined`, impidiendo que Phaser actualizara su propiedad `key.isDown` a `true` al recibir eventos DOM.
  - Esto provocaba que `readKeys()` enviara `leftHeld: true` / `rightHeld: true` exclusivamente en el frame 0 (por el flanco `pendingHorizontal`), pero colapsara a `false` a partir del frame 1, destruyendo la acumulación de DAS y la repetición ARR.
- **Corrección W3C $\rightarrow$ Phaser KeyCode**:
  - Se introdujo `codeToPhaserKeyCode(code: string): number` e `isSupportedControlCode(code: string): boolean` en `control-bindings.ts`.
  - `codeToPhaserKeyCode` convierte cualquier código W3C soportado (defaults `ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `Space`, `KeyZ`, `KeyC`, `KeyA`, `Escape`, así como letras `KeyA`..`KeyZ` y dígitos `Digit0`..`Digit9`) al entero `Phaser.Input.Keyboard.KeyCodes` equivalente (`37`, `39`, `40`, `38`, `32`, `90`, `67`, `65`, `27`, `74`, etc.).
  - `GameScene` inicializa `this.cursors` invocando `kb.addKey(codeToPhaserKeyCode(this.controlBindings[action]))`, restituyendo `Phaser.Input.Keyboard.Key.isDown` como la fuente canónica única y determinista para el estado mantenido (`held`).
- **Teclas auditadas**:
  - `moveLeft` (`ArrowLeft`)
  - `moveRight` (`ArrowRight`)
  - `softDrop` (`ArrowDown`)
  - `hardDrop` (`Space`)
  - `rotateClockwise` (`ArrowUp`)
  - `rotateCounterClockwise` (`KeyZ`)
  - `hold` (`KeyC`)
  - `triggerSabotage` (`KeyA`)
  - `pause` (`Escape`)
  - `reset`: Tecla `KeyR` auditada. Permanece fija y no configurable fuera de Settings por ser hotkey de soporte.

---

## 3. Modelo de Settings

- **Contrato de controles** (`apps/web/src/settings/control-bindings.ts`):
  - `ControlAction`: `'moveLeft' | 'moveRight' | 'softDrop' | 'hardDrop' | 'rotateClockwise' | 'rotateCounterClockwise' | 'hold' | 'triggerSabotage' | 'pause'`.
  - `ControlBindings`: `Readonly<Record<ControlAction, string>>`.
  - `isSupportedControlCode()`: Validación de teclas soportadas (flechas, Space, Escape, KeyA..KeyZ, Digit0..Digit9).
  - `codeToPhaserKeyCode()`: Conversión estricta a enteros Phaser KeyCodes sin fallbacks ambiguos ni `undefined`.
- **Defaults**:
  - `moveLeft`: `'ArrowLeft'`
  - `moveRight`: `'ArrowRight'`
  - `softDrop`: `'ArrowDown'`
  - `hardDrop`: `'Space'`
  - `rotateClockwise`: `'ArrowUp'`
  - `rotateCounterClockwise`: `'KeyZ'`
  - `hold`: `'KeyC'`
  - `triggerSabotage`: `'KeyA'`
  - `pause`: `'Escape'`
- **Persistencia local & validación** (`apps/web/src/settings/settings-storage.ts`):
  - Almacenamiento bajo la clave versionada `rautfall.settings.v1`.
  - Validación estricta con `isSupportedControlCode`: ante JSON corrupto, versión distinta de 1, acciones ausentes/extra, valores vacíos, no soportados o duplicados en storage $\rightarrow$ fallback completo a `DEFAULT_CONTROL_BINDINGS`.

---

## 4. Controles Remapeables y UI

- **Acciones y UI**: Se implementó `SettingsScreen.vue` integrado en `AppScreen = 'menu' | 'playing' | 'results' | 'settings'`.
- **Captura interactiva**:
  - Al hacer clic en "CAMBIAR", se activa el listener de captura en `window` con `event.repeat` ignorado.
  - Al pulsar `Escape`, se cancela la captura sin modificar el binding ni propagar como pausa o navegación.
  - Rechazo de teclas no soportadas o duplicadas con mensajes de error claros.
  - Limpieza estricta de event listeners al terminar, cancelar o desmontar el componente (`onUnmounted`).
- **Restaurar Defaults**: Botón dedicado para restablecer la configuración predeterminada.

---

## 5. Integración con Input, Cobertura de Held y DAS/ARR

- **Canal de traducción único**:
  `physical code (KeyboardEvent.code) -> codeToPhaserKeyCode -> Phaser key.isDown -> readKeys() -> input-release-guard -> input-buffer -> StepInput -> game-engine`
- **Mecánicas conservadas**: DAS, ARR, `input-release-guard` y `StepInput` permanecen intactos y funcionando tanto en defaults como con custom bindings.

---

## 6. Polaridad Inversa

- Se confirmó mediante prueba unitaria explícita (`GameScene.test.ts`) que una configuración de teclas remapeada genera la acción abstracta correspondiente y que el motor con Polaridad activa aplica la inversión correctamente sobre dicha acción.

---

## 7. Pruebas y Validaciones

- **Pruebas unitarias**: 797 pasadas (42 archivos), incluyendo `settings-storage.test.ts` (conversión de códigos y rechazo no soportados), `SettingsScreen.test.ts` y `GameScene.test.ts` con cobertura de held continuo y DAS/ARR para defaults y custom bindings.
- **Pruebas E2E**: 11 pasadas en Playwright en puerto 5188, incluyendo `settings-remap.spec.ts` usando `keyboard.down()` y `keyboard.up()` reales para verificar el desplazamiento repetido por DAS/ARR y su cese al soltar.
- **Verificaciones raíz**:
  - `pnpm test`: 797 tests OK.
  - `pnpm lint`: 0 errores / 0 avisos.
  - `pnpm typecheck`: OK en todos los paquetes.
  - `pnpm build`: OK.
  - `pnpm test:e2e`: 11 tests OK.
  - `git diff --check`: OK.

---

## 8. Archivos

### Creados
- `apps/web/src/settings/control-bindings.ts`
- `apps/web/src/settings/settings-storage.ts`
- `apps/web/src/settings/settings-storage.test.ts`
- `apps/web/src/settings/settings-store.ts`
- `apps/web/src/components/SettingsScreen.vue`
- `apps/web/src/components/SettingsScreen.test.ts`
- `apps/web/e2e/settings-remap.spec.ts`
- `docs/tasks/0029-settings-y-controles-remapeables.md`
- `docs/implementation/0029-settings-y-controles-remapeables.md`

### Modificados
- `apps/web/src/game/types.ts`
- `apps/web/src/components/ModeSelector.vue`
- `apps/web/src/App.vue`
- `apps/web/src/game/scenes/GameScene.ts`
- `apps/web/src/game/scenes/GameScene.test.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/audio-flow.spec.ts`
- `docs/project-status.md`

### Eliminados
- Ninguno.

---

## 9. Estado Git
- Sin commits realizados.
- `packages/game-engine` y `packages/battle-engine` permanecen intactos.
