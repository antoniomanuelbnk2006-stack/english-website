# ADR-0035 · El contenido, por idioma: carpeta propia e id con prefijo

- **Estado:** Aceptada (segunda parte de la base para practicar varios idiomas; sigue a [ADR-0034](0034-ayudas-del-contenido-por-idioma.md))
- **Fecha:** 2026-10-15

## Contexto

Se van a practicar los cinco idiomas de la interfaz (ADR-0032). Todo el contenido actual es de inglés y vive en `content/` (lecciones, unidades, fichas de gramática, Use of English, writing, pronunciación, exámenes, mazo de palabras). Hace falta un sitio para el contenido de cada idioma y una forma de saber de qué idioma es cada cosa, sin mover el inglés.

## Decisión

1. **El inglés se queda donde está;** cada otro idioma tiene su carpeta con la misma estructura: `content/es/lessons/…`, `content/es/grammar/…`, `content/es/units.json`…
2. **El id lleva el idioma delante, salvo en inglés:** `es-a1-rea-001`, `es-a1-u01`, `es-b2-exam-01-reading`, `es.a1.ser-estar` (las fichas usan punto). Así un id solo ya dice de qué idioma es (`languageOfId`), sin consultar nada, y no hay choques entre idiomas.
3. **Un archivo tiene que estar en la carpeta del idioma de su id.** Lo comprueban los cargadores al arrancar, el índice (`pnpm content:index`) y la validación (`pnpm content:validate`); si no cuadra, fallan con un mensaje claro.
4. **Un solo recorrido para todo** (`src/lib/content/language-dirs.ts`): `contentDirs` y `listLevelFiles` devuelven los archivos de todos los idiomas, primero los de inglés, para que el orden del contenido de siempre no cambie. Lo usan los cargadores y los scripts. Lo que mira el disco va aparte de `language.ts`, que también importan los esquemas del navegador.

## Alternativas consideradas

- **Mover el inglés a `content/en/`.** Más simétrico, pero cambia cientos de rutas, el índice, las direcciones del audio y el historial de git de todo el contenido, sin ningún efecto visible.
- **Un campo `language` dentro de cada archivo.** Habría que leer el archivo para saber su idioma y mantener el dato coherente con la carpeta; con el prefijo, el id basta.
- **Ids sin prefijo, distinguidos solo por la carpeta.** Dos idiomas podrían tener el mismo id (`a1-rea-001`), y el progreso guardado en la base de datos, que usa el id, se mezclaría.

## Consecuencias

- Con el contenido de inglés todo sigue igual: el índice generado no cambia y la validación da lo mismo.
- Quedan para los pasos siguientes: el mazo de palabras y las listas de vocabulario por nivel de cada idioma (hoy solo hay de inglés), el análisis de los textos de los scripts (separar palabras, lemas y dificultad están hechos para inglés) y el selector «idioma que practicas», que decidirá qué idioma enseña cada sección.
- `docs/04-arquitectura/04-modelo-de-contenido.md` §1 recoge las carpetas y los ids.
