# Stack tecnológico

> **Propósito:** qué tecnologías usa Señal, en qué versión y por qué. Las decisiones importantes tienen su [ADR](../adr/README.md).
> **Verificado:** octubre de 2026. Antes de instalar, comprueba la última versión estable de cada paquete.

---

## 1. Tabla general

| Capa | Tecnología | Versión | Por qué | ADR |
|---|---|---|---|---|
| Runtime | Node.js | 22 LTS o 24 LTS (mínimo 20.9, exigido por Next 16) | LTS, soporte de Next 16 y de `ts-fsrs` (≥ 20) | — |
| Gestor de paquetes | pnpm | Última estable | Rápido, *lockfile* fiable, *workspaces* si algún día hay app nativa | — |
| Framework | **Next.js 16.x** (16.3 o superior) | App Router, Turbopack por defecto, `proxy.ts`, React 19.2 | Lo conoces, full-stack, Server Actions, buen soporte PWA y Vercel | [0001](../adr/0001-nextjs-app-router.md) |
| Lenguaje | TypeScript | 5.x, `strict` | Tipos de extremo a extremo con Zod y tipos generados de Supabase | — |
| Estilos | **Tailwind CSS v4** + **shadcn/ui** | v4 (configuración en CSS) | Tokens semánticos con `@theme inline`; componentes accesibles (Radix) | — |
| Iconos | lucide-react | — | Coherentes, ligeros | — |
| Fuentes | `next/font` | Geist, Geist Mono, Literata (OFL) | Sin peticiones a terceros en tiempo de ejecución | — |
| Validación | **Zod** | v4 | Esquemas de contenido, entradas de acciones, variables de entorno, salidas de IA | — |
| BD + Auth | **Supabase** | Postgres + Auth (OTP por email) + RLS | Capa gratuita suficiente, RLS, CLI con migraciones y tipos | [0002](../adr/0002-supabase-db-auth.md) |
| Cliente Supabase | `@supabase/supabase-js` + `@supabase/ssr` | Claves **publishable / secret** (las `anon`/`service_role` heredadas se retiran a finales de 2026) | Sesión por cookies en App Router | [0002](../adr/0002-supabase-db-auth.md) |
| Contenido | JSON + MDX en el repo (`content/`) | — | Versionado, revisable en *diffs*, sin coste de BD | [0003](../adr/0003-contenido-como-codigo.md) |
| Audio | **Cloudflare R2** | API S3 (`@aws-sdk/client-s3` en scripts) | 10 GB gratis y **sin coste de salida** (ideal para audio) | [0004](../adr/0004-audio-en-r2.md) |
| TTS | **Azure AI Speech** (`microsoft-cognitiveservices-speech-sdk`) | Capa F0: 0,5 M caracteres/mes en voces neuronales | Muchos acentos de inglés, SSML, eventos *word boundary* para el karaoke | [0005](../adr/0005-tts-azure-con-abstraccion.md) |
| TTS alternativo | Kokoro (Apache 2.0, local) | — | Coste cero sin límite si se agota la capa gratuita (menos acentos) | [0005](../adr/0005-tts-azure-con-abstraccion.md) |
| Procesado de audio | ffmpeg | — | Unir segmentos, normalizar sonoridad, codificar AAC, picos de onda | — |
| PLN (scripts) | wink-nlp + modelo `wink-eng-lite-web-model` | — | Tokenización, lemas y POS en TypeScript (spaCy como alternativa si falta precisión) | — |
| SRS | **ts-fsrs** | FSRS-6 | Algoritmo de referencia, TypeScript, optimizable | [0006](../adr/0006-fsrs-para-repaso.md) |
| IA | **Claude API** (`@anthropic-ai/sdk`) | `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5` | Salidas estructuradas con Zod, Batch API −50 %, *prompt caching* | [0007](../adr/0007-ia-pregenerada-y-correccion.md) |
| Estado en cliente | React + Zustand (solo reproductor y sesión de lección) | — | El resto es RSC + Server Actions | — |
| Gráficas | Recharts | Compatible con React 19 | Sencilla para las gráficas de progreso | — |
| Fechas | date-fns + `@date-fns/tz` | — | Días en Europe/Madrid para rachas y planes | — |
| Almacenamiento local | IndexedDB (`idb-keyval`) | — | Cola sin conexión y grabaciones de *shadowing* | — |
| PWA | **Serwist** (`@serwist/turbopack`) o *service worker* manual | — | Precaché, caché de audio con peticiones por rango | [0008](../adr/0008-pwa-antes-que-app-nativa.md) |
| Tests | Vitest + Testing Library + Playwright + `@axe-core/playwright` | — | Unitarios (lógica pura), componentes, e2e y accesibilidad | — |
| Calidad | ESLint 9 (*flat config*) + Prettier | — | `next lint` ya no existe en Next 16: se usa ESLint directamente | — |
| CI | GitHub Actions | — | *Typecheck*, lint, tests, build, validación de contenido | — |
| Hosting | **Vercel Hobby** | — | Gratis para uso personal no comercial; despliegue con `git push` | — |
| Errores (opcional) | Sentry (plan gratuito) | — | Trazas de errores con PII filtrada | — |

---

## 2. Novedades de Next.js 16 que afectan al proyecto

| Cambio | Implicación |
|---|---|
| `middleware.ts` → **`proxy.ts`** (función `proxy`, runtime Node) | El refresco de sesión de Supabase y la lista de emails permitidos van en `proxy.ts` |
| **Turbopack** por defecto en `dev` y `build` | Las librerías de PWA deben ser compatibles (Serwist tiene variante para Turbopack) |
| `params`, `searchParams`, `cookies()`, `headers()` **asíncronos** | Siempre `await` |
| `next lint` eliminado | Scripts `lint` con `eslint .` |
| *Cache Components* opcional (`cacheComponents: true`, `"use cache"`) | Empezar **sin** activarlo; valorarlo cuando haya mucho contenido |
| React Compiler estable (opcional, `reactCompiler: true`) | Activarlo tras medir el tiempo de build |
| Documentación de la versión instalada en `node_modules/next/dist/docs/` + `AGENTS.md` gestionado | Claude Code consulta la doc correcta; `CLAUDE.md` importa `AGENTS.md` |

---

## 3. Modelos de IA y para qué

| Modelo | ID | Uso en Señal | Esfuerzo (`output_config.effort`) |
|---|---|---|---|
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | Generar lecciones (Batch) · feedback de writing (en vivo) | `high` para generar; `medium` para feedback (latencia) |
| Claude Opus 5.5 | `claude-opus-5-5` | Revisor de calidad independiente (Batch) | `high` |
| Claude Haiku 5.5 | `claude-haiku-5-5` | Tareas baratas: clasificar, glosarios masivos, pseudopalabras | `low`/`medium` |

Precios de referencia (por millón de tokens): Sonnet 5.5 2 $ entrada / 10 $ salida; Opus 5.5 4 $ / 20 $; Haiku 5.5 desde 0,10 $ / 0,50 $. Batch API: −50 %. Detalle y costes por lección en [IA](06-ia.md).

---

## 4. Coste mensual esperado

| Servicio | Capa | Coste |
|---|---|---|
| Vercel | Hobby | 0 € |
| Supabase | Free (500 MB BD, 1 GB ficheros, 5 GB salida; pausa tras 7 días sin uso) | 0 € |
| Cloudflare R2 | 10 GB, 1 M operaciones clase A, 10 M clase B, salida gratis | 0 € |
| Azure AI Speech | F0 (0,5 M caracteres TTS neuronal/mes; 5 h STT/mes) | 0 € |
| Claude API | Pago por uso con **tope** configurable (por defecto 5 $/mes en la app + límite de gasto en la consola) | 1–5 $ |
| Dominio (opcional) | — | ~10 €/año |

---

## 5. Lo que no usamos (y por qué)

| Alternativa | Motivo |
|---|---|
| ORM (Prisma/Drizzle) | Con Supabase, SQL versionado + tipos generados es más simple y nos da control total de RLS y funciones |
| React Query / SWR | RSC + Server Actions cubren la carga de datos; el estado de cliente es mínimo |
| next-intl | Dos idiomas de interfaz con diccionarios tipados bastan |
| Supabase Storage para audio | 1 GB y 5 GB de salida en la capa gratuita se quedan cortos; R2 no cobra la salida |
| Expo/React Native en v1 | La PWA cubre la escucha móvil; app nativa como posible fase futura ([ADR-0008](../adr/0008-pwa-antes-que-app-nativa.md)) |
