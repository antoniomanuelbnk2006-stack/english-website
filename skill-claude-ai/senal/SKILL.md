---
name: senal
description: Guía completa del proyecto Señal — web app personal (PWA) para aprender inglés de A1 a C2 con foco en listening y reading (Next.js 16, Supabase, Claude API, Azure TTS). Úsala siempre que se trabaje en cualquier parte del proyecto (pedagogía, currículo, contenido, arquitectura, base de datos, UI, IA, roadmap) o en el plan de estudio de inglés del dueño. Si no sabes cómo hacer algo dentro del proyecto, consulta esta guía antes de inventar una solución.
---

# Señal — guía del proyecto

## Índice
1. Contexto y decisiones
2. Pedagogía en una página
3. Stack
4. Arquitectura y carpetas
5. Base de datos
6. Contenido
7. Algoritmos clave
8. Reglas estrictas
9. Roadmap
10. Plan de estudio del dueño
11. Dónde está el detalle

---

## 1. Contexto y decisiones

**Producto:** web app personal instalable (PWA) para aprender inglés A1→C2. Un único usuario: el dueño, hispanohablante de España, **B1** al empezar, con **listening y reading** como puntos débiles. Objetivo inmediato: **B2 en comprensión** en 9–12 meses.

| Tema | Decisión |
|---|---|
| Público | Solo el dueño; registro desactivado; arquitectura multiusuario «dormida» (`user_id` + RLS en todo) |
| IA | Contenido **pregenerado** (generar → anotar → revisar → locutar) + **feedback de writing en vivo** con límite diario (10) y tope mensual (5 $) |
| Stack | Next.js 16 + Supabase, PWA |
| Prioridad | Listening > Reading > Vocabulario > Writing > Speaking |
| Coste | ≈ 0 €/mes en infraestructura (capas gratuitas) |
| Nombre | «Señal»: del ruido (inglés que no entiendes) a la señal |

## 2. Pedagogía en una página

- **Input comprensible i + 1**, cobertura léxica 95 % (intensiva) / 98 % (extensiva).
- **Enseñar a escuchar, no solo examinar:** decodificación (sonido → palabras) vs construcción de significado.
- **Ciclo de escucha (8–15 min):** 0 Preparar → 1 Escucha global (sin texto, 1–2 preguntas de idea general) → 2 Detalle (4–8 preguntas, repetir frases) → 3 **Dictado diagnóstico** de 2–4 frases clave → 4 Transcripción karaoke con rasgos marcados → 5 Drills según causas → 6 Escucha final + autoevaluación → 7 Cosecha al SRS (≤ 5).
- **Causas de fallo:** `unknown_word`, `not_recognized` (la típica de B1: formas débiles, enlace, reducciones), `boundaries`, `speed`, `accent`, `attention`.
- **Ciclo de lectura:** preparar → vistazo 60–90 s → lectura en inmersión cronometrada (ppm) → preguntas (gist, detail, reference, vocab in context, inference, attitude, purpose, structure) → relectura con ayudas + foco lingüístico → lectura + audio → cosecha (≤ 8).
- **SRS FSRS** con tarjetas `word`, `chunk`, **`audio`** (fragmento por tiempos), `grammar`; retención 0,90; 10 nuevas/día; 15 min máx.
- **Gramática** breve, en español, contrastiva, ligada a textos y errores.
- **Errores de hispanohablantes** como fuente de drills y distractores (vocales, /b/–/v/, aspiración, -ed/-s, formas débiles, falsos amigos, preposiciones).
- **Reparto de tiempo (45 min):** intensiva escucha 15 %, extensiva escucha 25 %, intensiva lectura 10 %, extensiva lectura 20 %, SRS 15 %, producción 15 %.

## 3. Stack

Next.js 16.x (App Router, Turbopack, **`proxy.ts`**, APIs de petición asíncronas, sin `next lint`) · React 19.2 · TypeScript estricto · Tailwind v4 + shadcn/ui · Zod v4 · Supabase (Postgres, Auth OTP por email, RLS; `@supabase/ssr`; claves **publishable/secret**) · Cloudflare R2 (audio; salida gratis) · Azure AI Speech F0 (TTS con *word boundary*; 0,5 M caracteres/mes) tras interfaz `TtsProvider` (alternativa Kokoro) · ts-fsrs (FSRS-6) · Claude API: `claude-sonnet-5-5` (generar, writing), `claude-opus-5-5` (revisar), `claude-haiku-5-5` (tareas baratas); salidas estructuradas (`output_config.format` + `zodOutputFormat`), Batch API −50 %, `output_config.effort` · Zustand (reproductor) · Vitest, Testing Library, Playwright, axe · Serwist (Turbopack) para la PWA · Vercel Hobby.

## 4. Arquitectura y carpetas

- **Contenido como código** en `content/` (JSON/MDX, validado con Zod en CI); la BD guarda solo lo del usuario.
- Server Components por defecto; islas cliente: reproductor, lector, tareas, repaso.
- `src/features/<feature>/{components,server,lib}` — `lib/` = lógica pura con tests al lado.
- `src/lib/{supabase,content,ai,audio,offline,i18n}`, `env.ts` (Zod), `dates.ts` (Europe/Madrid).
- `scripts/content/` = pipeline local (generate, annotate, review, tts, audio, upload, validate, build-index, run).
- Rutas en español: `/hoy`, `/escuchar[/id]`, `/leer[/id]`, `/repasar`, `/vocabulario`, `/gramatica`, `/entrenar/[drill]`, `/escribir`, `/progreso`, `/nivel`, `/diario`, `/ajustes`, `/offline/[id]`, `/studio` (solo dev).
- IA en vivo solo en `POST /api/ai/writing-feedback`.

## 5. Base de datos

Tablas (todas con `user_id`, RLS `(select auth.uid()) = user_id`): `profiles`, `skill_ratings`, `rating_history`, `lesson_progress`, `item_attempts` (idempotente por `client_id`), `listening_diagnostics`, `lexicon`, `srs_cards` (estado FSRS), `srs_reviews`, `input_log`, `activity_days`, `daily_plans`, `writing_submissions`, `placement_results`, `achievements`. Funciones: `handle_new_user` (definer), `apply_lesson_attempts` y `add_activity` (invoker, `search_path = ''`). Vistas `security_invoker`.

## 6. Contenido

- Dos capas: **`LessonDraft`** (texto, hablantes, tareas con claves y `rationale_es`, glosario, habla conectada, metadatos) y **`Lesson`** publicada (+ tokens con lema/POS, tiempos por palabra, `audio` con `peaks`, `lemmas`, `difficulty`, `qa`).
- IDs: lección `b1-lis-001`; tarea `q1`; segmento `s1`; párrafo `p1`; frase `p1s1`; descriptor `L-B1-07`; gramática `b1.relative-clauses-defining`; unidad `b1-u02`.
- Tareas: `mcq`, `multi_select`, `true_false_ng`, `gap_fill`, `matching`, `ordering`, `short_answer`, `dictation`, `heading_match`; focos: gist, detail, inference, reference, vocab_in_context, purpose_function, attitude_opinion, text_structure, decoding.
- Para la IA, esquemas reducidos (`*DraftLLM`): todo obligatorio, sin min/max, ≤ 24 opcionales, ≤ 16 uniones.
- QA: cobertura por nivel, palabras/frase, ppm ±8 %, posición/longitud de respuestas, copia literal; revisor Opus en dos llamadas (solo preguntas / completa sin claves): `with_text ≥ 0,9`, `without_text ≤ 0,4`, `score ≥ 7`.
- Audio: `.m4a` AAC 64 kbps mono, −16 LUFS, ruta `audio/{nivel}/{id}/v{n}.m4a`, inmutable.

## 7. Algoritmos clave

- **Dictado:** normalizar (equivalencias *gonna* = *going to*, números, contracciones, UK/US) → alinear palabras → proponer causa (desconocida si el lema no es `known`; límites si se parte/une; no reconocida si es conocida y hay rasgo marcado; velocidad si acierta a 0,75×; acento si el hablante no es en-US/en-GB; atención si omite el final).
- **Elo por destreza:** `E = 1/(1+10^((D−R)/400))`, `R' = R + K·w·(S−E)`; K 32 → 16 → 10; `w` mcq 0,75, tfng 0,6, gap 0,9, short/dictation 1,0; tope ±60 por lección. Bandas: A1 600–799, A2 800–999, B1 1000–1199, B2 1200–1399, C1 1400–1599, C2 ≥ 1600. Confirmación de nivel con prueba ≥ 65 %.
- **Dificultad de lección:** centro del nivel + léxico (±40) + velocidad o sintaxis (±40/±30) + acento (+15).
- **Plan diario (`buildDailyPlan`, puro):** SRS (≤ 15 min, sin nuevas si > 150 pendientes) → intensiva de la destreza más débil → drill de la causa dominante (> 35 %) → lectura (intensiva días impares) → writing mar/vie → relleno con extensiva. Selección: ventana de dificultad [R−50, R+100], serie actual, intereses, acentos poco escuchados, cobertura cerca de 95 %, *jitter* determinista por día.
- **Cobertura:** tokens contables (sin nombres propios, números, puntuación) con lema `known` o gramatical / contables.

## 8. Reglas estrictas

NUNCA: secretos en cliente o repo · clave *secret* de Supabase en la app · tabla sin `user_id`+RLS+política · transcripción antes de la fase 3 · XP por clics · IA desde el cliente o sin límites · contenido con copyright · audio en el repo · `any` · *hex* en componentes · día calculado en UTC.
SIEMPRE: Zod en fronteras · Server Actions `(input: unknown) => Promise<ActionResult<T>>` · lógica pura con tests · Europe/Madrid · RSC por defecto · UI en español vía i18n · accesibilidad · commits en inglés.

## 9. Roadmap (v1 en 12–16 semanas a tiempo parcial)

0 Cimientos · 1 Contenido y lectura · 2 Listening + audio mínimo · 3 Vocabulario/SRS/gramática (**MVP**) · 4 Generación IA + QA + Studio (primer lote ~40 lecciones B1–B2) · 5 Nivel, plan diario, progreso, gamificación · 6 Writing IA + pruebas de confirmación · 7 PWA y sin conexión · 8 Expansión (*shadowing*, clásicos, C1, optimizador FSRS…).

## 10. Plan de estudio del dueño

Semana 0: diagnóstico (test MCER gratuito, % de comprensión, dictado, ppm). Etapas: **Abrir el oído** (sem. 1–10, dictado B1 ≥ 85 %) → **Subir la velocidad** (sem. 11–24, B2−, acentos, escucha estrecha) → **B2 de verdad** (sem. 25–40, contenido auténtico, confirmación B2). ~7 h/semana. Códigos de fallo D/R/L/V/A/M. No esperar a la app: método manual desde el día 1.

## 11. Dónde está el detalle

Si esta carpeta incluye `docs/`, consulta allí; si no, pide al usuario el documento:
`00-vision` (visión, glosario) · `01-pedagogia` (MCER, metodología, listening, reading, vocabulario/SRS, gramática, writing/speaking, evaluación, errores) · `02-curriculo` (A1–C2) · `03-producto` (funcionalidades, pantallas, plan diario, gamificación, diseño) · `04-arquitectura` (stack, carpetas, BD con SQL, contenido con Zod, audio, IA, seguridad, PWA) · `05-contenido` (pipeline, QA, licencias, prompts, ejemplos) · `06-desarrollo` (roadmap, convenciones, testing, despliegue, prompts por fase) · `07-tu-plan` · `adr`.
