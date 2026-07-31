# 0015 — Energía de combate

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo

Convertir las acciones ofensivas ya implementadas —eliminaciones de líneas (Single, Double, Triple, Quad), T-Spins y sus variantes, combos y back-to-back— en energía de combate determinista dentro de `packages/game-engine`.

La energía se acumula en el motor, se expone en el snapshot y se muestra en la barra de energía de la interfaz sustituyendo a los valores actualmente simulados. En esta tarea la energía **no se consume**: no hay sabotajes funcionales ni mecanismo de descarga. Los sabotajes quedan fuera de alcance.

---

## 2. Antecedentes: compatibilidad con `docs/rautfall.md`

### 2.1 Reglas ya superadas por tareas 0013 y 0014

`docs/rautfall.md` §680–745 define el sistema de puntuación y energía en bloque. Las siguientes partes ya están implementadas y **no deben reinterpretarse** en esta tarea:

| Aspecto | Decisión en rautfall.md | Estado real (0013/0014) |
|---|---|---|
| Tabla de puntos por líneas | 100/300/500/800 | Implementada en `LINE_CLEAR_POINTS` |
| Combos: incremento y ruptura | Pieza sin líneas rompe el combo | Implementado |
| Bonificación de combo en puntuación | `50 * (combo - 1)` cuando `combo >= 2` | Implementado |
| Detección de T-Spin | Tres variantes con líneas + sin líneas | Implementado en `isTSpin()` |
| Tabla de puntos T-Spin | 400/800/1200/1600 | Implementada en `T_SPIN_POINTS` |
| Back-to-back | Jugadas difíciles consecutivas + 50% bonus | Implementado |
| Caídas sin energía | Explícito en rautfall.md §739 | Correcto: las caídas generan puntos, no energía |

### 2.2 Resoluciones de compatibilidad adoptadas

1. **T-Spin sin líneas**: Genera `0` de energía base.
2. **Bonificación de combo en energía**: Se aplica de manera lineal acotada: `min(combo - 1, 5) * 3`.
3. **Bonificación back-to-back en energía**: Se calcula como el 25% de la energía base (`floor(baseEnergy * 0.25)`).
4. **Capacidad máxima de la barra**: Se establece un máximo de `100` unidades de energía.
5. **Tabla de energía de T-Spins**: Se implementa una tabla con ratio 2.5× respecto a su equivalente ordinario para incentivar jugadas difíciles (T-Spin Single = 25, T-Spin Double = 50, T-Spin Triple = 75).
6. **Excedente de energía**: Se descarta de manera estricta al llegar a la saturación (`COMBAT_ENERGY_MAX = 100`), ya que no hay mecanismos de consumo en esta tarea.

### 2.3 Elementos que pertenecen a tareas futuras (fuera de 0015)

- Consumo de energía y asignación de un sabotaje al completar la barra.
- Cola de sabotajes con bolsa equilibrada.
- Botones de lanzamiento (`A`, `S`).
- Modificador de energía durante la muerte súbita (+20%).
- Indicador de energía del rival.
- Configuración de energía por perfil de dificultad.
- Animaciones de la barra al completar.

---

## 3. Fuente de verdad

- `packages/game-engine` calcula y conserva la energía.
- El valor de energía **no puede recalcularse** desde eventos, desde la interfaz ni desde Phaser.
- Phaser copia el valor del snapshot al estado de presentación. Vue lo muestra.
- No existe ninguna otra fuente de energía fuera del motor.

---

## 4. Estado y contrato

### 4.1 Campo interno del motor

```ts
let combatEnergy = 0;
```

- Tipo: `number` entero no negativo.
- Inicializado a `0` al crear el motor.
- Puesto a `0` en `reset()`.
- No se reinicia en `gameOver` (el valor final permanece congelado en el último snapshot).

### 4.2 Campo en `EngineSnapshot`

```ts
export type EngineSnapshot = Readonly<{
  // ... campos existentes ...
  combatEnergy: number;  // NUEVO
}>;
```

- Tipo: `number`.
- Rango garantizado: `0 <= combatEnergy <= 100`.
- Inmutable: el snapshot está congelado con `Object.freeze`.
- No comparte estructura mutable con el estado interno del motor.

### 4.3 Constante de capacidad máxima

```ts
const COMBAT_ENERGY_MAX = 100;
```

### 4.4 Campo en `GamePresentationState`

```ts
export type GamePresentationState = Readonly<{
  // ... campos existentes ...
  combatEnergy: number;  // NUEVO
}>;
```

### 4.5 Invariantes

- `combatEnergy` es siempre un entero `>= 0` y `<= 100`.
- Nunca puede ser negativo.
- Nunca puede superar `100`, ni siquiera como estado transitorio interno.
- Una entrada inválida no muta `combatEnergy`.
- Una fijación actualiza puntuación, combo, back-to-back y `combatEnergy` de forma atómica en `lockAndProcess()`. La ganancia de una misma jugada no puede aplicarse dos veces.

### 4.6 Comportamiento en `reset()`

`combatEnergy` se pone a `0`. Idéntico al tratamiento de `score`, `combo` y `backToBack`.

### 4.7 Comportamiento en `gameOver`

`combatEnergy` no se altera. El valor queda congelado en el último snapshot emitido antes o durante el game over.

---

## 5. Reglas exactas de generación

### 5.1 Tabla base por tipo de eliminación

| Tipo de jugada | Energía base |
|---|---:|
| Single ordinario (1 línea) | 10 |
| Double ordinario (2 líneas) | 25 |
| Triple ordinario (3 líneas) | 45 |
| Quad ordinario (4 líneas) | 70 |
| T-Spin sin líneas | 0 |
| T-Spin Single (1 línea) | 25 |
| T-Spin Double (2 líneas) | 50 |
| T-Spin Triple (3 líneas) | 75 |
| Fijación sin líneas (no T-Spin) | 0 |

### 5.2 Bonificación de combo

La bonificación de combo en energía tiene un **tope fijo** de 15 puntos por jugada para evitar cadenas de sabotajes excesivas.

**Constantes:**

```ts
const COMBO_ENERGY_BONUS_PER_STEP = 3;
const COMBO_ENERGY_BONUS_CAP = 5;
```

**Fórmula:**

```ts
const comboEnergyBonus = (combo >= 2)
  ? Math.min(combo - 1, COMBO_ENERGY_BONUS_CAP) * COMBO_ENERGY_BONUS_PER_STEP
  : 0;
```

Ejemplos:
- `combo = 1` → no hay bonus.
- `combo = 2` → `min(1, 5) * 3 = 3` de energía adicional.
- `combo = 3` → `min(2, 5) * 3 = 6`.
- `combo = 6` → `min(5, 5) * 3 = 15` (tope).
- `combo = 8` → `min(7, 5) * 3 = 15` (tope).

La bonificación de combo **solo se aplica cuando la jugada base genera energía** (líneas eliminadas). Una fijación sin líneas rompe el combo a `0` y no genera energía de combo.

### 5.3 Bonificación de back-to-back

La bonificación de back-to-back en energía es del 25% de la energía base. Se calcula solo sobre la energía base, no sobre el bonus de combo.

**Constante:**

```ts
const BACK_TO_BACK_ENERGY_BONUS_RATIO = 0.25;
```

**Fórmula:**

```ts
const backToBackEnergyBonus = (isDifficult && backToBack >= 2)
  ? Math.floor(baseEnergy * BACK_TO_BACK_ENERGY_BONUS_RATIO)
  : 0;
```

Ejemplo: Quad (`baseEnergy = 70`) con `backToBack >= 2` → `Math.floor(70 * 0.25) = 17` de energía adicional.
Ejemplo: T-Spin Single (`baseEnergy = 25`) con `backToBack >= 2` → `Math.floor(25 * 0.25) = 6` de energía adicional.

La bonificación de back-to-back **solo aplica a jugadas difíciles** (Quad, T-Spin Single, T-Spin Double, T-Spin Triple). T-Spin sin líneas no activa back-to-back.

### 5.4 Orden de aplicación dentro de `lockAndProcess()`

El cálculo de energía se inserta de forma atómica en el mismo bloque que los puntos, tras clasificar la jugada:

```
1.  Evaluar T-Spin (antes de escribir en tablero)
2.  Escribir la pieza en el tablero
3.  Emitir pieceLocked
4.  Detectar y eliminar líneas
5.  Clasificar la jugada (T-Spin / ordinaria / sin líneas)
6.  Actualizar combo
7.  Actualizar back-to-back
8.  Calcular puntos: base + comboBonus + backToBackBonus     (existente)
9.  Calcular energía: baseEnergy + comboEnergyBonus + backToBackEnergyBonus  ← NUEVO
10. Sumar puntos (una sola vez)
11. Sumar energía con saturación (una sola vez)              ← NUEVO
12. Emitir linesCleared si corresponde
13. Intentar spawn
14. Limpiar candidatura de rotación para la nueva pieza
```

### 5.5 Redondeo

`Math.floor` solo en el bonus de back-to-back. El resto de valores son enteros exactos. El resultado final de la energía generada es siempre entero.

### 5.6 Acumulación en una misma fijación

La fórmula exacta de ganancia en una fijación es la suma de los tres valores independientes:

```ts
const generatedEnergy = baseEnergy + comboEnergyBonus + backToBackEnergyBonus;
```

### 5.7 Saturación y excedente

El excedente se descarta y la energía se topa estrictamente en 100:

```ts
combatEnergy = Math.min(combatEnergy + generatedEnergy, COMBAT_ENERGY_MAX);
```

---

## 6. Acciones que no generan energía

Las siguientes acciones **no generan energía** (su ganancia es exactamente `0`):

- Gravedad (descenso automático)
- Soft drop (caída blanda)
- Hard drop (caída instantánea)
- Fijación sin líneas (no T-Spin)
- T-Spin sin líneas
- Hold
- Pausa / reanudación
- Reinicio (se limpia a 0)
- Intentos de movimiento o rotación bloqueados
- Entrada inválida (rechazada por validación)
- Game over (valor final queda congelado)

---

## 7. Saturación y excedente

- `combatEnergy` nunca supera `100`.
- Cuando `combatEnergy + generatedEnergy > 100`, el resultado es exactamente `100`.
- En esta tarea no hay mecanismo de descarga: la barra se satura y permanece en `100` hasta que los sabotajes (tarea futura) la descarguen.
- La energía no puede ser negativa en ningún caso.

---

## 8. Eventos

No se añade ningún evento de dominio nuevo. La energía se observa exclusivamente mediante `EngineSnapshot.combatEnergy`. No existe ningún consumidor real de un evento `energyGained` hasta que los sabotajes estén implementados.

---

## 9. UI — Integración mínima

### 9.1 ScorePanel

`ScorePanel.vue` recibe `score`, `combo` y `backToBack`. Se añade `combatEnergy` como cuarta fila:

```html
<div class="score-panel__row">
  <span class="score-panel__label">Energía</span>
  <span class="score-panel__value" data-testid="combatEnergy-value">
    {{ combatEnergy }}
  </span>
</div>
```

Se muestra el valor numérico directamente. No se añade barra gráfica en `ScorePanel`.

### 9.2 CombatStatusPanel — barra de energía

La barra de energía simulada actual en `CombatStatusPanel.vue` (segmentos CSS estáticos de la tarea 0009) debe leer el valor real de `combatEnergy`:

- La barra tiene 7 segmentos.
- Segmentos activos: `Math.floor(combatEnergy / 100 * 7)`.
- Segmentos activos: color cian (`--color-accent`). Segmentos inactivos: grafito.
- No se añaden animaciones de llenado progresivo ni efectos al saturar la barra.
- No hay botones de sabotaje funcionales.

`CombatStatusPanel.vue` recibe `combatEnergy: number` as prop.

### 9.3 GameScene.ts

`GameScene.ts` copia `snapshot.combatEnergy` al estado de presentación, igual que hace con `score`, `combo` y `backToBack`.

### 9.4 App.vue

`App.vue` propaga `combatEnergy` a `ScorePanel` y a `CombatStatusPanel`. El valor inicial es `0`.

---

## 10. Determinismo y atomicidad

- Misma semilla y mismas entradas producen exactamente la misma secuencia de valores de `combatEnergy`.
- Una entrada rechazada por `INVALID_GAME_INPUT` no muta `combatEnergy`.
- Una fijación actualiza puntuación, combo, back-to-back y `combatEnergy` en un único bloque atómico dentro de `lockAndProcess()`. La ganancia de una misma jugada no puede aplicarse dos veces.
- El objeto devuelto por `getSnapshot()` es inmutable; modificarlo no afecta al estado interno del motor.

---

## 11. Pruebas obligatorias

Todas las aserciones comprueban **valores exactos**. No se aceptan condiciones débiles como `toBeGreaterThan(0)`, `typeof` o comprobaciones de existencia de campo sin valor concreto.

### Motor (`packages/game-engine/src/game-engine.test.ts`)

**Estado inicial y reset:**
- `combatEnergy === 0` tras `createGameEngine()`.
- `combatEnergy === 0` tras `reset()`.
- `combatEnergy` no cambia durante `gameOver`.
- El snapshot incluye `combatEnergy`.

**Eliminaciones ordinarias (un test por tipo):**
- Single → `combatEnergy === 10`.
- Double → `combatEnergy === 25`.
- Triple → `combatEnergy === 45`.
- Quad → `combatEnergy === 70`.

**T-Spins (un test por tipo):**
- T-Spin sin líneas → `combatEnergy === 0`.
- T-Spin Single → `combatEnergy === 25`.
- T-Spin Double → `combatEnergy === 50`.
- T-Spin Triple → `combatEnergy === 75`.

**Combo:**
- Primera eliminación: `combo === 1`, energía = base (sin bonus).
- Segunda eliminación consecutiva: `combo === 2`, energía acumulada = base anterior + base nueva + `1 * 3`.
- Fijación sin líneas rompe el combo: siguiente eliminación sin bonus.
- Combo en tope: `combo >= COMBO_ENERGY_BONUS_CAP + 1` → el bonus no supera `COMBO_ENERGY_BONUS_CAP * COMBO_ENERGY_BONUS_PER_STEP` (15).

**Back-to-back:**
- Primera jugada difícil: `backToBack === 1`, sin bonus de back-to-back en energía.
- Segunda jugada difícil consecutiva: `backToBack === 2`, energía incluye `Math.floor(baseEnergy * 0.25)`.
- Single ordinario rompe back-to-back: siguiente Quad sin bonus.

**Combo + back-to-back simultáneos:**
- Una jugada difícil con `combo >= 2` y `backToBack >= 2` aplica ambos bonus.
- Total exacto: `baseEnergy + comboEnergyBonus + backToBackEnergyBonus`.

**Fijación sin líneas:**
- `combatEnergy` no cambia.

**Saturación exacta:**
- Con `combatEnergy = 95`, una eliminación Single (`+10`) → `combatEnergy === 100`.

**Excedente:**
- Con `combatEnergy = 100`, cualquier eliminación → `combatEnergy === 100` (el excedente se descarta).

**Atomicidad:**
- Una entrada inválida no muta `combatEnergy`.

**Determinismo:**
- Dos motores con misma semilla y misma secuencia de inputs producen el mismo `combatEnergy` en cada paso.

**No doble aplicación:**
- La energía se actualiza de forma única y atómica durante la fijación. Verificar que la energía no aumenta de forma repetida en un mismo paso o entre pasos en que no haya una fijación de pieza con eliminación de líneas.

**Regresión de puntuación existente:**
- Añadir `combatEnergy` no altera `score`, `combo` ni `backToBack` de las pruebas de 0013 y 0014.

### Web

**`apps/web/src/components/ScorePanel.test.ts`:**
- El componente acepta la prop `combatEnergy`.
- `combatEnergy = 0` → `data-testid="combatEnergy-value"` muestra `'0'`.
- `combatEnergy = 50` → muestra `'50'`.
- `combatEnergy = 100` → muestra `'100'`.

**`apps/web/src/game/types.test.ts`:**
- `GamePresentationState` incluye el campo `combatEnergy`.

**`apps/web/src/App.test.ts`:**
- `App.vue` propaga `combatEnergy` correctamente a los componentes que lo necesitan.

---

## 12. Criterios de aceptación

1. `pnpm test` — todos los tests pasan, incluidas las pruebas nuevas de 0015.
2. `pnpm lint` — sin errores ni avisos en los archivos modificados.
3. `pnpm typecheck` — sin errores en los tres paquetes.
4. `pnpm build` — build exitoso (el aviso de chunk de Phaser no es bloqueante).
5. `pnpm test:e2e` — el test E2E esencial existente sigue pasando.
6. `git diff --check` — sin conflictos de espaciado.
7. Validación manual: `pnpm dev`, abrir la aplicación, jugar una partida y verificar:
   - La barra de energía en `CombatStatusPanel` sube al eliminar líneas.
   - La barra no cambia en fijaciones sin líneas.
   - La barra muestra `0` tras reiniciar.
   - El valor numérico en `ScorePanel` coincide con el esperado según la tabla §5.1.
8. El informe de implementación `docs/implementation/0015-energia-de-combate.md` existe y está completo.
9. `docs/project-status.md` referencia el informe.
10. Working tree limpio al declarar la tarea completada.

---

## 13. Alcance excluido

No se implementa en 0015:

- Consumo de energía.
- Sabotajes funcionales (Residuos, Sobrecarga, Interferencia, Polaridad inversa).
- Segundo tablero funcional.
- Bot heurístico.
- Backend, autenticación, ranking, historial, PostgreSQL.
- Animaciones avanzadas de la barra (llenado progresivo, destello al saturar).
- Audio vinculado a la energía.
- Balance dinámico o configuración editable por usuario.
- Energía negativa.
- Regeneración temporal.
- Modificador de energía de la muerte súbita (+20%).
- Indicador de energía del rival.
- Configuración de `COMBAT_ENERGY_MAX` por perfil (permanece como constante interna).
