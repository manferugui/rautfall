# Task 0038 — Integración Continua con GitHub Actions

## Contexto

El repositorio Rautfall está publicado en GitHub en la rama principal (`main`). Para garantizar que todas las contribuciones y cambios mantengan la calidad del código, el correcto tipado de TypeScript, el paso de todas las pruebas unitarias y de integración (incluyendo PostgreSQL vía Testcontainers) y los flujos E2E con Playwright, se requiere automatizar estos análisis mediante GitHub Actions.

## Objetivo

Configurar una pipeline de Integración Continua (CI) reproducible y ligera en GitHub Actions que se ejecute en `push` a `main` y en `pull_request` dirigidos a `main`.

La CI constará de un único workflow `.github/workflows/ci.yml` compuesto por dos jobs paralelos e independientes:
1. `quality`: Validación de formato, linting, verificación de tipos TypeScript, tests unitarios/de integración (con Docker nativo de la máquina para Testcontainers) y compilación (`build`).
2. `e2e`: Ejecución de pruebas End-to-End con Playwright sobre Chromium en headless mode, con subida condicional de artefactos en caso de fallo.

```text
GitHub Push / PR (main)
 ├── Job: quality (Node 22.22.3 + pnpm 10.34.5 + Testcontainers)
 └── Job: e2e (Node 22.22.3 + pnpm 10.34.5 + Playwright Chromium)
```

## Requisitos de Configuración

- **Workflow Name**: `CI`
- **Ubicación**: `.github/workflows/ci.yml`
- **Triggers**:
  - `push` a `main`
  - `pull_request` a `main`
- **Permisos globales**: `contents: read`
- **Sistema Operativo Runner**: `ubuntu-24.04` (fijado explícitamente)

### Job 1: `quality`

Steps:
1. `actions/checkout@v6`
2. `pnpm/action-setup@v6` (versión pnpm `10.34.5`)
3. `actions/setup-node@v6` (`node-version: 22.22.3`, `cache: pnpm`, `cache-dependency-path: pnpm-lock.yaml`)
4. `pnpm install --frozen-lockfile`
5. `pnpm lint`
6. `pnpm typecheck`
7. `pnpm test` (Testcontainers utiliza el Demonio de Docker preinstalado en el runner)
8. `pnpm build`

### Job 2: `e2e`

Steps:
1. `actions/checkout@v6`
2. `pnpm/action-setup@v6` (versión pnpm `10.34.5`)
3. `actions/setup-node@v6` (`node-version: 22.22.3`, `cache: pnpm`, `cache-dependency-path: pnpm-lock.yaml`)
4. `pnpm install --frozen-lockfile`
5. `pnpm --filter @rautfall/web exec playwright install --with-deps chromium`
6. `pnpm test:e2e`
7. `actions/upload-artifact@v7` con `if: failure()`, `if-no-files-found: ignore`, `retention-days: 7`, guardando `apps/web/playwright-report/` y `apps/web/test-results/`.

## Restricciones

- No se añaden secretos ni variables de entorno externas.
- No se utilizan `services:` de PostgreSQL en GitHub Actions (Testcontainers levanta `postgres:16-alpine` directamente).
- No se añade despliegue continuo (CD), Dockerfile de producción ni infraestructura de despliegue.
- No se modifican `package.json` ni `playwright.config.ts`.
- No se realizan commits ni pushes durante el desarrollo local de la tarea.

## Criterios de Aceptación

1. Existe el archivo `.github/workflows/ci.yml` ajustado a las especificaciones.
2. Los triggers filtran los eventos `push` y `pull_request` para la rama `main`.
3. Los permisos globales están acotados a `contents: read`.
4. Ambos jobs (`quality` y `e2e`) especifican `ubuntu-24.04` como runner.
5. El job `quality` ejecuta secuencialmente `lint`, `typecheck`, `test` y `build`.
6. El job `e2e` instala únicamente Chromium con dependencias del SO y ejecuta `test:e2e`, subiendo artefactos solo si falla el job.
7. Las comprobaciones locales (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` y `git diff --check`) se completan sin errores.
