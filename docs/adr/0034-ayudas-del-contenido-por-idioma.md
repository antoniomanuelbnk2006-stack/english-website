# ADR-0034 · Las ayudas del contenido, en el idioma de quien aprende

- **Estado:** Aceptada (primera parte de la base para practicar varios idiomas; sigue a [ADR-0032](0032-cinco-idiomas-para-todo-el-publico.md))
- **Fecha:** 2026-10-15

## Contexto

Señal va a tener contenido para practicar cinco idiomas, para gente con la interfaz en cualquiera de los cinco (ADR-0032). Todo el contenido actual es de inglés y está escrito para hispanohablantes: las traducciones del glosario, las explicaciones de las respuestas, los consejos, los resúmenes… están en español, en campos que terminan en `_es`. El dueño decidió que las ayudas salgan en el idioma de la interfaz de cada usuario.

## Decisión

1. **Lo que se aprende se hace una vez por idioma; las ayudas, en cada idioma de interfaz.** Un campo de ayuda (`helpText()` en `src/lib/content/help.ts`) admite una cadena —el contenido de inglés, con las ayudas en español, que no cambia— o un objeto con una ayuda por idioma de interfaz, con el inglés obligatorio: `{ en, es?, fr?, zh?, ja? }`. Cada idioma pasa las mismas reglas que la cadena (longitud mínima y máxima).
2. **Se resuelven en el servidor, al cargar el contenido.** Al validar, cada objeto de ayudas se convierte en `HelpTranslations`; `localize(contenido, idioma)` lo cambia, a cualquier profundidad, por la ayuda del idioma de la interfaz o, si falta, por la de inglés. Los cargadores reciben el idioma (`findUoeSet(id, locale)`, `getGrammarIndex(locale)`…) o lo leen de la petición (`loadLesson`), y recuerdan el resultado de cada idioma.
3. **Los tipos obligan.** Los tipos que usan las pantallas son los ya resueltos (`Lesson`, `UoeSet`, `GrammarMeta`… = `Localized<…>`); los de los archivos llevan delante `Raw` (`RawLesson`, `RawUoeSet`…) y son los que usan los scripts y las comprobaciones. Si a una pantalla le llega contenido sin resolver, no compila.
4. **Los nombres `*_es` se quedan.** Son unas 2.600 apariciones entre código y contenido; renombrarlas no cambiaría nada de lo que se ve. Hay que leerlos como «ayuda», no como «español».
5. **Frase y traducción.** Los ejemplos de gramática y las palabras del mazo se leen como `text` + `translation` (la traducción es una ayuda, por idioma de interfaz). El contenido de inglés conserva su forma (`{ en, es }` en los ejemplos, `es` en el mazo) y el esquema la convierte al validar. `getDictionary(level, locale)` y `findDictionaryEntry(lemma, locale)` reciben el idioma.
6. **El cuerpo de las fichas, por idioma.** Cada ficha dice en qué idioma está su cuerpo (`body_locale`, por defecto `es`) y puede tener versiones en otros idiomas de interfaz al lado (`<id>.<idioma>.mdx`, solo el cuerpo). Se enseña la del idioma de la interfaz; si no hay, la de inglés; si tampoco, la del archivo. Cada idioma tiene sus seis secciones (`GRAMMAR_SECTIONS_BY_LOCALE`), y la validación revisa cada versión con las suyas y avisa de versiones sin ficha.
7. **Las correcciones con IA, en el idioma de la interfaz.** El prompt del sistema del writing se arma por idioma (`writingSystemPrompt(locale)`, `docs/04-arquitectura/06-ia.md` §3.3). En español es idéntico al de antes y sigue en `writing@1`; en los demás se guarda `writing@1+<idioma>`.

## Alternativas consideradas

- **Renombrar los campos** (`summary_es` → `summary`…) en el código, el contenido y los scripts. Es lo más limpio a la larga, pero es mucho cambio sin ningún efecto visible; se puede hacer más adelante de una vez.
- **Distinguir las ayudas por su forma** (`{ en, … }`) al resolver. Los ejemplos de gramática ya tienen esa forma (`{ en, es }` = frase y traducción) y no son ayudas: por eso se convierten en una clase propia al validar.
- **Resolver en cada pantalla** (`help(lesson.summary_es)`). Serían más de 300 sitios y cualquiera se podría olvidar; resolviendo en el cargador, las pantallas no cambian.
- **Un archivo de ayudas aparte por idioma** (`a1-rea-001.fr.json`). Duplica identificadores y referencias, y es fácil que se desincronicen.

## Consecuencias

- El contenido de inglés se ve exactamente igual: sus ayudas son cadenas y salen tal cual en cualquier idioma de interfaz. Traducirlas es otro trabajo.
- Con la interfaz en otro idioma, las correcciones de writing ya llegan en ese idioma; las fichas y el mazo de inglés siguen en español hasta que se traduzcan (basta con añadir `<id>.<idioma>.mdx` o pasar la traducción a objeto).
- El prompt de writing en otros idiomas no ha pasado aún por una evaluación con textos reales; hay que hacerla antes de dar por buenas sus correcciones.
- `docs/04-arquitectura/04-modelo-de-contenido.md` §2 recoge el cambio en el esquema.
