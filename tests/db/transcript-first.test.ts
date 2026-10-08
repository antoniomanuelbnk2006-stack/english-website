import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0003: la marca de «transcripción vista antes de las escuchas a ciegas» (ADR-0013).

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

const flag = (user: string, lesson: string) =>
  t.asUser(user, (tx) =>
    tx.query<{ transcript_first: boolean; phase: number; status: string }>(
      'select transcript_first, phase, status from public.lesson_progress where lesson_id = $1',
      [lesson],
    ),
  );

describe('lesson_progress.transcript_first', () => {
  it('vale false por defecto', async () => {
    await t.asUser(ana, (tx) =>
      tx.query(`insert into public.lesson_progress (lesson_id) values ('b1-lis-001')`),
    );
    expect((await flag(ana, 'b1-lis-001')).rows).toEqual([
      { transcript_first: false, phase: 0, status: 'started' },
    ]);
  });

  it('se puede marcar al abrir la lección con transcripción, sin tocar la fase', async () => {
    await t.asUser(ana, (tx) =>
      tx.query(
        `insert into public.lesson_progress (lesson_id, lesson_version, transcript_first)
         values ('b1-lis-002', 1, true)
         on conflict (user_id, lesson_id) do update set transcript_first = excluded.transcript_first`,
      ),
    );
    expect((await flag(ana, 'b1-lis-002')).rows[0]).toMatchObject({
      transcript_first: true,
      phase: 0,
    });
  });

  it('guardar después el ciclo a ciegas no borra la marca', async () => {
    await t.asUser(ana, (tx) =>
      tx.query(
        `select public.apply_lesson_attempts('b1-lis-002', 1, '[]'::jsonb, '{}'::jsonb, $1::jsonb)`,
        [JSON.stringify({ status: 'completed', phase: 7, score: 0.8, time_spent_s: 600 })],
      ),
    );
    expect((await flag(ana, 'b1-lis-002')).rows).toEqual([
      { transcript_first: true, phase: 7, status: 'completed' },
    ]);
  });

  it('es de cada usuario: la marca de una persona no afecta a otra', async () => {
    expect((await flag(luis, 'b1-lis-002')).rows).toEqual([]);
    await t.asUser(luis, (tx) =>
      tx.query(`insert into public.lesson_progress (lesson_id) values ('b1-lis-002')`),
    );
    expect((await flag(luis, 'b1-lis-002')).rows[0]?.transcript_first).toBe(false);
    expect((await flag(ana, 'b1-lis-002')).rows[0]?.transcript_first).toBe(true);
  });
});
