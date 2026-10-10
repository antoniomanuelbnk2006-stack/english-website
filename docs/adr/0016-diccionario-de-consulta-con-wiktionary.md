# ADR-0016 · Diccionario completo de consulta con Wiktionary

- **Estado:** Aceptada
- **Fecha:** 2026-10-10

## Contexto

El mazo de palabras ([ADR-0015](0015-mazo-de-palabras-y-pronunciacion.md)) tiene 8.642 entradas cuidadas. El dueño pidió **tener a su disposición todas las palabras del inglés**, con dos condiciones: que no cueste dinero y que no lleve mucho tiempo hacerlo.

Meter en la app un diccionario entero (más de medio millón de entradas) no cumple ninguna de las dos: escribirlo o generarlo con IA es inviable o caro, e importar uno abierto obliga a descargar y procesar gigas de datos, a guardarlos en una base de datos con buscador y a mantenerlos al día.

## Decisión

**No se guarda ningún diccionario: se consulta en el momento.** Una pantalla nueva, `/palabras/buscar`, busca cualquier palabra o expresión en **Wiktionary** en inglés, un diccionario libre (CC BY-SA 4.0) con API pública, sin clave y sin coste. Tiene más de un millón de entradas, incluidas expresiones y verbos frasales (*give up*), que el mazo casi no cubre.

- **La consulta la hace el servidor** (`src/features/dictionary/server/lookup.ts`), nunca el navegador. Son dos peticiones, o tres si las traducciones están en una subpágina:
  1. `GET /api/rest_v1/page/definition/{palabra}`: las definiciones en inglés por categoría, con ejemplos;
  2. `GET /w/api.php?action=parse&prop=wikitext`: el texto fuente, del que salen la pronunciación (AFI) y las **traducciones al español** de la sección de traducciones, acepción por acepción;
  3. lo mismo para `{palabra}/translations` cuando la página remite a ella.
- **Todo lo que llega pasa por Zod y se reduce a texto plano** (`src/features/dictionary/lib/wiktionary.ts`, lógica pura). Las definiciones vienen en HTML: se les quitan las etiquetas y las hojas de estilo, y nunca se pinta HTML ajeno. Bajo el inglés llegan también entradas «Translingual» (símbolos, códigos), que se descartan.
- **Lo que se enseña:** la palabra, su pronunciación, si está en las listas por nivel, tu estado con ella, las traducciones al español con la acepción a la que corresponden, hasta cuatro definiciones por categoría con su ejemplo y el enlace a la entrada original. Si la palabra está también en el mazo, va primero la entrada del mazo. Si es solo una forma de otra (*went* → *go*, *colour* → *color*), se enlaza a la palabra base.
- **Se puede mandar al repaso o dar por sabida**, como cualquier palabra. La tarjeta la monta el servidor volviendo a consultar la palabra: del cliente solo llega cuál es. Si está en el mazo se usa su entrada cuidada; si no, un ejemplo de Wiktionary que la contenga delante y, detrás, la primera definición y las traducciones principales (`source_segment_id = 'wikt:{lema}'`).
- **Caché en memoria** de 300 búsquedas durante un día, para no repetir peticiones. Los fallos del servicio no se guardan.
- Se llega desde «Palabras» (enlace bajo el buscador del mazo, que arrastra lo que se estuviera buscando).

## Alternativas consideradas

- **Importar el volcado de Wiktionary** (kaikki.org) a la base de datos. Daría búsqueda sin conexión y por aproximación, pero son gigas que descargar y procesar, una tabla de cientos de megas y un proceso de actualización. Es justo el «mucho tiempo» que se quería evitar.
- **Generar las entradas con la IA.** Cuesta dinero y nadie revisaría medio millón de entradas.
- **Free Dictionary API** (dictionaryapi.dev). Más cómoda de leer, pero sale de los mismos datos, la mantiene un particular, falla a menudo y no trae traducciones.
- **Un traductor automático** para las palabras sin traducción en Wiktionary. Los gratuitos limitan el uso diario y traducen sin contexto; se prefiere decir que no hay traducción y enseñar las definiciones en inglés.
- **Consultar desde el navegador.** Ahorraría el paso por el servidor, pero obligaría a abrir la CSP a un dominio externo y a montar las tarjetas con datos que controla el cliente.

## Consecuencias

- **«Todas las palabras» significa «todas las que tenga Wiktionary»**, que es más que cualquier diccionario impreso, con una calidad desigual: las palabras corrientes están muy bien; las raras pueden no tener traducción al español, y entonces solo se ven las definiciones en inglés.
- **Las traducciones no están revisadas por nadie del proyecto**, a diferencia de las del mazo. Por eso el mazo manda cuando la palabra está en los dos sitios, y la fuente se cita siempre.
- **Hace falta conexión** y el servicio puede fallar o limitar las peticiones si se hacen muchas seguidas (responde 429): la pantalla lo dice («El diccionario no responde») y no guarda ese fallo.
- **Sale un dato hacia fuera:** la palabra buscada llega a los servidores de Wikimedia, desde el servidor de la app y sin nada que identifique al usuario. Se anota en [seguridad y privacidad §7](../04-arquitectura/07-seguridad-y-privacidad.md#7-privacidad-y-rgpd).
- **El formato de Wiktionary puede cambiar.** El analizador está aislado y probado con casos del formato real; si deja de entender una respuesta, la búsqueda degrada (sin traducciones) o dice que el diccionario no responde, pero no rompe la página.
- Hay una variable de entorno nueva y opcional, `DICTIONARY_API_URL`, que solo usan los tests para apuntar a un doble de Wiktionary: ningún test llama al servicio real.
- Las tarjetas creadas desde aquí guardan en la base de datos del usuario texto de Wiktionary (CC BY-SA). Es uso personal; el origen queda en `source_segment_id`.
