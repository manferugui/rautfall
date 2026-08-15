# Informe de Implementación — Tarea 0037: URL sincronizada y soporte real de Back/Forward

## Resumen

Se ha implementado navegación web real para la SPA de Rautfall utilizando **Vue Router** (`vue-router@^4.5.0`). 

Antes de esta tarea, las transiciones entre pantallas se gestionaban mediante la variable mutable `appScreen` en `App.vue`, lo que provocaba que la URL del navegador permaneciera estática (ej. `/`), impidiendo el funcionamiento de los botones **Atrás** / **Adelante**, el uso de deep links y la persistencia de pantalla al refrescar (`F5`).

Con esta solución:
1. Se ha eliminado por completo `appScreen` ref como fuente de verdad paralela.
2. La vista activa y los estados derivados (`gameMode`, `isCanvasMounted`, `reconcileScreenAudio`) se calculan mediante `computed()` basados en `route.name` (o el fallback local reactivo para tests unitarios).
3. Todas las rutas se definen mediante identificadores nombrados estables (`name`).
4. Se han configurado guardas de navegación en `router/index.ts` para:
   - Proteger rutas de desarrollo (`/dev-tools`, `/sfx-lab`) redirigiendo a `home` en producción (`!import.meta.env.DEV`).
   - Evitar accesos directos a `/results` sin un estado de resultado activo (`hasActiveResult`), redirigiendo a `home` mediante `replace`.
   - Redirigir rutas desconocidas a `home` mediante `replace`.
5. Se ha documentado formalmente la frontera del fallback SPA de producción entre Vite dev/E2E y Fastify API.

---

## Archivos Creados y Modificados

### Creados
- [`apps/web/src/router/index.ts`](file:///home/manuel/dev/rautfall/apps/web/src/router/index.ts): Factoría del router (`createAppRouter`), mapa de rutas nombradas y guardas de navegación.
- [`docs/tasks/0037-sincronizacion-url-y-soporte-back-forward.md`](file:///home/manuel/dev/rautfall/docs/tasks/0037-sincronizacion-url-y-soporte-back-forward.md): Especificación inmutable de la tarea 0037.
- [`docs/implementation/0037-sincronizacion-url-y-soporte-back-forward.md`](file:///home/manuel/dev/rautfall/docs/implementation/0037-sincronizacion-url-y-soporte-back-forward.md): Este informe técnico de implementación.

### Modificados
- [`apps/web/package.json`](file:///home/manuel/dev/rautfall/apps/web/package.json): Instalada la dependencia `"vue-router": "^4.5.0"`.
- [`pnpm-lock.yaml`](file:///home/manuel/dev/rautfall/pnpm-lock.yaml): Actualizado lockfile con `vue-router` y sus dependencias transitivas.
- [`apps/web/src/main.ts`](file:///home/manuel/dev/rautfall/apps/web/src/main.ts): Registrado el plugin Vue Router `app.use(createAppRouter())`.
- [`apps/web/src/App.vue`](file:///home/manuel/dev/rautfall/apps/web/src/App.vue): Eliminada `appScreen` ref. Sincronizados `gameMode`, `isCanvasMounted`, `reconcileScreenAudio()` y la plantilla con `currentRouteName`. Transiciones migradas a `pushRoute` / `replaceRoute`.
- [`apps/web/src/App.test.ts`](file:///home/manuel/dev/rautfall/apps/web/src/App.test.ts): Adaptado helper `mountApp` con `createMemoryHistory()` y aisladas instancias del router por test. Añadidas pruebas de consistencia URL/pantalla y guarda de `/results`.
- [`apps/web/e2e/navigation-flow.spec.ts`](file:///home/manuel/dev/rautfall/apps/web/e2e/navigation-flow.spec.ts): Añadidas pruebas E2E de Playwright para navegación real Back/Forward, ciclo de vida de Phaser en canvas, deep links y reload (F5).
- [`docs/project-status.md`](file:///home/manuel/dev/rautfall/docs/project-status.md): Registrada la Tarea 0037.
- [`docs/rautfall.md`](file:///home/manuel/dev/rautfall/docs/rautfall.md): Documentada la decisión de arquitectura de navegación SPA con Vue Router y la frontera de servidor.

---

## Tabla de Rutas Nombradas Finales

| Path | Name | Vista / Componente | Deep Link Directo | Fallback / Redirección | DEV-only |
|---|---|---|---|---|---|
| `/` | `home` | `ModeSelector` | Sí | — | No |
| `/training` | `training` | Game Chassis (1P) | Sí | Inicia nueva partida 1P | No |
| `/battle` | `battle` | Game Chassis (2P) | Sí | Inicia nueva partida 2P vs Bot | No |
| `/settings` | `settings` | `SettingsScreen` | Sí | — | No |
| `/history` | `history` | `HistoryScreen` | Sí | — | No |
| `/ranking` | `ranking` | `RankingScreen` | Sí | — | No |
| `/results` | `results` | `ResultsModal` | Condicional | `replace({ name: 'home' })` si no hay `gameResult` | No |
| `/dev-tools` | `dev-tools` | `DevLauncherScreen` | Solo DEV | `{ name: 'home' }` en PROD | Sí |
| `/sfx-lab` | `sfx-lab` | `SfxLab` | Solo DEV | `{ name: 'home' }` en PROD | Sí |
| `/:pathMatch(.*)*` | `not-found` | Catch-all | Sí | `replace({ name: 'home' })` | No |

---

## Auditoría y Decisiones de Navegación (`push` vs `replace`)

1. **`push` en navegación voluntaria**:
   - `ModeSelector -> Training`: `router.push({ name: 'training' })`.
   - `ModeSelector -> Battle`: `router.push({ name: 'battle' })`.
   - `ModeSelector -> Settings / History / Ranking / DEV`: `router.push({ name: ... })`.
   - `Game Over / Victory -> Results`: `router.push({ name: 'results' })`.
   - Permite que el usuario use **Atrás** para regresar al menú o pantalla previa.

2. **`replace` en estados caducados o redirecciones de seguridad**:
   - `Results -> Ranking` (al guardar resultado): `router.replace({ name: 'ranking' })`. Evita que al pulsar **Atrás** desde Ranking se reabra un modal de resultados cuyo resultado postpartida ya fue enviado/consumido.
   - `Results -> Replay`: `router.replace({ name: mode })`. Reemplaza la entrada de resultados caducada en el historial por la nueva partida.
   - `Results` sin estado o ruta inexistente (`not-found`): `router.replace({ name: 'home' })`. Impide crear loops en el historial al intentar retroceder a URLs inválidas.
   - Demos DEV iniciales (`isDevDemo`): `router.replace({ name: targetName })` para que la URL refledo directo de la demo no altere la entrada inicial de historial.

---

## Auditoría de la Frontera del Fallback SPA en Producción

- **Routing de cliente**: Implementado con Vue Router (`vue-router@^4`).
- **Back / Forward**: Implementado y verificado.
- **Deep links**: Verificados bajo el servidor de desarrollo de Vite y ejecuciones E2E de Playwright.
- **Backend API (`@rautfall/api`)**: El servidor Fastify expone exclusivamente los endpoints del contrato API (`/api/*`, `/health`). No sirve archivos estáticos del frontend ni gestiona la SPA en esta fase.
- **Fallback SPA del despliegue final**: Cuando se integre la SPA con el servidor de producción (vía `@fastify/static` o servidor de producción final), la infraestructura requerirá el registro del fallback SPA a `index.html` sin alterar las rutas `/api/*` ni `/health`. Se ha registrado explícitamente en [`docs/rautfall.md`](file:///home/manuel/dev/rautfall/docs/rautfall.md).

---

## Pruebas Añadidas y Resultados

1. **Pruebas Unitarias de Integración (Vitest - `apps/web/src/App.test.ts`)**:
   - `la pantalla renderizada y la URL derivan directamente del router y no pueden divergir`: Verifica la coincidencia exacta entre `router.currentRoute.value.name` y los testids renderizados en el DOM (`mode-selector`, `settings-screen`, `ranking-screen`).
   - `acceder directamente a /results sin resultado activo redirige deterministamente a home`: Confirma la guarda de navegación de resultados expirados.

2. **Pruebas E2E (Playwright - `apps/web/e2e/navigation-flow.spec.ts`)**:
   - Secuencia real de navegación con Back/Forward: `Menu -> Settings -> Ranking -> Back -> Settings -> Back -> Menu -> Forward -> Settings`.
   - Secuencia Back/Forward en juego: `Menu -> Training -> Back -> Menu -> Forward -> Training` (verifica 1 canvas de Phaser, `session-status` en `running`, 0 `pageerror` y 0 errores de consola).
   - Deep links: `/settings`, `/ranking`, `/history`, `/results` (redirige a `/`), `/ruta-inexistente` (redirige a `/`).
   - Reload: `page.goto('/settings') -> page.reload()`.

---

## Verificación de Validaciones Raíz

- `pnpm test`: **57 test files pasados / 958 tests pasados** (0 fallos).
- `pnpm lint`: **0 errores, 0 warnings** (ESLint impecable).
- `pnpm typecheck`: **6 de 6 paquetes validados sin errores de TypeScript**.
- `pnpm build`: **Bundle de producción de Vite compilado con éxito**.
- `pnpm --filter @rautfall/web test:e2e`: **19 suites E2E en Playwright pasadas al 100%**.
- `git diff --check`: **Sin errores de espacios en blanco ni conflictos**.

---

## Confirmación de Alcance Excluido

- No se han añadido dependencias adicionales salvo `vue-router@^4.5.0`.
- No se han creado abstracciones o vistas ornamentales innecesarias.
- No se ha modificado la lógica de dominio de `game-engine`, `battle-engine` ni `game-config`.
- No se han dejado scripts temporales ni `console.log` residuales.
