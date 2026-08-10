# Tarea 0029 — Settings y controles remapeables

## Contexto

Estado actual:
- Tarea 0028 cerrada y commiteada.
- Árbol git limpio.
- DEV Demo Launcher terminado.
- AudioManager terminado y corregido.
- Suite completa en verde.
- No mezclar esta tarea con backend, ranking, historial ni pulido visual final.

## Objetivo

Implementar una pantalla/flujo de Settings funcional con persistencia local y controles de teclado remapeables para el juego, respetando:
- arquitectura existente;
- input determinista;
- separación entre UI y dominio;
- detección de teclas duplicadas;
- restauración de valores predeterminados;
- compatibilidad con Polaridad inversa;
- aislamiento respecto a game-engine y battle-engine.

## Requisitos

### 1. Auditoría Previa Obligatoria
Auditar:
- Representación actual de teclas en GameScene, input buffer, release guard, helpers de teclado y tests.
- Teclas hardcodeadas (moveLeft, moveRight, softDrop, hardDrop, rotateClockwise, rotateCounterClockwise, hold, triggerSabotage, pause, reset).
- Modelo de GameMode, AppScreen, navegación al menú y settings.
- Persistencia existente en localStorage.
- Polaridad inversa y su transformación de acciones abstractas.

### 2. Contrato de Controles
Crear fuente única de verdad en `apps/web/src/settings/control-bindings.ts`:
- Tipos `ControlAction` y `ControlBindings`.
- Acciones soportadas: `moveLeft`, `moveRight`, `softDrop`, `hardDrop`, `rotateClockwise`, `rotateCounterClockwise`, `hold`, `triggerSabotage`, `pause`.
- `KeyR` (reset) permanece como soporte fijo no remapeable.
- Teclas representadas mediante `KeyboardEvent.code` estable.

### 3. Valores Predeterminados
- `moveLeft`: `ArrowLeft`
- `moveRight`: `ArrowRight`
- `softDrop`: `ArrowDown`
- `hardDrop`: `Space`
- `rotateClockwise`: `ArrowUp`
- `rotateCounterClockwise`: `KeyZ`
- `hold`: `KeyC`
- `triggerSabotage`: `KeyA`
- `pause`: `Escape`

### 4. Gestión de Duplicados
- Impedir asignación simultánea de la misma tecla a dos acciones.
- Rechazo explícito con feedback visual indicando qué acción utiliza la tecla solicitada.

### 5. Captura de Nueva Tecla
- Entrar en modo captura al pulsar "Cambiar".
- Escuchar el siguiente keydown válido (filtrando auto-repeat).
- Permitir Escape para cancelar la captura.
- Limpiar listeners al completar, cancelar o desmontar el componente.

### 6. Persistencia Local
- Almacenar en localStorage bajo la clave versionada `rautfall.settings.v1`.
- Validar payload estricto al cargar; en caso de corrupción o inválido, fallback seguro a defaults.

### 7. Integración con Input y Phaser
- `GameScene` lee bindings configurados en lugar de teclas hardcodeadas.
- Traducción: physical key -> configured action -> input buffer / KeyState -> StepInput -> game-engine.
- Sin cambios en StepInput, game-engine o battle-engine.
- Guardián de liberación (releaseGuard) y DAS/ARR intactos.

### 8. Polaridad Inversa
- Polaridad invierte acciones abstractas en game-engine.
- El remapeo de teclas a acciones abstractas funciona transparentemente con Polaridad.

### 9. UI de Settings
- Crear `SettingsScreen.vue` integrado en `AppScreen = 'menu' | 'playing' | 'results' | 'settings'`.
- Sección CONTROLES (lista, Cambiar, feedback, Restaurar defaults, Volver).
- Sección AUDIO opcional con Mute/Unmute reusando AudioManager.

### 10. Validaciones y Tests
- Tests unitarios de settings/storage, UI de settings, integración de input en GameScene, polaridad y guardián de liberación.
- Test E2E de remapeo de tecla y persistencia en Training.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:e2e`, `git diff --check`.
