# 0001 — Base del prototipo

## Estado

- **Proyecto:** Rautfall
- **Fase:** primera tarea técnica del prototipo vertical jugable
- **Estado de la tarea:** lista para implementación tras revisión
- **Fuente de contexto:** `Rautfall-TFM-v3.md`
- **Precedencia para esta tarea:** ante cualquier estructura conceptual anterior o más amplia del TFM, esta especificación define el alcance físico y técnico exacto de `0001`.

## 1. Objetivo

Crear la base mínima, ejecutable y probada del monorepo de Rautfall.

La tarea debe dejar un repositorio funcional, no una colección de carpetas vacías. Debe demostrar que:

- el workspace está configurado correctamente;
- la aplicación web consume los paquetes internos únicamente mediante sus API públicas;
- la configuración del juego se valida en tiempo de ejecución;
- el contrato inicial del motor puede crearse, avanzar, inspeccionarse, drenar eventos y reiniciarse;
- el ciclo de desarrollo no exige compilar previamente los paquetes internos para ejecutar la web o las pruebas.

Esta tarea no implementa mecánicas de juego.

## 2. Relación con el plan técnico

La secuencia inicial de trabajo queda fijada así:

1. `0001 — Base del prototipo`
2. `0002 — Motor de juego determinista`
3. `0003 — Integración con Phaser`
4. `0004 — Prototipo vertical Tactical`

Las exclusiones de `0001` son temporales y no derogan decisiones posteriores del TFM, como Phaser, Playwright, Pinia, Vue Router, backend, Testcontainers o el resto del stack acordado.

## 3. Alcance incluido

### 3.1 Monorepo

Crear un pnpm Workspace privado con únicamente:

```text
apps/
  web/
packages/
  game-engine/
  game-config/
```

La raíz incluirá la configuración compartida mínima para:

- TypeScript;
- ESLint;
- Prettier;
- Vitest;
- scripts del workspace.

### 3.2 Aplicación web

Crear una aplicación Vue 3 con Vite y TypeScript.

Debe incluir una pantalla técnica provisional que importe y utilice las API públicas de:

- `@rautfall/game-engine`;
- `@rautfall/game-config`.

El ámbito npm `@rautfall/*` ya forma parte de la identidad técnica acordada del proyecto.

### 3.3 Paquete de configuración

Crear una configuración inicial validada y versionada con los parámetros ya acordados para el primer prototipo jugable.

### 3.4 Paquete del motor

Crear el contrato inicial del motor determinista y una implementación mínima capaz de:

- crearse con una semilla y una configuración válida;
- avanzar un único paso lógico fijo;
- exponer un snapshot observable de solo lectura;
- drenar los eventos acumulados;
- reiniciarse explícitamente.

### 3.5 Pruebas y documentación

Establecer la disciplina inicial de pruebas y producir:

- esta especificación;
- [docs/implementation/0001-base-del-prototipo.md](../implementation/0001-base-del-prototipo.md) al finalizar la implementación;
- una actualización de [docs/project-status.md](../project-status.md).

Si [docs/project-status.md](../project-status.md) ya existe, deberá actualizarse sin sobrescribir su contenido previo.

## 4. Alcance explícitamente excluido

Esta tarea no debe introducir:

- tablero;
- piezas o bolsa de siete piezas;
- PRNG de juego;
- movimiento;
- ejecución de DAS o ARR;
- SRS;
- gravedad;
- colisiones;
- ejecución del `lock delay`;
- eliminación de líneas;
- Phaser;
- Vue Router;
- Pinia;
- Playwright;
- backend o API;
- base de datos;
- autenticación;
- ranking o historial;
- Azure;
- Docker;
- CI/CD;
- Husky, `lint-staged` o `commitlint`;
- Turborepo;
- i18n;
- estilo visual definitivo;
- layout Industrial Dramatic;
- audio.

No se crearán paquetes, carpetas ni abstracciones preventivas para funcionalidades excluidas.

El PRNG `mulberry32` se implementará en `0002`, cuando exista un consumidor real: la generación determinista de piezas.

## 5. Responsabilidades arquitectónicas

### 5.1 `apps/web`

Responsabilidades en esta tarea:

- alojar la aplicación Vue;
- importar las API públicas de los paquetes internos;
- crear una instancia del motor con la configuración del prototipo;
- mostrar el estado observable;
- ejecutar un paso lógico;
- reiniciar el motor;
- mostrar los eventos drenados;
- mostrar un error técnico sencillo si falla la inicialización.

No debe:

- acceder a detalles internos de otros paquetes;
- contener reglas del motor;
- contener la interfaz final del juego;
- duplicar ni mutar el estado del motor fuera de su API pública.

### 5.2 `packages/game-engine`

Responsabilidades en esta tarea:

- exponer el contrato público `GameEngine`;
- mantener un estado determinista mínimo y encapsulado;
- validar las opciones pertenecientes a la frontera del motor;
- avanzar exactamente un paso fijo por llamada;
- exponer un snapshot de solo lectura;
- mantener y drenar una cola privada de eventos;
- permitir un reinicio explícito.

Debe permanecer independiente de:

- Vue;
- Phaser;
- DOM y APIs del navegador;
- relojes de tiempo real;
- `Math.random()`;
- APIs específicas de Node;
- almacenamiento, red o backend.

### 5.3 `packages/game-config`

Responsabilidades en esta tarea:

- declarar el esquema TypeBox;
- derivar el tipo TypeScript desde el esquema;
- proporcionar `parseGameConfig(input)`;
- rechazar propiedades desconocidas;
- validar estructura y rangos básicos;
- validar invariantes relacionales mediante código explícito;
- exponer `prototypeConfig` únicamente después de validarlo.

No debe contener reglas del motor, geometría de piezas, colisiones ni responsabilidades del navegador.

## 6. Principios de ingeniería

### 6.1 SOLID aplicado con pragmatismo

SOLID se utilizará como guía de diseño, no como objetivo ceremonial.

Se exige:

- responsabilidades claras;
- dependencias explícitas;
- contratos públicos pequeños;
- encapsulación de detalles internos;
- extensibilidad solo ante necesidades conocidas o inmediatas.

Se evita:

- interfaces sin un contrato útil;
- capas sin comportamiento;
- contenedores de inyección de dependencias sin necesidad demostrada;
- una clase por operación trivial;
- factorías, repositorios o adaptadores creados solo para imitar arquitectura empresarial.

### 6.2 TDD proporcional al riesgo

TDD se aplicará cuando mejore el diseño o proteja comportamiento determinista.

En esta tarea resulta especialmente adecuado para:

- validación de configuración;
- avance del motor;
- comportamiento de reinicio;
- drenaje de eventos;
- validación de semilla.

No se exige TDD como ritual para la pantalla provisional de Vue. La integración se verificará mediante pruebas útiles, comprobación de tipos y build final.

El porcentaje de cobertura no será un objetivo por sí mismo.

## 7. Monorepo y herramientas

### 7.1 Workspace

- Gestor de paquetes: pnpm.
- Workspace: pnpm Workspaces.
- Paquete raíz: `private: true`.
- Versión inicial de los paquetes: `0.1.0`.
- Dependencias internas: `workspace:*`.
- Sin publicación en npm.
- Sin Changesets.

La versión seleccionada de Node y pnpm deberá quedar fijada en el repositorio mediante los mecanismos estándar elegidos durante la implementación y registrada en el informe final. No se dejará implícita en el entorno local del desarrollador.

### 7.2 Módulos y exports

Se usarán ES Modules de extremo a extremo:

- solo `import` y `export`;
- sin CommonJS ni `require()`;
- paquetes internos ESM-only;
- cada paquete declarará una única entrada pública mediante `exports`;
- los consumidores no accederán a rutas internas bajo `src/`;
- los tipos públicos deberán resolverse desde la misma entrada del paquete.

No se introducirá un bundler adicional para las librerías internas.

### 7.3 TypeScript

- `tsconfig.base.json` en la raíz.
- Cada aplicación y paquete extenderá la configuración base.
- Comprobación estricta de tipos.
- Desarrollo y pruebas sin build previo de librerías.
- `tsc --noEmit` para paquetes TypeScript.
- `vue-tsc --noEmit` para cubrir correctamente archivos `.vue`.

### 7.4 Linting y formato

- Una configuración ESLint en la raíz con soporte para TypeScript y Vue.
- Una configuración Prettier en la raíz.
- Prettier será responsable del formato.
- ESLint se centrará en errores, malas prácticas y consistencia relevante, evitando duplicar reglas puramente estéticas.
- No se crearán paquetes internos para ESLint o TypeScript.

### 7.5 Scripts raíz

La raíz expondrá al menos:

```text
pnpm dev
pnpm test
pnpm lint
pnpm format
pnpm typecheck
pnpm build
```

Flujo esperado:

- `dev`, `test` y `typecheck` funcionarán sin compilar previamente los paquetes internos;
- `build` se reservará para el cierre de tarea, validación de entrega o despliegue.

## 8. Convenciones de código

- Archivos y carpetas: `kebab-case`.
- Funciones y variables: `camelCase`.
- Clases, interfaces y tipos: `PascalCase`.
- Constantes reales de módulo: `UPPER_SNAKE_CASE` cuando proceda.
- Tests junto al código mediante `.test.ts` o `.test.tsx`.
- Componentes Vue: `PascalCase.vue`.
- Interfaces sin prefijo `I`.
- Implementaciones sin sufijo `Impl`.
- Las clases internas no pertenecientes a la API pública permanecerán sin exportar.
- `index.ts` únicamente en la frontera pública de cada paquete; sin barriles internos salvo necesidad real.

Los términos técnicos, nombres de variables, funciones, tipos, propiedades, códigos de error y eventos permanecerán en inglés. La documentación explicativa se redactará en castellano.

## 9. Contrato de configuración

### 9.1 Perfil inicial

`prototypeConfig` contendrá:

| Propiedad | Valor |
| --- | ---: |
| `version` | `prototype-0001` |
| `fixedStepMs` | `10` |
| `dasMs` | `150` |
| `arrMs` | `50` |
| `gravityCellsPerSecond` | `1` |
| `softDropCellsPerSecond` | `20` |
| `lockDelayMs` | `500` |
| `maxLockResets` | `15` |

**DAS — Delayed Auto Shift:** tiempo que debe mantenerse una dirección horizontal antes de comenzar la repetición automática.

**ARR — Auto Repeat Rate:** intervalo entre desplazamientos horizontales automáticos una vez superado el DAS.

Estos valores son parámetros iniciales configurables, no valores definitivos de balance.

### 9.2 Validación estructural

TypeBox validará:

- propiedades obligatorias;
- tipos;
- mínimos numéricos;
- enteros cuando corresponda;
- versión no vacía;
- rechazo de propiedades desconocidas.

### 9.3 Validación relacional

`parseGameConfig()` comprobará además:

- `fixedStepMs` divide exactamente `dasMs`;
- `fixedStepMs` divide exactamente `arrMs`;
- `fixedStepMs` divide exactamente `lockDelayMs`;
- `softDropCellsPerSecond` es mayor que `gravityCellsPerSecond`;
- `maxLockResets` es un entero positivo.

Las invariantes relacionales se implementarán fuera del esquema TypeBox para mantenerlas legibles y explícitas.

### 9.4 API pública y errores

API pública:

```text
parseGameConfig(input) -> GameConfig
```

Una entrada inválida lanzará `GameConfigValidationError` con:

- `code: "INVALID_GAME_CONFIG"`;
- `message` técnico en inglés;
- `issues`, como colección de elementos con esta forma pública:

```text
path
code
message
```

Tanto los errores estructurales como los relacionales deberán normalizarse a esta misma estructura.

El vocabulario inicial de `issue.code` será reducido y estable:

- `REQUIRED`;
- `UNKNOWN_PROPERTY`;
- `TYPE_MISMATCH`;
- `OUT_OF_RANGE`;
- `RELATIONAL_VIOLATION`.

No se añadirán códigos adicionales salvo que aparezca un caso real que no pueda representarse correctamente con este conjunto.

No habrá:

- fallback silencioso;
- aceptación parcial;
- segunda API `safeParse` en esta tarea;
- textos traducidos dentro del paquete.

## 10. Contrato del motor

### 10.1 Creación

Factoría pública:

```text
createGameEngine(options) -> GameEngine
```

Opciones iniciales:

```text
seed
config
```

La semilla será un entero sin signo de 32 bits:

```text
0 <= seed <= 4,294,967,295
```

Las opciones inválidas impedirán la creación del motor y producirán un error tipado con:

```text
code: "INVALID_ENGINE_OPTIONS"
```

No se normalizarán semillas inválidas de forma silenciosa.

### 10.2 API pública

```text
GameEngine
- step(input)
- getSnapshot()
- drainEvents()
- reset(options)
```

La implementación concreta permanecerá oculta tras la factoría.

### 10.3 Entrada mínima

`step(input)` aceptará un objeto de entrada tipado mínimo, aunque todavía no existan comandos de juego.

No contendrá eventos DOM, key codes ni tipos de Phaser. No se simularán falsamente acciones todavía no implementadas.

### 10.4 Avance lógico

Cada llamada a `step()`:

- avanza exactamente un paso lógico;
- incrementa `step` en uno;
- incrementa `elapsedMs` usando `config.fixedStepMs`, nunca un literal fijo;
- no consulta tiempo real;
- no depende de frame rate;
- no emite eventos de mecánicas inexistentes.

Debe existir una prueba con una configuración válida alternativa cuyo `fixedStepMs` sea distinto de `10`, para demostrar que el motor consume el valor configurado y no lo tiene hardcodeado. Esa configuración será exclusiva del fichero de prueba y no se exportará desde `game-config`.

### 10.5 Snapshot

`getSnapshot()` devolverá un snapshot de solo lectura con:

- `step`;
- `elapsedMs`;
- `status`;
- `seed`;
- `configVersion`.

En `0001`, `status` será un tipo cerrado con un único valor:

```text
running
```

Los textos visuales como `RUNNING`, `PAUSED` o `GAME OVER` pertenecen a la interfaz y no condicionan los literales internos del dominio.

No se implementarán todavía pausa ni derrota.

### 10.6 Eventos

Eventos mínimos de ciclo de vida:

- `engineStarted`;
- `engineReset`.

Estos eventos convivirán en el futuro con los eventos de juego dentro de una unión discriminada `GameEvent`; no sustituyen ni derogan `pieceSpawned`, `pieceMoved`, `pieceRotated`, `pieceDropped`, `pieceLocked`, `linesCleared` o `gameOver`.

Cada evento incluirá al menos:

- `type`;
- `step`.

`drainEvents()`:

- devolverá los eventos en orden de emisión;
- devolverá una colección de solo lectura;
- vaciará la cola interna;
- devolverá una colección vacía si no existen eventos nuevos.

### 10.7 Reinicio

`reset(options)`:

- validará las nuevas opciones con las mismas reglas que la creación;
- reutilizará `INVALID_ENGINE_OPTIONS` si son inválidas;
- restaurará `step` y `elapsedMs` a cero;
- sustituirá semilla y configuración;
- eliminará eventos anteriores pendientes;
- emitirá exactamente un `engineReset`.

El comportamiento será determinista.

## 11. Smoke screen web

Crear una página técnica provisional que muestre:

- `Rautfall`;
- versión de configuración;
- semilla fija;
- paso lógico actual;
- tiempo lógico acumulado;
- estado del motor;
- botón `Step`;
- botón `Reset`;
- últimos eventos drenados;
- error técnico si falla la inicialización.

Comportamiento esperado:

- utiliza `prototypeConfig` y una semilla válida fija;
- `Step` avanza exactamente un paso;
- `Reset` restaura el estado inicial;
- los eventos se muestran utilizando únicamente la API pública;
- los imports usan los nombres de paquete del workspace.

Restricciones visuales:

- simple, legible y claramente provisional;
- botones semánticos y utilizables con teclado;
- legible en un viewport de escritorio habitual sin scroll horizontal;
- sin layout Tactical ni estilo Industrial Dramatic;
- sin sistema de diseño;
- sin router ni store global.

El manejo de error será un `try/catch` local y sencillo; no se construirá una infraestructura global para una rama excepcional de esta pantalla técnica.

## 12. Estrategia de pruebas

### 12.1 Configuración

Como mínimo:

- configuración válida;
- propiedad desconocida;
- propiedad obligatoria ausente;
- valor temporal igual a cero;
- valor temporal negativo;
- divisibilidad inválida respecto a `fixedStepMs`;
- caída blanda no superior a gravedad;
- `maxLockResets` no positivo;
- `maxLockResets` no entero;
- normalización consistente de `issues` estructurales y relacionales;
- ausencia de sustitución silenciosa por valores por defecto.

### 12.2 Motor

Como mínimo:

- opciones válidas crean el motor;
- `seed = 0` es válida;
- `seed = 4_294_967_295` es válida;
- semilla negativa rechazada;
- `seed = 4_294_967_296` rechazada;
- semilla no entera rechazada;
- un paso usa `config.fixedStepMs`;
- configuración alternativa prueba que no existe un `10` hardcodeado;
- pasos repetidos acumulan `step` y `elapsedMs` correctamente;
- snapshot sin referencias mutables internas;
- `engineStarted` al crear;
- orden de eventos;
- drenaje vacía la cola;
- reinicio devuelve contadores a cero;
- reinicio elimina eventos antiguos;
- reinicio emite un único `engineReset`;
- `reset()` seguido de `step()` funciona correctamente;
- dos reinicios consecutivos son consistentes;
- mismas entradas válidas producen el mismo resultado observable.

### 12.3 Integración del workspace

La verificación de integración residirá en `apps/web` y deberá incluir un test automatizado explícito que demuestre que:

- la web importa ambos paquetes por nombre;
- no necesita imports profundos;
- los exports y tipos públicos se resuelven correctamente;
- los archivos `.vue` forman parte del typecheck;
- el workspace completo compila.

El build y el typecheck podrán complementar esta verificación, pero no sustituirán el test de integración del workspace.

No se introducirá Playwright.

## 13. Criterios de aceptación

### 13.1 Repositorio y herramientas

- La instalación con pnpm funciona desde la raíz.
- El workspace contiene únicamente las tres unidades acordadas.
- Las dependencias internas usan `workspace:*`.
- ES Modules se usa de forma consistente.
- Los scripts raíz existen y funcionan.
- Desarrollo, pruebas y typecheck no requieren build previo.
- Node y pnpm quedan fijados y documentados.

### 13.2 Configuración

- `prototypeConfig` contiene exactamente los valores acordados.
- `parseGameConfig()` valida estructura e invariantes relacionales.
- Configuración inválida produce `INVALID_GAME_CONFIG`.
- Las incidencias tienen forma pública consistente.
- Se rechazan propiedades desconocidas.
- No se sustituyen valores inválidos silenciosamente.

### 13.3 Motor

- `createGameEngine()` acepta solo opciones válidas.
- `step()` consume `config.fixedStepMs`.
- Snapshot correcto y de solo lectura.
- Eventos drenados correctamente.
- Reinicio explícito y determinista.
- Sin reglas de juego prematuras.
- Sin dependencias de navegador, Vue o Phaser.

### 13.4 Aplicación web

- La smoke screen carga.
- Consume paquetes internos por sus entradas públicas.
- `Step` y `Reset` funcionan visiblemente.
- Los eventos se muestran.
- La pantalla sigue siendo técnica y provisional.

### 13.5 Puertas de calidad

Deben pasar desde la raíz:

```text
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Además, mediante revisión técnica:

- no existen carpetas preventivas vacías;
- no existen imports profundos entre paquetes;
- no hay interfaces con prefijo `I`;
- no hay implementaciones con sufijo `Impl`;
- no hay abstracciones sin uso real;
- no se ha ampliado el alcance;
- la documentación está actualizada.

Estas últimas condiciones son criterios de revisión, no se crearán linters personalizados ni scripts artificiales para automatizarlas.

## 14. Informe de implementación obligatorio

Al finalizar, crear [docs/implementation/0001-base-del-prototipo.md](../implementation/0001-base-del-prototipo.md) con:

- resumen de implementación;
- archivos creados o modificados;
- estructura final de paquetes;
- API públicas producidas;
- pruebas añadidas;
- comandos ejecutados y resultados;
- versiones utilizadas de Node, pnpm, TypeScript, Vue y Vite;
- desviaciones respecto a la especificación;
- deuda técnica o seguimientos;
- confirmación de que no se introdujo alcance excluido.

Actualizar [docs/project-status.md](../project-status.md) añadiendo:

- estado de la tarea;
- fecha de finalización;
- resultado resumido;
- siguiente tarea: `0002 — Motor de juego determinista`.

## 15. Restricciones para desarrollo asistido por IA

El agente puede:

- crear los archivos acordados;
- tomar decisiones de bajo nivel compatibles con esta especificación;
- añadir pruebas necesarias para demostrar los criterios.

El agente no puede:

- ampliar alcance;
- introducir dependencias o frameworks no requeridos;
- cambiar arquitectura o contratos públicos sin aprobación;
- añadir Phaser, Pinia, Router, backend o CI;
- crear commits automáticamente;
- sustituir el enfoque acordado por otro más complejo;
- declarar la tarea completada sin resultados de comandos y evidencias de pruebas.

## 16. Definición de terminado

`0001 — Base del prototipo` estará terminada cuando Rautfall disponga de un monorepo mínimo, coherente, probado y ágil, preparado para implementar el motor determinista en `0002` sin rehacer fronteras de paquetes ni herramientas de desarrollo.
