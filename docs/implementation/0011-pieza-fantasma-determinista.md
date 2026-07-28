# 0011 — Pieza fantasma determinista

## Resumen

Se ha implementado la funcionalidad de pieza fantasma (`landingCells`) que muestra la proyección de dónde aterrizaría la pieza activa si se ejecutara un hard drop en el estado actual del motor, manteniendo su tipo, orientación y coordenada X, con la Y válida más baja antes de colisionar.

## Archivos modificados y creados

### Modificados
- `packages/game-engine/src/index.ts` — Ampliado `ActivePieceSnapshot` con `landingCells`, implementación del cálculo en `getSnapshot()`
- `packages/game-engine/src/game-engine.test.ts` — Pruebas para verificar la funcionalidad de `landingCells`
- `apps/web/src/game/scenes/GameScene.ts` — Renderizado visual de la pieza fantasma

## Contrato público implementado

```typescript
export type ActivePieceSnapshot = Readonly<{
  type: PieceType;
  x: number;
  y: number;
  orientation: Orientation;
  cells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
  grounded: boolean;
  lockDelayElapsedMs: number;
  lockResetsUsed: number;
  landingCells: ReadonlyArray<Readonly<{ x: number; y: number }>>;
}>;
```

- `landingCells` representa las 4 celdas absolutas donde aterrizaría la pieza activa mediante hard drop
- Forma idéntica a `cells` (`{ x: number; y: number }`)
- No se añade a `EngineSnapshot` fuera de `activePiece`
- Desaparece cuando `activePiece` es `null` (sin pieza activa o en `gameOver`)

## Algoritmo

La implementación utiliza la función existente `hardDropDistance` para calcular la distancia vertical hasta el aterrizaje:

```typescript
function computeLandingCells(board: (PieceType | null)[][], activePiece: ActivePiece): Cell[] {
  const distance = hardDropDistance(board, activePiece);
  return computeAbsoluteCells(
    activePiece.type,
    activePiece.x,
    activePiece.y + distance,
    activePiece.orientation,
  );
}
```

- Reutiliza exactamente las mismas reglas de colisión existentes (`hardDropDistance`, `computeAbsoluteCells`)
- No se duplica lógica de colisión ni recorrido de filas
- Coste O(BOARD_ROWS) en el peor caso (24 filas), idéntico al ya existente para hard drop y `isGrounded`
- Calculado al construir el snapshot, con coste O(BOARD_ROWS), sin mutar el motor

## Relación exacta con hard drop

La prueba de equivalencia confirma que `landingCells` coincide exactamente con el resultado de ejecutar hard drop:

1. Obtener `landingCells` en un motor A
2. Ejecutar `hardDrop: true` en otro motor B equivalente
3. Comparar las celdas fijadas resultantes con la proyección previa
4. Ambos producen el mismo resultado

## Tratamiento de lock delay

La pieza fantasma:
- No modifica `grounded`, `lockDelayElapsedMs` ni `lockResetsUsed`
- No interactúa con el temporizador de lock delay en ningún sentido
- Se calcula exclusivamente a partir del estado actual del tablero y posición/orientación de la pieza activa
- El cálculo es una función pura invocada exclusivamente dentro de `getSnapshot()`

## Integración Phaser

### Orden de capas
1. Tablero fijado (ya existente)
2. Pieza fantasma (nuevo)
3. Pieza activa (ya existente)
4. Overlays Vue (ya existentes)

Este orden asegura que cuando `landingCells` coincide exactamente con `cells` (pieza apoyada), la pieza activa se dibuja encima y la fantasma queda visualmente oculta.

### Técnica gráfica y estilo visual
- Color base idéntico a la pieza activa
- Relleno con opacidad reducida (0.25)
- Contorno con opacidad media (0.5)
- Geometría clara, sin efectos adicionales
- No se usa bloom, neón, animación ni partículas

## Decisiones visuales

- Pieza fantasma se distingue claramente de bloques fijados y pieza activa por la opacidad
- Mismo color base que la pieza activa para identificación inmediata
- Sin parpadeo ni superposición ambigua
- Desaparece al fijar y reaparece con la siguiente pieza
- No se confunde con la pieza activa gracias a la opacidad reducida

## Pruebas añadidas

Se añadieron pruebas para cubrir:
- Tablero vacío
- Bloques fijados
- Paredes
- Pieza rotada
- Pieza I y O
- Pieza ya apoyada (coincide con `cells`)
- Pieza durante lock delay
- Cambio tras movimiento horizontal
- Cambio tras rotación válida
- Ausencia sin pieza activa y en game over
- Pureza de `getSnapshot()`
- Inmutabilidad del array y de cada celda
- Equivalencia exacta con hard drop
- Determinismo tras reset

## Número final de tests

- Tests Vitest: 189
- Tests E2E: 1

## Comandos ejecutados y resultados

- `pnpm test`: PASSED (189 tests)
- `pnpm test:e2e`: PASSED (1 test)
- `pnpm lint`: PASSED
- `pnpm typecheck`: PASSED
- `pnpm build`: PASSED
- `git diff --check`: No issues

## Desviaciones

Ninguna desviación respecto a la especificación.

## Deuda técnica

Ninguna deuda técnica identificada.

## Validación manual pendiente

- Proyección coincide con el aterrizaje real de la pieza
- Se actualiza inmediatamente al mover la pieza horizontalmente y al rotarla
- No parpadea entre frames
- No se confunde con la pieza activa ni con bloques fijados
- Desaparece en el instante en que la pieza se fija y reaparece correctamente con la siguiente pieza tras el spawn
- Se comporta correctamente durante la pausa
- Reiniciar la partida recalcula la fantasma correctamente para la nueva pieza activa inicial
- Un game over no deja ninguna fantasma residual visible
- No aparecen errores nuevos en la consola del navegador

## Confirmación de ausencia de alcance excluido

- No se añadió hold/reserva de pieza
- No se añadió puntuación, combos, T-Spins
- No se añadió energía de combate ni sabotajes
- No se añadió batalla, bot, multijugador local
- No se añadió audio, partículas, animaciones
- No se añadió configuración de usuario
- No se añadieron controles nuevos
- No se rediseñó el tablero ni la carcasa Tactical
- No se modificó el E2E de 0010
- No se expusieron APIs de depuración
- No se añadieron dependencias nuevas
- No se hizo refactor general

## Confirmación de que no se hicieron commits

No se realizaron commits durante la implementación.
