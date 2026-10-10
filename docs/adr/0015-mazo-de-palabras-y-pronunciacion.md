# ADR-0015 · Mazo de palabras por nivel y pronunciación con el reconocimiento de voz del navegador

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

El dueño pidió dos secciones que el diseño no tenía o dejaba para mucho más adelante:

1. Unas **tarjetas con «todas las palabras del diccionario»**, con su traducción, para aprender vocabulario directamente y no solo el que sale en las lecciones.
2. Una sección de **pronunciación** en la que la web escuche por el micrófono y diga si está bien.

Las dos chocan en parte con decisiones anteriores:

- El vocabulario se aprendía **solo en contexto**: las tarjetas salían de la cosecha de una lección, con la frase real, el audio de la lección y una definición en inglés antes que la traducción ([vocabulario §7](../01-pedagogia/05-vocabulario-y-srs.md#7-tipos-de-tarjeta)). Un mazo de palabras sueltas es otra cosa.
- El speaking era «fase posterior» y, de primeras, solo *shadowing* sin evaluación; la evaluación de pronunciación se preveía con Azure en la fase 8 ([writing y speaking §3](../01-pedagogia/07-writing-y-speaking.md#3-speaking-fase-posterior)).

## Decisión

### 1. Mazo de palabras por nivel (`/palabras`)

**Qué palabras.** No un diccionario entero (unas 170.000 entradas, la mayoría inútiles para quien aprende), sino el **vocabulario clasificado por nivel** de las listas abiertas que la app ya usa para calcular la cobertura: CEFR-J Wordlist 1.5 (A1–B2) y Octanove Vocabulary Profile (C1–C2). Son unas **8.650 palabras**, cada una en el nivel más bajo en el que aparece. Es, en la práctica, todo lo que hace falta hasta C2.

**Qué lleva cada una.** `content/dictionary/{nivel}.json` ([modelo de contenido §5](../04-arquitectura/04-modelo-de-contenido.md#5-otros-tipos-de-contenido)): la palabra, su categoría (de la lista), la **traducción** (acepciones principales; no más de tres), una **frase de ejemplo** original con la palabra marcada y, si está en la NGSL, su posición por frecuencia. Las traducciones y los ejemplos los ha escrito Claude y están pendientes de la revisión del dueño, como el resto del contenido.

**Cómo se usa.**

- **Explorar:** lista por nivel (por defecto, el elegido), con búsqueda en inglés y en español, filtro por estado y, en cada palabra, «Al repaso», «Ya la sé», escucharla y practicar su pronunciación.
- **Estudiar** (`/palabras/estudiar`): tandas de 12 palabras aún por aprender, **primero las más frecuentes**. Se ve la palabra, se piensa, se descubre la traducción y se decide: *no la sabía* (va al repaso), *la sabía* (queda como conocida) o *no me interesa* (ignorada). Cada respuesta se guarda al darla.

**Sin tablas nuevas.** El estado de cada palabra es el del léxico personal (`lexicon`) y lo que va al repaso es una tarjeta `word` (o `chunk`) normal de `srs_cards`, con `source_segment_id = 'dict:{lema}'`. La memorización la sigue haciendo el repaso espaciado de siempre, con sus límites diarios; el mazo solo decide **qué entra**. Las palabras que se dan por conocidas cuentan en la cobertura de los textos.

**La tarjeta.** Delante, la frase de ejemplo con la palabra resaltada; detrás, la traducción. Así se mantiene la regla de «siempre con contexto», aunque el contexto sea un ejemplo y no la frase donde la encontraste. La definición en inglés pasa a ser opcional en las tarjetas (`def_en`): las del mazo no la llevan.

### 2. Pronunciación (`/pronunciar`)

**Con qué se escucha.** Con el **reconocimiento de voz del navegador** (Web Speech API): gratis, sin cuentas y disponible ya en Chrome y Edge. La app pide al reconocedor hasta cinco hipótesis de lo que ha oído y las compara con lo que había que decir.

**Qué mide, y qué no.** No analiza sonidos. Mide si un reconocedor entrenado con hablantes nativos **entiende cada palabra**, que es una buena aproximación a «se me entiende»:

- todas las palabras entendidas y a la primera hipótesis → *se te entiende perfectamente*;
- entendidas, pero la hipótesis buena no era la primera → *te ha entendido, pero con dudas*;
- a partir del 70 % de las palabras → *casi*, con las palabras falladas marcadas y lo que oyó en su lugar;
- menos → *no lo ha entendido*.

Cifras, contracciones (*I'm* / *I am*), homófonos (*two* / *too*) y grafías americanas no cuentan como error. La lógica es pura y está en `src/features/pronunciation/lib/assess.ts`.

**Ejercicios.** `content/pronunciation/{nivel}/{id}.json`: cada uno trabaja un problema típico de quien habla español ([errores](../01-pedagogia/09-errores-hispanohablantes.md)) con palabras y frases, su transcripción y una explicación de cómo se hace el sonido. Los pares mínimos llevan la **confusión esperada**: si al decir *ship* el reconocedor oye *sheep*, se enseña el consejo concreto («hazla corta»). Además hay **práctica libre** con cualquier texto, a la que se llega también desde cada palabra del mazo.

**Consejos cuando no se entiende** (añadido el 10 de octubre de 2026, a petición del dueño). Al principio solo había consejo si el ejercicio preveía esa confusión concreta. Ahora, cada vez que una palabra o una frase no se entiende a la primera, la app da **consejos automáticos**, también en la práctica libre (`src/features/pronunciation/lib/tips.ts`, lógica pura). Salen de tres sitios, por este orden:

1. una lista de unas 90 **palabras con trampa** frecuentes (*comfortable*, *Wednesday*, *island*…), con su transcripción y cómo suenan de verdad;
2. **lo que se oyó en su lugar**: si por *ship* oye *sheep*, el problema es la vocal; si por *very* oye *berry*, la *v*; si por *worked* oye *work*, el final;
3. **cómo se escribe la palabra**: letras mudas, *s* + consonante, *-ed* (con su sonido /t/, /d/ o /ɪd/), *th* sorda o sonora, *h*, *v*, *sh*, terminaciones débiles (*-tion*, *-ture*, *-ous*, *-able*), la vocal /ɜː/, la *e* final muda y los finales con varias consonantes.

Con una palabra salen hasta tres consejos. En una frase sale uno por cada palabra fallada (hasta tres), con la palabra delante, y si lo que se pierde son palabras gramaticales, el de las formas débiles. La confusión prevista por el ejercicio, cuando la hay, sigue mandando y va sola. No analizan el audio: son los fallos **más probables** en quien habla español, no un diagnóstico. Las reglas son conservadoras con la ortografía (llevan sus listas de excepciones) y un test las pasa por las 8.642 palabras del mazo.

**El modelo.** La voz del navegador (síntesis del sistema), en británico o americano y a velocidad normal o lenta. No hay ficheros de audio para esto.

**Qué se guarda.** El mejor intento de cada ítem en `item_attempts` (`skill = 'speaking'`) y el progreso del ejercicio en `lesson_progress`, como en Use of English. **No mueve el nivel estimado ni da XP**: la nota la pone un reconocedor que se equivoca, y solo sirve para ver cómo vas.

**Privacidad.** El audio **no pasa por Señal**: lo procesa el servicio de reconocimiento del propio navegador (Google en Chrome, Microsoft en Edge) y la app solo recibe el texto. Se avisa en la propia pantalla. El micrófono solo se abre al pulsar «Hablar».

## Alternativas consideradas

- **Un diccionario completo de datos abiertos** (Wiktionary, FreeDict, WordNet). Cubre mucho más, pero con traducciones de calidad desigual, sin nivel y sin ejemplos pensados para quien aprende; y mete en `content/` datos de terceros con sus licencias. Para aprender importa más que las 8.650 palabras útiles estén bien que tener 170.000.
- **Generar las entradas con la API de Claude** desde el pipeline. Más rápido, pero cuesta dinero del dueño y requiere igualmente revisión; se han escrito directamente.
- **Tarjetas solo «palabra → traducción»**, sin frase. Es lo que hacen muchos mazos, y lo que peor funciona: sin contexto no se aprende el uso y la tarjeta se reconoce «de vista».
- **Un sistema de repaso propio para el mazo.** Duplicaría el SRS y partiría en dos la cola diaria.
- **Evaluación de pronunciación con Azure** (precisión por fonema, fluidez). Es lo único que de verdad puntúa sonidos, pero necesita una cuenta y claves que aún no existen, y enviar el audio a un servidor propio. Queda como mejora: la valoración está aislada detrás de una función (`assess`) y de un único punto de escucha (`listenOnce`), así que se puede añadir otro motor sin tocar las pantallas.
- **Un modelo de reconocimiento en el navegador** (Whisper o wav2vec2 con WebAssembly). Privado y sin servicios, pero son cientos de megas de descarga y es lento en un móvil.
- **Grabarse y compararse de oído** (*shadowing*, lo previsto para la v1). Sigue siendo útil y no se descarta, pero no responde a lo pedido: que la web diga si está bien.

## Consecuencias

- **Cambia una regla pedagógica**: ya se puede aprender vocabulario fuera de un texto. Se compensa con la frase de ejemplo, con el orden por frecuencia y con que la cosecha de las lecciones sigue teniendo prioridad en la práctica diaria. Las reglas de las tarjetas se actualizan en [vocabulario §7](../01-pedagogia/05-vocabulario-y-srs.md#7-tipos-de-tarjeta).
- **El mazo hay que mantenerlo**: 8.650 traducciones y ejemplos escritos de una vez tendrán errores. Corregir uno es editar una línea del JSON; `content:validate` comprueba el formato, no el significado.
- Las listas de CEFR-J y Octanove contienen bastantes derivados poco útiles (*antistatic*, *balky*). Se han mantenido para no decidir a mano qué es «útil»; «No me interesa» las quita de en medio.
- **La pronunciación depende del navegador**: en Firefox no hay reconocimiento y la app lo dice; en Safari es irregular. Y necesita conexión.
- **El reconocedor no es un profesor**: con palabras muy cortas falla aunque se digan bien, y en una frase el contexto le ayuda a «entender» palabras mal dichas. Por eso los ejercicios mezclan palabras sueltas (más exigentes) y frases, y por eso el resultado no toca el nivel.
- **No se ha podido probar con un micrófono real**: los tests sustituyen el reconocedor por un doble que «oye» lo que se le dice. Todo lo demás (valoración, consejos, recorrido, guardado) sí está probado. La primera prueba real la hace el dueño.
- La voz del dueño sale hacia el proveedor del navegador cuando usa esta sección. Es su decisión y se indica en pantalla; se documenta en [seguridad y privacidad §7](../04-arquitectura/07-seguridad-y-privacidad.md#7-privacidad-y-rgpd).
