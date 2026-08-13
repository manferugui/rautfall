# Task 0034 — Cortinilla / Compuerta Industrial Animada de Pausa

## Estado

✅ Completada

Fecha de finalización: 2026-08-13

## Contexto

La pausa ya estaba implementada y coordinada en `apps/web`:
* `SessionStatus = 'running' | 'paused' | 'gameOver'`.
* `Escape` alterna `running ⇄ paused`.
* Durante la pausa no se ejecutan pasos del motor.
* Al reanudar se limpia el acumulador temporal para evitar `catch-up`.
* Existe guardián de liberación de entrada.
* El motor determinista permanece inalterado.
* Phaser no asume lógica de pausa.

Anteriormente existía una representación visual básica de pausa mediante un texto o capa overlay semitransparente. Era necesario evolucionar esta presentación hacia la dirección visual del producto **Industrial Dramatic** (grafito, metal oscuro, profundidad, juntas, maquinaria, señalética ámbar).

## Objetivo

Implementar una **compuerta/blast shutter industrial animada de pausa** que selle visualmente el tablero principal de juego al pausar la partida (`Esc` o control de UI).

Al entrar en pausa, la ventana del tablero debe parecer sellada físicamente por una compuerta industrial, no simplemente cubierta por un overlay semitransparente web.

## Requisitos funcionales

1. **Entrada en pausa (`running -> paused`)**:
   * La lógica del motor se detiene inmediatamente.
   * La compuerta industrial se cierra en **500 ms**.
   * Durante el movimiento, el tablero queda progresivamente oculto.
   * Al terminar, la ventana queda completamente sellada con la placa de señalética central:
     ```text
     SYSTEM HOLD
     PAUSED

     ESC — RESUME
     ```
   * No debe parecer un modal web flotante.

2. **Reanudación (`paused -> running`)**:
   * La compuerta se abre rápidamente en **~240 ms** para minimizar el tiempo en que `status=running` pero el tablero permanece parcialmente cubierto.
   * Conservar la lógica existente de reanudación sin esperas en el motor ni temporizadores de dominio.
   * La animación es exclusivamente capa de presentación.

3. **Diseño de la compuerta**:
   * Construida íntegramente con **Vue + CSS** (geometría, gradientes, sombras, biseles, juntas, remaches).
   * Sin imágenes rasterizadas.
   * Integrada físicamente dentro del marco (`board-bezel`) del tablero.
   * Cubre únicamente la ventana principal de juego / canvas del jugador (la carcasa Tactical, consola y HUD permanecen visibles).

4. **Accesibilidad y Motion**:
   * Respetar `@media (prefers-reduced-motion: reduce)`: transiciones instantáneas de apertura/cierre conservando señalética y estado visual.

5. **Precedencia de Game Over**:
   * Inactiva si `status === 'gameOver'`. `gameOver` prevalece sobre `paused`.

6. **Audio y Microajuste de Transporte BGM**:
   * Activos WAV de producción pre-generados y versionados en `apps/web/public/audio/sfx/`:
     * `pause-shutter-close.wav` (~500 ms, ataque mecánico, masa hidráulica, impacto sordo).
     * `pause-shutter-open.wav` (~240 ms, descompresión hidráulica rápida y liberación).
   * **Pausa de BGM con conservación de offset**: Al pausar la sesión (`running -> paused`), la música de fondo realiza un fade-out de ~150 ms y congela su offset temporal sin avanzar mientras permanece pausada.
   * **Reanudación de BGM con fade-in**: Al reanudar (`paused -> running`), la música continúa con fade-in de ~250 ms desde el offset guardado.
   * **AudioContext activo**: `AudioContext` NO se suspende, permitiendo reproducir SFX (`pauseShutterClose`, `pauseShutterOpen`, UI clicks) durante la pausa.
   * Orquestación desde `App.vue` utilizando la infraestructura de `AudioManager`.
   * `PauseShutter.vue` es puramente presentacional (no importa ni invoca `AudioManager`).
   * Silencio absoluto si el audio no está desbloqueado o está silenciado.

7. **Pruebas y Selectores**:
   * Sustituir el selector de prueba E2E `pause-overlay` por `pause-shutter`.
   * Pruebas unitarias de UI declarativa para `PauseShutter.vue` y pruebas de transporte BGM en `audio-manager.test.ts`.

## Validaciones obligatorias

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @rautfall/web test:e2e
git diff --check
```
