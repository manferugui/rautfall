# Informe de Implementación — Tarea 0039: Despliegue en Vercel + Neon

## Resumen

Se ha diseñado e implementado la arquitectura de despliegue para **Rautfall** basada en **Vercel** (para la SPA Vue 3 / Vite y las Serverless Functions de Fastify 5) y **Neon PostgreSQL** (base de datos serverless administrada).

Esta decisión sustituye a Azure Container Apps como opción principal, la cual queda documentada como alternativa evaluada y descartada para el TFM por complejidad operativa y costes desproporcionados.

---

## Archivos Creados y Modificados

### Creados
- [`api/[...path].ts`](file:///home/manuel/dev/rautfall/api/%5B...path%5D.ts): Adaptador Serverless oficial para Fastify 5 en Vercel (catch-all route nativo), instanciando `buildApp()` en module scope y emitiendo peticiones mediante `fastify.server.emit('request', req, res)`.
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
- No se realizaron commits ni pushes.
