import { describe, expect, it } from 'vitest';
import { ClientEnv, ServerEnv, parseEnv } from './env.schema';

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  NEXT_PUBLIC_AUDIO_BASE_URL: 'https://audio.example.dev/',
  ALLOWED_EMAIL: '  Yo@Ejemplo.com ',
};

describe('parseEnv', () => {
  it('acepta un entorno completo y aplica los valores por defecto', () => {
    const env = parseEnv(ServerEnv, valid);
    expect(env.ALLOWED_EMAIL).toBe('yo@ejemplo.com');
    expect(env.NEXT_PUBLIC_AUDIO_BASE_URL).toBe('https://audio.example.dev');
    expect(env.AI_DAILY_LIMIT).toBe(10);
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(5);
    expect(env.AI_WRITING_MODEL).toBe('claude-sonnet-5-5');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('convierte los límites de IA a número', () => {
    const env = parseEnv(ServerEnv, {
      ...valid,
      AI_DAILY_LIMIT: '3',
      AI_MONTHLY_BUDGET_USD: '2.5',
    });
    expect(env.AI_DAILY_LIMIT).toBe(3);
    expect(env.AI_MONTHLY_BUDGET_USD).toBe(2.5);
  });

  it('admite una ruta local para el audio en desarrollo', () => {
    const env = parseEnv(ClientEnv, { ...valid, NEXT_PUBLIC_AUDIO_BASE_URL: '/dev-audio/' });
    expect(env.NEXT_PUBLIC_AUDIO_BASE_URL).toBe('/dev-audio');
  });

  it('falla con un mensaje claro que nombra cada variable que falta', () => {
    expect(() =>
      parseEnv(ServerEnv, { NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL }),
    ).toThrow(
      /no puede arrancar[\s\S]*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: falta[\s\S]*ALLOWED_EMAIL: falta/,
    );
  });

  it('trata una variable vacía como ausente', () => {
    expect(() => parseEnv(ServerEnv, { ...valid, ALLOWED_EMAIL: '' })).toThrow(
      /ALLOWED_EMAIL: falta/,
    );
  });

  it('el secreto de la contraseña de acceso es opcional, pero no puede ser corto', () => {
    expect(parseEnv(ServerEnv, valid).LOGIN_CODE_PEPPER).toBeUndefined();
    const pepper = 'x'.repeat(32);
    expect(parseEnv(ServerEnv, { ...valid, LOGIN_CODE_PEPPER: pepper }).LOGIN_CODE_PEPPER).toBe(
      pepper,
    );
    expect(() => parseEnv(ServerEnv, { ...valid, LOGIN_CODE_PEPPER: 'corto' })).toThrow(
      /LOGIN_CODE_PEPPER/,
    );
  });

  it('la dirección de la web es opcional y tiene que ser http o https', () => {
    expect(parseEnv(ServerEnv, valid).SITE_URL).toBeUndefined();
    const site = 'https://senal.example.dev';
    expect(parseEnv(ServerEnv, { ...valid, SITE_URL: site }).SITE_URL).toBe(site);
    for (const wrong of ['senal.example.dev', 'ftp://senal.example.dev']) {
      expect(() => parseEnv(ServerEnv, { ...valid, SITE_URL: wrong })).toThrow(/SITE_URL/);
    }
  });

  it('rechaza valores con formato incorrecto', () => {
    expect(() =>
      parseEnv(ServerEnv, { ...valid, NEXT_PUBLIC_SUPABASE_URL: 'no-es-una-url' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => parseEnv(ServerEnv, { ...valid, NEXT_PUBLIC_AUDIO_BASE_URL: 'audio' })).toThrow(
      /NEXT_PUBLIC_AUDIO_BASE_URL/,
    );
  });
});
