# Informe de Implementación — Tarea 0039: Despliegue en Vercel + Neon

## Resumen

Se ha diseñado e implementado la arquitectura de despliegue para **Rautfall** basada en **Vercel** (para la SPA Vue 3 / Vite y las Serverless Functions de Fastify 5) y **Neon PostgreSQL** (base de datos serverless administrada).

Esta decisión sustituye a Azure Container Apps como opción principal, la cual queda documentada como alternativa evaluada y descartada para el TFM por complejidad operativa y costes desproporcionados.

---

## Archivos Creados y Modificados

### Creados
- [`api/[...path].ts`](file:///home/manuel/dev/rautfall/api/%5B...path%5D.ts): Adaptador Serverless oficial para Fastify 5 en Vercel (catch-all route nativo), instanciando `buildApp()` en module scope y emitiendo peticiones mediante `fastify.server.emit('request', req, res)`.
- [`api/tsconfig.json`](file:///home/manuel/dev/rautfall/api/tsconfig.json): Configuración de compilador TypeScript específica para la carpeta Serverless `api/`, aplicando `moduleResolution: Bundler` y `module: ESNext`.
- [`vercel.json`](file:///home/manuel/dev/rautfall/vercel.json): Configuración del monorepo en Vercel definiendo `functions` para `api/[...path].ts`, compilación de `apps/web/dist` y fallback SPA a `/index.html`.
- [`.github/workflows/cd.yml`](file:///home/manuel/dev/rautfall/.github/workflows/cd.yml): Workflow de Entrega Continua en GitHub Actions para ejecutar migraciones en Neon (`NEON_DIRECT_URL`) y desplegar en Vercel de forma secuencial.
- [`docs/tasks/0039-despliegue-vercel-neon.md`](file:///home/manuel/dev/rautfall/docs/tasks/0039-despliegue-vercel-neon.md): Especificación inmutable de la Tarea 0039.
- [`docs/implementation/0039-despliegue-vercel-neon.md`](file:///home/manuel/dev/rautfall/docs/implementation/0039-despliegue-vercel-neon.md): Este informe técnico de implementación.

### Modificados
- [`docs/project-status.md`](file:///home/manuel/dev/rautfall/docs/project-status.md): Actualizada la tabla de tareas finalizadas registrando la Tarea 0039 y la arquitectura de despliegue en Vercel + Neon.
- [`docs/rautfall.md`](file:///home/manuel/dev/rautfall/docs/rautfall.md): Actualizada la sección de arquitectura de infraestructura y despliegue documentando Vercel + Neon y la justificación de descarte de Azure Container Apps.

---

## Decisión Arquitectónica y Diseño Técnico

### 1. Fastify 5 en Serverless (`api/[...path].ts`)
* Se reutiliza la función `buildApp()` de `apps/api/src/app.ts` sin alterar una sola línea de código del backend existente.
* `apps/api/src/server.ts` se mantiene 100% intacto para desarrollo local y pruebas convencionales con `fastify.listen({ port, host })`.
* La instancia de Fastify se inicializa en el ámbito del módulo (*module scope*), reutilizando el caché de peticiones en ejecuciones *warm* y acelerando la respuesta del backend.

### 2. Neon PostgreSQL (Separación de Conexiones)
* **Runtime (`DATABASE_URL`)**: Cadena de conexión **Pooled** (PgBouncer) configurada en el panel de Vercel. Gestiona eficientemente los picos de peticiones concurrentes sin agotar el límite de conexiones de PostgreSQL.
* **Migraciones (`NEON_DIRECT_URL`)**: Cadena de conexión **Directa** configurada en los Secretos de GitHub. Permite a `drizzle-kit` ejecutar migraciones de DDL sin restricciones de transacciones ni sentencias preparadas.
* **Cero migraciones en Cold Start**: Las migraciones se ejecutan de forma controlada exclusivamente en la pipeline de CD de GitHub Actions.

### 3. Pipeline de CD Determinista (`.github/workflows/cd.yml`)
* Garantiza el orden de despliegue: `CI verde → db:migrate en Neon → vercel deploy --prod`.
* **Deshabilitación del Autodeploy por Git en Vercel**: Es un requisito imprescindible desactivar el despliegue automático por Git en las configuraciones del proyecto Vercel para la rama `main`. De lo contrario, Vercel dispararía un despliegue en paralelo con el push a GitHub, generando una carrera donde se publicaría código antes de que GitHub Actions complete las migraciones de base de datos (`NEON_DIRECT_URL`).
* Evita carreras de despliegue mediante comprobaciones condicionales y ejecución secuencial mediante dependencias entre jobs (`needs: migrate`).

### 4. Precisión sobre Cold Starts (Hobby vs. Pro)
* Pasar de Vercel Hobby a Vercel Pro **no elimina intrínsecamente los *cold starts*** (latencia de inicialización del contenedor Node.js tras inactividad), ya que son una propiedad estructural de la arquitectura Serverless.
* Vercel Pro amplía los límites de cómputo, concurrencia y timeouts de ejecución (de 10s a 60s+), y permite utilizar mecanismos adicionales (como tareas cron de *keep-alive* o *warm pools*).
* En Rautfall, como la lógica de juego, física y renderizado de Phaser se ejecutan 100% deterministas en el cliente (navegador), un *cold start* de la API sólo afecta puntualmente a la carga inicial de ránkings o historial, jamás al desarrollo en vivo de la partida.

---

## Resultados de Validación Exigidos

Todas las comprobaciones de calidad han finalizado con éxito desde la raíz del monorepo:

1. `pnpm typecheck`: **Éxito (Código 0)**. TypeScript (`tsc` y `vue-tsc`) validó los 6 paquetes del workspace sin errores.
2. `pnpm lint`: **Éxito (Código 0)**. ESLint validó todos los archivos TypeScript y Vue sin errores ni avisos.
3. `pnpm test`: **Éxito (Código 0)**. 57 test files pasados / 961 tests unitarios e integración pasados.
4. `pnpm build`: **Éxito (Código 0)**. SPA compilada en `apps/web/dist` con empaquetado optimizado de Vite.
5. **Verificación de Enrutado Vercel (`vercel.json`)**:
   * Peticiones API `/api/health`, `/api/matches`, `/api/ranking` son capturadas nativamente por la ruta catch-all del sistema de archivos `api/[...path].ts`, la cual inicializa Fastify y atiende la ruta de forma nativa como Serverless Function.
   * Rutas profundas de la SPA (`/training`, `/battle`, `/settings`, `/history`, `/ranking`, `/results`) son capturadas por `/((?!api/).*)` y derivadas a `/index.html`, donde Vue Router asume la navegación cliente sin producir errores 404.


---

## Confirmación de Alcance Excluido

- No se modificó la lógica de juego ni el motor determinista.
- No se alteró Phaser, bot ni Playwright.
- No se modificó el esquema de base de datos de PostgreSQL.
- No se modificó `apps/api/src/config/env.ts` ni `apps/api/src/app.ts`.

---

## Registro de Incidencias de Despliegue en Vercel y Diagnóstico (En Validación)

Actualmente la Tarea 0039 se encuentra **en fase de validación de despliegue en producción**. A continuación se detalla el bloque de correcciones aplicadas y el diagnóstico actual en estricto orden cronológico:

### 1. Problema inicial de routing en Vercel
* **Síntomas**: Accesos directos o recarga (F5) en rutas de la SPA (ej. `/settings`) devolvían error `404 Not Found`. Peticiones a `/api/health` devolvían `404 Not Found`. El *Deployment Summary* de Vercel indicaba únicamente *Static Assets* y `0 Functions`.
* **Causa**: Vercel no estaba reconociendo la entrada Serverless bajo la estructura monorepo previa y las reglas de rewrite entraban en conflicto.

### 2. Corrección del enrutado y detección de Serverless Function
* **Acciones aplicadas**:
  * Se renombró el entrypoint Serverless de `api/index.ts` a `api/[...path].ts` para seguir la convención nativa catch-all de Vercel.
  * Se declaró explícitamente la función en `vercel.json` (`functions: { "api/[...path].ts": { memory: 1024, maxDuration: 10 } }`).
  * Se eliminó el rewrite explícito `/api/*`.
  * Se mantuvo la regla de fallback SPA en `vercel.json` (`{ "source": "/((?!api/).*)", "destination": "/index.html" }`).
* **Resultado**: Vercel pasó a detectar y compilar correctamente la Serverless Function en los despliegues.

### 3. Errores de compilación TypeScript en el build de Vercel
* **Síntomas**: El build en Vercel fallaba con errores `TS2835` (imports ESM sin extensión relativa `.js`) y errores secundarios `TS2305` relacionados con `@rautfall/contracts`.
* **Causa**: Vercel no encontraba un archivo `tsconfig.json` dedicado para la Serverless Function en `api/`, aplicando por defecto una resolución estricta `Node16`/`NodeNext`.
* **Acciones aplicadas**:
  * Se creó `api/tsconfig.json` configurando `module: ESNext` y `moduleResolution: Bundler`.
* **Resultado**: Los errores de compilación `TS2835` y `TS2305` desaparecieron por completo durante el build en Vercel.

### 4. Problema runtime de resoluciones ESM relativas
* **Síntomas**: El build de Vercel finalizaba correctamente, pero `/api/health` devolvía error HTTP 500 en producción. Los logs de ejecución mostraban `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/apps/api/src/app' imported from /var/task/api/[...path].js`.
* **Causa**: Node.js en tiempo de ejecución (ESM nativo) requiere extensiones explícitas (`.js` / `/index.js`) en las rutas relativas importadas.
* **Acciones aplicadas**:
  * Se añadieron extensiones `.js` y `/index.js` a todas las importaciones y reexportaciones relativas del grafo runtime de la API (11 archivos modificados: `api/[...path].ts`, `packages/contracts/src/index.ts`, `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/db/index.ts`, `apps/api/src/db/migrate.ts`, `apps/api/src/db/cli-migrate.ts`, `apps/api/src/repositories/matches-repository.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/routes/matches.ts` y `apps/api/src/routes/ranking.ts`).
* **Validación local**: 57 archivos de prueba pasados (961 tests), `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizados con éxito (código 0).

### 5. Problema runtime de empaquetado en `@rautfall/contracts` (Diagnóstico y Solución Aplicada)
* **Síntomas**: El error previo se resolvió, pero surgió un nuevo error runtime HTTP 500 al invocar `/api/health`:
  `ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/apps/api/node_modules/@rautfall/contracts/src/index.ts' imported from /var/task/apps/api/src/routes/health.js`.
* **Causa diagnosticada**:
  * `packages/contracts/package.json` exponía su runtime mediante `"import": "./src/index.ts"`.
  * El paquete `@rautfall/contracts` no generaba un directorio de salida compilado `dist/`.
  * En tiempo de ejecución en Vercel, Node.js intentaba resolver y ejecutar código TypeScript fuente desde `node_modules`, lo cual falla nativamente en Node ESM.
* **Solución aplicada e integrada**:
  * Configurado `packages/contracts/tsconfig.json` con `outDir: "./dist"`, `noEmit: false`, `declaration: true`, `declarationMap: true` y `exclude: ["src/**/*.test.ts"]` para omitir artefactos de prueba en la distribución.
  * Actualizado `packages/contracts/package.json` con script `"build": "tsc"`, `"main": "./dist/index.js"`, `"module": "./dist/index.js"`, `"types": "./dist/index.d.ts"` y `"exports"` resolviendo `"import"` a `./dist/index.js` y `"types"` a `./dist/index.d.ts`.
  * Actualizado `vercel.json` configurando `buildCommand`: `"pnpm --filter @rautfall/contracts build && pnpm --filter @rautfall/web build"`.
* **Estado de la solución**: Implementada y validada localmente al 100% (verificada generación limpia de `dist/` sin archivos `*.test.*`). Pendiente únicamente de `git commit`, `git push` y despliegue/validación final en Vercel.


