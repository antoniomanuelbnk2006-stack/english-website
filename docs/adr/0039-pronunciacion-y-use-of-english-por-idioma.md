# ADR-0039 · Pronunciación y Use of English en otros idiomas

- **Estado:** Aceptada (sigue a [ADR-0038](0038-primera-tanda-de-espanol.md))
- **Fecha:** 2026-10-19

## Contexto

Quien practicaba español veía vacías las secciones de Pronunciación y Use of English, y Exámenes. Los cargadores de contenido de las tres ya leían `content/<idioma>/…` (ADR-0035), pero la pantalla de pronunciación asumía inglés (acentos británico y americano, reconocimiento de voz en `en-*`, comparación de palabras con contracciones y homófonos ingleses) y el esquema de Use of English solo admitía palabras dadas en `A-Z`.

## Decisión

1. **Pronunciación por idioma.** El idioma sale del contexto de contenido (`ContentLanguage`). En español se oye la voz `es-ES` del navegador, se reconoce con `es-ES` y se oculta el selector de acento. `assess(texto, hipótesis, confusiones, idioma)` valora el español con sus propias reglas: las **tildes cuentan** (el reconocedor las escribe y cambian palabras: *hablo* / *habló*), la `ñ` se conserva, las cifras valen por su nombre en español y unos pocos homófonos (*hola* / *ola*) valen como iguales. Los consejos por letras mudas y sonidos (`tips.ts`) son de inglés y no se usan en otros idiomas: valen los de cada ejercicio (`confusions`).
2. **Use of English por idioma.** El esquema admite palabras dadas con tilde y `ñ` (`/^[A-ZÁÉÍÓÚÜÑ]+$/`). Las cuatro partes (elegir, hueco abierto, formar la palabra y transformar la frase) valen igual en español. La corrección distingue tildes, como en las lecciones.
3. **Las etiquetas `lang` de estas pantallas** se toman del idioma del contenido, no del inglés.
4. **Contenido:** 21 ejercicios de pronunciación (A1–C2: vocales, r/rr, j/g/h, qu/gu/c, acento, ñ/ll/ch, diptongos, z/c, entonación, d suave, grupos de consonantes, enlace de palabras, verbos que cambian con el acento, ritmo, condicional y subjuntivo, palabras largas, trabalenguas, prosa en voz alta, palabras de origen griego) y 20 de Use of English (A1–C2), todos escritos por Claude y sin revisión de un nativo.
5. **Los textos de interfaz de la práctica libre** ya no dicen «inglés»: dicen «el idioma que practicas».

## Alternativas consideradas

- **Quitar las tildes al comparar** (más indulgente con el reconocedor). Descartada: en español la tilde cambia el verbo y el reconocedor la escribe.
- **Dejar Pronunciación solo en inglés.** Descartada: el reconocimiento del navegador admite `es-ES` y el ejercicio es igual de útil.

## Consecuencias

- Los **Exámenes** siguen sin español: su formato, sus notas y su conversión a escala son de Cambridge, y un simulacro de español exigiría decidir antes qué modelo imitar (por ejemplo, DELE).
- La calidad del reconocimiento en español depende del navegador (Chrome y Edge); no se prueba en los tests, que no tienen micrófono.
- La entrada del menú sigue llamándose «Use of English» aunque el ejercicio sea de español.
