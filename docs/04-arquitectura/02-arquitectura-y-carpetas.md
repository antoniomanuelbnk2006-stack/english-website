# Arquitectura y estructura de carpetas

> **Propósito:** cómo encajan las piezas, cómo fluyen los datos y dónde va cada archivo.
> **Relacionado:** [Stack](01-stack.md) · [Base de datos](03-base-de-datos.md) · [Modelo de contenido](04-modelo-de-contenido.md) · [Convenciones](../06-desarrollo/02-convenciones.md)

---

## 1. Vista general

```
                         ┌───────────────────────────── TU ORDENADOR ─────────────────────────────┐
                         │  Pipeline de contenido (scripts/content, Node + ffmpeg)                │
                         │   specs YAML ─▶ Claude Batch (generar) ─▶ anotar (wink-nlp + listas)   │
                         │   ─▶ Claude Batch (revisar) ─▶ Azure TTS ─▶ ffmpeg ─▶ subir a R2        │
                         │   ─▶ content/*.json (git commit) ─────────────────────────────┐         │
                         └───────────────────────────────────────────────────────────────┼─────────┘
                                                                                         │ git push
┌──────────────── NAVEGADOR / PWA ───────────────┐      ┌──────────── VERCEL ────────────▼──────────┐
│ React 19 (RSC + islas cliente)                 │ HTTPS│ Next.js 16                                 │
│  · Reproductor (HTMLAudioElement + Zustand)    │◀────▶│  · proxy.ts: sesión Supabase + email OK   │
│  · Lector, tareas, SRS (ts-fsrs en cliente)    │      │  · RSC: páginas + lectura de content/      │
│  · Service worker (Serwist): shell + audio     │      │  · Server Actions: progreso, SRS, léxico   │
│  · IndexedDB: cola sin conexión                │      │  · Route Handler: /api/ai/writing-feedback │
└───────┬───────────────────────────┬────────────┘      └───────┬──────────────────────┬────────────┘
        │ audio (GET, caché)         │                           │ SQL (RLS como usuario)│ HTTPS
        ▼                            │                           ▼                       ▼
┌────────────────┐                   │                 ┌───────────────────┐   ┌──────────────────┐
│ Cloudflare R2  │                   └────────────────▶│ Supabase          │   │ Claude API       │
│ audio/*.m4a    │      (Auth OTP desde el navegador)  │ Auth · Postgres   │   │ (solo writing en │
│ (lectura pública)                                    │ RLS en todo       │   │  tiempo real)    │
└────────────────┘                                     └───────────────────┘   └──────────────────┘
```

---

## 2. Principios

1. **Contenido como código.** Las lecciones son JSON versionado en `content/`; la base de datos solo guarda **lo que haces tú** (progreso, léxico, repasos). Ver [ADR-0003](../adr/0003-contenido-como-codigo.md).
2. **Servidor primero.** Server Components por defecto; componentes cliente solo donde hay interacción (reproductor, lector, tareas, repaso).
3. **Lógica pura aparte.** Todo lo que calcula (Elo, plan diario, dictado, cobertura, XP, rachas) vive en `lib/` sin dependencias de red ni de React → tests unitarios rápidos.
4. **Zod en todas las fronteras.** Entradas de Server Actions y Route Handlers, contenido, variables de entorno y respuestas de la IA.
5. **Seguridad en capas.** RLS en todas las tablas **y** comprobación de sesión/email en `proxy.ts` y en cada acción. Ningún secreto en el cliente.
6. **Por funcionalidad.** El código se organiza por *feature* (`features/listening`, `features/srs`…), no por tipo de archivo.
7. **La IA no está en el camino crítico.** Si la API de Claude cae, todo funciona salvo el feedback de writing.

---

## 3. Estructura de carpetas

```
senal/
├── AGENTS.md                      # Bloque gestionado por Next.js (docs de la versión instalada) + reglas propias
├── CLAUDE.md                      # Instrucciones para Claude Code (importa AGENTS.md)
├── .claude/skills/crear-leccion/  # Skill del flujo de contenido
├── docs/                          # Esta documentación
├── content/
│   ├── lessons/{a1..c2}/{listening,reading}/{id}.json
│   ├── extensive/{a1..c2}/{serie}/{capitulo}.json
│   ├── grammar/{a1..c2}/{id}.mdx
│   ├── drills/{weak-forms,minimal-pairs,reductions,numbers,segmentation}/*.json
│   ├── writing/{a1..c2}/*.json    # consignas
│   ├── placement/*.json           # banco del test de nivel (no se reutiliza)
│   ├── tests/{nivel}/*.json       # banco de pruebas de confirmación
│   ├── specs/{nivel}/*.yaml       # especificaciones de generación
│   ├── wordlists/                 # CEFR-J, Octanove C1/C2, NGSL + LICENSES.md
│   └── index.generated.json       # índice (metadatos de todas las lecciones) — generado
├── scripts/
│   └── content/
│       ├── generate.ts            # specs → borradores (Claude Batch)
│       ├── annotate.ts            # tokens, lemas, POS, cobertura, legibilidad
│       ├── review.ts              # revisor de calidad (Claude Batch)
│       ├── tts.ts                 # Azure TTS + tiempos por palabra
│       ├── audio.ts               # ffmpeg: unir, normalizar, codificar, picos
│       ├── upload.ts              # subida a R2
│       ├── validate.ts            # Zod + invariantes de todo content/
│       ├── build-index.ts         # genera index.generated.json
│       └── lib/                   # cliente Claude, proveedor TTS, NLP, utilidades
├── supabase/
│   ├── config.toml
│   ├── migrations/                # 0001_base.sql, 0002_…
│   └── seed.sql
├── src/
│   ├── app/
│   │   ├── layout.tsx             # <html lang="es" data-theme>, fuentes, providers
│   │   ├── manifest.ts            # Manifiesto PWA
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/layout.tsx       # Shell autenticado (navegación)
│   │   ├── (app)/hoy/page.tsx
│   │   ├── (app)/escuchar/page.tsx
│   │   ├── (app)/escuchar/[id]/page.tsx
│   │   ├── (app)/leer/page.tsx
│   │   ├── (app)/leer/[id]/page.tsx
│   │   ├── (app)/repasar/page.tsx
│   │   ├── (app)/vocabulario/page.tsx
│   │   ├── (app)/gramatica/[[...id]]/page.tsx
│   │   ├── (app)/entrenar/[drill]/page.tsx
│   │   ├── (app)/escribir/[[...id]]/page.tsx
│   │   ├── (app)/progreso/page.tsx
│   │   ├── (app)/nivel/…
│   │   ├── (app)/diario/page.tsx
│   │   ├── (app)/ajustes/page.tsx
│   │   ├── offline/[id]/page.tsx  # Reproductor 100 % cliente para lecciones descargadas
│   │   ├── studio/…               # Solo desarrollo (404 en producción)
│   │   └── api/
│   │       ├── ai/writing-feedback/route.ts
│   │       └── lessons/[id]/download/route.ts   # JSON de la lección para guardarla sin conexión
│   ├── features/
│   │   ├── listening/  { components/, server/, lib/ }   # reproductor, ciclo, dictado, drills
│   │   ├── reading/    { components/, server/, lib/ }   # lector, ppm, glosario
│   │   ├── tasks/      { components/, lib/ }            # renderizado y corrección de tareas
│   │   ├── srs/        { components/, server/, lib/ }   # ts-fsrs, cosecha, sesión de repaso
│   │   ├── lexicon/    { server/, lib/ }                # estados, cobertura
│   │   ├── plan/       { components/, server/, lib/ }   # motor del plan diario
│   │   ├── level/      { components/, server/, lib/ }   # Elo, test, confirmación
│   │   ├── progress/   { components/, server/ }
│   │   ├── writing/    { components/, server/, lib/ }
│   │   ├── journal/    { components/, server/ }         # diario de input
│   │   └── gamification/ { lib/, server/ }              # XP, racha, logros
│   ├── lib/
│   │   ├── supabase/   { client.ts, server.ts, proxy.ts, database.types.ts }
│   │   ├── content/    { schema.ts, loader.ts, index.ts }
│   │   ├── ai/         { client.ts, writing-feedback.ts, prompts/ }
│   │   ├── audio/      { store.ts, media-session.ts, segments.ts }
│   │   ├── offline/    { queue.ts, sync.ts }
│   │   ├── i18n/       { es.ts, en.ts, index.ts }
│   │   ├── env.ts      # Variables de entorno validadas con Zod
│   │   └── utils.ts
│   ├── components/ui/  # shadcn/ui
│   └── styles/globals.css
├── tests/e2e/          # Playwright
├── proxy.ts
├── next.config.ts
└── package.json
```

**Convención dentro de cada *feature*:**
- `components/` → componentes de React (cliente o servidor).
- `server/` → Server Actions (`actions.ts`, con `'use server'`) y consultas (`queries.ts`, con `import 'server-only'`).
- `lib/` → lógica pura + tests (`*.test.ts`) al lado.

---

## 4. Flujos de datos clave

### 4.1 Cargar una lección
1. `app/(app)/escuchar/[id]/page.tsx` (RSC) → `loadLesson(id)` lee `content/lessons/…/{id}.json` del sistema de archivos y lo valida con Zod (en desarrollo; en producción el contenido ya llega validado por CI).
2. Consulta `lesson_progress` del usuario (RLS).
3. Pasa al componente cliente la lección **sin la transcripción** si la fase guardada es < 3.
4. Al completar la fase 2, el cliente llama a `getTranscript(id)` (Server Action), que comprueba la fase en BD y devuelve la transcripción.

> **Ojo con Vercel:** como el contenido se lee con `fs` en tiempo de ejecución, hay que incluirlo en el *bundle* de las funciones: `outputFileTracingIncludes` en `next.config.ts` para `content/**/*.json`. El índice (`index.generated.json`) se importa directamente.

### 4.2 Responder una lección
1. El cliente corrige cada tarea localmente (las claves de respuesta van en la lección) y acumula los intentos con un `client_id` (UUID).
2. Al terminar cada fase, envía el lote a `submitAttempts(lessonId, attempts)`.
3. La acción valida con Zod, calcula los nuevos ratings con `lib/elo.ts` (puro) y llama a la función SQL `apply_lesson_attempts` (una transacción: inserta intentos con `on conflict do nothing`, actualiza ratings, progreso e historial).
4. Si no hay conexión, el lote va a la cola de IndexedDB y se reintenta al volver la conexión (idempotente por `client_id`).

### 4.3 Repaso SRS
1. `/repasar` (RSC) trae las tarjetas con `due <= now()` (máximo 200) y las nuevas permitidas hoy.
2. El cliente programa cada respuesta con `ts-fsrs` y envía `{card, log}` en lotes de 10 a `submitReviews`.
3. El servidor **vuelve a calcular** el estado con `ts-fsrs` a partir del estado guardado y la valoración (no confía en el cálculo del cliente) y guarda tarjeta + registro.

### 4.4 Feedback de writing
`POST /api/ai/writing-feedback` → sesión y email permitido → límites (diario y mensual) → Claude con salida estructurada → validación Zod → `writing_submissions` → respuesta. Detalle en [IA](06-ia.md).

---

## 5. Renderizado y caché

- Páginas de biblioteca: RSC que leen el índice (barato) + datos del usuario en `<Suspense>`.
- Sin `cacheComponents` en v1 (todo dinámico por defecto en Next 16). Cuando el contenido crezca, activar *Cache Components* y marcar los lectores de contenido con `"use cache"`.
- Audio: URLs **versionadas e inmutables** (`…/v{n}.m4a`) servidas desde R2 con `Cache-Control: public, max-age=31536000, immutable`.

---

## 6. Entornos

| Entorno | Supabase | Audio | IA |
|---|---|---|---|
| Local | `supabase start` (Docker) | R2 real (prefijo `dev/`) o ficheros en `public/dev-audio/` | Clave real con tope bajo |
| Producción | Proyecto Supabase Free (región UE) | R2 `audio/` | Clave real con tope |

Detalle en [Entornos y despliegue](../06-desarrollo/04-entornos-y-despliegue.md).
