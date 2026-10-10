# Pipeline de contenido

> **Propósito:** cómo se convierte una especificación del currículo en una lección publicada, con audio y tiempos por palabra, pasando por generación, anotación, revisión y control de calidad.
> **Relacionado:** [Modelo de contenido](../04-arquitectura/04-modelo-de-contenido.md) · [Control de calidad](02-control-de-calidad.md) · [Prompts](04-prompts-de-generacion.md) · [Audio](../04-arquitectura/05-audio-y-reproductor.md) · Skill [`crear-leccion`](../../.claude/skills/crear-leccion/SKILL.md)

Todo se ejecuta **en tu ordenador** (scripts de Node en `scripts/content/`). Nada de esto corre en Vercel.

---

## 1. Visión general

```
content/specs/b1/b1-u02-night-sky.yaml
        │
        ▼  generate   (Claude Sonnet 5.5 · Batch · salida estructurada)
content/lessons/b1/listening/b1-lis-001.json      status: draft
        │
        ▼  annotate   (wink-nlp + listas CEFR: tokens, lemas, cobertura, legibilidad, glosario que falte)
        ▼  review     (Claude Opus 5.5 · Batch · revisor independiente + prueba «sin texto»)
        │             → si pasa los umbrales: status: reviewed
        ▼  tts        (Azure · por segmento · caché local .audio-cache/)
        ▼  audio      (ffmpeg: unir + pausas + loudnorm −16 LUFS + AAC 64k + picos)
        ▼  upload     (R2: audio/b1/b1-lis-001/v1.m4a)
        ▼  Studio     (tú: escuchas, revisas, apruebas)  → status: published
        ▼  validate + index   (Zod + invariantes; index.generated.json)
        ▼  git commit + push → Vercel despliega
```

---

## 2. Comandos

| Comando | Qué hace | Coste |
|---|---|---|
| `pnpm content:generate --spec <yaml>` | Crea un lote con una petición por lección de la especificación; espera y escribe los borradores | IA (Batch) |
| `pnpm content:annotate --ids <ids>` | Tokeniza, lematiza, etiqueta niveles, calcula cobertura y legibilidad; completa el glosario de palabras fuera de nivel (Haiku) | Casi 0 |
| `pnpm content:review --ids <ids>` | Prueba «solo preguntas» + revisión completa; guarda `qa.reviewer`; marca `reviewed` si pasa | IA (Batch) |
| `pnpm content:tts --ids <ids>` | Sintetiza segmentos con eventos de palabra; usa caché por *hash* | TTS (capa gratuita) |
| `pnpm content:audio --ids <ids>` | Une, normaliza, codifica, calcula tiempos finales y picos | 0 |
| `pnpm content:exam-audio --ids <ids>` | Locuta las grabaciones de una prueba de Listening de un simulacro (un fichero por grabación) y escribe en la prueba la ruta y la duración; después, `content:upload` como con una lección | TTS (capa gratuita) |
| `pnpm content:upload --ids <ids>` | Sube el audio a R2; con `--supabase`, al Storage de Supabase ([ADR-0019](../adr/0019-audio-en-supabase-storage.md)); con `--local`, lo copia a `public/dev-audio/` para probar | 0 |
| `pnpm content:publish --ids <ids>` | Marca como publicadas lecciones ya revisadas (`status` y `provenance.reviewed_by`) | 0 |
| `pnpm content:validate` | Valida **todo** `content/` (también en CI) | 0 |
| `pnpm content:index` | Regenera `content/index.generated.json` | 0 |
| `pnpm content:run --spec <yaml>` | Encadena todo con puntos de control y reanudación | — |
| `pnpm studio` | Arranca la app en desarrollo con `/studio` | 0 |

Los lotes de la Batch API pueden tardar (normalmente bastante menos de 24 h). El script guarda el ID del lote en `content/.batches/` para **reanudar** sin volver a pagar.

---

## 3. Paso a paso

### 3.1 Especificación (`content/specs/{nivel}/*.yaml`)
Una por unidad/serie. Formato en [Cómo leer el currículo §6](../02-curriculo/00-como-leer-el-curriculo.md#6-cómo-se-usa-con-el-pipeline). Se escribe a mano o se pide a Claude en un chat a partir del documento del nivel.

### 3.2 Generación
- `system` = prompt de la destreza ([Prompts](04-prompts-de-generacion.md)) + **perfil del nivel** (resumen del documento de currículo + lista de palabras del nivel abreviada). Es estable entre peticiones → cacheable.
- `user` = la especificación de esa lección en YAML.
- Salida estructurada con `ListeningDraftLLM` / `ReadingDraftLLM` → transformación a `LessonDraft` → validación Zod.
- Si una lección falla la validación, se registra el error y el resto del lote sigue.

### 3.3 Anotación
1. **Tokenización y lemas** (wink-nlp): por segmento o por frase. Nombres propios, números y puntuación → `w = false`.
2. **Nivel de cada lema:** CEFR-J (A1–B2) → Octanove (C1–C2) → estimación por frecuencia (NGSL). Ver [Vocabulario](../01-pedagogia/05-vocabulario-y-srs.md#3-niveles-de-las-palabras-fuentes-con-licencia-abierta).
3. **Cobertura por nivel** (`qa.coverage_by_level`) y **lemas fuera de nivel** (`qa.off_level_lemmas`).
4. **Glosario:** si un lema fuera de nivel no está en el glosario ni en `pre_teach`, se genera su entrada con Haiku (definición sencilla, traducción, ejemplo) usando la frase real.
5. **Legibilidad:** palabras por frase y Flesch como señal secundaria.
6. `lemmas` (únicos, ordenados) para el cálculo de cobertura en la app.

### 3.4 Revisión
Dos llamadas por lección (detalle en [Control de calidad §3](02-control-de-calidad.md#3-revisión-con-ia)):
1. **Solo preguntas** (sin texto ni claves) → ¿se pueden acertar sin escuchar/leer?
2. **Revisión completa** (texto + preguntas, **sin claves**) → respuestas del revisor + informe de nivel, naturalidad, ambigüedad, hechos, sensibilidad.

El script compara con las claves y calcula `answerable_with_text` y `answerable_without_text`. Si se cumplen los umbrales → `status: reviewed`.

### 3.5 TTS
- Voz por hablante según su `accent` y `gender` (`scripts/content/voices.ts`, §4).
- SSML por segmento con `rate` inicial según nivel (A1 −15 %, A2 −10 %, B1 −5 %, B2 0 %, C1 +5 %, C2 +10 %) y ajuste para acercarse a `target_wpm` (±8 %).
- **Caché local** en `.audio-cache/{sha256(voz+ssml)}.wav` + `.json` (eventos de palabra): re-ejecutar no vuelve a gastar caracteres.
- Contador de caracteres del mes en `.audio-cache/usage.json` y aviso al 80 % de la capa gratuita (0,5 M caracteres).

### 3.6 Audio
ffmpeg: concatenar con pausas → `loudnorm` (I = −16, TP = −1,5) → AAC 64 kbps mono → tiempos por palabra en la línea de tiempo final → `segment.start/end`, `token.s/e`, `audio.duration_s`, `audio.wpm` real, `audio.peaks`.

### 3.7 Subida
`audio/{nivel}/{id}/v{version}.m4a` en R2 con `Content-Type: audio/mp4` y `Cache-Control: public, max-age=31536000, immutable`. Nunca se sobrescribe una versión publicada.

### 3.8 Studio y publicación
`/studio` (solo con `NODE_ENV=development`):
- Lista de borradores y revisadas con sus métricas (cobertura, ppm, nota del revisor, problemas).
- Reproductor y transcripción como en la app; preguntas con claves y justificación visibles.
- Botones: **Aprobar** (escribe `status: published`, `provenance.reviewed_by`), **Devolver** (vuelve a `draft` con nota), **Abrir JSON**.
- Las acciones de Studio escriben en el sistema de archivos local mediante un Route Handler que **solo existe en desarrollo**.

Después: `pnpm content:validate && pnpm content:index`, *commit* y *push*.

---

## 4. Voces por acento (ejemplos)

Confirma los nombres en la galería de voces de Azure antes de fijarlos; cambian con el tiempo.

| Acento | Mujer | Hombre |
|---|---|---|
| en-US | `en-US-AvaNeural`, `en-US-EmmaNeural` | `en-US-AndrewNeural`, `en-US-BrianNeural` |
| en-GB | `en-GB-SoniaNeural`, `en-GB-LibbyNeural` | `en-GB-RyanNeural`, `en-GB-ThomasNeural` |
| en-AU | `en-AU-NatashaNeural` | `en-AU-WilliamNeural` |
| en-IE | `en-IE-EmilyNeural` | `en-IE-ConnorNeural` |
| en-CA | `en-CA-ClaraNeural` | `en-CA-LiamNeural` |
| en-IN | `en-IN-NeerjaNeural` | `en-IN-PrabhatNeural` |
| en-NZ | `en-NZ-MollyNeural` | `en-NZ-MitchellNeural` |
| en-ZA | `en-ZA-LeahNeural` | `en-ZA-LukeNeural` |
| en-NG | `en-NG-EzinneNeural` | `en-NG-AbeoNeural` |

Reglas: dos hablantes de una lección nunca comparten voz; se rota entre las voces del mismo acento para no oír siempre a las mismas personas; acentos sin voz sintética (escocés, por ejemplo) → solo con audio auténtico.

---

## 5. Proveedor de TTS intercambiable

```ts
// scripts/content/lib/tts/types.ts
export interface WordEvent { text: string; offsetMs: number; durationMs: number }
export interface SynthesisResult { wav: Buffer; words: WordEvent[]; sampleRate: number }

export interface TtsProvider {
  id: 'azure' | 'kokoro';
  voicesFor(accent: string, gender: 'female' | 'male'): string[];
  synthesize(input: { ssml: string; voice: string }): Promise<SynthesisResult>;
}
```

- `azure.ts`: SDK de Azure Speech, evento `wordBoundary` → `WordEvent`.
- `kokoro.ts`: modelo local (Apache 2.0); si no da tiempos por palabra, alineado forzado posterior.
- Se elige con `TTS_PROVIDER` en `.env.pipeline` (`azure` o `kokoro`).
- **Kokoro ya está implementado** (`tts/kokoro.ts`, paquete `kokoro-js`): corre en local sin claves, con voces en-GB y en-US. Como no da eventos de palabra, los tiempos se **estiman** emparejando las pausas del audio con la puntuación (`tts/estimate-words.ts`); para tiempos exactos hace falta Azure. Admite velocidades de 0,7× a 1,3×: en A1, si aun así va rápido, se alargan las pausas con `pause_after_ms`.

---

## 6. Modo manual (fases 1–3 del roadmap)

Antes de tener la generación automática:
1. Escribe el borrador JSON a mano, o pídeselo a Claude en un chat pegando el prompt de [Prompts](04-prompts-de-generacion.md) y la especificación.
2. `pnpm content:annotate` → `pnpm content:tts` → `pnpm content:audio` → `pnpm content:upload` → `pnpm content:validate`.
3. Marca `published` a mano tras escucharla.

Así tienes lecciones reales en la app desde la fase 2. Los dos [ejemplos](ejemplos/README.md) están listos para este flujo.
