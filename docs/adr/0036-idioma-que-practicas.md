# ADR-0036 · El idioma que practicas

- **Estado:** Aceptada (segundo paso de la base para practicar varios idiomas; sigue a [ADR-0034](0034-ayudas-del-contenido-por-idioma.md) y [ADR-0035](0035-contenido-por-idioma.md))
- **Fecha:** 2026-10-15

## Contexto

Con ADR-0035 el contenido de cada idioma vive en su carpeta y se reconoce por el prefijo del id. Falta decidir qué idioma ve cada usuario: hasta ahora todas las secciones listaban todo el contenido, que era solo de inglés. El dueño pidió un selector «idioma que practicas» en Ajustes y en el primer acceso.

## Decisión

1. **Se guarda en el perfil, sin migración.** Es una preferencia más de `profiles.settings` (jsonb): `practice_language`, uno de los cinco idiomas, inglés por defecto. Como el resto de ajustes, un valor roto o desconocido se lee como el valor por defecto.
2. **Solo se puede practicar un idioma con contenido.** `LANGUAGES_WITH_CONTENT` es el inglés más los idiomas que tienen carpeta en `content/`. `getPracticeLanguage()` devuelve el elegido si está entre ellos y, si no, inglés; las acciones que lo guardan rechazan uno sin contenido.
3. **Cada sección enseña solo ese idioma.** Las funciones que listan contenido reciben el idioma (`getLessonIndex(language)`, `getGrammarIndex(locale, language)`, `getUoeIndex`, `getWritingIndex`, `getPronunciationIndex`, `getExamTests`, y el mazo: `getDictionary`, `dictionarySizes`, `findDictionaryEntry`); el argumento es obligatorio, así que una pantalla nueva no puede olvidarse de filtrar. Lo que va ligado a un contenido concreto usa el idioma de ese contenido: las fichas a las que remite una corrección de writing son las del idioma de la consigna, y las lecciones de una ficha, las de su idioma. Las páginas de detalle (`/leer/[id]`…) abren cualquier id.
4. **El mazo de palabras, por idioma.** Cada idioma tiene el suyo (`content/<idioma>/dictionary/`) y se carga aparte: «come» no es la misma palabra en inglés que en español.
5. **El selector solo aparece si hay donde elegir.** En Ajustes («Idioma que practicas», en Estudio) y en `/nivel`, que es el primer acceso: antes del nivel se elige el idioma. Con contenido de un solo idioma no se enseña. Los nombres de los idiomas salen de `Intl.DisplayNames` en el idioma de la interfaz, calculados en el servidor.

## Alternativas consideradas

- **Una columna en `profiles`.** Más visible en la base de datos, pero exige una migración para algo que ya cabe en `settings`. Los datos por idioma (paso 3) sí necesitarán migración; el idioma elegido, no.
- **Filtrar en cada pantalla con un parámetro opcional.** Menos cambios, pero un listado nuevo podría mezclar idiomas sin que nada avisara.
- **Enseñar los cinco idiomas en el selector desde ya**, con «próximamente» en los que no tienen contenido. Confunde más que ayuda: se podrían elegir secciones vacías.

## Consecuencias

- Con el contenido de hoy (solo inglés) la app se ve igual: no aparece ningún selector y todo se filtra por inglés.
- El nivel declarado, el léxico, el repaso, los ratings y el progreso siguen siendo uno por usuario, no por idioma: es el paso siguiente (datos del usuario por idioma, con migración).
- La búsqueda de palabras en Wiktionary y las listas de niveles de los lemas (`content/wordlists`) siguen siendo de inglés; cuando haya contenido de otro idioma habrá que darle las suyas.
- El contenido de prueba de los e2e lleva una ficha de español (`es.a1.ser-estar`) para probar el selector y el filtrado.
