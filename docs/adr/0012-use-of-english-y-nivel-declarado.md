# ADR-0012 · Sección «Use of English» con formato de examen y nivel elegido por el usuario

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

Tras probar el MVP, el dueño pidió tres cosas que el diseño original no contemplaba o dejaba para más adelante:

1. Una sección de **Use of English** para practicar también de cara al examen **B2 First** de Cambridge. El diseño solo preveía fichas de gramática con mini-práctica, sin formato de examen.
2. Que la app sirva para **todos los niveles (A1–C2)** desde ya, no solo para B1, y que sea el usuario quien **elija su nivel**. El roadmap dejaba el nivel para el test de la fase 5 y el contenido se iba a producir primero para B1–B2.
3. Más contenido: había dos lecciones.

## Decisión

**Use of English.** Nuevo tipo de contenido, `content/use-of-english/{nivel}/{id}.json` (`{nivel}-uoe-{nnn}`), con los cuatro tipos de tarea de los exámenes de Cambridge: elegir la palabra (*multiple-choice cloze*), completar el texto (*open cloze*), formar palabras (*word formation*) y transformar frases (*key word transformations*). El esquema está en `src/lib/content/uoe-schema.ts` y `pnpm content:validate` comprueba sus reglas.

- Se adapta al nivel con los formatos del examen correspondiente: A1–A2, textos cortos con 3 opciones u *open cloze* (A2 Key); B1, además, formación de palabras y transformaciones sencillas; B2, C1 y C2, las cuatro partes con sus límites de palabras (2–5, 3–6 y 3–8).
- **Corrige el servidor** con las reglas del examen: un punto por hueco y dos por transformación, en dos mitades; fuera del límite de palabras o sin la palabra dada, cero. Las respuestas y las explicaciones no viajan al navegador hasta corregir.
- Cada hueco lleva una **explicación en español**. Los fallos se pueden enviar al repaso como tarjetas `grammar` (como mucho 5 por ejercicio).
- El progreso se guarda en `lesson_progress` con el id del ejercicio y los intentos en `item_attempts` con `skill = 'grammar'`, igual que las fichas de gramática. No hay tablas nuevas.
- Todos los textos son **originales**. La app indica que no está afiliada a Cambridge.

**Nivel elegido.** En el primer acceso, `/hoy` lleva a `/nivel`, donde se elige el nivel (A1–C2) con una descripción de cada uno; se guarda en `profiles.declared_level` y se puede cambiar cuando se quiera. Ese nivel:

- es el filtro **por defecto** de las bibliotecas de escucha, lectura y Use of English (con «Todas» a un toque) y decide qué fichas de gramática salen primero;
- sigue siendo la base de la cobertura léxica mientras no haya test de nivel.

**Contenido para todos los niveles.** Se publica al menos una lectura, una escucha, una ficha de gramática y ejercicios de Use of English por nivel.

## Alternativas consideradas

- **Meter Use of English dentro de las fichas de gramática.** Más simple, pero el formato de examen (texto con ocho huecos, límites de palabras, puntuación por mitades) no encaja en una mini-práctica de cinco frases.
- **Corregir en el navegador**, como las tareas de las lecciones. Más rápido de implementar, pero en un ejercicio de examen ver las respuestas en la pestaña de red le quita el sentido.
- **Esperar al test de nivel (fase 5)** para asignar el nivel. Deja la app inservible para quien no sea B1 hasta entonces. El nivel declarado es peor estimación, pero inmediata, y el test podrá sustituirlo.
- **Tabla propia para el progreso de los ejercicios.** Innecesaria: `lesson_progress` ya guarda estado y nota por id de texto.

## Consecuencias

- El alcance crece: ya no es «B1→B2 primero», sino los seis niveles con poca profundidad en cada uno. Hay que seguir produciendo contenido para que cada nivel tenga recorrido.
- Use of English entrena gramática y léxico **productivos**, algo que la visión original dejaba en segundo plano frente a escucha y lectura. Es una ampliación de prioridades pedida por el dueño.
- El nivel declarado puede ser erróneo. Se mitiga con la recomendación de elegir el más bajo en caso de duda y con que cambiarlo es inmediato; el test de la fase 5 sigue previsto.
- El audio de las lecciones nuevas se ha generado con **Kokoro** (la alternativa local que ya contemplaba [ADR-0005](0005-tts-azure-con-abstraccion.md)), porque aún no hay claves de Azure. Kokoro solo tiene voces británicas y estadounidenses y no da tiempos por palabra: se estiman a partir de las pausas del audio, así que el karaoke es aproximado. Cuando haya claves, las lecciones se pueden volver a locutar con Azure subiendo `version`.
