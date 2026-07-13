# Rautfall

*Build. Disrupt. Survive.*

Rautfall es un juego web de puzle por bloques competitivo contra una inteligencia artificial heurística. El jugador completa líneas y obtiene ataques tácticos que puede almacenar y utilizar para interferir en el tablero del rival.

## Estado actual

**Prototipo técnico — tarea 0001 completada.**

Este repositorio contiene la base mínima, ejecutable y probada del monorepo. No contiene aún mecánicas de juego, tablero, piezas, Phaser, backend ni interfaz visual definitiva.

## Requisitos

- Node.js 22.22.3 (gestionado mediante NVM)
- pnpm 10.34.5 (gestionado mediante Corepack)

Ambas versiones están fijadas en `.nvmrc` y en `package.json`.

## Instalación

```bash
pnpm install
```

## Comandos raíz

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia el servidor de desarrollo de la aplicación web |
| `pnpm test` | Ejecuta todas las pruebas |
| `pnpm lint` | Ejecuta ESLint |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm typecheck` | Verifica tipos en todos los paquetes |
| `pnpm build` | Compila la aplicación web para producción |

El desarrollo, las pruebas y la verificación de tipos funcionan sin necesidad de compilar previamente los paquetes internos.

## Estructura del workspace

```
apps/
  web/                  # Aplicación Vue 3 + Vite (pantalla técnica)
packages/
  game-config/          # Configuración validada del juego (TypeBox)
  game-engine/          # Motor determinista (contrato mínimo)
```

Los paquetes internos se importan mediante sus nombres públicos:

- `@rautfall/game-config`
- `@rautfall/game-engine`

## Siguiente tarea

La tarea 0002 — *Motor de juego determinista* implementará las mecánicas fundamentales del juego, incluyendo la generación determinista de piezas y el PRNG `mulberry32`.

## Licencia

Privado — Trabajo de Fin de Máster.
