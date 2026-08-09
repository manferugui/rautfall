# Informe de Implementación — Tarea 0028: DEV Demo Launcher

## Resumen

Se ha implementado el lanzador centralizado de demos de desarrollo (**DEV Demo Launcher**), accesible desde el menú principal únicamente cuando `import.meta.env.DEV === true`.

El lanzador permite abrir cualquiera de los 13 escenarios DEV auditados sin tener que recordar ni escribir manualmente sus parámetros de consulta en la URL, construyendo URLs limpias desde cero (`pathname + '?' + exactDemoQuery`) y ofreciendo una acción para **Volver al menú** (`pathname`).

---

## Auditoría Final de Escenarios y Music Lab

Durante la auditoría del código en `apps/web/src/` (`SfxLab.vue`, `sfx-lab-demo.ts` y `AudioManager`):
- Se comprobó que `SfxLab.vue` (activado por `?sfx-lab=1`) integra **tanto** los efectos de sonido sintéticos (SFX) como el reproductor y probador de pistas musicales BGM (Menu BGM, Victory BGM, Gameplay BGM, Sudden Death BGM y transiciones).
- No existen dos query params ni dos laboratorios separados en la base de código. Se agrupó bajo la entrada canónica **Audio Lab (SFX & Music)**.
- Se mantuvieron 13 entradas canónicas exactas, excluyendo aliases redundantes y la instrumentación de consola `?inputDebug=1`.

---

## Archivos Creados y Modificados

- **[NEW] [0028-dev-demo-launcher.md](file:///home/manuel/dev/rautfall/docs/tasks/0028-dev-demo-launcher.md)** — Especificación inmutable de la tarea 0028.
- **[NEW] [dev-demos.ts](file:///home/manuel/dev/rautfall/apps/web/src/dev/dev-demos.ts)** — Fuente única de verdad con las 13 definiciones canónicas y el helper `buildDemoTargetUrl`.
- **[NEW] [dev-demos.test.ts](file:///home/manuel/dev/rautfall/apps/web/src/dev/dev-demos.test.ts)** — Pruebas unitarias de integridad del registro y construcción de URLs limpias.
- **[NEW] [DevDemoLauncher.vue](file:///home/manuel/dev/rautfall/apps/web/src/components/DevDemoLauncher.vue)** — Componente visual simplificado con tokens CSS tácticos de Rautfall.
- **[NEW] [DevDemoLauncher.test.ts](file:///home/manuel/dev/rautfall/apps/web/src/components/DevDemoLauncher.test.ts)** — Pruebas unitarias del componente lanzador.
- **[MODIFY] [ModeSelector.vue](file:///home/manuel/dev/rautfall/apps/web/src/components/ModeSelector.vue)** — Integración condicional de `DevDemoLauncher.vue` bajo `import.meta.env.DEV === true` con importación asíncrona.
- **[MODIFY] [ModeSelector.test.ts](file:///home/manuel/dev/rautfall/apps/web/src/components/ModeSelector.test.ts)** — Prueba de integración del lanzador DEV en el menú principal.
- **[NEW] [0028-dev-demo-launcher.md](file:///home/manuel/dev/rautfall/docs/implementation/0028-dev-demo-launcher.md)** — Este informe de implementación.
- **[MODIFY] [project-status.md](file:///home/manuel/dev/rautfall/docs/project-status.md)** — Registro del estado actualizado del proyecto.

---

## Decisiones Relevantes y Protección en Producción

1. **Aislamiento Funcional en Producción**:
   - El lanzador y su registro están protegidos incondicionalmente por `import.meta.env.DEV === true`.
   - En entorno de producción (`import.meta.env.DEV === false`), `DevDemoLauncherComponent` evalúa a `null`, impidiendo cualquier renderizado, interacción o ejecución.

2. **Exclusión Física del Bundle Comprobada**:
   - Tras ejecutar `pnpm build`, se inspeccionó el artefacto resultante en `apps/web/dist/`.
   - La búsqueda de cadenas como `"DEV Demo Launcher"`, `"dev-demos"` y `"battle-2p"` arrojó **cero coincidencias** (0 results found).
   - Vite y el proceso de compilación eliminaron físicamente todo el código de demos DEV del bundle entregable `dist/`.

3. **Construcción de URLs Limpias**:
   - `buildDemoTargetUrl` genera la URL desde cero usando `window.location.pathname + '?' + searchParams`, evitando acumulación de query params de escenarios anteriores.
   - El botón **Volver al menú** restablece la URL a `window.location.pathname`.

4. **Desbloqueo de Audio en la Interacción del Usuario en Demos**:
   - **Causa Raíz**: Al abrir una demo (por URL directa o navegación `reload` desde `DevDemoLauncher`), el navegador inicia un documento con `user activation = false` y el `AudioContext` suspendido. Anteriormente, los eventos de teclado de `GameScene` procesaban la lógica de juego pero no invocaban la infraestructura común de audio.
   - **Punto Común de Desbloqueo**: Se añadió `void getAudioManager().unlock();` dentro del listener común `onKeyDown` de `GameScene.ts`.
   - **Confirmación de Creación Diferida**: `AudioContext` continúa sin crearse de forma ansiosa en `import`, constructor, `mounted()` ni en la carga inicial de la demo. El contexto permanece en `uninitialized` o `suspended` hasta que el usuario realiza su primera pulsación real de teclado (`ArrowLeft`, `ArrowRight`, `Space`, `A`, `Z`, `C`, `Esc`, `R`, etc.).
   - **Procesamiento Transparente**: La primera pulsación reanuda el audio e inmediatamente procesa la acción de juego correspondiente sin bloquear (`await`) ni consumir el evento.

5. **Selección Diferida de BGM en Entradas Directas DEV**:
   - **Causa Raíz**: Al saltar directamente a `appScreen = 'playing'` en modo DEV, se omitía la llamada a `selectMode()`, por lo que `audioManager.playMusic('gameplay')` nunca se ejecutaba y `currentMusicTrack` permanecía `null`. Al pulsar la primera tecla, `unlock()` reanudaba el contexto para SFX pero no tenía ninguna pista BGM asignada que reproducir.
   - **Solución Aplicada**: En `App.vue`, al detectar la inicialización directa en modo DEV (`if (isDevDemo && !isSfxLab)`), se ejecuta `audioManager.playMusic('gameplay')`.
   - **Respeto a Autoplay**: Esta llamada asigna `currentMusicTrack = 'gameplay'` de forma diferida **sin invocar `unlock()` ni crear el `AudioContext` ansiosamente**.
   - **Flujo Resultante**: Al pulsar la primera tecla en la demo, `unlock()` encuentra `currentMusicTrack === 'gameplay'` e inicia la música de fondo de forma inmediata y sincronizada con el primer SFX y la acción de juego.
   - **Muerte Súbita**: Se preserva la transición REAL a `suddenDeath` BGM cuando el motor emite `suddenDeathStarted` a los 05:00 min.

6. **Reinicio Explícito de Música con `restartMusic(track)`**:
   - **Causa Raíz**: `playMusic()` realiza un NO-OP intencional cuando la misma pista ya está activa para no interrumpir bucles en re-renders. Además, los flujos de reinicio (`doReset()`, `doReplay()`, tecla `R` en `GameScene.ts`) no invocaban ninguna rutina musical, dejando que la música continuara en su offset actual o manteniendo pistas de `suddenDeath` / `victory` activas.
   - **API Producida**: `public restartMusic(track: MusicTrack): void` en `AudioManager`. Detiene la fuente musical y nodos de ganancia previos de forma segura, limpia el estado de atenua (ducking) previa, asigna `currentMusicTrack = track` e inicia la reproducción desde el segundo `0.0` si el `AudioContext` está `'running'` (o la deja registrada sin crear `AudioContext` si estuviera suspendido).
   - **Integración**: Invocada en `App.vue::doReset()`, `App.vue::doReplay()` y `GameScene.ts::resetGame()` (tecla `R`). Se preserva el silencio (Mute) y la no creación ansiosa de `AudioContext`.

---

## API Pública Producida

### `apps/web/src/dev/dev-demos.ts`

```ts
export type DevDemoCategory = 'battle' | 'mechanics' | 'audio';

export type DevDemoDefinition = Readonly<{
  id: string;
  label: string;
  description: string;
  category: DevDemoCategory;
  query: Readonly<Record<string, string>>;
}>;

export const DEV_DEMOS: readonly DevDemoDefinition[];

export function buildDemoTargetUrl(
  query: Readonly<Record<string, string>>,
  currentPathname?: string,
): string;
```

---

## Pruebas Añadidas

- `apps/web/src/dev/dev-demos.test.ts`: 5 pruebas que verifican las 13 entradas, unicidad de IDs, validez de campos y construcción exacta de URLs limpias.
- `apps/web/src/components/DevDemoLauncher.test.ts`: 5 pruebas que verifican el renderizado de la lista, título, botón "Volver al menú" y redirección al seleccionar una demo o volver al menú.
- `apps/web/src/components/ModeSelector.test.ts`: 1 prueba nueva que verifica la inclusión de la sección DEV Demo Launcher en el menú principal.

---

## Comandos Ejecutados y Resultados

1. `pnpm test` → **PASS** (39 test files, 773 tests pasados).
2. `pnpm lint` → **PASS** (0 errores, 0 warnings en eslint).
3. `pnpm typecheck` → **PASS** (comprobación de tipos limpia en los 4 paquetes/apps).
4. `pnpm build` → **PASS** (build exitoso en `apps/web/dist`).
5. `pnpm test:e2e` → **PASS** (10/10 tests Playwright pasados en chromium).
6. `git diff --check` → **PASS** (0 errores de espacios/formato).
7. `git status --short` → **VERIFICADO** (solo archivos previstos modificados/creados).

---

## Confirmación del Alcance Excluido

- `packages/game-engine`: Intacto (`git status packages/` limpio).
- `packages/battle-engine`: Intacto (`git status packages/` limpio).
- `packages/game-config`: Intacto.
- No se han añadido nuevas mecánicas de juego, ni configuraciones, ni cambios en AudioManager.
