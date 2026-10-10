import { describe, expect, it } from 'vitest';
import { AuthCode, CONFIRM_PATH, confirmUrl } from './confirm';

describe('confirmUrl', () => {
  it('vuelve a la propia web, a la ruta de confirmación', () => {
    expect(confirmUrl('https://senal.example.dev')).toBe('https://senal.example.dev/auth/confirm');
    expect(confirmUrl('http://localhost:3000')).toBe('http://localhost:3000/auth/confirm');
    expect(CONFIRM_PATH).toBe('/auth/confirm');
  });

  it('se queda con el origen y descarta rutas, parámetros y credenciales', () => {
    expect(confirmUrl('https://senal.example.dev/otra/ruta?x=1#y')).toBe(
      'https://senal.example.dev/auth/confirm',
    );
    expect(confirmUrl('https://user:pass@senal.example.dev')).toBe(
      'https://senal.example.dev/auth/confirm',
    );
  });

  it('sin un origen http(s) no propone ninguna URL', () => {
    expect(confirmUrl(null)).toBeUndefined();
    expect(confirmUrl(undefined)).toBeUndefined();
    expect(confirmUrl('')).toBeUndefined();
    expect(confirmUrl('null')).toBeUndefined();
    expect(confirmUrl('javascript:alert(1)')).toBeUndefined();
    expect(confirmUrl('ftp://senal.example.dev')).toBeUndefined();
  });
});

describe('AuthCode', () => {
  it('admite los códigos que emite Supabase', () => {
    expect(AuthCode.safeParse('0b9e5c1a-6a41-4d0e-9d1c-2f3a4b5c6d7e').success).toBe(true);
    expect(AuthCode.safeParse('abcDEF123_-xyz').success).toBe(true);
  });

  it('rechaza lo que no puede ser un código', () => {
    expect(AuthCode.safeParse(null).success).toBe(false);
    expect(AuthCode.safeParse('').success).toBe(false);
    expect(AuthCode.safeParse('corto').success).toBe(false);
    expect(AuthCode.safeParse('con espacios dentro').success).toBe(false);
    expect(AuthCode.safeParse('<script>alert(1)</script>').success).toBe(false);
    expect(AuthCode.safeParse('a'.repeat(257)).success).toBe(false);
  });
});
