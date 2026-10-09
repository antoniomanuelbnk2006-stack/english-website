# Vocabulario y repetición espaciada (SRS)

> **Propósito:** cómo modela Señal lo que sabes, cómo decide qué repasar y cómo son las tarjetas.
> **Relacionado:** [Marco MCER §3](01-marco-mcer.md#3-cuánto-vocabulario-hace-falta) · [Base de datos](../04-arquitectura/03-base-de-datos.md) · [ADR-0006 FSRS](../adr/0006-fsrs-para-repaso.md)

---

## 1. Qué significa «conocer» una palabra

Conocer una palabra tiene capas (Nation): **forma** (cómo se escribe y *cómo suena*), **significado** (y sus acepciones) y **uso** (colocaciones, registro, gramática). Para tu objetivo receptivo, Señal prioriza:

1. **Reconocerla escrita** y saber qué significa en contexto.
2. **Reconocerla oída**, también reducida y enlazada (lo que más te falta).
3. Producirla (secundario, solo para las más frecuentes).

---

## 2. Unidad de conteo: el lema

- Se cuenta por **lema + categoría gramatical** cuando importa (*light* nombre ≠ *light* adjetivo solo si su nivel difiere).
- Se excluyen del cómputo de «palabras conocidas»: **nombres propios, números, símbolos e interjecciones**. Las palabras gramaticales (*the, of, to…*) se consideran conocidas desde A1.
- Las **expresiones multipalabra** (verbos frasales, colocaciones, *chunks*) son unidades propias: `keep up with`, `turn into`, `I'd rather`.

---

## 3. Niveles de las palabras: fuentes con licencia abierta

| Fuente | Cobertura | Licencia / condiciones | Uso en Señal |
|---|---|---|---|
| **CEFR-J Vocabulary Profile 1.5** (Tono Lab, TUFS) | A1–B2 | Uso de investigación y comercial gratuito **citando el dataset** | Nivel MCER de cada lema A1–B2 |
| **Octanove Vocabulary Profile C1/C2 1.0** | C1–C2 | **CC BY-SA 4.0** | Nivel de lemas C1–C2 |
| **NGSL** (New General Service List) y listas hermanas | Frecuencia | CC BY-SA 4.0 | Frecuencia; desempate y estimación si el lema no tiene nivel |

Ambos perfiles CEFR se distribuyen en el repositorio **Open Language Profiles** (`openlanguageprofiles/olp-en-cefrj`). Se guardan en `content/wordlists/` con un `LICENSES.md` que cita cada fuente. Detalles en [Fuentes y licencias](../05-contenido/03-fuentes-y-licencias.md).

> Si una palabra no está en ningún perfil, su nivel se **estima por frecuencia** (banda de NGSL o, si tampoco está, «C2/rara») y se marca `level_source = 'estimated'`.

---

## 4. Tu léxico personal

Tabla `lexicon` (una fila por lema que la app conoce de ti):

| Estado (`status`) | Significado | Cómo se llega |
|---|---|---|
| `new` | La has visto, no la sabes | Aparece en un texto/audio y la consultas o la marcas |
| `learning` | Está en el SRS | La añades al repaso (manual o al cosechar) |
| `known` | La conoces | La marcas, la gradúas en el SRS, o la siembra el test de nivel, o promoción implícita |
| `ignored` | No te interesa | Tecnicismos, nombres raros, palabras que no quieres aprender |

**Promoción implícita a `known`:** una palabra en `new` pasa a `known` si la encuentras en **3 textos/audios distintos sin consultarla** y sin fallarla en un dictado. (Se puede desactivar en ajustes.)

**Del repaso al léxico:** añadir una tarjeta deja la palabra en `learning`; cuando su intervalo llega a **21 días** en estado de repaso pasa a `known` (`source = 'srs'`), y vuelve a `learning` si después se olvida. Marcar una palabra como conocida o ignorada pausa sus tarjetas.

**Antes del test de nivel:** mientras tu léxico esté vacío, una palabra que no esté en él se da por conocida si es gramatical o si su nivel no supera tu nivel declarado (B1 por defecto). Es solo el punto de partida de la cobertura; lo que marques tú siempre manda.

**Siembra inicial:** el test de vocabulario del test de nivel estima tu dominio por bandas de frecuencia; las bandas con ≥ 90 % de aciertos se siembran como `known` (`source = 'placement'`). Corregir una siembra errónea es un toque («no la conozco»).

---

## 5. Cobertura de un texto

```
cobertura = tokens_conocidos / tokens_contables

tokens_contables = tokens − (nombres propios + números + símbolos + interjecciones)
tokens_conocidos = tokens contables cuyo lema está en known, o es palabra gramatical
```

- Se calcula en el cliente con la lista de lemas del texto (viene precalculada en la lección) y tu léxico.
- Se muestra en la biblioteca como «Para ti: 96 %».
- Rangos objetivo: ver [Reading §7](04-reading.md#7-cómo-elige-señal-un-texto-para-ti).

---

## 6. El SRS: FSRS

**Algoritmo:** FSRS (versión 6), con la librería `ts-fsrs`. Modela por tarjeta su **estabilidad** (cuánto tarda en olvidarse) y **dificultad**, y programa el siguiente repaso para cuando la probabilidad de recordarla baje a la **retención deseada**.

| Parámetro | Valor por defecto | Por qué |
|---|---|---|
| Retención deseada | **0,90** | Buen equilibrio carga/olvido para vocabulario |
| Intervalo máximo | 365 días | Para vocabulario activo de estudio |
| *Fuzz* | Activado | Evita que se acumulen repasos el mismo día |
| Pasos de aprendizaje | 1 min, 10 min | Primeras repeticiones dentro de la sesión |
| Tarjetas nuevas/día | **10** | Sostenible: ~70 nuevas/semana |
| Tiempo máximo de repaso/día | **15 min** | El repaso no debe comerse el input |

**Optimización:** con ~1.000 repasos registrados, ejecuta el optimizador de FSRS (paquete `@open-spaced-repetition/binding`) sobre tu historial (`srs_reviews`) para obtener parámetros personales. Se guardan en `profiles.settings.fsrs_params`.

---

## 7. Tipos de tarjeta

| Tipo (`kind`) | Anverso | Reverso | Valoración |
|---|---|---|---|
| `word` | Palabra **dentro de su frase original**, con audio de la frase | Definición en inglés sencillo + traducción + otra frase de ejemplo | Manual (Again/Hard/Good/Easy) |
| `chunk` | Expresión en su frase (*I'd rather not…*) | Significado + uso + registro | Manual |
| `audio` | **Fragmento de audio** de una lección (tiempos `start`–`end`) | Transcripción con rasgos de habla conectada marcados | **Sugerida automáticamente** por la precisión del dictado |
| `grammar` | Frase con hueco o elección (*If I ___ known…*) | Respuesta + regla en una línea + enlace a la ficha | Automática (correcta/incorrecta → Good/Again) |
| `production` (opcional) | Traducción española + pista | Frase en inglés | Manual. Solo para las ~1.000 palabras más frecuentes |

Las tarjetas `word` y `chunk` que salen del **mazo de palabras** ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)) llevan delante la frase de ejemplo de su entrada, no una frase de lección, y detrás solo la traducción.

### Valoración automática de tarjetas de audio

| Precisión del dictado | Valoración sugerida |
|---|---|
| 100 % y en < 1,5× la duración del fragmento | **Easy** |
| ≥ 95 % | **Good** |
| 80–94 % | **Hard** |
| < 80 % | **Again** |

Siempre se puede cambiar con un toque antes de pasar a la siguiente.

### Reglas de diseño de tarjetas

1. **Siempre con contexto**: la frase real donde la encontraste (minería de frases). Las del mazo de palabras usan la frase de ejemplo de la entrada.
2. **Audio en todas** (de la lección o TTS de la frase).
3. **Definición en inglés fácil primero**, traducción después (plegada). Las del mazo de palabras solo tienen traducción.
4. Una tarjeta = un concepto. Nada de tarjetas con cinco acepciones.

---

## 8. Qué entra en el SRS (y qué no)

No todo lo desconocido merece una tarjeta. Prioridad al cosechar:

1. Fallos de **dictado** en frases con palabras conocidas → tarjeta de **audio** (máxima prioridad: es tu punto débil).
2. Palabras de **tu nivel o el siguiente** con frecuencia alta (bandas NGSL 1–3k) → tarjeta `word`.
3. **Expresiones** útiles y frecuentes → `chunk`.
4. Palabras raras o técnicas → **solo glosario**, sin tarjeta (salvo que las añadas a mano).

Límite: 5 tarjetas nuevas por lección de escucha y 8 por texto; el resto queda como sugerencia.

### El mazo de palabras

Además de cosechar lo que sale en las lecciones, se puede estudiar directamente el vocabulario de cada nivel ([ADR-0015](../adr/0015-mazo-de-palabras-y-pronunciacion.md)): las ~8.650 palabras de las listas de §3, cada una con traducción y frase de ejemplo. El mazo **no memoriza nada por sí mismo**: sirve para decidir qué entra en el SRS. En cada tanda (12 palabras, primero las más frecuentes) dices si ya sabías la palabra (pasa a `known`, `source = 'manual'`), si no (se crea su tarjeta y queda en `learning`) o si no te interesa (`ignored`). Es la manera rápida de poner al día el léxico personal sin esperar al test de nivel.

---

## 9. Métricas

| Métrica | Definición |
|---|---|
| Lemas conocidos | `count(lexicon where status = 'known')`, por nivel MCER |
| Retención real | % de repasos con valoración ≥ Hard en tarjetas en estado *review* |
| Carga diaria | Repasos pendientes hoy y previsión a 7 días |
| Tamaño estimado de vocabulario | Test sí/no con pseudopalabras cada 3 meses ([Evaluación](08-evaluacion-y-nivel.md)) |

---

## 10. Requisitos funcionales derivados

| ID | Requisito |
|---|---|
| FR-V-01 | Léxico personal con estados y fuente (`placement`, `manual`, `srs`, `implicit`). |
| FR-V-02 | Cálculo de cobertura por texto en cliente, con exclusiones (§5). |
| FR-V-03 | SRS con FSRS (ts-fsrs), parámetros configurables y optimizables. |
| FR-V-04 | Cinco tipos de tarjeta (§7) con audio. |
| FR-V-05 | Valoración automática sugerida para tarjetas de audio y gramática. |
| FR-V-06 | Límites diarios de tarjetas nuevas y de tiempo de repaso. |
| FR-V-07 | Cosecha priorizada (§8) con límite por lección. |
