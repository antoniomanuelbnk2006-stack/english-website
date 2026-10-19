# ADR-0038 · Español de A1 a C2: el pipeline, las lecciones y el audio

- **Estado:** Aceptada (cuarto paso de la base para practicar varios idiomas; sigue a [ADR-0037](0037-datos-por-idioma.md))
- **Fecha:** 2026-10-18

## Contexto

Con la base hecha (ADR-0034 a 0037) faltaba que hubiera contenido de otro idioma. El dueño pidió primero español de nivel A1 y, en cuanto estuvo, los demás niveles (A2, B1, B2, C1 y C2), con audio. El pipeline de lecciones (lecturas y escuchas) es de inglés de punta a punta: tokeniza y lematiza con `wink-nlp` (solo inglés), puntúa la cobertura con las listas abiertas NGSL y CEFR-J (de inglés) y calcula la legibilidad con fórmulas de inglés. No hay un análisis equivalente para español en el repositorio.

## Decisión

1. **El pipeline de lecciones se hace por idioma** (`language-pack.ts`): tokenizador, listas de niveles, legibilidad, palabras vacías de las comprobaciones de tareas y voz. El del inglés no cambia.
2. **Español sin modelo de lengua externo.** No hay un lematizador de español libre y ligero en el proyecto. El léxico (`es-lexicon.ts`) se genera: las palabras de contenido salen del mazo (`content/es/dictionary/*.json`) con sus terminaciones regulares; lo irregular (verbos, plurales) y las palabras gramaticales están en tablas. Es determinista y no adivina: lo que no conoce sale con categoría `X` y la calidad lo marca (`[lexicon]`), de modo que ampliar contenido es ampliar el mazo. Los niveles de las palabras son los del mazo, y la legibilidad, la de Fernández Huerta.
3. **Contenido** (`content/es/`, todo escrito por Claude): 25 fichas de gramática, 36 lecturas, 77 escuchas, 33 consignas de writing y 2 760 palabras de mazo repartidas por niveles. Por niveles (lecturas + escuchas / fichas / writings / palabras): A1 10 + 15 / 7 / 7 / 207; A2 6 + 15 / 4 / 5 / 395; B1 6 + 15 / 4 / 6 / 725; B2 5 + 12 / 4 / 6 / 397; C1 5 + 10 / 3 / 5 / 511; C2 4 + 10 / 3 / 4 / 525. Las escuchas se ampliaron el 19-oct-2026 para que no se acaben pronto: 15 por nivel en A1–B1, 12 en B2 y 10 en C1 y C2. Cada lección cumple el perfil de calidad de su nivel (longitud, cobertura, palabras fuera de nivel, frases por segmento, reparto de respuestas). Las ayudas cortas (resumen, glosario, traducciones de las reglas, consejos) van en inglés, francés, chino y japonés; las **explicaciones de las tareas** (`rationale_es`), la «lengua en foco» y el cuerpo de las fichas, solo en inglés (`body_locale: en`), y las **traducciones del mazo de A2 a C2**, también solo en inglés. Quien tenga otra interfaz ve esas en inglés (ADR-0034). **Los niveles del mazo son nuestros:** una palabra básica que se coló en un nivel alto (por haberse necesitado antes en una lección) se baja al nivel que le corresponde; así las lecturas de los niveles bajos no la cuentan como «fuera de nivel».
4. **Audio con Piper** (MIT, local, sin claves): voces `sharvard-f/-m` (CC BY 3.0: hay que citar el corpus, en `LICENSES.md`) y `davefx-m` (CC0). Piper y las voces viven en `.piper/`, fuera de git. Sin tiempos por palabra: se estiman como con Kokoro. Los diálogos usan una voz femenina y otra masculina de España (`es-ES`). Las escuchas de español llevan dictado desde el ADR-0041.
5. **Los niveles de las palabras de español salen del propio mazo:** `pnpm content:index` escribe `content/es/wordlists/levels.generated.json`. `levelOfLemma(lema, idioma)` lo lee; un idioma sin archivo no da nivel a ninguna palabra.
6. **La revisión de un writing sin IA solo mira lo que no depende de la lengua** (longitud, párrafos, frases largas) en otros idiomas. La corrección con IA conoce el idioma que se escribe (`writingSystemPrompt(interfaz, idioma)`; versión `writing@1:es`).
7. **El idioma del contenido se marca donde se muestra:** `contentLang(id)` en el servidor y `ContentLanguage` / `useContentLang()` en los componentes de cliente. La voz del navegador (`SpeakButton`) habla en el idioma de la pantalla.
8. **El validador comprueba cada mazo en su idioma** y la anotación de cada lección con el pack de su idioma.

## Alternativas consideradas

- **Escribir lecturas de español con lemas y categorías a mano.** Sale rápido, pero la cobertura («para ti: 96 %») y la promoción implícita de palabras dependen de lemas bien hechos; con lemas a mano serían engañosas.
- **Usar un lematizador de español de terceros.** No hay uno libre y ligero en el ecosistema que ya usa el proyecto; habría que evaluar (spaCy `es`, FreeLing, Stanza) y decidir qué se añade a la cadena de herramientas.
- **Traducir ya los cuerpos de las fichas a cuatro idiomas.** Multiplica por cuatro el texto sin que nadie lo haya leído aún.

## Consecuencias

- Quien elija practicar español ve fichas, lecturas, escuchas, mazo y writings; también Pronunciación y Use of English (ADR-0039) y Exámenes con el formato del DELE (ADR-0040).
- **Ampliar español es ampliar el mazo y escribir lecciones**: no hace falta tocar el pipeline mientras el vocabulario salga del mazo. Las formas sueltas o muy irregulares que el generador no deduce se listan en `content/es/wordlists/formas.json`, y `scripts/content/unknown-forms.ts` enseña las que faltan.
- **La búsqueda de palabras** busca en español desde el ADR-0041 (Wiktionary en inglés, sección «Spanish»).
- **La pronunciación** (acentos `en-GB` y `en-US`, reconocimiento de voz en inglés) es de inglés.
- **Sin revisión de un nativo.** `provenance` lo dice y debe revisarlo el dueño antes de darlo por bueno. Las voces de Piper son buenas, pero son sintéticas y con tiempos por palabra estimados.
- Falta, en orden: la revisión de un nativo, los cuerpos, las explicaciones y el mazo de A2 a C2 en francés, chino y japonés.
