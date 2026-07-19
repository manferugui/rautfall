# 0007 — Cola determinista de tres próximas piezas y preview técnico provisional

## Informe de implementación

### Estado inicial

- 265 tests en verde.
- Working tree limpio.
- Contrato público exponía `EngineSnapshot.nextPiece: PieceType | null`.
- Contrato privado: variable `nextPieceType: PieceType | null`, con `spawnInitialPieces()` consumiendo 2 piezas, y `spawnNextPiece()` promoviendo la guardada y extrayendo una nueva.

### Archivos inspeccionados

- `docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md` (especificación inmutable)
- `packages/game-engine/src/index.ts` — definiciones de tipos, variables internas, lógica de spawn, snapshot, reset
- `packages/game-engine/src/game-engine.test.ts` — 179 tests que referencian `nextPiece` en 12 aserciones
- `apps/web/src/game/types.ts` — `GamePresentationState`
- `apps/web/src/game/types.test.ts` — aserción `nextPiece` in state = false
- `apps/web/src/game/scenes/GameScene.ts` — `notifyState` y construcción de `GamePresentationState`
- `apps/web/src/App.vue` — plantilla e integración de preview
- `apps/web/src/components/GameCanvas.vue` — layout del canvas
- `apps/web/src/workspace.test.ts` — pruebas del workspace

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/game-engine/src/index.ts` | Sustitución de `nextPiece` por `nextPieces` en tipos y lógica interna. Añadido `PieceShape`, `getPieceShape()`. Cola interna `nextPiecesQueue`. |
| `packages/game-engine/src/game-engine.test.ts` | Migración de 12 aserciones de `nextPiece` a `nextPieces`. Actualizados nombres de tests. |
| `apps/web/src/game/types.ts` | `GamePresentationState` gana campo `nextPieces: readonly PieceType[]`. Importa `PieceType`. |
| `apps/web/src/game/types.test.ts` | Actualizado para reflejar 4 claves + pruebas de `nextPieces`. |
| `apps/web/src/game/scenes/GameScene.ts` | `notifyState()` incluye `nextPieces` con comparación por contenido. |
| `apps/web/src/App.vue` | Integra `NextPiecesPreview`, estado inicial con `nextPieces`, footnote a `0007`. |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `apps/web/src/components/NextPiecesPreview.vue` | Componente Vue+CSS que muestra las tres próximas piezas usando `getPieceShape()`. |
| `apps/web/src/components/NextPiecesPreview.test.ts` | 9 tests del componente preview. |

### Migración de `nextPiece` a `nextPieces`

- **Contrato público**: `EngineSnapshot.nextPieces: readonly PieceType[]` (longitud 3 siempre).
- **Variable interna**: `nextPiecesQueue: PieceType[]` (mutable, para shift/push).
- **Creación inicial**: consume 4 piezas (1 activa + 3 cola). Antes: 2.
- **Spawn tras fijación**: `spawnNextPiece()` extrae `nextPiecesQueue[0]`, la repone con `nextFromBag()`, intenta spawn, activa o game over.
- **Reset**: descarta cola, genera 4 piezas con nueva semilla.
- **Snapshot**: copia defensiva `Object.freeze([...nextPiecesQueue])`.

### Diseño interno de la cola

- Estructura: `PieceType[]` con `shift()`/`push()`.
- Invariante: `length === 3` en `running` y `gameOver`.
- Inicialización: 3 llamadas consecutivas a `nextFromBag()` tras extraer la activa.
- Reposición tras spawn: 1 llamada a `nextFromBag()`.
- En `gameOver` por `spawnBlocked`, la cola ya está repuesta a 3 (la reposición ocurre antes de la comprobación de colisión).

### Orden de spawn

1. Extraer candidata: `nextPiecesQueue.shift()`
2. Reponer cola: `nextPiecesQueue.push(nextFromBag(...))`
3. Intentar spawn con la candidata
4. Si válido → activar, emitir `pieceSpawned`; si bloqueado → status = `gameOver`, emitir `gameOver`

### Tratamiento de game over

- Candidata se consume (no permanece en `nextPieces`).
- Cola repuesta a 3 tras el spawn fallido.
- `activePiece = null`.
- Se emite `gameOver` con motivo `spawnBlocked`.
- No se emite `pieceSpawned`.

### Contrato `getPieceShape`

```ts
export type PieceShape = Readonly<{
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  width: number;
  height: number;
}>;

export function getPieceShape(type: PieceType): PieceShape;
```

- Función pura, sin estado.
- Normaliza celdas: `minX = 0`, `minY = 0` (la tabla interna de I usa `y = 1` por SRS).
- Congela objeto y colecciones internas.
- Reutiliza `PIECE_ORIENTATION_CELLS[type][Spawn]` y `PIECE_WIDTH`/`PIECE_HEIGHT`.

### Normalización de geometría

Para la pieza I, cuyas celdas de spawn tienen `y = 1` en la tabla interna SRS, `getPieceShape('I')` desplaza las celdas restando `minY = 1`, devolviendo `y = 0..0` en lugar de `y = 1..1`.

### Decisión Vue + CSS

- Phaser renderiza el tablero y pieza activa; Vue muestra la preview.
- El componente `NextPiecesPreview.vue` usa CSS Grid con `<div>` posicionados absolutamente.
- `CELL_SIZE_PX = 16` para preview; escalado proporcional al bounding box.
- Colores replican los de `GameScene.ts` (tabla de presentación, no de dominio).

### Cambios en `GamePresentationState`

```ts
export type GamePresentationState = Readonly<{
  status: 'running' | 'gameOver';
  step: number;
  elapsedMs: number;
  nextPieces: readonly PieceType[];  // ← nuevo
}>;
```

- Phaser lo puebla desde `engine.getSnapshot().nextPieces` con copia `[...snap.nextPieces]`.
- La deduplicación en `notifyState()` compara por contenido del array.

### Pruebas añadidas

**Motor (parte de los 179 tests existentes migrados y nuevos):**
- Migración de 12 aserciones de `snap.nextPiece` a `snap.nextPieces`.
- Tests existentes verifican: longitud 3, tipos válidos, determinismo, atomicidad, reset, game over.

**Web (9 tests nuevos):**
- `NextPiecesPreview.test.ts`: 3 slots, orden, tipo textual, actualización, I (4×1), O (2×2), T (3×2), bounding box, aria-label.

### Número final de tests

**276 tests** (265 previos + 11 nuevos - 0 eliminados). Desglose:
- `game-engine`: 179 (sin cambios netos)
- `game-config`: 12
- `types.test.ts`: 5 (antes 3)
- `NextPiecesPreview.test.ts`: 9
- Otros archivos web: 71

### Comandos y resultados

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | 276 passed ✓ |
| `pnpm lint` | 0 errors ✓ |
| `pnpm typecheck` | 3 paquetes OK ✓ |
| `pnpm build` | Build exitoso, chunk warning conocido ✓ |
| `git diff --check` | Sin problemas ✓ |

### Desviaciones

- Ninguna desviación significativa de la especificación 0007.
- La implementación de la cola reordena internamente los pasos 2 y 3 de §10 (reponer cola antes de comprobar colisión) según lo permitido por la nota de la especificación.
- El `nextPiecesQueue.shift()!` usa aserción non-null porque la cola siempre tiene longitud 3 en el punto de llamada.

### Deuda técnica

- Preview técnica provisional sin estilo Industrial Dramatic definitivo.
- Colores duplicados entre `GameScene.ts` y `NextPiecesPreview.vue`.
- Avance de warning de chunk de Phaser (>500 kB).

### Confirmaciones

- ❌ No se hicieron commits (instrucción explícita: no crear commits).
- ✅ No se modificó `docs/tasks/0007-cola-proximas-piezas-preview-tecnico.md`.
- ✅ No se introdujeron dependencias nuevas.
- ✅ Phaser no mantiene la cola: solo la lee del snapshot y la copia a Vue.
- ✅ No hay alcance excluido implementado (hold, ghost, puntuación, etc.).
- ✅ No quedan referencias funcionales a `nextPiece` en código de producción ni tests.

### Validación manual pendiente

Ejecutar `pnpm dev` y verificar:
- [ ] Aparecen tres previews en orden correcto
- [ ] La primera preview pasa a ser activa al fijar
- [ ] La cola avanza y se repone tras cada fijación
- [ ] I, O y piezas 3×2 se ven centradas y sin deformaciones
- [ ] Cruce de bolsa sin saltos visibles
- [ ] Reset reproduce misma secuencia con misma semilla
- [ ] Game over no muestra previews corruptas
- [ ] La sensación de control no ha cambiado
- [ ] No aparecen errores en consola

### `git status --short`

```
M  apps/web/src/App.vue
M  apps/web/src/game/scenes/GameScene.ts
 M apps/web/src/game/types.test.ts
 M apps/web/src/game/types.ts
 M packages/game-engine/src/game-engine.test.ts
 M packages/game-engine/src/index.ts
?? apps/web/src/components/NextPiecesPreview.test.ts
?? apps/web/src/components/NextPiecesPreview.vue
