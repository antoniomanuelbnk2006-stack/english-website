# ADR-0041 · Dictado y diccionario completo en español

- **Estado:** Aceptada (sigue a [ADR-0038](0038-primera-tanda-de-espanol.md))
- **Fecha:** 2026-10-19

## Contexto

Al español le faltaban dos piezas que el inglés sí tenía. Las escuchas no traían **dictado**, porque el diagnóstico de errores (`dictation.ts`) solo sabía de contracciones y reducciones inglesas, de números en inglés y de la ortografía británica o estadounidense. Y el **diccionario completo** (`/palabras/buscar`) solo buscaba palabras inglesas: leía la sección `en` de Wiktionary y sus traducciones al español. El dueño eligió terminar estas dos funciones antes de pasar a otras cosas.

## Decisión

1. **El diagnóstico del dictado tiene reglas por idioma** (`DiagnoseInput.language`, inglés si no se dice). En español:
   - Una **tilde de más o de menos** cuenta como error ortográfico leve (`typo`), no como fallo de oído: el dictado mide si se ha oído, y *esta* y *está* suenan distinto, pero no tanto como para que quien escribe sin tilde no lo haya oído.
   - **Números y horas** valen con cifras o con palabras: *veintitrés* = 23, *treinta y cinco* = 35, *las once y media* = 11:30, *las ocho menos cuarto* = 7:45. *Un* y *una* se quedan como palabras, porque casi siempre son artículos.
   - No se aplican las reglas del inglés (contracciones, *gonna*, *centre*/*center*).
   - Sin lema anotado, solo se prueba el plural para saber si una palabra es conocida: las lecciones de español traen sus lemas.
   - El acento `es-ES` es el de referencia, como `en-GB` y `en-US` en inglés.
2. **El idioma llega a todos los sitios que corrigen dictados:** la pantalla del dictado (`ContentLanguage`), el repaso de tarjetas de audio (la página de repaso pone el idioma que se practica, y los textos de las tarjetas llevan ya su `lang`) y la nota del servidor (`grade(task, respuesta, idioma)`, con el idioma sacado del id de la lección).
3. **Cada escucha de español tiene dictado:** 2 frases en A1 y 3 en los demás niveles, como en inglés. Las añade `add-es-dictations.mjs` (en el scratchpad de la sesión; es idempotente) a partir de las propias frases de cada escucha. Elige frases de una longitud adecuada al nivel y repartidas por la grabación, y marca en cada una un rasgo de habla conectada de tipo `linking`: la **sinalefa** (dos vocales que se unen entre palabras, *de un*, *que hay*) o el **enlace** de consonante con vocal (*conviven estas*). La explicación y el porqué del dictado van en inglés, como las demás ayudas de las lecciones de español.
4. **El diccionario completo busca en el idioma que se practica.** Sigue consultando el Wiktionary en inglés, que tiene entradas para las palabras españolas con los significados en inglés: se lee su sección `es` (la entrada «Spanish»), la pronunciación de `{{IPA|es|…}}` cuando la hay y las formas (*casas* → *casa*, *hablé* → *hablar*, *inflection of comer: …* → *comer*). En español no hay sección de traducciones: los significados ya están en inglés, y la tarjeta de repaso los usa como traducción. La caché va por idioma y palabra.
5. Los textos del buscador que dicen «en inglés» (subtítulo, etiqueta, ejemplos, aviso de palabra no válida y de no encontrada) tienen su versión de español en los cinco idiomas de la interfaz.

## Alternativas consideradas

- **Contar la tilde como fallo.** Sería más estricto, pero mezcla ortografía con comprensión auditiva: para la ortografía ya están la escritura y Use of English.
- **Usar el Wiktionary en español** (`es.wiktionary.org`) para las palabras españolas. Tiene más entradas, pero las definiciones están en español (difíciles en A1–A2) y su formato es otro, con su propio análisis. El inglés da definiciones cortas en inglés, que es lo que necesita quien aprende.
- **Escribir los dictados a mano**, frase a frase. Serían algo mejores, pero el criterio automático (frases de longitud adecuada con un enlace claro) es el mismo que se sigue a mano y vale para las 77 escuchas.

## Consecuencias

- El español tiene ya las mismas funciones que el inglés. Lo que sigue pendiente es de contenido: la revisión de un nativo y las ayudas de A2 a C2 en francés, chino y japonés.
- **Si se vuelve a generar una escucha de español desde su módulo** (`gen2.mjs`), se pierden sus dictados: hay que volver a pasar `add-es-dictations.mjs` y después anotar y publicar.
- La pronunciación del diccionario aparece solo en las entradas españolas que la escriben a mano (`{{IPA|es|…}}`); muchas usan una plantilla que la genera sola y entonces no se enseña.
- Los dictados de español se cosechan como tarjetas de audio igual que los de inglés.
