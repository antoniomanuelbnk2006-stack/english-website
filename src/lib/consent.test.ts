import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { THEME_COOKIE } from '@/lib/theme';
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  CONSENT_VERSION,
  PREFERENCE_COOKIES,
  PREFERENCE_STORAGE_KEYS,
  allowsPreferences,
  consentCookieString,
  consentFromCookieString,
  expiredCookieString,
  parseConsent,
  serializeConsent,
} from './consent';

describe('parseConsent', () => {
  it('lee las dos decisiones posibles', () => {
    expect(parseConsent('v1.all')).toBe('all');
    expect(parseConsent('v1.necessary')).toBe('necessary');
  });

  it('es la inversa de serializeConsent', () => {
    expect(parseConsent(serializeConsent('all'))).toBe('all');
    expect(parseConsent(serializeConsent('necessary'))).toBe('necessary');
  });

  it.each([
    undefined,
    null,
    '',
    'all',
    'v1',
    'v1.',
    'v1.todo',
    'v1.all.extra',
    'V1.all',
    ' v1.all',
  ])('no da por buena %j', (value) => {
    expect(parseConsent(value)).toBeNull();
  });

  it('una decisión de otra versión ya no vale: hay que volver a preguntar', () => {
    expect(parseConsent(`v${CONSENT_VERSION + 1}.all`)).toBeNull();
    expect(parseConsent('v0.all')).toBeNull();
  });
});

describe('allowsPreferences', () => {
  it('solo con las cookies aceptadas', () => {
    expect(allowsPreferences('all')).toBe(true);
    expect(allowsPreferences('necessary')).toBe(false);
  });

  it('sin decisión no se guarda nada opcional', () => {
    expect(allowsPreferences(null)).toBe(false);
  });
});

describe('consentFromCookieString', () => {
  it('encuentra la decisión entre las demás cookies', () => {
    expect(consentFromCookieString('senal_theme=dark; senal_consent=v1.all; otra=1')).toBe('all');
    expect(consentFromCookieString('senal_consent=v1.necessary')).toBe('necessary');
  });

  it('sin la cookie, o con otra de nombre parecido, no hay decisión', () => {
    expect(consentFromCookieString('')).toBeNull();
    expect(consentFromCookieString('senal_theme=dark')).toBeNull();
    expect(consentFromCookieString('x_senal_consent=v1.all')).toBeNull();
    expect(consentFromCookieString('senal_consent_old=v1.all')).toBeNull();
  });
});

describe('cookies que escribe el navegador', () => {
  it('la decisión dura seis meses y vale para toda la web', () => {
    expect(consentCookieString('all', true)).toBe(
      `senal_consent=v1.all; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax; Secure`,
    );
    expect(CONSENT_MAX_AGE).toBe(182 * 24 * 60 * 60);
  });

  it('sin https no se marca como segura (si no, el navegador no la guardaría)', () => {
    expect(consentCookieString('necessary', false)).not.toContain('Secure');
  });

  it('borrar una cookie es ponerla caducada con los mismos atributos', () => {
    expect(expiredCookieString('senal_theme', false)).toBe(
      'senal_theme=; Max-Age=0; Path=/; SameSite=Lax',
    );
  });
});

describe('lo que cuenta como preferencia', () => {
  it('son las cookies del tema y del idioma', () => {
    expect([...PREFERENCE_COOKIES].sort()).toEqual([LOCALE_COOKIE, THEME_COOKIE].sort());
  });

  it('y el acento que recuerda la práctica de pronunciación', () => {
    const speech = readFileSync(
      path.join(process.cwd(), 'src', 'features', 'pronunciation', 'lib', 'speech.ts'),
      'utf8',
    );
    for (const key of PREFERENCE_STORAGE_KEYS) expect(speech).toContain(`'${key}'`);
  });
});

// La portada es HTML estático y no puede importar este módulo: repite el formato a mano.
describe('la portada (public/landing/app.js) usa el mismo formato', () => {
  const script = readFileSync(path.join(process.cwd(), 'public', 'landing', 'app.js'), 'utf8');

  it('misma cookie, misma versión y misma duración', () => {
    expect(script).toContain(`'${CONSENT_COOKIE}'`);
    expect(script).toContain(`'v${CONSENT_VERSION}'`);
    expect(script).toContain(String(CONSENT_MAX_AGE));
  });

  it('borra las mismas preferencias al rechazar', () => {
    for (const name of [...PREFERENCE_COOKIES, ...PREFERENCE_STORAGE_KEYS]) {
      expect(script).toContain(`'${name}'`);
    }
  });
});
