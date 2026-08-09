# Tarea 0027 — Cierre de protecciones y mecánicas pendientes de combate del MVP

## 1. Objetivo
Cerrar las protecciones y mecánicas pendientes del sistema de combate del MVP:
- Interferencia;
- aviso previo de sabotajes temporales;
- inmunidad post-efecto;
- límite máximo de basura pendiente;
- equivalencia funcional humano/bot;
- preservación del determinismo.

## 2. Alcance

### Interferencia
- Nuevo `SabotageType: 'interferencia'`.
- Sabotage 4-Bag.
- Efecto de percepción gestionado en `battle-engine`.
- Duración: 5.000 ms de tiempo lógico.
- No modifica física ni controles locales.
- Humano: monitor rival oculto/distorsionado.
- Bot: percepción del rival congelada durante el efecto.
- La percepción congelada debe ser la última válida inmediatamente anterior a la activación.

### Warning
- Solo para:
  - `sobrecarga`;
  - `polaridad`;
  - `interferencia`.
- Duración: 750 ms.
- `residuos` no utiliza warning.
- Un warning creado en un step no pierde tiempo durante ese mismo step.
- No pueden coexistir warnings duplicados del mismo sabotaje para un participante.

### Política de bloqueo de sabotajes temporales
Bloquear y emitir evento cuando:
- existe inmunidad del mismo sabotaje;
- el mismo efecto ya está activo;
- existe warning pendiente del mismo sabotaje.

El sabotaje ya consumido por el emisor no vuelve al cartucho.

### Inmunidad
- Aplica únicamente a:
  - `sobrecarga`;
  - `polaridad`;
  - `interferencia`.
- Duración: 4.000 ms de tiempo lógico.
- Comienza al expirar el efecto correspondiente.
- Una inmunidad creada en un step no pierde tiempo en ese mismo step.
- `residuos` no utiliza inmunidad.

### Garbage cap
- `MAX_PENDING_GARBAGE = 4`.
- La saturación se aplica al recibir nueva basura.
- El excedente se descarta.
- No modificar algoritmo PRNG de huecos, aplicación de basura ni `garbageOverflow`.
- Mantener `residuos` en +2 filas existentes; esta tarea no rebalancea el sabotaje.

## 3. Orden canónico de BattleSession.step()

1. validar entradas;
2. incrementar step y elapsedMs;
3. actualizar Muerte Súbita;
4. avanzar timers existentes de Interferencia, inmunidades y warnings;
5. resolver expiraciones y activaciones;
6. ejecutar ambos `game-engine` en lockstep;
7. drenar eventos de ambos motores;
8. crear inmunidades derivadas de `effectExpired`;
9. resolver terminalidad;
10. rutear sabotajes disparados en el step;
11. actualizar percepción permitida de ambos participantes.

Regla:
un warning, efecto o inmunidad creado durante el step no se decrementa en ese mismo step.

## 4. Arquitectura

### `game-engine`
Responsable de:
- ampliar `SabotageType`;
- Sabotage 4-Bag;
- garbage cap;
- mantener efectos locales de ejecución existentes;
- rama defensiva no-op para `receiveSabotage('interferencia')`.

No debe implementar la semántica real de percepción de Interferencia.

### `battle-engine`
Responsable de:
- warnings;
- inmunidades;
- Interferencia;
- percepción del rival;
- enrutamiento;
- bloqueo de sabotajes;
- equivalencia humano/bot.

### `apps/web`
Responsable únicamente de presentación:
- velo `SEÑAL INTERFERIDA`;
- consumo de snapshots;
- sin temporización ni reglas de dominio.

## 5. Determinismo
- Toda duración se expresa en ms de tiempo lógico.
- No asumir un número fijo de steps.
- Calcular límites a partir de `config.fixedStepMs`.
- Prohibidos `Date.now`, `performance.now`, `setTimeout`, `setInterval` y `Math.random()` en lógica de dominio.
- Misma seed + configuración + inputs + sabotajes + pasos => mismo resultado.

## 6. Balance fuera de alcance
No modificar:
- Sobrecarga x3 durante 10 s.
- Residuos +2 filas.
- scoring;
- energía;
- política general del bot;
- Muerte Súbita.

Documentar que existe divergencia respecto a valores de diseño anteriores, pero que no forma parte del rebalance de esta tarea.

## 7. Pruebas requeridas
Cubrir como mínimo:
- warning exacto;
- activación exacta;
- Interferencia exacta;
- inmunidad exacta;
- bloqueo por warning pendiente;
- bloqueo por efecto activo;
- bloqueo por inmunidad;
- simultaneidad;
- reset;
- límites de step;
- congelación de percepción;
- garbage cap = 4;
- determinismo.

## 8. Exclusiones
- Settings;
- controles remapeables;
- backend;
- ranking/historial;
- pulido visual general;
- rebalance global;
- nuevas dificultades;
- nuevas dependencias innecesarias.

## 9. Criterios de aceptación
- Interferencia funcionalmente equivalente para humano y bot.
- Warning de 750 ms.
- Inmunidad de 4.000 ms.
- Pending garbage nunca > 4.
- Sin regresiones en sabotajes existentes.
- Suite completa verde:
  - pnpm test
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test:e2e
- documentación actualizada;
- ningún commit realizado antes de auditoría final.
