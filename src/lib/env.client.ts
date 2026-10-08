import { ClientEnv, parseEnv } from './env.schema';

/**
 * Variables públicas. Se referencian una a una porque Next solo las incrusta en el
 * bundle del cliente cuando aparecen de forma literal.
 */
export const clientEnv = parseEnv(ClientEnv, {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_AUDIO_BASE_URL: process.env.NEXT_PUBLIC_AUDIO_BASE_URL,
});
