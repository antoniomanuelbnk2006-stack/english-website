import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { newCardState, review, type CardState, type Grade } from '@/features/srs/lib/scheduler';
import { createTestDb, type TestDb } from '../support/test-db';

// `apply_reviews` sobre un Postgres real: transacción, idempotencia y RLS.

let t: TestDb;
let ana: string;
let luis: string;

const T0 = new Date('2026-10-08T08:00:00.000Z');
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');
});

afterAll(async () => {
  await t.close();
});

async function createCard(user: string, segment: string): Promise<string> {
  const result = await t.asUser(user, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.srs_cards (kind, front, back, source_segment_id, due)
       values ('audio', '{}', '{}', $1, $2) returning id`,
      [segment, T0.toISOString()],
    ),
  );
  return result.rows[0]?.id ?? '';
}

/** Lo que monta la acción del servidor para un repaso. */
function item(cardId: string, state: CardState, grade: Grade, now: Date, n: number) {
  const next = review(state, grade, now);
  return {
    payload: {
      card_id: cardId,
      client_id: uuid(n),
      duration_ms: 4200,
      card: next.state,
      log: next.log,
    },
    state: next.state,
  };
}

const apply = (user: string, reviews: unknown[]) =>
  t.asUser(user, (tx) =>
    tx.query<{ applied: number }>('select public.apply_reviews($1::jsonb) as applied', [
      JSON.stringify(reviews),
    ]),
  );

const readCard = (user: string, id: string) =>
  t.asUser(user, (tx) =>
    tx.query<Record<string, unknown>>(
      `select state, reps, lapses, scheduled_days, stability, due, last_review
       from public.srs_cards where id = $1`,
      [id],
    ),
  );

describe('apply_reviews', () => {
  it('guarda el repaso y actualiza la tarjeta en la misma transacción', async () => {
    const card = await createCard(ana, 'b1-lis-001:s1');
    const first = item(card, newCardState(T0), 3, T0, 1);

    const result = await apply(ana, [first.payload]);
    expect(result.rows[0]?.applied).toBe(1);

    const saved = (await readCard(ana, card)).rows[0];
    expect(saved).toMatchObject({ state: 1, reps: 1, lapses: 0 });
    expect(new Date(String(saved?.due)).toISOString()).toBe(first.state.due);
    expect(new Date(String(saved?.last_review)).toISOString()).toBe(T0.toISOString());

    const log = await t.asUser(ana, (tx) =>
      tx.query(
        'select rating, state, duration_ms, client_id from public.srs_reviews where card_id = $1',
        [card],
      ),
    );
    expect(log.rows).toEqual([{ rating: 3, state: 0, duration_ms: 4200, client_id: uuid(1) }]);
  });

  it('es idempotente: reenviar el mismo lote no programa la tarjeta dos veces', async () => {
    const card = await createCard(ana, 'b1-lis-001:s2');
    const first = item(card, newCardState(T0), 4, T0, 10);

    expect((await apply(ana, [first.payload])).rows[0]?.applied).toBe(1);
    const before = (await readCard(ana, card)).rows[0];

    // El reintento llega con un estado distinto (como si se hubiera recalculado encima).
    const again = { ...first.payload, card: { ...first.state, reps: 99, scheduled_days: 300 } };
    expect((await apply(ana, [again])).rows[0]?.applied).toBe(0);
    expect((await readCard(ana, card)).rows[0]).toEqual(before);

    const count = await t.asUser(ana, (tx) =>
      tx.query<{ n: number }>(
        'select count(*)::int as n from public.srs_reviews where card_id = $1',
        [card],
      ),
    );
    expect(count.rows[0]?.n).toBe(1);
  });

  it('aplica en orden varios repasos de la misma tarjeta dentro de un lote', async () => {
    const card = await createCard(ana, 'b1-lis-001:s3');
    const first = item(card, newCardState(T0), 1, T0, 20);
    const later = new Date(T0.getTime() + 60_000);
    const second = item(card, first.state, 3, later, 21);
    const last = new Date(later.getTime() + 10 * 60_000);
    const third = item(card, second.state, 3, last, 22);

    const result = await apply(ana, [first.payload, second.payload, third.payload]);
    expect(result.rows[0]?.applied).toBe(3);
    const saved = (await readCard(ana, card)).rows[0];
    expect(saved).toMatchObject({
      state: third.state.state,
      reps: 3,
      scheduled_days: third.state.scheduled_days,
    });
  });

  it('no deja repasar tarjetas de otro usuario', async () => {
    const card = await createCard(ana, 'b1-lis-001:s4');
    const before = (await readCard(ana, card)).rows[0];

    const forged = item(card, newCardState(T0), 4, T0, 30);
    expect((await apply(luis, [forged.payload])).rows[0]?.applied).toBe(0);

    expect((await readCard(ana, card)).rows[0]).toEqual(before);
    const all = await t.db.query<{ n: number }>(
      'select count(*)::int as n from public.srs_reviews where card_id = $1',
      [card],
    );
    expect(all.rows[0]?.n).toBe(0);
  });

  it('exige sesión: el rol anon no puede ejecutarla', async () => {
    await expect(
      t.asAnon((tx) => tx.query(`select public.apply_reviews('[]'::jsonb)`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('un lote vacío no hace nada', async () => {
    expect((await apply(ana, [])).rows[0]?.applied).toBe(0);
  });
});

describe('unicidad de las tarjetas', () => {
  it('no admite dos tarjetas del mismo tipo para el mismo origen', async () => {
    await createCard(ana, 'b1-lis-001:s9');
    await expect(createCard(ana, 'b1-lis-001:s9')).rejects.toThrow(/duplicate key/);
    // El mismo segmento de otra lección sí: por eso el origen va cualificado con la lección.
    await expect(createCard(ana, 'b1-lis-002:s9')).resolves.toBeTruthy();
    // Y otro usuario puede tener la suya.
    await expect(createCard(luis, 'b1-lis-001:s9')).resolves.toBeTruthy();
  });
});
