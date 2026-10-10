# ADR-0017 · Simulacros de examen de Cambridge con formato y tiempo oficiales

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

La app ya tenía piezas sueltas con sabor a examen: los ejercicios de Use of English por partes ([ADR-0012](0012-use-of-english-y-nivel-declarado.md)) y el modo examen de Writing. El dueño, que prepara el B2 First, pidió **apartados para practicar exclusivamente el examen**, de A1 a C2, con Reading, Listening, Use of English y Speaking, **con las pruebas específicas de cada examen y su tiempo oficial**, lo más parecido posible a hacerlo de verdad.

Un ejercicio suelto de ocho huecos no entrena lo que más falla el día del examen: repartir 75 minutos entre siete partes, oír cada grabación solo dos veces sin poder pararla, o hablar un minuto seguido con el reloj corriendo.

## Decisión

Una sección nueva, **«Exámenes»** (`/examenes`), con un **simulacro por examen**. Cada simulacro tiene las mismas pruebas que el examen de Cambridge de ese nivel, cada prueba es una pantalla propia y se hace entera, de una vez y con una sola entrega.

### Qué examen corresponde a cada nivel

| Nivel | Examen | Reading (y Use of English) | Listening | Speaking |
|---|---|---|---|---|
| A2 | A2 Key | *Reading and Writing*, 60 min, 7 partes | 30 min, 5 partes, 25 preguntas | 8–10 min, 2 partes |
| B1 | B1 Preliminary | *Reading*, 45 min, 6 partes, 32 preguntas | 30 min, 4 partes, 25 preguntas | 12 min, 4 partes |
| B2 | B2 First | *Reading and Use of English*, 75 min, 7 partes, 52 preguntas | unos 40 min, 4 partes, 30 preguntas | 14 min, 4 partes |
| C1 | C1 Advanced | *Reading and Use of English*, 90 min, 8 partes, 56 preguntas | unos 40 min, 4 partes, 30 preguntas | 15 min, 4 partes |
| C2 | C2 Proficiency | *Reading and Use of English*, 90 min, 7 partes, 53 preguntas | unos 40 min, 4 partes, 30 preguntas | 16 min, 3 partes |

- **A1:** Cambridge no tiene examen de A1 para adultos (solo los infantiles, que dependen de dibujos). El simulacro de A1 usa **el formato del A2 Key con textos y audios de nivel A1**, y la pantalla lo dice. No tiene nota en la escala Cambridge: se da por aprobado con el 60 %.
- El formato (partes, tipo de tarea, número de preguntas, opciones, puntos por pregunta, límite de palabras, tiempo) está en un solo sitio, `src/lib/content/exam-formats.ts`, sacado de la página «Exam format» de cada examen en cambridgeenglish.org. **El contenido no puede salirse de él:** el validador rechaza una prueba que no tenga exactamente las partes y preguntas del examen.
- **Use of English** no es una prueba aparte en B2–C2: son las partes 2–4 de *Reading and Use of English*, y así se hace aquí, dentro del mismo reloj. La corrección sí da su nota por separado, como el certificado.
- **Writing** no se duplica: el índice enseña su tiempo oficial y lleva a «Escribir», que ya tiene modo examen con cuenta atrás. La excepción son las dos redacciones cortas del A2 Key (y del A1), que forman parte de *Reading and Writing* y entran en sus 60 minutos; no se puntúan solas: al entregar se comparan con una respuesta modelo.

### Cómo se hace una prueba

- **Reading:** todas las partes a la vista, en el orden que se quiera, y un único reloj con el tiempo oficial. El reloj no se para; al llegar a cero, la prueba se entrega sola. La prueba en curso se guarda en el navegador: recargar la página no la pierde (y el tiempo sigue corriendo).
- **Listening:** una «cinta» que suena sola de principio a fin: tiempo para leer las preguntas, **cada grabación dos veces**, una pausa y, al final, dos minutos para revisar antes de la entrega automática. No hay pausa ni rebobinado. Se puede entregar antes, con confirmación. Si se recarga la página, la prueba empieza de nuevo: una cinta no se reanuda a medias.
- **Speaking:** sin examinador ni compañero, es un simulador. La voz del navegador hace las preguntas del examinador, cada turno tiene el tiempo del examen y el micrófono graba la respuesta para escucharla después. Las grabaciones **no salen del navegador** y se borran al salir. Como nadie puede puntuar, al final el usuario se **autoevalúa** de 0 a 5 con los criterios del examinador (los de cada examen, con sus pesos: 60 puntos en el B2 First).
- **Una sola entrega.** Mientras dura la prueba, al navegador solo llegan los enunciados: las respuestas, las explicaciones y **los guiones de las grabaciones** se quedan en el servidor (`toPublicPaper`). Es la misma regla que protege la transcripción en las lecciones de escucha.

### Corrección y nota

- El servidor corrige con **los puntos del examen**: uno o dos por pregunta según la parte y, en las transformaciones, uno por cada mitad (se reutiliza la corrección de Use of English).
- La corrección da los puntos por parte y por sección y, además, una **nota orientativa en la escala Cambridge** (160 para aprobar el B2 First), con las tablas que Cambridge publica para convertir los resultados de sus simulacros oficiales («Converting practice test scores to Cambridge English Scale scores», 2023). Entre los cuatro puntos de referencia de cada tabla se interpola en línea recta.
- Después se ve cada pregunta con lo que se respondió, la respuesta correcta y la explicación en español; los textos con los huecos resueltos y, en Listening, la transcripción.

### Datos

No hay tablas nuevas. Una prueba entregada se guarda como una lección: el progreso en `lesson_progress` con el id de la prueba (`b2-exam-01-reading`) y cada respuesta en `item_attempts` (`task_type = 'exam_…'`, `phase = 'exam'`). Todas las respuestas de una entrega llevan el mismo identificador (`response.sitting`); **la corrección no se guarda: se vuelve a calcular** con las respuestas de la última entrega, así que se puede volver a ver cuando se quiera y desde otro dispositivo.

Un simulacro **no mueve el nivel estimado** (Elo) **ni da XP**: es una nota de examen, no práctica diaria, y la de Speaking es una autoevaluación.

### Contenido y audio

- Cada prueba es un fichero `content/exams/{nivel}/{nivel}-exam-NN-{reading|listening|speaking}.json` ([modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md)). Textos, guiones y preguntas son **originales**: nada copiado de exámenes reales ni de libros de preparación.
- El audio del Listening sale del mismo pipeline que las lecciones, con un comando propio, `pnpm content:exam-audio`: un fichero por grabación (la app lo reproduce dos veces), en `audio/exams/…`. Se sube con `pnpm content:upload`, igual que el de una lección.
- Hay un simulacro por nivel (dieciocho pruebas). En las partes de Listening que el examen hace con dibujos (A2 Key y B1 Preliminary, parte 1) las opciones van escritas.

## Alternativas consideradas

- **Reutilizar las lecciones y los ejercicios sueltos** marcándolos como «de examen». No da ni las partes exactas ni el reloj único, que es justo lo que se pedía.
- **Guardar la corrección** (una tabla `exam_results`). Recalcularla es barato y evita una tabla y una migración; lo único que se pierde es la corrección de una versión antigua de la prueba si el contenido cambia.
- **Corregir el Speaking con IA** a partir de una transcripción automática. Costaría dinero en cada intento y la transcripción del navegador de un minuto de habla no es fiable; la autoevaluación guiada es gratis y enseña a mirar lo que mira el examinador. Queda como posible mejora.
- **Fotos reales en el Speaking.** No hay fotos propias y no se usan imágenes de terceros: las fotos se describen con palabras. Es la diferencia más visible con el examen real.
- **Dejar pausar la cinta del Listening.** Sería más cómodo, pero quitaría lo que hace difícil la prueba. Para practicar con pausa ya está «Escuchar».
- **Una prueba de A1 con el formato de los exámenes infantiles** (Pre A1 Starters, A1 Movers). Dependen de dibujos y están pensados para niños.

## Consecuencias

- **La nota en la escala Cambridge es orientativa.** Las tablas valen para los simulacros oficiales de Cambridge, cuya dificultad está calibrada; estos textos son originales y no lo están. Sirve para saber si se va holgado o justo, no para predecir la nota. La pantalla lo dice.
- **El contenido lo ha escrito una IA y está pendiente de la revisión del dueño**, como el resto. El validador garantiza el formato, no la calidad de cada pregunta.
- **El Listening usa voces sintéticas** (las del pipeline), con menos variedad de acentos y de naturalidad que el examen real, y sin ruido de fondo.
- **El Speaking a solas no es el examen:** no hay interacción real en las partes de pareja, las fotos están descritas y la nota es propia. Sirve para practicar los tiempos, la estructura de cada parte y oírse.
- El Speaking necesita micrófono para grabar (si no hay, corre el tiempo igual, sin grabación) y un navegador con voz en inglés (si no hay, las preguntas salen escritas).
- La nota de cada prueba (la última y la mejor) se ve en el índice de «Exámenes» y en la propia prueba. No aparece en «Progreso», que sigue midiendo la práctica diaria.
- Añadir otro simulacro de un nivel es añadir tres ficheros con el número siguiente (`…-exam-02-…`): el índice los enseña solos.
