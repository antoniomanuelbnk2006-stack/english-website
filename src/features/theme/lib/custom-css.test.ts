import { describe, expect, it } from 'vitest';
import { EXAMPLE_THEMES } from './examples';
import { MAX_THEME_CHARS, checkThemeCss, savedThemeCss } from './custom-css';

describe('checkThemeCss', () => {
  it('acepta CSS normal y lo deja limpio', () => {
    expect(
      checkThemeCss('\r\n  :root { --accent: #e0359b; }\r\n.card > h2 { color: red; }  '),
    ).toEqual({ ok: true, css: ':root { --accent: #e0359b; }\n.card > h2 { color: red; }' });
  });

  it('acepta el vacío: es quitar el tema', () => {
    expect(checkThemeCss('   ')).toEqual({ ok: true, css: '' });
  });

  it('acepta imágenes metidas en el propio CSS', () => {
    expect(checkThemeCss('body { background: url(data:image/png;base64,AAAA); }').ok).toBe(true);
  });

  it('rechaza lo que pasa del límite', () => {
    expect(checkThemeCss('a'.repeat(MAX_THEME_CHARS + 1))).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(checkThemeCss('a'.repeat(MAX_THEME_CHARS)).ok).toBe(true);
  });

  it.each(['</style><script>alert(1)</script>', 'p::before { content: "<b>"; }'])(
    'rechaza cualquier «<»: podría cerrar la etiqueta (%s)',
    (css) => {
      expect(checkThemeCss(css)).toEqual({ ok: false, reason: 'markup' });
    },
  );

  it.each(['@import url(https://x.test/a.css);', '@IMPORT "a.css";', '@\\69mport "a.css";'])(
    'rechaza los @import, también escapados (%s)',
    (css) => {
      expect(checkThemeCss(css)).toEqual({ ok: false, reason: 'import' });
    },
  );

  it.each([
    'a { background: url(javascript:alert(1)); }',
    'a { width: expression(alert(1)); }',
    'a { -moz-binding: url(x.xml#y); }',
    'a { behavior: url(x.htc); }',
  ])('rechaza lo que ejecutaba código en navegadores antiguos (%s)', (css) => {
    expect(checkThemeCss(css)).toEqual({ ok: false, reason: 'script' });
  });

  it('los temas de ejemplo son válidos', () => {
    for (const { css } of EXAMPLE_THEMES) expect(checkThemeCss(css).ok).toBe(true);
  });
});

describe('savedThemeCss', () => {
  it('lee el tema de los ajustes del perfil', () => {
    expect(savedThemeCss({ theme: 'dark', custom_css: ':root { --accent: red; }' })).toBe(
      ':root { --accent: red; }',
    );
  });

  it.each([null, undefined, 'x', [], {}, { custom_css: 3 }, { custom_css: '   ' }])(
    'sin un tema válido, no hay tema (%j)',
    (settings) => {
      expect(savedThemeCss(settings)).toBeNull();
    },
  );

  it('si lo guardado ya no pasa la comprobación, no se aplica', () => {
    expect(savedThemeCss({ custom_css: '</style><script>alert(1)</script>' })).toBeNull();
  });
});
