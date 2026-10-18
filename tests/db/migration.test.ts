import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Las migraciones reales sobre un Postgres real (PGlite): trigger de alta, RLS y funciones SQL.

let t: TestDb;
let ana: string;
let luis: string;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const attempt = (n: number, itemId: string, score: number) => ({
  item_id: itemId,
  skill: 'reading',
  task_type: 'mcq',
  focus: 'detail',
  phase: 'read',
  item_difficulty: 1129,
  rating_before: 1100,
  score,
  response: { type: 'mcq', answer: 'a' },
  duration_ms: 4000,
  client_id: uuid(n),
});

const TABLES = [
  'profiles',
  'language_levels',
  'skill_ratings',
  'rating_history',
  'lesson_progress',
  'item_attempts',
  'listening_diagnostics',
  'lexicon',
  'srs_cards',
  'srs_reviews',
  'input_log',
  'activity_days',
  'daily_plans',
  'writing_submissions',
  'placement_results',
  'achievements',
  'login_attempts',
  'ai_usage',
];

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');
});

afterAll(async () => {
  await t.close();
});

describe('alta de usuario', () => {
  it('el trigger crea el perfil y un rating de 1100 por destreza', async () => {
    const profile = await t.asUser(ana, (tx) => tx.query('select * from public.profiles'));
    expect(profile.rows).toHaveLength(1);
    expect(profile.rows[0]).toMatchObject({
      id: ana,
      daily_goal_min: 45,
      streak_min_minutes: 15,
      ui_locale: 'es',
      timezone: 'Europe/Madrid',
    });

    const ratings = await t.asUser(ana, (tx) =>
      tx.query<{ skill: string; rating: number }>('select skill, rating from public.skill_ratings'),
    );
    expect(ratings.rows.map((r) => r.skill).sort()).toEqual([
      'grammar',
      'listening',
      'reading',
      'speaking',
      'vocabulary',
      'writing',
    ]);
    expect(ratings.rows.every((r) => r.rating === 1100)).toBe(true);
  });
});

// ADR-0032: el perfil admite los cinco idiomas de interfaz, y solo esos.
describe('idioma de la interfaz', () => {
  it.each(['es', 'en', 'fr', 'zh', 'ja'])('admite %s', async (locale) => {
    await t.asUser(ana, (tx) =>
      tx.query('update public.profiles set ui_locale = $1 where id = $2', [locale, ana]),
    );
    const row = await t.asUser(ana, (tx) =>
      tx.query<{ ui_locale: string }>('select ui_locale from public.profiles'),
    );
    expect(row.rows[0]?.ui_locale).toBe(locale);
  });

  it('rechaza cualquier otro', async () => {
    await expect(
      t.asUser(ana, (tx) =>
        tx.query("update public.profiles set ui_locale = 'de' where id = $1", [ana]),
      ),
    ).rejects.toThrow(/profiles_ui_locale_check/);
  });
});

describe('RLS', () => {
  it('todas las tablas tienen RLS activado y al menos una política', async () => {
    const result = await t.db.query<{ relname: string; rls: boolean; policies: number }>(
      `select c.relname, c.relrowsecurity as rls,
              (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by c.relname`,
    );
    expect(result.rows.map((r) => r.relname)).toEqual([...TABLES].sort());
    for (const row of result.rows) {
      expect(row.rls, `${row.relname} sin RLS`).toBe(true);
      expect(row.policies, `${row.relname} sin política`).toBeGreaterThan(0);
    }
  });

  it('un usuario no ve las filas de otro', async () => {
    await t.asUser(ana, (tx) =>
      tx.query(
        `insert into public.input_log (kind, source, minutes, logged_on)
         values ('extensive_listening', 'external', 20, '2026-10-08')`,
      ),
    );
    const own = await t.asUser(ana, (tx) => tx.query('select * from public.input_log'));
    const other = await t.asUser(luis, (tx) => tx.query('select * from public.input_log'));
    expect(own.rows).toHaveLength(1);
    expect(other.rows).toHaveLength(0);

    const profiles = await t.asUser(luis, (tx) => tx.query('select id from public.profiles'));
    expect(profiles.rows).toEqual([{ id: luis }]);
  });

  it('user_id toma por defecto el usuario de la sesión', async () => {
    const rows = await t.asUser(ana, (tx) =>
      tx.query<{ user_id: string }>('select user_id from public.input_log'),
    );
    expect(rows.rows[0]?.user_id).toBe(ana);
  });

  it('nadie puede escribir, modificar ni borrar filas a nombre de otro', async () => {
    await expect(
      t.asUser(luis, (tx) =>
        tx.query(
          `insert into public.input_log (user_id, kind, source, minutes, logged_on)
           values ($1, 'extensive_reading', 'external', 5, '2026-10-08')`,
          [ana],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    const updated = await t.asUser(luis, (tx) =>
      tx.query('update public.input_log set minutes = 999 returning id'),
    );
    const deleted = await t.asUser(luis, (tx) =>
      tx.query('delete from public.input_log returning id'),
    );
    expect(updated.rows).toHaveLength(0);
    expect(deleted.rows).toHaveLength(0);

    const intact = await t.asUser(ana, (tx) =>
      tx.query<{ minutes: number }>('select minutes from public.input_log'),
    );
    expect(intact.rows).toEqual([{ minutes: 20 }]);
  });

  it('sin sesión no se lee nada ni se pueden llamar las funciones', async () => {
    await expect(t.asAnon((tx) => tx.query('select * from public.profiles'))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      t.asAnon((tx) => tx.query(`select public.add_activity('2026-10-08', 60, 10)`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('apply_lesson_attempts', () => {
  const apply = (userId: string, attempts: object[], progress: object, ratings: object = {}) =>
    t.asUser(userId, (tx) =>
      tx.query('select public.apply_lesson_attempts($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)', [
        'b1-rea-001',
        1,
        JSON.stringify(attempts),
        JSON.stringify(ratings),
        JSON.stringify(progress),
      ]),
    );
  const progressOf = (userId: string) =>
    t.asUser(userId, async (tx) => {
      const result = await tx.query<Record<string, unknown>>(
        `select status, phase, score, best_score, attempts, time_spent_s, reading_wpm,
                completed_at is not null as done
         from public.lesson_progress where lesson_id = 'b1-rea-001'`,
      );
      return result.rows[0];
    });
  const countAttempts = (userId: string) =>
    t.asUser(userId, async (tx) => {
      const result = await tx.query<{ n: number }>(
        'select count(*)::int as n from public.item_attempts',
      );
      return result.rows[0]?.n;
    });

  it('guarda intentos y progreso de una fase', async () => {
    await apply(ana, [attempt(1, 'b1-rea-001:q1', 1), attempt(2, 'b1-rea-001:q2', 0.5)], {
      status: 'started',
      phase: 2,
      score: null,
      time_spent_s: 90,
      reading_wpm: null,
    });
    expect(await countAttempts(ana)).toBe(2);
    expect(await progressOf(ana)).toMatchObject({
      status: 'started',
      phase: 2,
      score: null,
      attempts: 0,
      time_spent_s: 90,
      done: false,
    });
  });

  it('reenviar el mismo lote no duplica intentos (idempotente por client_id)', async () => {
    await apply(ana, [attempt(1, 'b1-rea-001:q1', 1), attempt(2, 'b1-rea-001:q2', 0.5)], {
      status: 'started',
      phase: 2,
      time_spent_s: 0,
    });
    expect(await countAttempts(ana)).toBe(2);
  });

  it('acumula tiempo, conserva la fase más alta y guarda la velocidad lectora', async () => {
    await apply(ana, [], { status: 'started', phase: 3, time_spent_s: 170, reading_wpm: 136 });
    await apply(ana, [], { status: 'started', phase: 1, time_spent_s: 10 });
    expect(await progressOf(ana)).toMatchObject({
      phase: 3,
      time_spent_s: 270,
      reading_wpm: 136,
    });
  });

  it('al completar guarda la nota y no vuelve a «empezada» después', async () => {
    await apply(ana, [attempt(3, 'b1-rea-001:q3', 1)], {
      status: 'completed',
      phase: 5,
      score: 0.8,
      time_spent_s: 60,
    });
    expect(await progressOf(ana)).toMatchObject({
      status: 'completed',
      score: 0.8,
      best_score: 0.8,
      attempts: 1,
      done: true,
    });

    await apply(ana, [], { status: 'started', phase: 1, time_spent_s: 5 });
    expect(await progressOf(ana)).toMatchObject({ status: 'completed', score: 0.8, phase: 5 });
  });

  it('una nota peor no baja la mejor nota', async () => {
    await apply(ana, [], { status: 'completed', phase: 5, score: 0.6, time_spent_s: 0 });
    expect(await progressOf(ana)).toMatchObject({ score: 0.6, best_score: 0.8, attempts: 2 });
  });

  it('actualiza ratings y deja historial solo al completar', async () => {
    const history = () =>
      t.asUser(luis, async (tx) => {
        const result = await tx.query<{ n: number }>(
          'select count(*)::int as n from public.rating_history',
        );
        return result.rows[0]?.n;
      });

    await apply(
      luis,
      [attempt(10, 'b1-rea-001:q1', 1)],
      { status: 'started', phase: 2, time_spent_s: 30 },
      { reading: { rating: 1112.5, items: 1 } },
    );
    expect(await history()).toBe(0);

    await apply(
      luis,
      [],
      { status: 'completed', phase: 5, score: 1, time_spent_s: 30 },
      { reading: { rating: 1120, items: 1 } },
    );
    expect(await history()).toBe(1);

    const rating = await t.asUser(luis, (tx) =>
      tx.query<{ rating: number; items_count: number }>(
        `select rating, items_count from public.skill_ratings where skill = 'reading'`,
      ),
    );
    expect(rating.rows[0]).toEqual({ rating: 1120, items_count: 1 });
  });

  it('cada usuario solo ve sus intentos', async () => {
    expect(await countAttempts(ana)).toBe(3);
    expect(await countAttempts(luis)).toBe(1);
  });
});

describe('add_activity', () => {
  const add = (seconds: number, xp: number) =>
    t.asUser(ana, async (tx) => {
      const result = await tx.query<{ active_seconds: number; xp: number; goal_met: boolean }>(
        `select * from public.add_activity('2026-10-08', $1, $2)`,
        [seconds, xp],
      );
      return result.rows[0];
    });

  it('suma segundos y XP del día y marca el objetivo al alcanzarlo (45 min)', async () => {
    expect(await add(900, 150)).toMatchObject({ active_seconds: 900, xp: 150, goal_met: false });
    expect(await add(1700, 280)).toMatchObject({ active_seconds: 2600, xp: 430, goal_met: false });
    expect(await add(100, 20)).toMatchObject({ active_seconds: 2700, xp: 450, goal_met: true });
  });

  it('ignora valores negativos', async () => {
    expect(await add(-500, -50)).toMatchObject({ active_seconds: 2700, xp: 450 });
  });
});

describe('restricciones', () => {
  it('no admite dos tarjetas iguales (mismo tipo, lema y segmento, también con nulos)', async () => {
    const insert = () =>
      t.asUser(ana, (tx) =>
        tx.query(
          `insert into public.srs_cards (kind, lemma, front, back)
           values ('word', 'forecast', '{}'::jsonb, '{}'::jsonb)`,
        ),
      );
    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);
  });

  it('valida rangos: minutos del diario, objetivo diario y nota', async () => {
    await expect(
      t.asUser(ana, (tx) =>
        tx.query(
          `insert into public.input_log (kind, source, minutes, logged_on)
           values ('extensive_reading', 'external', 0, '2026-10-08')`,
        ),
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.asUser(ana, (tx) => tx.query('update public.profiles set daily_goal_min = 5')),
    ).rejects.toThrow(/check constraint/);
  });

  it('borrar el usuario borra todos sus datos en cascada', async () => {
    await t.db.query('delete from auth.users where id = $1', [luis]);
    const left = await t.db.query<{ n: number }>(
      `select (select count(*) from public.profiles where id = $1)
            + (select count(*) from public.skill_ratings where user_id = $1)
            + (select count(*) from public.item_attempts where user_id = $1)
            + (select count(*) from public.lesson_progress where user_id = $1) as n`,
      [luis],
    );
    expect(Number(left.rows[0]?.n)).toBe(0);
  });
});

describe('vistas', () => {
  it('v_input_weekly agrupa por semana y respeta RLS', async () => {
    const mine = await t.asUser(ana, (tx) =>
      tx.query<{ week: Date | string; minutes: number }>(
        'select week, kind, minutes from public.v_input_weekly',
      ),
    );
    expect(mine.rows).toHaveLength(1);
    expect(mine.rows[0]).toMatchObject({ kind: 'extensive_listening', minutes: 20 });
  });
});
