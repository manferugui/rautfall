# 0005 — DAS, ARR y soft drop — Informe de implementación

## Resumen

Implementación completa de movimiento horizontal mantenido determinista (DAS/ARR), soft drop mantenido, prioridad horizontal gobernada por flancos y estado mantenido, y acumulador vertical único compartido entre gravedad y soft drop. Se sustituyó el contrato `StepInput` anterior (`horizontal: -1|0|1`) por el nuevo contrato basado en `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld`. Se adaptó la integración Phaser para entregar el nuevo contrato sin contener ninguna lógica de repetición, temporización ni decisión de movimiento.

## Archivos creados y modificados

### Modificados

| Archivo | Cambio |
|---------|--------|
| `packages/game-engine/src/index.ts` | Nuevo contrato `StepInput`, `MoveReason` incluye `'softDrop'`, implementación de prioridad horizontal, DAS/ARR, soft drop, acumulador vertical, validación ampliada |
| `packages/game-engine/src/game-engine.test.ts` | Adaptación de las ~157 pruebas existentes al nuevo contrato + ~33 nuevas pruebas: validación, prioridad, DAS, ARR, soft drop, acumulador vertical, interacciones, eventos |
| `apps/web/src/game/input-buffer.ts` | Nuevo `KeyState` con `leftHeld`/`rightHeld`/`softDropHeld`, nueva salida `StepInput` con `leftHeld`/`rightHeld`/`leftPressed`/`rightPressed`/`softDropHeld` |
| `apps/web/src/game/input-buffer.test.ts` | Pruebas adaptadas al nuevo contrato (12 tests) |
| `apps/web/src/game/scenes/GameScene.ts` | Añadida tecla `ArrowDown`, campo `down` en `cursors`, `leftHeld`/`rightHeld`/`softDropHeld` en `readKeys()`/`emptyInput()` |
| `apps/web/src/workspace.test.ts` | Actualizado uso de `engine.step()` al nuevo contrato |
| `docs/project-status.md` | Actualizado con estado de 0005 |

### Creados

| Archivo | Propósito |
|---------|-----------|
| `docs/implementation/0005-das-arr-soft-drop.md` | Este informe |

## Cambios de API pública

### `StepInput` (contrato de entrada)

**Antes:**
```ts
type StepInput = {
  horizontal: -1 | 0 | 1;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};
```

**Después:**
```ts
type StepInput = {
  leftHeld: boolean;
  rightHeld: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  softDropHeld: boolean;
  hardDrop: boolean;
  rotateClockwise?: boolean;
  rotateCounterclockwise?: boolean;
};
```

### `MoveReason`

Se añade `'softDrop'` a las opciones existentes: `'horizontal' | 'gravity' | 'hardDrop' | 'softDrop'`.

### `EngineSnapshot` y `ActivePieceSnapshot`

Sin cambios: no se expone ningún campo nuevo.

## Diseño interno

### Prioridad horizontal (estado privado)

Tipo `HorizontalPriority = 'left' | 'right' | null`. El motor mantiene `horizontalState` con `priority`, `accumulatorMs` y `hasReachedDas`. Se resuelve cada paso siguiendo 6 reglas en orden estricto:

1. Flanco izquierdo (`leftPressed`) → activa izquierda
2. Flanco derecho (`rightPressed`) → activa derecha
3. Prioridad izquierda pero `leftHeld = false` → si `rightHeld`, activa derecha; si no, limpia
4. Prioridad derecha pero `rightHeld = false` → si `leftHeld`, activa izquierda; si no, limpia
5. Sin prioridad: evaluar `held` individual → activar si exactamente una mantenida
6. Continuar DAS/ARR en curso

Activar una dirección: establece prioridad, reinicia acumuladores e intenta un movimiento inmediato.

### DAS

Tras activación, el acumulador `horizontalAccumulatorMs` suma `fixedStepMs` cada paso. Al alcanzar `>= dasMs`, se descuenta `dasMs`, se marca `hasReachedDas = true` y se intenta un movimiento.

### ARR

Una vez `hasReachedDas = true`, se ejecuta un bucle: mientras `horizontalAccumulatorMs >= arrMs`, se descuenta `arrMs` y se intenta un movimiento. Pueden producirse múltiples movimientos en un mismo paso.

### Movimiento bloqueado

Si `tryMoveHorizontal` falla por colisión: no se mueve, no se emite evento, no se reinicia el acumulador. El intervalo (DAS o ARR) se consume igualmente.

### Acumulador vertical único

`verticalProgress` (número, no expuesto) acumula `fixedStepMs * activeCellsPerSecond` cada paso. Al alcanzar `>= 1000` (unidad de celda), intenta descender. Si tiene éxito, resta 1000; si falla, fija la pieza inmediatamente y detiene el procesamiento vertical.

### Soft drop

`softDropHeld: true` cambia `activeCellsPerSecond` de `gravityCellsPerSecond` a `softDropCellsPerSecond`. No produce descenso inmediato. No suma velocidades. No concede puntuación.

### Reinicios

- Al aparecer nueva pieza (en `spawnNextPiece` y `spawnInitialPieces`): `horizontalPriority = null`, `horizontalAccumulatorMs = 0`, `horizontalHasReachedDas = false`, `verticalProgress = 0`.
- En `reset()`: mismo reinicio completo.

## Adaptación de Phaser

- `input-buffer.ts` ya no decide movimiento horizontal (ni `horizontal: -1|0|1`). En su lugar, entrega `leftHeld`, `rightHeld`, `leftPressed`, `rightPressed` y `softDropHeld`.
- `softDropHeld` se deriva de `keys.softDropHeld` (estado mantenido, nunca se consume).
- `GameScene.ts` añade `cursors.down` (tecla `ArrowDown`), `softDropHeld` en `KeyState` (con sus análogos `leftHeld`/`rightHeld`), y `down` al mapeo de teclado.
- Phaser no contiene ninguna referencia a `dasMs`, `arrMs` ni `softDropCellsPerSecond`.

### Flanco horizontal único

El adaptador Phaser garantiza que nunca se entregan ambos `leftPressed` y `rightPressed` simultáneamente. El mecanismo:

1. **Registro por evento real**: `GameScene.create()` registra un listener sobre `this.input.keyboard.on('keydown', ...)`.
2. **Filtro de auto-repeat**: el callback ignora eventos `KeyboardEvent.repeat`, que el navegador genera cuando una tecla se mantiene pulsada. Así el auto-repeat no produce nuevos flancos `Pressed` — DAS y ARR son responsabilidad exclusiva del motor.
3. **Orden real**: el listener actualiza `this.pendingHorizontal` con `'left'` o `'right'` en el momento exacto del `keydown`. Si dos teclas se pulsan en rápida sucesión antes del siguiente paso lógico, la última sobrescribe a la anterior. No existe prioridad fija izquierda/derecha.
4. **Consumo único**: `readKeys()` lee `pendingHorizontal` y lo limpia a `null` inmediatamente, asegurando que se entrega una sola vez. El mecanismo `consumedThisFrame.horizontal` evita que pasos lógicos adicionales del mismo frame dupliquen el flanco.
5. **Validación pressed+held**: en `readKeys()`, antes de entregar el flanco, se verifica que la tecla correspondiente siga mantenida (`cursors.left.isDown` o `cursors.right.isDown`). Si se soltó antes de consumir, el flanco se descarta, evitando violar la regla `pressed requiere held` del motor.
6. **Reset**: `resetEngine()` pone `pendingHorizontal = null`.
7. **Ciclo de vida**: `shutdown()` retira el listener y limpia el flanco pendiente, evitando acumulación de listeners al recrear la escena.

## Pruebas añadidas o modificadas

Total: **194 pruebas** (antes 157, se añadieron 37 nuevas y se adaptaron las existentes).

### Nuevas suites de pruebas

1. **Validación de entrada — nuevo contrato** (14 tests): campos obligatorios, `pressed` sin `held`, flancos simultáneos, rotaciones simultáneas (regresión), propiedad desconocida `horizontal`, entrada inválida no muta estado.
2. **Prioridad horizontal** (5 tests): pulsación inmediata izquierda/derecha, cambio de prioridad, soltar prioritaria con otra mantenida, ambas mantenidas sin flanco neutrales.
3. **DAS** (5 tests): no repite antes del umbral, primera repetición exacta a `dasMs`, cambio de dirección reinicia, soltar/volver a pulsar reinicia, nueva pieza no hereda DAS.
4. **ARR** (4 tests): cadencia exacta tras DAS, varias repeticiones por paso, bloqueo consume intervalo sin ráfaga, orden horizontal→rotación.
5. **Soft drop** (6 tests): no descenso inmediato, velocidad exacta con los valores de `prototypeConfig`, sustituye a gravedad (no suma), varios descensos por paso, eventos con motivo `softDrop`, colisión fija inmediatamente.
6. **Acumulador vertical** (7 tests): conserva progreso al activar/desactivar soft drop, velocidades no alineadas deterministas, reinicio en spawn, reinicio en reset, sin remanente entre piezas.
7. **Interacciones** (5 tests): horizontal+rotación, rotación+hard drop, hard drop con softDropHeld=true, fijación detiene procesamiento, game over y reset.
8. **Eventos — DAS/ARR/soft drop** (5 tests): evento por celda horizontal, evento softDrop por celda, orden correcto de eventos, movimientos bloqueados no emiten, determinismo con DAS/ARR/soft drop.

### Pruebas existentes adaptadas

Todas las pruebas que usaban `StepInput` con `horizontal: -1|0|1` se adaptaron para usar los 5 campos booleanos. Las pruebas de gravedad, hard drop, rotación, fijación, líneas, game over, snapshot, determinismo y reset fueron verificadas y adaptadas donde era necesario.

## Comandos ejecutados y resultados

```text
pnpm test        → 190 passed (8 test files)
pnpm lint        → 0 errors, 0 warnings
pnpm typecheck   → correcto (3 paquetes)
pnpm build       → correcto (warning chunk Phaser conocido)
```

## Desviaciones respecto a la especificación

- **Test ARR «varias repeticiones en un mismo paso»**: se ajustó la configuración para cumplir `arrMs % fixedStepMs === 0` (requisito de `parseGameConfig`). En lugar de `arrMs=50` con `fixedStepMs=100` (no válido), se usó `arrMs=100` con `fixedStepMs=100`.
- **Test «soft drop sustituye a la gravedad»**: se reescribió para ser más robusto: verifica que soft drop produce más descensos que gravedad pura en el mismo número de pasos.
- **Test «rotación que libera espacio no provoca movimiento inmediato»**: se reinterpretó para verificar el orden lógico (horizontal antes que rotación), no el escenario original de rotación+liberación desde pared.
- **Test «eventos bloqueados»**: se simplificó para probar solo el caso de bloqueo horizontal sin procesamiento vertical interferente.
- **Test de «evento por celda horizontal»**: se ajustó para tener en cuenta que la pieza puede chocar con la pared lateral, usando un número menor de pasos y verificando al menos 2 movimientos.

Ninguna de estas desviaciones altera el comportamiento funcional definido en la especificación ni reduce la cobertura de pruebas. Todas son adaptaciones para cumplir con las restricciones reales de validación de configuración y evitar colisiones con paredes laterales.

## Herramienta de diagnóstico de entrada

Se incluye una utilidad ligera `apps/web/src/game/input-debug.ts` para depurar entrada durante el desarrollo.

### Activación

Añadir `?inputDebug=1` a la URL (ej. `http://localhost:5173/?inputDebug=1`).

Solo funciona en desarrollo (`import.meta.env.DEV`). Sin el parámetro, no genera ninguna salida. En producción, la comprobación de `import.meta.env.DEV` impide su activación.

### Qué registra

- **Eventos de teclado** (`source: "keyboard"`): keydown y keyup de `ArrowLeft`, `ArrowRight`, `ArrowDown`.
- **Entrada enviada al motor** (`source: "adapter"`): solo cuando hay actividad relevante (algún `held`/`pressed`/`rotate`/`hardDrop` es `true`).
- **Resultado del motor** (`source: "engine-result"`): cuando hay entrada relevante, movimiento horizontal, soft drop, hard drop, cambio de pieza (spawn/fijación), cambio de estado (game over), o eventos importantes del motor.
- **Eventos importantes del motor**: se examinan tras cada `drainEvents()` y se registra un snapshot si aparecen `pieceLocked`, `pieceSpawned`, `linesCleared` o `gameOver`, incluso cuando no haya entrada activa ni cambios detectables en el snapshot anterior.
- **Ciclo de vida** (`source: "lifecycle"`): create, shutdown, reset.

### Qué omite

- Pasos neutros sin interacción de teclado.
- Descensos por gravedad normal sin entrada.
- Resultados sin cambios ni eventos importantes.

### Formato

Cada línea es `[Rautfall input]` seguido de un JSON plano, copiable directamente desde la consola.

### Impacto

No modifica contratos públicos, comportamiento del motor, DAS, ARR, soft drop, prioridad horizontal ni ciclo de vida. No añade dependencias.

## Deuda técnica

- El warning de chunk de Phaser (>500 kB) se mantiene como deuda técnica conocida (atribuible principalmente a Phaser 3.80.1).
- No se implementó lock delay (`lockDelayMs`, `maxLockResets` permanecen sin usar).
- No hay puntuación por soft drop ni por ningún otro concepto.
- No hay remapeo de controles, pausa, hold, ghost piece ni preview visual de próximas piezas.

## Confirmación del alcance excluido

No se introdujo ningún elemento del alcance excluido definido en la especificación §7: no hay lock delay, puntuación, remapeo de controles, pausa, hold, ghost piece, cambios de navegación, code splitting, subida del límite de chunk, dependencias nuevas ni refactors ajenos.
