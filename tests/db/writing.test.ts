import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0004: entregas de writing revisadas sin IA y datos de la sesión (ADR-0014).

let t: TestDb;
let ana: string;
let luis: string;

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');
});

afterAll(async () => {
  await t.close();
});

const insert = (user: string, extra = '', values = '') =>
  t.asUser(user, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.writing_submissions (prompt_id, task_type, target_level, text, word_count${extra})
       values ('b1-wri-001', 'email', 'B1', 'Hi Sophie, it was great to hear from you.', 9${values})
       returning id`,
    ),
  );

describe('writing_submissions (migración 0004)', () => {
  it('por defecto una entrega es de IA, sin modo examen y con cero segundos', async () => {
    const { rows } = await insert(ana);
    const row = await t.asUser(ana, (tx) =>
      tx.query(
        `select review_kind, active_seconds, exam_mode, rewritten_at, status, cost_usd::float as cost
         from public.writing_submissions where id = $1`,
        [rows[0]!.id],
      ),
    );
    expect(row.rows).toEqual([
      {
        review_kind: 'ai',
        active_seconds: 0,
        exam_mode: false,
        rewritten_at: null,
        status: 'pending',
        cost: 0,
      },
    ]);
  });

  it('admite una entrega revisada sin IA, con su autoevaluación y su reescritura', async () => {
    const { rows } = await insert(
      ana,
      ', review_kind, status, feedback, exam_mode, active_seconds',
      `, 'self', 'done', '{"kind":"self","scores":null,"points":[]}'::jsonb, true, 1200`,
    );
    const id = rows[0]!.id;
    await t.asUser(ana, (tx) =>
      tx.query(
        `update public.writing_submissions
         set rewrite_text = 'Hi Sophie, it was lovely to hear from you.', rewritten_at = now()
         where id = $1`,
        [id],
      ),
    );
    const saved = await t.asUser(ana, (tx) =>
      tx.query<{
        review_kind: string;
        exam_mode: boolean;
        active_seconds: number;
        rewritten: boolean;
      }>(
        `select review_kind, exam_mode, active_seconds, rewritten_at is not null as rewritten
         from public.writing_submissions where id = $1`,
        [id],
      ),
    );
    expect(saved.rows).toEqual([
      { review_kind: 'self', exam_mode: true, active_seconds: 1200, rewritten: true },
    ]);
  });

  it('rechaza un tipo de revisión desconocido y un tiempo negativo', async () => {
    await expect(insert(ana, ', review_kind', `, 'humano'`)).rejects.toThrow(/check/i);
    await expect(insert(ana, ', active_seconds', ', -5')).rejects.toThrow(/check/i);
  });

  it('el límite diario se puede contar solo con las entregas enviadas a la IA', async () => {
    const counts = await t.asUser(ana, (tx) =>
      tx.query<{ review_kind: string; n: number }>(
        `select review_kind, count(*)::int as n from public.writing_submissions
         group by review_kind order by review_kind`,
      ),
    );
    expect(counts.rows).toEqual([
      { review_kind: 'ai', n: 1 },
      { review_kind: 'self', n: 1 },
    ]);
  });

  it('cada usuario solo ve y cambia sus entregas (RLS)', async () => {
    const mine = await t.asUser(luis, (tx) =>
      tx.query('select id from public.writing_submissions'),
    );
    expect(mine.rows).toEqual([]);

    const touched = await t.asUser(luis, (tx) =>
      tx.query(`update public.writing_submissions set rewrite_text = 'x' returning id`),
    );
    expect(touched.rows).toEqual([]);

    // Y quien no ha entrado no tiene ni permiso para consultar la tabla.
    await expect(
      t.asAnon((tx) => tx.query('select id from public.writing_submissions')),
    ).rejects.toThrow(/permission denied/);
  });
});
