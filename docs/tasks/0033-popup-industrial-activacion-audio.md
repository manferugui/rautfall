# Task 0033 — Popup Industrial de Activación de Audio

## Estado

✅ Completada

Fecha de finalización: 2026-08-13

## Contexto

Rautfall ya respetaba la creación diferida de `AudioContext` para cumplir con las políticas de autoplay de los navegadores. Sin embargo, al arrancar la página completamente en silencio, el usuario no recibía ninguna indicación visual de que el juego disponía de un sistema de audio.

Era necesario convertir la interacción obligatoria del navegador en una acción explícita, clara y coherente con la identidad visual **Industrial Dramatic** del juego.

## Objetivo

Implementar un diálogo industrial inicial que permita:

* Inicializar explícitamente el sistema de audio.
* Continuar en silencio.
* Mantener cero autoplay durante la carga.
* Coordinar la desactivación de mute al inicializar el audio para cumplir la expectativa del usuario de escuchar sonido.

## Requisitos funcionales

1. **Al cargar la aplicación**:
   * No crear `AudioContext` de forma ansiosa.
   * No reproducir BGM.
   * No reproducir SFX.
   * Mostrar el popup cuando el audio no esté desbloqueado (`isUnlocked() === false`).

2. **Acción `INICIALIZAR AUDIO`**:
   * Invocar `AudioManager.unlock()`.
   * Evitar ejecuciones simultáneas mientras la inicialización está en curso.
   * Tras un `unlock()` exitoso, deshabilitar el silenciamiento mediante la API oficial (`setMuted(false)`), actualizando y persisitiendo la preferencia no silenciada. `INICIALIZAR AUDIO` desbloquea el sistema y desactiva la preferencia de mute porque representa una solicitud explícita del usuario de activar el sonido.
   * Reproducir el feedback de audio existente (`uiClick`).
   * Reconciliar la BGM de la pantalla actual tras el desbloqueo.
   * Cerrar el popup solo después de confirmar un desbloqueo correcto.

3. **Acción `SEGUIR EN SILENCIO`**:
   * Cerrar el popup.
   * No llamar a `unlock()`.
   * No crear `AudioContext`.
   * No reproducir audio (ni BGM ni SFX).
   * No modificar la preferencia persistente de mute.
   * No volver a mostrar el popup durante la vida de la instancia actual de la SPA.

4. **Error de inicialización**:
   * Mantener el diálogo abierto.
   * Conservar `isUnlocked() === false`.
   * No modificar `mute` ni la preferencia persistida.
   * No reproducir SFX/BGM.
   * Permitir el reintento.

## Modelo de estado de audio

El sistema debe mantener expresamente separados los siguientes conceptos de estado:

```text
unlocked
AudioContext.state
muted
```

> `unlocked`, `muted` y `AudioContext.state` continúan siendo estados conceptualmente independientes.

* `unlocked`: Indica que la operación explícita de desbloqueo del navegador se completó correctamente durante la vida de la instancia SPA actual.
* `muted`: Representa la preferencia persistente del usuario respecto a si quiere escuchar audio.
* `AudioContext.state`: Estado técnico actual de Web Audio API.

La acción del modal coordina `unlocked` y `muted` porque expresa una intención explícita del usuario de escuchar sonido, no porque deban fusionarse conceptualmente.

`isUnlocked()` debe representar el hecho de que el usuario completó correctamente el desbloqueo en la instancia de la aplicación, no simplemente la condición efímera del navegador:

```ts
ctx.state === 'running'
```

## Interfaz pública

Documentar la ampliación prevista en la interfaz pública de servicios de sonido:

```ts
interface AudioService {
  isUnlocked(): boolean
}
```

sin incluir detalles de implementación innecesarios.

## UX y dirección visual

El popup debe integrarse con la estética **Industrial Dramatic**:

* Placa grafito / metal oscuro.
* Biseles metálicos muescados.
* Remaches.
* Estado `STANDBY` en ámbar.
* Microplaca `AUDIO MODULE`.
* Aspecto de módulo de control industrial.
* Sin modal SaaS genérico.
* Sin neón o glow excesivo.

### Contenido requerido

```text
AUDIO MODULE
STANDBY
SISTEMA DE AUDIO // EN ESPERA
Se requiere confirmación del operador para inicializar el módulo de sonido.
OPERATOR CONFIRMATION REQUIRED
```

### Acciones

```text
INICIALIZAR AUDIO
SEGUIR EN SILENCIO
```

## Accesibilidad

* `role="dialog"`.
* `aria-modal="true"`.
* Título accesible (`aria-labelledby`).
* Foco inicial en la acción principal (`INICIALIZAR AUDIO`).
* Focus trap (`Tab` / `Shift+Tab`).
* Tecla `Escape` equivalente a continuar en silencio.
* Restauración del foco al cerrar.
* Aislamiento de eventos de teclado para evitar la propagación hacia controles globales de gameplay.

## Persistencia

* Estado de confirmación/descarte del modal únicamente en memoria de la SPA.
* Duración igual a la instancia actual de la SPA.
* Sin `localStorage` para la confirmación de la prompt.
* Sin `sessionStorage`.
* Una recarga completa de la página puede volver a mostrar el popup si el audio no ha sido desbloqueado.

Esto no debe confundirse con la preferencia de mute, la cual conserva su propia persistencia preexistente y se actualiza a `false` al pulsar `INICIALIZAR AUDIO`.

## Restricciones

* No modificar `packages/game-engine`.
* No modificar `packages/battle-engine`.
* No introducir dependencias.
* No crear otro sistema de BGM.
* No crear otra fuente de verdad para mute.
* No añadir desbloqueadores globales paralelos.
* No añadir assets de audio nuevos.
* No reproducir nada automáticamente al cargar.
* No rediseñar Settings.
* No ampliar el alcance fuera del popup y su integración de audio.

## Pruebas requeridas

La Task debía proteger al menos:

* `isUnlocked()` falso inicialmente.
* Verdadero tras `unlock()` correcto.
* Falso tras fallo.
* Sigue verdadero si el contexto se suspende posteriormente.
* Modal visible con audio bloqueado.
* Inicialización llama una sola vez a `unlock()`.
* Desmutearización coordinada tras éxito en `INICIALIZAR AUDIO`.
* Continuar en silencio no altera mute ni llama a `unlock()`.
* Error mantiene modal abierto sin alterar mute.
* No BGM antes del desbloqueo.
* Accesibilidad y focus trap.
* Ausencia de propagación de controles del juego.
* Flujo E2E real.

## Criterios de aceptación

La Task queda aceptada cuando:

* La aplicación arranca completamente silenciosa.
* El popup comunica claramente la disponibilidad del audio.
* El usuario puede inicializarlo explícitamente y escuchar sonido.
* Puede continuar en silencio.
* No existe autoplay prematuro.
* `unlocked`, `muted` y `AudioContext.state` permanecen conceptualmente independientes.
* El modal es accesible.
* No aparecen listeners duplicados.
* Todas las validaciones obligatorias están verdes.

## Validaciones obligatorias

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @rautfall/web test:e2e
git diff --check
```
