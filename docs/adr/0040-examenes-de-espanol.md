# ADR-0040 · Simulacros de examen de español con el formato del DELE

- **Estado:** Aceptada (sigue a [ADR-0017](0017-simulacros-de-examen.md) y [ADR-0039](0039-pronunciacion-y-use-of-english-por-idioma.md))
- **Fecha:** 2026-10-19

## Contexto

Exámenes era la única sección que seguía vacía para quien practica español. Su formato (`exam-formats.ts`), sus notas y su conversión a la escala Cambridge son de los exámenes de Cambridge, que solo existen en inglés. El dueño pidió seguir con lo pendiente («vamos con lo siguiente») y quiere los trabajos enteros, sin pararse a preguntar. El ADR-0039 dejaba abierta la decisión de qué examen imitar.

## Decisión

1. **El examen de español es el DELE** (Diplomas de Español como Lengua Extranjera, del Instituto Cervantes): es el certificado oficial de español, igual que Cambridge lo es del inglés, y tiene un examen por nivel de A1 a C2. `exam-formats.ts` tiene ahora `DELE_FORMATS` junto a los de Cambridge, y **`examFormat(nivel, idioma)` elige el de cada idioma**. Lo usan el índice, la prueba, la corrección, la acción del Speaking y el validador.
2. **Las pruebas del DELE se encajan en las tres pantallas que ya había:** *Comprensión de lectura* (Reading), *Comprensión auditiva* (Listening, con la cinta que suena dos veces) y *Expresión e interacción orales* (Speaking, con el simulador del examinador). *Expresión e interacción escritas* lleva a «Escribir», como el Writing de Cambridge. En C1 los nombres son los del DELE (*… y uso de la lengua*). El C2 del DELE integra destrezas (lectura y audición van juntas en una prueba); aquí se reparten en una prueba de lectura y uso de la lengua y otra de audición, con las tareas de esa prueba integrada.
3. **Tareas, ítems y tiempos** siguen la estructura publicada de cada nivel (por ejemplo, el B1: lectura de 70 minutos con 5 tareas y 30 ítems; audición de 40 minutos con 5 tareas y 30 ítems; oral de 15 minutos con 4 tareas). Se usan los tipos de parte que ya existían (elegir, emparejar, fragmentos, texto con huecos de opciones y completar notas). **La web del Instituto Cervantes estaba en mantenimiento** cuando se hizo: la estructura sale de guías públicas de preparación, que no coinciden del todo entre ellas. Por eso el reparto de ítems por tarea, sobre todo en A1, A2 y C2, es **orientativo**, y la pantalla lo dice.
4. **Nota:** el DELE no tiene tabla de conversión pública. Cada prueba vale 25 puntos y aquí se da por aprobada con el 60 % (en el DELE real se aprueba con 30 de 50 puntos en cada grupo de pruebas). El oral se autoevalúa con los criterios del DELE: **Coherencia, Fluidez, Corrección, Alcance** y la **calificación holística**, de 0 a 5 cada uno (25 puntos). Los nombres van en español en todos los idiomas, como los de Cambridge van en inglés.
5. **Idioma de la pantalla:** los enunciados, textos y nombres de las tareas llevan `lang="es"` (`ContentLanguage` en la página; `contentLang(id)` en la corrección, que se pinta en el servidor). El examinador del oral habla con la voz `es-ES` del navegador. Los textos fijos (subtítulo, aviso, nota de aprobado, «no hay voz en español») tienen versión DELE en los cinco idiomas de la interfaz.
6. **Contenido:** un simulacro por nivel (18 pruebas en `content/es/exams/`), original, con audio de Piper (`pnpm content:exam-audio`, igual que el de inglés). Las explicaciones y los consejos van en inglés, como en las lecciones de español (ADR-0038). Las instrucciones de cada parte van en español, como en el cuadernillo del DELE.

## Alternativas consideradas

- **Usar el formato de Cambridge con textos en español.** Sale casi gratis, pero no prepara para ningún examen real de español.
- **SIELE** (el examen por ordenador del Cervantes). Es un solo examen para todos los niveles, con nota de 0 a 1000; no casa con un simulacro por nivel.
- **Esperar a que vuelva la web oficial** para copiar el reparto exacto de ítems. Lo que importa para practicar (pruebas, tipos de tarea, tiempos y número de preguntas) ya se conoce; afinar el reparto es cambiar unos números en `DELE_FORMATS` y el contenido de esas tareas.

## Consecuencias

- Quien practica español tiene ahora todas las secciones con contenido: fichas, lecturas, escuchas, writings, mazo, Use of English, Pronunciación y Exámenes.
- **El formato es orientativo y no está revisado contra el modelo oficial.** Conviene comprobarlo con los exámenes de muestra del Instituto Cervantes cuando su web funcione y ajustar `DELE_FORMATS` (el validador obliga a que el contenido lo siga).
- **Voces:** Piper solo tiene tres voces de España (una de mujer y dos de hombre). En las grabaciones con seis hablantes las voces se repiten por turnos, y en cada grabación hay como mucho una mujer.
- Sin revisión de un nativo, como el resto del español. El Speaking a solas tiene las mismas limitaciones que el de inglés (ADR-0017).
- Francés, chino y japonés siguen con el formato de Cambridge si algún día tienen exámenes: `examFormat` solo distingue el español. Cada idioma nuevo tendrá que elegir su examen (DELF, HSK, JLPT…).
