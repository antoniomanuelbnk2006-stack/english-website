# ADR-0014 · Writing: revisión sin IA, respuesta modelo y detalles de la corrección con IA

- **Estado:** Aceptada
- **Fecha:** 2026-10-09

## Contexto

El diseño del writing ([pedagogía](../01-pedagogia/07-writing-y-speaking.md), [IA §3](../04-arquitectura/06-ia.md#3-feedback-de-writing), [ADR-0007](0007-ia-pregenerada-y-correccion.md)) descansa en una llamada en vivo a la API de Claude. El dueño pidió construir «la parte de writing» antes de tener una clave de la API configurada, y el propio diseño dice que **la IA no está en el camino crítico**: si la API no está, falla o se ha llegado al límite, lo demás tiene que seguir funcionando.

Sin corrección, sin embargo, un editor con contador no es una práctica de writing: escribes y no pasa nada. Hacía falta algo útil que no dependiera de la IA.

Al implementar la llamada aparecieron además tres detalles que el diseño no preveía.

## Decisión

### 1. Dos formas de revisar una entrega

Al terminar de escribir se elige:

- **Corregir con IA** (si hay clave y quedan correcciones): lo previsto en el diseño.
- **Revisar sin IA** (siempre disponible): la app devuelve
  - **comprobaciones de forma** deterministas según el nivel y el tipo de texto: longitud, párrafos, saludo y despedida, títulos de sección, conectores distintos, palabras comodín repetidas y frases demasiado largas;
  - **posibles errores**: un comprobador de patrones con los fallos típicos de hispanohablantes de [errores §5–6](../01-pedagogia/09-errores-hispanohablantes.md) (*I am agree*, *depend of*, *people is*, *since three years*…), más mayúsculas, ortografía y registro;
  - la **respuesta modelo** de la consigna;
  - una **autoevaluación**: qué puntos de la consigna cubre el texto y una nota de 0 a 5 en cada criterio de la rúbrica.

Las dos formas terminan igual: reescritura con la revisión al lado, errores al repaso e historial.

### 2. El comprobador prefiere callar a marcar algo correcto

No es un corrector gramatical y no pretende serlo. Cada regla (`features/writing/lib/rules.ts`) lleva sus propios ejemplos buenos y malos, que los tests recorren uno a uno, y **todo el inglés publicado en el repo** (lecciones y respuestas modelo) se pasa por el comprobador como guarda: si marca algo ahí, la regla está mal. Las reglas que pueden señalar algo correcto (*actually*, *sensible*, el registro) se enseñan aparte, como «compruébalo».

La revisión no se guarda: es determinista y se recalcula del texto. En `writing_submissions.feedback` solo queda la autoevaluación (`{ kind: 'self', scores, points }`).

### 3. Las consignas llevan respuesta modelo, expresiones útiles y consejos

`content/writing/{nivel}/{id}.json` añade a lo previsto `title`, `time_min`, `useful_language[]`, `tips_es[]` y `model_answer`. La respuesta modelo **solo sale del servidor después de entregar** (igual que las soluciones de Use of English), y `content:validate` exige que cumpla la longitud que pide la consigna y que pase la misma revisión automática que se le hace al usuario.

### 4. Detalles de la corrección con IA que cambian respecto al diseño

- **El cuerpo de la petición es `{ promptId, text, examMode, activeSeconds }`.** El tipo de texto, el nivel y las instrucciones se leen del contenido del repo, no del navegador: así lo que llega al modelo como «instrucciones» nunca lo escribe el cliente.
- **Las listas cerradas van como texto.** El SDK no envía los `enum` como restricción (los pasa a la descripción) y luego valida la respuesta con el esquema: si el modelo devolviera `Grammar` en vez de `grammar`, se perdería la corrección entera. El esquema que se envía (`WritingFeedbackOutput`) usa cadenas con los valores en la descripción, y `normalizeFeedback` las ajusta sin distinguir mayúsculas.
- **Se usa `messages.create`, no `messages.parse`.** `parse` intenta leer el JSON antes de que se pueda mirar `stop_reason`, de modo que una respuesta cortada por `max_tokens` saldría como un error cualquiera. Con `create` se mira primero `stop_reason` y después se valida con el mismo esquema.
- **Qué cuenta para cada límite** (migración `0004`, columna `review_kind`):
  - Solo las entregas enviadas a la IA cuentan; las revisiones sin IA, no.
  - Al **límite diario** no le cuentan los envíos que el modelo rechazó o dejó a medias (no es culpa del usuario), pero sí los que fallaron por la red o la API.
  - Al **tope mensual** le cuenta todo lo que se haya cobrado, saliera bien o no (un rechazo o un corte también consumen tokens). Es más estricto que «sumar solo los `done`».
- **`ANTHROPIC_BASE_URL`** (opcional) permite apuntar el SDK a otra URL. Lo usan los tests e2e para hablar con un doble de la API que sirve el emulador: los tests ejercitan el SDK real y nunca llaman a la API de verdad.

### 5. Los errores al repaso son tarjetas de gramática

- De la revisión sin IA: la frase del usuario ya corregida, con un **hueco** donde estaba el fallo y su frase original como contexto. Se teclea la respuesta. Hay una sola tarjeta por error y solución, aunque el fallo se repita en otros writings.
- De la IA: las `srs_candidates` que propone el modelo. Su reverso mezcla la forma correcta y la regla, así que no se pueden comparar con lo tecleado: se repasan **mirando la respuesta y valorándose uno mismo**, como las de vocabulario.

## Alternativas consideradas

- **Esperar a tener la clave.** El dueño lo pidió ya, y la revisión sin IA sigue siendo útil con clave: no gasta correcciones y sirve cuando se llega al límite.
- **Un corrector gramatical de terceros (LanguageTool u otro).** Más cobertura, pero es otro servicio (o un servidor Java en local), envía los textos fuera y no sabe qué errores son típicos de un hispanohablante ni remite a las fichas de la app.
- **Solo la respuesta modelo, sin comprobaciones.** Más simple, pero compararse con un modelo sin ninguna pista es justo lo que cuesta a un B1.
- **Guardar la revisión automática.** Innecesario: es determinista, y recalcularla hace que las mejoras de las reglas lleguen también a las entregas antiguas.

## Consecuencias

- El writing funciona desde el primer día sin clave ni coste. Con clave, la IA se suma; no sustituye.
- El comprobador **no ve todo**: ni el contenido, ni la coherencia, ni la mayoría de errores de vocabulario. La interfaz lo dice («no lo ven todo: compara con la respuesta modelo») y las notas de una revisión sin IA son autoevaluaciones, marcadas como tales en el historial.
- Cada regla nueva es código y tests; los falsos positivos se corrigen añadiendo el caso como ejemplo «bueno» de la regla.
- La corrección con IA está probada con el SDK simulado y, de extremo a extremo, contra un doble de la API. Contra la **API real** se ha hecho una sola corrección de comprobación (9 de octubre de 2026, `claude-sonnet-5-5`): un ensayo B2 de 153 palabras con errores sembrados; respondió en 14 s, las seis correcciones eran errores reales y literales del texto, y costó 0,021 $ (523 tokens de entrada, 1.573 de salida y el prompt del sistema escrito en caché). Eso confirma que la integración funciona, no la calidad del prompt: para eso falta `pnpm ai:eval` con el conjunto dorado.
- Si una corrección falla, el motivo (código HTTP y mensaje de la API, nunca la clave ni el texto) queda en el registro del servidor con la marca `[writing-feedback]`.
- Las consignas y sus respuestas modelo las ha escrito la IA y están pendientes de la revisión del dueño, como el resto del contenido.
