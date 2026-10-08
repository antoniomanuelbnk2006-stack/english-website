import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFicha, GRAMMAR_SECTIONS, parseFicha } from './grammar-schema';

const practice = (n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `  - id: p${i + 1}\n    prompt: "She ___ here."\n    answers: ["lives"]\n    rule_es: "Tercera persona."`,
  ).join('\n');

const ficha = ({
  id = 'b1.sample',
  level = 'B1',
  items = 5,
  sections = [...GRAMMAR_SECTIONS] as string[],
  related = '[]',
} = {}) =>
  `---
id: ${id}
level: ${level}
title: "Sample"
summary_es: "Una ficha de prueba."
skills: [reading]
related: ${related}
examples:
  - en: "She lives here."
    es: "Vive aquí."
  - en: "They live there."
    es: "Viven allí."
practice:
${practice(items)}
---

${sections.map((title) => `## ${title}\n\nTexto.`).join('\n\n')}
`;

const expected = { id: 'b1.sample', level: 'b1' };

describe('parseFicha', () => {
  it('separa el frontmatter del cuerpo y lo valida', () => {
    const parsed = parseFicha(ficha());
    expect(parsed.meta).toMatchObject({ id: 'b1.sample', level: 'B1', related: [] });
    expect(parsed.meta.practice).toHaveLength(5);
    expect(parsed.body.startsWith('\n## En una frase')).toBe(true);
    expect(parsed.body).not.toContain('summary_es');
  });

  it('acepta finales de línea de Windows', () => {
    expect(parseFicha(ficha().replace(/\n/g, '\r\n')).meta.id).toBe('b1.sample');
  });

  it('rechaza una ficha sin frontmatter', () => {
    expect(() => parseFicha('## En una frase\n\nHola.')).toThrow(/frontmatter/);
  });

  it('exige exactamente cinco ítems de práctica', () => {
    expect(() => parseFicha(ficha({ items: 4 }))).toThrow();
    expect(() => parseFicha(ficha({ items: 6 }))).toThrow();
  });

  it('exige que cada ítem marque su hueco con ___', () => {
    expect(() => parseFicha(ficha().replace('She ___ here.', 'She lives here.'))).toThrow(/___/);
  });

  it('rechaza un id que no tenga la forma nivel.slug', () => {
    expect(() => parseFicha(ficha({ id: 'Present Perfect' }))).toThrow();
  });
});

describe('checkFicha', () => {
  it('no encuentra problemas en una ficha correcta', () => {
    expect(checkFicha(parseFicha(ficha()), expected)).toEqual([]);
  });

  it('avisa si el id o el nivel no coinciden con el fichero y su carpeta', () => {
    expect(checkFicha(parseFicha(ficha()), { id: 'b1.other', level: 'b1' })).toHaveLength(1);
    expect(checkFicha(parseFicha(ficha()), { id: 'b1.sample', level: 'b2' })).toHaveLength(1);
    expect(
      checkFicha(parseFicha(ficha({ id: 'b2.sample' })), { id: 'b2.sample', level: 'b1' }).join(),
    ).toMatch(/debe empezar por «b1\.»/);
  });

  it('avisa de las secciones que faltan', () => {
    const issues = checkFicha(
      parseFicha(ficha({ sections: ['En una frase', 'Forma', 'Uso'] })),
      expected,
    );
    expect(issues.join()).toMatch(/faltan secciones: Contraste con el español, Errores típicos/);
  });

  it('avisa si las secciones están desordenadas', () => {
    const sections = [...GRAMMAR_SECTIONS].reverse();
    expect(checkFicha(parseFicha(ficha({ sections })), expected).join()).toMatch(/orden/);
  });

  it('avisa de ids de práctica repetidos y de ítems con más de un hueco', () => {
    const repeated = ficha().replace('id: p2', 'id: p1');
    expect(checkFicha(parseFicha(repeated), expected).join()).toMatch(/mismo id/);
    const twoGaps = ficha().replace('She ___ here.', '___ she ___ here?');
    expect(checkFicha(parseFicha(twoGaps), expected).join()).toMatch(/un solo hueco/);
  });

  it('avisa si la ficha se enlaza a sí misma', () => {
    const issues = checkFicha(parseFicha(ficha({ related: '[b1.sample]' })), expected);
    expect(issues.join()).toMatch(/sí misma/);
  });
});

describe('fichas del repositorio', () => {
  const root = path.join(process.cwd(), 'content', 'grammar');
  const files = readdirSync(root).flatMap((level) =>
    readdirSync(path.join(root, level))
      .filter((name) => name.endsWith('.mdx'))
      .map((name) => ({ level, id: name.slice(0, -4), file: path.join(root, level, name) })),
  );

  it('hay al menos una ficha por nivel, y las cinco de B1 del MVP', () => {
    expect(files.map((f) => f.id).sort()).toEqual([
      'a1.present-simple',
      'a2.past-simple',
      'b1.linkers',
      'b1.passive-present-past',
      'b1.phrasal-verbs-separable',
      'b1.present-perfect-vs-past-simple',
      'b1.relative-clauses-defining',
      'b2.linking-contrast-concession',
      'c1.hedging-distancing',
      'c2.figurative-language',
    ]);
  });

  it.each(files)('$id cumple el esquema y las reglas', ({ id, level, file }) => {
    const parsed = parseFicha(readFileSync(file, 'utf8'));
    expect(checkFicha(parsed, { id, level })).toEqual([]);
    // La respuesta que se enseña al corregir no puede estar ya en el enunciado.
    for (const item of parsed.meta.practice) {
      expect(item.prompt.toLowerCase()).not.toContain(` ${item.answers[0]?.toLowerCase()} `);
    }
  });
});
