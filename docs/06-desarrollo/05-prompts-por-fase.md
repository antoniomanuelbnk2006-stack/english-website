# Prompts por fase (para Claude Code)

> **Propósito:** prompts listos para pegar en Claude Code al empezar cada fase. Todos asumen que `CLAUDE.md` y `docs/` están en el repo.
> **Relacionado:** [Roadmap](01-roadmap.md) · [CLAUDE.md](../../CLAUDE.md)

**Cómo usarlos**
1. Empieza cada fase en una rama nueva (`feat/fase-N-…`).
2. Pega el prompt; pide primero **un plan** (modo plan) y revísalo antes de que escriba código.
3. Trabaja en pasos pequeños con *commits* frecuentes y tests en verde.
4. Al terminar, recorre los criterios de aceptación del [roadmap](01-roadmap.md) tú mismo.

---

## Fase 0 · Cimientos

```text
Vamos a empezar Señal, mi web app personal para aprender inglés. Lee CLAUDE.md y después:
docs/00-vision/01-vision-y-alcance.md, docs/04-arquitectura/01-stack.md,
docs/04-arquitectura/02-arquitectura-y-carpetas.md, docs/04-arquitectura/03-base-de-datos.md,
docs/04-arquitectura/07-seguridad-y-privacidad.md, docs/06-desarrollo/02-convenciones.md
y docs/06-desarrollo/04-entornos-y-despliegue.md.

Objetivo: Fase 0 del roadmap (docs/06-desarrollo/01-roadmap.md).
- Configura TypeScript estricto, Tailwind v4 con los tokens de docs/03-producto/05-sistema-de-diseno.md,
  shadcn/ui, ESLint + Prettier, Vitest y Playwright.
- src/lib/env.ts con Zod (servidor/cliente separados).
- Supabase: migración 0001_base.sql tal cual el documento de base de datos; clientes server/browser/proxy
  con @supabase/ssr y claves publishable/secret; proxy.ts con refresco de sesión y ALLOWED_EMAIL.
- Login con código OTP de 6 dígitos (signInWithOtp con shouldCreateUser: false + verifyOtp).
- Shell con navegación inferior (móvil) y lateral (escritorio), rutas vacías del mapa de rutas.
- CI de GitHub Actions como en docs/06-desarrollo/03-testing-y-calidad.md.
Antes de escribir código, consulta en node_modules/next/dist/docs/ lo que necesites de Next 16
(proxy.ts, APIs asíncronas). Propón un plan, espera mi OK y avanza en commits pequeños.
Criterios de aceptación: los de la Fase 0 del roadmap.
```

## Fase 1 · Contenido y lectura

```text
Fase 1 del roadmap. Lee docs/04-arquitectura/04-modelo-de-contenido.md, docs/01-pedagogia/04-reading.md,
docs/03-producto/02-pantallas-y-flujos.md (§2.4 y §3.4) y docs/05-contenido/ejemplos/.
- Implementa src/lib/content/schema.ts exactamente como en el documento (Zod v4) y tests de las invariantes.
- scripts/content/validate.ts, annotate.ts (wink-nlp + listas CEFR-J/Octanove/NGSL de content/wordlists)
  y build-index.ts. Mete las dos lecciones de ejemplo en content/.
- Motor de tareas en features/tasks (corrección pura + componentes) para mcq, true_false_ng, gap_fill,
  short_answer, heading_match, matching y ordering.
- /leer y /leer/[id] con el ciclo de lectura (fases 0–3), medición de ppm y guardado con
  submitAttempts + apply_lesson_attempts (rating aún fijo).
- /diario con registro rápido (≤ 2 toques) y acceso desde /hoy.
Tests: corrección de cada tipo de tarea, normalización de respuestas, invariantes de contenido.
```

## Fase 2 · Listening + audio mínimo

```text
Fase 2. Lee docs/01-pedagogia/03-listening.md (entero), docs/04-arquitectura/05-audio-y-reproductor.md,
docs/05-contenido/01-pipeline.md (§3.5–3.7 y §5) y docs/01-pedagogia/09-errores-hispanohablantes.md.
- Scripts content:tts (proveedor intercambiable; Azure con eventos wordBoundary; caché por hash en
  .audio-cache; contador de caracteres), content:audio (ffmpeg: pausas, loudnorm −16 LUFS, AAC 64k mono,
  tiempos finales, peaks) y content:upload (R2 con Cache-Control inmutable). Publica b1-lis-001.
- Reproductor con Zustand + un HTMLAudioElement: segmentos, repetir, bucle, velocidad 0,5–1,5 con
  preservesPitch, atajos, onda y karaoke por requestAnimationFrame sin re-render global.
- Ciclo de escucha completo (fases 0–7). La transcripción solo se entrega con getTranscript cuando
  lesson_progress.phase ≥ 3.
- features/listening/lib/dictation.ts: normalización con equivalencias, alineación por palabras y
  propuesta de causa (tabla del §4.3). 20+ tests dorados.
- Drills iniciales (formas débiles, reducciones, números) desde content/drills.
- Lectura + audio en lecciones de lectura.
Criterios: los de la Fase 2. Verifica accesibilidad con axe y navegación solo con teclado.
```

## Fase 3 · Vocabulario, SRS y gramática

```text
Fase 3. Lee docs/01-pedagogia/05-vocabulario-y-srs.md y docs/01-pedagogia/06-gramatica.md.
- lexicon: estados, fuentes, promoción implícita, cobertura por texto (cliente para el lector,
  servidor para las bibliotecas).
- WordPopover con glosario contextual, audio de la palabra en contexto (token.s–token.e),
  añadir al repaso / ya la conozco; pulsación larga para marcar desconocida.
- SRS con ts-fsrs (FSRS-6): parámetros del documento, límites diarios, tarjetas word/chunk/audio/grammar,
  valoración sugerida para audio y gramática. submitReviews recalcula en servidor desde el estado guardado.
- Cosecha priorizada al terminar lecciones (máx. 5 escucha / 8 lectura).
- 5 fichas de gramática B1 de prioridad «muy alta» en MDX con mini-práctica.
Tests: scheduler, cobertura, cosecha, valoración sugerida.
```

## Fase 4 · Generación con IA, QA y Studio

```text
Fase 4. Lee docs/04-arquitectura/06-ia.md, docs/05-contenido/ (todo) y el currículo de B1 y B2.
- scripts/content/lib/llm-schemas.ts (ListeningDraftLLM, ReadingDraftLLM) y transformaciones a LessonDraft.
- content:generate con la Batch API y salidas estructuradas (zodOutputFormat), reanudable con
  content/.batches; perfiles de nivel construidos desde docs/02-curriculo y las listas de palabras.
- content:review con las dos llamadas (solo preguntas / completa sin claves) y los umbrales de QA.
- content:run que encadena todo con puntos de control.
- /studio solo en desarrollo: lista con métricas, reproducción, aprobar/devolver (escribe en content/).
- ai:eval para generación (6 especificaciones fijas).
Después, genera las especificaciones y el primer lote: B1 u01–u06 y B2 u01–u03.
```

## Fase 5 · Nivel, plan diario y progreso

```text
Fase 5. Lee docs/01-pedagogia/08-evaluacion-y-nivel.md, docs/03-producto/03-motor-del-plan-diario.md
y docs/03-producto/04-gamificacion.md.
- features/level/lib/elo.ts (fórmulas, K, pesos, tope por lección) integrado en submitAttempts;
  rating_history. Test de convergencia simulada.
- Test de nivel completo (sí/no con pseudopalabras + adaptativos) con banco en content/placement.
- buildDailyPlan puro con los 6 tests mínimos; /hoy con plan persistido en daily_plans y «por qué».
- /progreso: niveles (estimado + confirmado), rating en el tiempo, horas, palabras, «Tu oído».
- XP por tiempo activo, racha con comodines, misiones semanales y logros (reglas puras + tests).
- Exportar datos en JSON.
```

## Fase 6 · Writing con IA y confirmación

```text
Fase 6. Lee docs/01-pedagogia/07-writing-y-speaking.md y docs/04-arquitectura/06-ia.md (§3).
- Consignas por nivel en content/writing; /escribir con editor (contador, autoguardado local, modo examen).
- Route Handler /api/ai/writing-feedback exactamente con el esquema, límites y prompt del documento;
  normalizeFeedback; historial y evolución por criterio; cosecha de errores al SRS.
- Tests con el SDK de Anthropic simulado (límite diario, tope mensual, refusal, max_tokens).
- ai:eval de writing con el conjunto dorado.
- Pruebas de confirmación B1/B2 (Listening y Reading) con desbloqueo y resultado.
```

## Fase 7 · PWA y sin conexión

```text
Fase 7. Lee docs/04-arquitectura/08-pwa-rendimiento-accesibilidad.md y §5 de 05-audio-y-reproductor.md.
- Manifiesto e iconos; service worker con Serwist para Turbopack (o manual si da problemas), con la
  estrategia de caché del documento (audio cache-first + Range requests + expiración).
- <audio crossOrigin="anonymous">; botón «Descargar lección»; /offline/[id] 100 % cliente.
- Cola en IndexedDB para intentos, repasos y diario; sincronización idempotente.
- Media Session API con anterior/siguiente = cambiar de frase.
Prueba en modo avión en Android y en mi iPhone y documenta el comportamiento en segundo plano en iOS.
```
