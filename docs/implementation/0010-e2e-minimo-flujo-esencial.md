# 0010 — E2E mínimo del flujo esencial

## Resumen

Esta tarea implementa un flujo E2E mínimo con Playwright que cubre la integración real entre Vue, Phaser y el DOM en un navegador real (Chromium), verificando carga de la aplicación, estado inicial `running`, presencia de los paneles reales y simulados, pausa, reanudación y reinicio mediante los controles reales de la interfaz.

## Archivos creados y modificados

### Archivos nuevos
- `apps/web/e2e/essential-flow.spec.ts` - Test E2E que cubre el flujo esencial
- `apps/web/playwright.config.ts` - Configuración de Playwright

### Archivos modificados
- `apps/web/package.json` - Añadida dependencia de desarrollo `@playwright/test` y scripts E2E
- `package.json` (raíz) - Añadidos scripts delegados para E2E
- `apps/web/src/App.vue` - Añadidos selectores contractuales `data-testid="session-status"`, `data-testid="session-step"` y `data-testid="pause-overlay"`
- `apps/web/src/components/GameCanvas.vue` - Añadido selector `data-testid="game-canvas"`
- `apps/web/src/components/NextPiecesPreview.vue` - Añadido selector `data-testid="next-pieces-preview"`
- `.gitignore` - Añadidas entradas para directorios de salida de Playwright
- `pnpm-lock.yaml` - Actualizado con nuevas dependencias

## Dependencia y versión resuelta

- `@playwright/test` versión `^1.62.0` añadida como dependencia de desarrollo en `apps/web`

## Configuración Playwright

- `testDir: './e2e'` - Directorio de tests E2E
- Chromium como único proyecto usando `devices['Desktop Chrome']`
- `baseURL` y `webServer` en puerto 5174
- Comando Vite con `--port 5174 --strictPort`
- `reuseExistingServer` deshabilitado en CI, habilitado localmente
- `retries: process.env.CI ? 1 : 0` - Sin reintentos localmente, 1 reintento en CI
- `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'off'`
- Timeouts y reporter configurados según especificación

## Scripts

### En `apps/web/package.json`:
- `test:e2e`: `playwright test`
- `test:e2e:ui`: `playwright test --ui`
- `playwright:install`: `playwright install chromium`

### En `package.json` raíz:
- `test:e2e`: `pnpm --filter @rautfall/web test:e2e`
- `playwright:install`: `pnpm --filter @rautfall/web playwright:install`

## Selectores añadidos y reutilizados

### Selectores contractuales nuevos:
- `data-testid="game-canvas"` - Contenedor del canvas de Phaser
- `data-testid="session-status"` - Estado de sesión (running/paused/gameOver)
- `data-testid="session-step"` - Valor numérico del contador lógico de pasos
- `data-testid="pause-overlay"` - Overlay de pausa visible cuando el juego está pausado
- `data-testid="next-pieces-preview"` - Contenedor completo del preview de próximas piezas

### Selectores reutilizados:
- `data-testid="pause-toggle"` - Botón de pausa/reanudación
- `data-testid="reset-button"` - Botón de reinicio
- `data-testid="own-board-column"` - Columna del tablero propio
- `data-testid="tactical-column"` - Columna táctica
- `data-testid="opponent-column"` - Columna del monitor rival
- `data-testid="simulated-energy"` - Bloque de energía simulada
- `data-testid="simulated-cartridge"` - Bloque de cartucho simulado
- `data-testid="simulated-residues"` - Bloque de Residuos simulado

## Estructura del flujo

El test E2E implementa un único `test()` dividido en pasos nombrados con `test.step()`:

1. **Carga de la aplicación y tablero real de Phaser** - Verifica que la aplicación carga y el canvas de Phaser es visible
2. **Estado inicial running, próximas piezas y paneles** - Verifica estado `running`, presencia de las tres próximas piezas, monitor rival simulado y bloques de combate simulado
3. **Pausa mediante el botón real** - Pausa el juego y verifica estado `paused` y overlay de pausa visible
4. **Reanudación mediante el mismo botón** - Reanuda el juego y verifica estado `running` y ausencia del overlay
5. **Reinicio mediante el botón real, verificado de forma robusta** - Reinicia y verifica que el estado vuelve a `running`, el overlay desaparece, el contador `step` disminuye respecto al valor antes del reinicio, y las próximas piezas siguen presentes

## Criterio de reinicio

El reinicio se verifica de forma robusta:
- Se lee `session-step` antes del reinicio
- Se asegura que haya avanzado lo suficiente mediante una condición observable
- Se pulsa Reiniciar
- Se espera que el valor posterior sea menor que el anterior usando `expect.poll`
- Se confirma que el estado es `running`, el overlay de pausa no está visible, el canvas es visible y las próximas piezas están presentes

## Captura de errores

Se registran desde antes de `page.goto()`:
- Mensajes de consola de tipo `error`
- Eventos `pageerror`

Al final del flujo se afirma que no se capturaron errores.

## Estrategia de estabilidad

El E2E no depende de:
- Pieza concreta
- Secuencia exacta
- Valores exactos de `step`
- Valores exactos de `elapsedMs`
- Velocidad del equipo
- Contenido interno del canvas
- Coordenadas del ratón
- Teclas
- Píxeles
- Screenshots como criterio principal

## Comandos ejecutados

- `pnpm playwright:install` - Instaló Chromium
- `pnpm test` - 321 tests pasaron
- `pnpm test:e2e` - 1 test E2E pasó
- `pnpm lint` - Sin errores
- `pnpm typecheck` - Sin errores
- `pnpm build` - Compilación exitosa
- `git diff --check` - Sin errores de espacio en blanco

## Número final de tests

- Tests unitarios (Vitest): 321
- Tests E2E (Playwright): 1

## Instalación de Chromium

Chromium se instaló correctamente como parte del proceso de instalación de Playwright.

## Limitaciones del entorno

No se detectaron limitaciones del entorno que afecten la ejecución de los tests E2E.

## Deuda técnica

La exclusión deliberada de `playwright.config.ts` y `e2e/**` de `pnpm typecheck` significa que estos archivos no se verifican con TypeScript como parte del pipeline de tipos de la aplicación web.

## Validación manual pendiente

No aplica - todos los pasos se pudieron validar automáticamente.

## Confirmación de ausencia de cambios en dominio

No se modificaron los paquetes `packages/game-engine` ni `packages/game-config`.

## Confirmación de ausencia de commits

No se hicieron commits durante la implementación.
