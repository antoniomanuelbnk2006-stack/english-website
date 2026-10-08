# Control de calidad del contenido

> **Propósito:** garantizar que cada lección tiene el nivel correcto, suena natural, es verdad y sus preguntas miden comprensión (y no suerte), sobre todo en niveles que todavía no puedes juzgar tú.
> **Relacionado:** [Pipeline](01-pipeline.md) · [Prompts](04-prompts-de-generacion.md) · [Modelo de contenido §3](../04-arquitectura/04-modelo-de-contenido.md#3-invariantes-las-comprueba-scriptscontentvalidatets)

---

## 1. Capas

| Capa | Tipo | Coste | Detecta |
|---|---|---|---|
| 1. Esquema + invariantes | Determinista | 0 | Estructura, referencias rotas, claves imposibles |
| 2. Métricas lingüísticas | Determinista | 0 | Vocabulario fuera de nivel, frases demasiado largas, longitud, velocidad |
| 3. Métricas de tareas | Determinista | 0 | Respuestas siempre en la misma posición, opción correcta delatada, copia literal |
| 4. Revisión con IA | Modelo revisor distinto del generador | ~0,04 $/lección | Nivel, naturalidad, ambigüedad, hechos, preguntas adivinables |
| 5. Revisión humana (Studio) | Tú | 3–5 min/lección | Lo que suena raro, lo que no te convence |

---

## 2. Comprobaciones deterministas

### 2.1 Perfil léxico (por nivel de la lección)

| Nivel | % de tokens contables de nivel ≤ lección (mín.) | Tipos fuera de nivel por cada 100 palabras (máx.) | Todos los fuera de nivel en glosario o `pre_teach` |
|---|---|---|---|
| A1 | 97 % | 1 | Sí |
| A2 | 96 % | 2 | Sí |
| B1 | 95 % | 3 | Sí |
| B2 | 94 % | 4 | Sí |
| C1 | 92 % | 5 | Solo los de baja frecuencia |
| C2 | — | — | Solo los de baja frecuencia |

### 2.2 Sintaxis y longitud

| Nivel | Palabras/frase (media, máx.) | Escucha: palabras | Lectura: palabras |
|---|---|---|---|
| A1 | ≤ 8 | 40–110 | 50–150 |
| A2 | ≤ 11 | 60–200 | 150–300 |
| B1 | ≤ 15 | 150–450 | 300–600 |
| B2 | ≤ 20 | 300–850 | 500–900 |
| C1 | ≤ 25 | 500–1.800 | 700–1.200 |
| C2 | — | — | 900+ |

### 2.3 Velocidad (tras el TTS)
`audio.wpm` dentro de ±8 % de `target_wpm`; si no, se re-sintetiza ajustando `rate`.

### 2.4 Tareas
- **Posición de la respuesta:** en cada lección, ninguna letra es correcta más del 50 % de las veces (con ≥ 4 preguntas de opción múltiple).
- **Longitud de opciones:** la correcta no es la más larga en más del 40 % de las preguntas de la lección.
- **Copia literal:** en opciones correctas con ≥ 3 palabras de contenido (sin contar números, horas ni nombres propios), el solapamiento con su frase de evidencia debe ser < 60 % (si no, la respuesta se «caza» por coincidencia de palabras).
- **Reparto de focos** acorde al nivel (p. ej., en B2 al menos una pregunta de `inference` o `attitude_opinion`).
- **Dictado:** cada frase dictada contiene al menos un rasgo marcado en `connected_speech`.

---

## 3. Revisión con IA

Se hace con un **modelo distinto del generador** (Opus 5.5 revisa lo que escribió Sonnet 5.5) y en **dos llamadas** separadas, para que la prueba «sin texto» sea real:

### Llamada 1 · Solo preguntas
Se envían únicamente los enunciados y las opciones, **sin texto, sin audio y sin claves**. El revisor responde lo que haría alguien listo que no ha escuchado nada. Resultado → `answerable_without_text` (fracción acertada).

### Llamada 2 · Revisión completa
Texto/guion + preguntas, **sin claves**. El revisor responde las preguntas y evalúa con una rúbrica:
- `level_ok` + comentario (vocabulario, gramática, longitud, densidad de ideas).
- Naturalidad (1–5): ¿suena como habla/escribe la gente?
- Ambigüedad: preguntas con más de una respuesta defendible.
- Evidencias: ¿los IDs señalados contienen de verdad la respuesta?
- Hechos: afirmaciones falsas o dudosas.
- Sensibilidad: estereotipos, temas delicados, contenido inapropiado.
- Explicaciones en español: ¿son correctas?
- `issues[]` con severidad (`blocker` | `major` | `minor`) y propuesta de arreglo.
- `score` 0–10.

El script compara las respuestas con las claves → `answerable_with_text`.

### Umbrales para pasar a `reviewed`

| Métrica | Umbral |
|---|---|
| `answerable_with_text` | ≥ 0,9 |
| `answerable_without_text` | ≤ 0,4 (el azar ronda 0,25–0,33) |
| `level_ok` | `true` |
| `score` | ≥ 7 |
| Problemas `blocker` | 0 |

Si una pregunta concreta falla (el revisor con texto se equivoca o la acierta sin texto), se marca para **regenerar solo esa tarea**, no la lección entera.

---

## 4. Revisión humana en Studio (checklist)

1. Escucha el audio completo una vez (¿suena natural?, ¿pausas raras?, ¿pronuncia bien nombres y números?).
2. Lee 3 preguntas al azar con su justificación.
3. Revisa los avisos del revisor.
4. Aprueba, devuelve con nota o edita el JSON.

En C1–C2, donde tu juicio es limitado, apóyate más en el revisor y en las métricas, y marca para revisar más adelante las lecciones que te hayan parecido raras (cuando subas de nivel las verás con otros ojos).

---

## 5. Dificultad calculada

La dificultad de una lección (`difficulty`, escala del [rating](../01-pedagogia/01-marco-mcer.md#4-la-escala-interna-de-señal)) se calcula en `annotate`/`audio`:

```
base     = centro del nivel                       (A1 700 · A2 900 · B1 1100 · B2 1300 · C1 1500 · C2 1700)
léxico   = clamp((0,97 − cobertura_nivel) × 1000, −40, +40)
velocidad (escucha) = clamp((ppm − ppm_medio_nivel) × 1,5, −40, +40)
               ppm_medio: A1 100 · A2 115 · B1 135 · B2 155 · C1 175 · C2 195
sintaxis (lectura)  = clamp((palabras_por_frase − media_nivel) × 4, −30, +30)
               media: A1 7 · A2 10 · B1 14 · B2 18 · C1 22 · C2 25
acento   = +15 si algún hablante no es en-US/en-GB

difficulty = clamp(base + léxico + velocidad|sintaxis + acento, inicio_banda − 50, fin_banda + 50)
```

Se puede ajustar a mano (`difficulty_offset` por tarea o editando `difficulty`) si el Studio o tus resultados indican otra cosa.

---

## 6. Calibración con tus resultados

Cuando completas una lección con nota media `p` (recortada a [0,05; 0,95]) y rating `R`, la dificultad **observada** es:

```
D_obs = R + 400 · log10(1/p − 1)
```

Con un solo usuario es ruidoso, así que no se reescribe la dificultad automáticamente: si `|D_obs − difficulty| > 150`, la lección se marca en Studio como **posible error de calibración** para revisarla.

---

## 7. Qué hacer cuando algo falla

| Fallo | Acción |
|---|---|
| Esquema/invariantes | Regenerar (suele ser un ID mal referenciado) |
| Demasiado vocabulario fuera de nivel | Regenerar con la lista de palabras problemáticas en el prompt («evita: …») |
| Pregunta adivinable o ambigua | Regenerar solo esa tarea |
| Hecho dudoso | Corregir a mano o regenerar con la corrección indicada |
| Velocidad fuera de rango | Re-sintetizar con otro `rate` |
| Voz con pronunciación errónea de un nombre | `<phoneme>` o `<sub>` en el SSML de ese segmento |
