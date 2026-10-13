import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Segunda barrera tras src/proxy.ts (docs/04-arquitectura/07-seguridad-y-privacidad.md §2): cada
// pantalla privada, cada Server Action y cada Route Handler comprueba la sesión por su cuenta.
// El proxy no basta (su `matcher` puede dejar huecos) y el layout tampoco (no se vuelve a
// ejecutar al navegar entre pantallas hermanas). Estos tests leen el código: una pantalla o
// una acción nueva que se olvide de la comprobación los rompe.

const SRC = path.join(process.cwd(), 'src');

function walk(dir: string, keep: (file: string) => boolean): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, keep);
    return keep(full) ? [full] : [];
  });
}

const relative = (file: string) => path.relative(SRC, file).replaceAll('\\', '/');

describe('pantallas privadas (src/app/(app))', () => {
  const pages = walk(path.join(SRC, 'app', '(app)'), (file) => path.basename(file) === 'page.tsx');

  it('están todas a la vista', () => {
    expect(pages.length).toBeGreaterThanOrEqual(28);
  });

  it.each(pages.map((file) => [relative(file), file]))(
    '%s comprueba la sesión antes de hacer nada',
    (_, file) => {
      const source = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
      const component = source.slice(source.indexOf('export default async function '));
      // La primera sentencia del componente: lo que va tras el `) {` que abre su cuerpo.
      const body = component.slice(component.indexOf(') {\n') + ') {\n'.length);
      expect(body.trimStart().split('\n')[0]).toBe('await getSessionOrRedirect();');
      expect(source).toContain("import { getSessionOrRedirect } from '@/lib/auth';");
    },
  );
});

describe('Server Actions', () => {
  /** Las del acceso son públicas por fuerza: se usan para entrar. */
  const PUBLIC = new Set(['features/auth/server/actions.ts']);
  const files = walk(path.join(SRC, 'features'), (file) => {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts')) return false;
    return /^'use server';/.test(readFileSync(file, 'utf8'));
  }).filter((file) => !PUBLIC.has(relative(file)));

  const actions = files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return source
      .split(/^export async function /m)
      .slice(1)
      .map((chunk) => [`${relative(file)} · ${/^\w+/.exec(chunk)?.[0]}`, chunk] as const);
  });

  it('están todas a la vista', () => {
    expect(files.length).toBeGreaterThanOrEqual(13);
    expect(actions.length).toBeGreaterThanOrEqual(26);
  });

  it.each(actions)('%s exige sesión', (_, chunk) => {
    expect(chunk).toMatch(
      /const session = await requireUser\(\);\s+if \(!session\.ok\) return fail\('unauthorized'\);/,
    );
  });
});

describe('Route Handlers', () => {
  /** La llegada desde el enlace del correo es pública: es una forma de entrar. */
  const PUBLIC = new Set(['app/auth/confirm/route.ts']);
  const handlers = walk(path.join(SRC, 'app'), (file) => path.basename(file) === 'route.ts').filter(
    (file) => !PUBLIC.has(relative(file)),
  );

  it.each(handlers.map((file) => [relative(file), file]))('%s exige sesión', (_, file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toMatch(/const session = await requireUser\(\);\s+if \(!session\.ok\) return /);
  });
});
