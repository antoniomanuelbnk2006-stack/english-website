# Testing y calidad

> **Propósito:** qué se prueba, con qué herramienta y cómo corre en CI.
> **Relacionado:** [Convenciones](02-convenciones.md) · [Roadmap](01-roadmap.md) · [Control de calidad del contenido](../05-contenido/02-control-de-calidad.md)

---

## 1. Pirámide

| Nivel | Herramienta | Qué cubre | Objetivo |
|---|---|---|---|
| Unitarios | **Vitest** | Lógica pura de `features/*/lib` y `src/lib` | ≥ 90 % de líneas en `lib/` |
| Componentes | Vitest + Testing Library (jsdom) | `TaskRenderer`, `DictationInput`, `ReviewCard`, `WordPopover` | Comportamiento, no estilos |
| Contenido | `content:validate` | Esquemas + invariantes de todo `content/` | 100 % (bloquea CI) |
| e2e | **Playwright** + Supabase local | Flujos críticos | 5–8 flujos estables |
| Accesibilidad | `@axe-core/playwright` | Pantallas principales | 0 violaciones serias/críticas |
| IA | `pnpm ai:eval` (manual) | Prompts y modelos | Umbrales de [IA §6](../04-arquitectura/06-ia.md#6-evaluación-de-prompts) |

---

## 2. Qué probar sí o sí (unitarios)

| Módulo | Casos clave |
|---|---|
| `listening/lib/dictation` | Equivalencias (*gonna* = *going to*, números, contracciones, UK/US), alineación con inserciones/omisiones, propuesta de causa (las 6), errores ortográficos leves |
| `tasks/lib/grade` | Cada tipo de tarea; huecos con variantes; mayúsculas/espacios; `matching` con distractores |
| `level/lib/elo` | Dirección del cambio, pesos por tipo, tope por lección, convergencia simulada |
| `plan/lib/build-daily-plan` | Los 6 casos de [Motor del plan §6](../03-producto/03-motor-del-plan-diario.md#6-tests-mínimos) |
| `lexicon/lib/coverage` | Exclusiones (nombres propios, números), palabras gramaticales, multipalabra |
| `srs/lib/scheduler` | Envoltorio de ts-fsrs: estados, límites diarios, valoración sugerida de audio |
| `gamification/lib` | Tiempo activo, XP, racha con comodines, cambio de día en Madrid (y horario de verano) |
| `lib/dates` | Medianoche en Madrid en los dos cambios de hora del año |

Ejemplo:

```ts
// src/features/listening/lib/dictation.test.ts
import { describe, expect, it } from 'vitest';
import { diagnose } from './dictation';

const known = new Set(['how', 'many', 'meteor', 'be', 'we', 'go', 'to', 'see']);

describe('diagnose', () => {
  it('acepta gonna como going to', () => {
    const r = diagnose({
      reference: 'How many meteors are we gonna see?',
      typed: 'how many meteors are we going to see',
      knownLemmas: known,
      features: ['reduction'],
    });
    expect(r.accuracy).toBe(1);
    expect(r.errors).toHaveLength(0);
  });

  it('propone not_recognized si falta una palabra conocida en un tramo con rasgo', () => {
    const r = diagnose({
      reference: 'How many meteors are we gonna see?',
      typed: 'how many meteors we going see',
      knownLemmas: known,
      features: ['reduction', 'weak_form'],
    });
    expect(r.errors.map((e) => e.cause)).toContain('not_recognized');
  });
});
```

---

## 3. e2e

**Entorno:** un **emulador de Supabase en memoria** (`tests/support/supabase-emulator.ts`: Postgres real con las migraciones del proyecto, más el subconjunto de Auth y PostgREST que usa la app) + `pnpm build && pnpm start` con variables de test. No hace falta Docker. El emulador acepta un código OTP fijo para el email de pruebas y expone `/__test/reset` y `/__test/query` para preparar y comprobar datos. Decisión y límites en [ADR-0011](../adr/0011-e2e-con-emulador-de-supabase.md). Los e2e usan sus propios puertos (app en 3100, emulador en 54398) y compilan en `.next-e2e` con `tsconfig.e2e.json`, así que se pueden lanzar con la demo (`pnpm demo`) abierta.

**IA:** la corrección de writing se prueba contra un **doble de la API de Claude** que sirve el propio emulador (`tests/support/anthropic-stub.ts`, en `/anthropic`). La app de los tests apunta ahí con `ANTHROPIC_BASE_URL`, de modo que el SDK real hace peticiones HTTP reales, pero ninguna sale de la máquina ni cuesta dinero. Cada test decide con `/__test/ai` cómo contesta (bien, rechazo, `max_tokens`, error HTTP) y comprueba qué le ha llegado.

**Contenido:** los e2e no leen `content/` sino `.e2e/content`, una copia que genera `tests/support/build-fixture-content.ts` antes de compilar. En ella la lección de escucha pasa por el pipeline real de audio con un TTS de prueba (tonos con tiempos por palabra; necesita `ffmpeg`), así se prueban el reproductor, el karaoke y las tarjetas de audio.

**Tests de base de datos:** `tests/db/*.test.ts` (Vitest) prueban sobre ese mismo Postgres el *trigger* de alta, RLS tabla por tabla y las funciones SQL.

> El emulador no sustituye a probar contra el proyecto real de Supabase antes de desplegar cambios de esquema o de consultas.

Flujos:
1. Login con email permitido / rechazo de otro email.
2. Lección de lectura completa (fases 0–3) → intentos guardados.
3. Lección de escucha: no hay transcripción en fase 1; dictado; diagnóstico guardado.
4. Sesión de repaso con atajos de teclado.
5. Registro rápido en el diario.
6. (Fase 5) `/hoy` genera el plan y no cambia al recargar.
7. (Fase 6) Writing con el SDK simulado; límite diario.
8. (Fase 7) Lección descargada en modo sin conexión (Playwright `context.setOffline(true)`).

Cada flujo ejecuta `axe` en las pantallas que visita.

---

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml` (usa las últimas versiones mayores de cada *action*):

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ci-placeholder
      NEXT_PUBLIC_AUDIO_BASE_URL: https://audio.example.invalid
      ALLOWED_EMAIL: ci@example.invalid
      ANTHROPIC_API_KEY: ci-placeholder
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test -- --coverage
      - run: pnpm content:validate --offline   # sin comprobar R2
      - run: pnpm build

  e2e:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: supabase/setup-cli@v1
      - run: pnpm install --frozen-lockfile
      - run: supabase start
      - run: pnpm db:types && git diff --exit-code src/lib/supabase/database.types.ts
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
```

- El *job* `check` bloquea el *merge*.
- `e2e` también, salvo que lo marques como opcional al principio mientras estabilizas los tests.
- Lighthouse (rendimiento/accesibilidad) como paso **no bloqueante** desde la fase 7.

---

## 5. Revisión antes de cerrar una fase

- [ ] Criterios de aceptación de la fase marcados.
- [ ] Prueba en tu móvil real (Android o iPhone).
- [ ] Recorrido con teclado y una pasada con VoiceOver.
- [ ] Documentación y ADRs al día.
- [ ] Etiqueta de versión (`v0.N.0`) y nota breve de cambios.
