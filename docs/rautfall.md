# Rautfall — TFM

## Estado del documento

- **Fase:** exploración y definición previa.
- **Fecha límite real:** finales de agosto de 2026.
- **Fecha del documento de la escuela (20/07/2026):** objetivo ideal, no límite real.
- **Decisión actual:** proyecto seleccionado y en fase de definición previa.
- **Nombre del producto:** Rautfall.
- **Descriptor:** *Build. Disrupt. Survive.*
- No se utilizará la marca *Tetris*.

## Condiciones del TFM

Según la documentación recibida, el proyecto debe ser una aplicación real, original, diferenciadora, adaptada al nivel y experiencia del alumno, y aportar valor personal. Puede ser una web, aplicación, utilidad, herramienta o juego. No es obligatorio incorporar IA dentro del producto.

Entregables requeridos:

1. README completo y detallado.
2. Código fuente, preferentemente en un repositorio público de GitHub.
3. Despliegue o publicación funcional, recomendado siempre que sea posible.
4. Presentación mediante slides.
5. Vídeo explicativo con captura de pantalla.

## Idea seleccionada provisionalmente

Juego web de puzle por bloques competitivo contra una inteligencia artificial heurística. El jugador completa líneas y obtiene ataques tácticos que puede almacenar y utilizar para interferir en el tablero del rival.

La inspiración conceptual del modo batalla procede de juegos como *Guitar Hero III*: no basta con superar la puntuación contraria; el jugador debe conseguir sabotajes y decidir estratégicamente cuándo utilizarlos.

## Propuesta de valor

- Partidas comprensibles visualmente desde los primeros segundos.
- Mecánica familiar con una diferencia clara: los ataques tácticos.
- Rival controlado mediante IA clásica, integrada de forma natural.
- Gráficos geométricos generados por código, sin depender de ilustraciones.
- Backend pequeño con una función real, no añadido únicamente para inflar el proyecto.
- Proyecto distinto de las aplicaciones empresariales y catálogos desarrollados profesionalmente.

## MVP acordado provisionalmente

### Juego base

- Tablero y piezas de bloques con motor propio.
- Movimiento, rotación y caída.
- Eliminación de líneas.
- Puntuación y combos.
- Pieza fantasma.
- Reserva de pieza.
- Vista de próximas piezas.
- Fin de partida.
- Pausa y reinicio.
- Controles de teclado.
- Efectos visuales y audio básicos coherentes.

### Modos

1. **Entrenamiento individual:** sirve para aprender y practicar.
2. **Batalla contra la máquina:** modo principal y diferencial.

### Batalla

- Dos tableros ejecutándose simultáneamente.
- Un rival controlado por IA heurística.
- Una dificultad inicial.
- Los combos o eliminaciones relevantes conceden ataques.
- Máximo provisional de dos ataques almacenados.
- Tres sabotajes iniciales:
  - Añadir filas basura.
  - Ocultar las próximas piezas.
  - Aumentar temporalmente la velocidad de caída.
- El bot decide tanto la colocación de piezas como el momento de atacar.
- Deben existir avisos y límites que eviten ataques injustos o frustrantes.

## Decisión funcional: obtención y uso de sabotajes

### Alternativas consideradas

1. Conceder ataques directamente según el número de líneas eliminadas.
2. Introducir bloques especiales que otorguen ataques al ser eliminados.
3. Acumular energía de combate mediante líneas y combos.
4. Superar objetivos temporales durante la partida.

### Decisión

Se utilizará una **barra de energía de combate**. Las eliminaciones de líneas generan energía y los combos aportan una bonificación. Al completar la barra, el jugador obtiene un sabotaje.

Esta alternativa permite recompensar distintas formas de juego, separar el balance de puntuación del balance de combate y ajustar la frecuencia de los ataques sin modificar las reglas fundamentales del tablero.

### Parámetros iniciales de diseño

Los siguientes valores son hipótesis de equilibrio y deberán validarse mediante simulaciones y partidas humanas:

| Acción | Energía inicial propuesta |
| --- | ---: |
| Eliminar una línea | 10 |
| Eliminar dos líneas | 25 |
| Eliminar tres líneas | 45 |
| Eliminar cuatro líneas | 70 |
| Combo consecutivo | Bonificación progresiva |

La caída instantánea no generará energía adicional para evitar incentivar acciones sin valor táctico real.

### Asignación y almacenamiento

- El próximo sabotaje se mostrará en una cola visible.
- La cola se generará mediante una bolsa equilibrada, evitando tanto la elección repetitiva del ataque óptimo como el azar puro.
- El excedente de energía se conservará al completar la barra.
- Cada jugador podrá almacenar inicialmente un máximo de dos sabotajes.
- Los ataques se lanzarán manualmente para que el momento de uso forme parte de la estrategia.

### Sabotajes iniciales del MVP

1. **Sobrecarga:** aumenta temporalmente la velocidad de caída del rival.
2. **Interferencia:** oculta temporalmente el tablero rival y la información táctica asociada.
3. **Residuos:** añade una fila de bloques basura con un hueco.
4. **Polaridad inversa:** invierte temporalmente los controles horizontales y de rotación durante una pieza.

### Reglas de protección y contrajuego

- Los ataques temporales se anunciarán brevemente antes de aplicarse.
- Dos efectos temporales idénticos no se acumularán sin límite.
- Existirá una inmunidad corta después de determinados efectos.
- Las filas basura podrán acumularse únicamente hasta un límite pendiente de balance.
- El bot estará sometido a las mismas reglas, costes, límites e información que el jugador.

### Alternativas descartadas para el MVP

- Impedir completamente la rotación.
- Ocultar el tablero.
- Retirar durante demasiado tiempo el control del jugador.

Estas mecánicas se descartan inicialmente porque aumentan la frustración sin ofrecer un contrajuego claro.

## Decisión funcional: información visible del rival

Durante la batalla se mostrará el tablero rival completo. La observación directa es necesaria para decidir cuándo conviene gastar o conservar un sabotaje.

La vista normal incluirá:

- Tablero rival completo.
- Pieza activa.
- Altura y situación real del tablero.
- Energía de combate.
- Número de sabotajes almacenados.
- Efectos activos.

El jugador conocerá cuántos sabotajes almacena el rival, pero no necesariamente su tipo. La pieza fantasma del rival no es necesaria inicialmente.

### Interferencia revisada

La interferencia no afectará a la capacidad mecánica para jugar. Durante un periodo breve ocultará el tablero rival y sus indicadores tácticos mediante una representación visual de señal distorsionada.

El jugador afectado podrá seguir colocando piezas y lanzando ataques, pero deberá decidir sin información actualizada sobre el estado del contrario.

## Decisión arquitectónica: equivalencia de sabotajes

### Problema

Los jugadores humanos reciben información mediante la interfaz y actúan con controles físicos. El bot recibe datos estructurados y genera acciones internas. Un efecto puramente visual o basado solo en teclado perjudicaría al humano, pero no a la IA.

### Decisión

Los participantes se modelarán mediante tres capas conceptuales:

```text
Perception -> Decision -> Execution
```

- **Perception:** información disponible sobre la partida y el rival.
- **Decision:** elección del movimiento o sabotaje.
- **Execution:** transformación de la decisión en acciones del motor.

Cada sabotaje afectará a una capacidad abstracta y dispondrá de una adaptación funcionalmente equivalente para humanos y bots.

| Sabotaje | Dimensión afectada | Jugador humano | Bot |
| --- | --- | --- | --- |
| Residuos | Estado | Añade una fila basura | Añade la misma fila basura |
| Sobrecarga | Tiempo | Aumenta la velocidad de caída | Reduce del mismo modo su margen de ejecución |
| Interferencia | Percepción | Oculta el tablero rival | Suspende o degrada el estado actualizado del rival |
| Polaridad inversa | Ejecución | Invierte izquierda/derecha y sentido de giro | Invierte los comandos del plan de acciones |

### Polaridad inversa

- Durará inicialmente una pieza completa.
- Izquierda y derecha se intercambiarán.
- Los giros horario y antihorario se intercambiarán.
- La caída no se invertirá.
- Se anunciará brevemente antes de aplicarse.
- No se acumulará consigo misma.
- Existirá una inmunidad posterior pendiente de balance.

El bot deberá generar un plan de acciones, no teletransportar una pieza a las coordenadas finales. Durante la polaridad inversa, la capa de ejecución transformará sus comandos igual que los controles del jugador. El bot no podrá recalcular instantáneamente para neutralizar el efecto: su recuperación respetará un retraso de reacción configurado.

### Regla general

Ningún sabotaje se incorporará si no tiene un efecto funcionalmente equivalente sobre participantes humanos y artificiales.

### Backend

- Identificación de jugador y alias; el mecanismo definitivo de identidad queda pendiente.
- Registro del resultado de las batallas.
- Ranking.
- Historial básico del jugador.
- Validaciones de coherencia y protección básica contra manipulación.

La elección entre identidad anónima mediante token de dispositivo y cuenta con credenciales se pospone hasta validar el núcleo del producto.

## IA del rival

La primera versión utilizará búsqueda y heurísticas, no aprendizaje automático. Para cada pieza evaluará posiciones y rotaciones legales considerando, entre otros factores:

- Líneas eliminadas.
- Altura acumulada.
- Huecos internos.
- Irregularidad de la superficie.
- Pozos creados.
- Riesgo de alcanzar el techo.
- Potencial de ataque.
- Estado del tablero rival.
- Ataques almacenados.

El bot debe respetar las mismas reglas que el jugador y no acceder a información futura no permitida.

Perfiles, varias dificultades, ajuste automático de pesos, algoritmos genéticos o aprendizaje por refuerzo quedan inicialmente en el roadmap.

## Decisión funcional: información y comportamiento del bot

### Principio de juego limpio

La dificultad del bot procederá de la calidad de sus decisiones, no de información oculta ni de ventajas sobre las reglas.

El bot conocerá:

- Su propio tablero.
- Su pieza actual.
- La siguiente pieza visible.
- Sus sabotajes y energía.
- La información del tablero rival visible para el jugador.

El bot no conocerá:

- La secuencia completa de piezas futuras.
- Las próximas decisiones del jugador.
- Información futura de la cola de sabotajes no revelada.
- Resultados que un jugador no podría anticipar con la información disponible.

### Selección de movimientos

El bot evaluará las posiciones y rotaciones legales mediante una función heurística. No elegirá siempre la alternativa con mayor puntuación: podrá seleccionar aleatoriamente una jugada próxima al óptimo dentro de una tolerancia configurada.

Parámetros iniciales:

- `optimalityTolerance`: diferencia máxima admisible respecto de la mejor jugada.
- `suboptimalChoiceProbability`: probabilidad de no escoger la mejor alternativa.
- `reactionDelayRangeMs`: intervalo de reacción antes de ejecutar la decisión.

La variabilidad nunca permitirá una derrota inmediata evitable ni una decisión manifiestamente absurda cuando exista una alternativa razonable.

Esta estrategia se describirá formalmente como **selección estocástica acotada de movimientos subóptimos**. Su intención queda resumida en el comentario de implementación:

```ts
// Make the bot a bit stupid, but never suicidal.
```

### Uso de sabotajes

El bot evaluará el momento de ataque según el estado visible de ambos tableros. Podrá guardar un sabotaje si su utilidad actual es baja y estará sujeto a retrasos, límites y variabilidad similares a los de la colocación de piezas. No lanzará ataques en el instante matemáticamente perfecto de forma constante.

## Decisión funcional: condición de victoria y muerte súbita

### Alternativas consideradas

1. Eliminación directa sin límite temporal.
2. Batalla con duración fija y victoria por puntuación o métricas.
3. Eliminación directa con fase de muerte súbita.

### Decisión

Se adopta la **eliminación directa con fase de muerte súbita**.

- Durante la fase normal pierde quien ya no puede colocar una nueva pieza.
- Si la partida supera una duración máxima, comenzará la muerte súbita.
- La muerte súbita incrementará progresivamente la presión hasta provocar un desenlace.
- Si ambos jugadores son derrotados en el mismo paso lógico, el resultado será empate.

### Diseño inicial de la muerte súbita

Los valores exactos se determinarán mediante simulaciones y pruebas de juego. Inicialmente se valorará:

- Aviso previo claramente visible.
- Aumento progresivo de la velocidad.
- Generación más rápida de energía de combate.
- Reducción controlada de los periodos de inmunidad.
- Mantenimiento de las mismas reglas para jugador y bot.

La muerte súbita busca evitar partidas indefinidas sin sustituir la victoria comprensible por una fórmula opaca de puntuación.

## Dirección visual y recursos

La ausencia de recursos gráficos externos condicionará deliberadamente la dirección artística.

- Estética minimalista y tecnológica, no arcade genérica.
- Fondo oscuro o grafito.
- Bloques geométricos con color, volumen ligero y brillo contenido.
- Cuadrícula y paneles dibujados por código.
- Partículas y animaciones cortas para líneas y ataques.
- Iconos SVG coherentes.
- Logotipo tipográfico.
- Sin personajes, escenarios, sprites complejos ni modelos 3D.

El sonido podrá generarse mediante Web Audio o utilizar una colección pequeña y coherente de efectos con licencia abierta. La música es opcional. No se utilizará Unity.

Antes de comprometer el desarrollo completo se hará una prueba visual breve que incluya tablero, caída, eliminación de una línea, un ataque y audio básico.

## Decisión visual: dirección Industrial Dramatic

### Alternativas exploradas

- Arcade neón.
- Minimalismo digital.
- Industrial limpio.
- Industrial dramático.

### Decisión

Se adopta **Industrial Dramatic** como dirección visual de referencia.

La elección no convierte el mockup generado en una especificación literal. Se conservarán su carácter material, profundidad y atmósfera, mientras que la composición, escalas, textos e indicadores se rediseñarán según las reglas funcionales definitivas.

### Rasgos que se conservarán

- Estructura de consola o maquinaria industrial.
- Superficies de grafito y metal oscuro con desgaste muy contenido.
- Tableros claramente encastrados en el conjunto.
- Paneles con profundidad, juntas, tornillos, respiraderos y marcas técnicas discretas.
- Bloques de colores vivos con volumen moderado para destacar sobre el entorno.
- Contraste suficiente entre área de juego, información y acciones.
- Ámbar reservado para advertencias o energía táctica.
- Rojo reservado para peligro, derrota y estados críticos.
- Cian reservado principalmente para energía y estados activos.

### Límites visuales

- Sin resplandor permanente alrededor de todos los elementos.
- Sin marcos de neón generalizados.
- Sin bruma de `bloom` o estética de discoteca/cyberpunk.
- Sin texturas tan intensas que reduzcan legibilidad.
- Sin decoración industrial que compita con el tablero.
- Sin apariencia de backoffice o dashboard empresarial.
- Los efectos luminosos se reservarán para eventos: combos, sabotajes, peligro y muerte súbita.

### Elementos pendientes de rediseño

- Jerarquía definitiva entre tablero propio y rival.
- Representación de los cuatro sabotajes reales.
- Estado de reserva y tres próximas piezas.
- Energía de ambos participantes.
- Indicadores de muerte súbita, interferencia y polaridad inversa.
- Adaptación a diferentes resoluciones.
- Sustitución de cualquier texto, icono o dato ficticio del mockup.

### Criterio técnico

La implementación deberá recrear esta dirección mediante Canvas, SVG, CSS, gradientes, sombras, geometría y pequeños efectos procedimentales. El resultado no dependerá de una gran colección de imágenes rasterizadas ni de recursos gráficos incoherentes.

## Stack provisional

- **Juego:** Phaser y TypeScript.
- **Interfaz web:** Vue 3 y TypeScript.
- **Backend:** Node.js y TypeScript.
- **Framework HTTP:** Fastify.
- **Base de datos:** PostgreSQL.
- **Acceso a datos y migraciones:** Drizzle ORM.
- **Monorepo:** pnpm Workspaces, sin Turborepo inicialmente.
- **Pruebas:** Vitest, Playwright y Testcontainers con PostgreSQL.
- **Esquemas y validación:** TypeBox.
- **Estado de aplicación web:** Pinia, excluyendo el estado interno del motor.
- **Despliegue:** aplicación web.
- **Automatización:** GitHub Actions (`.github/workflows/ci.yml`) con jobs independientes `quality` y `e2e` en `ubuntu-24.04`.
- **Empaquetado de producción:** un único contenedor con Fastify sirviendo API y SPA compilada.
- **Cloud:** Vercel (SPA Vue 3 + Fastify Serverless) y Neon PostgreSQL (Azure Container Apps fue evaluada y descartada).
- **Logging:** Pino con logs estructurados y correlación por petición y partida.

Phaser se encargará de representación, entrada, animaciones y audio. La lógica del juego no debe residir dentro de las escenas de Phaser.

## Decisión arquitectónica provisional: Phaser frente a Unity

### Contexto

El producto es un juego web 2D basado en una cuadrícula. Necesita representación de formas geométricas, entrada mediante teclado, animaciones, partículas, audio y comunicación HTTP con un backend. No necesita físicas avanzadas, escenarios 3D, iluminación, cámaras complejas, animación de personajes ni publicación inicial en tiendas nativas.

### Alternativas consideradas

1. **Unity:** motor generalista para juegos 2D y 3D con editor visual y publicación multiplataforma.
2. **Phaser:** framework de juegos 2D para navegador, basado en JavaScript/TypeScript.
3. **Canvas 2D directo:** implementación sobre las APIs nativas del navegador.

### Decisión

Utilizar **Phaser con TypeScript**, manteniendo el motor de reglas independiente del framework. Vue gestionará las pantallas y componentes web externos a la partida.

### Criterios de decisión

- **Adecuación al producto:** Phaser cubre escenas, entrada, animaciones, partículas, audio y escalado sin incorporar capacidades innecesarias.
- **Complejidad accidental:** Unity añadiría escenas serializadas, prefabs, configuración del editor, importación de assets y builds WebGL sin aportar una ventaja proporcional al juego.
- **Despliegue:** Phaser genera una aplicación web convencional, más ligera y sencilla de publicar, probar y depurar.
- **Integración:** TypeScript facilita compartir contratos, utilidades y, cuando resulte apropiado, lógica determinista con el backend.
- **Automatización con IA:** un proyecto basado principalmente en código y archivos de texto resulta más fácil de generar, revisar, probar y versionar mediante agentes que un flujo dependiente de un editor visual.
- **Pruebas:** separar el motor de Phaser permite ejecutar pruebas y simulaciones sin navegador ni renderizado.
- **Recursos gráficos:** el juego utiliza geometría, SVG, partículas y audio sintético; no necesita el pipeline de assets de Unity.
- **Curva de adopción:** Phaser introduce conceptos de juego suficientes sin convertir el aprendizaje de una herramienta industrial en parte central del TFM.
- **Canvas directo:** ofrecería máximo control y menor dependencia, pero obligaría a implementar manualmente entrada, escenas, animaciones, partículas, audio y escalado que Phaser ya resuelve.

### Consecuencias positivas

- Menor tiempo de configuración y despliegue.
- Iteraciones visuales rápidas en el navegador.
- Integración natural con Vue y el backend web.
- Mayor facilidad para automatizar pruebas y revisar cambios.
- Menor dependencia de recursos binarios y herramientas visuales.

### Costes y limitaciones aceptadas

- Phaser añade una dependencia de framework sobre Canvas/WebGL.
- No proporciona por sí solo la arquitectura del motor; debe imponerse la separación entre lógica y presentación.
- Una futura publicación nativa requeriría empaquetado adicional o reconsiderar la plataforma.
- Un salto futuro a 3D o físicas complejas podría justificar revisar esta decisión.

### Estado

Decisión provisional, pendiente de validar mediante el prototipo visual. Unity queda descartado para el MVP. Canvas 2D directo permanece como alternativa de contingencia si Phaser introdujera fricción injustificada.

## Arquitectura esencial

El motor será determinista e independiente de Phaser y del navegador:

```text
game-engine/
  board/
  pieces/
  rotation/
  scoring/
  attacks/
  bot/
  replay/

game-client/
  scenes/
  renderers/
  input/
  effects/
  audio/

web-ui/
  menus/
  rankings/
  history/

server/
  players/
  matches/
  rankings/
```

Objetivos de esta separación:

- Probar el motor sin navegador.
- Ejecutar simulaciones a máxima velocidad.
- Reproducir partidas.
- Evitar escenas gigantes y estados mezclados con la presentación.
- Facilitar el trabajo incremental con agentes de desarrollo.

## Decisión arquitectónica: configuración, modos y dificultad

### Decisión

El motor estará dirigido por una configuración validada y versionada. Los modos de juego y niveles de dificultad serán perfiles nombrados que componen parámetros de batalla, sabotajes y comportamiento del bot.

Esta decisión permite ajustar el equilibrio, ejecutar simulaciones comparables y crear variantes sin dispersar números mágicos por el código ni modificar las reglas esenciales del motor.

### Ámbitos configurables

- Duración previa a la muerte súbita.
- Límites de sabotajes almacenados.
- Avisos e inmunidades.
- Energía necesaria y recompensas por líneas o combos.
- Activación, duración, intensidad y límites de cada sabotaje.
- Parámetros heurísticos del bot.
- Tolerancia de optimalidad y probabilidad de selección subóptima.
- Intervalos de reacción y decisión de ataques.
- Reglas habilitadas en cada modo.

### Perfiles

La configuración define los perfiles de juego y dificultad del rival:

- `training`: entrenamiento individual sin bot, sabotajes ni muerte súbita.
- `battleCadet`: modo Batalla con rival heurístico en perfil CADET (`battleCadet`, tolerancia de 80.0 puntos, reacción de 300 ms).
- `battleOperator`: modo Batalla con rival heurístico en perfil OPERATOR (`battleOperator`, tolerancia de 25.0 puntos, reacción de 200 ms, perfil por defecto).
- `battleElite`: modo Batalla con rival heurístico en perfil ELITE (`battleElite`, tolerancia de 5.0 puntos, reacción de 100 ms).

### Elementos no configurables

Las invariantes del dominio permanecerán en código:

- Geometría fundamental de las piezas.
- Reglas esenciales de colisión.
- Integridad y dimensiones del tablero.
- Orden lógico de resolución de eventos.
- Contratos del motor.
- Definición fundamental de derrota.

La configuración podrá activar reglas conocidas y ajustar parámetros, pero no introducir código dinámico ni definir nuevos tipos de sabotaje.

### Validación

La configuración tendrá un esquema estricto y deberá comprobar:

- Tipos y propiedades reconocidas.
- Rangos numéricos seguros.
- Multiplicadores y duraciones válidos.
- Referencias a perfiles existentes.
- Sabotajes conocidos.
- Existencia de una condición válida de finalización.
- Rechazo de propiedades desconocidas.

Una configuración inválida no podrá iniciar una partida. El comportamiento de respaldo, si existe, utilizará una versión segura y explícita, nunca valores parcialmente aceptados.

### Versionado y reproducibilidad

Cada partida registrará:

- Versión del motor.
- Versión de configuración.
- Perfil utilizado.
- Semilla.
- Hash o instantánea de los parámetros relevantes.

De este modo, cambios posteriores de equilibrio no alterarán la interpretación de partidas y replays antiguos.

### Gestión inicial

La configuración residirá inicialmente en el repositorio y se desplegará junto con el backend. El cliente recibirá una configuración validada al iniciar la partida.

No se desarrollará un panel de administración para el MVP. La gestión remota de perfiles, eventos o experimentos queda en el roadmap.

## Decisión funcional: generación y secuencia de piezas

### Alternativas consideradas

1. Selección aleatoria independiente en cada aparición.
2. Secuencias diferentes para cada participante.
3. Bolsa equilibrada, determinista y compartida.

### Decisión

Se utilizará una **bolsa de siete piezas**. Cada bolsa contendrá una unidad de cada forma, se barajará mediante el generador pseudoaleatorio de la partida y se consumirá por completo antes de crear la siguiente.

La partida tendrá una semilla y ambos participantes consumirán la misma secuencia en el mismo orden.

### Justificación

- Evita rachas extremas propias del azar puro.
- Garantiza que humano y bot reciben las mismas oportunidades.
- Impide que una victoria dependa de una secuencia objetivamente más favorable.
- Facilita pruebas deterministas, simulaciones y replays.
- Permite comparar versiones y perfiles del bot sobre condiciones equivalentes.

Los participantes pueden avanzar a ritmos diferentes y, por tanto, no tienen que mostrar simultáneamente la misma pieza activa. La igualdad se refiere al orden de consumo de la secuencia.

### Reserva y vista previa

- Cada participante podrá mantener una pieza en reserva.
- La reserva solo podrá utilizarse una vez por pieza activa.
- Reservar no alterará el orden de la secuencia compartida; únicamente modifica cuándo se utiliza una pieza ya obtenida.
- La interfaz mostrará inicialmente tres piezas próximas.

La cantidad de piezas que el bot utiliza para evaluar decisiones será un parámetro de su perfil. Aunque la interfaz muestre tres, un perfil puede limitar su búsqueda a la pieza actual o a la siguiente para ajustar dificultad y coste computacional.

### Reproducibilidad

La semilla, el algoritmo de barajado y su versión formarán parte de los datos necesarios para reproducir una partida. No se dependerá del generador aleatorio global del entorno de ejecución.

## Decisión funcional: sistema de rotación

### Alternativas consideradas

1. Rotación matricial simple sin desplazamientos correctores.
2. Sistema propio inspirado en estándares conocidos.
3. Implementación completa de **Super Rotation System (SRS)**.

### Decisión

Se implementará SRS completo, incluyendo:

- Estados de orientación definidos para cada pieza.
- Centros de rotación establecidos.
- Rotación horaria y antihoraria.
- Tablas de desplazamientos correctores o `wall kicks`.
- Tabla específica para la pieza larga.
- Comportamiento específico de la pieza cuadrada.
- Cancelación de la rotación cuando ninguna transición permitida produce una posición válida.

### Justificación

- Proporciona un comportamiento conocido y consistente.
- Evita decisiones arbitrarias sobre centros y desplazamientos.
- Permite rotaciones razonables junto a paredes y pilas de bloques.
- Dispone de casos de prueba bien definidos.
- Mejora la sensación de control frente a una rotación matricial básica.
- Evita mantener un sistema propio sin una ventaja funcional clara.

### Regla de igualdad entre participantes

Humano y bot utilizarán exactamente la misma operación de rotación y las mismas tablas de `wall kicks`.

El bot no podrá evaluar una coordenada final y colocar allí la pieza directamente. Sus posiciones candidatas deberán ser alcanzables mediante una secuencia válida de movimientos y rotaciones del motor, aspecto especialmente relevante durante Polaridad inversa.

### Pruebas requeridas

- Rotaciones horarias y antihorarias para todas las orientaciones.
- Rotación en espacio abierto.
- `Wall kicks` junto a ambas paredes.
- Rotaciones sobre pilas y dentro de huecos estrechos.
- Tabla específica de la pieza larga.
- Invariancia de la pieza cuadrada.
- Cancelación sin mutación parcial cuando todos los intentos fallan.
- Cuatro rotaciones consecutivas devuelven la orientación original cuando el espacio lo permite.

## Decisión funcional: fijación de piezas

### Alternativas consideradas

1. Fijación clásica asociada al siguiente intento de descenso por gravedad.
2. Fijación inmediata al tocar una superficie.
3. Retardo de fijación moderno con reinicios limitados.

### Decisión

Se utilizará un **retardo de fijación (`lock delay`) con reinicio por movimiento**, coherente con SRS y con la experiencia moderna elegida para el juego.

Parámetros iniciales:

- Retardo de fijación: 500 ms.
- Mover o rotar correctamente reinicia el temporizador.
- Máximo de 15 reinicios por pieza.
- La caída instantánea fija la pieza inmediatamente.
- Una rotación o movimiento inválido no reinicia el temporizador.

Los valores serán configurables por perfil y deberán validarse mediante pruebas de juego y simulaciones.

### Justificación

- Ofrece margen para corregir la colocación al tocar una superficie.
- Permite aprovechar los `wall kicks` de SRS.
- Mantiene una sensación de control moderna y consistente.
- El límite de reinicios evita conservar una pieza indefinidamente y bloquear la batalla.
- La caída instantánea conserva su carácter deliberado y definitivo.

### Igualdad entre participantes

Humano y bot estarán sometidos al mismo tiempo lógico, retardo y límite de reinicios. Los movimientos planificados por el bot consumirán tiempo y no podrán ejecutarse fuera de las restricciones físicas del motor.

Esta regla resulta especialmente importante durante Polaridad inversa: el bot puede agotar parte del margen mientras detecta y corrige una ejecución desviada, sin neutralizar el sabotaje de forma instantánea.

### Pruebas requeridas

- Inicio del temporizador al entrar en contacto con una superficie.
- Reinicio mediante movimiento horizontal válido.
- Reinicio mediante rotación válida.
- Ausencia de reinicio ante acciones inválidas.
- Fijación al expirar el tiempo.
- Fijación al alcanzar el límite de reinicios.
- Fijación inmediata mediante caída instantánea.
- Comportamiento determinista utilizando tiempo lógico simulado.

## Decisión funcional: puntuación, combos y energía

### Decisión

El juego premiará tres tipos de habilidad:

1. Eliminar varias líneas de forma simultánea.
2. Mantener cadenas de eliminaciones consecutivas o combos.
3. Ejecutar rotaciones avanzadas, especialmente T-Spins.

Se mantendrán separadas dos magnitudes:

- **Puntuación:** representa rendimiento y habilidad; se utiliza en estadísticas y clasificaciones cuando proceda.
- **Energía de combate:** permite obtener sabotajes y tiene impacto directo sobre el equilibrio de la batalla.

La energía utilizará las mismas señales que la puntuación, pero con una progresión más conservadora y límites explícitos. La puntuación no se convertirá directamente en energía.

### Valores iniciales de eliminaciones

| Líneas simultáneas | Puntos iniciales | Energía inicial |
| --- | ---: | ---: |
| Una | 100 | 10 |
| Dos | 300 | 25 |
| Tres | 500 | 45 |
| Cuatro | 800 | 70 |

Estos valores son hipótesis configurables y deberán equilibrarse mediante simulaciones y pruebas humanas.

### Combos

- Un combo continúa cuando se eliminan líneas con piezas consecutivas.
- Una pieza que no elimina líneas termina la cadena.
- La bonificación de puntuación crecerá con la longitud del combo.
- La energía adicional tendrá un límite por jugada para evitar cadenas de sabotajes excesivas.
- La interfaz y el audio deberán comunicar claramente el crecimiento y la ruptura del combo.

### Rotaciones avanzadas

El motor detectará inicialmente:

- T-Spin sin eliminación.
- T-Spin de una línea.
- T-Spin de dos líneas.
- T-Spin de tres líneas.

Los T-Spins que eliminan líneas recibirán una bonificación relevante de puntuación y energía. Un T-Spin sin eliminación podrá conceder puntuación, pero no generará energía o generará una cantidad mínima pendiente de balance.

El reconocimiento de T-Spin Mini se evaluará durante la implementación y podrá quedar fuera del MVP si añade complejidad desproporcionada.

### Back-to-back

- Las eliminaciones difíciles, como cuatro líneas o T-Spins con líneas, podrán iniciar una cadena `back-to-back`.
- Una nueva eliminación difícil consecutiva recibirá una bonificación.
- Una eliminación ordinaria romperá la cadena.
- La bonificación energética será menor y limitada respecto de la bonificación de puntuación.

### Caídas

- La caída blanda o instantánea podrá conceder una cantidad pequeña de puntos según distancia.
- Las caídas no generarán energía de combate.

### Comportamiento del bot

La heurística podrá valorar el potencial de eliminaciones múltiples, combos, T-Spins y cadenas `back-to-back`. El bot del MVP deberá reconocer y puntuar estas jugadas cuando estén disponibles, pero no estará obligado a construir deliberadamente estructuras complejas de T-Spin.

La planificación avanzada de estas estructuras podrá incorporarse a perfiles difíciles o al roadmap.

## Estrategia de pruebas

### Pruebas unitarias

- Aparición, movimiento y fijación de piezas.
- Colisiones y límites.
- Caída instantánea.
- Eliminación de una a cuatro líneas.
- Puntuación y combos.
- Reserva y pieza fantasma.
- Condición de derrota.

### Rotaciones

- Espacio abierto.
- Pared izquierda y derecha.
- Encima de una pila.
- Huecos estrechos.
- Rotaciones imposibles.
- *Wall kicks*.
- Casos particulares de las piezas cuadrada y larga.

### Pruebas basadas en propiedades

- Ninguna celda sale del tablero.
- No existen solapamientos ilegales.
- Una rotación no crea ni destruye bloques.
- El tablero conserva sus dimensiones.
- La misma semilla y acciones producen el mismo resultado.
- La puntuación no disminuye.

### Simulación masiva

Se ejecutarán partidas sin gráficos entre bots aleatorios, conservadores, agresivos y el bot principal. Se medirán duración, puntuación, líneas, huecos, altura, ataques, victorias y causas de derrota.

### Batalla

- Los ataques afectan solo al rival.
- Los efectos temporales terminan correctamente.
- Los límites de almacenamiento se respetan.
- Los ataques simultáneos tienen un resultado determinista.
- No existen dobles ganadores incoherentes.
- Un jugador derrotado deja de actuar.

### Replays y regresiones

Cada replay podrá conservar semilla, versión del motor, acciones, tiempo lógico, ataques, resultado y hashes intermedios. Los errores reproducibles se convertirán en pruebas de regresión.

### Backend y E2E

- Creación de jugador anónimo.
- Validación del alias.
- Inicio y finalización de partida.
- Rechazo de resultados incoherentes o duplicados.
- Ranking e historial.
- Persistencia del alias tras recargar.
- Flujo esencial de entrenamiento y batalla.

Las pruebas automáticas evitarán repetir manualmente cientos de partidas. Las partidas humanas se reservarán para evaluar controles, equilibrio, claridad, diversión, frustración, animaciones y sonido.

## Decisión arquitectónica: ciclo de partida, rankings y replays

### Inicio de una batalla

El cliente solicitará al backend una nueva partida indicando el modo o perfil seleccionado. El backend devolverá:

- Identificador único de partida.
- Semilla.
- Versión admitida del motor.
- Versión de configuración competitiva.
- Perfil del bot.
- Momento de inicio.
- Credencial o token firmado asociado a la partida.

El cliente no podrá elegir la semilla ni modificar la configuración competitiva.

### Ejecución

La batalla se ejecutará localmente en el navegador mediante el motor determinista:

- No se realizará una petición al backend por cada movimiento.
- La pérdida temporal de conexión no detendrá la partida.
- Se registrarán las acciones y eventos necesarios para reconstruirla.

### Finalización y validación

El cliente enviará resultado, métricas, hash final, resumen de eventos y, cuando proceda, replay.

El backend comprobará:

- Existencia y estado abierto de la partida.
- Validez de la credencial de partida.
- Compatibilidad de motor y configuración.
- Duración razonable.
- Coherencia entre líneas, puntuación, energía y sabotajes.
- Ausencia de valores imposibles.
- Idempotencia de la finalización.

El resultado podrá quedar en uno de estos estados:

- `validated`
- `replay_required`
- `rejected`

### Ranking de entrenamiento

La clasificación se ordenará por:

1. Mejor puntuación.
2. Mayor número de líneas.
3. Menor duración como desempate final.

Cada jugador tendrá una única entrada con su mejor resultado validado.

### Ranking de batalla

Solo las victorias podrán entrar en la clasificación competitiva. El valor inicial será:

```text
BattleScore = GameScore + VictoryBonus + TimeBonus
```

- `GameScore`: puntuación normal de la partida.
- `VictoryBonus`: bonificación fija por victoria.
- `TimeBonus`: recompensa por vencer antes, con límites configurables.

Las métricas de sabotajes se conservarán para análisis y estadísticas, pero no modificarán inicialmente el ranking. Se descarta por ahora una bonificación de presión para mantener una fórmula comprensible y reducir incentivos artificiales.

Cada jugador tendrá una única entrada con su mejor resultado validado.

### Separación competitiva

Cada clasificación quedará identificada por:

```text
mode + botProfile + competitiveVersion
```

Los cambios de equilibrio abrirán una nueva versión competitiva. Los rankings anteriores permanecerán históricos y no se mezclarán resultados obtenidos bajo reglas incompatibles.

### Política de replays

- Una partida ordinaria guardará resumen, métricas y hash final.
- Mejorar una marca personal exigirá enviar el replay completo.
- Las posiciones destacadas exigirán reproducción autoritativa en servidor.
- Los replays no competitivos podrán conservarse temporalmente y caducar.

El servidor reproducirá las acciones con la versión correspondiente del motor y verificará estado final, puntuación, métricas, resultado y hashes intermedios.

### Contenido del replay

- Semilla.
- Versión del motor y del formato.
- Perfil y configuración competitiva.
- Acciones con tiempo lógico.
- Sabotajes y eventos relevantes.
- Hashes de control.
- Resultado declarado.

No se almacenará una copia completa del tablero por fotograma. El replay contendrá los datos mínimos necesarios para reconstruir la partida.

### Consecuencia tecnológica

La reproducción del mismo motor en navegador y servidor determina la elección de Node.js y TypeScript para el backend.

## Decisión arquitectónica: Node.js y TypeScript en backend

### Alternativas consideradas

1. Node.js y TypeScript con motor compartido.
2. ASP.NET Core con una segunda implementación del motor en C#.
3. ASP.NET Core sin reproducción autoritativa de partidas.

### Decisión

Se utilizarán **Node.js y TypeScript** en el backend.

### Justificación

- Permite ejecutar exactamente el mismo paquete determinista en navegador, simulador y servidor.
- Evita duplicar reglas, puntuación, sabotajes y validación de replays en dos lenguajes.
- Reduce el riesgo de divergencias entre cliente y servidor.
- Facilita compartir contratos y esquemas dentro del monorepo.
- Simplifica las pruebas cruzadas y la reproducción autoritativa.
- Aporta aprendizaje y demuestra capacidad fuera del stack profesional habitual del alumno.

### Consecuencias aceptadas

- Se renuncia a utilizar el mayor dominio previo de ASP.NET Core.
- Será necesario establecer convenciones estrictas de arquitectura, validación y errores en Node.js.
- El motor compartido no podrá depender de APIs exclusivas del navegador ni del backend.

## Decisión arquitectónica: Fastify como framework HTTP

### Alternativas consideradas

1. Fastify.
2. NestJS.
3. Express.

### Decisión

Se utilizará **Fastify**.

### Justificación

- Ofrece validación y serialización basadas en esquemas.
- Proporciona integración suficiente con TypeScript sin imponer una arquitectura excesiva.
- Su sistema de plugins permite organizar infraestructura y módulos funcionales.
- Encaja con una API pequeña centrada en partidas, rankings, replays e identidad.
- Reduce la configuración manual necesaria frente a una base mínima con Express.
- Evita la ceremonia y superficie de framework de NestJS, innecesarias para el alcance actual.

### Consecuencias aceptadas

- La estructura modular deberá definirse explícitamente y no vendrá impuesta por el framework.
- Será obligatorio establecer convenciones para rutas, servicios, repositorios, esquemas, errores y pruebas.
- No se introducirá un contenedor de inyección de dependencias salvo necesidad demostrada.

## Decisión arquitectónica: Drizzle ORM para PostgreSQL

### Alternativas consideradas

1. Drizzle ORM.
2. Prisma ORM.
3. `node-postgres` con SQL y migraciones gestionadas manualmente.

### Decisión

Se utilizará **Drizzle ORM** sobre PostgreSQL.

### Justificación

- Permite definir el esquema en TypeScript y mantenerlo versionado junto al código.
- Ofrece consultas tipadas con una sintaxis próxima a SQL.
- Incluye soporte para generación y aplicación de migraciones.
- Introduce menos abstracción y maquinaria que Prisma para el tamaño del proyecto.
- Evita desarrollar manualmente mapeos, convenciones y sistema de migraciones sobre `node-postgres`.
- Facilita mantener visibles índices, restricciones y comportamiento relacional de PostgreSQL.

### Consecuencias aceptadas

- Se deberá revisar el SQL generado y no asumir que el tipado sustituye al diseño de base de datos.
- Las migraciones aplicadas en entornos compartidos serán archivos versionados; no se utilizará sincronización destructiva de esquema como proceso de despliegue.
- Las consultas específicas o complejas podrán utilizar SQL explícito cuando esté justificado.

## Decisión arquitectónica: monorepo con pnpm Workspaces

### Alternativas consideradas

1. pnpm Workspaces.
2. pnpm Workspaces con Turborepo.
3. npm Workspaces.

### Decisión

Se utilizará **pnpm Workspaces sin Turborepo** durante el desarrollo inicial.

### Justificación

- Permite organizar aplicaciones y bibliotecas dentro de un único repositorio.
- Enlaza paquetes internos sin necesidad de publicarlos.
- Facilita compartir el motor, configuración y contratos.
- Mantiene una única instalación y un único fichero de bloqueo de dependencias.
- Permite ejecutar comandos globales o filtrados por paquete.
- Evita incorporar prematuramente una capa adicional de orquestación y caché.

### Estructura conceptual inicial

```text
apps/
  web/
  api/
  simulator/

packages/
  game-engine/
  game-config/
  contracts/
```

La estructura podrá incorporar paquetes adicionales únicamente cuando exista una frontera de responsabilidad real. No se fragmentará el código para simular complejidad arquitectónica.

### Evolución posible

Turborepo podrá añadirse sin reorganizar el monorepo si el tiempo de compilación, pruebas o CI justifica la orquestación y caché adicionales. No forma parte del MVP.

## Decisión arquitectónica: stack de pruebas

### Alternativas consideradas

1. Vitest, Playwright y Testcontainers.
2. Vitest, Playwright y una base PostgreSQL de test fija.
3. Vitest con persistencia simulada mediante mocks.

### Decisión

Se utilizarán **Vitest, Playwright y Testcontainers con PostgreSQL real**.

### Responsabilidades

- **Vitest:** pruebas unitarias, propiedades, configuración, bot, simulaciones, servicios y pruebas de API.
- **Testcontainers:** base PostgreSQL efímera para migraciones, repositorios, restricciones e integración de la API.
- **Playwright:** flujos críticos completos en navegador y comprobaciones esenciales de integración entre Vue, Phaser y backend.

### Justificación

- Permite ejecutar pruebas aisladas y reproducibles en cualquier equipo con Docker.
- Evita depender del estado de una base de datos compartida.
- Valida PostgreSQL y las migraciones reales en lugar de sustituirlos por mocks.
- Mantiene la mayoría de pruebas rápidas y sin navegador.
- Reserva los E2E, más costosos y frágiles, para recorridos de alto valor.

### Política inicial

- El motor no dependerá de PostgreSQL, Phaser ni navegador para ejecutar sus pruebas.
- Los tests usarán tiempo lógico y generadores pseudoaleatorios controlados.
- Cada error reproducible de una partida deberá convertirse en prueba de regresión cuando resulte viable.
- Los E2E no intentarán cubrir todas las combinaciones de movimientos; esa responsabilidad pertenece al motor.
- La CI ejecutará unitarias e integración en cada cambio relevante y una selección E2E proporcionada al riesgo.

## Decisión arquitectónica: TypeBox para esquemas y validación

### Alternativas consideradas

1. TypeBox.
2. Zod.
3. Interfaces TypeScript con validación manual.

### Decisión

Se utilizará **TypeBox** como sistema transversal de esquemas.

### Ámbitos de uso

- Contratos HTTP de entrada y salida.
- Configuración del juego y perfiles.
- Formato de eventos y replays.
- Variables de entorno.
- Datos compartidos entre web, API y simulador.
- Generación de documentación OpenAPI cuando proceda.

### Justificación

- Produce JSON Schema y tipos TypeScript a partir de una única declaración.
- Encaja directamente con el modelo de validación y serialización de Fastify.
- Resulta adecuado para contratos estrictos, estructurados y versionados.
- Evita duplicar interfaces y validadores de ejecución.
- Facilita compartir definiciones dentro del monorepo.
- Reduce el riesgo de aceptar propiedades o formatos no contemplados.

### Consecuencias aceptadas

- Las transformaciones o normalizaciones complejas deberán mantenerse fuera del esquema cuando no encajen de forma clara.
- No se añadirá Zod preventivamente para formularios sencillos.
- La validación estructural no sustituirá a las reglas de dominio del motor o los servicios.

## Decisión arquitectónica: integración de Vue y Phaser

### Alternativas consideradas

1. Aplicación Vue con HUD híbrido y Phaser integrado.
2. Interfaz de batalla completa dentro de Phaser.
3. Vue y Phaser como aplicaciones separadas.

### Decisión

Se utilizará **una única aplicación Vue**. La pantalla de batalla combinará:

- **Vue, CSS y SVG:** estructura industrial, paneles, textos, indicadores, controles y overlays.
- **Una única instancia transparente de Phaser:** ambos tableros y todos los elementos dinámicos de la partida.

### Responsabilidades de Vue

- Navegación.
- Inicio y selección de modo.
- Ranking e historial.
- Ajustes y formularios.
- Marco visual Industrial Dramatic.
- Puntuación, combo, energía y sabotajes almacenados.
- Pausa, resultados, errores y estados de conexión.
- Accesibilidad de elementos interactivos.

### Responsabilidades de Phaser

- Tablero del jugador.
- Tablero del rival.
- Piezas activas y fantasmas.
- Movimiento, fijación y eliminación visual de líneas.
- Filas basura.
- Partículas y animaciones de impacto.
- Interferencia, polaridad inversa y sobrecarga.
- Efectos que atraviesan o relacionan ambos tableros.
- Presentación dinámica de la muerte súbita.

Phaser representará el estado del motor, pero no contendrá las reglas del dominio.

### Instancia única

Se utilizará un solo Canvas Phaser para la zona de combate. No se crearán instancias independientes para cada tablero.

Esto permite sincronizar la representación, coordinar efectos entre participantes y mantener un único ciclo de renderizado.

### Comunicación

Vue y Phaser se comunicarán mediante un puente de eventos tipado y una interfaz explícita. No compartirán ni mutarán directamente estructuras internas de presentación.

Ejemplo conceptual:

1. El motor produce una eliminación y energía.
2. Phaser anima la línea y las partículas.
3. Vue actualiza y anima el indicador de energía.
4. Ambos consumen el mismo evento, tiempos y tokens visuales.

### Coherencia visual

- Paleta y variables de diseño compartidas.
- Phaser con fondo transparente e integrado en las ventanas industriales.
- Medidas y coordenadas derivadas de un layout explícito.
- Animaciones coordinadas mediante eventos.
- Ningún marco luminoso permanente para ocultar diferencias entre tecnologías.

### Ciclo de vida

- La instancia Phaser se creará al entrar en la vista de batalla.
- Sus listeners, timers, texturas temporales y recursos se liberarán al salir.
- Volver a entrar no podrá duplicar instancias ni suscripciones.

## Decisión arquitectónica: estado de aplicación con Pinia

### Alternativas consideradas

1. Pinia limitado al estado de aplicación.
2. Composables de Vue como único mecanismo compartido.
3. Estado completo de aplicación y motor dentro de Pinia.

### Decisión

Se utilizará **Pinia únicamente para el estado de aplicación web**.

### Responsabilidades de Pinia

- Identidad y alias cuando se defina el modelo definitivo.
- Preferencias del usuario.
- Configuración recibida del backend.
- Resumen y resultado de la partida actual.
- Rankings e historial.
- Estados de carga y errores de navegación o API.

### Exclusiones

Pinia no almacenará:

- Matriz viva del tablero.
- Pieza activa y posición en cada frame.
- Temporizadores internos del motor.
- Cola de eventos de simulación.
- Estado interno de la heurística del bot.

El motor será la fuente de verdad de la partida y emitirá únicamente eventos o proyecciones necesarias para Vue y Phaser.

### Justificación

- Evita duplicar el estado del motor en una capa reactiva.
- Reduce actualizaciones innecesarias y riesgo de desincronización.
- Mantiene las stores centradas en navegación, persistencia y presentación.
- Proporciona un lugar explícito para estado compartido entre vistas sin dispersarlo en composables globales.

## Decisión arquitectónica: empaquetado y despliegue cloud

### Alternativas de empaquetado consideradas

1. Contenedor único con Fastify sirviendo la SPA y la API.
2. Frontend estático y API desplegados de forma independiente.
3. Docker Compose completo en un servidor administrado por el proyecto.

### Decisión de empaquetado

En producción se utilizará **un único contenedor**:

1. Vue y Phaser se compilan como archivos estáticos.
2. Los artefactos se incorporan a la imagen de la API.
3. Fastify sirve la SPA y los endpoints bajo `/api`.
4. PostgreSQL permanece como servicio gestionado externo.

En desarrollo, Vite y Fastify podrán ejecutarse por separado con proxy local para conservar recarga rápida.

### Justificación

- Una sola URL y origen.
- Ausencia de configuración CORS entre web y API.
- Un único artefacto desplegable.
- Menor número de servicios y pipelines.
- Ejecución local reproducible mediante Docker.
- Separación futura posible sin modificar el dominio ni contratos.

### Alternativas cloud consideradas

1. Azure Container Apps con Neon PostgreSQL.
2. Railway para aplicación y PostgreSQL.
3. Azure Container Apps con Azure Database for PostgreSQL.
4. Vercel con Neon PostgreSQL (arquitectura final adoptada).

### Decisión cloud inicial y evolución final

En la fase inicial de diseño se previó **Azure Container Apps** con **Neon PostgreSQL**. Sin embargo, para la entrega final del TFM se adoptó la arquitectura serverless de **Vercel** + **Neon PostgreSQL** (ver Sección 26 para el detalle del descarte de ACA por coste y complejidad operativa):

- **Vercel:** alojamiento de la SPA Vue 3 / Vite y Serverless Functions Fastify 5 para la API vía `api/[...path].ts`.
- **Neon PostgreSQL:** base de datos PostgreSQL gestionada serverless.
- **GitHub Actions:** CI de calidad y E2E, migraciones directas en CD y despliegue a Vercel.

### Justificación

- Container Apps evita administrar servidores o Kubernetes.
- La escala a cero se ajusta al tráfico intermitente de un TFM.
- Neon evita mantener una instancia PostgreSQL dedicada y sobredimensionada.
- El uso de PostgreSQL estándar y una imagen OCI mantiene portabilidad entre proveedores.
- La combinación demuestra despliegue cloud real sin introducir infraestructura innecesaria.

### Consideraciones operativas

- La aplicación y la base se desplegarán en regiones europeas próximas cuando sea posible.
- Se aceptan arranques en frío moderados fuera de la demostración.
- La conexión deberá usar TLS.
- Las credenciales se almacenarán como secretos, nunca en el repositorio o imagen.
- Las migraciones se ejecutarán como paso controlado del despliegue, no durante cada arranque concurrente de la aplicación.
- Se configurarán health checks de proceso y disponibilidad.
- La región, límites de escalado, CPU, memoria y retención se cerrarán durante la fase de infraestructura.

### Desarrollo local

Un fichero Docker Compose proporcionará al menos PostgreSQL local y, cuando resulte útil, la aplicación completa. Testcontainers seguirá siendo el mecanismo de base efímera para las pruebas de integración.

## Decisión arquitectónica: logging y observabilidad inicial

### Decisión

Se utilizará **Pino** para emitir logs estructurados, integrado con Fastify y la salida estándar del contenedor.

### Correlación

Los eventos relevantes podrán incluir, según contexto:

- `requestId`
- `matchId`
- `playerId`
- `engineVersion`
- `competitiveVersion`

Esto permitirá reconstruir el recorrido de una petición o partida sin depender de mensajes de texto aislados.

### Eventos mínimos

- Inicio y parada de la aplicación.
- Versión desplegada y configuración competitiva activa.
- Inicio y finalización de partidas.
- Validación, solicitud de replay y rechazo de resultados.
- Reproducción autoritativa de replays.
- Migraciones y comprobaciones de salud.
- Errores inesperados.
- Duración de operaciones relevantes.

### Protección de datos

No se registrarán:

- Credenciales, tokens o secretos.
- Cadenas de conexión.
- Replays completos.
- Cada movimiento individual.
- Payloads completos no saneados.
- Información personal que no sea necesaria para diagnóstico.

Pino deberá configurar redacción explícita de campos sensibles.

### Entornos

- Desarrollo: formato legible y niveles detallados.
- Producción: JSON estructurado por salida estándar.
- Niveles configurables: `debug`, `info`, `warn` y `error`.
- La plataforma cloud (Vercel) será responsable de capturar los logs y streams del servidor.

### Fuera del MVP

OpenTelemetry, Application Insights, Sentry y exportación avanzada de métricas quedan fuera hasta que exista una necesidad operativa demostrada.

## Fuera del MVP

- Multijugador humano local u online.
- WebSockets.
- Varias dificultades del bot.
- Reto diario.
- Misiones o campaña.
- Replays visibles para el usuario.
- Verificación completa de partidas en servidor.
- Controles táctiles y PWA, salvo que el avance permita incorporarlos con poco riesgo.
- Amigos, chat, temporadas, logros o tienda.
- Editor de niveles.
- Unity.
- Catálogo, carrito, checkout o backoffice.

## Roadmap posible

- Varias dificultades y personalidades del bot.
- Optimización de heurísticas mediante autojuego.
- Dificultad adaptativa.
- Retos diarios con semillas compartidas.
- Replays y partidas compartibles.
- Validación completa en servidor.
- Controles móviles y PWA.
- Misiones y modificadores.
- Multijugador online.
- Torneos y temporadas.

El roadmap no constituye un compromiso de entrega.

## Riesgos principales

1. Que el resultado parezca un clon con tres efectos añadidos.
2. Falta de identidad visual o mezcla de recursos incoherentes.
3. Sensación de control poco fluida.
4. Ataques frustrantes o desequilibrados.
5. Bot demasiado perfecto, demasiado débil o tramposo.
6. Acoplamiento del motor a Phaser.
7. Crecimiento accidental del alcance.
8. Invertir tiempo en backend antes de validar que el juego es divertido.

## Puertas de decisión antes del desarrollo completo

1. **Prototipo visual:** confirmar que puede verse profesional sin recursos complejos.
2. **Motor mínimo:** validar movimiento, rotaciones, caída y líneas mediante pruebas.
3. **Bot sin gráficos:** demostrar que toma movimientos legales y supera a un bot aleatorio.
4. **Batalla mínima:** confirmar que jugar y sabotear al rival resulta divertido.
5. **Backend:** implementarlo solo después de superar las puertas anteriores.

## Forma de trabajo con IA

El desarrollo se dirigirá conjuntamente, utilizando agentes para la implementación:

- Definición humana de producto y criterios.
- Especificaciones pequeñas antes de cada iteración.
- Generación de código asistida por IA.
- Revisión de arquitectura, resultados, capturas, diffs y pruebas.
- Validación antes de ampliar el alcance.
- Registro de decisiones y rechazo explícito de propuestas inadecuadas.

El uso profesional y crítico de IA durante el proceso formará parte del relato del TFM, aunque el código sea generado mayoritariamente por agentes.

## Decisiones pendientes

- Nombre e identidad final.
- Confirmación definitiva de Phaser frente a Canvas directo.
- Backend Node/TypeScript frente a ASP.NET Core.
- Reglas exactas para conseguir ataques.
- Duración, intensidad y contrajuego de cada sabotaje.
- Condición de victoria y tratamiento del empate.
- Necesidad real de ranking global frente a ranking personal.
- Modelo de identidad: jugador anónimo, cuenta con usuario y contraseña o evolución opcional entre ambos.
- Alcance inicial de escritorio y posible soporte móvil.
---

# Decisiones consolidadas posteriores

Esta sección actualiza y sustituye las decisiones pendientes incompatibles con lo acordado posteriormente.

## Identidad del producto

- **Nombre oficial de trabajo:** Rautfall.
- **Descriptor:** *Build. Disrupt. Survive.*
- **Repositorio previsto:** `rautfall`.
- **Ámbito de paquetes:** `@rautfall/*`.

### Justificación del nombre

**Rautfall** combina dos ideas centrales del producto:

- **`Rauta`**, palabra finlandesa asociada al hierro, conecta con la dirección visual industrial, la maquinaria, el metal oscuro y la sensación de solidez.
- **`Fall`**, en inglés, remite a la caída de las piezas, a la presión progresiva durante la partida y a la derrota del rival.

El nombre busca ser breve, contundente y fácil de recordar, sin describir de forma literal el género ni depender de la marca *Tetris*. También permite construir una identidad propia alrededor de la tensión entre ensamblar, resistir y provocar el colapso del adversario.

El descriptor **Build. Disrupt. Survive.** refuerza esta lectura:

- **Build:** construir y mantener el tablero.
- **Disrupt:** utilizar sabotajes de forma táctica.
- **Survive:** resistir la presión hasta que el rival cae.

### Logotipo

Se utilizará un logotipo tipográfico industrial:

- Letras compactas, robustas y geométricas.
- Cortes y uniones discretas inspiradas en piezas ensambladas.
- Sin icono independiente obligatorio.
- Versión principal en blanco metálico o gris claro.
- Ámbar reservado para detalles puntuales.
- Fondo grafito.
- Sin neón generalizado, `bloom` ni estética cyberpunk.
- Reproducible mediante SVG, CSS y tipografía.
- Adaptable a portada, favicon, README, presentación y vídeo.

## Identidad, autenticación y cuenta

### Modelo de acceso

Se utilizará una cuenta clásica para las funciones competitivas.

- La portada y el modo **Training** serán accesibles sin cuenta.
- **Battle**, ranking competitivo e historial requerirán autenticación.
- La cuenta tendrá alias público, correo electrónico y contraseña.
- No habrá login social en el MVP.
- La autenticación se implementará después de validar el núcleo jugable.

### Flujo de autenticación

- Registro y acceso mediante panel lateral.
- Tras autenticarse, el usuario volverá automáticamente a la acción que intentaba realizar.
- Registro con alias, correo, contraseña y confirmación.
- Inicio de sesión mediante correo y contraseña.
- Recuperación de contraseña mediante enlace temporal.
- No se obligará al usuario a registrarse antes de probar el juego.

### Política de alias

- Alias único globalmente.
- Longitud entre 3 y 20 caracteres.
- Caracteres permitidos: letras, números, guion y guion bajo.
- Sin espacios.
- Unicidad sin distinguir mayúsculas y minúsculas.
- Visible en ranking, historial y resultados.
- Modificable como máximo una vez cada 30 días.
- El jugador conservará un identificador interno estable.

### Política de contraseña

- Mínimo de 8 caracteres.
- Al menos una mayúscula.
- Al menos una minúscula.
- Al menos un número.
- Al menos un carácter especial.
- Sin espacios.
- No puede contener el correo ni el alias.
- Sin caducidad periódica.
- Sin historial de contraseñas.
- La misma política se aplicará en registro, recuperación y cambio.

### Verificación de correo

- Registro e inicio de sesión permitidos antes de verificar.
- Training accesible sin verificación.
- Battle, ranking competitivo e historial requieren correo verificado.
- Verificación mediante enlace temporal de un solo uso.
- Reenvío limitado por frecuencia.
- Un cambio de correo obliga a verificar de nuevo.
- Las respuestas no revelarán si un correo existe.

### Sesiones

- Sesiones opacas mediante cookie segura.
- Cookie con `HttpOnly`, `Secure` y `SameSite=Lax`.
- Token aleatorio de alta entropía.
- En base de datos se almacenará solo el hash del token.
- Sesiones revocables individualmente.
- Caducidad deslizante con límite máximo de 30 días.
- Cambio o recuperación de contraseña revoca las demás sesiones.
- No se almacenarán tokens de autenticación en `localStorage`.
- Las operaciones sensibles tendrán protección CSRF.
- La credencial firmada de cada partida será independiente de la sesión web.

### Recuperación y cambio de contraseña

- Solicitud de recuperación mediante correo.
- Respuesta neutra exista o no la cuenta.
- Enlace de un solo uso con caducidad de 30 minutos.
- La nueva contraseña deberá cumplir la política completa.
- El token se invalidará tras el uso.
- Se revocarán las demás sesiones.
- Cambio desde Ajustes con contraseña actual, nueva contraseña y confirmación.
- La sesión actual podrá mantenerse si el cambio se realiza autenticado.
- Sin preguntas de seguridad.
- Sin contraseñas temporales por correo.

### Eliminación de cuenta

- Solicitud desde Ajustes.
- Confirmación mediante contraseña actual.
- Desactivación inmediata.
- Periodo de gracia de 7 días.
- Revocación de sesiones y tokens.
- Eliminación posterior de correo, credenciales y datos identificativos.
- Las partidas podrán conservarse de forma anonimizada.
- La entrada activa del ranking se eliminará.
- El alias se sustituirá por una referencia anónima.
- Las estadísticas históricas agregadas no se alterarán.

### Correo transaccional

- Proveedor de producción: **Resend**.
- Integración desacoplada mediante una interfaz propia `EmailProvider`.
- Adaptador local para desarrollo y pruebas.
- Correos incluidos:
  - verificación de cuenta;
  - recuperación de contraseña.
- Plantillas HTML y texto plano versionadas.
- Sin newsletters ni campañas.
- Claves y remitente configurados mediante variables de entorno.
- Los logs no expondrán tokens ni direcciones completas.

### Protección contra abuso

- Hash de contraseñas con Argon2id.
- Inicio de sesión limitado por cuenta e IP.
- Umbral inicial: 5 intentos fallidos en 15 minutos.
- Bloqueo temporal progresivo, nunca permanente.
- Registro limitado por IP.
- Reenvío de verificación:
  - mínimo de 60 segundos entre envíos;
  - límite diario configurable.
- Recuperación limitada por IP y correo.
- Respuestas neutras para evitar enumeración de cuentas.
- Sin CAPTCHA en el MVP salvo abuso demostrado.
- Contadores y bloqueos con expiración automática.

## Rankings e historial

- Ranking global competitivo.
- Una única mejor marca por jugador en cada clasificación.
- Clasificaciones separadas por:

```text
mode + botProfile + competitiveVersion
```

- Historial personal completo de partidas.
- Vista de mejor resultado personal.
- Las versiones anteriores se conservarán como históricas.
- Los cambios de balance abrirán una nueva `competitiveVersion`.

## Alcance de dispositivos

- MVP centrado en escritorio.
- Controles principales mediante teclado.
- Soporte para portátil y monitor.
- Menús, ranking e historial responsive.
- Sin controles táctiles durante la partida en el MVP.
- En dispositivos sin teclado se mostrará un aviso claro.
- Controles táctiles y PWA quedan en el roadmap.

## Balance inicial de sabotajes

Los siguientes valores se consideran una configuración inicial conservadora y deberán validarse mediante simulaciones y pruebas humanas:

- **Sobrecarga:** +35 % de velocidad durante 6 segundos.
- **Interferencia:** oculta el tablero rival y sus indicadores tácticos durante 5 segundos.
- **Residuos:** añade 1 fila basura.
- **Polaridad inversa:** dura una pieza completa.
- **Aviso previo:** 750 ms.
- **Inmunidad posterior:** 4 segundos.
- **Máximo de filas basura pendientes:** 4.
- Los efectos temporales idénticos no se acumulan.
- Todos los valores serán configurables.

## Muerte súbita

Se utilizará presión progresiva por fases:

- Inicio a los 5 minutos.
- Aviso visible 5 segundos antes (04:55).
- Fase 1: +15 % de velocidad.
- Fase 2, tras 30 segundos: +30 %.
- Fase 3, tras otros 30 segundos: +50 %.
- Energía de combate: +20 % durante la muerte súbita.
- Inmunidad posterior a sabotajes: reducción de 4 a 2 segundos.
- Sin filas basura automáticas.
- Empate si ambos participantes son derrotados en el mismo paso lógico.
- Todos los valores serán configurables.

## Jerarquía visual de batalla

### Layouts seleccionables

Se incluirán dos disposiciones:

1. **Tactical** — predeterminada.
   - Tablero propio dominante.
   - Rival integrado como monitor industrial secundario.
   - Prioriza jugabilidad y lectura.

2. **Duel** — alternativa.
   - Ambos tableros con tamaños más similares.
   - Refuerza la sensación de enfrentamiento.
   - Orientada a pantallas grandes y demostraciones.

Reglas:

- La selección se realizará desde Ajustes.
- No podrá cambiarse durante una partida.
- En resoluciones pequeñas se forzará `tactical`.
- Ambos layouts mostrarán exactamente la misma información.
- Ambos utilizarán una única instancia de Phaser.
- No habrá editor libre de paneles en el MVP.

## Representación de sabotajes

Los sabotajes almacenados se representarán como **cartuchos industriales**:

- Dos ranuras visibles por jugador.
- Cada cartucho mostrará icono, nombre corto y estado.
- Estados previstos:
  - disponible;
  - bloqueado;
  - en enfriamiento.
- Al completar la energía, el sabotaje se insertará visualmente en una ranura libre.
- Al utilizarlo, el cartucho se expulsará o descargará mediante una animación breve.
- El siguiente sabotaje aparecerá como “en fabricación”.
- El rival mostrará cuántos cartuchos almacena, pero no necesariamente su tipo.
- Sin cartas ni inventario desplegable en el MVP.

### Código visual

- **Sobrecarga:** ámbar, icono de presión o rayo.
- **Interferencia:** cian degradado, icono de señal distorsionada.
- **Residuos:** rojo óxido, icono de fila compactada.
- **Polaridad inversa:** violeta apagado, icono de flechas cruzadas.

Los colores se intensificarán solo durante carga, aviso o activación. La identificación no dependerá únicamente del color.

## Controles

Controles predeterminados:

- Movimiento horizontal: flechas izquierda y derecha.
- Caída blanda: flecha abajo.
- Caída instantánea: espacio.
- Rotación horaria: `X` o flecha arriba.
- Rotación antihoraria: `Z`.
- Reserva: `C` o `Shift`.
- Sabotaje 1: `A`.
- Sabotaje 2: `S`.
- Pausa: `Esc`.

Reglas adicionales:

- Controles remapeables.
- Detección de teclas duplicadas.
- Opción para restaurar valores predeterminados.
- Polaridad inversa afectará solo al movimiento horizontal y a la rotación.

## Audio

Se adopta una dirección de audio industrial sintética:

- Golpes metálicos breves al fijar piezas.
- Impactos más graves al eliminar líneas.
- Zumbidos y pulsos eléctricos para la energía.
- Sonido propio para cada sabotaje.
- Alarma contenida para peligro y muerte súbita.
- Música ambiental opcional, discreta y no invasiva.
- Generación parcial mediante Web Audio.
- Colección mínima de efectos externos con licencia compatible.
- Controles independientes para activación de música y efectos (implementados).
- Persistencia de preferencias de música y efectos en almacenamiento local (implementada).
- Opción de silencio global (implementada mediante compatibilidad setMuted/isMuted).
- Controles de volumen general y sliders de volumen por canal (previstos en el roadmap futuro).
- Todo evento crítico tendrá equivalente visual.

## Pantalla inicial

Se utilizará un menú industrial compacto:

- Logo Rautfall.
- Descriptor *Build. Disrupt. Survive.*
- Acción principal: Battle.
- Acción secundaria: Training.
- Accesos a:
  - Ranking;
  - History;
  - Settings.
- Estado de sesión visible.
- Fondo técnico animado de forma sutil.
- Navegación accesible mediante teclado.
- Sin tienda, noticias, eventos o elementos de juego como servicio.

## Pantalla de resultados

Formato de informe postpartida industrial:

- Resultado: victoria, derrota o empate.
- Puntuación final.
- Líneas eliminadas.
- Duración.
- Combo máximo.
- T-Spins.
- Sabotajes obtenidos y utilizados.
- Métricas tácticas:
  - filas basura enviadas;
  - tiempo de interferencia aplicado;
  - sobrecargas activadas;
  - polaridades inversas aplicadas.
- Comparativa resumida frente al bot.
- Nueva mejor marca destacada cuando proceda.
- Acciones:
  - Rematch;
  - Main Menu;
  - Ranking;
  - History.
- Sin gráficas complejas en el MVP.

## Primera puerta de ejecución

Se desarrollará primero un **prototipo jugable vertical**.

### Incluye

- Layout Tactical.
- Tablero del jugador.
- Tablero rival.
- Caída, movimiento, rotación y fijación de piezas.
- Eliminación de al menos una línea.
- Barra de energía.
- Un cartucho industrial.
- Sabotaje Residuos.
- Estética Industrial Dramatic.
- Un efecto de audio básico.
- Integración real entre Vue y una única instancia de Phaser.

### Queda fuera de esta fase

- Backend.
- Registro e inicio de sesión.
- Ranking e historial.
- Bot heurístico completo.
- Los otros tres sabotajes.
- Balance definitivo.
- Replays y validación de partidas.

### Arquitectura del prototipo

El prototipo utilizará desde el principio un motor mínimo desacoplado de Phaser.

```text
packages/game-engine/
  board/
  pieces/
  movement/
  rotation/
  collision/
  line-clear/
  events/

apps/web/
  vue/
  phaser/
  hud/
  input/
  effects/
  audio/
```

Phaser representará el estado y recogerá la entrada, pero no decidirá colisiones, movimiento, rotación, eliminación de líneas ni reglas de sabotaje.

## Decisiones pendientes revisadas

Tras esta consolidación, permanecen abiertas únicamente decisiones que deben validarse durante implementación o pruebas:

- Confirmación definitiva de Phaser tras el prototipo visual.
- Ajuste fino de puntuación, combos, T-Spins y energía.
- Valores finales de duración, intensidad, inmunidades y límites de sabotajes.
- Pesos y parámetros finales del bot heurístico.
- Diseño definitivo de iconos, tipografía y logotipo.
- Región, límites y configuración operativa del despliegue.
- Alcance final de validación de replays dentro del tiempo disponible.

---

# Primera iteración técnica del prototipo vertical

## 1. Objetivo

La primera iteración técnica validará el núcleo físico y temporal de Rautfall mediante un prototipo jugable de escritorio. El resultado deberá demostrar que el motor propio puede ejecutar una partida determinista, independiente de Phaser y del navegador, y que puede integrarse en una pantalla Tactical construida con Vue y una única instancia de Phaser.

Esta iteración no pretende completar todavía la batalla, el backend ni el MVP completo. Su función es reducir el riesgo técnico principal antes de ampliar el alcance.

## 2. Alcance funcional incluido

El motor mínimo incluirá:

- tablero de 10 columnas por 20 filas visibles;
- 4 filas ocultas superiores, para un total interno de 24 filas;
- las siete piezas `I`, `J`, `L`, `O`, `S`, `T` y `Z`;
- generación determinista mediante bolsa de siete piezas;
- tres próximas piezas visibles;
- aparición de piezas;
- movimiento horizontal;
- rotación horaria y antihoraria;
- gravedad;
- caída blanda;
- caída instantánea;
- colisiones;
- fijación;
- eliminación simultánea de una a cuatro líneas;
- aparición de la siguiente pieza;
- derrota por bloqueo de aparición;
- pausa y reinicio coordinados desde la aplicación web;
- eventos básicos del motor.

Quedan fuera de esta iteración:

- pieza fantasma;
- reserva de pieza;
- puntuación;
- combos;
- T-Spins como clasificación o fuente de puntuación;
- `back-to-back`;
- energía funcional;
- cartuchos funcionales;
- sabotajes funcionales;
- rival real;
- bot heurístico;
- backend, autenticación, ranking, historial, PostgreSQL, correo, Azure y CI/CD;
- audio.

## 3. Elementos simulados en el layout Tactical

Durante esta primera iteración, los siguientes elementos serán exclusivamente visuales:

- tablero rival, mediante una secuencia prefijada en bucle;
- barra de energía;
- una ranura de cartucho industrial;
- representación de Residuos;
- estado del rival.

Estas simulaciones existirán únicamente en `apps/web`. No formarán parte de `packages/game-engine` ni sustituirán la implementación funcional prevista para iteraciones posteriores.

## 4. Estructura mínima del monorepo

```text
apps/
  web/

packages/
  game-engine/
  game-config/
```

No se crearán todavía `apps/api`, `apps/simulator`, `packages/contracts`, `packages/ui`, `packages/design-system` ni `packages/test-utils`. Solo se añadirán nuevas unidades cuando exista una frontera de responsabilidad real.

## 5. Responsabilidades

### 5.1. `apps/web`

Contendrá la aplicación ejecutable del prototipo:

- aplicación Vue;
- vista Tactical;
- única instancia de Phaser;
- `GameSessionController`;
- captura y normalización de entrada;
- adaptación del tiempo real a pasos lógicos;
- renderizado del tablero y de la pieza activa;
- animaciones;
- HUD;
- pausa, reanudación, reinicio y estado de fin de partida;
- simulación visual del rival, la energía, el cartucho y Residuos.

No contendrá reglas de colisión, rotación, gravedad, fijación ni eliminación de líneas.

### 5.2. `packages/game-engine`

Contendrá exclusivamente reglas deterministas e independientes de navegador:

- tablero;
- piezas;
- geometría;
- generador pseudoaleatorio;
- bolsa de siete piezas;
- aparición;
- movimiento;
- resolución de entrada horizontal;
- DAS y ARR;
- SRS;
- colisiones;
- gravedad y caídas;
- `lock delay`;
- fijación;
- eliminación de líneas;
- derrota;
- snapshots;
- eventos;
- API pública del motor.

No dependerá de Phaser, Vue, DOM, Canvas, Web Audio, `Date.now()`, `performance.now()` ni temporizadores del navegador.

### 5.3. `packages/game-config`

Contendrá perfiles y parámetros ajustables:

- versión de configuración;
- paso lógico;
- DAS;
- ARR;
- gravedad inicial;
- velocidad de caída blanda;
- `lockDelayMs`;
- `maxLockResets`;
- validación estricta del perfil.

No contendrá geometría de piezas, reglas de colisión, SRS, orden lógico ni definición de derrota.

## 6. Modelo temporal

Rautfall utilizará un motor determinista con un paso lógico fijo de 10 ms.

- Cada llamada a `step(input)` avanzará exactamente 10 ms de tiempo lógico.
- `apps/web` acumulará tiempo real y ejecutará tantos pasos como correspondan.
- El motor no conocerá el tiempo real.
- Phaser podrá renderizar a otra frecuencia sin alterar las reglas.
- Durante una pausa, `GameSessionController` dejará de invocar `step()`.
- Al reanudar, se descartará el tiempo real transcurrido durante la pausa.

La frecuencia lógica y la frecuencia de representación serán independientes. En cada frame, la aplicación podrá ejecutar varios pasos, acumular eventos y obtener un único snapshot final para Phaser.

## 7. Entrada, DAS y ARR

El motor recibirá estados de entrada, no movimientos ya repetidos por el navegador.

### DAS

**DAS — Delayed Auto Shift** es el tiempo que una dirección horizontal debe mantenerse pulsada antes de que comience el desplazamiento automático repetido.

Valor inicial: **150 ms**, equivalentes a 15 pasos lógicos.

### ARR

**ARR — Auto Repeat Rate** es el intervalo entre desplazamientos horizontales automáticos una vez superado el DAS.

Valor inicial: **50 ms**, equivalentes a 5 pasos lógicos.

### Reglas

- La pulsación inicial mueve una celda inmediatamente.
- Tras superar el DAS, el movimiento se repite según ARR.
- La dirección activa será la última pulsada.
- Cambiar de dirección produce un movimiento inmediato y reinicia el DAS.
- Si se suelta la dirección prioritaria y la otra sigue mantenida, la otra recupera el control, mueve inmediatamente y comienza su propio DAS.
- Si izquierda y derecha se activan exactamente en el mismo paso lógico, no habrá movimiento horizontal en ese paso.
- Rotación y caída instantánea serán acciones puntuales.
- La caída blanda será una acción mantenida.

## 8. API pública del motor

La API conceptual será:

```text
createGameEngine(options) -> GameEngine

GameEngine:
- step(input)
- getSnapshot()
- drainEvents()
- reset(options)
```

`GameEngineOptions` incluirá únicamente:

- `seed`;
- `config`.

Reglas:

- Toda acción de juego entrará por `step(input)`.
- No se expondrán métodos públicos como `moveLeft()`, `rotate()` o `lockPiece()`.
- Phaser y Vue no podrán modificar tablero, pieza activa, semilla ni temporizadores.
- Las utilidades que preparen estados concretos existirán solo en tests.

## 9. Modelo de estado

El motor mantendrá estado interno mutable y encapsulado.

Las capas externas recibirán:

- un snapshot de solo lectura con estado observable persistente;
- eventos tipados con hechos transitorios ocurridos durante los pasos.

El snapshot podrá incluir:

- tablero fijado;
- pieza activa;
- posición;
- orientación;
- próximas piezas;
- estado de contacto;
- progreso visible del `lock delay`;
- estado de partida.

Los eventos describirán hechos consumados. Phaser y Vue no recibirán referencias mutables al estado interno.

## 10. Eventos mínimos

El motor emitirá:

- `pieceSpawned`;
- `pieceMoved`;
- `pieceRotated`;
- `pieceDropped`;
- `pieceLocked`;
- `linesCleared`;
- `gameOver`.

Cada evento incluirá:

- `type`;
- `step`;
- `pieceId`, cuando proceda;
- datos específicos del evento.

Los intentos inválidos no emitirán eventos públicos en esta iteración.

## 11. Orden canónico de cada paso lógico

El orden será una invariante del motor:

1. lectura de entrada;
2. transformación de entrada;
3. acciones puntuales;
4. movimiento horizontal;
5. caída blanda;
6. gravedad;
7. actualización de contacto y `lock delay`;
8. fijación;
9. eliminación de líneas;
10. emisión de eventos;
11. aparición de la siguiente pieza o derrota;
12. publicación del estado observable.

Reglas asociadas:

- La rotación se resolverá antes que el movimiento horizontal.
- La caída instantánea fijará inmediatamente y detendrá el procesamiento normal de esa pieza durante el paso.
- Este orden no será configurable.

## 12. Tablero y condición de derrota

- 10 columnas.
- 20 filas visibles.
- 4 filas ocultas superiores.
- 24 filas internas.
- Las dimensiones serán invariantes, no configuración.
- Phaser dibujará únicamente las 20 filas visibles.
- La partida terminará cuando una nueva pieza no pueda ocupar legalmente su posición inicial.
- La mera presencia de bloques en filas ocultas no provocará derrota mientras la aparición siga siendo válida.

## 13. Piezas y generación determinista

Se utilizarán las siete piezas estándar y una bolsa determinista de siete piezas.

Cada bolsa:

- contendrá exactamente una pieza de cada tipo;
- se barajará mediante el generador pseudoaleatorio interno;
- se consumirá por completo antes de crear la siguiente.

La semilla y el algoritmo de barajado controlarán la secuencia. El motor mantendrá tres próximas piezas visibles.

## 14. SRS en la primera iteración

Se implementará SRS completo como sistema mecánico:

- cuatro estados de orientación;
- rotación horaria y antihoraria;
- centros de rotación definidos;
- tablas de `wall kicks` para `J`, `L`, `S`, `T` y `Z`;
- tabla específica para `I`;
- tratamiento específico de `O`;
- cancelación atómica cuando ninguna transición sea válida.

Quedan fuera:

- detección de T-Spins;
- T-Spin Mini;
- puntuación especial;
- `back-to-back`.

## 15. Gravedad y caídas

La gravedad se representará como progreso vertical acumulado en tiempo lógico.

- Gravedad inicial: **1 celda por segundo**.
- Caída blanda: **20 celdas por segundo**.
- El residuo de progreso se conservará entre pasos.
- La posición lógica permanecerá en celdas enteras.
- La caída instantánea moverá la pieza hasta la posición legal más baja y la fijará inmediatamente.
- Phaser podrá interpolar visualmente, sin alterar la posición lógica.

## 16. `Lock delay`

Parámetros iniciales:

- duración: **500 ms**;
- máximo de reinicios: **15**.

Reglas:

- comienza cuando la pieza no puede descender una celda;
- avanza cada paso mientras la pieza siga apoyada;
- un movimiento horizontal válido o una rotación válida reinician el temporizador;
- cada reinicio válido consume uno de los 15 disponibles;
- una acción inválida no reinicia ni consume contador;
- si la pieza vuelve a quedar en el aire, el temporizador se detiene;
- cuando vuelva a apoyarse, el temporizador comienza desde cero;
- el contador de reinicios se conserva durante toda la vida de la pieza;
- la caída blanda no reinicia el temporizador por sí sola;
- la caída instantánea fija inmediatamente;
- al consumir el reinicio número 15, la pieza se fija en esa misma acción.

## 17. Fijación y eliminación de líneas

- La pieza se fijará primero en el tablero.
- Después se detectarán simultáneamente todas las filas completas.
- La eliminación se resolverá en una única operación lógica.
- Las filas superiores descenderán conservando su orden.
- Las nuevas filas superiores serán vacías.
- La siguiente pieza aparecerá inmediatamente en el motor.
- No habrá `Line Clear Delay` ni `Entry Delay` lógicos en esta iteración.

El evento `linesCleared` incluirá, como mínimo:

- número de líneas;
- índices de filas;
- pieza responsable.

Phaser podrá conservar visualmente el estado previo durante una animación breve. El motor no esperará a la animación y continuará siendo la fuente de verdad.

Si llegan nuevos eventos durante la animación, Phaser los encolará y reproducirá en orden.

### Alternativas aplazadas

Se dejan documentadas para evaluación posterior:

- `Line Clear Delay`;
- `Entry Delay` o ARE;
- pausa lógica híbrida;
- retraso puramente visual.

Se descartan ahora porque añaden estados temporales, afectan a ritmo y balance y complican pruebas y replays antes de demostrar su valor.

## 18. Contrato entre motor, Phaser y Vue

Se utilizará un `GameSessionController` explícito.

Responsabilidades:

- crear y destruir el motor;
- mantener el acumulador de tiempo real;
- ejecutar pasos de 10 ms;
- transformar la entrada al contrato del motor;
- recoger y drenar eventos;
- obtener el snapshot final de cada frame;
- entregar a Phaser el estado visual;
- entregar a Vue solo una proyección del HUD;
- liberar listeners, bucles de animación y recursos al salir de la vista.

### Alternativa descartada: bus global de eventos

Se descarta un bus global compartido porque:

- oculta quién controla el ciclo de partida;
- introduce dependencias implícitas;
- facilita listeners duplicados;
- complica la destrucción ordenada;
- dificulta seguir el recorrido de una entrada;
- aumenta el riesgo de desincronización;
- puede permitir que capas de presentación alteren reglas sin pasar por el motor;
- convierte una necesidad local a la sesión en infraestructura global.

Los eventos del motor existirán, pero serán recogidos y distribuidos por `GameSessionController`.

## 19. Pausa y reinicio

### Pausa

- Será responsabilidad de `apps/web`.
- `GameSessionController` dejará de ejecutar pasos.
- No avanzarán gravedad, DAS, ARR ni `lock delay`.
- Vue mostrará el estado `PAUSED`.
- Al reanudar, se reiniciará el acumulador real para evitar recuperar el tiempo de pausa.

### Reinicio

- Se limpiarán entradas, eventos y animaciones pendientes.
- Se reiniciará el acumulador.
- Se llamará a `reset(options)` o se creará una nueva instancia.
- Phaser descartará cualquier estado visual atrasado.
- Vue volverá a `RUNNING`.

## 20. Layout Tactical de esta fase

El layout mostrará:

### Funcional

- logotipo Rautfall;
- descriptor *Build. Disrupt. Survive.*;
- tablero propio dominante;
- pieza activa;
- cuadrícula;
- tres próximas piezas;
- estado `RUNNING`, `PAUSED` o `GAME OVER`;
- controles principales;
- pausa;
- reinicio.

### Simulado

- tablero rival como monitor industrial secundario;
- energía;
- un cartucho industrial;
- Residuos;
- estado del rival.

La dirección visual será Industrial Dramatic:

- grafito y metal oscuro;
- profundidad y juntas contenidas;
- bloques vivos con volumen moderado;
- ámbar para advertencias;
- rojo para peligro;
- cian para estados activos;
- sin neón permanente, `bloom` generalizado ni apariencia de dashboard empresarial.

## 21. Estrategia de pruebas

### Pruebas de comportamiento

La mayoría se ejecutará mediante la API pública:

- `createGameEngine()`;
- `step()`;
- `getSnapshot()`;
- `drainEvents()`.

Cobertura mínima:

- determinismo con misma semilla e inputs;
- aparición y `7-bag`;
- movimiento y límites;
- DAS y ARR;
- prioridad de última dirección;
- gravedad;
- caída blanda;
- caída instantánea;
- SRS y `wall kicks`;
- colisiones;
- `lock delay`;
- fijación;
- eliminación de una a cuatro líneas;
- aparición posterior;
- derrota por bloqueo de aparición.

### Unitarias directas

- PRNG;
- barajado;
- geometría;
- tablas SRS;
- colisiones;
- compactación del tablero;
- validación de configuración.

### Utilidades de test

Podrán preparar tableros y estados concretos, pero no se exportarán desde el paquete de producción.

### E2E mínimo

Playwright validará:

- inicio de partida;
- movimiento;
- rotación;
- pausa y reanudación;
- reinicio;
- ausencia de Canvas o listeners duplicados tras salir y volver a entrar.

## 22. Criterios de aceptación

### Motor

- Misma semilla e inputs producen snapshots y eventos idénticos.
- La bolsa contiene una unidad de cada pieza por ciclo.
- Ninguna pieza sale del tablero ni atraviesa bloques.
- DAS, ARR y prioridad horizontal cumplen las reglas.
- SRS funciona en espacio abierto, paredes y pilas.
- Gravedad y caídas cumplen la configuración.
- `lock delay` cumple duración y reinicios.
- Las piezas se fijan correctamente.
- Se eliminan de una a cuatro líneas simultáneas.
- Aparece la siguiente pieza.
- La partida termina por bloqueo de aparición.

### Integración

- Existe una sola instancia Phaser.
- Entrar y salir no duplica Canvas ni listeners.
- El controlador ejecuta pasos de 10 ms.
- La pausa detiene el tiempo lógico.
- La reanudación no recupera el tiempo real de pausa.
- El reinicio limpia estado, entrada, eventos y animaciones.
- Phaser no muta el motor.
- Vue no recibe la matriz viva del tablero.
- Las líneas pueden animarse con un estado visual anterior sin bloquear el motor.

### Tactical

- El tablero propio domina claramente la composición.
- Se muestran tres próximas piezas.
- El rival simulado se entiende como monitor secundario.
- Energía, cartucho y Residuos aparecen como elementos simulados coherentes.
- Los estados de partida son visibles.
- El conjunto mantiene la dirección Industrial Dramatic.
- El prototipo es jugable con teclado en escritorio.

### Arquitectura y pruebas

- Todas las pruebas pasan.
- `game-engine` no depende de Phaser, Vue, DOM ni navegador.
- Las escenas Phaser no contienen lógica de colisión, SRS, gravedad, fijación o líneas.
- Existe al menos un E2E del flujo esencial.

## 23. Orden de implementación

### Bloque 1 — Base del monorepo y contratos

1. pnpm Workspaces y TypeScript.
2. `apps/web`, `packages/game-engine`, `packages/game-config`.
3. Vitest.
4. Esquema de configuración.
5. Tipos base, snapshot, eventos y API pública.

### Bloque 2 — Motor completo

1. tablero y piezas;
2. PRNG y `7-bag`;
3. aparición y derrota;
4. movimiento y colisiones;
5. DAS, ARR y prioridad horizontal;
6. SRS;
7. gravedad y caídas;
8. contacto, `lock delay` y fijación;
9. eliminación de líneas;
10. pruebas de comportamiento y unitarias.

### Bloque 3 — Controlador e integración Phaser

1. `GameSessionController`;
2. acumulador de tiempo;
3. entrada;
4. pausa y reinicio;
5. una instancia Phaser;
6. renderizado del snapshot;
7. animación de líneas;
8. limpieza de recursos.

### Bloque 4 — Tactical y E2E

1. marco Vue Industrial Dramatic;
2. HUD;
3. próximas piezas;
4. rival simulado;
5. energía, cartucho y Residuos simulados;
6. estados de partida;
7. E2E mínimo.

La regla de ejecución será:

> Primero demostrar que el motor es correcto sin navegador; después integrarlo; finalmente vestirlo.

Los cuatro bloques son unidades de planificación y validación. No implican necesariamente cuatro ramas ni cuatro entregas artificiales.

## 24. Carácter de las decisiones

Son decisiones arquitectónicas destinadas a mantenerse:

- motor determinista;
- paso lógico fijo;
- independencia de Phaser y navegador;
- estado interno encapsulado;
- snapshots y eventos;
- `GameSessionController`;
- separación entre motor, presentación y configuración;
- SRS;
- `7-bag`;
- pruebas sin navegador.

Son recortes exclusivos de esta primera iteración:

- un solo tablero funcional;
- rival simulado;
- energía simulada;
- cartucho simulado;
- Residuos simulado;
- ausencia de audio;
- ausencia de puntuación, reserva, pieza fantasma y combate.

Estos recortes no modifican el alcance posterior de Rautfall ni convierten el prototipo en una demo desechable.

## 25. Arquitectura de Navegación Web (Vue Router)

Rautfall utiliza **Vue Router** (`vue-router@^4`) como mecanismo único de orquestación navegacional en la aplicación web (`@rautfall/web`).

### Principios de Navegación

1. **Rutas nombradas estables (`name`)**: Todas las vistas de la aplicación se definen mediante identificadores estables (`home`, `training`, `battle`, `settings`, `history`, `ranking`, `results`, `dev-tools`, `sfx-lab`, `not-found`). Las navegaciones internas utilizan la forma `{ name: ... }`.
2. **Sincronización bidireccional URL $\leftrightarrow$ Vista**: La URL del navegador refleja en todo momento la vista activa. El uso de los botones **Atrás** y **Adelante** del navegador, así como la actualización (`F5`), preserva el estado de navegación correcto.
3. **Fuente Única de Verdad (`currentRouteName`)**: La vista renderizada y los estados derivados (`gameMode`, `isCanvasMounted`, `reconcileScreenAudio`) se calculan reactivamente a partir de `route.name`.
4. **Ciclo de vida limpio de Phaser**: Salir de las rutas de juego (`training` o `battle`) destruye la sesión Phaser activa (`game.destroy(true)`). Volver a entrar mediante navegación directa o historial crea exactamente una sesión limpia de Phaser.
5. **Guardas de navegación**:
   - `/dev-tools` y `/sfx-lab` quedan restringidos en entornos de producción (`!import.meta.env.DEV`), redirigiendo a `home`.
   - `/results` redirige a `home` (`replace`) si no existe una instantánea de partida activa en memoria.
   - Rutas no encontradas (`not-found`) redirigen inmediatamente a `home` (`replace`).

### Frontera del Servidor de Producción

- **Entorno de desarrollo (Vite) / Playwright E2E**: Vite Dev Server intercepta la navegación cliente y sirve el fallback SPA a `index.html` de forma nativa.
- **Backend API (`@rautfall/api`)**: Fastify sirve exclusivamente endpoints de la API (`/api/*`, `/health`) y no gestiona assets de la SPA en esta fase.
- **Despliegue Final**: La integración de la SPA con el servidor de producción (vía plugin de estáticos en Fastify o servidor web de producción) requerirá fallback SPA a `index.html`, garantizando que `/api/*` y `/health` conserven sus contratos.

## 26. Arquitectura de Despliegue e Infraestructura Cloud (Vercel + Neon)

Rautfall utiliza **Vercel** para la compilación y alojamiento de la SPA Vue 3 / Vite y la ejecución de la API Fastify 5 (mediante Serverless Functions / Fluid Compute), combinada con **Neon PostgreSQL** como base de datos administrada serverless.

### Estrategia de Planes

* **Desarrollo:** Vercel Hobby + Neon Free
* **Entrega/evaluación:** Vercel Pro + Neon

### Justificación de Alternativas Descartadas

**Azure Container Apps (ACA)** fue evaluada como opción de despliegue en contenedores pero descartada para la entrega del TFM por:
1. **Coste e infraestructura desproporcionados**: Para la escala de tráfico del TFM y la arquitectura del juego, mantener un registro de contenedores (ACR), entornos de Container Apps y buckets adicionaba costes fijos y gastos de mantenimiento innecesarios.
2. **Complejidad operativa**: La gestión de manifiestos, ingress y escalado en contenedores incrementaba el riesgo operativo sin aportar ventajas frente a una plataforma PaaS/Serverless administrada.

### Diseño Técnico de Despliegue

```text
GitHub Push (main)
  ↓
GitHub Actions (CI: ci.yml / CD: cd.yml)
  ├── 1. CI: quality & e2e (Tests de regresión en verde)
  ├── 2. CD: db:migrate (Ejecución contra NEON_DIRECT_URL)
  └── 3. CD: vercel deploy --prod (Despliegue automático a producción)
        ↓
     Vercel Platform (Dominio Único: https://rautfall.es)
       ├── SPA Vue 3 / Vite (apps/web/dist)
       └── Serverless Function Fastify 5 (api/[...path].ts)
            ↓
          Neon PostgreSQL (DATABASE_URL Pooled via PgBouncer)
```

1. **Adaptador Serverless de Fastify (`api/index.ts`)**:
   * Reutiliza `buildApp()` de `@rautfall/api` sin modificar la arquitectura del backend.
   * Inicializa Fastify en el ámbito del módulo (*module scope*) reutilizando el caché de peticiones en ejecuciones *warm*.
   * Delega las peticiones HTTP con `fastify.server.emit('request', req, res)`.

2. **Separación de Conexiones a Neon**:
   * **Runtime (`DATABASE_URL`)**: Cadena de conexión **Pooled** (PgBouncer) configurada en Vercel, optimizada para Serverless.
   * **Migraciones (`NEON_DIRECT_URL`)**: Cadena de conexión **Directa** configurada en los Secretos de GitHub para ejecuciones controladas de `drizzle-kit` durante el CD.
   * **Cero migraciones en Cold Start**: Ninguna Serverless Function ejecuta migraciones al arrancar.

3. **Orquestación en Vercel (`vercel.json`)**:
   * Configura la construcción del workspace (`pnpm --filter @rautfall/web build`) y salida en `apps/web/dist`.
   * Reescribe `/api/(.*)` hacia `/api/index.ts` y redirige el resto de rutas SPA (`/((?!api/).*)`) a `/index.html` bajo el mismo origen HTTPS.

4. **Deshabilitación de Auto-deploy por Git en Vercel**:
   * En la configuración del proyecto Vercel se **desactiva el auto-deploy automático por Git en `main`**. El despliegue a producción es desencadenado exclusivamente por GitHub Actions CD tras verificar las pruebas CI y aplicar con éxito las migraciones DDL con `NEON_DIRECT_URL`.

5. **Comportamiento de Cold Starts (Hobby vs. Pro)**:
   * La transición a Vercel Pro amplia tiempos de timeout y recursos pero no elimina de forma intrínseca los *cold starts* (latencia al instanciar el runtime tras inactividad), inherentes al paradigma Serverless. Dado que el motor del juego y la experiencia de partida corren en cliente, los *cold starts* sólo impactan levemente peticiones iniciales de datos (rácking/historial), no afectando a la fluidez del combate.


