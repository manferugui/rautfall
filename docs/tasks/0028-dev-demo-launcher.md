# Tarea 0028 — DEV Demo Launcher

## Contexto

Estado actual:
- Tarea 0027 cerrada y commiteada.
- Árbol git limpio.
- Suite completa en verde.
- Existen varios escenarios DEV accesibles mediante query params.
- El objetivo de esta tarea es mejorar la ergonomía de desarrollo y demostración, NO añadir mecánicas de juego.

## Objetivo

Crear un lanzador centralizado de demos de desarrollo accesible desde el menú principal únicamente cuando `import.meta.env.DEV === true`.

Debe permitir abrir los escenarios DEV existentes sin tener que recordar manualmente sus query params.

## Requisitos

### 1. Auditoría Previa de Escenarios
Localizar e inventariar los escenarios DEV reales del sistema:
- Batalla Local 2P (`?battle-demo=1`)
- Muerte Súbita 2P (`?battle-demo=1&sudden-death-demo=1`)
- Interferencia 2P (`?battle-demo=1&interference-demo=1`)
- Bot Sabotaje Residuos 2P (`?battle-demo=1&bot-sabotage=residuos`)
- Bot Sabotaje High Board 2P (`?battle-demo=1&bot-sabotage=high`)
- Sabotaje Residuos 1P (`?sabotage-demo=1`)
- Residuos en Tablero 1P (`?garbage-demo=1`)
- Sobrecarga 1P (`?overload-demo=1`)
- Polaridad Inversa 1P (`?polarity-demo=1`)
- T-Spin Setup 1P (`?tspin-demo=1`)
- Nivel 1 - Gravedad 1P (`?level-demo=1`)
- Nivel 10 - Gravedad 1P (`?level-demo=10`)
- Audio Lab (SFX & Music) (`?sfx-lab=1`)

### 2. Registro Centralizado
Crear la fuente única de verdad en `apps/web/src/dev/dev-demos.ts`:
- Tipado estricto `DevDemoDefinition` y `DevDemoCategory`.
- Matriz de demos `DEV_DEMOS`.
- Helper con firma `buildDemoTargetUrl(query: Readonly<Record<string, string>>, currentPathname?: string): string`.

### 3. Lanzador Visual Simplificado
Crear `apps/web/src/components/DevDemoLauncher.vue`:
- Uso exclusivo de tokens tácticos CSS existentes.
- Muestra de label, descripción, badge de categoría y acción Abrir.
- Botón Volver al menú para restablecer la URL limpia (`pathname`).
- Construcción de URL limpia desde cero (sin query params dev residuales).

### 4. Integración Protegida
Integrar en `ModeSelector.vue` usando `defineAsyncComponent` / condicional `import.meta.env.DEV === true`.

### 5. Validaciones
- Suite de pruebas completa (`pnpm test`).
- Calidad de código y tipos (`pnpm lint`, `pnpm typecheck`).
- Compilación de producción (`pnpm build`).
- Pruebas E2E (`pnpm test:e2e`).
