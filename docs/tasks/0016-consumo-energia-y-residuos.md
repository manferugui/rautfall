# 0016 — Consumo de energía y Residuos

## Estado

**Aprobada e Inmutable.**

---

## 1. Objetivo y alcance

Implementar en `packages/game-engine`:

1. El **consumo de energía de combate** (`COMBAT_ENERGY_COST = 100`) al alcanzar o superar 100 puntos de energía total.
2. La **conservación del excedente de energía** calculada sobre la energía total de la jugada antes de saturar (`totalEnergy = combatEnergy + generatedEnergy`), limitada a un máximo de **una conversión por fijación**.
3. El **almacenamiento en cartucho FIFO de sabotajes** (`storedSabotages: readonly SabotageType[]`, con capacidad máxima de 2 sabotajes). En la tarea 0016 solo se genera y almacena el sabotaje `'residuos'`.
4. El **lanzamiento/activación de sabotajes** mediante la entrada del usuario (`StepInput.triggerSabotage`), consumiendo el primer sabotaje del cartucho (FIFO) y emitiendo el evento de dominio `sabotageTriggered`.
5. La **recepción y aplicación determinista del sabotaje Residuos (`receiveSabotage('residuos')`)**:
   - `receiveSabotage('residuos')` encola 2 filas de basura entrantes (`pendingGarbage += 2`) sin modificar inmediatamente el tablero mientras haya una pieza activa.
   - Inserción determinista de 2 filas de basura con huecos independientes (columnas 0..9 elegidas mediante el PRNG del motor) en la parte inferior del tablero al fijar la pieza activa (`lockAndProcess()`).
   - `gameOver` inmediato si el desplazamiento hacia arriba expulsa bloques por la parte superior del tablero.
6. La **integración mínima en la interfaz web (`apps/web`)**:
   - `CombatStatusPanel.vue`: sustituir los datos simulados de **CARTUCHO** y **RESIDUOS** por datos reales del snapshot (`storedSabotages` y `pendingGarbage`).
   - Asignación de la tecla `A` en Phaser mediante flanco único (`JustDown`) para lanzar el primer sabotaje del cartucho.
   - Modo de demostración de desarrollo exclusivamente en 1P mediante la query parameter `?sabotage-demo=1`, usando loopback al propio motor.

---

## 2. Antecedentes y decisiones aprobadas

### 2.1 Decisiones aprobadas

1. **Cantidad de filas de basura**: Residuos añade exactamente **2 filas de basura** por sabotaje recibido.
2. **Momento de aplicación**: El sabotaje recibido se aplica en `lockAndProcess()`, **después** de fijar la pieza activa y resolver las líneas eliminadas por el jugador, y **antes** de generar la siguiente pieza.
3. **Huecos independientes vía PRNG**: Cada una de las 2 filas de basura obtiene su propia columna de hueco (0..9) independiente mediante el PRNG determinista del motor (`prng.nextUint32() % 10`).
4. **Regla de top-out por basura**: Si al desplazar la pila hacia arriba para insertar las 2 filas de basura se expulsan celdas ocupadas por la parte superior del tablero (y < 0), se produce `gameOver` inmediato por desbordamiento.
5. **Generación única de Residuos**: En la tarea 0016 se genera y almacena exclusivamente el sabotaje `'residuos'`.
6. **Cartucho FIFO**: El cartucho almacena hasta un máximo de 2 sabotajes con política FIFO (First In, First Out).
7. **Control de lanzamiento**: La tecla `A`, mediante flanco único (`JustDown`), activa `StepInput.triggerSabotage` para lanzar el primer sabotaje disponible en el cartucho.
8. **Consumo, excedente y regla de conversión única por fijación**:
   - La conversión de energía se calcula sobre la energía total de la jugada antes de saturar (`totalEnergy = combatEnergy + generatedEnergy`).
   - Se permite como **máximo una conversión de energía en sabotaje por fijación** (`lockAndProcess()`), incluso si `totalEnergy` pudiese alcanzar o superar 200.
   - Si `storedSabotages.length < 2` y `totalEnergy >= 100`: se almacena **un único** sabotaje `'residuos'` y se asigna la energía restante respetando el rango invariante $0..100$ (`combatEnergy = Math.min(100, totalEnergy - 100)`).
   - Si el cartucho está lleno (`storedSabotages.length === 2`) o `totalEnergy < 100`, no se genera sabotaje y la energía se satura en 100 (`combatEnergy = Math.min(100, totalEnergy)`), descartando cualquier excedente.
9. **Demostración de desarrollo 1P**: La demostración en 1 jugador se activa exclusivamente mediante `?sabotage-demo=1` en la URL de desarrollo, enlazando en loopback el evento `sabotageTriggered` emitido por el motor con `receiveSabotage('residuos')` en la aplicación web.
10. **Encolamiento no destructivo inmediato**: `receiveSabotage('residuos')` encola el efecto incrementando `pendingGarbage` en 2. No altera ni destruye de forma inmediata las celdas del tablero mientras la pieza actual está activa.

---

## 3. Contrato exacto del motor (`packages/game-engine`)

### 3.1 Tipos públicos

```ts
export type SabotageType = 'residuos';

export type EngineSnapshot = Readonly<{
  // ... campos existentes ...
  combatEnergy: number;
  storedSabotages: readonly SabotageType[];
  pendingGarbage: number;
}>;

export type StepInput = Readonly<{
  // ... campos existentes ...
  triggerSabotage?: boolean;
}>;
```

### 3.2 Eventos de dominio

```ts
export type SabotageTriggeredEvent = Readonly<{
  type: 'sabotageTriggered';
  step: number;
  sabotage: SabotageType;
}>;

export type GarbageAppliedEvent = Readonly<{
  type: 'garbageApplied';
  step: number;
  linesCount: number;
}>;
```

### 3.3 API pública del motor

```ts
export interface GameEngine {
  // ... métodos existentes ...
  receiveSabotage(sabotage: SabotageType): void;
}
```

---

## 4. Coste de energía, obtención y cartucho FIFO

1. **Constantes**:
   ```ts
   const COMBAT_ENERGY_COST = 100;
   const MAX_STORED_SABOTAGES = 2;
   ```

2. **Obtención y gestión de excedente en `lockAndProcess()`**:
   - La conversión de energía debe calcularse sobre la energía total de la jugada antes de saturar, garantizando como máximo una conversión por fijación y manteniendo la invariante $0 \le \text{combatEnergy} \le 100$:

   ```ts
   const totalEnergy = combatEnergy + generatedEnergy;

   if (storedSabotages.length < 2 && totalEnergy >= 100) {
     storedSabotages.push('residuos');
     combatEnergy = Math.min(100, totalEnergy - 100);
   } else {
     combatEnergy = Math.min(100, totalEnergy);
   }
   ```

3. **Ejemplos deterministas exactos**:
   - **Ejemplo 1 (`90 + 25`, con espacio en cartucho)**: `totalEnergy = 115`. Como $115 \ge 100$ y hay espacio, se almacena 1 sabotaje `'residuos'` y la energía resultante es `115 - 100 = 15` (`combatEnergy === 15`).
   - **Ejemplo 2 (`100 + 45`, con cartucho lleno `2/2`)**: `totalEnergy = 145`. Al no haber espacio en el cartucho, no se genera sabotaje, `combatEnergy` permanece saturada en 100 (`Math.min(100, 145) = 100`) y el excedente (45) se descarta.
   - **Ejemplo 3 (`100 + 102`, con espacio disponible `1/2`)**: `totalEnergy = 202`. Se realiza un **único** sabotaje `'residuos'`. Al restar 100 quedan 102 de energía remanente; al aplicar la invariante de rango $0..100$, `combatEnergy` queda en 100 (`Math.min(100, 102) = 100`), descartando el exceso secundario. No se generan dos sabotajes en una misma fijación.

---

## 5. Lanzamiento de sabotaje, controles y demostración 1P

1. **Precondición de disparo**: `storedSabotages.length > 0` y `input.triggerSabotage === true` en un paso con `status === 'running'`.
2. **Efectos del disparo**:
   - Se remueve el primer sabotaje de `storedSabotages` (comportamiento FIFO).
   - Se emite el evento de dominio `sabotageTriggered { step, sabotage: 'residuos' }`.
   - Si `combatEnergy === 100` y existía energía retenida no procesada previamente por cartucho lleno, el hueco liberado permite que en la siguiente fijación se pueda volver a acumular/procesar sabotaje.
3. **Cartucho vacío**:
   - Si `storedSabotages.length === 0` e `input.triggerSabotage === true`, la instrucción se ignora de forma silenciosa (no altera el estado ni emite evento).
4. **Atomicidad y neutralización**:
   - La orden se ignora en estados `paused` y `gameOver`.
   - Queda protegida por el guardián de entrada de flanco único (`input-release-guard` / Phaser `JustDown`).
5. **Demostración de desarrollo (`?sabotage-demo=1`)**:
   - En `apps/web`, únicamente cuando la URL contenga `?sabotage-demo=1`, al recibir el evento `sabotageTriggered` emitido por el motor, la capa de integración ejecuta `engine.receiveSabotage(event.sabotage)` en loopback.
   - En ausencia de este parámetro de URL, lanzar un sabotaje solo emite el evento de dominio.

---

## 6. Mecánica de Residuos (Filas basura) y orden exacto de resolución

1. **Encolamiento**: `receiveSabotage('residuos')` incrementa `pendingGarbage` en 2 (`pendingGarbage += 2`). No modifica las celdas del tablero de inmediato.
2. **Orden exacto dentro de `lockAndProcess()`**:
   ```
   1. Evaluar T-Spin (antes de escribir la pieza activa en el tablero)
   2. Escribir la pieza activa en el tablero
   3. Emitir evento pieceLocked
   4. Detectar y eliminar líneas completadas del jugador
   5. Clasificar la jugada, actualizar combo y back-to-back
   6. Calcular y sumar score
   7. Calcular energía ganada (base + combo + B2B) y actualizar combatEnergy / storedSabotages
   8. Emitir evento linesCleared si corresponde
   9. Aplicar basura pendiente (Residuos):
      - Si pendingGarbage >= 2 (o pendingGarbage > 0):
        - Tomar min(pendingGarbage, 2) filas a aplicar (o pendingGarbage completo en tramos de 2).
        - Desplazar la matriz del tablero hacia arriba N filas.
        - Verificar si celdas ocupadas salen del borde superior del tablero (y < 0): si ocurre desbordamiento, activar gameOver inmediato con razón 'garbageOverflow' o 'spawnBlocked'.
        - Rellenar la parte inferior con N filas de basura. Cada fila contiene 9 celdas ocupadas de tipo 'garbage' y 1 celda vacía (hueco).
        - Para cada fila de basura, la columna del hueco (0..9) se obtiene de forma independiente con: prng.nextUint32() % 10.
        - Restar las filas aplicadas de pendingGarbage.
        - Emitir el evento garbageApplied { step, linesCount: 2 }.
   10. Intentar spawn de la siguiente pieza (si la nueva pieza colisiona con el tablero desbordado/elevado, gameOver por 'spawnBlocked').
   11. Limpiar candidatura de rotación para la nueva pieza.
   ```

---

## 7. Entrada y presentación (UI)

1. **Phaser & Controles**:
   - Tecla `KeyA` asignada a `triggerSabotage`.
   - Detección de flanco único (`JustDown`) para evitar lecturas continuas.
2. **`CombatStatusPanel.vue`**:
   - **CARTUCHO**: Eliminar distintivo "SIMULADO". Reflejar `storedSabotages` del snapshot en tiempo real (Slots 1 y 2). Si está vacío, mostrar "VACÍO".
   - **RESIDUOS**: Eliminar distintivo "SIMULADO". Reflejar `pendingGarbage` del snapshot en tiempo real ("Líneas entrantes: N").
3. **`GamePresentationState`**:
   - Ampliado con `storedSabotages: readonly SabotageType[]` y `pendingGarbage: number`.

---

## 8. Determinismo, atomicidad, reset y game over

- **Determinismo**: Mismo seed y misma secuencia de entradas producen exactamente la misma generación de huecos de basura y la misma secuencia de cartuchos.
- **Atomicidad**: La ganancia de energía, consumo, encolamiento en cartucho y aplicación de basura ocurren en bloques atómicos sin estados intermedios inconsistentes.
- **`reset()`**: Restablece `combatEnergy = 0`, `storedSabotages = []` y `pendingGarbage = 0`.
- **`gameOver`**: Los campos `combatEnergy`, `storedSabotages` y `pendingGarbage` se congelan en el snapshot final y no sufren mutaciones posteriores.

---

## 9. Pruebas deterministas obligatorias

Todas las aserciones comprueban **valores exactos**.

### Motor (`packages/game-engine`)

1. **Consumo y excedente de energía**:
   - Con `combatEnergy = 90` y ganancia de `25` -> `totalEnergy = 115`, `combatEnergy === 15` y `storedSabotages === ['residuos']`.
   - Con `combatEnergy = 0`, ganar `115` -> `totalEnergy = 115`, `combatEnergy === 15` y `storedSabotages === ['residuos']`.
2. **Límite de cartucho y saturación**:
   - Con `storedSabotages` lleno (2 sabotajes) y `combatEnergy = 90`, ganar `25` -> `totalEnergy = 115`, `combatEnergy === 100`, `storedSabotages.length === 2` (excedente descartado).
3. **Conversión única por fijación**:
   - Con `combatEnergy = 100` y ganancia de `102` con espacio disponible en cartucho (1/2) -> genera un **único** sabotaje (`storedSabotages.length === 2`) y `combatEnergy === 100`.
4. **Lanzamiento FIFO (`triggerSabotage`)**:
   - Con 1 sabotaje en cartucho y `triggerSabotage: true` -> emite `sabotageTriggered` con `sabotage: 'residuos'`, cartucho queda en `[]`.
   - Con cartucho vacío y `triggerSabotage: true` -> no emite evento y cartucho permanece `[]`.
5. **Encolamiento y aplicación de Residuos**:
   - `receiveSabotage('residuos')` -> `pendingGarbage === 2`. No altera celdas de tablero antes de la fijación.
   - Tras `lockAndProcess()`, `pendingGarbage === 0`, el tablero tiene 2 filas basura en la parte inferior, se emite `garbageApplied` con `linesCount === 2`.
6. **Huecos independientes vía PRNG**:
   - Verificar que la fila 1 y la fila 2 obtienen columnas de hueco llamadas consecutivamente a `prng.nextUint32() % 10`.
7. **Orden de resolución (Líneas del jugador vs Residuos)**:
   - Si el jugador hace Quad en un tablero lleno abajo y hay 2 residuos pendientes -> primero se eliminan las 4 filas del jugador y posteriormente se suben las 2 filas de basura.
8. **Top-out por desbordamiento de basura**:
   - Tablero con celdas ocupadas en las filas superiores + residuo aplicado -> `gameOver` inmediato por expulsión de celdas por la parte superior.

### Web (`apps/web`)

1. **`CombatStatusPanel.test.ts`**:
   - Muestra el cartucho real (`storedSabotages`) y residuos pendientes (`pendingGarbage`).
   - Verifica la ausencia de los distintivos `SIMULADO`.
2. **`App.test.ts`**:
   - Propagación de `storedSabotages` y `pendingGarbage` al estado de presentación y componentes.
3. **Modo demo (`?sabotage-demo=1`)**:
   - Con la query parameter activa, emite `sabotageTriggered` e invoca `receiveSabotage('residuos')` en loopback.

---

## 10. Criterios de aceptación

1. `pnpm test` pasando en todos los paquetes.
2. `pnpm lint` sin errores ni avisos en archivos modificados.
3. `pnpm typecheck` limpio.
4. `pnpm build` exitoso.
5. `pnpm test:e2e` pasando.
6. `git diff --check` limpio.
7. Validación manual con `pnpm dev`:
   - Al ganar 100 de energía se añade el sabotaje al cartucho y se conserva el remanente.
   - Pulsar `A` lanza el sabotaje.
   - Con `?sabotage-demo=1`, el sabotaje lanzado aplica 2 filas basura al propio tablero de forma determinista.

---

## 11. Alcance excluido

Queda explícitamente excluido de la tarea 0016:

- Bolsa con los cuatro sabotajes (Sobrecarga, Interferencia, Polaridad inversa).
- Efectos de estado temporales de Sobrecarga, Interferencia o Polaridad inversa.
- Selección manual de sabotajes.
- Segundo tablero interactivo real / rival.
- Bot IA rival.
- Multijugador y backend.
- Efectos visuales avanzados / partículas / animaciones complejas de filas basura.
- Audio.
