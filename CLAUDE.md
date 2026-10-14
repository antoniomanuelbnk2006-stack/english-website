# Señal — instrucciones para Claude Code

@AGENTS.md

## Qué es este proyecto

**Señal** es una web app personal (PWA) para aprender inglés de A1 a C2, centrada en **listening** y **reading**. La usa **una sola persona** (el dueño del repo, hispanohablante de España, nivel B1 al empezar). Toda la documentación está en `docs/`; el índice está en `README.md`.

**Hacia dónde va ([ADR-0032](docs/adr/0032-cinco-idiomas-para-todo-el-publico.md)):** cinco idiomas para practicar (español, inglés, francés, chino y japonés), para todo el público, por fases. La interfaz ya está en los cinco (`src/lib/i18n`): todo texto nuevo va en los cinco diccionarios. Lo que tenga coste, al final.

## Antes de escribir código

1. Mira en qué fase estamos en `docs/06-desarrollo/01-roadmap.md` y lee los documentos que cita esa fase.
2. Next.js 16 tiene cambios importantes respecto a versiones anteriores: **consulta `node_modules/next/dist/docs/`** (ver `AGENTS.md`) antes de usar cualquier API de Next (`proxy.ts`, APIs de petición asíncronas, caché…).
3. Si una petición contradice `docs/`, **pregunta** antes de seguir. Si cambias una decisión, crea un ADR en `docs/adr/`.
4. Propón un plan corto antes de cambios grandes y trabaja en pasos pequeños con tests en verde.

## Diseño: cómo trabajan juntos MASTER.md y UI UX Pro Max

Hay **una sola fuente de verdad visual**: `design-system/senal/MASTER.md`, implementada en `src/styles/globals.css`.
UI UX Pro Max se usa como **consultor de UX**, nunca como generador de estilo.

### Antes de crear o cambiar cualquier pantalla
1. Lee `design-system/senal/MASTER.md`.
2. Si existe `design-system/senal/pages/<pantalla>.md`, léelo: sus reglas mandan sobre MASTER.
3. Si la pantalla toca algo de UX que MASTER no cubre (tablas, modales, drag & drop, gráficos…), consulta la skill (si está instalada en `.claude/skills/ui-ux-pro-max/`):
   ```bash
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<tema>" --domain ux
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<tema>" --stack nextjs
   python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<gráfico>" --domain chart
   ```
   Aplica la regla con los tokens de Señal. Si es una regla general útil, añádela a la sección 7 de MASTER.md.
4. Construye con las clases y tokens de `src/styles/globals.css`. Ningún hex suelto en componentes.
5. Pasa el checklist de la sección 9 de MASTER.md antes de dar la pantalla por terminada.

### Prohibido con UI UX Pro Max
- **No** ejecutes `--design-system` ni `--persist`: proponen otro estilo (claymorphism, Baloo, Comic Neue…) y sobrescribirían MASTER.md.
- **No** uses las búsquedas `--domain style`, `color` o `typography` para decidir el aspecto. El aspecto ya está decidido.
- Si una recomendación de la skill choca con MASTER.md, gana MASTER.md.

### Pantalla nueva sin override
Si una pantalla necesita reglas propias, crea `design-system/senal/pages/<pantalla>.md` con **solo** lo que se aparta de MASTER (ver los existentes como ejemplo).

### En este repo
- Fuentes vía `next/font` (ya en `src/app/layout.tsx`). Iconos: `lucide-react`, 20 px, `aria-hidden` si son decorativos.
- Anchos y ritmo: `PageContainer` (`page` = 1.200 px, `exercise` = columna de 680 px) y `PageSections` (72 px entre secciones), en `src/components/ui/page.tsx`.
- La portada (`public/landing`) es HTML estático: repite los tokens en `public/landing/styles.css` y sirve las fuentes desde `/landing/fonts`. Si cambias un token en `globals.css`, cámbialo también allí (`src/styles/contrast.test.ts` falla si no coinciden).
- Los temas claro y «papel» son paletas derivadas (`design-system/senal/pages/ajustes.md`): cualquier token nuevo tiene que existir en todos los temas.

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19.2 · TypeScript estricto · Tailwind CSS v4 + shadcn/ui · Zod v4 · Supabase (Postgres + Auth OTP + RLS, claves publishable/secret, `@supabase/ssr`) · Cloudflare R2 (audio) · Azure AI Speech (TTS, solo en el pipeline) · ts-fsrs (FSRS-6) · Claude API (`claude-sonnet-5-5`, `claude-opus-5-5`, `claude-haiku-5-5`) · Zustand (solo reproductor) · Vitest + Testing Library + Playwright + axe · Vercel Hobby.

## Comandos

| Tarea | Comando |
|---|---|
| Desarrollo | `pnpm dev` |
| Comprobaciones | `pnpm typecheck && pnpm lint && pnpm test` |
| e2e | `pnpm e2e` (requiere `pnpm db:start`) |
| BD local | `pnpm db:start`, `pnpm db:reset`, `pnpm db:types` |
| Contenido | `pnpm content:validate`, `content:annotate`, `content:tts`, `content:audio`, `content:exam-audio`, `content:upload`, `content:index`, `content:generate`, `content:review`, `content:run` |
| Evaluación de prompts | `pnpm ai:eval` (cuesta dinero: solo si se pide) |

## Estructura

- `src/app/` rutas (UI en español: `/hoy`, `/escuchar`, `/leer`, `/repasar`, …). `src/app/studio/` solo en desarrollo.
- `src/features/<feature>/{components,server,lib}`: `server/actions.ts` (Server Actions), `server/queries.ts` (`server-only`), `lib/` = **lógica pura con tests al lado**.
- `src/lib/`: `supabase/`, `content/` (esquemas Zod del contenido), `ai/`, `audio/`, `offline/`, `i18n/`, `env.ts`, `dates.ts`.
- `content/`: lecciones JSON, fichas MDX, drills, bancos de test, especificaciones YAML, listas de palabras. **Fuente de verdad del contenido.**
- `scripts/content/`: pipeline (se ejecuta en local, nunca en Vercel).
- `supabase/migrations/`: SQL versionado.

## Reglas estrictas

**NUNCA**
1. Exponer `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, claves de Azure o de R2 al cliente o al repo.
2. Usar la clave *secret* de Supabase en el código de la app (todo va como el usuario autenticado, con RLS).
3. Crear una tabla sin `user_id`, RLS y política en la misma migración; editar una migración ya aplicada.
4. Enviar al cliente la transcripción de una lección de escucha antes de la fase 3 del ciclo, salvo que el usuario elija el modo «con transcripción» y quede anotado en `lesson_progress.transcript_first` ([ADR-0013](docs/adr/0013-escucha-con-transcripcion.md)).
5. Calcular XP por clics o por rapidez; solo por tiempo activo.
6. Llamar a la IA desde el cliente o saltarse los límites diario y mensual.
7. Meter contenido con derechos de terceros en `content/`; *commitear* audio (`*.m4a`, `*.wav`, `.audio-cache/`).
8. Usar `any`, colores *hex* en componentes o `new Date().toISOString().slice(0, 10)` para «el día».

**SIEMPRE**
1. Validar con Zod toda entrada externa (acciones, Route Handlers, contenido, respuestas de IA, variables de entorno).
2. Server Actions con la forma estándar: `(input: unknown) => Promise<ActionResult<T>>`, Zod → `requireUser()` → lógica → resultado.
3. Lógica de dominio (Elo, plan diario, dictado, cobertura, SRS, XP, rachas, corrección de tareas) **pura, determinista y con tests** en `lib/`.
4. Calcular días, rachas y límites en **Europe/Madrid** (`src/lib/dates.ts`).
5. Server Components por defecto; `'use client'` solo en hojas interactivas.
6. Textos de interfaz vía `src/lib/i18n/es.ts` y, con las mismas claves, `en.ts`, `fr.ts`, `zh.ts` y `ja.ts` (ADR-0032); contenido en inglés con `lang="en"`.
7. Accesibilidad: elementos interactivos reales, foco visible, todo usable con teclado.
8. **Mensajes de commit en inglés** (Conventional Commits): el dueño practica *writing* con ellos.
9. Las cookies las decide quien visita la web ([ADR-0028](docs/adr/0028-consentimiento-de-cookies.md)). Lo nuevo que se guarde en el navegador (cookie o almacenamiento local) se clasifica en `src/lib/consent.ts`: una preferencia solo se guarda si `preferencesAllowed()`. Y se añade a la política, `public/landing/cookies.html`.
10. Un dato personal nuevo que la web recoja, o un proveedor nuevo que lo trate, se cuenta en la política de privacidad, `public/landing/privacidad.html` ([ADR-0029](docs/adr/0029-politica-de-privacidad-y-datos-de-contacto.md)). En las páginas públicas no se publica más contacto del dueño que su nombre y su correo.

## Contenido

- Para crear, generar, revisar o publicar lecciones usa la skill **`crear-leccion`** (`.claude/skills/crear-leccion/`).
- El contrato es `src/lib/content/schema.ts` (= `docs/04-arquitectura/04-modelo-de-contenido.md`).
- Cambiar una lección publicada ⇒ subir `version`. `pnpm content:validate` antes de cada *commit* de contenido.

## Mapa de documentación

| Necesitas… | Lee |
|---|---|
| Visión y alcance | `docs/00-vision/01-vision-y-alcance.md` |
| Método de listening (ciclo, dictado, causas) | `docs/01-pedagogia/03-listening.md` |
| Reading, vocabulario/SRS, gramática, evaluación | `docs/01-pedagogia/` |
| Qué contenido va en cada nivel | `docs/02-curriculo/{A1..C2}.md` |
| Diseño visual (fuente de verdad) y lo propio de cada pantalla | `design-system/senal/MASTER.md`, `design-system/senal/pages/` |
| Pantallas, plan diario, gamificación, cómo se aplica el diseño | `docs/03-producto/` |
| Stack, carpetas, BD, contenido, audio, IA, seguridad, PWA | `docs/04-arquitectura/` |
| Pipeline, QA, licencias, prompts, ejemplos | `docs/05-contenido/` |
| Roadmap, convenciones, testing, despliegue, prompts por fase | `docs/06-desarrollo/` |
| Decisiones de arquitectura | `docs/adr/` |
