# Listening: el corazón de Señal

> **Propósito:** por qué te cuesta escuchar en inglés, cómo lo entrena Señal paso a paso y qué requisitos salen de ahí para la app.
> **Relacionado:** [Errores típicos de hispanohablantes](09-errores-hispanohablantes.md) · [Audio y reproductor](../04-arquitectura/05-audio-y-reproductor.md) · [Pantallas](../03-producto/02-pantallas-y-flujos.md) · [Ejemplo de lección](../05-contenido/ejemplos/b1-lis-001.md)

---

## 1. Por qué te cuesta (y no es culpa del vocabulario)

Cuando un hispanohablante en B1 dice «hablan muy rápido», casi siempre pasa esto: **conoce las palabras, pero no las reconoce cuando suenan**. Las causas:

1. **Ritmo acentual.** El español da a cada sílaba un peso parecido; el inglés concentra la fuerza en las sílabas tónicas y **comprime** lo demás. Las palabras gramaticales (*to, of, can, have, you, and*) casi desaparecen: *to* → /tə/, *and* → /n/.
2. **La schwa.** La vocal más frecuente del inglés, /ə/, no existe en español. Una palabra que conoces escrita (*photograph*, *about*) suena distinta a como la imaginas.
3. **Habla conectada.** Las palabras se enlazan (*turn it off* → /tɜːnɪtɒf/), pierden sonidos (*next day* → /neks deɪ/), se funden (*would you* → /wʊdʒu/) o se reducen (*going to* → *gonna*).
4. **Vocales y consonantes que no distingues** (*ship/sheep*, *work/walk*, *berry/very*) y finales que no oyes (*worked* → oyes *work*: pierdes el pasado).
5. **Segmentación.** El español te ha entrenado para cortar el sonido en sílabas; el inglés exige localizar las tónicas para encontrar dónde empieza cada palabra.
6. **Memoria de trabajo saturada.** Si decodificar te cuesta, no te queda atención para el significado: llegas tarde a la frase siguiente y te pierdes.
7. **Acentos y velocidad** a los que no te has expuesto.

La buena noticia: la decodificación **se entrena** y mejora rápido con práctica dirigida.

---

## 2. El modelo: dos procesos

| Proceso | Qué hace | Cómo falla | Cómo se entrena en Señal |
|---|---|---|---|
| **Decodificación** | Sonido → fonemas → palabras | No reconoces palabras conocidas | Dictado diagnóstico, drills de habla conectada, pares mínimos, escalera de velocidad, lectura+audio |
| **Construcción de significado** | Palabras → ideas → interpretación | Entiendes palabras sueltas pero no la idea, la intención o lo implícito | Preguntas de idea general, inferencia y actitud; predicción previa; escucha estrecha |

### Las seis causas de fallo

Señal clasifica cada fallo de escucha en una causa. Es la base del diagnóstico y de las estadísticas de tu perfil.

| Código | Causa | Ejemplo | Entrenamiento |
|---|---|---|---|
| `unknown_word` | No conocías la palabra | *meteor shower* | Glosario + SRS |
| `not_recognized` | La conoces escrita pero no la reconociste | *have you* → /həvjə/ | Drills de formas débiles/enlace + tarjeta de audio |
| `boundaries` | No supiste dónde empezaba/acababa cada palabra | *an ice cream* / *a nice cream* | Segmentación + dictado |
| `speed` | Lo entiendes despacio pero no a velocidad normal | (cualquier frase rápida) | Escalera de velocidad |
| `accent` | Acento o rasgo regional desconocido | *half eleven*, golpe de glotis | Exposición graduada a acentos |
| `attention` | Te despistaste o se te olvidó lo anterior | — | Escuchas más cortas, predicción, toma de notas |

---

## 3. El ciclo de escucha

Una lección de escucha intensiva dura **8–15 minutos** y sigue siempre estas fases. El orden es la clave: **significado primero, forma después, consolidación al final**.

```
0 Preparar → 1 Escucha global → 2 Escucha de detalle → 3 Diagnóstico
→ 4 Texto a la vista → 5 Entrenamiento dirigido → 6 Escucha final → 7 Cosechar
```

### Fase 0 · Preparar (≤ 30 s)
- Título, una línea de contexto y, como mucho, **3–5 palabras clave** (solo si están por encima de tu nivel).
- Pregunta de predicción opcional: «¿Qué crees que va a pasar?».
- *Dato que se guarda:* nada.

### Fase 1 · Escucha global
- Audio completo, **sin texto**, a la velocidad de la lección.
- 1–2 preguntas de **idea general** (*gist*) o actitud.
- Puedes pausar, **no puedes ver la transcripción**.
- *Dato:* `item_attempts` de fase `listen_1` → **comprensión en primera escucha**.

### Fase 2 · Escucha de detalle
- Segunda escucha completa (o por partes).
- Preguntas de **detalle, números, inferencia** (4–8 ítems).
- Puedes **repetir frases sueltas** (↻), y la app cuenta las repeticiones.
- *Dato:* `item_attempts` fase `listen_2`, `replays` por segmento.

### Fase 3 · Diagnóstico («¿qué se me escapó?»)
- La app selecciona **2–4 frases clave**: las que contienen la evidencia de las preguntas que fallaste y las que tienen rasgos de habla conectada marcados.
- Para cada frase: la escuchas (las veces que quieras, a velocidad normal) y **escribes lo que oyes** (microdictado).
- La app compara palabra a palabra (§4), marca los fallos y **propone una causa** para cada uno; tú la confirmas o la cambias con un toque.
- *Dato:* `listening_diagnostics` (una fila por fallo con su causa), precisión de dictado.

### Fase 4 · Texto a la vista
- Transcripción completa con **karaoke** (cada palabra se ilumina al sonar).
- Toque en una palabra → glosario contextual; los **rasgos de habla conectada** aparecen subrayados con su explicación (p. ej. «*have you got* → /həvjə gɒtə/: formas débiles»).
- Las preguntas que fallaste muestran **la frase exacta donde estaba la respuesta**.

### Fase 5 · Entrenamiento dirigido (2–5 min)
La app genera 2–4 microejercicios **según tus causas de fallo** en esta lección (catálogo en §5). Ejemplo: si fallaste «*are we gonna see*» por `not_recognized`, toca un drill de reducciones con esa frase y otras tres parecidas.

### Fase 6 · Escucha final
- Audio completo **sin texto** otra vez.
- Autoevaluación rápida: «¿Cuánto entiendes ahora?» (0–100 %). La app lo compara con tu resultado de la fase 1: ver la mejora en el mismo audio es muy motivador.
- *Dato:* `self_rating_final`.

### Fase 7 · Cosechar
- Frases que fallaste → **tarjetas de audio** en el SRS (escuchas el fragmento y escribes lo que oyes).
- Palabras nuevas → tarjetas de palabra con su frase.
- Máximo 5 tarjetas nuevas por lección (las más útiles por frecuencia y nivel).

> **Modo rápido:** si vas justo de tiempo, el ciclo puede reducirse a fases 1 → 2 → 4 → 7. El diagnóstico (fase 3) es lo que más rinde: el plan diario lo incluye siempre que puede.

---

## 4. Algoritmo del dictado diagnóstico

### 4.1 Normalización (antes de comparar)
1. Minúsculas, quitar puntuación, normalizar apóstrofos y espacios.
2. **Equivalencias aceptadas**, en ambos sentidos: `gonna = going to`, `wanna = want to`, `gotta = got to`, `kinda = kind of`, contracciones (`I'm = I am`, `don't = do not`…), números (`twenty = 20`, `half past eleven = 11:30`), ortografía UK/US (`colour = color`).
3. Tokenizar en palabras.

### 4.2 Alineación
Alineación palabra a palabra (Needleman–Wunsch / distancia de edición a nivel de palabra, con coste reducido para sustituciones fonéticamente similares) entre lo que escribiste y la transcripción. Resultado: una lista de operaciones `match | sub | del | ins`.

**Precisión** = palabras correctas / palabras de la referencia. Errores ortográficos leves (distancia de edición ≤ 1 en palabras de ≥ 5 letras) cuentan como acierto con aviso.

### 4.3 Propuesta automática de causa

Para cada palabra fallada o grupo contiguo de fallos:

| Condición | Causa propuesta |
|---|---|
| El lema **no** está como `known` en tu léxico | `unknown_word` |
| Escribiste dos palabras donde había una, o al revés, o cortaste en otro sitio (*a nice / an ice*) | `boundaries` |
| El lema está `known` **y** el segmento tiene un rasgo de habla conectada marcado | `not_recognized` |
| El lema está `known`, sin rasgo marcado, y aciertas la misma frase en la escalera de velocidad a 0,75× | `speed` |
| El hablante tiene acento distinto de en-US/en-GB **o** el fallo coincide con un rasgo regional marcado | `accent` |
| Omitiste un tramo largo al final de la frase | `attention` |

La propuesta es **editable**: un toque cambia la causa. Tus correcciones se guardan (`cause_source = 'user'`) y sirven para ajustar estas reglas.

---

## 5. Catálogo de entrenamiento

| Drill | Para la causa | Cómo funciona |
|---|---|---|
| **Formas débiles** | `not_recognized` | Oyes una frase con una palabra gramatical en forma débil; eliges/escribes la palabra. Banco con las ~30 palabras gramaticales más frecuentes (ver [errores típicos](09-errores-hispanohablantes.md#2-formas-débiles)). |
| **Enlace** | `not_recognized`, `boundaries` | Frases con consonante+vocal (*pick it up*), vocal+vocal con /j/ o /w/ (*do it*), *linking r* (*far away*). Dictado corto. |
| **Elisión y asimilación** | `not_recognized` | *next day, last night, would you, did you, don't you, in Paris*. Elige lo que oyes entre 3 opciones. |
| **Reducciones** | `not_recognized` | *gonna, wanna, gotta, lemme, gimme, kinda, dunno, whatcha*. |
| **Contracciones ambiguas** | `not_recognized` | *'d* (had/would), *'s* (is/has): decide por el contexto. |
| **Números y fechas** | `not_recognized`, `boundaries` | *fourteen/forty*, años, horas (*half eleven*), precios. |
| **Pares mínimos** | `not_recognized` | Vocales (/iː/–/ɪ/, /æ/–/ʌ/, /ɜː/–/ɔː/) y consonantes (/b/–/v/, /s/–/z/, /ʃ/–/tʃ/) en palabras y luego en frases. |
| **Segmentación** | `boundaries` | Cadenas ambiguas (*a nice cream / an ice cream*, *grey tape / great ape*); escribes lo que oyes y ves dónde cortaste. |
| **Escalera de velocidad** | `speed` | Misma frase a 0,75× → 1,0× → 1,15× → 1,25×. Subes un peldaño cuando aciertas ≥ 90 %. |
| **Acentos** | `accent` | La misma frase dicha por voces de dos acentos; luego dictado con el acento difícil. |
| **Escucha corta** | `attention` | Fragmentos de 10–20 s con una pregunta inmediata. |

Los drills se componen de **frases de tus propias lecciones** (cuando hay coincidencias) más un banco fijo en `content/drills/`.

---

## 6. Escucha extensiva

- **Qué:** escuchar mucho material **fácil** (entiendes ≥ 80–90 % sin esfuerzo) sin tareas.
- **Cuánto:** la mayor parte de tus horas de escucha. Objetivo: ≥ 20 min/día, sobre todo en trayectos.
- **Dónde:** biblioteca extensiva de la app (series de episodios por nivel) y **contenido externo** (podcasts, YouTube) que registras en el diario de input con un toque.
- **Regla de oro:** si entiendes menos del 70 %, no es extensiva: baja de nivel o pásalo a intensiva.

---

## 7. Transcripciones y subtítulos: cuándo sí y cuándo no

| Situación | Regla |
|---|---|
| Primera escucha de una lección | **Nunca** transcripción en el ciclo a ciegas. Si prefieres leer mientras escuchas, elige al empezar el modo «con transcripción»: esa lección ya no medirá tu oído ([ADR-0013](../adr/0013-escucha-con-transcripcion.md)). |
| Tras responder las preguntas | Sí, con karaoke. |
| Escucha extensiva en la app | Transcripción oculta por defecto; se puede abrir para *una* frase. |
| Contenido externo (A2–B1) | Subtítulos **en inglés**. |
| Contenido externo (B2+) | Primera vez con subtítulos en inglés, segunda sin ellos. |
| Subtítulos en español | No, salvo para disfrutar algo por encima de C1 de tu nivel actual. |

---

## 8. Acentos

Orden de exposición recomendado (cada lección declara su `accent`):

| Etapa | Acentos | Cuándo |
|---|---|---|
| 1 | en-US general, en-GB estándar | Desde A1 |
| 2 | Australia, Irlanda, Canadá | Desde B1 (1 de cada 5 audios) |
| 3 | India, Sudáfrica, Nueva Zelanda, Escocia | Desde B2 (1 de cada 4) |
| 4 | Nigeria, Singapur, Filipinas, acentos regionales fuertes, hablantes no nativos | Desde C1 |

> Los acentos sintéticos (TTS) son un punto de partida. A partir de B2, la exposición a **hablantes reales** (audio de dominio público y contenido externo) es imprescindible.

---

## 9. Velocidad del habla por nivel

Objetivos de diseño de Señal para el audio de las lecciones (orientativos, no son cifras oficiales del MCER):

| Nivel | Velocidad | Duración típica | Hablantes | Rasgos |
|---|---|---|---|---|
| A1 | 90–110 ppm | 20–60 s | 1–2 | Pausas entre frases, pronunciación cuidada |
| A2 | 100–130 ppm | 30–90 s | 1–2 | Habla clara, algo de enlace |
| B1 | 120–150 ppm | 1–3 min | 2–3 | Habla conectada moderada, reducciones frecuentes |
| B2 | 140–170 ppm | 2–5 min | 2–4 | Velocidad natural, acentos variados, algo de solapamiento |
| C1 | 160–190 ppm | 3–10 min | 1–4 | Natural rápido, ruido de fondo, implícitos |
| C2 | 170–220+ ppm | Cualquiera | Cualquiera | Coloquial, humor, ironía, solapamientos |

Tu objetivo de B2: **entender audio a 150–170 ppm en primera escucha**. La escalera de velocidad te deja entrenar por encima (hasta 1,25×) para que la velocidad normal se te haga cómoda.

---

## 10. Métricas de listening

| Métrica | Definición | Dónde se ve |
|---|---|---|
| Comprensión en 1.ª escucha | % de aciertos en fase `listen_1` | Progreso → Listening |
| Comprensión total | % de aciertos en fases 1+2 | Progreso → Listening |
| Precisión de dictado | Media ponderada de la fase 3 y de las tarjetas de audio | Progreso → Listening |
| Perfil de causas | Distribución de `listening_diagnostics.cause` (últimos 30 días) | Progreso → «Tu oído» |
| Velocidad cómoda | Velocidad máxima a la que aciertas ≥ 85 % en dictado | Progreso → Listening |
| Exposición a acentos | Minutos por `accent` | Progreso → Acentos |
| Horas de escucha | Intensiva + extensiva (app + externa) | Hoy / Progreso |

---

## 11. Requisitos funcionales derivados

| ID | Requisito |
|---|---|
| FR-L-01 | El reproductor navega por **segmentos**: anterior, repetir, siguiente, con atajos de teclado. |
| FR-L-02 | Velocidad ajustable 0,5×–1,5× en pasos de 0,05, **manteniendo el tono**. |
| FR-L-03 | Modos de transcripción: oculta / tras responder / karaoke por palabra. |
| FR-L-04 | La transcripción no es accesible en la fase 1 de una lección (tampoco por el DOM). |
| FR-L-05 | Dictado con normalización, alineación y propuesta de causa (§4), editable. |
| FR-L-06 | Generación de drills según causas (§5), con frases propias + banco fijo. |
| FR-L-07 | Tarjetas de audio que reproducen un fragmento por tiempos (`start`–`end`) del audio original, sin ficheros nuevos. |
| FR-L-08 | Registro de escucha extensiva externa en ≤ 2 toques (minutos, título opcional, nivel estimado). |
| FR-L-09 | Controles en pantalla de bloqueo (Media Session API) y audio disponible sin conexión para lecciones descargadas. |
| FR-L-10 | Estadísticas: §10. |
