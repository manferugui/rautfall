# 0033 — Popup Industrial de Activación de Audio

## Resumen

Esta tarea resuelve el problema de UX por el cual Rautfall arrancaba correctamente en silencio debido a las políticas de autoplay del navegador, pero el usuario no disponía de una señal explícita que indicara la existencia del módulo de sonido. Se ha implementado un popup industrial modal (`AudioActivationModal.vue`) que actúa como la interacción explícita de confirmación del operador requerida para inicializar y desbloquear `AudioContext`, manteniendo intacta la creación diferida del contexto Web Audio y garantizando cero autoplay automático durante la carga inicial.

---

## 1. Objetivo y Diagnóstico de Arquitectura

### Diagnóstico Previos

1. **`AudioManager` & `AudioService`**:
   - `AudioManager` es un singleton (`apps/web/src/audio/audio-manager.ts`) responsable del ciclo de vida de `AudioContext`, buses de volumen y reproducción de activos musicales (BGM) y sintetizados (SFX).
   - Se ha añadido `isUnlocked(): boolean` al contrato público `AudioService` (`apps/web/src/audio/types.ts`).

2. **Diferencia Conceptual entre Estados**:
   - `isUnlocked()` representa que el usuario ha autorizado e inicializado explícitamente el módulo de sonido durante la vida actual de la instancia SPA (`unlocked = true`).
   - `AudioContext.state === 'running'` indica el estado efímero del navegador. Un contexto ya autorizado puede ser suspendido por lifecycle sin invalidar la autorización previa del usuario.
   - `isMuted()` representa la preferencia persistida de silencio del usuario en `localStorage`.

3. **Autoplay Cero**:
   - Se han eliminado/adaptado los disparadores ansiosos de reproducción de BGM al montar componentes como `ModeSelector.vue` si el audio aún no ha sido unlocked.

---

## 2. Flujo de Inicialización y Comportamiento Final

```text
Carga de Aplicación (SPA)
        ↓
AudioContext sin instanciar / silencio absoluto
        ↓
Popup Industrial: AUDIO MODULE [STANDBY]
        ↓
┌──────────────────────┬──────────────────────┐
│ INICIALIZAR AUDIO    │ SEGUIR EN SILENCIO  │
└──────────┬───────────┴───────────┬──────────┘
           ↓                       ↓
  audioManager.unlock()       cerrar popup
           ↓                       ↓
        ÉXITO                 permanecer en
           ↓                    silencio (mute
  audioManager.setMuted(false)  inalterado)
           ↓
   SFX uiClick + BGM
```

### Opciones del Operador

1. **INICIALIZAR AUDIO** (`[data-testid="initialize-audio-button"]`):
   - `INICIALIZAR AUDIO` desbloquea el sistema y desactiva la preferencia de mute porque representa una solicitud explícita del usuario de activar el sonido.
   - Invoca `audioManager.unlock()`.
   - Durante la inicialización deshabilita acciones y muestra estado de carga (`INICIALIZANDO...`).
   - Si finaliza con éxito: establece `unlocked = true`, ejecuta `audioManager.setMuted(false)` desactivando el silencio y guardando la preferencia `rautfall_audio_muted = "false"`, reproduce el SFX `uiClick`, reconcilia la pista BGM de la pantalla actual y cierra el popup.
   - Si `unlock()` falla: mantiene el popup abierto, mantiene `unlocked = false`, no modifica `mute` ni `rautfall_audio_muted`, no reproduce SFX ni BGM, muestra el aviso discreto `AUDIO INIT FAILED // RETRY` y permite reintentar.

2. **SEGUIR EN SILENCIO** (`[data-testid="keep-silent-button"]`):
   - Marca `hasAudioPromptBeenDismissed = true` en memoria de la SPA.
   - Cierra el popup sin llamar a `unlock()`, sin instanciar `AudioContext`, sin modificar la preferencia de `mute` ni `localStorage`, sin SFX y sin BGM.
   - El popup no reaparece durante la navegación en la instancia SPA actual.

> **Nota de Arquitectura**: `unlocked`, `muted` y `AudioContext.state` continúan siendo estados conceptualmente independientes. La acción del modal coordina `unlocked` y `muted` para cumplir con la intención explícita del operador de escuchar sonido al inicializar el módulo.

---

## 3. Accesibilidad y Estética Industrial

- **Semántica HTML5 & ARIA**:
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby="audio-modal-title"`, `aria-describedby="audio-modal-desc"`.
- **Foco y Navegación**:
  - Foco inicial colocado en el botón `INICIALIZAR AUDIO`.
  - Focus trap mediante `Tab` y `Shift+Tab` atrapado dentro del diálogo.
  - Atajo `Escape` ejecuta la acción `SEGUIR EN SILENCIO`.
  - Restauración del foco al elemento activo previo al desmontarse.
- **Aislamiento de Controles**:
  - Los eventos de teclado dentro del modal se capturan con `stopPropagation()` para evitar acciones accidentales de gameplay en Rautfall.
- **Dirección Visual**:
  - Estética **Industrial Dramatic** coherente con el chasis de Rautfall: placas grafito/metal oscuro (`--rf-color-graphite-900`), remaches mecánicos, microplaca superior con badge `STANDBY` en color ámbar (`#ffaa00`) y tipografía técnica.

---

## 4. Archivos Creados y Modificados

### Archivos Creados
- `apps/web/src/components/AudioActivationModal.vue`: Componente modal de activación de audio industrial accesible.
- `apps/web/src/components/AudioActivationModal.test.ts`: Pruebas unitarias para el componente modal (9 tests).
- `apps/web/e2e/audio-helpers.ts`: Helpers reutilizables de Playwright (`initializeAudioIfPrompted`, `continueSilentlyIfPrompted`).
- `apps/web/e2e/audio-activation-modal.spec.ts`: Pruebas E2E de Playwright del popup de activación de audio.
- `docs/implementation/0033-popup-industrial-activacion-audio.md`: Informe de implementación.

### Archivos Modificados
- `apps/web/src/audio/types.ts`: Garantizada la inclusión de `isUnlocked(): boolean` en la interfaz `AudioService`.
- `apps/web/src/audio/audio-manager.ts`: Implementación de estado interno `unlocked`, actualización de `unlock()`, `isUnlocked()` y reseteo en `destroy()`.
- `apps/web/src/audio/audio-manager.test.ts`: Añadido bloque de pruebas para el contrato `isUnlocked()`.
- `apps/web/src/App.vue`: Integración del modal, estado en memoria `hasAudioPromptBeenDismissed`, manejadores asíncronos y reconciliación de audio.
- `apps/web/src/App.test.ts`: Añadido mock de `AudioContext` y pruebas de integración del popup industrial (7 tests).
- `apps/web/src/components/ModeSelector.vue`: Ajustado `onMounted` para verificar `isUnlocked()` antes de solicitar `playMusic('menu')`.
- `apps/web/e2e/*.spec.ts`: Actualizados specs E2E con el helper `initializeAudioIfPrompted`.
- `docs/project-status.md`: Actualizado el estado global del proyecto.

---

## 5. Pruebas y Validaciones

### Pruebas Unitarias e Integración
- `pnpm --filter @rautfall/web test src/audio/audio-manager.test.ts`: PASS
- `pnpm --filter @rautfall/web test src/components/AudioActivationModal.test.ts`: PASS (9 tests)
- `pnpm --filter @rautfall/web test src/App.test.ts`: PASS (13 tests)

### Pruebas E2E
- `pnpm --filter @rautfall/web test:e2e`: PASS (14 tests)

### Validaciones Raíz Obligatorias
```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @rautfall/web test:e2e
git diff --check
```

Todas las validaciones han finalizado con éxito sin errores ni avisos de linting.
