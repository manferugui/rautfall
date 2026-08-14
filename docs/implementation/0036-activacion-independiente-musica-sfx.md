# Informe de implementación — Tarea 0036: Activación independiente de Música y SFX

## Resumen

Se ha implementado el control independiente y persistente para los dos canales de audio de Rautfall: **MÚSICA** y **SFX / EFECTOS**, permitiendo las cuatro combinaciones operativas (ON/ON, OFF/ON, ON/OFF, OFF/OFF) sin dependencia funcional entre ellas y preservando estrictamente el ciclo de vida y la inicialización diferida de `AudioContext`.

---

## 1. Diagnóstico y Arquitectura

1. **Estado Independiente**:
   - `musicEnabled: boolean` representa la preferencia de activación de las pistas ambientales (BGM).
   - `sfxEnabled: boolean` representa la preferencia de activación de los efectos de sonido (muestras WAV y síntesis Web Audio).
   - `isUnlocked(): boolean` mantiene la distinción conceptual con respecto a la autorización / estado de ejecución del `AudioContext` en el navegador.

2. **Diferenciación de Pista Musical Deseada y Reproducción Activa**:
   - `desiredMusicTrack: MusicTrack | null` almacena en `AudioManager` la pista musical que corresponde al contexto o pantalla activa de la aplicación (ej. `'menu'`, `'gameplay'`, `'suddenDeath'`, `'victory'`).
   - `currentMusicSource: AudioBufferSourceNode | null` mantiene la referencia al nodo Web Audio en ejecución.
   - Cuando `musicEnabled === false`, se detiene inmediatamente cualquier fuente activa (`stopActiveMusicSource()`) conservando `desiredMusicTrack`.
   - Cuando `musicEnabled` vuelve a `true`, si el sistema está desbloqueado, se recupera automáticamente la reproducción de `desiredMusicTrack` sin crear fuentes huérfanas ni duplicar listeners o nodos.

3. **Centralización de la Guarda de SFX**:
   - Se han auditado todas las rutas de reproducción de efectos de sonido del proyecto (eventos de motor de juego, eventos de combate, UI, warning, shuttles de pausa, etc.).
   - Toda reproducción de efectos converge en la función centralizada `playSfx()`.
   - La guarda `if (!this.sfxEnabled) return;` se ubica al inicio de `playSfx()`, garantizando que ninguna ruta de efectos pueda saltarse la preferencia sin introducir comprobaciones redundantes aguas arriba.

4. **Persistencia y Migración Legacy Defensiva**:
   - Claves de persistencia: `rautfall_audio_music_enabled` y `rautfall_audio_sfx_enabled`.
   - Regla de migración: La lectura desde la clave legacy `rautfall_audio_muted` se ejecuta **únicamente cuando ambas claves nuevas están ausentes en `localStorage`**. Si al menos una clave nueva existe, no es sobrescrita por el estado legacy.
   - `writePreferencesToStorage()` actualiza ambas claves explícitas y sincroniza la clave legacy `rautfall_audio_muted` (`String(isMuted())`) para garantizar compatibilidad retroactiva.
   - Semántica legacy: `isMuted() === !musicEnabled && !sfxEnabled`, `setMuted(true)` deshabilita ambos canales y `setMuted(false)` habilita ambos.

5. **AudioContext e Invariantes de Desbloqueo**:
   - Los toggles de canales operan sobre preferencias antes o después del desbloqueo inicial del navegador.
   - Cambiar `musicEnabled` o `sfxEnabled` **NO** crea ansiosamente un `AudioContext`, **NO** invoca `unlock()`, **NO** cierra el contexto y **NO** altera el modal de activación.
   - En `AudioActivationModal.vue` / `handleInitializeAudio()`, la acción de desbloquear ejecuta `unlock()` y reconcilia el audio, pero **NO** fuerza `setMuted(false)`, preservando las preferencias individuales previamente configuradas por el operador.

---

## 2. Interfaz de Usuario (UI)

Se implementó el patrón visual **Industrial Dramatic** para los nuevos controles tácticos independientes:

1. **Cabecera Principal (`App.vue`)**:
   - Sustitución del botón único de mute por dos botones tácticos con atributos contractuales:
     - `MÚSICA: ON / OFF` (`data-testid="music-toggle-button"`, `:data-music-enabled="isMusicEnabled"`)
     - `SFX: ON / OFF` (`data-testid="sfx-toggle-button"`, `:data-sfx-enabled="isSfxEnabled"`)
   - Operables mediante teclado y mouse, con indicación inequívoca textual e iconográfica de su estado.

2. **Pantalla de Ajustes (`SettingsScreen.vue`)**:
   - Incorporada la sección `CANALES DE AUDIO` con los selectores tácticos `MÚSICA` (`data-testid="settings-music-toggle-button"`) y `EFECTOS` (`data-testid="settings-sfx-toggle-button"`).
   - Utilizan exactamente la misma fuente de verdad singleton (`AudioManager`), manteniendo ambas superficies de UI en perfecta sincronización reactiva.

---

## 3. Archivos Creados y Modificados

### Archivos Creados:
- `docs/implementation/0036-activacion-independiente-musica-sfx.md` *(Informe de implementación)*

### Archivos Modificados:
- `apps/web/src/audio/types.ts` *(Ampliación de `AudioPreferences` e interfaz `AudioService` con getters/setters/toggles de Música y SFX)*
- `apps/web/src/audio/audio-manager.ts` *(Implementación de `musicEnabled`, `sfxEnabled`, `desiredMusicTrack`, migración defensiva de `localStorage`, centralización en `playSfx` y `stopActiveMusicSource`)*
- `apps/web/src/audio/audio-manager.test.ts` *(Añadida suite de pruebas para los 4 estados combinatorios, semántica legacy, recuperación de BGM, inhibición de SFX, persistencia e invariantes de AudioContext)*
- `apps/web/src/App.vue` *(Sustitución de botón mute en la cabecera por toggles MÚSICA/SFX, actualización de handlers y removida la sobrescritura de setMuted(false) al inicializar)*
- `apps/web/src/App.test.ts` *(Actualización de assertions de integración y prueba de toggles de la cabecera)*
- `apps/web/src/components/SettingsScreen.vue` *(Incorporación de la sección CANALES DE AUDIO con toggles de Música y SFX)*
- `apps/web/src/components/SettingsScreen.test.ts` *(Añadida prueba de integración para la sección de canales de audio)*
- `apps/web/e2e/audio-activation-modal.spec.ts` *(Actualización de la suite E2E de Playwright verificando preservación de preferencias e interacción con toggles)*
- `docs/rautfall.md` *(Actualización de la sección de Audio reflejando la disponibilidad de activación independiente de Música y SFX)*
- `docs/project-status.md` *(Registro de finalización de la Tarea 0036)*

---

## 4. Pruebas y Validaciones

### Suite de Pruebas Unitarias e Integración
- `pnpm --filter @rautfall/web test src/audio/audio-manager.test.ts`: **PASS (44 tests)**
- `pnpm --filter @rautfall/web test src/App.test.ts`: **PASS (18 tests)**
- `pnpm --filter @rautfall/web test src/components/SettingsScreen.test.ts`: **PASS (8 tests)**
- `pnpm test`: **PASS (956 tests en 57 archivos de test)**

### Validaciones Raíz Obligatorias
- `pnpm test`: **0 errores**
- `pnpm lint`: **0 errores, 0 avisos de linting**
- `pnpm typecheck`: **0 errores de TypeScript en los 7 proyectos del monorepo**
- `pnpm build`: **Compilación exitosa en producción**
- `git diff --check`: **Sin conflictos ni trailing spaces**
