import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp';

const base = {
  nonce: 'abc123',
  supabaseUrl: 'https://xyz.supabase.co',
  audioBaseUrl: 'https://audio.example.dev/audio',
  isDev: false,
};

const directive = (csp: string, name: string) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('buildCsp', () => {
  it('permite scripts solo con el nonce de la petición', () => {
    const csp = buildCsp(base);
    expect(directive(csp, 'script-src')).toBe(`script-src 'self' 'nonce-abc123' 'strict-dynamic'`);
    expect(csp).not.toContain('unsafe-eval');
  });

  it('abre conexión y audio solo a Supabase y al origen del audio', () => {
    const csp = buildCsp(base);
    expect(directive(csp, 'connect-src')).toBe(
      `connect-src 'self' https://xyz.supabase.co https://audio.example.dev`,
    );
    expect(directive(csp, 'media-src')).toBe(`media-src 'self' blob: https://audio.example.dev`);
  });

  it('con audio local no añade ningún origen externo de audio', () => {
    const csp = buildCsp({ ...base, audioBaseUrl: '/dev-audio' });
    expect(directive(csp, 'media-src')).toBe(`media-src 'self' blob:`);
    expect(directive(csp, 'connect-src')).toBe(`connect-src 'self' https://xyz.supabase.co`);
  });

  it('en desarrollo añade lo que necesitan React y la recarga en caliente', () => {
    const csp = buildCsp({ ...base, isDev: true });
    expect(directive(csp, 'script-src')).toContain(`'unsafe-eval'`);
    expect(directive(csp, 'connect-src')).toContain('ws:');
  });

  it('bloquea marcos, objetos y cambios de base', () => {
    const csp = buildCsp(base);
    expect(csp).toContain(`frame-ancestors 'none'`);
    expect(csp).toContain(`object-src 'none'`);
    expect(csp).toContain(`base-uri 'self'`);
    expect(csp).toContain(`form-action 'self'`);
  });
});
