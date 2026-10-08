import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';

// Postgres real en memoria (PGlite) con las migraciones del proyecto aplicadas tal cual.
// Sirve para probar SQL, RLS y funciones sin Docker, y como base del emulador de Supabase
// de los tests e2e. No sustituye a probar contra el proyecto real antes de desplegar.

/** Lo mínimo de Supabase que las migraciones dan por hecho: roles, esquema auth y auth.uid(). */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique not null,
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
`;

/** Permisos que Supabase concede por defecto a sus roles sobre el esquema public. */
const DEFAULT_GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage, select on all sequences in schema public to authenticated;
`;

export interface TestDb {
  db: PGlite;
  /** Crea un usuario en auth.users (dispara handle_new_user) y devuelve su id. */
  createUser: (email: string) => Promise<string>;
  /** Ejecuta `run` como ese usuario: rol authenticated y auth.uid() = userId, con RLS activo. */
  asUser: <T>(userId: string, run: (tx: Transaction) => Promise<T>) => Promise<T>;
  /** Como un visitante sin sesión (rol anon). */
  asAnon: <T>(run: (tx: Transaction) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);

  const dir = path.join(process.cwd(), 'supabase', 'migrations');
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  await db.exec(DEFAULT_GRANTS);

  const withRole = <T>(role: string, claims: object, run: (tx: Transaction) => Promise<T>) =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
      return run(tx);
    });

  return {
    db,
    createUser: async (email) => {
      const result = await db.query<{ id: string }>(
        'insert into auth.users (email) values ($1) returning id',
        [email],
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('no se pudo crear el usuario de prueba');
      return id;
    },
    asUser: (userId, run) => withRole('authenticated', { sub: userId, role: 'authenticated' }, run),
    asAnon: (run) => withRole('anon', { role: 'anon' }, run),
    close: () => db.close(),
  };
}
