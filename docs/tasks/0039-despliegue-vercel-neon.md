# Task 0039 — Despliegue en Vercel + Neon

## Contexto

Rautfall ha evolucionado su estrategia de despliegue cloud para el TFM. La infraestructura de producción utilizará la plataforma PaaS **Vercel** para hospedar la SPA Vue 3 / Vite y el backend Fastify 5 (vía Serverless Functions / Fluid Compute), combinada con **Neon PostgreSQL** como base de datos serverless administrada.

Azure Container Apps deja de ser la opción principal y pasa a quedar documentada como alternativa evaluada y descartada para el TFM por coste y complejidad operativa desproporcionados respecto al tráfico esperado.

## Objetivo

Configurar el proyecto y la infraestructura de código para posibilitar el despliegue automático, seguro y determinista de Rautfall en Vercel + Neon bajo un único dominio HTTPS, manteniendo una separación clara entre el runtime de producción y las migraciones de esquema.

La estrategia de planes se estructura en:
* **Desarrollo:** Vercel Hobby + Neon Free
* **Entrega/evaluación:** Vercel Pro + Neon

```text
GitHub Push (main)
 ├── Workflow: CI (ci.yml - quality & e2e)
 └── Workflow: CD (cd.yml)
      ├── Job 1: db-migrate (Neon Direct URL - pnpm db:migrate)
      └── Job 2: vercel-deploy (Vercel Production - vercel deploy --prod)
```

## Requisitos de Configuración

1. **Adaptador Serverless de Fastify (`api/index.ts`)**:
   * Punto de entrada en la raíz del monorepo (`api/index.ts`).
   * Reutiliza `buildApp()` desde `apps/api/src/app.ts` sin alterar la lógica de negocio ni las rutas.
   * Instancia Fastify en *module scope* para aprovechar el caché de ejecuciones *warm*.
   * Delega las peticiones HTTP a la instancia mediante `await fastify.ready()` y `fastify.server.emit('request', req, res)`.

2. **Configuración de Vercel (`vercel.json`)**:
   * Archivo de configuración en la raíz del workspace.
   * Define el comando de compilación del monorepo (`pnpm --filter @rautfall/web build`) y el directorio de salida (`apps/web/dist`).
   * Configura rewrites para enrutar `/api/(.*)` hacia `/api/index.ts` y redirigir el resto de rutas a la SPA (`/index.html`).

3. **Cadenas de Conexión Neon**:
   * Runtime de producción (`DATABASE_URL`): Cadena de conexión **Pooled** de Neon (PgBouncer).
   * Migraciones de esquema (`NEON_DIRECT_URL`): Cadena de conexión **Directa** de Neon.
   * Sin migraciones en cold start ni puertos codificados en duro en el código.

4. **Pipeline de CD en GitHub Actions (`.github/workflows/cd.yml`)**:
   * Ejecuta secuencialmente las migraciones con `NEON_DIRECT_URL` y posteriormente el despliegue en Vercel.
   * **Autodeploy de producción desde `main` deshabilitado en Vercel**: Se debe desactivar el auto-deploy automático de Vercel por Git para evitar carreras donde Vercel despliegue código antes de que GitHub Actions complete las migraciones de base de datos.
   * Acotado a ejecuciones seguras mediante secretos (`NEON_DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).

## Restricciones

* No modificar el motor del juego, Phaser, bot ni Playwright.
* No modificar el esquema de PostgreSQL.
* No modificar `apps/api/src/config/env.ts` ni `apps/api/src/server.ts`.
* No realizar commits ni pushes.

## Criterios de Aceptación

1. Existen `api/index.ts`, `vercel.json` y `.github/workflows/cd.yml` ajustados a la especificación.
2. `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build` finalizan con código de salida 0.
3. El backend Fastify se ejecuta correctamente a través de Serverless Functions (`/api/health`, `/api/matches`, `/api/ranking`) y la SPA Vue/Vite resuelve el fallback de rutas profundas (`/training`, `/battle`, `/history`, etc.) a `index.html`.
4. El autodeploy automático de producción por Git en Vercel queda explícitamente documentado como desactivado a favor del flujo controlado por GitHub Actions.
5. Se aclara con precisión que Vercel Pro no elimina de forma intrínseca los *cold starts* serverless, aunque mitiga sus efectos colaterales mediante mayores recursos e intervalos de ejecución.
6. La documentación oficial (`docs/rautfall.md` y `docs/project-status.md`) refleja la nueva estrategia Vercel + Neon.

