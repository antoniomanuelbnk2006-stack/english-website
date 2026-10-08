# Fuentes y licencias

> **Propósito:** qué datos y materiales de terceros usa Señal, con qué licencia y qué obligaciones implica. Regla general: **en la app solo hay contenido original o de dominio público**; lo demás se consume fuera y solo se registra.
> **Relacionado:** [Vocabulario y SRS](../01-pedagogia/05-vocabulario-y-srs.md) · [C2](../02-curriculo/C2.md) · [Recursos externos](../07-tu-plan/03-recursos-externos.md)

> Esto no es asesoramiento legal. Es un resumen práctico para un proyecto personal; si algún día abres la app a otras personas, revisa cada licencia con calma.

---

## 1. Tabla de fuentes

| Fuente | Qué aporta | Licencia / condiciones | Obligaciones |
|---|---|---|---|
| Contenido generado con Claude | Lecciones, preguntas, glosarios | Contenido original creado para ti | No pedir imitaciones de obras protegidas ni letras de canciones; revisar los términos del servicio |
| **CEFR-J Vocabulary Profile 1.5** (Tono Lab, Universidad de Estudios Extranjeros de Tokio) | Nivel A1–B2 de cada palabra | Uso de investigación y comercial gratuito **citando el dataset** | Cita en `content/wordlists/LICENSES.md` y en «Acerca de» |
| **CEFR-J Grammar Profile** | Referencia de gramática por nivel (opcional) | Mismas condiciones que el anterior | Cita |
| **Octanove Vocabulary Profile C1/C2 1.0** | Nivel C1–C2 de cada palabra | **CC BY-SA 4.0** | Atribución; las listas derivadas que publiques, con la misma licencia |
| **NGSL** y listas asociadas | Frecuencia de uso | CC BY-SA 4.0 | Atribución; derivadas con la misma licencia |
| Wiktionary (vía Wiktextract) — opcional | IPA, acepciones para consultas sueltas | CC BY-SA 4.0 (y GFDL) | Atribución si se muestran definiciones procedentes de ahí |
| Project Gutenberg | Textos clásicos (C1–C2) | Dominio público (verificar caso a caso) | Usar solo obras de autores fallecidos hace > 70 años; citar la fuente |
| LibriVox | Audiolibros de dominio público | Grabaciones de dominio público | Citar la fuente y el lector cuando se conozca |
| Material de NASA | Audio, transcripciones e imágenes sobre el espacio | En general sin copyright en EE. UU. (salvo material de terceros marcado) | Reconocer a NASA; no implicar respaldo; ojo con material marcado como de terceros |
| Fuentes Geist, Geist Mono, Literata | Tipografía | SIL Open Font License | Ninguna especial al usarlas en la web |
| lucide-react | Iconos | ISC | Mantener la licencia en dependencias |
| Voces de Azure AI Speech | Audio sintético | Términos de Microsoft | Uso conforme a sus términos; la app indica «voz sintética» en las lecciones TTS |

---

## 2. Dominio público: cómo comprobarlo

En España (y la UE), una obra entra en dominio público **70 años después de la muerte del autor** (a contar desde el 1 de enero siguiente). Para obras usadas en C2:

| Obra | Autor (fallecimiento) | ¿Dominio público en la UE? |
|---|---|---|
| *Frankenstein* (1818) | Mary Shelley (1851) | Sí |
| *The Chemical History of a Candle* (1861) | Michael Faraday (1867) | Sí |
| *The Adventures of Sherlock Holmes* (1892) | Arthur Conan Doyle (1930) | Sí |
| *The Time Machine* (1895), *The War of the Worlds* (1898) | H. G. Wells (1946) | Sí |

Cuidado con las **traducciones, ediciones anotadas y adaptaciones modernas**: pueden tener derechos propios. Usa el texto original.

---

## 3. Contenido externo (fuera de la app)

- YouTube, podcasts, series y libros con derechos **no se copian** a Señal. Se consumen en su plataforma y se **registran** en el diario (título, URL, minutos, nivel percibido).
- La función futura de «importar audio propio» (F-030) es **solo para estudio personal**: el fichero y su transcripción se quedan en tu dispositivo o en una carpeta privada, nunca en el *bucket* público.

---

## 4. `content/wordlists/LICENSES.md` (plantilla)

```md
# Licencias de las listas de palabras

## CEFR-J Vocabulary Profile (ver. 1.5)
Compiled by Yukio Tono, Tokyo University of Foreign Studies.
Free for research and commercial use, provided the dataset is cited.
Source: Open Language Profiles — github.com/openlanguageprofiles/olp-en-cefrj

## Octanove Vocabulary Profile C1/C2 (ver. 1.0)
Octanove Labs. Licensed under CC BY-SA 4.0.
Source: Open Language Profiles — github.com/openlanguageprofiles/olp-en-cefrj

## New General Service List (NGSL)
Browne, C., Culligan, B. & Phillips, J. Licensed under CC BY-SA 4.0.

Derived files in this folder (e.g., merged-levels.csv) are distributed under CC BY-SA 4.0.
```

---

## 5. Atribución en la app

Pantalla **Ajustes → Acerca de**: créditos de las listas de palabras, fuentes de dominio público usadas y aviso de voces sintéticas. Cada lección de dominio público muestra su fuente en la cabecera.
