# AGENTS.md — Rautfall

## Propósito

Este archivo define las reglas permanentes para cualquier agente que trabaje en el repositorio de Rautfall.

Las decisiones de producto y arquitectura viven en `docs/rautfall.md`. El alcance concreto de cada tarea vive en su documento correspondiente dentro de `docs/implementation/`.

## Orden de lectura

Antes de modificar el repositorio, leer:

1. `AGENTS.md`
2. `docs/rautfall.md`
3. La especificación de la tarea activa
4. `docs/project-status.md`
5. El código y las pruebas existentes

La tarea activa determina el alcance concreto. `docs/rautfall.md` determina las decisiones globales. No asumir que una funcionalidad prevista para el futuro pertenece a la tarea actual.

## Control de alcance

Implementar únicamente lo solicitado por la tarea activa.

No añadir de forma preventiva:

- dependencias;
- paquetes;
- carpetas;
- capas;
- interfaces;
- adaptadores;
- servicios;
- configuraciones;
- herramientas;
- funcionalidades futuras.

No realizar refactorizaciones, actualizaciones generales de dependencias ni cambios estéticos ajenos a la tarea.

Cuando se detecte un problema fuera de alcance, documentarlo y no corregirlo salvo que bloquee directamente la tarea activa.

## Monorepo y módulos

El repositorio utiliza:

- pnpm Workspaces;
- TypeScript;
- ES Modules;
- paquetes bajo el ámbito `@rautfall/*`;
- dependencias internas con `workspace:*`.

Reglas:

- importar paquetes internos por su nombre público;
- no realizar imports profundos hacia el directorio `src` de otro paquete;
- no crear dependencias circulares;
- mantener una superficie pública mínima;
- no introducir CommonJS ni `require()`.

## Arquitectura

Respetar las responsabilidades definidas en `docs/rautfall.md`.

Principios permanentes:

- la lógica de dominio no depende de Vue, Phaser, DOM, navegador o backend;
- la aplicación web no duplica ni sustituye la lógica del dominio;
- la configuración se valida en tiempo de ejecución;
- los paquetes se comunican mediante APIs públicas explícitas;
- el tiempo y el azar del dominio deben ser controlables y reproducibles.

No anticipar arquitectura destinada a tareas futuras.

## Diseño de código

Aplicar SOLID de forma pragmática.

Priorizar:

- responsabilidades claras;
- dependencias explícitas;
- contratos pequeños;
- composición sencilla;
- código localizado y fácil de probar;
- abstracciones justificadas por una necesidad real.

Evitar:

- sobrearquitectura;
- interfaces artificiales;
- capas ceremoniales;
- factorías innecesarias;
- contenedores de inyección de dependencias sin justificación;
- mocks excesivos;
- patrones aplicados únicamente por imitación.

No usar prefijo `I` para interfaces.

No usar sufijo `Impl` para implementaciones.

## Estrategia de pruebas

Aplicar TDD cuando aporte valor real, especialmente en lógica de dominio, configuración, algoritmos, contratos, determinismo y regresiones.

No imponer TDD de forma dogmática en maquetación visual, animaciones, integración exploratoria o experimentación de UX.

Las pruebas deben verificar comportamiento observable, invariantes y contratos. No deben depender innecesariamente de detalles internos.

No perseguir cobertura por sí misma ni añadir umbrales sin una decisión explícita.

## Idioma y nombres

La documentación y los textos explicativos del repositorio se escriben en castellano.

Se escriben en inglés:

- código;
- variables;
- funciones;
- tipos;
- interfaces;
- propiedades;
- eventos;
- errores técnicos;
- mensajes internos de validación.

Convenciones:

- archivos y directorios: kebab-case;
- componentes Vue: PascalCase;
- variables y funciones: camelCase;
- tipos y clases: PascalCase.

Los mensajes de commit siguen Conventional Commits con descripción en castellano:

- `feat: añadir movimiento horizontal`
- `fix: corregir la validación de la semilla`
- `test: añadir una regresión del motor`
- `docs: documentar la tarea 0002`
- `chore: actualizar la configuración del proyecto`

## Dependencias

No añadir una dependencia sin justificar:

1. qué problema concreto resuelve;
2. por qué pertenece a la tarea activa;
3. por qué las herramientas existentes no son suficientes;
4. qué coste de mantenimiento introduce.

No actualizar dependencias ajenas a la tarea.

Después de modificar dependencias:

- actualizar `pnpm-lock.yaml` mediante pnpm;
- no editar manualmente el lockfile;
- ejecutar las validaciones raíz.

## Validación obligatoria

Antes de declarar una tarea completada, ejecutar desde la raíz:

- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

Todos los comandos deben finalizar correctamente.

También revisar:

- imports profundos;
- dependencias no justificadas;
- código no usado;
- archivos generados;
- abstracciones innecesarias;
- ampliaciones de alcance;
- errores o avisos ignorados.

No modificar reglas de lint, TypeScript o pruebas únicamente para ocultar un problema.

## Documentación

Cada tarea debe actualizar, cuando corresponda:

- `README.md`;
- su informe en `docs/implementation/`;
- `docs/project-status.md`.

La especificación de una tarea y su informe de implementación son documentos distintos. No sustituir uno por otro.

El informe debe incluir:

- resumen;
- archivos creados y modificados;
- decisiones relevantes;
- API pública producida;
- pruebas añadidas;
- comandos ejecutados y resultados;
- desviaciones;
- trabajo pendiente;
- confirmación del alcance excluido.

## Procedimiento de trabajo

Antes de modificar código:

1. leer las fuentes de verdad;
2. ejecutar `git status --short`;
3. inspeccionar los archivos relevantes;
4. revisar las pruebas existentes;
5. identificar el cambio mínimo necesario.

Durante la implementación:

1. trabajar de forma incremental;
2. ejecutar pruebas focalizadas tras cada cambio significativo;
3. conservar contratos existentes salvo corrección justificada;
4. evitar cambios masivos;
5. detenerse y preguntar si falta una decisión funcional o arquitectónica.

Al finalizar:

1. ejecutar las cuatro validaciones raíz;
2. revisar el diff completo;
3. actualizar la documentación;
4. mostrar `git status --short`;
5. enumerar desviaciones y asuntos pendientes;
6. confirmar que no se amplió el alcance.

## Git

El agente no debe, salvo instrucción explícita:

- crear commits;
- modificar commits;
- crear o cambiar ramas;
- hacer push;
- abrir pull requests;
- hacer merge;
- ejecutar `git reset --hard`;
- descartar cambios existentes.

No modificar archivos ajenos a la tarea que ya estuvieran cambiados.

## Criterio final

La solución correcta es la más pequeña que:

- cumple la especificación;
- respeta los límites arquitectónicos;
- queda probada de forma proporcionada al riesgo;
- puede explicarse y mantenerse;
- no anticipa trabajo futuro sin necesidad.
