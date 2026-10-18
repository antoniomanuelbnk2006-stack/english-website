import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0007: una política por operación, y solo las que cada tabla necesita (ADR-0025).

let t: TestDb;
let ana: string;
let luis: string;

const RWU = ['INSERT', 'SELECT', 'UPDATE'];
const APPEND = ['INSERT', 'SELECT'];
const READ = ['SELECT'];

/** Qué puede hacer el usuario con sus filas en cada tabla. Una tabla nueva tiene que constar aquí. */
const EXPECTED: Record<string, string[]> = {
  profiles: RWU,
  language_levels: RWU,
  skill_ratings: RWU,
  lesson_progress: RWU,
  lexicon: RWU,
  srs_cards: RWU,
  writing_submissions: RWU,
  activity_days: RWU,
  input_log: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  item_attempts: APPEND,
  srs_reviews: APPEND,
  rating_history: APPEND,
  listening_diagnostics: APPEND,
  daily_plans: READ,
  placement_results: READ,
  achievements: READ,
  ai_usage: READ,
  login_attempts: READ,
};

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const asAna = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  t.asUser(ana, async (tx) => (await tx.query<T>(sql, params)).rows);

const count = async (table: string) => {
  const result = await t.db.query<{ n: number }>(
    `select count(*)::int as n from public.${table} where ${table === 'profiles' ? 'id' : 'user_id'} = $1`,
    [ana],
  );
  return result.rows[0]!.n;
};

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');

  // Datos de Ana en todas las tablas. Lo que ella puede escribir lo escribe ella; el resto lo
  // pone el «superusuario» del test, como lo pondría una función futura.
  await asAna(
    `select public.apply_lesson_attempts('b1-rea-001', 1, $1::jsonb, $2::jsonb, $3::jsonb)`,
    [
      JSON.stringify([
        {
          item_id: 'b1-rea-001:q1',
          skill: 'reading',
          task_type: 'mcq',
          item_difficulty: 1129,
          rating_before: 1100,
          score: 1,
          client_id: uuid(1),
        },
      ]),
      JSON.stringify({ reading: { rating: 1112, items: 1 } }),
      JSON.stringify({ status: 'completed', phase: 5, score: 1, time_spent_s: 60 }),
    ],
  );
  await asAna(`select public.add_activity('2026-10-13', 600, 100)`);
  await asAna(`insert into public.language_levels (language, declared_level) values ('en', 'B1')`);
  await asAna(
    `insert into public.lexicon (lemma, status, source) values ('forecast', 'learning', 'srs')`,
  );
  const cards = await asAna<{ id: string }>(
    `insert into public.srs_cards (kind, lemma, front, back)
     values ('word', 'forecast', '{}'::jsonb, '{}'::jsonb) returning id`,
  );
  await asAna(`select public.apply_reviews($1::jsonb)`, [
    JSON.stringify([
      {
        card_id: cards[0]!.id,
        client_id: uuid(2),
        duration_ms: 3000,
        card: {
          due: '2026-10-14T08:00:00Z',
          stability: 2,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 1,
          learning_steps: 0,
          reps: 1,
          lapses: 0,
          state: 2,
          last_review: '2026-10-13T08:00:00Z',
        },
        log: {
          rating: 3,
          state: 0,
          due: '2026-10-13T08:00:00Z',
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          last_elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          review: '2026-10-13T08:00:00Z',
        },
      },
    ]),
  ]);
  await asAna(
    `insert into public.listening_diagnostics (lesson_id, segment_id, cause, expected)
     values ('b1-lis-001', 's1', 'speed', 'going to')`,
  );
  await asAna(
    `insert into public.input_log (kind, source, minutes, logged_on)
     values ('extensive_reading', 'external', 20, '2026-10-13')`,
  );
  await asAna(
    `insert into public.writing_submissions (task_type, target_level, text, word_count, review_kind, status)
     values ('essay', 'B2', 'I am agree with this.', 5, 'self', 'done')`,
  );
  await t.db.query(
    `insert into public.daily_plans (user_id, day, items) values ($1, '2026-10-13', '[]'::jsonb)`,
    [ana],
  );
  await t.db.query(
    `insert into public.placement_results (user_id, kind, details) values ($1, 'placement', '{}'::jsonb)`,
    [ana],
  );
  await t.db.query(`insert into public.achievements (user_id, code) values ($1, 'first')`, [ana]);
});

afterAll(async () => {
  await t.close();
});

describe('políticas por operación', () => {
  it('cada tabla tiene justo las operaciones que necesita, y ninguna política «for all»', async () => {
    const result = await t.db.query<{ tablename: string; cmds: string[]; roles: string[] }>(
      `select tablename,
              array_agg(cmd order by cmd)::text[] as cmds,
              array(select distinct unnest(array_agg(roles::text[])))::text[] as roles
       from pg_policies where schemaname = 'public' group by tablename`,
    );
    const actual = Object.fromEntries(result.rows.map((row) => [row.tablename, row.cmds]));
    expect(actual).toEqual(EXPECTED);
    for (const row of result.rows) {
      expect(row.roles, row.tablename).toEqual(['authenticated']);
    }

    const tables = await t.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'`,
    );
    expect(tables.rows.map((row) => row.relname).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('el usuario sigue leyendo sus filas en todas las tablas, y solo las suyas', async () => {
    for (const table of Object.keys(EXPECTED)) {
      if (table === 'ai_usage' || table === 'login_attempts') continue; // vacías aquí; tienen sus tests
      const mine = await asAna(`select * from public.${table}`);
      expect(mine.length, table).toBeGreaterThan(0);
    }
    const other = await t.asUser(luis, (tx) =>
      tx.query('select id from public.item_attempts union all select id from public.input_log'),
    );
    expect(other.rows).toEqual([]);
  });
});

describe('lo que ya no se puede hacer con la sesión', () => {
  const noDelete = Object.keys(EXPECTED).filter((table) => !EXPECTED[table]!.includes('DELETE'));
  const noUpdate = Object.keys(EXPECTED).filter((table) => !EXPECTED[table]!.includes('UPDATE'));
  const noInsert = Object.keys(EXPECTED).filter((table) => !EXPECTED[table]!.includes('INSERT'));

  it('borrar: solo en el diario; el resto de tablas no pierde ni una fila', async () => {
    for (const table of noDelete) {
      if (table === 'ai_usage' || table === 'login_attempts') continue;
      const before = await count(table);
      const deleted = await asAna(`delete from public.${table} returning 1 as x`);
      expect(deleted, table).toEqual([]);
      expect(await count(table), table).toBe(before);
    }
    expect(noDelete).toHaveLength(Object.keys(EXPECTED).length - 1);
  });

  it('cambiar: los historiales y las tablas de solo lectura no admiten cambios', async () => {
    const change: Record<string, string> = {
      item_attempts: 'score = 0',
      srs_reviews: 'rating = 1',
      rating_history: 'rating = 9999',
      listening_diagnostics: `cause = 'accent'`,
      daily_plans: `items = '[1]'::jsonb`,
      placement_results: 'passed = true',
      achievements: `code = 'otro'`,
    };
    expect(Object.keys(change).sort()).toEqual(
      noUpdate.filter((table) => table !== 'ai_usage' && table !== 'login_attempts').sort(),
    );
    for (const [table, set] of Object.entries(change)) {
      const updated = await asAna(`update public.${table} set ${set} returning 1 as x`);
      expect(updated, table).toEqual([]);
    }
    const attempt = await t.db.query<{ score: number }>('select score from public.item_attempts');
    expect(attempt.rows).toEqual([{ score: 1 }]);
  });

  it('crear: las tablas sin uso no admiten filas nuevas', async () => {
    const insert: Record<string, string> = {
      daily_plans: `(day, items) values ('2026-10-14', '[]'::jsonb)`,
      placement_results: `(kind, details) values ('placement', '{}'::jsonb)`,
      achievements: `(code) values ('second')`,
    };
    expect(Object.keys(insert).sort()).toEqual(
      noInsert.filter((table) => table !== 'ai_usage' && table !== 'login_attempts').sort(),
    );
    for (const [table, values] of Object.entries(insert)) {
      await expect(asAna(`insert into public.${table} ${values}`), table).rejects.toThrow(
        /row-level security/,
      );
    }
  });
});

describe('lo que la app sigue pudiendo hacer', () => {
  it('guardar con «upsert» (crear o cambiar) en las tablas que lo usan', async () => {
    const upsert = () =>
      asAna<{ status: string }>(
        `insert into public.lexicon (lemma, status, source) values ('forecast', 'known', 'manual')
         on conflict (user_id, language, lemma) do update set status = excluded.status returning status`,
      );
    expect(await upsert()).toEqual([{ status: 'known' }]);

    const profile = await asAna<{ daily_goal_min: number }>(
      `update public.profiles set daily_goal_min = 60 returning daily_goal_min`,
    );
    expect(profile).toEqual([{ daily_goal_min: 60 }]);

    const paused = await asAna(`update public.srs_cards set suspended = true returning id`);
    expect(paused).toHaveLength(1);
    const rewritten = await asAna(
      `update public.writing_submissions set rewrite_text = 'I agree with this.' returning id`,
    );
    expect(rewritten).toHaveLength(1);
  });

  it('el diario se puede corregir y borrar', async () => {
    const updated = await asAna(`update public.input_log set minutes = 25 returning minutes`);
    expect(updated).toEqual([{ minutes: 25 }]);
    const deleted = await asAna(`delete from public.input_log returning id`);
    expect(deleted).toHaveLength(1);
    expect(await count('input_log')).toBe(0);
  });

  it('nadie crea ni cambia filas a nombre de otro', async () => {
    await expect(
      t.asUser(luis, (tx) =>
        tx.query(
          `insert into public.lexicon (user_id, lemma, status, source)
           values ($1, 'intruso', 'known', 'manual')`,
          [ana],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const touched = await t.asUser(luis, (tx) =>
      tx.query(`update public.lexicon set status = 'ignored' returning lemma`),
    );
    expect(touched.rows).toEqual([]);
  });
});
