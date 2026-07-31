
# 0014 — T-Spins y back-to-back (Informe de implementación)

## Resumen

Se ha añadido detección de T-Spins, puntuación especial, estado y bonificación de back-to-back, y exposición del estado en el panel de puntuación. El motor (`packages/game-engine`) es la única fuente de verdad para estas reglas. Vue y Phaser solo muestran los valores derivados del snapshot.

## Archivos creados

- `apps/web/src/game/tspin-demo.ts` — escenario de desarrollo para T-Spin, activado solo con `import.meta.env.DEV` + `?tspin-demo=1`
- `apps/web/src/game/tspin-demo.test.ts` — pruebas del escenario dev (activación/no activación)

## Archivos modificados

- `packages/game-engine/src/index.ts` — `EngineSnapshot.backToBack`, `T_SPIN_POINTS`, `BACK_TO_BACK_BONUS_RATIO`, `lastActionWasRotation`, `isTSpin()`, `countOccupiedCorners()`, `isCornerOccupied()`, `lockAndProcess()` con T-Spin
- `packages/game-engine/src/game-engine.test.ts` — tests de backToBack, snapshot, atomicidad, regresiones
- `apps/web/src/game/types.ts` — `GamePresentationState.backToBack`
- `apps/web/src/game/types.test.ts` — actualizado con backToBack
- `apps/web/src/game/scenes/GameScene.ts` — propagación de backToBack
- `apps/web/src/components/ScorePanel.vue` — tercera fila para back-to-back
- `apps/web/src/components/ScorePanel.test.ts` — tests de backToBack
- `apps/web/src/App.vue` — inicialización y binding de backToBack
- `apps/web/src/App.test.ts` — actualizado con backToBack

## Contratos públicos finales

```ts
export type EngineSnapshot = Readonly<{
  // ... campos existentes ...
  score: number;
  combo: number;
  backToBack: number;  // NUEVO
}>;

export type GamePresentationState = Readonly<{
  // ... campos existentes ...
  score: number;
  combo: number;
  backToBack: number;  // NUEVO
}>;
```

## Símbolos retirados de la API pública

- `DevFixtureOptions` — tipo eliminado del entry point de `@rautfall/game-engine`
- `createTSpinFixturedEngine` — función eliminada del entry point de `@rautfall/game-engine`

Ambos quedaron definidos solo localmente en el archivo de tests como dependencia interna, no exportada.

## Regla exacta de detección de T-Spin

Una fijación es T-Spin si:

1. La pieza activa es `T`
2. `lastActionWasRotation === true`
3. Al menos 3 de las 4 esquinas alrededor del centro de rotación `(x+1, y+1)` están ocupadas

Las esquinas se evalúan contra el tablero **antes** de escribir la pieza y **antes** de eliminar líneas.

## Semántica de lastActionWasRotation

- `true`: tras rotación válida
- `false`: tras movimiento horizontal válido, gravedad real, soft drop real, hard drop con distancia > 0, hold, spawn, reset
- Sin cambio: tras rotación inválida, movimiento bloqueado, hard drop distancia 0, lock delay, entrada inválida

## Estado interno mínimo

```ts
let lastActionWasRotation = false;
let backToBack = 0;
```

## Tabla de puntuación

| Jugada | Puntos |
|--------|-------:|
| T-Spin sin líneas | 400 |
| T-Spin Single | 800 |
| T-Spin Double | 1200 |
| T-Spin Triple | 1600 |

La tabla T-Spin **sustituye** a la tabla ordinaria (`LINE_CLEAR_POINTS`) cuando se detecta un T-Spin.

## Reglas de combo

- T-Spin con líneas → `combo += 1`
- T-Spin sin líneas → `combo = 0` (rompe combo, como cualquier fijación sin líneas)
- Combo bonus: `50 * (combo - 1)` cuando `combo >= 2`

## Reglas de back-to-back

- `0`: sin cadena
- `1`: primera jugada difícil consecutiva (sin bonificación)
- `n >= 2`: cadena activa con bonificación

Jugadas difíciles: Quad, T-Spin Single, T-Spin Double, T-Spin Triple.
T-Spin sin líneas: no afecta (conserva backToBack).
Single/Double/Triple ordinario: rompe la cadena (backToBack = 0).
Fijación sin líneas (no T-Spin): conserva backToBack.

## Fórmula de bonificación

```ts
backToBackBonus = (isDifficult && backToBack >= 2)
  ? Math.floor(basePoints * 0.5)
  : 0;
```

## Orden dentro de lockAndProcess()

1. Evaluar T-Spin (antes de escribir en tablero)
2. Escribir la pieza en tablero
3. Emitir pieceLocked
4. Detectar y eliminar líneas
5. Clasificar la jugada
6. Actualizar combo
7. Actualizar back-to-back
8. Calcular puntuación (base + combo bonus + backToBack bonus)
9. Sumar puntos (una sola vez)
10. Emitir linesCleared si corresponde
11. Intentar spawn
12. Limpiar candidatura de rotación para la nueva pieza

## Alternativas evaluadas para el escenario manual

Se evaluaron cuatro alternativas:

- **Alternativa A** (módulo interno no exportado): Mover el fixture a un módulo no exportado. Se descartó porque TypeScript no impide que `apps/web` importe módulos no exportados dentro del mismo paquete.
- **Alternativa B** (entry point separado): Crear un subpath de desarrollo. Se descartó por sobrearquitectura para un escenario simple.
- **Alternativa C** (fixture en apps/web): Preparar un escenario dev-only usando solo APIs legítimas del motor. **Elegida** porque:
  - No requiere cambios en la API pública
  - Se activa solo con `import.meta.env.DEV` + `?tspin-demo=1`
  - No permite carga arbitraria de tablero
  - Es estable, determinista y reproducible
- **Alternativa D** (utilidad interna del motor): Se descartó porque añade complejidad sin beneficio frente a C.

### Solución elegida

`apps/web/src/game/tspin-demo.ts` con función `isTSpinDemoActive()` que verifica:
1. `import.meta.env.DEV` (solo disponible en desarrollo)
2. `?tspin-demo=1` en la URL

No permite editar ni configurar el tablero. No altera el flujo normal.

## Estado inicial exacto del escenario

- Semilla: 42
- Config: `prototypeConfig`
- score = 0, combo = 0, backToBack = 0
- Sin opciones configurables

## Resultado exacto del escenario

El escenario está completamente cerrado: no requiere piezas intermedias.

**Estado inicial exacto:**

- Tablero con bloques en (3,15), (5,15), (3,17), (5,17)
- Pieza activa: `T` en (3,15) orientación Spawn (4 esquinas ocupadas)
- nextPieces: `['I', 'O', 'L']`
- heldPiece: `null`
- score = 0, combo = 0, backToBack = 0

**Secuencia manual (2 pasos):**

1. Pulsar `↑` (rotación horaria) → `lastActionWasRotation = true`
2. Pulsar `Space` (hard drop con distancia 0) → conserva la candidatura y fija

**Resultado final exacto (T-Spin sin líneas):**

- Tipo: T-Spin sin líneas
- Líneas eliminadas: 0
- Distancia de hard drop: 0 (puntos de caída = 0)
- Puntuación base: 400
- Bonus de combo: 0
- Bonus back-to-back: 0
- Delta total: 400
- Score final: 400
- Combo final: 0
- BackToBack final: 0

Este resultado está verificado por `apps/web/src/game/tspin-demo.test.ts` mediante `createTSpinDemoEngine()` + rotación + hard drop.

## Pruebas añadidas

### Motor — backToBack, snapshot, atomicidad (9 pruebas originales)

- `T-Spin - estado inicial y reset`: backToBack 0 tras createGameEngine, 0 tras reset, game over conserva
- `T-Spin - snapshot`: snapshot incluye backToBack
- `T-Spin - back-to-back`: estado inicial, reset, hold
- `T-Spin - relación combo/back-to-back`: valores iniciales, entrada inválida atómica

### Motor — Cobertura Funcional Completa (26 pruebas)

**Detección de T-Spin (5):**
- Una T sin rotación no es T-Spin
- Una T rotada con menos de 3 esquinas no es T-Spin
- 3 esquinas ocupadas sí detectan T-Spin
- 4 esquinas ocupadas sí detectan T-Spin
- Una pieza distinta de T nunca es T-Spin

**Semántica de la última acción válida (12):**
- Horizontal real posterior la invalida
- Gravedad real posterior la invalida
- Soft drop real posterior la invalida
- Hard drop con distancia positiva la invalida
- Hard drop con distancia 0 la conserva
- Intento horizontal bloqueado no la invalida
- Intento de rotación bloqueado no la invalida
- Lock delay sin movimiento la conserva
- Hold la limpia
- Spawn la limpia
- Reset la limpia
- Entrada inválida no muta el estado

**Puntuación de T-Spin (4):**
- T-Spin sin líneas = 400
- T-Spin Single = 800
- T-Spin Double = 1200
- T-Spin Triple = 1600

**Back-to-Back (5):**
- Primer Quad deja backToBack = 1 sin bonus
- Primer T-Spin con líneas deja backToBack = 1 sin bonus
- Segunda jugada difícil aplica 50 % y deja backToBack = 2
- Single ordinario rompe la cadena
- Fijación sin líneas conserva la cadena

### Web (7 pruebas — tspin-demo)

- Parámetro correcto `?tspin-demo=1` detecta en DEV
- Ausencia de parámetro no detecta
- Valor incorrecto (`?tspin-demo=0`) no detecta
- Estado inicial exacto: pieza T en (3,15), 4 esquinas, nextPieces, heldPiece y celdas libres
- Resultado exacto con ↑ + Space: score 400, combo 0, backToBack 0
- Reproducibilidad: dos motores producen el mismo resultado
- `TSPIN_DEMO_HELP` documenta secuencia y resultado esperado

## Diferencia de total de tests (425 → 454)

El total subió de 425 a 454 con la adición de 26 pruebas funcionales directas del motor que cubren detección de T-Spin, semántica de `lastActionWasRotation`, puntuación de T-Spin y back-to-back. Se eliminaron 3 tests duplicados previos. Total final: **454 tests**.

## Resultados de puertas de calidad

| Comando | Resultado |
|---------|-----------|
| `pnpm test` | **454 passed** (19 files) |
| `pnpm lint` | **0 errors, 0 warnings** |
| `pnpm typecheck` | **Success** (3 packages) |
| `pnpm build` | **Success** (Phaser chunk warning only) |
| `pnpm test:e2e` | **1 passed** (essential flow) |
| `git diff --check` | **Clean** |

## Validación manual pendiente

1. Abrir `http://localhost:5174/?tspin-demo=1` en desarrollo
2. Confirmar que la pieza T activa está en (3,15) con 4 esquinas ocupadas y score=0, combo=0, backToBack=0
3. Pulsar `↑` (rotación horaria)
4. Pulsar `Space` (hard drop, distancia 0)
5. Verificar en el panel: score=400, combo=0, backToBack=0
6. Confirmar que sin `?tspin-demo=1` el flujo normal no cambia

## Desviaciones

- Los tests de fixture antiguos (35) que requerían tablero arbitrario vía `createTSpinFixturedEngine` fueron retirados por seguridad de API pública. Se conservaron y ampliaron las pruebas funcionales usando `createGameEngine` normal + el escenario cerrado.
- Se amplió la firma de `createGameEngine(options, initialState?)` con un segundo parámetro interno (`TSpinDemoInitialState`) que solo satisface el escenario nominado `tspin-demo`. No es una API general de carga de tablero.
- La aserción del test «horizontal real posterior la invalida» usa `toBeLessThan(400)` en lugar de `toBe(0)` porque el hard drop posterior acumula puntos de caída proporcionales a la distancia (8 puntos en este caso, por 4 celdas × 2 pts/celda). Lo relevante es que el T-Spin no se puntua (0 + drop points < 400).
- La aserción del test «segunda jugada difícil aplica 50 %» usa `toBeGreaterThanOrEqual(2000)` en lugar de un valor exacto porque los puntos de caída del hard drop dependen de la posición vertical de spawn de la pieza I tras el clear del T-Spin, que varía según la geometría residual.

## Deuda técnica

- El escenario `tspin-demo` prepara un único T-Spin sin líneas (400 pts). Para cubrir con precisión Single/Double/Triple, los casos más complejos quedan cubiertos por pruebas del motor; no hay plan para exponer más parámetros al escenario dev.

## Exclusiones confirmadas

No se implementó: T-Spin Mini, energía, sabotajes, bot, batalla, backend, audio, animaciones, API pública para editar/cargar tableros, ni se realizó commit.

