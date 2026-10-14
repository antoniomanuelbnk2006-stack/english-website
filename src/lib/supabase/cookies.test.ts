import { DEFAULT_COOKIE_OPTIONS } from '@supabase/ssr';
import { describe, expect, it } from 'vitest';
import { REMEMBERED_SESSION_MAX_AGE, isSessionCookie, sessionCookieOptions } from './cookies';

// ADR-0030: la sesión solo se recuerda con las cookies aceptadas.

const written = {
  path: '/',
  sameSite: 'lax' as const,
  httpOnly: true,
  secure: true,
  maxAge: REMEMBERED_SESSION_MAX_AGE,
};

describe('sessionCookieOptions', () => {
  it('con las cookies aceptadas deja la duración que pone la librería', () => {
    expect(sessionCookieOptions(written, true)).toEqual(written);
  });

  it('sin aceptarlas quita la caducidad: la cookie se borra al cerrar el navegador', () => {
    const options = sessionCookieOptions({ ...written, expires: new Date(2027, 0, 1) }, false);
    expect(options).toEqual({ path: '/', sameSite: 'lax', httpOnly: true, secure: true });
    expect(options).not.toHaveProperty('maxAge');
    expect(options).not.toHaveProperty('expires');
  });

  it('no toca las cookies que se están borrando', () => {
    const removal = { ...written, maxAge: 0 };
    expect(sessionCookieOptions(removal, false)).toEqual(removal);
  });

  it('no cambia lo que recibe', () => {
    const options = { ...written };
    sessionCookieOptions(options, false);
    expect(options).toEqual(written);
  });

  it('dura lo mismo que pone @supabase/ssr', () => {
    expect(REMEMBERED_SESSION_MAX_AGE).toBe(DEFAULT_COOKIE_OPTIONS.maxAge);
  });
});

describe('isSessionCookie', () => {
  it.each([
    'sb-sbnrmqdrflrfvzhokegp-auth-token',
    'sb-127-auth-token',
    'sb-x-auth-token.0',
    'sb-x-auth-token.12',
  ])('%s es de la sesión', (name) => expect(isSessionCookie(name)).toBe(true));

  it.each([
    'sb-x-auth-token-code-verifier',
    'senal_consent',
    'senal_theme',
    'auth-token',
    'sb-auth-token',
  ])('%s no lo es', (name) => expect(isSessionCookie(name)).toBe(false));
});
