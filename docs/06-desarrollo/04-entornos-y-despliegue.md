# Entornos, configuración y despliegue

> **Propósito:** montar el proyecto desde cero, configurar cada servicio externo y desplegar.
> **Relacionado:** [Stack](../04-arquitectura/01-stack.md) · [Seguridad](../04-arquitectura/07-seguridad-y-privacidad.md) · [Roadmap · Fase 0](01-roadmap.md#fase-0--cimientos)

---

## 1. Requisitos en tu ordenador

| Herramienta | Para qué |
|---|---|
| Node.js 22 o 24 LTS | Next.js 16 y scripts |
| pnpm | Paquetes |
| Docker | Supabase local |
| ffmpeg | Pipeline de audio |
| Git + GitHub | Repositorio y CI |

---

## 2. Crear el proyecto

```bash
pnpm create next-app@latest senal
#   TypeScript: sí · ESLint: sí · Tailwind: sí · App Router: sí · carpeta src/: sí · alias @/*: sí
cd senal
pnpm dlx shadcn@latest init
pnpm add zod @supabase/supabase-js @supabase/ssr ts-fsrs zustand lucide-react date-fns @date-fns/tz idb-keyval server-only
pnpm add @anthropic-ai/sdk
pnpm add -D supabase vitest @vitejs/plugin-react @testing-library/react @testing-library/dom jsdom @playwright/test @axe-core/playwright prettier tsx
# Pipeline (solo scripts):
pnpm add -D microsoft-cognitiveservices-speech-sdk @aws-sdk/client-s3 wink-nlp wink-eng-lite-web-model yaml
```

Después:
1. Copia `docs/`, `CLAUDE.md` y `.claude/` de este paquete a la raíz del repo.
2. `create-next-app` ya crea `AGENTS.md` con un bloque gestionado que apunta a la documentación de la versión instalada (`node_modules/next/dist/docs/`); en Next.js 16.3+, `next dev` lo mantiene al día cuando detecta un agente como Claude Code. *Commitéalo* (y no borres ese bloque).
3. Crea `.env.local` y `.env.pipeline` a partir de `.env.example` (§8).

---

## 3. Supabase

1. Crea el proyecto en [supabase.com](https://supabase.com) en una **región de la UE**. Plan Free.
2. Local: `pnpm supabase init` → `pnpm supabase start` (Docker) → copia la URL y las claves *publishable*/*secret* locales que imprime.
3. Migraciones: crea `supabase/migrations/0001_base.sql` con el contenido de [Base de datos §2](../04-arquitectura/03-base-de-datos.md#2-migración-base) → `pnpm supabase db reset` (local).
4. Vincula y sube: `pnpm supabase link --project-ref <ref>` → `pnpm supabase db push`.
5. **Auth:**
   - Activa el proveedor **Email**.
   - **Longitud del código: 6** (`otp_length`; los proyectos nuevos vienen con 8).
   - En **Email Templates → Magic Link**, incluye el código: `Tu código de Señal: {{ .Token }}` (así el email trae el OTP de 6 dígitos). **En el plan Free esto solo se puede hacer con un SMTP propio**; sin él, el correo trae un enlace, que la app también acepta ([ADR-0018](../adr/0018-acceso-con-enlace-del-correo.md)).
   - **Redirect URLs:** añade `https://<tu-dominio>/auth/confirm` (y `http://localhost:3000/auth/confirm`), que es adonde vuelve ese enlace, y pon tu dominio como *Site URL*.
   - Crea tu usuario en **Authentication → Users → Add user** (la app nunca crea usuarios).
   - **Desactiva el registro de nuevos usuarios**.
   - Sin SMTP propio, Supabase solo envía correos a las direcciones de los miembros de la organización, y como mucho dos por hora: el email permitido tiene que ser el de tu cuenta de Supabase.
   - **Contraseña (opcional, [ADR-0026](../adr/0026-contrasena-en-vez-de-codigo-fijo.md)):** genera un secreto largo, ponlo como `LOGIN_CODE_PEPPER` en Vercel y en `.env.pipeline`, y pon la contraseña en Ajustes → Contraseña justo después de entrar con el correo ([ADR-0031](../adr/0031-contrasena-desde-la-web.md)). Desde el ordenador también vale `pnpm auth:set-password`: te pide la contraseña (12 caracteres o más) sin mostrarla. Con `--generate` crea una al azar y te la enseña una vez. No la pases como argumento: quedaría en el historial del terminal. Para quitarla, `pnpm auth:set-password --off`; no hay `--on`: como no se guarda, para volver a activarla se pone otra vez.
   - En el código, `signInWithOtp({ email, options: { shouldCreateUser: false } })` como segunda barrera.
6. **API keys:** usa las claves nuevas **publishable** (`sb_publishable_…`) y **secret** (`sb_secret_…`); las heredadas `anon`/`service_role` se retiran a finales de 2026.
7. Tipos: `pnpm db:types`.

> **Pausa por inactividad:** los proyectos Free se pausan tras 7 días sin actividad. Los datos no se pierden; se reactiva desde el panel. Si vas a estar fuera, considera exportar tus datos antes.

---

## 4. Cloudflare R2 (audio)

> **Hoy el audio no está en R2, sino en el Storage del proyecto de Supabase** ([ADR-0019](../adr/0019-audio-en-supabase-storage.md)): `pnpm content:upload --ids <ids> --supabase` con `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en `.env.pipeline`, y `NEXT_PUBLIC_AUDIO_BASE_URL=https://<ref>.supabase.co/storage/v1/object/public/senal-audio`. No hace falta configurar CORS ni dominio. Lo que sigue vale si algún día se pasa a R2.

1. Crea el *bucket* `senal-audio` con *location hint* en Europa.
2. **Acceso público de lectura:**
   - Con dominio propio en Cloudflare: conecta `audio.tu-dominio.dev` al *bucket* (recomendado).
   - Sin dominio: habilita el subdominio `r2.dev` (pensado para desarrollo y con límites; suficiente para uso personal).
3. **CORS** del *bucket*:

```json
[
  {
    "AllowedOrigins": ["https://tu-app.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "Content-Length", "ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

4. Crea un **token de API** con permisos de lectura/escritura **solo para ese *bucket*** → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` en `.env.pipeline`.

---

## 5. Azure AI Speech (TTS)

1. En el portal de Azure crea un recurso **Speech** con plan **Free (F0)** en una región europea (p. ej., West Europe). Normalmente solo se permite un recurso F0 de este tipo por suscripción.
2. Copia la **clave** y la **región** a `.env.pipeline`.
3. Límite gratuito: **0,5 M caracteres/mes** de voces neuronales estándar (las voces HD no entran en la capa gratuita). El pipeline lleva la cuenta y avisa al 80 %.

---

## 6. Claude API

1. Crea una clave en la consola de Claude.
2. Configura un **límite de gasto mensual** en la consola (segunda barrera además del tope de la app).
3. `ANTHROPIC_API_KEY` en Vercel (para el writing) y en `.env.pipeline` (para generar contenido). Puedes usar **dos claves distintas** para separar costes.

---

## 7. Vercel

1. Importa el repo de GitHub (plan **Hobby**: uso personal y no comercial).
2. Variables de entorno de producción (§8, solo las de la app).
3. Región de funciones cercana a tu proyecto de Supabase: está fijada en `vercel.json` (`cdg1`, París, junto al proyecto de Supabase en `eu-west-3`).
4. Cada *push* a `main` despliega; cada PR genera una *preview*.
5. Añade el dominio de producción a `AllowedOrigins` del CORS de R2 y a las *Redirect URLs* de Supabase Auth.
6. **Una sola dirección ([ADR-0021](../adr/0021-una-sola-direccion-y-codigo-fijo-primero.md)):** pon la dirección pública de la web como `SITE_URL` en las variables de producción. Vercel deja a cada despliegue una dirección propia, congelada en esa versión; con `SITE_URL`, todas redirigen a la buena. Si cambias de dominio, cámbiala también, y abre la web después: un valor equivocado manda toda la web a otro sitio.

---

## 8. Variables de entorno

`.env.example`:

```bash
# ── App (Vercel + .env.local) ──────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_AUDIO_BASE_URL=https://audio.tu-dominio.dev
ALLOWED_EMAIL=tu-email@ejemplo.com
# En producción: la dirección pública de la web. Lo que llegue por otro nombre (un despliegue
# antiguo de Vercel, un alias) se redirige a ella (ADR-0021). En local se deja sin poner.
# SITE_URL=https://tu-dominio.dev
# Opcional: activa el acceso con contraseña (ADR-0026). 32 caracteres al azar o más;
# el mismo valor en .env.pipeline para `pnpm auth:set-password`.
# LOGIN_CODE_PEPPER=
ANTHROPIC_API_KEY=
AI_WRITING_MODEL=claude-sonnet-5-5
AI_DAILY_LIMIT=10
AI_MONTHLY_BUDGET_USD=5
# ANTHROPIC_BASE_URL=   (solo para tests o un proxy propio)
# DICTIONARY_API_URL=   (solo para tests; por defecto, https://en.wiktionary.org)

# ── Pipeline (.env.pipeline, SOLO en tu ordenador) ─────────
SUPABASE_SECRET_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=westeurope
TTS_PROVIDER=azure
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=senal-audio
# Audio en el Storage de Supabase (pnpm content:upload --supabase, ADR-0019):
SUPABASE_URL=
SUPABASE_AUDIO_BUCKET=senal-audio
AI_GEN_MODEL=claude-sonnet-5-5
AI_REVIEW_MODEL=claude-opus-5-5
AI_CHEAP_MODEL=claude-haiku-5-5
```

---

## 9. Scripts de `package.json`

| Script | Comando |
|---|---|
| `dev` | `next dev` |
| `build` / `start` | `next build` / `next start` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `format` | `prettier --write .` |
| `test` | `vitest run` |
| `e2e` | `playwright test` |
| `demo` | `tsx scripts/demo.ts`: la app compilada contra el emulador de Supabase, sin cuentas ni claves (ver abajo) |
| `db:start` / `db:reset` / `db:push` | `supabase start` / `supabase db reset` / `supabase db push` |
| `db:types` | `supabase gen types typescript --local > src/lib/supabase/database.types.ts` |
| `db:backup` | `supabase db dump --data-only -f ../senal-backups/$(date +%F).sql` |
| `content:*` | `tsx --env-file=.env.pipeline scripts/content/<script>.ts` |
| `ai:eval` | `tsx --env-file=.env.pipeline scripts/ai/eval.ts` |
| `studio` | `next dev` (Studio solo existe en desarrollo) |

### Demostración local (`pnpm demo`)

Para probar la app sin crear nada en la nube: compila, arranca el emulador de Supabase de los tests ([ADR-0011](../adr/0011-e2e-con-emulador-de-supabase.md)) y sirve la app en `http://localhost:3000` con el contenido real de `content/` y el audio local de `public/dev-audio/`. Se entra con `owner@example.invalid` y el código `123456`.

- Los datos (nivel, progreso, repaso, diario) se guardan en `.demo-data/` y **siguen ahí al volver a arrancar**, igual que la sesión del navegador. `pnpm demo --reset` los borra y empieza de cero.
- Si la carpeta guardada no se puede abrir, el emulador la aparta (`.demo-data.rota-…`) y arranca vacío en vez de fallar.
- Con datos guardados, las rutas de control del emulador (`/__test/…`) están desactivadas: un test que se conecte por error a la demo falla, no borra nada. Los tests e2e usan otros puertos y otra carpeta de compilación (`.next-e2e`), así que se pueden lanzar con la demo abierta.
- **Corrección de writing con IA en la demo:** crea `.env.local` con una sola línea, `ANTHROPIC_API_KEY=…`, y vuelve a arrancar. Sin clave, el writing funciona con la revisión sin IA.
- No es un entorno de uso real: un único usuario, en este ordenador y sin copias de seguridad. Para eso están las secciones 3 a 8.

---

## 10. `.gitignore` (añadidos)

```gitignore
.env*
!.env.example
.audio-cache/
*.m4a
*.wav
content/.batches/
/public/dev-audio/
/.e2e/
/.demo-data*/
/.next-e2e/
```

---

## 11. Flujo de despliegue

```
rama feat/… → PR → CI (check + e2e) → squash merge a main → Vercel despliega producción
                                         └─ si hay migración: pnpm supabase db push ANTES del merge
```

Orden con migraciones: **primero** la migración (compatible hacia atrás), **después** el código que la usa.
