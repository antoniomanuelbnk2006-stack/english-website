// Emulador de Supabase para los tests e2e: `tsx tests/support/supabase-emulator.ts`
//
// Habla lo justo de GoTrue (acceso con código) y de PostgREST (select, insert, upsert, update,
// delete y rpc) que usa la app, sobre un Postgres real en memoria con las migraciones del
// proyecto. Las consultas pasan por RLS como el usuario de la sesión, igual que en producción.
// Es una herramienta de test: no implementa todo Supabase ni sustituye a probar contra el real.
//
// Con EMULATOR_DATA_DIR (la demo, `pnpm demo`) la base de datos se guarda en esa carpeta y
// las sesiones siguen valiendo tras reiniciar; las rutas de control /__test/ se desactivan
// para que ningún test pueda borrar esos datos.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, renameSync } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { Transaction } from '@electric-sql/pglite';
import { createAnthropicStub } from './anthropic-stub';
import { wiktionaryStub } from './wiktionary-stub';
import { createTestDb, type TestDb } from './test-db';
import { derivedPassword } from '../../src/features/auth/lib/password';

const PORT = Number(process.env.EMULATOR_PORT ?? 54399);
const TEST_EMAIL = (process.env.ALLOWED_EMAIL ?? 'owner@example.invalid').toLowerCase();
/** Código OTP que el emulador acepta siempre (no envía correos). */
const TEST_OTP = '123456';
/** Contraseña de acceso en los tests (ADR-0026): solo vale si hay secreto configurado. */
const TEST_PASSWORD = process.env.EMULATOR_PASSWORD || 'contrasena-de-pruebas-e2e';
const LOGIN_CODE_PEPPER = process.env.LOGIN_CODE_PEPPER || undefined;
/** Código con el que «vuelve» el enlace del correo en los tests (flujo PKCE). */
const TEST_AUTH_CODE = 'e2e-auth-code-0001';
/** Email que ha pedido el correo de acceso y aún no ha canjeado su enlace. */
let pendingLink: string | null = null;
const JWT_SECRET = 'emulador-de-supabase-solo-para-tests';
/** Carpeta donde guardar los datos; sin ella, todo vive en memoria (los tests). */
const DATA_DIR = process.env.EMULATOR_DATA_DIR || undefined;
const REFRESH_TTL_S = 60 * 24 * 3600;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super(String(body.message ?? body.msg ?? status));
  }
}

// ───────────── JWT (HS256) ─────────────
const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function signJwt(payload: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest();
  return `${head}.${body}.${b64url(signature)}`;
}

function verifyJwt(
  token: string,
  use: 'access' | 'refresh' = 'access',
): { sub: string; email: string } | null {
  const [head, body, signature] = token.split('.');
  if (!head || !body || !signature) return null;
  const expected = createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub?: string;
      email?: string;
      exp?: number;
      token_use?: string;
    };
    if (!payload.sub || !payload.email || (payload.exp ?? 0) < Date.now() / 1000) return null;
    // Un token de renovación no sirve para llamar a la API, ni uno de acceso para renovar.
    if ((payload.token_use ?? 'access') !== use) return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

const bearer = (req: IncomingMessage) =>
  (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

// ───────────── Estado ─────────────
let testDb: TestDb;
/** Doble de la API de Claude (solo en los tests; la demo no lo sirve). */
const anthropic = createAnthropicStub();
/** tabla → columna → tipo SQL (para convertir los filtros de la URL). */
const columnTypes = new Map<string, Map<string, string>>();
const primaryKeys = new Map<string, string[]>();

const ident = (name: string): string => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new HttpError(400, { code: 'PGRST100', message: `identificador no válido: ${name}` });
  }
  return `"${name}"`;
};

async function loadCatalog(): Promise<void> {
  const columns = await testDb.db.query<{ tbl: string; col: string; type: string }>(
    `select c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as type
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v') and a.attnum > 0 and not a.attisdropped`,
  );
  for (const { tbl, col, type } of columns.rows) {
    const table = columnTypes.get(tbl) ?? new Map<string, string>();
    table.set(col, type);
    columnTypes.set(tbl, table);
  }
  const keys = await testDb.db.query<{ tbl: string; col: string }>(
    `select c.relname as tbl, a.attname as col
     from pg_index i
     join pg_class c on c.oid = i.indrelid
     join pg_namespace n on n.oid = c.relnamespace
     join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
     where i.indisprimary and n.nspname = 'public'
     order by array_position(i.indkey, a.attnum)`,
  );
  for (const { tbl, col } of keys.rows) {
    primaryKeys.set(tbl, [...(primaryKeys.get(tbl) ?? []), col]);
  }
}

async function userByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const result = await testDb.db.query<{ id: string; email: string }>(
    'select id, email from auth.users where email = $1',
    [email.toLowerCase()],
  );
  return result.rows[0] ?? null;
}

async function userById(id: string): Promise<{ id: string; email: string } | null> {
  const result = await testDb.db.query<{ id: string; email: string }>(
    'select id, email from auth.users where id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

function userJson(user: { id: string; email: string }) {
  const now = new Date().toISOString();
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: now,
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  };
}

function sessionJson(user: { id: string; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  // Firmado y sin estado: sigue valiendo aunque el emulador se reinicie (la demo).
  const refresh = signJwt({
    sub: user.id,
    email: user.email,
    token_use: 'refresh',
    iat: now,
    exp: now + REFRESH_TTL_S,
    jti: randomUUID(),
  });
  return {
    access_token: signJwt({
      sub: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      iat: now,
      exp: now + 3600,
      session_id: randomUUID(),
      is_anonymous: false,
    }),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refresh,
    user: userJson(user),
  };
}

// ───────────── GoTrue ─────────────
async function handleAuth(
  req: IncomingMessage,
  url: URL,
  body: Record<string, unknown>,
): Promise<{ status: number; json?: unknown }> {
  const route = url.pathname.replace('/auth/v1', '');

  if (route === '/otp' && req.method === 'POST') {
    const user = await userByEmail(String(body.email ?? ''));
    // Con el registro desactivado, Supabase rechaza los emails que no existen.
    if (!user) {
      throw new HttpError(422, { code: 'otp_disabled', msg: 'Signups not allowed for otp' });
    }
    pendingLink = user.email;
    return { status: 200, json: {} };
  }

  // A Supabase no llega la contraseña que se escribe, sino la que la app deriva con su secreto.
  if (
    route === '/token' &&
    req.method === 'POST' &&
    url.searchParams.get('grant_type') === 'password'
  ) {
    const user = await userByEmail(String(body.email ?? ''));
    const expected =
      user && LOGIN_CODE_PEPPER
        ? derivedPassword(LOGIN_CODE_PEPPER, user.email, TEST_PASSWORD)
        : null;
    if (!user || expected === null || body.password !== expected) {
      throw new HttpError(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    return { status: 200, json: sessionJson(user) };
  }

  // El enlace del correo: Supabase vuelve con un código y la app lo canjea junto con la mitad
  // que guardó el navegador al pedir el correo. El enlace vale una sola vez.
  if (
    route === '/token' &&
    req.method === 'POST' &&
    url.searchParams.get('grant_type') === 'pkce'
  ) {
    const user = pendingLink ? await userByEmail(pendingLink) : null;
    if (!user || body.auth_code !== TEST_AUTH_CODE || !body.code_verifier) {
      throw new HttpError(400, { code: 'flow_state_not_found', msg: 'invalid flow state' });
    }
    pendingLink = null;
    return { status: 200, json: sessionJson(user) };
  }

  if (route === '/verify' && req.method === 'POST') {
    const user = await userByEmail(String(body.email ?? ''));
    if (!user || body.token !== TEST_OTP) {
      throw new HttpError(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
    }
    return { status: 200, json: sessionJson(user) };
  }

  if (route === '/token' && req.method === 'POST') {
    const claims = verifyJwt(String(body.refresh_token ?? ''), 'refresh');
    const user = claims ? await userById(claims.sub) : null;
    if (!user) {
      throw new HttpError(400, { code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    }
    return { status: 200, json: sessionJson(user) };
  }

  if (route === '/user' && req.method === 'GET') {
    const claims = verifyJwt(bearer(req));
    if (!claims) throw new HttpError(401, { code: 'bad_jwt', msg: 'invalid JWT' });
    // Un token bien firmado de un usuario que ya no existe (el emulador se reinició o se
    // restableció la base de datos) no es una sesión válida: GoTrue responde igual.
    const user = await userById(claims.sub);
    if (!user) {
      throw new HttpError(403, {
        code: 'user_not_found',
        msg: 'User from sub claim in JWT does not exist',
      });
    }
    return { status: 200, json: userJson(user) };
  }

  if (route === '/logout' && req.method === 'POST') return { status: 204 };
  if (route === '/.well-known/jwks.json') return { status: 200, json: { keys: [] } };

  throw new HttpError(404, { msg: `ruta de auth no emulada: ${req.method} ${route}` });
}

// ───────────── PostgREST ─────────────
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
const OPERATORS: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

interface Sql {
  text: string;
  params: string[];
}

function typeOf(table: string, column: string): string {
  const type = columnTypes.get(table)?.get(column);
  if (!type) {
    throw new HttpError(400, {
      code: '42703',
      message: `column ${table}.${column} does not exist`,
    });
  }
  return type;
}

function buildWhere(table: string, url: URL, params: string[]): string {
  const clauses: string[] = [];
  for (const [column, raw] of url.searchParams) {
    if (RESERVED.has(column)) continue;
    const type = typeOf(table, column);
    const dot = raw.indexOf('.');
    const operator = raw.slice(0, dot);
    const value = raw.slice(dot + 1);

    if (operator === 'is') {
      if (value !== 'null') throw new HttpError(400, { message: `is.${value} no emulado` });
      clauses.push(`${ident(column)} is null`);
    } else if (operator === 'in') {
      const items = value
        .replace(/^\(|\)$/g, '')
        .split(',')
        .filter(Boolean);
      const marks = items.map((item) => {
        params.push(item.replace(/^"|"$/g, ''));
        return `cast($${params.length}::text as ${type})`;
      });
      clauses.push(`${ident(column)} in (${marks.join(', ') || 'null'})`);
    } else if (operator === 'like' || operator === 'ilike') {
      // PostgREST admite «*» como comodín además de «%».
      params.push(value.replace(/\*/g, '%'));
      clauses.push(`${ident(column)}::text ${operator} $${params.length}::text`);
    } else if (OPERATORS[operator]) {
      params.push(value);
      clauses.push(
        `${ident(column)} ${OPERATORS[operator]} cast($${params.length}::text as ${type})`,
      );
    } else {
      throw new HttpError(400, { message: `operador no emulado: ${operator}` });
    }
  }
  return clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '';
}

function selectList(url: URL): string {
  const select = url.searchParams.get('select');
  if (!select || select === '*') return '*';
  return select
    .split(',')
    .map((column) => ident(column.trim()))
    .join(', ');
}

function buildTail(url: URL): string {
  let tail = '';
  const order = url.searchParams.get('order');
  if (order) {
    const parts = order.split(',').map((part) => {
      const [column = '', direction = 'asc'] = part.split('.');
      return `${ident(column)} ${direction === 'desc' ? 'desc' : 'asc'}`;
    });
    tail += ` order by ${parts.join(', ')}`;
  }
  const limit = url.searchParams.get('limit');
  if (limit) tail += ` limit ${Number.parseInt(limit, 10)}`;
  const offset = url.searchParams.get('offset');
  if (offset) tail += ` offset ${Number.parseInt(offset, 10)}`;
  return tail;
}

/** Envuelve una consulta para que Postgres devuelva el JSON tal como lo daría PostgREST. */
const asJson = (inner: string) =>
  `select coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb)::text as body, count(*)::int as n from (${inner}) q`;

function buildQuery(method: string, table: string, url: URL, body: unknown, prefer: string): Sql {
  const params: string[] = [];
  const tableRef = `public.${ident(table)}`;
  const columns = selectList(url);
  // Postgres solo admite un CTE que modifica datos en el nivel superior de la consulta.
  const returning = (dml: string) =>
    `with changed as (${dml} returning *) ${asJson(`select ${columns} from changed`)}`;

  if (method === 'GET' || method === 'HEAD') {
    const where = buildWhere(table, url, params);
    return { text: asJson(`select ${columns} from ${tableRef}${where}${buildTail(url)}`), params };
  }

  if (method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    const keys = [...new Set(rows.flatMap((row) => Object.keys(row as object)))];
    for (const key of keys) typeOf(table, key);
    const list = keys.map(ident).join(', ');
    params.push(JSON.stringify(rows));
    // jsonb_populate_recordset convierte cada valor al tipo de su columna (enums, arrays, jsonb…).
    let dml = `insert into ${tableRef} (${list}) select ${list} from jsonb_populate_recordset(null::${tableRef}, $1::text::jsonb)`;

    const conflict = url.searchParams.get('on_conflict');
    const resolution = /resolution=(merge|ignore)-duplicates/.exec(prefer)?.[1];
    if (resolution) {
      const target = (conflict ? conflict.split(',') : (primaryKeys.get(table) ?? [])).map((c) =>
        ident(c.trim()),
      );
      const updates = keys
        .filter((key) => !target.includes(ident(key)))
        .map((key) => `${ident(key)} = excluded.${ident(key)}`);
      dml +=
        resolution === 'merge' && updates.length > 0
          ? ` on conflict (${target.join(', ')}) do update set ${updates.join(', ')}`
          : ` on conflict (${target.join(', ')}) do nothing`;
    }
    return { text: returning(dml), params };
  }

  if (method === 'PATCH') {
    const keys = Object.keys(body as object);
    for (const key of keys) typeOf(table, key);
    const list = keys.map(ident).join(', ');
    params.push(JSON.stringify(body));
    const where = buildWhere(table, url, params);
    const dml = `update ${tableRef} set (${list}) = (select ${list} from jsonb_populate_record(null::${tableRef}, $1::text::jsonb))${where}`;
    return { text: returning(dml), params };
  }

  if (method === 'DELETE') {
    const where = buildWhere(table, url, params);
    return { text: returning(`delete from ${tableRef}${where}`), params };
  }

  throw new HttpError(405, { message: `método no emulado: ${method}` });
}

async function buildRpc(
  name: string,
  body: Record<string, unknown>,
): Promise<Sql & { isVoid: boolean; isScalar: boolean }> {
  const found = await testDb.db.query<{
    args: string[] | null;
    types: string[];
    ret: string;
    scalar: boolean;
  }>(
    `select p.proargnames as args,
            array(select format_type(t, null) from unnest(p.proargtypes::oid[]) as t) as types,
            format_type(p.prorettype, null) as ret,
            (rt.typtype <> 'c' and not p.proretset) as scalar
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join pg_type rt on rt.oid = p.prorettype
     where n.nspname = 'public' and p.proname = $1`,
    [name],
  );
  const fn = found.rows[0];
  if (!fn) {
    throw new HttpError(404, { code: 'PGRST202', message: `no existe la función public.${name}` });
  }
  const params: string[] = [];
  const args = (fn.args ?? []).map((arg, index) => {
    const value = body[arg];
    params.push(
      typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value),
    );
    return `${ident(arg)} => cast($${params.length}::text as ${fn.types[index]})`;
  });
  const call = `public.${ident(name)}(${args.join(', ')})`;
  const isVoid = fn.ret === 'void';
  if (isVoid) return { text: `select ${call}`, params, isVoid, isScalar: false };
  // Una función que devuelve un valor suelto (int, text…) responde con ese valor, sin envolver.
  if (fn.scalar) {
    return { text: `select to_jsonb(${call})::text as body`, params, isVoid, isScalar: true };
  }
  return { text: asJson(`select * from ${call}`), params, isVoid, isScalar: false };
}

function withSession<T>(req: IncomingMessage, run: (tx: Transaction) => Promise<T>): Promise<T> {
  const claims = verifyJwt(bearer(req));
  return claims ? testDb.asUser(claims.sub, run) : testDb.asAnon(run);
}

async function handleRest(
  req: IncomingMessage,
  url: URL,
  body: unknown,
): Promise<{ status: number; json?: unknown; headers?: Record<string, string> }> {
  const route = url.pathname.replace('/rest/v1/', '');
  const prefer = String(req.headers.prefer ?? '');
  const method = req.method ?? 'GET';

  if (route.startsWith('rpc/')) {
    const sql = await buildRpc(route.slice(4), (body ?? {}) as Record<string, unknown>);
    const result = await withSession(req, (tx) => tx.query<{ body: string }>(sql.text, sql.params));
    if (sql.isVoid) return { status: 204 };
    if (sql.isScalar) return { status: 200, json: JSON.parse(result.rows[0]?.body ?? 'null') };
    const rows = JSON.parse(result.rows[0]?.body ?? '[]') as unknown[];
    // Una función que devuelve una fila (no un conjunto) responde con un objeto.
    return { status: 200, json: rows.length === 1 ? rows[0] : rows };
  }

  if (!columnTypes.has(route)) {
    throw new HttpError(404, {
      code: '42P01',
      message: `relation "public.${route}" does not exist`,
    });
  }

  const sql = buildQuery(method, route, url, body, prefer);
  const result = await withSession(req, (tx) =>
    tx.query<{ body: string; n: number }>(sql.text, sql.params),
  );
  const rows = JSON.parse(result.rows[0]?.body ?? '[]') as unknown[];
  const headers: Record<string, string> = {};
  if (prefer.includes('count=exact')) {
    // El total no depende de limit/offset: se cuenta aparte, como hace PostgREST.
    let total = rows.length;
    if (method === 'GET' || method === 'HEAD') {
      const countParams: string[] = [];
      const where = buildWhere(route, url, countParams);
      const counted = await withSession(req, (tx) =>
        tx.query<{ n: number }>(
          `select count(*)::int as n from public.${ident(route)}${where}`,
          countParams,
        ),
      );
      total = counted.rows[0]?.n ?? 0;
    }
    const offset = Number.parseInt(url.searchParams.get('offset') ?? '0', 10);
    headers['Content-Range'] =
      rows.length > 0 ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
  }

  if (method === 'HEAD') return { status: 200, headers };
  if (method !== 'GET' && !prefer.includes('return=representation')) {
    return { status: method === 'POST' ? 201 : 204, headers };
  }

  if (String(req.headers.accept ?? '').includes('vnd.pgrst.object')) {
    if (rows.length !== 1) {
      throw new HttpError(406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: `The result contains ${rows.length} rows`,
      });
    }
    return { status: method === 'POST' ? 201 : 200, json: rows[0], headers };
  }
  return { status: method === 'POST' ? 201 : 200, json: rows, headers };
}

// ───────────── Control de los tests ─────────────
async function handleTestControl(
  url: URL,
  body: Record<string, unknown>,
): Promise<{ status: number; json?: unknown }> {
  if (url.pathname === '/__test/reset') {
    // Borra y recrea al usuario: todos sus datos desaparecen en cascada.
    await testDb.db.query('delete from auth.users');
    anthropic.reset();
    const id = await testDb.createUser(TEST_EMAIL);
    // Los tests parten de un usuario que ya eligió nivel (B1); el primer acceso real, no:
    // ese flujo tiene su propio test, que borra el nivel antes de entrar.
    await testDb.db.query(`update public.profiles set declared_level = 'B1' where id = $1`, [id]);
    return { status: 200, json: { id, email: TEST_EMAIL } };
  }
  if (url.pathname === '/__test/query') {
    // Para comprobar en un test qué ha quedado guardado (sin RLS: es el «superusuario» del test).
    const result = await testDb.db.query(String(body.sql), (body.params as unknown[]) ?? []);
    return {
      status: 200,
      json: JSON.parse(
        JSON.stringify(result.rows, (_, v) => (typeof v === 'bigint' ? Number(v) : v)),
      ),
    };
  }
  throw new HttpError(404, { message: 'ruta de control desconocida' });
}

// ───────────── Servidor ─────────────
function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text === '') return resolve(undefined);
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, { message: 'cuerpo JSON no válido' }));
      }
    });
  });
}

function pgStatus(code: unknown): number {
  if (code === '42501') return 403; // RLS o permisos
  if (code === '23505') return 409; // clave duplicada
  return 400;
}

interface Reply {
  status: number;
  json?: unknown;
  headers?: Record<string, string>;
}

function route(req: IncomingMessage, url: URL, body: unknown): Promise<Reply> {
  const object = (body ?? {}) as Record<string, unknown>;
  if (url.pathname.startsWith('/auth/v1')) return handleAuth(req, url, object);
  if (url.pathname.startsWith('/rest/v1/')) return handleRest(req, url, body);
  if (url.pathname === '/anthropic/v1/messages' && req.method === 'POST' && !DATA_DIR) {
    return Promise.resolve(anthropic.messages(req, body));
  }
  // El diccionario de consulta de los tests: nunca se llama al Wiktionary real.
  if (url.pathname.startsWith('/wiktionary/') && req.method === 'GET' && !DATA_DIR) {
    return Promise.resolve(wiktionaryStub(url));
  }
  if (url.pathname.startsWith('/__test/')) {
    // Con datos guardados no hay rutas de control: un test que se conecte por error a la
    // demo debe fallar, no borrar lo que el usuario lleva hecho.
    if (DATA_DIR) {
      throw new HttpError(403, {
        message: 'rutas de control desactivadas: el emulador guarda datos (demo)',
      });
    }
    if (url.pathname === '/__test/ai') {
      return Promise.resolve(anthropic.control(req.method, object));
    }
    return handleTestControl(url, object);
  }
  if (url.pathname === '/health') return Promise.resolve({ status: 200, json: { ok: true } });
  throw new HttpError(404, { message: `ruta no emulada: ${url.pathname}` });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  let status = 200;
  let json: unknown;
  let headers: Record<string, string> = {};

  try {
    const body = await readBody(req);
    const result = await route(req, url, body);
    status = result.status;
    json = result.json;
    headers = result.headers ?? {};
  } catch (error) {
    if (error instanceof HttpError) {
      status = error.status;
      json = error.body;
    } else {
      const pg = error as { code?: string; message?: string; detail?: string; hint?: string };
      status = pgStatus(pg.code);
      json = {
        code: pg.code ?? 'EMULATOR',
        message: pg.message ?? String(error),
        details: pg.detail ?? null,
        hint: pg.hint ?? null,
      };
      if (!pg.code) console.error('[emulador]', req.method, url.pathname, error);
    }
  }

  const payload = json === undefined || req.method === 'HEAD' ? '' : JSON.stringify(json);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

/** Abre la base de datos. Si la carpeta guardada no se puede abrir, se aparta y se empieza de cero. */
async function openDb(): Promise<TestDb> {
  if (!DATA_DIR) return createTestDb();
  try {
    return await createTestDb(DATA_DIR);
  } catch (error) {
    if (!existsSync(DATA_DIR)) throw error;
    const aside = `${DATA_DIR}.rota-${Date.now()}`;
    renameSync(DATA_DIR, aside);
    console.error(
      `[emulador] No se han podido abrir los datos guardados (${String(error)}).\n` +
        `           Se han apartado en ${aside} y se empieza de cero.`,
    );
    return createTestDb(DATA_DIR);
  }
}

async function main(): Promise<void> {
  testDb = await openDb();
  await loadCatalog();
  // Con datos guardados el usuario ya existe: no se toca.
  if (!(await userByEmail(TEST_EMAIL))) await testDb.createUser(TEST_EMAIL);

  const server = http
    .createServer((req, res) => {
      void handle(req, res);
    })
    .listen(PORT, '127.0.0.1', () => {
      console.log(
        `Emulador de Supabase en http://127.0.0.1:${PORT} · usuario ${TEST_EMAIL} · código ${TEST_OTP}` +
          (DATA_DIR ? ` · datos en ${DATA_DIR}` : ' · datos en memoria'),
      );
    });

  // Cierre ordenado: la base de datos guardada queda bien cerrada.
  const shutdown = () => {
    server.close();
    void testDb.close().finally(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

void main();
