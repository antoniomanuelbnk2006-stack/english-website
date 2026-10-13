import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0006: registro del uso de la IA que el usuario no puede tocar (ADR-0024).

let t: TestDb;
let ana: string;
let luis: string;

const DAY = '2026-10-08T22:00:00Z'; // las 00:00 del 9 de octubre en Madrid
const MONTH = '2026-09-30T22:00:00Z'; // las 00:00 del 1 de octubre en Madrid
const LIMITS = { daily: 3, budget: 5 };

type Reserved =
  { status: 'ok'; id: string; token: string } | { status: 'daily_limit' | 'monthly_budget' };

const reserve = (user: string, over: Partial<typeof LIMITS> & { usd?: number } = {}) =>
  t.asUser(user, async (tx) => {
    const result = await tx.query<{ r: Reserved }>(
      `select public.ai_usage_reserve('claude-sonnet-5-5', $1, $2, $3, $4, $5) as r`,
      [over.usd ?? 0.09, over.daily ?? LIMITS.daily, over.budget ?? LIMITS.budget, DAY, MONTH],
    );
    return result.rows[0]!.r;
  });

const settle = (
  user: string,
  id: string,
  token: string,
  outcome = 'done',
  cost = 0.025,
  tokens: [number, number] = [2500, 2000],
) =>
  t.asUser(user, async (tx) => {
    const result = await tx.query<{ ok: boolean }>(
      'select public.ai_usage_settle($1, $2, $3, $4, $5, $6) as ok',
      [id, token, outcome, cost, ...tokens],
    );
    return result.rows[0]!.ok;
  });

/** Una fila ya cerrada, escrita como «superusuario» del test para preparar un escenario. */
const seed = (user: string, over: Record<string, unknown> = {}) => {
  const row = {
    status: 'done',
    reason: null,
    reserved_usd: 0.09,
    cost_usd: 0.025,
    created_at: '2026-10-09T08:00:00Z',
    ...over,
  };
  return t.db.query(
    `insert into public.ai_usage (user_id, model, status, reason, reserved_usd, cost_usd, created_at)
     values ($1, 'claude-sonnet-5-5', $2, $3, $4, $5, $6)`,
    [user, row.status, row.reason, row.reserved_usd, row.cost_usd, row.created_at],
  );
};

const rows = (user: string) =>
  t.asUser(user, (tx) =>
    tx.query<Record<string, unknown>>(
      `select status, reason, reserved_usd::float as reserved, cost_usd::float as cost,
              input_tokens, output_tokens, settle_hash is not null as open
       from public.ai_usage order by created_at, id`,
    ),
  );

const ok = (reserved: Reserved) => {
  if (reserved.status !== 'ok') throw new Error(`reserva rechazada: ${reserved.status}`);
  return reserved;
};

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');
});

afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.db.query('delete from public.ai_usage');
});

describe('ai_usage_reserve y ai_usage_settle', () => {
  it('reservar aparta el gasto máximo; cerrar deja lo que costó de verdad', async () => {
    const reserved = ok(await reserve(ana));
    expect((await rows(ana)).rows).toEqual([
      {
        status: 'pending',
        reason: null,
        reserved: 0.09,
        cost: 0,
        input_tokens: null,
        output_tokens: null,
        open: true,
      },
    ]);

    expect(await settle(ana, reserved.id, reserved.token)).toBe(true);
    expect((await rows(ana)).rows).toEqual([
      {
        status: 'done',
        reason: null,
        reserved: 0.09,
        cost: 0.025,
        input_tokens: 2500,
        output_tokens: 2000,
        open: false,
      },
    ]);
  });

  it('un fallo se cierra con su motivo y su coste', async () => {
    const reserved = ok(await reserve(ana));
    expect(await settle(ana, reserved.id, reserved.token, 'max_tokens', 0.085, [2500, 8000])).toBe(
      true,
    );
    expect((await rows(ana)).rows[0]).toMatchObject({
      status: 'error',
      reason: 'max_tokens',
      cost: 0.085,
    });
  });

  it('una reserva se cierra una sola vez', async () => {
    const reserved = ok(await reserve(ana));
    expect(await settle(ana, reserved.id, reserved.token, 'done', 0.03)).toBe(true);
    // Volver a cerrarla para abaratarla no hace nada.
    expect(await settle(ana, reserved.id, reserved.token, 'done', 0)).toBe(false);
    expect((await rows(ana)).rows[0]).toMatchObject({ status: 'done', cost: 0.03 });
  });

  it('sin el resguardo no se cierra: ni con otro, ni desde otra cuenta', async () => {
    const reserved = ok(await reserve(ana));
    const other = ok(await reserve(ana));
    expect(await settle(ana, reserved.id, other.token, 'done', 0)).toBe(false);
    expect(await settle(luis, reserved.id, reserved.token, 'done', 0)).toBe(false);
    expect((await rows(ana)).rows.map((row) => row.status)).toEqual(['pending', 'pending']);
  });

  it('rechaza importes negativos y resultados desconocidos', async () => {
    await expect(reserve(ana, { usd: -1 })).rejects.toThrow(/invalid arguments/);
    const reserved = ok(await reserve(ana));
    await expect(settle(ana, reserved.id, reserved.token, 'done', -0.5)).rejects.toThrow(
      /invalid arguments/,
    );
    await expect(settle(ana, reserved.id, reserved.token, 'gratis', 0)).rejects.toThrow(
      /invalid arguments/,
    );
  });
});

describe('límite diario', () => {
  it('corta al llegar al límite, y las reservas sin cerrar también cuentan', async () => {
    ok(await reserve(ana));
    ok(await reserve(ana));
    ok(await reserve(ana));
    expect(await reserve(ana)).toEqual({ status: 'daily_limit' });
    expect((await rows(ana)).rows).toHaveLength(3);
  });

  it('un rechazo o un corte del modelo no gastan un intento; un fallo de la API, sí', async () => {
    await seed(ana, { status: 'error', reason: 'refusal', cost_usd: 0.005 });
    await seed(ana, { status: 'error', reason: 'max_tokens', cost_usd: 0.085 });
    await seed(ana, { status: 'error', reason: 'api', cost_usd: 0 });
    await seed(ana);
    ok(await reserve(ana));
    expect(await reserve(ana)).toEqual({ status: 'daily_limit' });
  });

  it('lo de ayer no cuenta para hoy', async () => {
    // Las 21:59 UTC del día 8 son las 23:59 en Madrid: todavía ayer.
    for (let n = 0; n < 3; n++) await seed(ana, { created_at: '2026-10-08T21:59:00Z' });
    expect((await reserve(ana)).status).toBe('ok');
  });

  it('cada usuario tiene su cuenta', async () => {
    for (let n = 0; n < 3; n++) await seed(ana);
    expect(await reserve(ana)).toEqual({ status: 'daily_limit' });
    expect((await reserve(luis)).status).toBe('ok');
  });
});

describe('tope mensual', () => {
  const earlier = { created_at: '2026-10-03T08:00:00Z' };

  it('corta cuando lo gastado en el mes llega al tope', async () => {
    await seed(ana, { ...earlier, cost_usd: 4.99 });
    expect((await reserve(ana)).status).toBe('ok');
    await t.db.query('delete from public.ai_usage where status = $1', ['pending']);
    await seed(ana, { ...earlier, cost_usd: 0.01 });
    expect(await reserve(ana)).toEqual({ status: 'monthly_budget' });
  });

  it('le cuenta todo lo cobrado, saliera bien o no', async () => {
    await seed(ana, { ...earlier, status: 'error', reason: 'max_tokens', cost_usd: 5 });
    expect(await reserve(ana)).toEqual({ status: 'monthly_budget' });
  });

  it('una reserva sin cerrar cuenta por su importe máximo', async () => {
    await seed(ana, { ...earlier, cost_usd: 4.95 });
    ok(await reserve(ana, { usd: 0.09 }));
    // 4,95 + 0,09 apartados: ya no cabe otra llamada aunque la primera no haya terminado.
    expect(await reserve(ana, { daily: 10 })).toEqual({ status: 'monthly_budget' });
  });

  it('el mes anterior no cuenta', async () => {
    await seed(ana, { created_at: '2026-09-30T21:59:00Z', cost_usd: 50 });
    expect((await reserve(ana)).status).toBe('ok');
  });
});

describe('ai_usage (RLS y permisos)', () => {
  it('el usuario lee sus filas, pero no puede insertar, cambiar ni borrar', async () => {
    await seed(ana, { cost_usd: 1.5 });
    ok(await reserve(ana));

    expect((await rows(ana)).rows).toHaveLength(2);
    expect((await rows(luis)).rows).toEqual([]);

    const updated = await t.asUser(ana, (tx) =>
      tx.query(`update public.ai_usage set cost_usd = 0, status = 'done' returning id`),
    );
    const deleted = await t.asUser(ana, (tx) =>
      tx.query('delete from public.ai_usage returning id'),
    );
    expect(updated.rows).toEqual([]);
    expect(deleted.rows).toEqual([]);
    await expect(
      t.asUser(ana, (tx) =>
        tx.query(
          `insert into public.ai_usage (user_id, model, status, reserved_usd)
           values ($1, 'm', 'done', 0)`,
          [ana],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    expect((await rows(ana)).rows.map((row) => [row.status, row.cost])).toEqual([
      ['done', 1.5],
      ['pending', 0],
    ]);
  });

  it('sin sesión no se lee ni se pueden llamar las funciones', async () => {
    await expect(t.asAnon((tx) => tx.query('select * from public.ai_usage'))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      t.asAnon((tx) => tx.query(`select public.ai_usage_reserve('m', 0.1, 3, 5, now(), now())`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asAnon((tx) =>
        tx.query(
          `select public.ai_usage_settle(gen_random_uuid(), gen_random_uuid(), 'done', 0, 0, 0)`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it('el gasto del mes sale del registro, solo con las llamadas que salieron bien', async () => {
    await seed(ana, { cost_usd: 1.5 });
    await seed(ana, { cost_usd: 0.5, created_at: '2026-10-03T08:00:00Z' });
    await seed(ana, { status: 'error', reason: 'api', cost_usd: 0 });
    await seed(luis, { cost_usd: 9 });
    const spend = await t.asUser(ana, (tx) =>
      tx.query<{ requests: number; cost: number }>(
        'select requests::int as requests, cost_usd::float as cost from public.v_ai_spend_month',
      ),
    );
    expect(spend.rows).toEqual([{ requests: 2, cost: 2 }]);
  });
});

describe('migración sobre datos que ya existían', () => {
  it('copia al registro los envíos a la IA hechos hasta entonces', async () => {
    const db = await createTestDb();
    const user = await db.createUser('owner@example.invalid');
    const insert = (values: string) =>
      db.db.query(
        `insert into public.writing_submissions
           (user_id, task_type, target_level, text, word_count, created_at,
            review_kind, status, model, cost_usd, input_tokens, output_tokens, feedback)
         values ($1, 'essay', 'B2', 'I am agree with this.', 5, ${values})`,
        [user],
      );
    await insert(
      `'2026-10-09T08:00:00Z', 'ai', 'done', 'claude-sonnet-5-5', 0.025, 2500, 2000, '{}'`,
    );
    await insert(
      `'2026-10-09T09:00:00Z', 'ai', 'error', 'claude-sonnet-5-5', 0.085, 2500, 8000, '{"error":"max_tokens"}'`,
    );
    await insert(
      `'2026-10-09T10:00:00Z', 'ai', 'pending', 'claude-sonnet-5-5', 0, null, null, null`,
    );
    await insert(`'2026-10-09T11:00:00Z', 'self', 'done', null, 0, null, null, '{}'`);

    // Como si la 0006 llegara ahora: se deshace y se vuelve a aplicar con esos datos dentro.
    await db.db.exec(`
      drop view public.v_ai_spend_month;
      drop function public.ai_usage_reserve(text, numeric, int, numeric, timestamptz, timestamptz);
      drop function public.ai_usage_settle(uuid, uuid, text, numeric, int, int);
      drop table public.ai_usage;
    `);
    await db.db.exec(
      readFileSync(path.join(process.cwd(), 'supabase', 'migrations', '0006_ai_usage.sql'), 'utf8'),
    );

    const copied = await db.db.query(
      `select status, reason, reserved_usd::float as reserved, cost_usd::float as cost,
              input_tokens, output_tokens, settle_hash is not null as open
       from public.ai_usage where user_id = $1 order by created_at`,
      [user],
    );
    expect(copied.rows).toEqual([
      {
        status: 'done',
        reason: null,
        reserved: 0.025,
        cost: 0.025,
        input_tokens: 2500,
        output_tokens: 2000,
        open: false,
      },
      {
        status: 'error',
        reason: 'max_tokens',
        reserved: 0.085,
        cost: 0.085,
        input_tokens: 2500,
        output_tokens: 8000,
        open: false,
      },
      // Un envío que se quedó a medias: gastó un intento y no costó nada.
      {
        status: 'error',
        reason: 'api',
        reserved: 0,
        cost: 0,
        input_tokens: null,
        output_tokens: null,
        open: false,
      },
    ]);
    await db.close();
  }, 60_000);
});
