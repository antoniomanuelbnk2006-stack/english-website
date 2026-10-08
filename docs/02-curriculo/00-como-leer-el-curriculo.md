# Cómo leer el currículo

> **Propósito:** explicar la estructura de los documentos por nivel, los identificadores y cómo se convierte el currículo en contenido real.
> **Niveles:** [A1](A1.md) · [A2](A2.md) · [B1](B1.md) · [B2](B2.md) · [C1](C1.md) · [C2](C2.md)

---

## 1. Para qué sirve

El currículo es la **fuente de verdad pedagógica** de Señal. De él salen:

1. Las **especificaciones de generación** (`content/specs/*.yaml`) que usa el [pipeline](../05-contenido/01-pipeline.md).
2. Las **etiquetas** de cada lección (`can_do`, `grammar_focus`, `vocab_focus`, `topic`).
3. El **banco de las pruebas** de nivel y de confirmación.
4. El orden en que el [plan diario](../03-producto/03-motor-del-plan-diario.md) propone el contenido.

---

## 2. Estructura de cada documento de nivel

| Sección | Contenido |
|---|---|
| 1. Perfil | Qué significa el nivel en lenguaje llano |
| 2. Descriptores «puedo» | Por destreza, con ID |
| 3. Especificación de audio | Velocidad, duración, hablantes, acentos, géneros, rasgos de habla conectada, tareas |
| 4. Especificación de texto | Longitud, géneros, cobertura, velocidad lectora, tareas |
| 5. Gramática | Alcance con IDs de ficha |
| 6. Vocabulario | Tamaño orientativo, temas y foco léxico |
| 7. Funciones | Lo que se hace con la lengua (opinar, pedir, narrar…) |
| 8. Unidades | Series temáticas con ideas de escucha, lectura y foco |
| 9. Evaluación | Cómo se confirma el nivel |

---

## 3. Identificadores

| Elemento | Formato | Ejemplo |
|---|---|---|
| Descriptor | `{L\|R\|W\|S}-{nivel}-{nn}` | `L-B1-07` |
| Ficha de gramática | `{nivel}.{slug}` | `b2.mixed-conditionals` |
| Unidad | `{nivel}-u{nn}` | `b1-u02` |
| Serie (*narrow*) | `{unidad}-{slug}` | `b1-u02-night-sky` |
| Lección | `{nivel}-{lis\|rea}-{nnn}` | `b1-lis-001` |

Los descriptores están **redactados por Señal** a partir de los niveles del MCER; no son una reproducción literal del documento oficial.

---

## 4. De la unidad a las lecciones

Cada unidad se convierte en una **serie temática** de 5–8 lecciones (escucha estrecha + lectura estrecha sobre el mismo tema):

```
Unidad b1-u02 «Cielo nocturno»
├── b1-lis-001  Diálogo: planear ver una lluvia de estrellas        (en-GB + en-US)
├── b1-lis-002  Mensaje de voz: cambio de planes por el tiempo        (en-AU)
├── b1-lis-003  Mini-podcast: por qué vemos estrellas fugaces         (en-US)
├── b1-rea-002  Guía: cómo observar el cielo sin telescopio
├── b1-rea-003  Relato corto: la noche del apagón
└── drills       Formas débiles y números de la serie
```

El vocabulario de la serie se **repite a propósito** entre lecciones, y la última lección de la serie es algo más difícil que la primera. Los números de los IDs son correlativos por nivel y destreza y **no indican orden**: el orden lo dan `unit` y `series`.

---

## 5. Volumen de contenido previsto

| Nivel | Lecciones de escucha | Lecciones de lectura | Consignas de writing | Prioridad para ti |
|---|---|---|---|---|
| A1 | 16 | 12 | 8 | Baja (repaso de huecos) |
| A2 | 20 | 16 | 10 | Baja (repaso de huecos) |
| **B1** | **40** | **30** | 16 | **Alta** (consolidar B1+) |
| **B2** | **60** | **45** | 20 | **Máxima** |
| C1 | 50 | 40 | 16 | Media (al confirmar B2) |
| C2 | 30 | 30 + clásicos de dominio público | 10 | Largo plazo |

**Orden de producción:** B1 (unidades 1–6) → B2 (1–6) → B1 (7–12) → B2 (7–12) → paquetes de refuerzo A1–A2 **solo de lo que el test de nivel detecte como hueco** → C1 → C2.

Además: banco de **drills** común (formas débiles, pares mínimos, reducciones, números) y **biblioteca extensiva** por nivel (series de episodios y relatos graduados largos).

---

## 6. Cómo se usa con el pipeline

Una especificación de generación (simplificada) tiene esta forma:

```yaml
# content/specs/b1/b1-u02-night-sky.yaml
unit: b1-u02
series: b1-u02-night-sky
level: B1
topic: science-space
lessons:
  - id: b1-lis-001
    skill: listening
    genre: dialogue
    speakers:
      - { id: maya, accent: en-GB, gender: female }
      - { id: leo,  accent: en-US, gender: male }
    target_wpm: 140
    target_words: [330, 420]
    can_do: [L-B1-02, L-B1-06, L-B1-07, L-B1-08]
    grammar_focus: [b1.future-forms-review]
    vocab_focus: [meteor shower, light pollution, forecast, get used to, pick up]
    connected_speech: [weak_form, reduction, linking, elision, flap]
    tasks:
      listen_1: { gist: 1, attitude_opinion: 1 }
      listen_2: { detail: 7, inference: 2 }
      post: { dictation: 3 }
    notes: "Incluir una hora en formato británico (half eleven) como punto de acento/cultura."
```

El formato completo está en [Modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md) y los prompts en [Prompts de generación](../05-contenido/04-prompts-de-generacion.md).
