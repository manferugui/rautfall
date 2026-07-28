# 0010 — E2E mínimo del flujo esencial

## Estado

- **Proyecto:** Rautfall
- **Tarea:** 0010 — E2E mínimo del flujo esencial
- **Estado de la tarea:** lista para implementación tras revisión
- **Precedencia:** esta especificación define el alcance físico y técnico exacto de `0010`. Las decisiones globales del producto que no están recogidas aquí no deben implementarse. Ninguna funcionalidad prevista en [docs/rautfall.md](../rautfall.md) para la batalla, el bot, la energía real o los sabotajes reales pertenece automáticamente a esta tarea.
- **Documento:** esta especificación (`0010-e2e-minimo-flujo-esencial.md`) permanece inmutable durante y después de la implementación. No debe sobrescribirse ni reutilizarse como informe de implementación; ese informe se crea como un documento independiente, [Informe de implementación](../implementation/0010-e2e-minimo-flujo-esencial.md) (ver §17), siguiendo la convención de rutas de `AGENTS.md`.

## 1. Objetivo

Añadir un único flujo E2E con Playwright que ejercite la integración real entre Vue, Phaser y el DOM en un navegador real (Chromium), cubriendo exclusivamente: carga de la aplicación, estado inicial `running`, presencia de los paneles reales y simulados, pausa, reanudación y reinicio mediante los controles reales de la interfaz. No se añade cobertura de mecánica de juego (líneas, rotaciones, hard drop, DAS/ARR, lock delay, secuencias de piezas): esa responsabilidad ya pertenece a las 321 pruebas unitarias existentes en `packages/game-engine` y `apps/web`.

Al terminar la tarea:

- existe `apps/web/e2e/essential-flow.spec.ts`, un único test Playwright que verifica el flujo esencial de principio a fin;
- `pnpm test` sigue ejecutando exclusivamente Vitest, sin cambios de comportamiento ni de duración;
- `pnpm test:e2e` ejecuta el flujo E2E contra un servidor Vite real, arrancado y detenido automáticamente por Playwright;
- ningún archivo de `packages/game-engine` ni `packages/game-config` se modifica;
- los únicos cambios de producción son cuatro atributos `data-testid` nuevos, estrictamente necesarios para localizar controles sin depender de clases CSS ni de texto decorativo.

## 2. Relación con el plan técnico

```text
0001 — Base del prototipo                                        ✅ Completada
0002 — Motor de juego determinista                                ✅ Completada
0003 — Rotación SRS                                                ✅ Completada
0004 — Integración de Phaser                                       ✅ Completada
0005 — DAS, ARR y soft drop                                         ✅ Completada
0006 — Lock delay y fijación diferida                               ✅ Completada
0007 — Cola de próximas piezas y preview técnico provisional        ✅ Completada
0008 — Pausa, reanudación y reinicio coordinados                   ✅ Completada
0009 — Marco Tactical e identidad visual Industrial Dramatic       ✅ Completada
0009b — Refinamiento visual del marco Tactical                     ✅ Completada
0010 — E2E mínimo del flujo esencial                               ← Esta tarea
```

Esta tarea no incluye: hold, ghost piece, puntuación, combos, T-Spins, back-to-back, energía real, cartuchos reales, sabotajes reales, batalla real, segundo motor, bot, muerte súbita, audio, backend, Pinia, Vue Router, CI/CD nueva, corrección del aviso de chunk de Phaser, soporte táctil o mobile, ni ninguna mecánica de tablero. Ver §7 para el listado completo.

## 3. Fuentes de verdad

- [docs/rautfall.md](../rautfall.md) — decisión arquitectónica «stack de pruebas» (Vitest, Playwright y Testcontainers; responsabilidad de Playwright: «flujos críticos completos en navegador y comprobaciones esenciales de integración entre Vue, Phaser y backend»; «los E2E no intentarán cubrir todas las combinaciones de movimientos; esa responsabilidad pertenece al motor»).
- [docs/tasks/0004-integracion-phaser.md](0004-integracion-phaser.md) — canvas lógico 320×640, fondo transparente, ausencia de HUD dentro del canvas, exclusión explícita de Playwright de esa tarea.
- [docs/tasks/0008-pausa-reanudacion-reinicio-coordinados.md](0008-pausa-reanudacion-reinicio-coordinados.md) — contrato `SessionStatus`, overlay de pausa, botones Pausar/Reanudar y Reiniciar, orden exacto de las transiciones.
- [docs/tasks/0009-marco-tactical-identidad-visual-industrial-dramatic.md](0009-marco-tactical-identidad-visual-industrial-dramatic.md) — layout Tactical de tres zonas, componentes simulados, `data-testid` ya existentes.
- `apps/web/src/App.vue`, `apps/web/src/App.test.ts`, `apps/web/src/components/GameCanvas.vue`, `apps/web/src/components/GameCanvas.test.ts`, `apps/web/src/components/NextPiecesPreview.vue`, `apps/web/src/components/OpponentMonitor.vue`, `apps/web/src/components/CombatStatusPanel.vue`, `apps/web/src/game/create-phaser-game.ts`, `apps/web/src/game/scenes/GameScene.ts`, `apps/web/src/game/types.ts` — implementación web real tras `0009b` (todos inspeccionados íntegros, ver §4).
- `package.json` (raíz), `apps/web/package.json`, `pnpm-workspace.yaml`, `apps/web/vite.config.ts`, `vitest.config.ts` (raíz) — configuración real de scripts, workspace y pruebas (ver §4).
- [docs/project-status.md](../project-status.md) — estado actual del proyecto (321 tests, working tree limpio, siguiente tarea abierta a decisión entre hold, ghost piece, puntuación/combos o el primer sabotaje real).

## 4. Inspección previa (confirmada por lectura directa del código real)

### 4.1 Estado real verificado al redactar esta especificación

- `git status --short` sin salida (working tree limpio).
- `pnpm test` → **321 tests pasan** (16 archivos), confirmado por ejecución real.
- No existe ningún directorio `.github/`: no hay pipeline de CI en el repositorio.
- No existe ninguna referencia a Playwright en `package.json` (raíz) ni en `apps/web/package.json`. `pnpm-lock.yaml` solo menciona `@vitest/browser-playwright` como entrada de metadatos de proveedores opcionales de Vitest 4 (no instalado, sin paquete `playwright` ni `@playwright/test` presente en ningún `node_modules`). Playwright no está instalado en el repositorio: esta tarea lo introduce por primera vez.
- Node instalado: `v22.22.3`. pnpm instalado: `10.34.5`. Ambos coinciden exactamente con `engines` de `package.json` (raíz).

### 4.2 Configuración real de Vitest (raíz) y separación de suites

```ts
// vitest.config.ts (raíz)
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});
```

`include` selecciona exclusivamente archivos `*.test.ts`. Esto es un hecho verificado clave para el diseño de §12: si los archivos E2E usan la extensión `*.spec.ts` (convención estándar de Playwright) en vez de `*.test.ts`, Vitest nunca los recogerá, sin necesidad de excluir rutas manualmente ni de tocar `vitest.config.ts`. La separación de suites (§14 del enunciado) queda resuelta por la extensión del archivo, no por configuración adicional.

### 4.3 Scripts reales (raíz y `apps/web`)

```jsonc
// package.json (raíz), scripts reales
{
  "dev": "pnpm --filter @rautfall/web dev",
  "test": "vitest run",
  "lint": "eslint .",
  "format": "prettier --write .",
  "typecheck": "pnpm --recursive typecheck",
  "build": "pnpm --filter @rautfall/web build"
}
```

```jsonc
// apps/web/package.json, scripts reales
{
  "dev": "vite",
  "test": "vitest run",
  "typecheck": "vue-tsc --noEmit",
  "build": "vue-tsc --noEmit && vite build"
}
```

`apps/web/package.json` no tiene devDependency de `vite`, `vitest` ni `typescript`: son devDependencies del workspace raíz, resueltas por pnpm mediante la búsqueda ascendente de `node_modules/.bin`. Este es el mismo mecanismo por el que `pnpm --filter @rautfall/web dev` ya funciona hoy sin que `vite` esté listado en `apps/web/package.json`; Playwright reutilizará el mismo mecanismo para su `webServer` (§10).

### 4.4 Selectores y contrato DOM ya existentes (reutilizables sin cambios)

Confirmado por lectura de `apps/web/src/App.vue` (tras `0009b`) y sus componentes:

| Elemento | Selector ya existente | Fuente |
| --- | --- | --- |
| Botón Pausar/Reanudar | `[data-testid="pause-toggle"]` | `App.vue` |
| Botón Reiniciar | `[data-testid="reset-button"]` | `App.vue` |
| Columna del tablero propio | `[data-testid="own-board-column"]` | `App.vue` |
| Columna táctica | `[data-testid="tactical-column"]` | `App.vue` |
| Columna del monitor rival | `[data-testid="opponent-column"]` | `App.vue` |
| Bloque de energía simulada | `[data-testid="simulated-energy"]` | `CombatStatusPanel.vue` |
| Bloque de cartucho simulado | `[data-testid="simulated-cartridge"]` | `CombatStatusPanel.vue` |
| Bloque de Residuos simulado | `[data-testid="simulated-residues"]` | `CombatStatusPanel.vue` |
| Aviso de ancho insuficiente | `[data-testid="width-warning"]` | `App.vue` (oculto por CSS en el viewport de escritorio; no se usa en esta tarea, ver §7) |

Estos nueve selectores cubren ya, sin ningún cambio, las columnas del layout, ambos botones de control y los tres bloques de combate simulado exigidos por el enunciado. No se toca ninguno de ellos.

### 4.5 Contrato DOM que falta y que esta tarea debe cerrar

Inspección confirmada de lo que **no** existe hoy como selector estable:

- El estado de sesión (`running`/`paused`/`gameOver`) se renderiza en `App.vue` como `<span class="session-value" :class="gameState.status">{{ gameState.status }}</span>`, sin `data-testid`. Localizarlo hoy exigiría una clase CSS (`.session-value`) combinada con una posición relativa entre tres elementos hermanos (`status`/`step`/`elapsedMs` comparten la misma clase) — exactamente el tipo de selector posicional y frágil que el enunciado pide evitar.
- El valor `step` (`<span class="session-value">{{ gameState.step }}</span>`, sin `data-testid`) tiene el mismo problema y es necesario para el criterio robusto de reinicio (§13).
- El overlay de pausa (`<div v-if="gameState.status === 'paused'" class="pause-overlay" role="status" aria-live="polite">PAUSA</div>`) no tiene `data-testid`. Su `role="status"` no es exclusivo: `[data-testid="width-warning"]` también usa `role="status"`, por lo que localizar el overlay por rol accesible sin ambigüedad exigiría además filtrar por texto («PAUSA»), acoplando el test a un literal que, aunque hoy es estable (está fijado por contrato desde `0008`), es evitable con un `data-testid` directo.
- El contenedor de `GameCanvas.vue` (`<div ref="gameContainer" class="game-container" tabindex="0">`) no tiene `data-testid`. Localizar el `<canvas>` real de Phaser hoy exigiría depender de la clase `.game-container` o de que sea el único `<canvas>` de la página (cierto hoy, pero no garantizado como contrato).
- `NextPiecesPreview.vue` no tiene `data-testid` en su raíz (`<div class="next-pieces-preview">`). Contar las tres próximas piezas hoy exigiría la clase `.preview-slot`, que el enunciado pide evitar como selector contractual.

Estos cinco huecos son el único motivo real que justifica tocar código de producción en esta tarea (§8, §16 del enunciado del usuario lo permiten explícitamente como «cambios mínimos para testabilidad»).

## 5. Alcance incluido

- Añadir `@playwright/test` como dependencia de desarrollo de `apps/web` (§8).
- Crear `apps/web/playwright.config.ts` con la configuración mínima cerrada en §10.
- Crear `apps/web/e2e/essential-flow.spec.ts`: un único test Playwright, estructurado en pasos nombrados (`test.step`), que cubre exactamente el flujo de §11.
- Añadir cuatro atributos `data-testid` nuevos, ninguno más, en `apps/web/src/App.vue`, `apps/web/src/components/GameCanvas.vue` y `apps/web/src/components/NextPiecesPreview.vue` (§9).
- Añadir los scripts de §15 en `apps/web/package.json` y en `package.json` (raíz).
- Añadir `test-results/`, `playwright-report/` y `blob-report/` a `.gitignore` (raíz) (§10.4).
- Registro y verificación de errores de consola y `pageerror` como parte del propio test, sin exclusión genérica (§14).
- Validación manual en modo UI de Playwright (§19).

## 6. Alcance explícitamente excluido

No pertenece a `0010`:

- Una partida completa, eliminación de líneas, rotaciones concretas, hard drop, DAS/ARR, soft drop, lock delay, secuencias exactas de piezas.
- Cualquier valor exacto dependiente de tiempo (`elapsedMs` exacto), de posición exacta de bloques dentro del canvas, o de píxeles.
- Contenido interno del canvas de Phaser, capturas de pantalla o comparación visual como criterio de paso/fallo (una captura en fallo, como diagnóstico, sí se configura en §10 — no es lo mismo que usarla como criterio de aceptación).
- Firefox, WebKit, matriz de navegadores, dispositivos móviles, emulación táctil.
- Los tres puntos de corte responsive de `0009`/`0009b` (`≥1200px`, `760–1199px`, `<760px`) y el aviso de ancho insuficiente: no forman parte del flujo esencial exigido por esta tarea; el test se ejecuta en el viewport por defecto de `devices['Desktop Chrome']` (1280×720, dentro del rango de escritorio, ver §11.1) y no varía el viewport.
- Integración de CI nueva (GitHub Actions u otra): no existe ningún pipeline hoy (§4.1); se documenta cómo incorporarlo después (§18), sin crearlo.
- Cualquier cambio en `packages/game-engine` o `packages/game-config`. Ninguno de los dos paquetes se modifica.
- Nuevas propiedades en `GamePresentationState` o en `PhaserGameController`.
- Hooks de test dentro del motor, APIs globales de depuración, acceso al motor o a la escena desde `window`, controles especiales exclusivos de E2E, ramas condicionales por entorno de test en código de producción.
- Rediseño visual, cambios de layout, cambios de estilos o cambios de textos visibles salvo lo estrictamente necesario para los cuatro `data-testid` de §9 (que no alteran ningún texto ni estilo).
- Testcontainers, backend, base de datos: no existen en el repositorio a día de hoy; fuera de alcance por completo.
- Auditoría de accesibilidad completa: los ajustes de accesibilidad de esta tarea se limitan a los `data-testid` de §9; no se revisan ni corrigen otros aspectos de accesibilidad.
- Creación de `docs/implementation/0010-e2e-minimo-flujo-esencial.md` y actualización de `docs/project-status.md`: se harán al **finalizar** la implementación (§17), no durante la redacción de esta especificación ni como parte del trabajo inicial.

## 7. Dependencias y ubicación

- Se añade **`@playwright/test`** como única dependencia nueva, en `devDependencies` de `apps/web/package.json` (no en el `package.json` raíz, siguiendo el mismo criterio ya aplicado a `phaser`, `@vue/test-utils` y `jsdom` en `0004`: es tooling específico de `apps/web`, no del workspace completo ni de `packages/game-engine`/`packages/game-config`).
- No se instala el paquete `playwright` (sin ámbito) por separado: `@playwright/test` ya incluye el test runner y la gestión de navegadores necesaria para esta tarea. No se añade ninguna dependencia auxiliar (sin `wait-on`, sin `start-server-and-test`, sin `cross-env`): Playwright gestiona su propio `webServer` de forma nativa (§10).
- Esta especificación no fija un número de versión exacto de `@playwright/test`; se instalará la versión estable más reciente compatible con el stack actual (Node 22.22.3, TypeScript 5.9, Vite 8) y se registrará la versión exacta instalada en el informe final, siguiendo el mismo patrón ya usado para Phaser en `0004`.
- Tras añadir la dependencia: actualizar `pnpm-lock.yaml` mediante pnpm (`pnpm install`), sin editarlo manualmente, y ejecutar las validaciones raíz (§20).

## 8. Instalación del navegador Chromium

Playwright no incluye binarios de navegador en el propio paquete npm; deben descargarse aparte:

```bash
pnpm --filter @rautfall/web exec playwright install chromium
```

- Se instala **exclusivamente Chromium**; esta especificación no instala `--with-deps` ni el resto de navegadores soportados por Playwright.
- Este comando se ejecuta una vez tras `pnpm install`, antes de la primera ejecución de `pnpm test:e2e` (§15, §20).
- Si la descarga falla por restricciones de red o de entorno (por ejemplo, un entorno sandbox sin acceso a la red de descarga de navegadores de Playwright), esto **no** es un fallo de la implementación: se documenta explícitamente en el informe final (§17) como limitación del entorno de ejecución, exactamente como ya se documentó la imposibilidad de lanzar un navegador real en los informes de `0004`, `0008`, `0009` y `0009b`. No se sustituye por un mock del navegador ni por una alternativa sin navegador real: si Chromium no puede instalarse en el entorno de implementación, `pnpm test:e2e` queda documentado como no ejecutable en ese entorno concreto, y la validación se traslada íntegramente al usuario (§19).

## 9. Cambios mínimos de testabilidad (únicos cambios de producción permitidos)

Exactamente cuatro atributos `data-testid` nuevos, ninguno más. Ningún cambio de texto, estilo, layout o comportamiento funcional.

| Archivo | Elemento | Atributo a añadir |
| --- | --- | --- |
| `apps/web/src/components/GameCanvas.vue` | `<div ref="gameContainer" class="game-container" tabindex="0">` | `data-testid="game-canvas"` |
| `apps/web/src/App.vue` | `<span class="session-value" :class="gameState.status">{{ gameState.status }}</span>` (el de `Status`, no los de `Step` ni `Tiempo (ms)`) | `data-testid="session-status"` |
| `apps/web/src/App.vue` | `<span class="session-value">{{ gameState.step }}</span>` (el de `Step`) | `data-testid="session-step"` |
| `apps/web/src/App.vue` | `<div v-if="gameState.status === 'paused'" class="pause-overlay" role="status" aria-live="polite">PAUSA</div>` | `data-testid="pause-overlay"` |
| `apps/web/src/components/NextPiecesPreview.vue` | `<div class="next-pieces-preview">` (raíz del componente) | `data-testid="next-pieces-preview"` |

Reglas:

- Ninguna de estas cinco modificaciones (cuatro atributos distintos; el quinto punto de la tabla corresponde a `App.vue`, que gana dos atributos) cambia ninguna clase, estilo, estructura de anidamiento, texto visible, prop, evento o lógica de `<script setup>`. Son adiciones de un único atributo por elemento.
- No se añade `data-testid` a `OpponentMonitor.vue` ni a `CombatStatusPanel.vue`: sus contenedores (`[data-testid="opponent-column"]` y los tres bloques `simulated-*` ya existentes) son suficientes para todo lo que exige el flujo de §11; añadir más sería ampliar el alcance sin necesidad real.
- No se añade ningún `data-testid` a `OpponentMonitor.vue` para el texto «SIMULADO»: se localiza mediante texto accesible dentro de `[data-testid="opponent-column"]` (ese texto es un contrato funcional fijado por `0009` §17.2, no un literal decorativo; ver §11.5).
- Estos cinco cambios deben preservar el comportamiento de todas las pruebas unitarias existentes (`App.test.ts`, `GameCanvas.test.ts`, `NextPiecesPreview.test.ts`): ninguna de ellas depende de la ausencia de estos atributos. Confirmar con `pnpm test` tras el cambio (§20).

## 10. Configuración de Playwright

### 10.1 Ubicación

`apps/web/playwright.config.ts` — junto al resto de configuración de `apps/web` (`vite.config.ts`, `tsconfig.json`), no en la raíz del workspace. `apps/web` es la única unidad del monorepo con interfaz web; no hay ninguna razón para que la configuración E2E viva en otro paquete o en la raíz.

### 10.2 Contenido cerrado

```ts
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm --filter @rautfall/web dev -- --port ${PORT} --strictPort`,
    cwd: WORKSPACE_ROOT,
    url: BASE_URL,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 10.3 Justificación de cada valor cerrado

- **`testDir: './e2e'`**: resuelve a `apps/web/e2e`, coherente con §12.
- **`timeout: 30_000`** (por test): el flujo completo (carga + 4 transiciones) no debería acercarse a este límite en una máquina de desarrollo normal; es un techo de seguridad, no un valor ajustado a medir.
- **`expect: { timeout: 5_000 }`**: todas las transiciones de esta tarea son reacciones síncronas de la UI a un clic (sin llamadas de red, sin temporizadores del motor durante la pausa — ver `0008` §4.6) y deberían resolverse en milisegundos; 5 s es un margen amplio sin ser indefinido.
- **`retries: process.env.CI ? 1 : 0`**: política distinta local/CI exigida por el enunciado (§11 de la petición del usuario). Localmente, un fallo debe verse a la primera (facilita depuración); en un hipotético CI futuro, un reintento absorbe fluctuaciones de arranque de proceso sin ocultar un fallo persistente. No se fija más de un reintento: esta tarea no ajusta la fiabilidad del test mediante reintentos generosos.
- **`reporter: 'list'`**: el reporter por defecto de Playwright, salida legible en terminal, suficiente para un único test. No se configura `html` ni `github` (este último no tiene sentido sin un pipeline de CI real, fuera de alcance, §18).
- **`use.trace: 'retain-on-failure'`**: solo se conserva traza si el test falla; no genera coste en la ejecución en verde. Es la herramienta principal de diagnóstico si el flujo falla.
- **`use.screenshot: 'only-on-failure'`**: una captura en el momento del fallo es una ayuda de diagnóstico, no un criterio de aceptación (coherente con §6: «no screenshots visuales como criterio principal»).
- **`use.video: 'off'`**: mantiene la configuración mínima; no se necesita vídeo para un flujo tan corto y ya se dispone de traza y captura en fallo.
- **`projects`**: un único proyecto `chromium` usando el dispositivo `'Desktop Chrome'` de Playwright (resuelve a un viewport de escritorio, ≈1280×720, dentro del rango `≥1200px` de `0009`/`0009b`). No se añaden `firefox`, `webkit` ni proyectos de dispositivo móvil.
- **`webServer.command`**: reutiliza el script `dev` ya existente de `apps/web` (`vite`), pasándole `--port 5174 --strictPort` como argumentos adicionales vía `pnpm run -- <args>`. No se inventa un comando `vite` crudo ni un script nuevo en `package.json` solo para esto.
- **Puerto `5174`** (no `5173`, el puerto por defecto de Vite): evita cualquier colisión si el desarrollador ya tiene `pnpm dev` corriendo manualmente en el puerto por defecto mientras ejecuta `pnpm test:e2e` en otra terminal. `--strictPort` obliga a Vite a fallar si el puerto 5174 ya está ocupado, en vez de escalar silenciosamente a otro puerto que dejaría de coincidir con `BASE_URL`.
- **`webServer.cwd: WORKSPACE_ROOT`**: `pnpm --filter @rautfall/web` necesita ejecutarse desde un directorio dentro del workspace pnpm; se fija explícitamente a la raíz del repositorio (calculada de forma relativa al propio archivo de configuración, sin depender del directorio de trabajo desde el que se invoque `playwright test`) para que el comando funcione igual sin importar desde dónde se ejecute Playwright.
- **`webServer.timeout: 60_000`**: margen amplio para el arranque en frío de Vite (instalación de dependencias ya hecha, primera transformación de módulos); el arranque real observado es de pocos segundos.
- **`webServer.reuseExistingServer: !process.env.CI`**: en local, si ya hay un servidor respondiendo en el puerto 5174 (por ejemplo, de una ejecución anterior no cerrada correctamente), Playwright lo reutiliza en vez de fallar por puerto ocupado; en un hipotético CI, siempre se arranca un servidor nuevo y aislado.
- **Ningún proceso huérfano**: Playwright gestiona el ciclo de vida completo del proceso de `webServer` (lo arranca antes de la primera prueba y lo termina — `SIGTERM`/`SIGKILL` según plataforma — al finalizar la ejecución o al interrumpirla con `Ctrl+C`). No se implementa ningún script de arranque/parada manual, ningún `&` en segundo plano, ningún `kill` explícito ni ningún wrapper de shell: es responsabilidad nativa de Playwright, exactamente como exige el enunciado («evitar dejar procesos huérfanos» sin scripts auxiliares).

### 10.4 `.gitignore`

Añadir al `.gitignore` de la raíz (mismo estilo sin prefijo de ruta que las entradas ya existentes `node_modules/`, `dist/`, `coverage/`, `.vite/`):

```gitignore
test-results/
playwright-report/
blob-report/
```

Estos son los directorios de salida por defecto de Playwright (resultados de test, reporte HTML si se genera puntualmente en depuración, y reporte «blob»). No se necesita ignorar ninguna ruta de caché de navegadores: Playwright instala los binarios de Chromium en la caché global del usuario (fuera del repositorio), no dentro de `apps/web` ni de `node_modules` del proyecto.

## 11. Estructura exacta del flujo E2E

### 11.1 Decisión: un único test con pasos nombrados

Se implementa **un único `test()`** en `apps/web/e2e/essential-flow.spec.ts`, estructurado internamente con `test.step(...)` para cada fase. Justificación (cierra la ambigüedad de §18 de la petición del usuario):

- El flujo es intrínsecamente secuencial y con estado compartido: para probar «reanudación» hace falta haber pausado antes; para probar el criterio robusto de reinicio (§13) hace falta capturar el valor de `step` **antes** de reiniciar. Dividir en varios `test()` independientes obligaría a repetir carga + pausa en cada uno solo para llegar al punto de partida del siguiente, duplicando arranque y estado exactamente como el enunciado pide evitar.
- Un único test sin estructura interna sería, en cambio, difícil de diagnosticar ante un fallo (el enunciado también lo prohíbe). `test.step(...)` resuelve ambos problemas a la vez: comparte una sola carga de página y un solo contexto de navegador, pero cada fase aparece nombrada y delimitada en la salida del reporter y en la traza (`trace: 'retain-on-failure'`, §10.3), de modo que un fallo señala exactamente en qué paso ocurrió sin necesidad de dividir en tests distintos.
- No se usa `test.describe` con múltiples `test()` encadenados mediante estado compartido a nivel de módulo (por ejemplo, una única `page` reutilizada entre tests con `test.describe.serial`): esa alternativa existe en Playwright, pero aquí no aporta nada sobre `test.step` dentro de un único test y añade acoplamiento entre tests que complica la lectura. Se descarta explícitamente.

### 11.2 Viewport

Se usa el viewport por defecto de `devices['Desktop Chrome']` (≈1280×720), ya configurado en `projects` (§10.2). No se fija un viewport distinto: cae dentro del rango `≥1200px` de `0009`/`0009b`, por lo que el layout de tres columnas está siempre visible y no hace falta razonar sobre los breakpoints responsive (excluidos, §6).

### 11.3 Registro de errores de consola y `pageerror` (ver también §14)

Se registran **antes** de cualquier navegación, para no perder ningún mensaje emitido durante la carga inicial:

```ts
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (error) => {
  pageErrors.push(error.message);
});
```

### 11.4 Pasos cerrados del flujo

```ts
await test.step('carga de la aplicación y tablero real de Phaser', async () => {
  await page.goto('/');
  const canvas = page.locator('[data-testid="game-canvas"] canvas');
  await expect(canvas).toBeVisible();
});

await test.step('estado inicial running, próximas piezas y paneles', async () => {
  await expect(page.getByTestId('session-status')).toHaveText('running');
  const nextPiecesItems = page.getByTestId('next-pieces-preview').getByRole('listitem');
  await expect(nextPiecesItems).toHaveCount(3);
  await expect(page.getByTestId('opponent-column')).toContainText('SIMULADO');
  await expect(page.getByTestId('simulated-energy')).toBeVisible();
  await expect(page.getByTestId('simulated-cartridge')).toBeVisible();
  await expect(page.getByTestId('simulated-residues')).toBeVisible();
});

await test.step('pausa mediante el botón real', async () => {
  await page.getByTestId('pause-toggle').click();
  await expect(page.getByTestId('session-status')).toHaveText('paused');
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await expect(page.getByTestId('pause-overlay')).toHaveText('PAUSA');
});

await test.step('reanudación mediante el mismo botón', async () => {
  await page.getByTestId('pause-toggle').click();
  await expect(page.getByTestId('session-status')).toHaveText('running');
  await expect(page.getByTestId('pause-overlay')).not.toBeVisible();
});

await test.step('reinicio mediante el botón real, verificado de forma robusta', async () => {
  // Esperar, mediante una condición observable (no un sleep), a que el contador
  // lógico avance por encima de 0 antes de capturar el valor de referencia.
  await expect(page.getByTestId('session-step')).not.toHaveText('0');
  const stepBeforeReset = await page.getByTestId('session-step').textContent();

  await page.getByTestId('reset-button').click();

  await expect(page.getByTestId('session-status')).toHaveText('running');
  await expect(page.getByTestId('pause-overlay')).not.toBeVisible();
  await expect
    .poll(async () => Number(await page.getByTestId('session-step').textContent()))
    .toBeLessThan(Number(stepBeforeReset));
  await expect(page.getByTestId('next-pieces-preview').getByRole('listitem')).toHaveCount(3);
  await expect(page.locator('[data-testid="game-canvas"] canvas')).toBeVisible();
});

expect(consoleErrors, `Errores de consola detectados: ${consoleErrors.join(' | ')}`).toEqual([]);
expect(pageErrors, `Excepciones de página detectadas: ${pageErrors.join(' | ')}`).toEqual([]);
```

El fragmento anterior fija literalmente: los pasos, el orden, los selectores usados y el criterio de cada aserción. La implementación puede ajustar detalles sintácticos menores (nombres de variables, formato) siempre que preserve exactamente este orden observable, estos selectores y estos criterios.

### 11.5 Localización de «SIMULADO» en el monitor rival

`page.getByTestId('opponent-column').toContainText('SIMULADO')` se apoya en el texto «SIMULADO» que `OpponentMonitor.vue` ya renderiza de forma contractual (fijado por `0009` §17.2: «una etiqueta visual y textual SIMULADO... de modo que la naturaleza simulada no dependa únicamente del color»). No es un texto decorativo frágil: es la garantía funcional exigida por la propia especificación de `0009` de que el panel nunca se confunda con una partida real. Usarlo como criterio de aceptación de `0010` refuerza esa misma garantía en un navegador real, no la contradice.

## 12. Ubicación de los archivos E2E

- Directorio: `apps/web/e2e/` (nuevo).
- Único archivo de test: `apps/web/e2e/essential-flow.spec.ts`.
- Extensión `.spec.ts` (no `.test.ts`): garantiza, junto con el `include` ya existente de `vitest.config.ts` (§4.2), que Vitest nunca intente ejecutar este archivo y que Playwright (cuyo `testMatch` por defecto reconoce `.spec.ts`) sí lo haga, sin configurar `testMatch` explícitamente en `playwright.config.ts`.
- No se crean subcarpetas adicionales (`e2e/pages/`, `e2e/fixtures/`, `e2e/helpers/`): un único archivo con un único test es la superficie mínima para el flujo descrito; no se introduce el patrón «Page Object» ni fixtures personalizadas sin un segundo test que las justifique.

## 13. Criterio robusto de reinicio (cierre de la ambigüedad del enunciado)

Tras inspeccionar `GameScene.resetGame()`/`resetEngine()` (§4 de `docs/tasks/0008-...md`, sin cambios desde entonces) se confirma que un reinicio real produce, de forma observable desde el DOM:

1. `status` vuelve a `'running'` (ya se cumplía posiblemente antes de reiniciar, por lo que **no basta por sí solo** como evidencia de que el reinicio ocurrió: el flujo de §11.4 reinicia estando ya en `running` tras la reanudación, precisamente para forzar que el criterio no pueda apoyarse solo en este punto).
2. El overlay de pausa desaparece (ya era así antes de reiniciar en este punto del flujo; se revalida para dejar la aserción explícita, no como única evidencia).
3. **El contador lógico `step` disminuye respecto de su valor inmediatamente anterior al clic en «Reiniciar»** (`createGameEngine` siempre arranca en `step = 0`; como el motor ha estado corriendo desde la carga, `stepBeforeReset` es mayor que `0` en el momento de reiniciar). Este es el criterio decisivo: es imposible que ocurra por casualidad sin que el motor se haya recreado, y no exige conocer ni fijar ningún valor numérico exacto (cumple literalmente «reducido de forma verificable sin exigir un valor exacto»).
4. Las próximas piezas siguen mostrando exactamente tres entradas (evidencia de que `nextPieces` sigue siendo un array de longitud 3 tras la recreación del motor, sin exigir conocer qué tipos de pieza concretos aparecen — la semilla es fija, pero esta tarea no depende de ese hecho, cumpliendo «no depender de una pieza concreta»).
5. El canvas de Phaser sigue presente y visible (evidencia de que Phaser no se ha destruido ni ha entrado en un estado roto: `resetEngine()` recrea el motor pero no la instancia de `Phaser.Game` ni la escena).

Ningún punto individual (1-2-4-5) es, por sí solo, una prueba suficiente de que ha ocurrido un reinicio real (todos ellos también son ciertos en el estado estable previo). El punto 3, combinado con los demás, es la combinación mínima que sí lo es: es la única señal que **cambia** de forma verificable como consecuencia directa y exclusiva de pulsar «Reiniciar». Esta es la razón por la que `session-step` se añade como `data-testid` nuevo (§9): sin él, no existe ninguna forma de implementar este criterio sin depender de una clase CSS compartida (`.session-value`) o de una posición relativa entre tres elementos hermanos.

## 14. Errores de consola y `pageerror`: política de no ignorar de forma genérica

- Se capturan **todos** los mensajes de consola de tipo `'error'` (no `'warning'`, `'log'` ni `'info'`) y **todas** las excepciones de página (`pageerror`), desde antes de la primera navegación (§11.3).
- Al final del test (tras completar los cinco pasos de §11.4) se afirma que ambos arrays están vacíos. Un array no vacío hace fallar el test con el contenido exacto de los mensajes en el mensaje de aserción (facilita el diagnóstico sin necesitar la traza).
- **No se filtra ni se ignora ningún mensaje de forma genérica.** El único warning conocido y documentado en todo el proyecto (`docs/project-status.md`, informes de `0004`/`0009`/`0009b`) es el aviso de chunk grande de Phaser (`>500 kB`), y ocurre **exclusivamente durante `pnpm build`** (una advertencia de Rollup/Vite en tiempo de compilación, impresa en la terminal del proceso de build), nunca como un mensaje en la consola del navegador en tiempo de ejecución contra el servidor de desarrollo de Vite que usa este E2E (§10). Por tanto, no existe ningún warning conocido que debiera aparecer en la consola del navegador durante este flujo, y no se introduce ninguna lista de exclusión para él ni para ningún otro mensaje.
- Si, durante la implementación real, apareciera un mensaje de consola de tipo `'error'` inesperado y se determina que es benigno y ajeno al alcance de esta tarea (por ejemplo, un aviso propio de una versión concreta de una librería de terceros), **no se debe silenciar mediante un filtro genérico**: se documenta explícitamente en el informe final (§17) con su texto exacto, su causa investigada y una justificación explícita de por qué se excluye puntualmente de la aserción (por ejemplo, filtrando ese mensaje literal concreto, nunca por tipo o por prefijo genérico). Si no puede justificarse, el mensaje se trata como un fallo real que bloquea la tarea.
- El banner informativo que Phaser imprime en consola al inicializarse (mensaje de tipo `'log'`, no `'error'`) y cualquier aviso de modo desarrollo de Vue (también `'log'`/`'info'`) no activan esta aserción, porque el filtro de §11.3 solo captura `msg.type() === 'error'`.

## 15. Scripts

### 15.1 `apps/web/package.json`

```jsonc
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "playwright:install": "playwright install chromium"
  }
}
```

- `test:e2e`: ejecución headless estándar, la que se usa en las validaciones finales (§20).
- `test:e2e:ui`: modo UI interactivo de Playwright (inspección visual de cada paso, timeline, re-ejecución selectiva). Es el modo exigido por la validación manual de §19 («modo headed o UI si aporta valor»): se elige el modo UI en vez de un `--headed` plano porque permite observar la pausa, la reanudación y el reinicio paso a paso sin instrumentación adicional, además de inspeccionar la traza en caso de fallo directamente desde la misma interfaz.
- `playwright:install`: instala únicamente Chromium (§8), sin `--with-deps` (no se asume la necesidad de dependencias de sistema adicionales sin evidencia real durante la implementación; si el entorno las exige, se documenta en el informe final).

### 15.2 `package.json` (raíz)

```jsonc
{
  "scripts": {
    "test:e2e": "pnpm --filter @rautfall/web test:e2e",
    "playwright:install": "pnpm --filter @rautfall/web playwright:install"
  }
}
```

- `pnpm test` (raíz) **no cambia**: sigue siendo exactamente `vitest run`, sin ningún paso adicional. Ejecutarlo no requiere Chromium instalado ni arranca ningún servidor.
- `pnpm test:e2e` (raíz) delega en el script equivalente de `apps/web`, siguiendo el mismo patrón ya usado por `dev` y `build` en el `package.json` raíz.
- No se modifica el script `test` de `apps/web/package.json` (`vitest run`): sigue siendo la suite rápida de Vitest de ese paquete, sin fusionar con Playwright.

## 16. Integración con la suite existente

- `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` deben seguir finalizando correctamente después de esta tarea, sin cambio de comportamiento salvo el aumento natural del recuento de archivos TypeScript verificados por `tsc`/`vue-tsc` (el propio `apps/web/playwright.config.ts` y `apps/web/e2e/essential-flow.spec.ts` deben tipar correctamente).
- `apps/web/tsconfig.json` incluye `"include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]`: **no incluye** `playwright.config.ts` ni `e2e/**/*.ts`. Esto es una decisión deliberada, no un descuido: los archivos de Playwright no deben tipar-comprobarse mediante `vue-tsc --noEmit` (que es la base de `pnpm typecheck`/`pnpm build` en `apps/web`) para no acoplar la suite E2E al pipeline de tipos de la aplicación web ni arriesgar que un cambio en la configuración de Playwright bloquee el `build` de producción. `@playwright/test` valida sus propios archivos de configuración y de test mediante su propio compilador interno (`tsx`/`esbuild`) al ejecutarlos, no mediante `vue-tsc`; no es necesario ni deseable duplicar esa comprobación en `pnpm typecheck`. Si durante la implementación se detecta que esto deja algún archivo E2E sin ninguna comprobación de tipos en absoluto, se documenta como deuda técnica aceptada en el informe final (§17); no se amplía el alcance de `tsconfig.json` para cerrarla sin necesidad demostrada.
- `pnpm lint` (`eslint .`) sí recorre todo el repositorio por defecto: `apps/web/playwright.config.ts` y `apps/web/e2e/essential-flow.spec.ts` deben pasar lint sin errores ni avisos, igual que el resto de archivos modificados por la tarea (regla general de `AGENTS.md`, sin excepción para archivos de test E2E).
- Ninguna prueba unitaria existente debe romperse por los cuatro `data-testid` nuevos de §9 (son adiciones puramente aditivas al DOM). Confirmar explícitamente con `pnpm test` (§20).

## 17. Actualizaciones de documentación futura (no forman parte de esta especificación)

Este documento (`docs/tasks/0010-e2e-minimo-flujo-esencial.md`) es la especificación de la tarea y permanece inmutable durante y después de la implementación. Al finalizar la implementación, se debe crear [docs/implementation/0010-e2e-minimo-flujo-esencial.md](../implementation/0010-e2e-minimo-flujo-esencial.md) como informe de implementación independiente, con:

- resumen;
- dependencias añadidas (con la versión exacta de `@playwright/test` instalada);
- configuración final de Playwright (con cualquier ajuste menor respecto de §10, si lo hubiera, y su justificación);
- scripts finales;
- selectores usados (contractuales reutilizados y `data-testid` nuevos, confirmando que son exactamente los cinco de §9);
- flujo E2E cubierto, paso a paso;
- estrategia de estabilidad aplicada (ausencia de `waitForTimeout`, esperas basadas en condiciones observables);
- gestión de errores de consola y `pageerror` (resultado real observado, y si se detectó o no algún mensaje inesperado);
- comandos ejecutados y resultados (`pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check`, y el comando de instalación de Chromium);
- número de tests unitarios (debe seguir en 321 o más, nunca menos) y número de tests E2E (1);
- limitaciones (en particular, si Chromium no pudo instalarse o ejecutarse en el entorno de implementación, ver §8);
- deuda técnica (en particular, la exclusión de `playwright.config.ts`/`e2e/**` de `pnpm typecheck`, ver §16);
- CI pendiente (documentar cómo incorporarlo después, ver §18, sin implementarlo);
- confirmación explícita de que no se modificaron `packages/game-engine` ni `packages/game-config`;
- confirmación explícita de que no se hicieron commits durante la implementación;
- actualización de [docs/project-status.md](../project-status.md) (estado, fecha, resultado resumido, referencia al informe).

Ninguna de estas dos actualizaciones (informe de implementación, `project-status.md`) se realiza como parte de la redacción de esta especificación.

## 18. CI: fuera de alcance, cómo incorporarlo después

No existe ningún pipeline de CI en el repositorio (§4.1: no hay `.github/`). Por tanto, y siguiendo el criterio por defecto del enunciado de esta tarea, **no se crea ninguna integración de CI en `0010`**.

Para una tarea futura que sí aborde CI, esta especificación deja documentado, sin implementarlo:

- Un job de CI que ejecute `pnpm install`, `pnpm --filter @rautfall/web playwright:install --with-deps` (el flag `--with-deps` sí sería necesario en una imagen de CI genérica, a diferencia del entorno de desarrollo local) y después `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, en ese orden o en paralelo donde no haya dependencia.
- El `reporter` de `playwright.config.ts` podría condicionarse a `process.env.CI` (por ejemplo, añadiendo el reporter `'github'` junto a `'list'`) cuando exista un pipeline real que lo consuma; no se hace ahora porque no hay ningún consumidor.
- `retries` y `reuseExistingServer` ya están preparados en §10.2 para diferenciar CI de local mediante `process.env.CI`, sin cambios adicionales necesarios cuando se cree el pipeline.

## 19. Validación manual requerida

A ejecutar antes de declarar la tarea completada:

1. `pnpm --filter @rautfall/web exec playwright install chromium` (o `pnpm playwright:install` desde la raíz) — confirmar que Chromium se instala correctamente, o documentar el fallo si el entorno lo impide (§8).
2. `pnpm test:e2e:ui` desde la raíz (o `pnpm --filter @rautfall/web test:e2e:ui`) — observar en el modo UI de Playwright:
   - la carga de la aplicación y la aparición del tablero de Phaser;
   - el estado inicial `running`, las tres próximas piezas, el monitor rival simulado y el panel de combate simulado;
   - la pausa (cambio de texto del botón, aparición del overlay `PAUSA`, cambio del estado mostrado);
   - la reanudación (desaparición del overlay, vuelta a `running`);
   - el reinicio (desaparición de cualquier overlay, vuelta a `running`, y que el contador `step` mostrado cae visiblemente respecto de justo antes de pulsar «Reiniciar»);
   - que ninguna de estas transiciones depende de una espera fija: la interfaz reacciona de inmediato a cada clic, sin ningún parpadeo ni retardo artificial introducido por el propio test.
3. Confirmar que, al finalizar la ejecución (tanto en éxito como forzando una interrupción con `Ctrl+C` durante `test:e2e:ui`), no queda ningún proceso de Vite huérfano escuchando en el puerto 5174 (comprobable, por ejemplo, con `lsof -i :5174` o equivalente, que no debe devolver ningún proceso una vez Playwright ha terminado).
4. Confirmar en la pestaña de consola del navegador (disponible dentro del modo UI de Playwright) que no aparece ningún error ni excepción no capturada durante todo el flujo.

## 20. Comandos de validación final

Antes de declarar la tarea completada, ejecutar en este orden desde la raíz:

```text
pnpm playwright:install
pnpm test
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Resultado esperado de cada uno:

- `pnpm playwright:install`: Chromium se descarga e instala sin errores. Si falla por restricciones de red o de entorno, se documenta como limitación (§8, §17) y el resto de comandos que no dependan de Chromium (`pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check`) deben seguir ejecutándose y pasando igualmente; `pnpm test:e2e` queda documentado como no ejecutado en ese entorno concreto, nunca como «pasado» sin haberse ejecutado realmente.
- `pnpm test`: **321 o más** tests pasan (321 existentes; esta tarea no añade tests a Vitest, por lo que el número esperado es exactamente 321 salvo que la implementación detecte una necesidad real no prevista, que debería documentarse como desviación).
- `pnpm test:e2e`: el único test del flujo esencial pasa, con sus cinco pasos (`test.step`) completados y sin errores de consola ni `pageerror`.
- `pnpm lint`: sin errores ni avisos, incluidos `apps/web/playwright.config.ts` y `apps/web/e2e/essential-flow.spec.ts`.
- `pnpm typecheck`: sin errores en los tres paquetes (`game-config`, `game-engine`, `apps/web`), coherente con la exclusión deliberada de §16.
- `pnpm build`: éxito, con el aviso de chunk grande de Phaser (`>500 kB`) aceptado como deuda técnica ya conocida desde `0004`, sin ningún otro warning nuevo.
- `git diff --check`: sin errores de espacio en blanco.

Además, revisar:

- No existen imports profundos entre paquetes.
- `packages/game-engine` y `packages/game-config` no tienen ninguna modificación (`git status --short packages/game-engine packages/game-config` sin salida).
- No hay código muerto ni configuración sobrante.
- No se ha ampliado el alcance más allá de lo descrito en §5/§6.
- No se usaron scripts ad hoc, heredocs, ficheros temporales, `node -e` ni Python inline durante la implementación (`AGENTS.md`).

## 21. Criterios de aceptación (resumen)

- Existe exactamente un archivo de test E2E (`apps/web/e2e/essential-flow.spec.ts`) con exactamente un `test()` estructurado en pasos.
- El flujo cubre, en este orden: carga, tablero de Phaser visible, estado inicial `running`, próximas piezas, monitor rival simulado, panel de combate simulado, pausa, overlay de pausa, reanudación, reinicio verificado de forma robusta (§13), y ausencia de errores de consola/`pageerror`.
- Ningún paso usa `waitForTimeout` ni ninguna espera de duración fija; todas las esperas son aserciones que reintentan sobre una condición observable.
- Ningún paso usa coordenadas de ratón (`page.mouse`) para interactuar con controles: todos los clics usan localizadores (`getByTestId`, `locator`).
- Ningún paso accede a `window`, a la instancia de Phaser, a la escena o al motor desde el test: toda la verificación es estrictamente sobre el DOM renderizado.
- `pnpm test` sigue ejecutando únicamente Vitest, con 321 o más tests en verde, sin ningún archivo `.spec.ts` recogido por error.
- `pnpm test:e2e` arranca y detiene Vite automáticamente, sin dejar procesos huérfanos.
- Solo Chromium está configurado como navegador.
- Los únicos cambios de producción son los cinco atributos `data-testid` de §9, sin ningún otro cambio visual, de estilo o de comportamiento.
- `packages/game-engine` y `packages/game-config` permanecen sin modificar.
- No se crea ninguna integración de CI nueva.

## 22. Próxima tarea prevista

No se fija una `0011` definitiva. La siguiente tarea se decidirá después de:

- validar manualmente el flujo E2E en modo UI (§19) y confirmar que el resultado es estable en ejecuciones repetidas;
- revisar, a la vista de [docs/rautfall.md](../rautfall.md) y del estado real del proyecto tras `0010`, entre candidatas razonables ya identificadas en `docs/project-status.md`: pieza fantasma (ghost piece), reserva/hold, o puntuación y combos. El primer sabotaje real (Residuos, sustituyendo su versión simulada) sigue siendo también una candidata razonable, condicionada a que se decida abordar antes la mecánica de puntuación/energía real que ese sabotaje presupone.
