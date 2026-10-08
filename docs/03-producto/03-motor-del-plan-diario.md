# Motor del plan diario («Hoy»)

> **Propósito:** cómo decide Señal qué haces cada día. Es lógica pura y testeable: entra el estado, sale una lista ordenada de actividades con su porqué.
> **Relacionado:** [Metodología §3](../01-pedagogia/02-metodologia.md#3-reparto-de-tiempo-recomendado-para-ti-b1-receptivo) · [Evaluación](../01-pedagogia/08-evaluacion-y-nivel.md) · [Base de datos](../04-arquitectura/03-base-de-datos.md)

---

## 1. Entradas y salida

```ts
// src/features/plan/lib/types.ts
export type Skill = 'listening' | 'reading' | 'vocabulary' | 'grammar' | 'writing' | 'speaking';

export interface PlanContext {
  today: string;                       // 'YYYY-MM-DD' en Europe/Madrid
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;  // 1 = lunes
  goalMinutes: number;                 // profiles.daily_goal_min (por defecto 45)
  ratings: Record<Skill, { rating: number; items: number }>;
  srs: { dueToday: number; newAvailable: number; newDoneToday: number };
  lessons: LessonMeta[];               // índice de contenido publicado (content/index.generated.json)
  progress: Map<string, 'started' | 'completed'>;
  lexiconKnown: Set<string>;           // lemas known (para cobertura)
  recentDiagnostics: CauseCount;       // últimos 14 días
  accentMinutes: Record<string, number>; // últimos 30 días
  interests: Topic[];
  currentSeries?: string;              // última serie empezada y no terminada
  lastWritingDay?: string;
  confirmationUnlocked: Skill[];
}

export type PlanItem =
  | { kind: 'srs'; minutes: number; due: number; newCards: number; reason: string }
  | { kind: 'lesson'; lessonId: string; skill: 'listening' | 'reading'; minutes: number; reason: string }
  | { kind: 'drill'; drillId: string; minutes: number; reason: string }
  | { kind: 'extensive'; skill: 'listening' | 'reading'; minutes: number; suggestionId?: string; reason: string }
  | { kind: 'writing'; promptId: string; minutes: number; reason: string }
  | { kind: 'confirmation'; skill: Skill; reason: string };

export function buildDailyPlan(ctx: PlanContext): PlanItem[];
```

La función es **pura** (sin red ni base de datos): se testea con Vitest con contextos de ejemplo. Un *server action* reúne el contexto, la llama y guarda el resultado en `daily_plans`.

---

## 2. Algoritmo

### Paso 1 · Presupuesto por bloques
Reparto base sobre `goalMinutes` (de la [metodología](../01-pedagogia/02-metodologia.md#3-reparto-de-tiempo-recomendado-para-ti-b1-receptivo)):

| Bloque | % base |
|---|---|
| Escucha intensiva | 15 |
| Escucha extensiva | 25 |
| Lectura intensiva | 10 |
| Lectura extensiva | 20 |
| Repaso SRS | 15 |
| Producción (writing/gramática/shadowing) | 15 |

**Ajuste por debilidad:** se toma la destreza receptiva con menor rating (listening o reading). Si la diferencia entre ambas es ≥ 40 puntos, se mueve un **5 %** del bloque extensivo de la más fuerte al intensivo de la más débil.

### Paso 2 · Repaso
```
minutosSRS = min(15, presupuestoSRS, estimación(due, nuevas))
estimación = due × 8 s + nuevas × 20 s
nuevas     = min(10 − newDoneToday, newAvailable)
```
Si hay muchas pendientes (> 150), el repaso ocupa los 15 min y **no se añaden nuevas** ese día (protege contra la avalancha).

### Paso 3 · Lección intensiva de escucha
Siempre que el presupuesto sea ≥ 20 min. Selección con `pickLesson('listening')` (§3).

### Paso 4 · Drill dirigido
Si en los últimos 14 días una causa de fallo supera el 35 % de los diagnósticos, se añade un drill de 3 min para esa causa (`not_recognized` → formas débiles/reducciones; `boundaries` → segmentación; `speed` → escalera de velocidad; `accent` → acentos).

### Paso 5 · Lectura
- Días impares del calendario de la semana (lun, mié, vie, dom): **lección intensiva**.
- Días pares: **extensiva** (siguiente capítulo de lo que estés leyendo, o una sugerencia con cobertura ≥ 98 %).
- Si el rating de reading está ≥ 40 puntos por debajo del de listening, intensiva todos los días.

### Paso 6 · Producción
- **Writing** martes y viernes (configurable), si no hay uno en los últimos 2 días: consigna del nivel actual de writing, tema rotado.
- Resto de días: el tiempo de producción se convierte en una **ficha de gramática** relacionada con tus errores recientes o en *shadowing* de la lección del día (cuando exista).

### Paso 7 · Relleno con escucha extensiva
Lo que quede de presupuesto → escucha extensiva (biblioteca de la app o sugerencia de registrar contenido externo). Es el bloque elástico: si un día tienes menos tiempo, se recorta primero.

### Paso 8 · Prueba de confirmación
Si hay alguna desbloqueada y es sábado o domingo, se propone **en lugar** de la lección intensiva de esa destreza.

### Paso 9 · Orden final
Repaso → intensiva de la destreza más débil → drill → la otra intensiva → producción → extensivas. (Lo exigente primero, con la cabeza fresca; lo extensivo al final, cuando apetece algo más ligero.)

---

## 3. Selección de lecciones

```ts
function pickLesson(skill: 'listening' | 'reading', ctx: PlanContext): LessonMeta | null {
  const r = ctx.ratings[skill].rating;
  for (const widen of [0, 50, 100, 150]) {
    const pool = ctx.lessons.filter((l) =>
      l.skill === skill &&
      l.status === 'published' &&
      ctx.progress.get(l.id) !== 'completed' &&
      l.difficulty >= r - 50 - widen &&
      l.difficulty <= r + 100 + widen,
    );
    if (pool.length > 0) return maxBy(pool, (l) => score(l, ctx));
  }
  return null; // → aviso en Studio: «faltan lecciones de escucha en tu banda»
}

function score(l: LessonMeta, ctx: PlanContext): number {
  let s = 0;
  if (l.series === ctx.currentSeries) s += 3;              // escucha/lectura estrecha
  if (isNextInSeries(l, ctx)) s += 2;
  if (ctx.progress.get(l.id) === 'started') s += 2.5;      // terminar lo empezado
  s += 1.5 * interestWeight(l.topic, ctx.interests);       // 0..1
  s += accentBonus(l.accents, ctx.accentMinutes, l.level); // 0..1: acentos poco escuchados y permitidos para el nivel
  const cov = coverage(l.lemmas, ctx.lexiconKnown);         // 0..1
  s -= 20 * Math.abs(cov - 0.95);                           // objetivo 95 % en intensiva
  if (sameGenreAsYesterday(l, ctx)) s -= 1;
  s += seededJitter(l.id, ctx.today) * 0.5;                 // variedad, pero determinista por día
  return s;
}
```

Notas:
- `seededJitter` usa un hash de `id + fecha`: el mismo día da el mismo resultado (el plan no «baila» si se recalcula).
- La **cobertura** usa la lista de lemas precalculada de cada lección (`LessonMeta.lemmas`) y tu léxico en memoria.
- Para **extensiva** de lectura se invierten los criterios: dificultad ≤ rating y cobertura ≥ 98 %.

---

## 4. Ejemplo (tu caso)

Contexto: objetivo 45 min, jueves. Listening 1080 (B1), Reading 1130 (B1). 32 tarjetas pendientes, 10 nuevas disponibles. Diagnósticos de 14 días: `not_recognized` 46 %, `unknown_word` 28 %, `speed` 15 %, otros 11 %.

| # | Ítem | Min | Porqué |
|---|---|---|---|
| 1 | Repaso | 7 | 32 pendientes + 10 nuevas |
| 2 | Escucha intensiva `b1-lis-001` | 12 | Destreza más baja (1080); serie actual «Cielo nocturno»; dificultad 1095 |
| 3 | Drill formas débiles | 3 | 46 % de tus fallos: palabra conocida no reconocida |
| 4 | Lectura extensiva (cap. 2) | 10 | Jueves = extensiva; cobertura 98,6 % |
| 5 | Escucha extensiva | 13 | Relleno; sugerencia: episodio B1 de la biblioteca o registrar externo |

Total: 45 min. (Si fuera martes, el bloque 4 se reduciría y entraría un writing de 15 min.)

---

## 5. Persistencia y recálculo

- Tabla `daily_plans (user_id, day, items jsonb, created_at)`; clave `(user_id, day)`.
- Se genera al primer acceso del día a `/hoy`. Botón «Recalcular» manual (p. ej., si cambias el objetivo de minutos).
- Cada ítem se marca como hecho al completar la actividad correspondiente (evento de progreso), no a mano.
- Si un ítem no puede cumplirse (no hay lecciones en la banda), se sustituye por el siguiente bloque y se avisa.

---

## 6. Tests mínimos

| Caso | Esperado |
|---|---|
| Objetivo 15 min | Solo repaso (≤ 7) + escucha extensiva |
| 200 tarjetas pendientes | Repaso de 15 min sin nuevas |
| Reading 60 puntos por debajo de listening | Lectura intensiva diaria y la escucha intensiva pasa a segundo lugar |
| Sin lecciones en la banda | Ventana ampliada; si sigue vacía, sustitución + aviso |
| Mismo contexto dos veces el mismo día | Mismo plan exacto |
| Prueba desbloqueada en sábado | Sustituye la intensiva de esa destreza |
