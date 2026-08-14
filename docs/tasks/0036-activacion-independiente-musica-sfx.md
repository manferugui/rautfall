# Task 0036 — Mejora de audio: activación independiente de Música y SFX

## Propósito

Implementar el control de activación y desactivación independiente y persistente para los dos canales de audio de Rautfall: **MÚSICA (BGM)** y **SFX / EFECTOS DE SONIDO**, garantizando que ambas vías puedan encenderse o apagarse sin interferir entre sí, respetando las restricciones de inicialización diferida de `AudioContext` en navegadores, las políticas de autoplay y manteniendo la compatibilidad retroactiva con la interfaz legacy de mute.

---

## Decisiones Aprobadas

1. **Estado de Canales e Interfaz Pública**:
   - `musicEnabled: boolean` representa el estado de activación de la música de fondo (BGM).
   - `sfxEnabled: boolean` representa el estado de activación de los efectos sonoros (síntesis y WAV).
   - `isUnlocked(): boolean` mantiene la distinción sobre la autorización/estado de ejecución del `AudioContext`.
   - Se añaden a `AudioService` los getters/setters/toggles:
     - `isMusicEnabled(): boolean`, `setMusicEnabled(enabled: boolean): void`, `toggleMusic(): boolean`
     - `isSfxEnabled(): boolean`, `setSfxEnabled(enabled: boolean): void`, `toggleSfx(): boolean`

2. **Semántica de Mute Legacy (`isMuted` / `setMuted`)**:
   - Para mantener compatibilidad con invocaciones legacy:
     $$\text{isMuted}() \equiv \neg \text{musicEnabled} \land \neg \text{sfxEnabled}$$
   - `setMuted(true)` desactiva ambos canales (`musicEnabled = false`, `sfxEnabled = false`).
   - `setMuted(false)` activa ambos canales (`musicEnabled = true`, `sfxEnabled = true`).
   - No se introduce un "estado anterior" guardado al ejecutar `setMuted(false)` ni una tercera preferencia como `masterMuted`.

3. **Gestión de Música y Diferenciación de Pista Deseada**:
   - `desiredMusicTrack: MusicTrack | null` conserva en `AudioManager` la pista asociada a la pantalla o contexto activo (ej. `'menu'`, `'gameplay'`, `'suddenDeath'`, `'victory'`).
   - Cuando `musicEnabled` pasa a `false`, se detiene la fuente sonora activa mediante `stopActiveMusicSource()`, pero se preserva `desiredMusicTrack`.
   - Cuando `musicEnabled` pasa a `true`, si el sistema está desbloqueado (`isUnlocked()`), se recupera y reproduce automáticamente `desiredMusicTrack` sin duplicar nodos ni fuentes sonoras huérfanas.

4. **Guarda Centralizada para SFX**:
   - Toda reproducción de efectos sonoros (motor de juego, combate, UI, shuttles de pausa, warnings, etc.) debe converger en `playSfx()`.
   - La comprobación `if (!this.sfxEnabled) return;` se ubica al inicio de `playSfx()`, asegurando que ningún canal secundario de efectos pueda omitir la preferencia del usuario.

5. **Persistencia y Migración Defensiva de LocalStorage**:
   - Nuevas claves en `localStorage`: `rautfall_audio_music_enabled` y `rautfall_audio_sfx_enabled`.
   - Regla de migración defensiva: Se consulta la clave legacy `rautfall_audio_muted` **únicamente si NINGUNA de las dos nuevas claves existe**. Si al menos una existe, no se utiliza la clave legacy como fallback para evitar sobrescribir las preferencias explícitas del usuario.
   - `writePreferencesToStorage()` escribe ambas claves nuevas y actualiza también `rautfall_audio_muted` (`String(isMuted())`) para retrocompatibilidad con herramientas o tests legacy.

6. **Invariantes de AudioContext y Modal de Activación**:
   - Alternar la música o los SFX **nunca** crea de forma ansiosa un `AudioContext` antes del `unlock()`, ni suspende/cierra el contexto tras haber sido activado.
   - En `AudioActivationModal.vue` / `handleInitializeAudio()`, la acción de desbloquear ejecuta `unlock()` y reconcilia el audio pero **NO** fuerza `setMuted(false)`, preservando intactas las preferencias individuales guardadas por el operador.

7. **Interfaz de Usuario (Industrial Dramatic)**:
   - **Cabecera Principal (`App.vue`)**: Reemplaza el botón único de mute por dos botones tácticos independientes:
     - `MÚSICA: ON / OFF` (`data-testid="music-toggle-button"`, `:data-music-enabled="isMusicEnabled"`)
     - `SFX: ON / OFF` (`data-testid="sfx-toggle-button"`, `:data-sfx-enabled="isSfxEnabled"`)
   - **Pantalla de Ajustes (`SettingsScreen.vue`)**: Incorpora la sección `CANALES DE AUDIO` con los botones de control `MÚSICA` (`data-testid="settings-music-toggle-button"`) y `EFECTOS` (`data-testid="settings-sfx-toggle-button"`).

---

## Especificación Modular y Contratos

### `apps/web/src/audio/types.ts`

```ts
export interface AudioPreferences {
  musicEnabled: boolean;
  sfxEnabled: boolean;
}

export interface AudioService {
  isUnlocked(): boolean;
  unlock(): Promise<void>;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
  toggleMute(): boolean;

  isMusicEnabled(): boolean;
  setMusicEnabled(enabled: boolean): void;
  toggleMusic(): boolean;

  isSfxEnabled(): boolean;
  setSfxEnabled(enabled: boolean): void;
  toggleSfx(): boolean;
  // ... resto de la interfaz pública
}
```

---

## Criterios de Aceptación y Validación

1. **Combinatoria de Canales**: Verificar las 4 combinaciones operativas (ON/ON, OFF/ON, ON/OFF, OFF/OFF).
2. **Preservación de Pista Deseada**: Al apagar la música y volver a encenderla en la misma o diferente pantalla, la BGM correcta se reanuda sin errores de reproducción.
3. **Persistencia e Independencia**: La recarga de la aplicación mantiene exactamente las selecciones guardadas.
4. **Validación Completa Monorepo**: `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm --filter @rautfall/web test:e2e` deben pasar sin errores ni advertencias.
