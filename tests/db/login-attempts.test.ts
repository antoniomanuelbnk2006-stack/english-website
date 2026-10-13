import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../support/test-db';

// Migración 0005: bloqueo por intentos de acceso (ADR-0024).

let t: TestDb;
let ana: string;
let luis: string;

interface Gate {
  allowed: boolean;
  retry_after_s: number;
}

beforeAll(async () => {
  t = await createTestDb();
  ana = await t.createUser('ana@example.test');
  luis = await t.createUser('luis@example.test');
});

afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.db.query('delete from public.login_attempts');
});

/** Un intento de acceso, como lo anota la app: sin sesión. */
const begin = (email: string) =>
  t.asAnon(async (tx) => {
    const result = await tx.query<{ gate: Gate }>('select public.login_attempt_begin($1) as gate', [
      email,
    ]);
    return result.rows[0]!.gate;
  });

/** Da por pasado el bloqueo en curso sin esperar de verdad. */
const expireLock = () =>
  t.db.query(`update public.login_attempts set locked_until = now() - interval '1 second'`);

const rowOf = async (user: string) => {
  const result = await t.db.query<{ attempts: number; locked: boolean; minutes: number | null }>(
    `select attempts, coalesce(locked_until > now(), false) as locked,
            round(extract(epoch from locked_until - last_attempt_at) / 60)::int as minutes
     from public.login_attempts where user_id = $1`,
    [user],
  );
  return result.rows[0];
};

describe('login_attempt_begin', () => {
  it('admite cinco intentos seguidos y cierra el acceso un minuto', async () => {
    for (let n = 1; n <= 4; n++) {
      expect(await begin('ana@example.test')).toEqual({ allowed: true, retry_after_s: 0 });
      expect(await rowOf(ana)).toMatchObject({ attempts: n, locked: false });
    }
    expect(await begin('ana@example.test')).toEqual({ allowed: true, retry_after_s: 0 });
    expect(await rowOf(ana)).toEqual({ attempts: 5, locked: true, minutes: 1 });

    const refused = await begin('ana@example.test');
    expect(refused.allowed).toBe(false);
    expect(refused.retry_after_s).toBeGreaterThan(50);
    expect(refused.retry_after_s).toBeLessThanOrEqual(60);
    // Un intento rechazado no cuenta ni alarga el bloqueo.
    expect(await rowOf(ana)).toEqual({ attempts: 5, locked: true, minutes: 1 });
  });

  it('cada intento posterior dobla la espera, hasta 24 horas', async () => {
    const waits: (number | null | undefined)[] = [];
    for (let n = 1; n <= 18; n++) {
      await expireLock();
      expect((await begin('ana@example.test')).allowed).toBe(true);
      waits.push((await rowOf(ana))?.minutes);
    }
    expect(waits).toEqual([
      ...[null, null, null, null],
      ...[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
      ...[1440, 1440, 1440],
    ]);
  });

  it('no distingue mayúsculas ni espacios en el email', async () => {
    await begin('  ANA@Example.Test ');
    expect(await rowOf(ana)).toMatchObject({ attempts: 1 });
  });

  it('un email sin cuenta no deja rastro y nunca se bloquea', async () => {
    for (let n = 0; n < 8; n++) {
      expect(await begin('nadie@example.test')).toEqual({ allowed: true, retry_after_s: 0 });
    }
    const rows = await t.db.query('select user_id from public.login_attempts');
    expect(rows.rows).toEqual([]);
  });

  it('el bloqueo de un usuario no afecta a otro', async () => {
    for (let n = 0; n < 5; n++) await begin('ana@example.test');
    expect((await begin('ana@example.test')).allowed).toBe(false);
    expect((await begin('luis@example.test')).allowed).toBe(true);
  });
});

describe('login_attempt_clear', () => {
  it('con sesión, pone la cuenta a cero y levanta el bloqueo', async () => {
    for (let n = 0; n < 5; n++) await begin('ana@example.test');
    await begin('luis@example.test');

    await t.asUser(ana, (tx) => tx.query('select public.login_attempt_clear()'));
    expect(await rowOf(ana)).toBeUndefined();
    // Solo la propia.
    expect(await rowOf(luis)).toMatchObject({ attempts: 1 });
    expect((await begin('ana@example.test')).allowed).toBe(true);
  });

  it('sin sesión no se puede llamar: quien no ha entrado no borra los intentos', async () => {
    await expect(t.asAnon((tx) => tx.query('select public.login_attempt_clear()'))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe('login_attempts (RLS)', () => {
  beforeEach(async () => {
    for (let n = 0; n < 5; n++) await begin('ana@example.test');
  });

  it('cada usuario lee su fila y ninguna más', async () => {
    const mine = await t.asUser(ana, (tx) =>
      tx.query('select user_id, attempts from public.login_attempts'),
    );
    expect(mine.rows).toEqual([{ user_id: ana, attempts: 5 }]);
    const other = await t.asUser(luis, (tx) => tx.query('select * from public.login_attempts'));
    expect(other.rows).toEqual([]);
    await expect(t.asAnon((tx) => tx.query('select * from public.login_attempts'))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('ni con sesión se puede tocar la cuenta a mano', async () => {
    const updated = await t.asUser(ana, (tx) =>
      tx.query('update public.login_attempts set attempts = 0, locked_until = null returning *'),
    );
    const deleted = await t.asUser(ana, (tx) =>
      tx.query('delete from public.login_attempts returning *'),
    );
    expect(updated.rows).toEqual([]);
    expect(deleted.rows).toEqual([]);
    await expect(
      t.asUser(luis, (tx) =>
        tx.query('insert into public.login_attempts (user_id, attempts) values ($1, 0)', [luis]),
      ),
    ).rejects.toThrow(/row-level security/);
    expect(await rowOf(ana)).toMatchObject({ attempts: 5, locked: true });
  });
});
