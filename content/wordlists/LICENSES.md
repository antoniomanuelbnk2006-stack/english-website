# Licencias de las listas de palabras

Los ficheros de esta carpeta se usan sin modificar. El pipeline (`scripts/content/lib/wordlists.ts`) los combina en memoria para asignar un nivel MCER a cada lema.

## CEFR-J Vocabulary Profile (ver. 1.5)

Fichero: `cefrj-vocabulary-profile-1.5.csv`

The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
Copyright: Tono Laboratory at TUFS (Tokyo University of Foreign Studies).
Free for research and commercial use, provided the dataset is cited.
Source: Open Language Profiles — github.com/openlanguageprofiles/olp-en-cefrj (retrieved 2026-10-08).

## Octanove Vocabulary Profile C1/C2 (ver. 1.0)

Fichero: `octanove-vocabulary-profile-c1c2-1.0.csv`

Octanove Labs. Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
Source: Open Language Profiles — github.com/openlanguageprofiles/olp-en-cefrj (retrieved 2026-10-08).

## New General Service List (NGSL) 1.2

Fichero: `ngsl-1.2-stats.csv`

Browne, C., Culligan, B. & Phillips, J. (2013). The New General Service List.
Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
Source: newgeneralservicelist.com (retrieved 2026-10-08).

## Ficheros derivados

`levels.generated.json` (lema → nivel) se genera a partir de las tres listas anteriores y se distribuye bajo CC BY-SA 4.0.

`content/dictionary/{nivel}.json` (el mazo de palabras) toma de las listas CEFR-J y Octanove **qué palabras hay en cada nivel y su categoría**, y de la NGSL su posición por frecuencia. Las traducciones al español y las frases de ejemplo son originales de Señal. El conjunto se distribuye bajo CC BY-SA 4.0, citando las tres fuentes; la app las cita al pie de la pantalla «Palabras».

## Español (mazo y niveles de `content/es/`)

`content/es/dictionary/{nivel}.json` (el mazo de español) y `content/es/wordlists/levels.generated.json` (sus niveles, que salen del propio mazo) son originales de Señal: las palabras, las traducciones y los ejemplos los escribió Claude. No toman datos de ninguna lista externa.

## Voces del español (audio de `content/es/lessons/*/listening`)

El audio de español se genera en local con **Piper** (MIT, `github.com/rhasspy/piper`) y estas voces de `huggingface.co/rhasspy/piper-voices` (no se versionan: viven en `.piper/`):

- `es_ES-davefx-medium`: conjunto de datos CC0 (`github.com/OHF-Voice/voice-datasets`).
- `es_ES-sharvard-medium`: corpus Sharvard, Universidad de Edimburgo (`datashare.ed.ac.uk/handle/10283/574`), licencia **CC BY 3.0** (`creativecommons.org/licenses/by/3.0/`): hay que citarlo. Aubanel, V., García Lecumberri, M. L. & Cooke, M. (2014). The Sharvard Corpus: A phonemically-balanced Spanish sentence resource for audiology. *International Journal of Audiology*.

