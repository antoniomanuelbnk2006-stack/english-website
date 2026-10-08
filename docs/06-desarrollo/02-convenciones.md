# Convenciones de código y reglas del proyecto

> **Propósito:** cómo se escribe el código de Señal para que tú (y Claude Code) lo mantengáis coherente. Las **reglas estrictas** del final no se negocian.
> **Relacionado:** [Arquitectura y carpetas](../04-arquitectura/02-arquitectura-y-carpetas.md) · [Testing](03-testing-y-calidad.md) · [CLAUDE.md](../../CLAUDE.md)

---

## 1. Idioma

| Qué | Idioma |
|---|---|
| Identificadores (variables, funciones, tipos, tablas, columnas) | Inglés |
| Textos de la interfaz | Español, vía diccionario i18n (`src/lib/i18n/es.ts`) |
| Comentarios y documentación | Español |
| Contenido de aprendizaje | Inglés (con `lang="en"`) |
| Mensajes de *commit* | **Inglés** (es práctica diaria de *writing* breve): `feat(listening): add dictation alignment` |

---

## 2. TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- **Prohibido `any`.** Lo desconocido es `unknown` y se valida con Zod.
- Sin `!` (aserción de no nulo) salvo en tests.
- Tipos derivados de los esquemas: `type Lesson = z.infer<typeof Lesson>`; nunca duplicar a mano.
- Tipos de BD: los generados por Supabase (`database.types.ts`), nunca escritos a mano.
- Funciones puras con dependencias inyectadas (`now: Date`, `random: () => number`) para que sean testeables y deterministas.

---

## 3. Archivos y nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` | `audio-player.tsx`, `build-daily-plan.ts` |
| Componentes | `PascalCase` (export con nombre) | `export function AudioPlayer()` |
| Hooks | `use-*.ts` / `useX` | `use-karaoke.ts` |
| Tests | Junto al archivo: `*.test.ts(x)`; e2e en `tests/e2e/` | `dictation.test.ts` |
| Esquemas Zod | `PascalCase` sin sufijo | `LessonDraft`, `WritingFeedback` |
| Server Actions | Verbo + objeto | `submitAttempts`, `reviewCard`, `logInput` |
| Tablas y columnas SQL | `snake_case` | `lesson_progress.best_score` |
| Variables de entorno | `SCREAMING_SNAKE_CASE` | `AI_DAILY_LIMIT` |

- **Exports con nombre** siempre; `export default` solo donde Next.js lo exige (`page.tsx`, `layout.tsx`, `manifest.ts`…).
- Alias `@/` → `src/`. Sin *barrels* (`index.ts` que re-exportan todo) dentro de `features/`.

---

## 4. Servidor y cliente

- **Server Components por defecto.** `'use client'` solo en hojas interactivas (reproductor, lector, tareas, repaso).
- Los componentes cliente **no consultan la BD**: reciben datos por *props* o llaman a Server Actions.
- `features/*/server/queries.ts` empieza con `import 'server-only'`.
- Ninguna variable sin prefijo `NEXT_PUBLIC_` puede llegar al cliente (lo garantiza `env.ts`).

### Server Actions: forma estándar

```ts
// src/lib/actions.ts
export type ActionError = 'unauthorized' | 'invalid_input' | 'not_found' | 'conflict' | 'rate_limited' | 'internal';
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError; message?: string };
```

```ts
// src/features/journal/server/actions.ts
'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import type { ActionResult } from '@/lib/actions';

const LogInput = z.object({
  kind: z.enum(['extensive_listening', 'extensive_reading']),
  minutes: z.number().positive().max(600),
  title: z.string().max(200).optional(),
  url: z.string().url().optional(),
  clientId: z.string().uuid(),
});

export async function logInput(input: unknown): Promise<ActionResult<{ id: number }>> {
  const parsed = LogInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const auth = await requireUser();            // sesión + email permitido
  if (!auth.ok) return auth;

  // … insert con el cliente de Supabase del usuario (RLS) …
  return { ok: true, data: { id: 1 } };
}
```

1. Validar entrada con Zod (siempre `unknown` de entrada).
2. `requireUser()`.
3. Lógica (pura, en `lib/`) + persistencia.
4. Devolver `ActionResult`; los errores **esperados** no se lanzan.

---

## 5. Datos y fechas

- Timestamps en BD como `timestamptz` (UTC).
- El «día» del usuario (rachas, plan, límites) se calcula **siempre** en `Europe/Madrid` con `src/lib/dates.ts` (`todayMadrid()`, `startOfTodayMadrid()`…). Prohibido `new Date().toISOString().slice(0, 10)` para eso.
- Lógica de dominio en TypeScript; SQL solo para persistir de forma atómica y para agregados.

---

## 6. Estilos y componentes

- Solo **tokens semánticos** de Tailwind (`bg-surface`, `text-muted`, `text-accent`); nunca colores *hex* en componentes.
- Variantes con `cva` (como shadcn/ui) y `cn()` para combinar clases.
- Componentes de shadcn/ui en `src/components/ui/` sin modificar su API pública; los propios, en su *feature*.
- Cada elemento interactivo es un `<button>` o `<a>` real, con etiqueta accesible.

---

## 7. Contenido

- Nunca editar `content/index.generated.json` a mano.
- Cambiar una lección publicada ⇒ **subir `version`**.
- **Nunca** *commitear* audio (`*.m4a`, `*.wav`) ni `.audio-cache/` (están en `.gitignore`).
- Toda lección nueva pasa `pnpm content:validate` antes del *commit*.

---

## 8. Git

- *Trunk-based*: ramas cortas (`feat/…`, `fix/…`, `content/…`), PR a `main` aunque trabajes solo (para que corra la CI), *squash merge*.
- Conventional Commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `content` (lecciones).
- `main` protegida: requiere CI verde.

---

## 9. Reglas estrictas

**NUNCA**
1. Exponer `ANTHROPIC_API_KEY`, `SUPABASE_SECRET_KEY`, claves de Azure o de R2 al cliente o al repo.
2. Usar la clave *secret* de Supabase en el código de la app.
3. Crear una tabla sin `user_id`, RLS y política en la misma migración.
4. Mostrar la transcripción de una lección de escucha antes de la fase 3 (salvo lecciones descargadas, ocultas en la UI, y salvo que el usuario elija el modo «con transcripción», que queda anotado: [ADR-0013](../adr/0013-escucha-con-transcripcion.md)).
5. Calcular XP por clics o por respuestas rápidas.
6. Llamar a la IA en el cliente o fuera de los límites diario/mensual.
7. Meter contenido con derechos de terceros en `content/`.
8. Editar una migración ya aplicada en producción.

**SIEMPRE**
1. Validar con Zod toda entrada externa (formularios, acciones, contenido, respuestas de IA, variables de entorno).
2. Escribir tests para la lógica pura nueva (Elo, plan, dictado, cobertura, XP, rachas, corrección de tareas).
3. Mantener las funciones de `lib/` puras y deterministas.
4. Calcular días en `Europe/Madrid`.
5. Usar tokens semánticos y comprobar contraste.
6. Actualizar la documentación (y un ADR si cambias una decisión).
