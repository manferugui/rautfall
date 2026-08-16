# Rautfall

*Build. Disrupt. Survive.*

Rautfall es un juego web de puzle por bloques competitivo contra una inteligencia artificial heurística. El jugador completa líneas y obtiene ataques tácticos que puede almacenar y utilizar para interferir en el tablero del rival.

## Arquitectura y tecnologías

- **Cliente SPA:** Vue 3, Vite y Phaser 3 para la presentación y renderizado visual.
- **Backend API:** Servidor HTTP Fastify con Drizzle ORM y PostgreSQL.
- **Despliegue Cloud:** Vercel (alojamiento SPA y Serverless Functions vía `api/[...path].ts`) y Neon PostgreSQL (base de datos serverless).
- **Integración Continua:** Workflows de GitHub Actions para CI (quality y E2E) y CD (migraciones y despliegue a producción).
- **Motor de Juego:** Dominio headless determinista desacoplado del renderizador y de la interfaz de usuario.

## Requisitos

- Node.js 22.x (gestionado mediante NVM, fijado en `.nvmrc` y `package.json`)
- pnpm 10.34.5 (gestionado mediante Corepack y `packageManager`)

## Instalación

```bash
pnpm install
```

## Comandos principales

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia el servidor de desarrollo paralelo (`apps/web` y `apps/api`) |
| `pnpm test` | Ejecuta las pruebas unitarias y de integración con Vitest |
| `pnpm lint` | Ejecuta el análisis estático de código con ESLint |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm typecheck` | Verifica tipos en todos los paquetes del monorepo |
| `pnpm build` | Compila los contratos y la aplicación web para producción |
| `pnpm test:e2e` | Ejecuta la suite de pruebas E2E con Playwright |

## Estructura del workspace

```
apps/
  web/                  # Aplicación SPA cliente (Vue 3 + Vite + Phaser 3)
  api/                  # Servidor HTTP Fastify con Drizzle ORM
api/                    # Adaptador Vercel Serverless Function (api/[...path].ts)
packages/
  battle-engine/        # Orquestador determinista de sesiones de batalla
  contracts/            # Esquemas de validación y tipos compartidos (TypeBox)
  game-config/          # Configuración estricta del juego
  game-engine/          # Motor de puzle determinista (headless)
```

Los paquetes internos se importan bajo el ámbito `@rautfall/*` mediante sus nombres públicos:

- `@rautfall/battle-engine`
- `@rautfall/contracts`
- `@rautfall/game-config`
- `@rautfall/game-engine`

## Licencia

Privado — Trabajo de Fin de Máster.
