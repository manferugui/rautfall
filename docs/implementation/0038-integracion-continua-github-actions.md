# Informe de Implementación — Tarea 0038: Integración Continua con GitHub Actions

## Resumen

Se ha configurado e implementado el workflow de Integración Continua (CI) para el repositorio Rautfall mediante **GitHub Actions**.

La solución automatiza la validación de código en cada `push` a la rama `main` y en cada `pull_request` dirigido a `main`, sin introducir despliegue continuo (CD), credenciales reales, secretos, bases de datos externas ni herramientas de infraestructura adicionales.

El workflow se compone de dos jobs independientes que se ejecutan en paralelo sobre runners `ubuntu-24.04`:
1. `quality`: Verifica linter, comprobación de tipos de TypeScript en todos los paquetes del monorepo, suite completa de tests unitarios e integración con PostgreSQL nativo (vía `@testcontainers/postgresql` utilizando el Demonio de Docker preinstalado en el runner) y compilación de producción de la SPA.
2. `e2e`: Instala únicamente el navegador Chromium y sus dependencias de sistema operativo en Linux, ejecutando la suite de pruebas End-to-End de Playwright y adjuntando artefactos de reporte y capturas en caso de fallo.

---

## Archivos Creados y Modificados

### Creados
- [`.github/workflows/ci.yml`](file:///home/manuel/dev/rautfall/.github/workflows/ci.yml): Definición del workflow de CI de GitHub Actions con los jobs `quality` y `e2e`.
- [`docs/tasks/0038-integracion-continua-github-actions.md`](file:///home/manuel/dev/rautfall/docs/tasks/0038-integracion-continua-github-actions.md): Especificación inmutable de la tarea 0038.
- [`docs/implementation/0038-integracion-continua-github-actions.md`](file:///home/manuel/dev/rautfall/docs/implementation/0038-integracion-continua-github-actions.md): Este informe técnico de implementación.

### Modificados
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

      - name: Install Chromium and system dependencies
        run: pnpm --filter @rautfall/web exec playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e

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

## Resultados de la Validación Local

Todas las comprobaciones obligatorias se han ejecutado desde la raíz del monorepo con resultados satisfactorios:

1. `pnpm lint`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: ESLint validó todos los archivos sin errores ni avisos.

2. `pnpm typecheck`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: TypeScript (`tsc` y `vue-tsc`) validó los 6 proyectos del workspace (`@rautfall/contracts`, `@rautfall/game-config`, `@rautfall/game-engine`, `@rautfall/battle-engine`, `@rautfall/api`, `@rautfall/web`) sin errores de tipos.

3. `pnpm test`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: 57 test files pasados / 958 tests unitarios e integración pasados. Los tests de `apps/api` instanciaron correctamente PostgreSQL en Docker nativo vía Testcontainers (`postgres:16-alpine`).

4. `pnpm build`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: Bundle de producción compilado correctamente en `apps/web/dist`.

5. `pnpm test:e2e`:
   - Estado: **Éxito (Código de salida 0)**.
   - Resultado: 19 pruebas End-to-End en 10 archivos pasadas en Playwright con Chromium (100% pasadas).

6. `git diff --check`:
   - Estado: **Éxito (Sin salida, Código 0)**.
   - Resultado: Sin problemas de espaciado, marcas de conflicto ni líneas finales incorrectas.

---

## Diagnóstico y Corrección de la Primera Ejecución Remota en GitHub Actions

En la primera ejecución real del workflow en GitHub Actions, el job `quality` finalizó con éxito al 100%, pero el job `e2e` falló por un error de timeout al arrancar el servidor web:
`Error: Timed out waiting 60000ms from config.webServer.`

### Causa Raíz
`apps/web/playwright.config.ts` utilizaba `command: pnpm --filter @rautfall/web dev -- --host 127.0.0.1 --port 5173 --strictPort`.
En pnpm v10 Workspaces, ejecutar `pnpm --filter @rautfall/web dev` desde la raíz invoca el script `"dev"` del `package.json` raíz (`"pnpm --parallel --filter @rautfall/web --filter @rautfall/api dev"`), el cual propaga los argumentos de Vite (`--host 127.0.0.1 --port 5173 --strictPort`) tanto a la web como a la API.
En `apps/api`, el script dev es `tsx watch src/server.ts`. `tsx` rechazaba los argumentos desconocidos de Vite y abortaba con error. En entorno local sin `CI=1`, Playwright reutilizaba el servidor previamente activo (`reuseExistingServer: true`), pero en GitHub Actions (`CI=1`), `reuseExistingServer: false` forzaba a Playwright a ejecutar el comando, que fallaba al arrancar.

### Corrección Aplicada
En [`apps/web/playwright.config.ts`](file:///home/manuel/dev/rautfall/apps/web/playwright.config.ts), se actualizó la propiedad `webServer.command` para invocar Vite directamente en el workspace de la web sin pasar por los scripts paralelos de la raíz:
```ts
command: `pnpm --filter @rautfall/web exec vite --host ${HOST} --port ${PORT} --strictPort`
```

### Validación Local con `CI=1`
Se detuvo cualquier servidor previo en el puerto 5173 y se ejecutó:
`CI=1 pnpm test:e2e`
Playwright arrancó su propio servidor web con `exec vite` en 178 ms, descubrió los 19 tests E2E en 10 archivos y los ejecutó con éxito al 100% (`19 passed (1.5m)`).

---

## Distinción entre Validación Local y Validación Remota en GitHub Actions

- **Validación Local (Realizada y Completada con `CI=1`)**:
  Se ha verificado localmente con la variable `CI=1` (que desactiva la reutilización de servidores) que Playwright levanta dinámicamente su servidor web Vite y ejecuta las 19 pruebas E2E correctamente. Todas las comprobaciones de calidad (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` y `git diff --check`) pasan sin errores.
- **Validación Remota en GitHub Actions (Pendiente de Push)**:
  La reejecución real del workflow en los servidores de GitHub se activará con el próximo `git push origin main`.

---

## Confirmación de Alcance Excluido

- No se han introducido secretos, variables de entorno productivas ni bases de datos Neon.
- No se han añadido servicios de PostgreSQL en la definición del workflow (`services:`).
- No se han creado Dockerfiles ni archivos de docker-compose.
- No se ha implementado despliegue continuo (CD) ni infraestructura adicional.
- No se han realizado commits ni pushes.
