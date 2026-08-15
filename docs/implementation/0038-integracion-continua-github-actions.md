# Informe de Implementación — Tarea 0038: Integración Continua con GitHub Actions

## Resumen

Se ha configurado e implementado el workflow de Integración Continua (CI) para el repositorio Rautfall mediante **GitHub Actions**.

La solución automatiza la validación de código en cada `push` a la rama `main` y en cada `pull_request` dirigido a `main`, sin introducir despliegue continuo (CD), credenciales reales, secretos, bases de datos externas ni herramientas de infraestructura adicionales.

El workflow se compone de dos jobs independientes que se ejecutan en paralelo sobre runners `ubuntu-24.04`:
1. `quality`: Verifica linter, comprobación de tipos de TypeScript en todos los paquetes del monorepo, suite completa de tests unitarios e integración con PostgreSQL nativo (vía `@testcontainers/postgresql` utilizando el Demonio de Docker preinstalado en el runner) y compilación de producción de la SPA.
2. `e2e`: Dispone de un servicio nativo de PostgreSQL (`postgres:16-alpine`), ejecuta las migraciones de base de datos (`pnpm --filter @rautfall/api db:migrate`), arranca de forma gestionada tanto la API Fastify como la SPA Vite en bucle local `127.0.0.1`, e instala únicamente el navegador Chromium para ejecutar la suite completa de 19 pruebas End-to-End de Playwright.

---

## Archivos Creados y Modificados

### Creados
- [`.github/workflows/ci.yml`](file:///home/manuel/dev/rautfall/.github/workflows/ci.yml): Definición del workflow de CI de GitHub Actions con los jobs `quality` y `e2e`.
- [`docs/tasks/0038-integracion-continua-github-actions.md`](file:///home/manuel/dev/rautfall/docs/tasks/0038-integracion-continua-github-actions.md): Especificación inmutable de la tarea 0038.
- [`docs/implementation/0038-integracion-continua-github-actions.md`](file:///home/manuel/dev/rautfall/docs/implementation/0038-integracion-continua-github-actions.md): Este informe técnico de implementación.

### Modificados
- [`apps/web/playwright.config.ts`](file:///home/manuel/dev/rautfall/apps/web/playwright.config.ts): Configurado array de `webServer` para arrancar la API Fastify (puerto 3000 con `/api/health`) y la Web SPA (puerto 5173 con `VITE_API_BASE_URL=http://127.0.0.1:3000`).
- [`apps/web/e2e/battle-demo.spec.ts`](file:///home/manuel/dev/rautfall/apps/web/e2e/battle-demo.spec.ts): Eliminada la condición absoluta frágil (`battleStep < 10`) tras reset e implementada aserción de discontinuidad relativa respecto al `battleStep` pre-reset.
- [`docs/project-status.md`](file:///home/manuel/dev/rautfall/docs/project-status.md): Actualizada la tabla de tareas finalizadas registrando la Tarea 0038.
- [`docs/rautfall.md`](file:///home/manuel/dev/rautfall/docs/rautfall.md): Actualizada la sección del stack y automatización documentando la arquitectura de CI con GitHub Actions.

---

## Especificación Final del Workflow (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

permissions:
  contents: read

jobs:
  quality:
    name: quality
    runs-on: ubuntu-24.04

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 10.34.5

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.22.3
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm lint

      - name: Run typecheck
        run: pnpm typecheck

      - name: Run tests
        run: pnpm test

      - name: Run build
        run: pnpm build

  e2e:
    name: e2e
    runs-on: ubuntu-24.04

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: rautfall
          POSTGRES_PASSWORD: rautfall
          POSTGRES_DB: rautfall
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 10.34.5

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22.22.3
          cache: pnpm
          cache-dependency-path: pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run database migrations
        run: pnpm --filter @rautfall/api db:migrate
        env:
          DATABASE_URL: postgres://rautfall:rautfall@127.0.0.1:5432/rautfall

      - name: Install Chromium and system dependencies
        run: pnpm --filter @rautfall/web exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgres://rautfall:rautfall@127.0.0.1:5432/rautfall

      - name: Upload Playwright artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-artifacts
          path: |
            apps/web/playwright-report/
            apps/web/test-results/
          if-no-files-found: ignore
          retention-days: 7
```

---

## Diagnóstico y Resolución de Incidencias Remotas en GitHub Actions

### Primera Incidencia: Comando de `webServer` en Monorepo
- **Problema**: Playwright fallaba con `Timed out waiting 60000ms from config.webServer`.
- **Causa raíz**: El comando previo `pnpm --filter @rautfall/web dev -- ...` ejecutaba el script `"dev"` del `package.json` raíz, propagando flags de Vite a `tsx` en `apps/api` y abortando el proceso.
- **Solución**: Invocación directa del ejecutable del workspace: `pnpm --filter @rautfall/web exec vite --host 127.0.0.1 --port 5173 --strictPort`.

### Segunda Incidencia: Dependencia Implícita del Backend API y PostgreSQL
- **Problema**: Pruebas como `navigation-flow.spec.ts` fallaban con `net::ERR_CONNECTION_REFUSED` al intentar conectar con `http://localhost:3000` en pantallas de Ranking e Historial.
- **Causa raíz**: En el runner del job `e2e`, únicamente se ejecutaba Vite en 5173. La SPA requiere la API Fastify (puerto 3000) y la tabla `matches` en PostgreSQL para funcionar sin errores de red.
- **Solución**:
  1. Configuración de un servicio PostgreSQL efímero (`postgres:16-alpine`) exclusivo para el job `e2e` en `.github/workflows/ci.yml`.
  2. Ejecución previa de las migraciones de base de datos (`pnpm --filter @rautfall/api db:migrate`).
  3. Configuración de un array de dos `webServer` en `apps/web/playwright.config.ts`: API Fastify (`http://127.0.0.1:3000/api/health`) y Web Vite (`http://127.0.0.1:5173`).
  4. Uso explícito de `127.0.0.1` en PostgreSQL, Fastify, Vite y `VITE_API_BASE_URL` para evitar ambigüedades de resolución DNS/IPv6.

### Tercera Incidencia: Ajuste Fino de la Suite E2E (`battle-demo.spec.ts`)
- **Problemas**:
  1. En el Escenario 6 post-reset, `expect(stReset.planLength).toBe(0)` fallaba (recibiendo `5`) porque en el tick 1 post-reset la IA recalcula de inmediato un nuevo plan.
  2. En el Escenario 5, `expect.poll(...phase...).not.toBe('waitingForVisibility')` sufría timeout de 5000 ms en runners lentos si la pieza acababa de aparecer en spawn oculto ($y < 4$) y tardaba $> 5$ s en caer.
  3. En el Escenario 1, existía una aserción redundante sin timeout sobre `phase !== 'waitingForVisibility'` inmediatamente después de validar `minCellY >= 4`.
- **Solución Aplicada**:
  - **Escenario 1**: Eliminación del `expect.poll` sobre `phase` por redundancia tras $y \ge 4$.
  - **Escenario 5**: Sustitución de la consulta de fase por la espera explícita a visibilidad completa `expect.poll(minCellY, { timeout: 15000 }).toBeGreaterThanOrEqual(4)`.
  - **Escenario 6**: Eliminación de las aserciones efímeras de frame 0 (`planLength === 0`, `reactionStepsRemaining === 20`) y consolidación de las invariantes estables: `battleStep < preResetStep` (discontinuidad relativa), `pieceId === 1` (pieza inicial estable durante 3-5 s), `lastActionStep === null` y `lastAction === null`.

---

## Resultados de la Validación Local Final (`CI=1`)

Todas las comprobaciones obligatorias se han ejecutado desde la raíz del monorepo con resultados satisfactorios:

1. `CI=1 pnpm test:e2e`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: 19 pruebas End-to-End en 10 archivos pasadas a la primera sin retries ni flakiness (19 passed en 1.5m).

2. `pnpm lint`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: ESLint validó todos los archivos sin errores ni avisos.

3. `pnpm typecheck`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: TypeScript (`tsc` y `vue-tsc`) validó los 6 proyectos del workspace sin errores de tipos.

4. `pnpm test`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: 57 test files pasados / 958 tests unitarios e integración pasados (Testcontainers en `apps/api`).

5. `pnpm build`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: Bundle de producción compilado correctamente en `apps/web/dist`.

6. `git diff --check`:
   - Estado: **Éxito (Sin salida, Código 0)**.
   - Resultado: Sin problemas de formato ni marcas de conflicto.

---

## Distinción entre Validación Local y Validación Remota en GitHub Actions

- **Validación Local (Realizada y Completada con `CI=1`)**:
  Se ha verificado localmente con la variable `CI=1` (que desactiva la reutilización de servidores) que Playwright levanta de forma coordinada la API Fastify y la Web SPA, migra PostgreSQL y ejecuta las 19 pruebas E2E correctamente a la primera.
- **Validación Remota en GitHub Actions (Pendiente de Push)**:
  La reejecución real del workflow en los servidores de GitHub se activará automáticamente con el próximo `git push origin main`.

---

## Confirmación de Alcance Excluido

- No se han introducido secretos ni credenciales productivas ni Neon.
- No se han añadido servicios de PostgreSQL al job `quality`.
- No se han creado Dockerfiles ni archivos de docker-compose.
- No se ha implementado despliegue continuo (CD) ni infraestructura adicional.
- No se han realizado commits ni pushes.
