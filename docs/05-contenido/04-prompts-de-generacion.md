# Prompts de generación y revisión

> **Propósito:** los prompts del pipeline, listos para copiar a `scripts/content/prompts/`. Están en inglés (instrucciones más precisas para el modelo; y lectura B2 para ti); los campos que ves tú (`*_es`) se piden en español.
> **Relacionado:** [Pipeline](01-pipeline.md) · [Control de calidad](02-control-de-calidad.md) · [IA](../04-arquitectura/06-ia.md) · [Modelo de contenido §4](../04-arquitectura/04-modelo-de-contenido.md#4-esquema-para-la-ia-lessondraftllm)

Cada prompt lleva una versión (`gen-listening@1`…) que se guarda en `provenance.prompt_version`. Cambiar un prompt = subir la versión + ejecutar `pnpm ai:eval`.

---

## 1. Estructura de las peticiones

```
system:
  [1] Prompt de la tarea (este documento)                ─┐ estable entre peticiones
  [2] Perfil del nivel (§2) con cache_control             ─┘ → prompt caching
user:
  <spec> … especificación YAML de UNA lección … </spec>
output_config:
  format: zodOutputFormat(ListeningDraftLLM | ReadingDraftLLM)
  effort: high
```

---

## 2. Perfil de nivel (se genera desde el currículo)

`scripts/content/lib/level-profile.ts` construye un bloque así a partir de `docs/02-curriculo/{nivel}.md` y las listas de palabras:

```text
<level_profile level="B1">
Summary: Independent user. Understands main points of clear standard speech on familiar matters…
Speech rate: 120–150 wpm. Turns: short. Accents allowed: en-US, en-GB (+ en-AU, en-IE, en-CA occasionally).
Text length (reading): 300–600 words. Average sentence length ≤ 15 words.
Grammar in scope: present perfect vs past simple; past perfect; narrative tenses; used to/would; future forms;
  zero/first/second conditional; passive (present/past); defining relative clauses; reported speech; …
Connected speech priorities: weak forms (to, for, of, and, can, have, you), gonna/wanna/gotta, contractions with 'd and 's,
  consonant–vowel linking in phrasal verbs, numbers and times.
Preferred vocabulary (B1 lemmas, sample): achieve, advice, afford, appointment, available, background, …
Typical traps for Spanish speakers: false friends (actually, eventually, sensible…), fourteen/forty, can/can't, -ed endings.
</level_profile>
```

La lista completa de lemas del nivel puede ir entera (se cachea): mejora la adherencia al vocabulario.

---

## 3. Generar lección de escucha · `gen-listening@1`

```text
You write original listening materials for an English-learning app used by one adult learner
whose first language is Spanish (Spain). You receive one lesson specification in <spec> and
the level profile in <level_profile>. Produce ONE listening lesson that matches the output schema.

SCRIPT
- Write natural spoken English for the requested genre and level: contractions, discourse markers
  (well, so, actually, I mean), short turns in dialogues, light hesitations from B1 upwards.
- Build a real situation with a small tension or decision (a plan, a problem, a disagreement),
  not a list of facts. Speakers have distinct personalities and goals.
- Stay within the level: vocabulary mostly from the level profile; at most 3 above-level words per
  100 words, and every above-level word or expression must be in the glossary. Grammar within scope
  unless the spec says otherwise.
- Length within the spec's target_words. Keep sentences easy to say aloud.
- Use every item of vocab_focus naturally. Include at least 3 instances of the connected-speech
  targets in the spec (e.g. "gonna", "have you got", "turn it off").
- Match each speaker's accent with natural regional usage when it helps (British "car park",
  "half eleven"; American "parking lot"), and note regional items in the glossary.
- Facts must be true. No brands, no real living people, no politics or religion, nothing sensitive,
  no song lyrics or quotes from copyrighted works.
- Segments: one segment = one sentence or one short turn (≤ 20 words). Ids s1, s2, s3…

TASKS (follow the counts per phase in the spec)
- listen_1: 1–2 questions on gist or attitude. listen_2: detail and inference. post: dictation.
- Every question must be answerable from the audio alone. List the segment ids that contain the
  answer in "evidence".
- Distractors must be plausible; when possible they are mentioned in the audio in another role
  (a time that was suggested and rejected, a number said in another context). Classic traps for
  Spanish speakers are welcome: fourteen/forty, can/can't, British time expressions.
- Paraphrase: the correct option must not copy the script word for word.
- Vary the position of the correct option; keep options similar in length.
- rationale_es: Spanish (Spain), one or two sentences: where the answer is and why the main
  distractor is wrong.
- dictation: choose 2–4 segments that contain connected-speech targets; "reference" is the exact
  text of that segment.

OTHER FIELDS
- summary_es: one sentence in Spanish. prediction_prompt: one short English question.
- pre_teach: up to 5 above-level lemmas essential to understand the audio.
- connected_speech: each notable feature with the exact phrase, its type, approximate IPA and a
  short Spanish explanation.
- glossary: every above-level word or expression plus a few useful chunks. def_en in simple English
  below the lesson level; def_es short; example = a new sentence; note_es = regional/usage note or "".
```

---

## 4. Generar lección de lectura · `gen-reading@1`

```text
You write original reading texts and comprehension tasks for an English-learning app used by one
adult learner whose first language is Spanish (Spain). You receive one lesson specification in
<spec> and the level profile in <level_profile>. Produce ONE reading lesson matching the schema.

TEXT
- Genre and register exactly as requested (article, blog post, story, email, review, opinion…).
- A clear angle or story with a beginning, development and end. Interesting for a young adult
  developer who likes technology, space, games and music, but do not force those topics.
- Stay within the level (see listening rules: above-level words ≤ 3 per 100 and all glossed).
- Paragraphs with ids p1, p2…; each sentence with id p{n}s{m} (p1s1, p1s2…). One sentence per item.
- Length within target_words. Average sentence length within the level profile.
- Include reference words that need tracking (it, this, they, which, such) and, from B1 upwards,
  at least one example of the spec's grammar_focus used naturally.
- Facts must be true; invented people must be clearly ordinary (no celebrities); no copyrighted quotes.

TASKS
- skim: 1–2 questions on the main idea or best title (mcq or heading_match).
- read: detail, reference ("what does 'they' refer to"), vocab_in_context, inference and, from B2,
  attitude/purpose. Follow the counts in the spec.
- true_false_ng: include at least one "NG" whose topic is mentioned but not resolved in the text.
- Same distractor and paraphrase rules as listening. Evidence = sentence ids.
- rationale_es in Spanish (Spain).

LANGUAGE FOCUS
- 1–2 items: a feature of THIS text worth noticing (linking words, reference chains, a tense contrast,
  noun phrases…), each with a short Spanish explanation and the sentence ids where it appears.

GLOSSARY, PRE_TEACH, SUMMARY: as in listening (refs are sentence ids).
```

---

## 5. Revisión · llamada 1 «solo preguntas» · `review-blind@1`

Se envían **solo** los enunciados y opciones (sin texto, sin claves).

```text
You will see comprehension questions WITHOUT the text or audio they belong to.
For each question, choose the answer that a clever test-taker would pick using only common sense,
general knowledge and clues inside the question and options. If you have no basis, pick the option
you find most likely anyway. Return one answer per question id.
```

---

## 6. Revisión · llamada 2 «completa» · `review-full@1`

Texto o guion + preguntas, **sin claves ni justificaciones**.

```text
You are an independent, strict reviewer of English-learning materials. You did not write this lesson.
The target learner is a Spanish speaker. You receive the level profile and the lesson WITHOUT answer keys.

1. Answer every question using the text/script. Return your answers by question id.
2. Evaluate the lesson:
   - level_ok: vocabulary, grammar, length, idea density and (for listening) sentence length for speech
     fit the level profile. Explain briefly in level_comment.
   - naturalness 1–5: does it sound like real people talking/writing in that genre?
   - For each question: is there exactly one defensible answer? Do the evidence ids really contain it?
     Are the distractors plausible but clearly wrong?
   - Facts: list any false or doubtful statement.
   - Sensitivity: stereotypes, sensitive topics, anything inappropriate for a general audience.
   - The Spanish explanations (rationale_es, explanation_es, def_es): are they correct and natural Spanish?
3. issues: list each problem with severity (blocker | major | minor), where (an id or "global"),
   the problem and a concrete fix.
4. score 0–10 (10 = publish as is; 7 = publishable with minor fixes; below 7 = needs regeneration).
```

El script compara las respuestas de ambas llamadas con las claves y calcula los umbrales de [Control de calidad §3](02-control-de-calidad.md#3-revisión-con-ia).

---

## 7. Completar glosario · `gloss@1` (Haiku)

```text
For each item in <items> (a lemma, its part of speech and the exact sentence where it appears),
write a learner-dictionary entry for a Spanish-speaking learner at level {LEVEL}:
- def_en: the meaning IN THIS SENTENCE, in simple English below {LEVEL}, max 15 words.
- def_es: a short Spanish (Spain) translation or explanation of that meaning.
- example: a new natural example sentence at level {LEVEL} using the same meaning.
- note_es: a short usage or regional note in Spanish, or "" if none.
Do not explain other meanings of the word.
```

---

## 8. Pseudopalabras para el test de vocabulario · `pseudo@1` (Haiku)

```text
Generate 60 English-looking pseudowords: 5–9 letters, pronounceable, following English spelling
patterns, using common English prefixes or suffixes in some of them (e.g. -tion, -ful, un-).
They must NOT be real English words, archaic words, brand names, names, slang, or words in other
common languages. Return a plain list.
```

Después, el script descarta cualquiera que aparezca en una lista grande de palabras inglesas y se queda con 20.

---

## 9. Consignas de writing · `writing-prompts@1`

```text
Create {N} writing tasks for level {LEVEL} of type {TASK_TYPE} for a Spanish-speaking young adult.
Each task: a realistic situation and reader, a clear purpose, 3 content points to cover, and a word range
of {MIN}–{MAX}. Vary topics among: {TOPICS}. Write prompt_en in English at or below {LEVEL};
context_es: one sentence in Spanish explaining the situation.
```

---

## 10. Frases para drills · `drill-sentences@1`

```text
Write {N} short, natural sentences (5–12 words) at level {LEVEL} where the feature "{FEATURE}"
(e.g. weak form of "to", "gonna", linking consonant–vowel in phrasal verbs) occurs naturally once.
For each sentence give the target fragment exactly as written and, for multiple choice,
three distractors a Spanish speaker might mishear (e.g. "want to go" → "want go", "wants a go").
Avoid names of real people and brands.
```

---

## 11. Uso en un chat (modo manual)

Mientras no exista el script de generación, puedes usar estos prompts en un chat con Claude:

1. Pega el prompt de la destreza (§3 o §4) y el perfil del nivel.
2. Pega la especificación YAML de una lección.
3. Pide: «Devuelve solo el JSON que cumpla `ListeningDraft` (te pego el esquema)» y pega el bloque de [Modelo de contenido §2](../04-arquitectura/04-modelo-de-contenido.md#2-esquemas-zod-v4).
4. Guarda el resultado en `content/lessons/…` y ejecuta `pnpm content:validate` antes de seguir con el TTS.
