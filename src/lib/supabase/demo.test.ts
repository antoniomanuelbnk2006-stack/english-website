import { describe, expect, it } from 'vitest';
import { demoAutoLogin } from './demo';

describe('demoAutoLogin', () => {
  it('entra sola en la demo: la pide y Supabase es el emulador de este ordenador', () => {
    expect(demoAutoLogin('http://127.0.0.1:54399', '1')).toBe(true);
    expect(demoAutoLogin('http://localhost:54399', '1')).toBe(true);
  });

  it('sin pedirlo, como siempre: con pantalla de acceso', () => {
    expect(demoAutoLogin('http://127.0.0.1:54399', undefined)).toBe(false);
    expect(demoAutoLogin('http://127.0.0.1:54399', 'true')).toBe(false);
  });

  it('nunca con un Supabase de verdad, aunque la variable esté puesta', () => {
    expect(demoAutoLogin('https://sbnrmqdrflrfvzhokegp.supabase.co', '1')).toBe(false);
    expect(demoAutoLogin('https://127.0.0.1.example.com', '1')).toBe(false);
    expect(demoAutoLogin('no es una url', '1')).toBe(false);
  });
});
