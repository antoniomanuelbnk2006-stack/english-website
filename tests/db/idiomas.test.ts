import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0009: los datos del usuario, por idioma (ADR-0037). Lo que ya existía es de inglés.

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

const asAna = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  t.asUser(ana, async (tx) => (await tx.query<T>(sql, params)).rows);

const ratings = (language: string) =>
  asAna<{ skill: string; rating: number; items_count: number }>(
    `select skill, rating, items_count from public.skill_ratings where language = $1 order by skill`,
    [language],
  );

describe('léxico y tarjetas', () => {
  it('lo que se guarda sin decir idioma es de inglés', async () => {
    await asAna(
      `insert into public.lexicon (lemma, status, source) values ('table', 'known', 'manual')`,
    );
    const rows = await asAna<{ language: string }>(`select language from public.lexicon`);
    expect(rows).toEqual([{ language: 'en' }]);
  });

  it('la misma palabra puede estar en dos idiomas, con su propio estado', async () => {
    await asAna(
      `insert into public.lexicon (language, lemma, status, source) values ('es', 'table', 'new', 'manual')`,
    );
    const rows = await asAna<{ language: string; status: string }>(
      `select language, status from public.lexicon where lemma = 'table' order by language`,
    );
    expect(rows).toEqual([
      { language: 'en', status: 'known' },
      { language: 'es', status: 'new' },
    ]);
    // Dentro de un idioma, el lema sigue siendo único.
    await expect(
      asAna(
        `insert into public.lexicon (language, lemma, status, source) values ('es', 'table', 'known', 'manual')`,
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('una palabra tiene una tarjeta por idioma, no una para todos', async () => {
    const card = (language: string) =>
      asAna(
        `insert into public.srs_cards (language, kind, lemma, front, back) values ($1, 'word', 'pie', '{}', '{}')`,
        [language],
      );
    await card('en');
    await card('es');
    await expect(card('es')).rejects.toThrow(/srs_cards_unique_card/);
    const rows = await asAna<{ language: string }>(
      `select language from public.srs_cards order by language`,
    );
    expect(rows).toEqual([{ language: 'en' }, { language: 'es' }]);
  });
});

describe('niveles por destreza', () => {
  const attempt = (n: number) => ({
    item_id: `x:${n}`,
    skill: 'reading',
    task_type: 'mcq',
    focus: 'gist',
    phase: 'practice',
    item_difficulty: 1000,
    rating_before: 1100,
    score: 1,
    response: {},
    duration_ms: 1000,
    client_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  });

  it('el usuario nuevo empieza con sus ratings de inglés y ninguno de otro idioma', async () => {
    expect(await ratings('en')).toHaveLength(6);
    expect(await ratings('es')).toEqual([]);
  });

  it('guardar una lección de español crea sus ratings sin tocar los de inglés', async () => {
    const before = await ratings('en');
    await asAna(`select public.apply_lesson_attempts($1, 1, $2::jsonb, $3::jsonb, $4::jsonb, $5)`, [
      'es-a1-rea-001',
      JSON.stringify([attempt(1)]),
      JSON.stringify({ reading: { rating: 1150, items: 1 } }),
      JSON.stringify({ status: 'completed', phase: 1, score: 1, time_spent_s: 10 }),
      'es',
    ]);
    expect(await ratings('es')).toEqual([{ skill: 'reading', rating: 1150, items_count: 1 }]);
    expect(await ratings('en')).toEqual(before);

    const history = await asAna<{ language: string; rating: number }>(
      `select language, rating from public.rating_history`,
    );
    expect(history).toEqual([{ language: 'es', rating: 1150 }]);
  });

  it('sin decir idioma, como antes, es de inglés', async () => {
    await asAna(`select public.apply_lesson_attempts($1, 1, $2::jsonb, $3::jsonb, $4::jsonb)`, [
      'b1-rea-001',
      JSON.stringify([attempt(2)]),
      JSON.stringify({ reading: { rating: 1120, items: 5 } }),
      JSON.stringify({ status: 'completed', phase: 1, score: 1, time_spent_s: 10 }),
    ]);
    const english = await ratings('en');
    expect(english.find((row) => row.skill === 'reading')).toMatchObject({ rating: 1120 });
    expect((await ratings('es'))[0]).toMatchObject({ rating: 1150 });
  });
});

describe('nivel declarado, por idioma', () => {
  it('cada usuario guarda un nivel por idioma y solo ve los suyos', async () => {
    const save = (language: string, level: string) =>
      asAna(
        `insert into public.language_levels (language, declared_level) values ($1, $2)
         on conflict (user_id, language) do update set declared_level = excluded.declared_level`,
        [language, level],
      );
    await save('en', 'B2');
    await save('es', 'A1');
    await save('es', 'A2');
    expect(
      await asAna(`select language, declared_level from public.language_levels order by language`),
    ).toEqual([
      { language: 'en', declared_level: 'B2' },
      { language: 'es', declared_level: 'A2' },
    ]);

    const others = await t.asUser(
      luis,
      async (tx) => (await tx.query(`select * from public.language_levels`)).rows,
    );
    expect(others).toEqual([]);
    await expect(
      t.asUser(luis, (tx) =>
        tx.query(
          `insert into public.language_levels (user_id, language, declared_level) values ($1, 'en', 'C1')`,
          [ana],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it('no admite un idioma que no existe', async () => {
    await expect(
      asAna(`insert into public.language_levels (language, declared_level) values ('xx', 'A1')`),
    ).rejects.toThrow(/check constraint/);
  });

  it('el nivel que ya había en el perfil pasa a ser el de inglés', async () => {
    const maria = await t.createUser('maria@example.test');
    await t.db.query(`update public.profiles set declared_level = 'C1' where id = $1`, [maria]);
    const sql = readFileSync(
      path.join(process.cwd(), 'supabase', 'migrations', '0009_datos_por_idioma.sql'),
      'utf8',
    );
    // Es la sentencia de la migración, ejecutada sobre un perfil que ya tenía nivel.
    const backfill = /insert into public\.language_levels[\s\S]*?;/.exec(sql)?.[0];
    expect(backfill).toBeDefined();
    await t.db.query(backfill!);
    const rows = await t.db.query<{ language: string; declared_level: string }>(
      `select language, declared_level from public.language_levels where user_id = $1`,
      [maria],
    );
    expect(rows.rows).toEqual([{ language: 'en', declared_level: 'C1' }]);
  });
});
