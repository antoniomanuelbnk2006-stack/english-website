# Evaluación y nivel

> **Propósito:** cómo sabe Señal tu nivel (test inicial, rating continuo, pruebas de confirmación) y cuánto puedes fiarte de él.
> **Relacionado:** [Marco MCER §4](01-marco-mcer.md#4-la-escala-interna-de-señal) · [Motor del plan diario](../03-producto/03-motor-del-plan-diario.md) · [ADR-0009](../adr/0009-nivel-por-destreza-con-elo.md)

---

## 1. Cuatro capas de evaluación

| Capa | Cuándo | Para qué |
|---|---|---|
| **Test de nivel** | Al empezar (y cada 3 meses, opcional) | Fijar ratings iniciales y sembrar tu léxico |
| **Rating continuo** | Con cada ítem respondido | Saber dónde estás hoy y elegir contenido i + 1 |
| **Pruebas de confirmación** | Cuando el rating sugiere un cambio de nivel | Confirmar (o no) el salto, con un examen corto y nuevo |
| **Métricas propias** | Siempre | Dictado, ppm, cobertura, horas: evidencias que el rating no ve |

---

## 2. Test de nivel (~30 min)

### 2.1 Vocabulario sí/no (5 min)
- 60 palabras reales (10 por banda de frecuencia: 1k, 2k, 3k, 4k, 5k, 6–10k) + **20 pseudopalabras** con aspecto de inglés (generadas y verificadas contra un diccionario para que no existan).
- Por cada una: «¿La conoces?» Sí / No.
- Corrección por adivinación por banda: `h_corr = (h − f) / (1 − f)`, con `h` = tasa de «sí» en palabras reales de la banda y `f` = tasa de «sí» en pseudopalabras.
- **Tamaño estimado** = Σ (tamaño de la banda × `h_corr`). Se traduce a nivel con la tabla del [marco MCER](01-marco-mcer.md#31-tamaño-orientativo-por-nivel).
- **Siembra del léxico:** bandas con `h_corr ≥ 0,9` → sus lemas pasan a `known` (`source = 'placement'`).

### 2.2 Listening adaptativo (8–10 min)
- 12 ítems: clip de 15–40 s + 1 pregunta.
- Arranca en el centro de tu nivel declarado (B1 → 1100).
- Actualización Elo con **K = 64** (alto, para converger rápido); el siguiente ítem se elige con dificultad ≈ rating actual + 50.

### 2.3 Reading adaptativo (10 min)
- 8 ítems: textos de 80–250 palabras con 1–2 preguntas. Mismo mecanismo.

### 2.4 Gramática y uso (5 min)
- 16 ítems rápidos (elección, transformación corta). Mismo mecanismo.

### 2.5 Resultado
Pantalla con tu perfil: rating y nivel por destreza, tamaño de vocabulario estimado, y el **primer plan** que se deriva de ello. Se guarda en `placement_results`.

> Los ítems del test viven en `content/placement/` y **no se reutilizan** en lecciones.

---

## 3. Rating continuo (Elo por destreza)

### 3.1 Fórmulas

Para cada ítem respondido:

```
E  = 1 / (1 + 10^((D − R) / 400))        probabilidad esperada de acierto
R' = R + K · w · (S − E)                  nuevo rating
```

| Símbolo | Significado | Valores |
|---|---|---|
| `R` | Tu rating en la destreza del ítem | 600–1800 |
| `D` | Dificultad del ítem | misma escala |
| `S` | Puntuación del ítem | 1/0, o parcial (huecos, dictado) |
| `K` | Velocidad de ajuste | 32 si llevas < 30 ítems en la destreza; 16 hasta 200; 10 después |
| `w` | Peso por tipo de tarea (penaliza el azar) | `mcq` 0,75 · `true_false_ng` 0,6 · `gap_fill` 0,9 · `short_answer` y `dictation` 1,0 |

**Tope por lección:** el rating no puede moverse más de **±60** en una sola lección.

### 3.2 Dificultad de los ítems

```
D = dificultad_lección + ajuste_foco + ajuste_fase
```

| Foco | Ajuste | | Fase (listening) | Ajuste |
|---|---|---|---|---|
| `gist` | −60 | | `listen_1` | +40 |
| `detail`, `decoding` | 0 | | `listen_2` | 0 |
| `reference`, `vocab_in_context` | +20 | | `post` | −20 |
| `inference`, `purpose_function` | +60 | | | |
| `attitude_opinion`, `text_structure` | +80 | | | |

La **dificultad de la lección** la calcula el pipeline: centro de su nivel ± ajustes por velocidad del habla, cobertura frente al perfil del nivel y longitud de frase (ver [control de calidad](../05-contenido/02-control-de-calidad.md#5-dificultad-calculada)). Se puede sobrescribir a mano en la lección.

### 3.3 Qué destreza actualiza cada cosa

| Fuente | Destreza |
|---|---|
| Preguntas de lecciones de escucha, dictado, drills | `listening` |
| Preguntas de lecciones de lectura | `reading` |
| Mini-práctica de gramática, tarjetas `grammar` | `grammar` |
| Test sí/no + tamaño del léxico | `vocabulary` (se fija por tabla, no por Elo) |
| Writing (nivel estimado por la IA + rúbrica) | `writing` (media móvil de las 5 últimas) |
| Speaking | `speaking` (fase futura) |

### 3.4 Cómo se muestra

- **Nivel estimado:** «Listening · B1 · 63 % hacia B2» (barra de progreso).
- **Nivel confirmado:** insignia (ver §4). Mientras no confirmes, la insignia muestra el último nivel confirmado.
- **Tendencia:** flecha y variación de los últimos 30 días.
- **Confianza:** baja si hay < 30 ítems o el último es de hace > 21 días (el número se muestra atenuado).

---

## 4. Pruebas de confirmación

### 4.1 Cuándo se desbloquean
Rating ≥ **inicio de la banda siguiente + 25** durante **7 días**, y ≥ **40 ítems** en esa destreza desde la última prueba.

### 4.2 Formato

Contenido **nuevo**, del nivel objetivo, de un banco separado (`content/tests/`). Formatos inspirados en los exámenes habituales de cada nivel, sin copiar ninguno:

| Destreza | Partes | Duración |
|---|---|---|
| **Listening** | 1) 6 extractos cortos, opción múltiple · 2) entrevista larga, 6 preguntas · 3) completar notas, 6 huecos · 4) 5 hablantes, emparejar opiniones | ~30 min |
| **Reading** | 1) texto largo, 6 preguntas · 2) texto con 6 frases eliminadas · 3) emparejamiento múltiple, 8 ítems · 4) vocabulario en contexto, 6 huecos | ~40 min |

### 4.3 Resultado

| Puntuación | Resultado |
|---|---|
| ≥ 65 % | **Nivel confirmado** en esa destreza |
| 55–64 % | «Casi»: puedes repetir en 14 días |
| < 55 % | No confirmado; el rating se ajusta con los ítems de la prueba (Elo normal) |

---

## 5. Métricas propias (las que el rating no ve)

| Métrica | Por qué importa |
|---|---|
| Precisión de dictado a velocidad del nivel | Mide la decodificación directamente |
| Comprensión en primera escucha | Lo que te pasará en la vida real |
| Velocidad cómoda (ppm) | Hasta qué velocidad entiendes ≥ 85 % |
| ppm lectora con comprensión ≥ 75 % | Fluidez lectora |
| Cobertura media de lo que lees | Si siempre está en 99 %, estás leyendo demasiado fácil |
| Horas de input | El predictor más honesto de progreso a medio plazo |

---

## 6. Cuánto fiarse (y contrastes externos)

- Un sistema hecho por ti, con contenido generado, **no es un examen oficial**. Úsalo para decidir qué estudiar, no como certificado.
- Contrástalo de vez en cuando con **pruebas externas gratuitas** alineadas con el MCER (por ejemplo, EF SET) y, si necesitas acreditarlo en el CV, con un **examen oficial** (Cambridge B2 First, entre otros).
- Si el rating y una prueba externa discrepan en más de medio nivel, revisa la calibración de dificultades (el pipeline guarda todo lo necesario para recalcularla).

---

## 7. Requisitos funcionales derivados

| ID | Requisito |
|---|---|
| FR-E-01 | Test de nivel en 4 secciones (§2) con guardado parcial y reanudación. |
| FR-E-02 | Rating Elo por destreza (§3), con historial (`rating_history`) para gráficas. |
| FR-E-03 | Lógica de desbloqueo y ejecución de pruebas de confirmación (§4). |
| FR-E-04 | Banco de ítems de test separado del de lecciones; nunca se mezclan. |
| FR-E-05 | Visualización: nivel estimado (barra) + nivel confirmado (insignia) + tendencia + confianza. |
