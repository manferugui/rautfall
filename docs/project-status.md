# Project Status — Rautfall

## Task 0001 — Base del prototipo

| Campo | Valor |
|-------|-------|
| **Estado** | ✅ Completada |
| **Fecha de finalización** | 2026-07-13 |
| **Resultado** | Monorepo mínimo, ejecutable y probado con tres unidades: `apps/web`, `packages/game-engine`, `packages/game-config`. 36 tests pasan, lint y typecheck limpios, build exitoso. |

### Resumen

- Workspace pnpm con tres unidades acordadas.
- `packages/game-config`: configuración validada con TypeBox, esquema estricto, rechazo de propiedades desconocidas, validación relacional explícita.
- `packages/game-engine`: contrato mínimo con factoría, step lógico, snapshot, eventos y reset determinista.
- `apps/web`: aplicación Vue 3 + Vite que consume ambos paquetes públicos y muestra pantalla técnica.
- Todos los comandos raíz funcionan sin compilación previa.

### Siguiente tarea

`0002 — Motor de juego determinista`

Implementación de mecánicas fundamentales del juego: tablero, piezas, generación determinista mediante bolsa de siete, SRS, colisiones, gravedad y lock delay.
