# 0018 — Progresión determinista de nivel y gravedad

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

Implementar en `packages/game-engine` y su integración en `apps/web`:

1. La **progresión determinista de nivel** iniciada en **Nivel 1** hasta **Nivel 10** como nivel máximo.
2. La condición de subida de nivel basada en las líneas acumuladas eliminadas (`clearedLines` / `linesCleared`):
   $$\text{level} = \min\left(10, \lfloor \frac{\text{clearedLines}}{10} \rfloor + 1\right)$$
3. La **tabla determinista de gravedad base por nivel** (`baseGravityCellsPerSecond`), de $1.00\text{ c/s}$ a $10.00\text{ c/s}$.
4. La actualización de la **gravedad activa** (`activeGravityCellsPerSecond`), la cual es:
   - Igual a `baseGravityCellsPerSecond` cuando no hay sabotajes activos.
   - Igual a $\text{baseGravityCellsPerSecond} \times 3$ cuando el sabotaje **Sobrecarga** está activo.
5. El mantenimiento **estrictamente inalterado de Soft Drop**:
   ```ts
   const activeCellsPerSecond = input.softDropHeld
     ? config.softDropCellsPerSecond
     : activeGravityCellsPerSecond;
   ```
   No se debe utilizar `Math.max(config.softDropCellsPerSecond, activeGravityCellsPerSecond)`.
6. El mantenimiento inalterado de los parámetros de fijación diferida (`config.lockDelayMs` y `config.maxLockResets`), garantizando que la progresión de nivel no modifica la configuración de lock delay ni introduce literales dentro de la lógica de nivel.
7. La exposición de `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond` en `EngineSnapshot` y en `GamePresentationState`.
8. El evento de dominio **`LevelUpEvent` (`levelUp`)**, emitido una sola vez cuando el nivel cambia tras eliminar líneas.
9. Los modos de demostración de desarrollo **`?level-demo=1`** y **`?level-demo=10`** en `apps/web` (solo entorno DEV).
10. La suite de pruebas deterministas obligatorias para validar la lógica de progresión, eventos, gravedad activa, configuraciones alternativas y soft drop.

---

## 2. Antecedentes y decisiones aprobadas

1. **Nivel inicial**: La partida arranca siempre en **Nivel 1** (`level = 1`), salvo en contextos de prueba o modos demo de desarrollo.
2. **Nivel máximo**: El nivel máximo alcanzable es **10** (`MAX_LEVEL = 10`). Superar las 90 líneas acumuladas mantiene la partida en Nivel 10.
3. **Fórmula de subida**: `level = Math.min(10, Math.floor(clearedLines / 10) + 1)`.
   - 0–9 líneas: Nivel 1.
   - 10–19 líneas: Nivel 2.
   - 20–29 líneas: Nivel 3.
   - ...
   - 90+ líneas: Nivel 10.
4. **Tabla de gravedad base**:

| Nivel | Gravedad Base (`baseGravityCellsPerSecond`) | Intervalo por caída |
| :---: | :---: | :---: |
| **1** | $1.00\text{ celdas/s}$ | $1000.00\text{ ms/celda}$ |
| **2** | $1.25\text{ celdas/s}$ | $800.00\text{ ms/celda}$ |
| **3** | $1.50\text{ celdas/s}$ | $666.67\text{ ms/celda}$ |
| **4** | $2.00\text{ celdas/s}$ | $500.00\text{ ms/celda}$ |
| **5** | $2.50\text{ celdas/s}$ | $400.00\text{ ms/celda}$ |
| **6** | $3.00\text{ celdas/s}$ | $333.33\text{ ms/celda}$ |
| **7** | $4.00\text{ celdas/s}$ | $250.00\text{ ms/celda}$ |
| **8** | $5.00\text{ celdas/s}$ | $200.00\text{ ms/celda}$ |
| **9** | $7.00\text{ celdas/s}$ | $142.86\text{ ms/celda}$ |
| **10** | $10.00\text{ celdas/s}$ | $100.00\text{ ms/celda}$ |

5. **Puntuación inalterada**: No se aplica multiplicador de nivel a la puntuación. Las reglas de puntuación para eliminación de líneas, Soft Drop y Hard Drop no se modifican.
6. **Combos, T-Spins, Back-to-Back y Energía inalterados**: Las fórmulas y bonificaciones de combos, T-Spins, Back-to-Back y energía de combate permanecen idénticas a las tareas 0013, 0014 y 0015.
7. **`Lock delay` y reinicios inalterados por configuración**:
   - La progresión de nivel **no modifica** `config.lockDelayMs`.
   - La progresión de nivel **no modifica** `config.maxLockResets`.
   - Con `prototypeConfig`, sus valores actuales continúan siendo:
     - `lockDelayMs = 500`;
     - `maxLockResets = 15`;
   - Las configuraciones válidas alternativas conservan sus propios valores de `lockDelayMs` y `maxLockResets`.
   - No se introducen literales de lock delay o reinicios dentro de la lógica de nivel.
8. **Sobrecarga ($3\times$)**: Cuando el efecto Sobrecarga está activo, `activeGravityCellsPerSecond = baseGravityCellsPerSecond * 3`. Por ejemplo, a Nivel 5 ($2.50\text{ c/s}$), Sobrecarga produce $7.50\text{ c/s}$. A Nivel 10 ($10.00\text{ c/s}$), produce $30.00\text{ c/s}$.
9. **Soft Drop strictly inalterado**: Durante Soft Drop (`input.softDropHeld === true`), la velocidad activa de descenso es estrictamente `config.softDropCellsPerSecond` ($20.0\text{ c/s}$), sin usar `Math.max`. Hard drop, DAS, ARR, SRS y lock delay no cambian.
10. **Muerte súbita fuera de alcance**: Muerte súbita permanece fuera de esta tarea.

---

## 3. Orden de actualización tras una fijación con líneas

Tras fijar una pieza y detectar la eliminación de 1 a 4 líneas en `lockAndProcess()`, el motor ejecutará la secuencia en el siguiente orden exacto:

1. Eliminar simultáneamente las líneas completas.
2. Actualizar `clearedLines`.
3. Guardar `previousLevel`.
4. Calcular:
   $$\text{newLevel} = \min\left(10, \lfloor \frac{\text{clearedLines}}{10} \rfloor + 1\right)$$
5. Si `newLevel !== previousLevel`:
   - Actualizar `level = newLevel`.
   - Derivar `baseGravityCellsPerSecond` desde la tabla del nuevo nivel.
   - Emitir exactamente un evento `levelUp` con:
     - `previousLevel`;
     - `newLevel`;
     - `baseGravityCellsPerSecond`.
6. Si el nivel no cambia:
   - No emitir `levelUp`.
   - Conservar la gravedad base correspondiente al nivel actual.
7. Continuar con puntuación, combo, back-to-back, energía, basura y spawn conforme al orden ya establecido, sin cambiar sus reglas.

---

## 4. Contrato exacto del motor (`packages/game-engine`)

### 4.1 Evento de dominio `levelUp` y regla de salto múltiple

```ts
export interface LevelUpEvent {
  type: 'levelUp';
  step: number;
  previousLevel: number;
  newLevel: number;
  baseGravityCellsPerSecond: number;
}
```

#### Reglas del evento `levelUp`:
- Se emite **exactamente una vez** cuando el nivel calculado cambia tras una fijación con eliminación de líneas.
- **Defensa general ante saltos múltiples**:
  - En jugada ordinaria, una pieza elimina como máximo 4 líneas, por lo que con el umbral de 10 líneas por nivel una fijación normal no puede saltar varios niveles de golpe.
  - Si un estado preparado (en pruebas o escenarios demo), una migración futura o un helper interno de test provoca que `clearedLines` cruce varios umbrales de una sola vez, la evaluación emite **un único evento `levelUp`** que contiene el nivel anterior (`previousLevel`) y el nivel final alcanzado (`newLevel`).
  - **No se añadirá ninguna API pública de producción** para forzar líneas, nivel o saltos múltiples. Las pruebas reutilizarán la infraestructura interna de estados preparados existente o helpers privados de test.
- **No se emite** al instanciar el motor mediante `createGameEngine()`.
- **No se emite** al ejecutar `reset()`.
- **No se emite** si la eliminación de líneas no altera el valor de `level` (por ejemplo, al pasar de 2 a 5 líneas dentro del Nivel 1).

### 4.2 Snapshot del motor (`EngineSnapshot`) y estado de presentación (`GamePresentationState`)

`EngineSnapshot` y `GamePresentationState` deben incluir las siguientes 3 propiedades:

```ts
export type EngineSnapshot = Readonly<{
  step: number;
  elapsedMs: number;
  status: EngineStatus;
  seed: number;
  configVersion: string;
  board: ReadonlyArray<ReadonlyArray<PieceType | 'garbage' | null>>;
  activePiece: ActivePieceSnapshot | null;
  nextPieces: readonly PieceType[];
  clearedLines: number;
  heldPiece: PieceType | null;
  score: number;
  combo: number;
  backToBack: number;
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  pendingGarbage: number;
  activeEffects: readonly ActiveEffectSnapshot[];
  level: number;
  baseGravityCellsPerSecond: number;
  activeGravityCellsPerSecond: number;
}>;
```

#### Definición de gravedades en el Snapshot:
- `baseGravityCellsPerSecond`: Depende exclusivamente del nivel según la tabla oficial de gravedad.
- `activeGravityCellsPerSecond`:
  - Igual a `baseGravityCellsPerSecond` sin Sobrecarga activa.
  - Igual a `baseGravityCellsPerSecond * 3` con Sobrecarga activa.
- Durante `input.softDropHeld === true`, el motor aplica internamente la velocidad fija `config.softDropCellsPerSecond`, aunque `activeGravityCellsPerSecond` sea mayor.

---

## 5. Integración en la interfaz web (`apps/web`)

### 5.1 Consola de presentación táctica
- `ScorePanel.vue` o el componente táctico correspondiente renderizará el nivel y la gravedad activa:
  - `NIVEL`: Muestra el valor de `level` (ejemplo: `1`, `5`, `10`).
  - `GRAVEDAD`: Muestra `activeGravityCellsPerSecond` formateado (ejemplo: `1.00 c/s` o `3.00 c/s` durante Sobrecarga).

### 5.2 Modos de demostración de desarrollo (`?level-demo=1` y `?level-demo=10`)

Solo en entorno DEV (`import.meta.env.DEV`), la aplicación web soportará los parámetros de consulta `?level-demo=1` y `?level-demo=10`:

1. **`?level-demo=1`**:
   - Inicializa el motor en **Nivel 1** con **9 líneas acumuladas** (`linesCleared = 9`).
   - Dispone un tablero con celdas preparadas para que la primera fijación elimine al menos una línea.
   - Al fijar la primera pieza, el motor alcanza 10 líneas, pasa a Nivel 2 y emite el evento `levelUp`.
2. **`?level-demo=10`**:
   - Inicializa el motor en **Nivel 10** con **90 líneas acumuladas** (`linesCleared = 90`).
   - Dispone un tablero jugable y una gravedad base de $10.00\text{ c/s}$.
   - Permite verificar el comportamiento del motor a máxima velocidad y la invarianza al seguir eliminando líneas en Nivel 10.

#### Reglas de los modos demo:
- Solo existen en entorno de desarrollo.
- No añaden API pública de producción.
- No alteran el flujo normal de la partida.
- Permiten validar manualmente nivel, gravedad base, Sobrecarga y `reset()`.

---

## 6. Pruebas obligatorias

La suite de pruebas deterministas en `packages/game-engine/src/game-engine.test.ts` y en `apps/web` debe verificar:

1. **Nivel inicial**: Al crear el motor o reiniciar con `reset()`, `level === 1`, `baseGravityCellsPerSecond === 1.0` y `clearedLines === 0`.
2. **Umbrales de nivel 2 a 10**:
   - 0–9 líneas $\rightarrow$ Nivel 1 ($1.00\text{ c/s}$).
   - 10 líneas $\rightarrow$ Nivel 2 ($1.25\text{ c/s}$).
   - 20 líneas $\rightarrow$ Nivel 3 ($1.50\text{ c/s}$).
   - 30 líneas $\rightarrow$ Nivel 4 ($2.00\text{ c/s}$).
   - 40 líneas $\rightarrow$ Nivel 5 ($2.50\text{ c/s}$).
   - 50 líneas $\rightarrow$ Nivel 6 ($3.00\text{ c/s}$).
   - 60 líneas $\rightarrow$ Nivel 7 ($4.00\text{ c/s}$).
   - 70 líneas $\rightarrow$ Nivel 8 ($5.00\text{ c/s}$).
   - 80 líneas $\rightarrow$ Nivel 9 ($7.00\text{ c/s}$).
   - 90 líneas $\rightarrow$ Nivel 10 ($10.00\text{ c/s}$).
3. **Permanencia en Nivel 10**: Superar las 90 líneas (ejemplo: 95 o 100 líneas) mantiene `level === 10` y `baseGravityCellsPerSecond === 10.00`.
4. **Salto múltiple de nivel (defensa de cálculo)**: Probar mediante infraestructura interna de test (sin API pública nueva) que forzar una eliminación que cruce varios umbrales (ejemplo: de 8 a 22 líneas) pasa de Nivel 1 a Nivel 3 emitiendo un único evento `levelUp` con `previousLevel: 1` y `newLevel: 3`.
5. **Emisión única de `levelUp`**: Verificar que `levelUp` solo se emite cuando `newLevel !== previousLevel`.
6. **Ausencia de evento**: Limpiar líneas sin cambiar de nivel (ejemplo: de 2 a 5 líneas dentro de Nivel 1) no emite el evento `levelUp`.
7. **Gravedad base exacta**: Comprobar que `baseGravityCellsPerSecond` coincide exactamente con la tabla oficial para cada nivel.
8. **Sobrecarga $3\times$ sobre gravedad base**: Al activar Sobrecarga a Nivel 5, `activeGravityCellsPerSecond` pasa a $7.50\text{ c/s}$.
9. **Soft Drop estricto**: Con `softDropHeld === true`, la velocidad aplicada por el motor es exactamente `config.softDropCellsPerSecond`, independientemente de la gravedad activa.
10. **Invarianza de lock delay por configuración**: Probar con una configuración alternativa con `lockDelayMs` y `maxLockResets` distintos (ejemplo: `lockDelayMs: 400`, `maxLockResets: 10`), demostrando que la progresión de nivel conservará dichos valores intactos sin imponer literales de 500 ms o 15 reinicios.
11. **Comportamiento en `reset()`**: Restablece a Nivel 1, gravedad base $1.00\text{ c/s}$ y sin evento `levelUp`.
12. **Pausa y Game Over**: Congelan el nivel, la gravedad base y la gravedad activa en el snapshot.
13. **Determinismo**: Mismas semillas e historial de inputs producen exactamente los mismos niveles, eventos `levelUp` y gravedades.

---

## 7. Exclusiones explícitas

Se excluye de forma estricta de la Tarea 0018:

- Muerte súbita.
- Modificaciones o escalado de `lock delay` por nivel.
- Modificación de multiplicadores de puntuación por nivel.
- Bot / IA heurística.
- Segundo tablero.
- Multijugador y conexión en red.
- Nuevos sabotajes (Polaridad inversa, Interferencia).
- Editor dinámico de balance editable en tiempo de ejecución.

---

## 8. Criterios de aceptación

1. El motor arranca en `level = 1` con `baseGravityCellsPerSecond = 1.00`.
2. Cada 10 líneas acumuladas incrementa el nivel en 1 hasta el máximo de 10.
3. `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond` reflejan fielmente la tabla oficial y el multiplicador de Sobrecarga ($3\times$).
4. Soft Drop utiliza exactamente `config.softDropCellsPerSecond`.
5. La progresión de nivel conserva intactos `config.lockDelayMs` y `config.maxLockResets` sin harcodear literales.
6. `EngineSnapshot` y `GamePresentationState` incluyen `level`, `baseGravityCellsPerSecond` y `activeGravityCellsPerSecond`.
7. El evento `levelUp` se emite según las reglas (una vez por cambio de nivel; único evento en salto múltiple; sin evento si el nivel no varía).
8. Los modos demo `?level-demo=1` y `?level-demo=10` permiten la verificación en desarrollo.
9. `pnpm test`, `pnpm lint`, `pnpm typecheck` y `pnpm build` finalizan sin errores ni avisos.
