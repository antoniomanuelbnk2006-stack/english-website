import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_THEMES } from '@/features/theme/lib/examples';

// Contraste WCAG de los tokens de color en cada tema (design-system/senal/MASTER.md §2 y §7:
// texto ≥ 4,5:1; foco y bordes que señalan un estado ≥ 3:1). El tema oscuro es la paleta de
// MASTER tal cual; claro y papel son derivados y tienen que cumplir lo mismo.

const read = (...segments: string[]) => readFileSync(path.join(process.cwd(), ...segments), 'utf8');
const css = read('src', 'styles', 'globals.css');

/** Variables `--nombre: #hex` del bloque de `source` que empieza por `selector`. */
function tokens(selector: string, source = css): Record<string, string> {
  const start = source.indexOf(selector);
  if (start < 0) throw new Error(`no se encuentra el bloque ${selector}`);
  const block = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  const found: Record<string, string> = {};
  for (const match of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    if (match[1] && match[2]) found[match[1]] = match[2].toLowerCase();
  }
  return found;
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const channel = (offset: number) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
}

function luminance([r, g, b]: Rgb): number {
  const linear = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(foreground: Rgb, background: Rgb): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** `color-mix(in srgb, color alpha, transparent)` pintado sobre `background`. */
function tint(color: Rgb, background: Rgb, alpha: number): Rgb {
  return color.map((value, i) => value * alpha + (background[i] ?? 0) * (1 - alpha)) as Rgb;
}

const THEMES = {
  oscuro: tokens(`[data-theme='dark'] {`),
  claro: tokens(`[data-theme='light'] {`),
  papel: tokens(`[data-theme='paper'] {`),
};

// Los ejemplos del tema personalizado (ADR-0033) se ofrecen tal cual: cumplen lo mismo, y dan
// todos los colores para no mezclarse con los del tema que haya elegido cada uno.
const EXAMPLES = Object.fromEntries(
  EXAMPLE_THEMES.map((example) => [`de ejemplo ${example.id}`, tokens(':root', example.css)]),
);

const BACKGROUNDS = ['canvas', 'surface', 'surface-2'];
/** Colores que se usan como texto sobre cualquiera de los fondos. */
const TEXT_COLORS = ['text', 'muted', 'accent-text', 'success', 'warning', 'error'];
const FEEDBACK = ['success', 'warning', 'error'];

describe.each(Object.entries({ ...THEMES, ...EXAMPLES }))('tema %s', (_name, theme) => {
  const color = (token: string): Rgb => {
    const value = theme[token];
    if (!value) throw new Error(`falta el token --${token}`);
    return rgb(value);
  };

  it.each(BACKGROUNDS)('el texto principal alcanza 7:1 sobre --%s', (background) => {
    expect(contrast(color('text'), color(background))).toBeGreaterThanOrEqual(7);
  });

  it.each(TEXT_COLORS.flatMap((name) => BACKGROUNDS.map((bg) => [name, bg] as const)))(
    '--%s alcanza 4,5:1 sobre --%s',
    (name, background) => {
      expect(contrast(color(name), color(background))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('el texto sobre el cobalto alcanza 4,5:1 (también al pasar el ratón)', () => {
    expect(contrast(color('on-accent'), color('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color('on-accent'), color('accent-hover'))).toBeGreaterThanOrEqual(4.5);
  });

  // El foco es el cobalto de relleno; `border` marca el hover de una opción y `border-soft`
  // dibuja los campos y los botones terciarios.
  it.each(
    ['accent', 'border', 'border-soft'].flatMap((name) =>
      BACKGROUNDS.map((bg) => [name, bg] as const),
    ),
  )('--%s se distingue de --%s (3:1)', (name, background) => {
    expect(contrast(color(name), color(background))).toBeGreaterThanOrEqual(3);
  });

  // Las bandas de corrección y las opciones corregidas llevan su color al 12 % de fondo, sobre
  // la página o sobre una tarjeta: el veredicto, en ese mismo color, tiene que seguir leyéndose.
  it.each(FEEDBACK.flatMap((tone) => ['canvas', 'surface'].map((bg) => [tone, bg] as const)))(
    '--%s se lee sobre su propio fondo al 12 %% en --%s',
    (tone, background) => {
      const band = tint(color(tone), color(background), 0.12);
      expect(contrast(color(tone), band)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color('text'), band)).toBeGreaterThanOrEqual(7);
      expect(contrast(color('muted'), band)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('temas derivados', () => {
  it('«según el sistema» en claro es el tema claro', () => {
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: light)'));
    expect(tokens(`[data-theme='system'] {`, media)).toEqual(THEMES.claro);
  });

  it('la presentación (HTML estático) usa los mismos colores que el tema oscuro', () => {
    const landing = tokens(':root {', read('public', 'landing', 'styles.css'));
    expect(Object.keys(landing).length).toBeGreaterThan(8);
    for (const [name, value] of Object.entries(landing)) {
      expect(THEMES.oscuro[name], `--${name}`).toBe(value);
    }
  });
});
