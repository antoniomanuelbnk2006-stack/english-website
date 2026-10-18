# ADR-0038 · La primera tanda de español (A1)

- **Estado:** Aceptada (cuarto paso de la base para practicar varios idiomas; sigue a [ADR-0037](0037-datos-por-idioma.md))
- **Fecha:** 2026-10-18

## Contexto

Con la base hecha (ADR-0034 a 0037) faltaba que hubiera contenido de otro idioma. El dueño pidió español de nivel A1 sin audio. El pipeline de lecciones (lecturas y escuchas) es de inglés de punta a punta: tokeniza y lematiza con `wink-nlp` (solo inglés), puntúa la cobertura con las listas abiertas NGSL y CEFR-J (de inglés) y calcula la legibilidad con fórmulas de inglés. No hay un análisis equivalente para español en el repositorio.

## Decisión

1. **Una primera tanda que no necesita análisis de lengua:** en `content/es/`:
   - **4 fichas de gramática** (`es.a1.ser-estar`, `presente-regulares`, `articulos-genero`, `gustar`), cada una con 3 ejemplos y 5 ítems de práctica;
   - **124 palabras** de A1 (`dictionary/a1.json`);
   - **4 consignas de writing** (`es-a1-wri-001` a `004`), con su respuesta modelo.
   Las ayudas (resumen, traducciones, reglas, consejos) están en inglés, francés, chino y japonés.
2. **El cuerpo de las fichas está en inglés** (`body_locale: en`): es la lengua de apoyo común y, con ADR-0034, cada idioma de interfaz que no tenga su versión (`<id>.<idioma>.mdx`) ve esa. Las versiones en francés, chino, japonés y español de los cuerpos quedan por escribir.
3. **Las lecturas y escuchas de español quedan fuera de esta tanda.** Hacerlas bien exige un lematizador, listas de niveles y métricas de legibilidad de español. Hacerlas «a mano» daría una cobertura léxica y unas palabras «para ti» poco fiables.
4. **Los niveles de las palabras de español salen del propio mazo** hasta que haya listas abiertas: `pnpm content:index` escribe `content/es/wordlists/levels.generated.json` con las palabras de cada `dictionary/<nivel>.json`. `levelOfLemma(lema, idioma)` lee ese archivo; sin él, el idioma no da nivel a ninguna palabra.
5. **La revisión de un writing sin IA solo mira lo que no depende de la lengua** en otros idiomas: longitud, párrafos y frases largas. El saludo, la despedida, los conectores, las palabras comodín y los errores típicos son listas de inglés y no se aplican a un texto en español.
6. **La corrección con IA conoce el idioma que se escribe:** el examinador, las tarjetas y el público son del idioma practicado (`writingSystemPrompt(interfaz, idioma)`; el texto con inglés no cambia). La versión del prompt lo apunta (`writing@1:es`).
7. **El idioma del contenido se marca donde se muestra.** Los textos que se aprenden llevaban `lang="en"` fijo: ahora lo toman del idioma del contenido (`contentLang(id)` en el servidor; `ContentLanguage` y `useContentLang()` en los componentes de cliente). La voz del navegador (`SpeakButton`) habla en el idioma de la pantalla (`es-ES`…).
8. **El validador comprueba cada mazo en su idioma:** `pnpm content:validate` recorre `content/<idioma>/dictionary/`; la comprobación contra las listas abiertas solo se hace en inglés.

## Alternativas consideradas

- **Escribir lecturas de español con lemas y categorías a mano.** Sale rápido, pero la cobertura («para ti: 96 %») y la promoción implícita de palabras dependen de lemas bien hechos; con lemas a mano serían engañosas.
- **Usar un lematizador de español de terceros.** No hay uno libre y ligero en el ecosistema que ya usa el proyecto; habría que evaluar (spaCy `es`, FreeLing, Stanza) y decidir qué se añade a la cadena de herramientas.
- **Traducir ya los cuerpos de las fichas a cuatro idiomas.** Multiplica por cuatro el texto sin que nadie lo haya leído aún.

## Consecuencias

- Quien elija practicar español ve fichas, mazo y writings; en Lectura, Escucha, Use of English, Pronunciación y Exámenes ve que aún no hay nada.
- **La búsqueda de palabras sigue siendo de inglés** (Wiktionary en inglés y su traducción); desde `Palabras → Buscar`, una palabra que no esté en el mazo de español no se podrá consultar.
- **La pronunciación**, con acentos del inglés (`en-GB`, `en-US`) y reconocimiento de voz en inglés, es de inglés.
- Todo el contenido nuevo es de IA, sin revisión de un hablante nativo: el campo `provenance` lo dice y debe revisarlo el dueño antes de darlo por bueno.
- Siguiente trabajo, en orden: lematizador y listas de español (para lecturas), cuerpos de las fichas por idioma, más palabras y consignas, y audio.
