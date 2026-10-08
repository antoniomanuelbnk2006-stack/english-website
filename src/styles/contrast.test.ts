import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Contraste WCAG de los tokens de color en cada tema
// (docs/03-producto/05-sistema-de-diseno.md §2: texto principal ≥ 7:1, el resto ≥ 4,5:1).

const css = readFileSync(path.join(process.cwd(), 'src', 'styles', 'globals.css'), 'utf8');

/** Variables `--nombre: #hex` del bloque que empieza por `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`no se encuentra el bloque ${selector}`);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (match[1] && match[2]) found[match[1]] = match[2];
  }
  return found;
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

const THEMES = {
  oscuro: tokens(`[data-theme='dark'] {`),
  claro: tokens(`[data-theme='light'] {`),
  papel: tokens(`[data-theme='paper'] {`),
};

const BACKGROUNDS = ['bg', 'surface', 'surface-2'];
/** Colores que se usan como texto sobre cualquiera de los fondos. */
const TEXT_COLORS = ['text-muted', 'accent', 'success', 'warning', 'danger'];

describe.each(Object.entries(THEMES))('tema %s', (_name, theme) => {
  const hex = (token: string): string => {
    const value = theme[token];
    if (!value) throw new Error(`falta el token --${token}`);
    return value;
  };

  it.each(BACKGROUNDS)('el texto principal alcanza 7:1 sobre --%s', (background) => {
    expect(contrast(hex('text'), hex(background))).toBeGreaterThanOrEqual(7);
  });

  it.each(TEXT_COLORS.flatMap((color) => BACKGROUNDS.map((bg) => [color, bg] as const)))(
    '--%s alcanza 4,5:1 sobre --%s',
    (color, background) => {
      expect(contrast(hex(color), hex(background))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('el texto sobre el color de acción alcanza 4,5:1 (también al pasar el ratón)', () => {
    expect(contrast(hex('accent-contrast'), hex('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hex('accent-contrast'), hex('accent-strong'))).toBeGreaterThanOrEqual(4.5);
  });

  it('el anillo de foco se distingue del fondo (3:1)', () => {
    for (const background of BACKGROUNDS) {
      expect(contrast(hex('focus'), hex(background))).toBeGreaterThanOrEqual(3);
    }
  });
});
