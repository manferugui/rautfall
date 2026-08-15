# Task 0037 — Navegación web: URL sincronizada y soporte real de Back/Forward

## Contexto

Actualmente la navegación interna de Rautfall cambia de pantalla dentro de la SPA, pero la URL del navegador no representa de forma consistente la vista activa.

Esto provoca que:
- el botón **Atrás** del navegador no recorra correctamente las pantallas visitadas;
- el botón **Adelante** tampoco pueda restaurarlas;
- la URL no indique dónde se encuentra el usuario;
- determinadas vistas no puedan abrirse mediante enlace directo (deep links);
- una recarga (F5) pueda perder el contexto de navegación;
- los E2E de navegación validen únicamente cambios internos de estado y no navegación real del navegador.

## Objetivo

Introducir navegación web real y coherente para las pantallas de Rautfall mediante **Vue Router** (`vue-router@^4`), sincronizando la URL con la vista renderizada y habilitando el uso natural del historial del navegador.

```text
URL
 ↕
Router (Vue Router)
 ↕
Pantalla Vue
```

Requisitos fundamentales:
- La URL cambia al navegar.
- **Back** funciona devolviendo a la pantalla anterior real.
- **Forward** funciona recuperando la pantalla siguiente real.
- Refrescar (`F5`) mantiene una ruta válida.
- Las rutas directas (deep links) tienen comportamiento definido.
- Salir de una partida destruye correctamente Phaser, listeners y timers (`game.destroy(true)`).
- Volver a una partida crea una única sesión limpia de Phaser.
- No se introduce ninguna dependencia del router en los motores de juego (`game-engine`, `battle-engine`, `game-config`).

## Mapa de Rutas Nombradas

Todas las rutas utilizan un `name` explícito como identificador interno estable:

| Path | Name | Vista / Componente | Deep link | Estado previo | Fallback | DEV-only |
|---|---|---|---|---|---|---|
| `/` | `home` | `ModeSelector` | Sí | No | — | No |
| `/training` | `training` | Game Chassis (1P) | Sí | No | Nueva sesión 1P | No |
| `/battle` | `battle` | Game Chassis (2P) | Sí | No | Nueva sesión 2P vs Bot | No |
| `/settings` | `settings` | `SettingsScreen` | Sí | No | — | No |
| `/history` | `history` | `HistoryScreen` | Sí | No | — | No |
| `/ranking` | `ranking` | `RankingScreen` | Sí | No | — | No |
| `/results` | `results` | `ResultsModal` | Condicional | Sí (`gameResult`) | `{ name: 'home' }` (replace) | No |
| `/dev-tools` | `dev-tools` | `DevLauncherScreen` | Solo DEV | No | `{ name: 'home' }` en PROD | Sí |
| `/sfx-lab` | `sfx-lab` | `SfxLab` | Solo DEV | No | `{ name: 'home' }` en PROD | Sí |
| `/:pathMatch(.*)*` | `not-found` | Catch-all redirect | Sí | No | `{ name: 'home' }` (replace) | No |

## Política de Resultados (`/results`) y Navegación

- La ruta `/results` representa la pantalla modal de resultados tras finalizar una partida.
- Solo es accesible cuando existe en memoria una instantánea de resultado activa (`gameResult`/`pendingMatchResult`).
- Si se accede directamente a `/results` o tras F5 sin datos activos, la guarda de navegación redirige inmediatamente a `{ name: 'home' }` usando `replace`.
- Al confirmar el resultado e ir a Ranking, se utiliza `router.replace({ name: 'ranking' })` para no dejar la entrada postpartida caducada en el historial.

## Dependencias

- Añadida únicamente `vue-router@^4` a `apps/web/package.json`.
- `pnpm-lock.yaml` actualizado mediante `pnpm`.

## Criterios de Aceptación

1. Navegar por la UI cambia la URL del navegador.
2. `Back` vuelve a la pantalla anterior real.
3. `Forward` recupera la pantalla siguiente real.
4. Refrescar (`F5`) en rutas estables conserva la ruta activa.
5. Deep links estables (`/settings`, `/ranking`, `/history`, `/training`, `/battle`) funcionan correctamente.
6. Rutas inexistentes redirigen a `/`.
7. Salir de `/training` o `/battle` destruye la sesión Phaser.
8. Volver vía `Forward` a `/training` o `/battle` crea exactamente una sesión limpia sin duplicar Canvas ni generar `pageerror`.
9. Demos DEV y query strings (`?battle-demo=1`, etc.) se conservan y funcionan.
10. La reconciliación sonoras (BGM) se sincroniza con el cambio de ruta.
11. `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm --filter @rautfall/web test:e2e` pasan correctamente.
