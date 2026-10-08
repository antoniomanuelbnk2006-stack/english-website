import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../support/test-db';

// La demo (`pnpm demo`) guarda la base de datos en una carpeta: al volver a abrirla, los datos
// siguen ahí y las migraciones no se aplican dos veces.

const dir = mkdtempSync(path.join(tmpdir(), 'senal-db-'));
const dataDir = path.join(dir, 'pgdata');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('base de datos guardada en disco', () => {
  it('conserva el usuario y sus datos al volver a abrirla', async () => {
    const first = await createTestDb(dataDir);
    const userId = await first.createUser('owner@example.invalid');
    await first.asUser(userId, (tx) =>
      tx.query(`update public.profiles set declared_level = 'B2' where id = $1`, [userId]),
    );
    await first.close();

    const second = await createTestDb(dataDir);
    const profile = await second.asUser(userId, (tx) =>
      tx.query<{ declared_level: string }>('select declared_level from public.profiles'),
    );
    expect(profile.rows).toEqual([{ declared_level: 'B2' }]);

    // Cada migración consta una sola vez, y la base sigue admitiendo escrituras.
    const log = await second.db.query<{ name: string; n: number }>(
      'select name, count(*)::int as n from emulator.migrations group by name order by name',
    );
    expect(log.rows.every((row) => row.n === 1)).toBe(true);
    expect(log.rows.map((row) => row.name)).toContain('supabase-shim');
    expect(log.rows.some((row) => row.name.endsWith('.sql'))).toBe(true);
    await second.asUser(userId, (tx) =>
      tx.query(`update public.profiles set declared_level = 'C1' where id = $1`, [userId]),
    );
    await second.close();
  }, 60_000);
});
