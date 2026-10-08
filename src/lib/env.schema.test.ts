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

  it('rechaza valores con formato incorrecto', () => {
    expect(() =>
      parseEnv(ServerEnv, { ...valid, NEXT_PUBLIC_SUPABASE_URL: 'no-es-una-url' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => parseEnv(ServerEnv, { ...valid, NEXT_PUBLIC_AUDIO_BASE_URL: 'audio' })).toThrow(
      /NEXT_PUBLIC_AUDIO_BASE_URL/,
    );
  });
});
