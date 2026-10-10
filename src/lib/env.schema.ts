import { z } from 'zod';

// Esquemas puros (sin leer process.env) para poder probarlos y reutilizarlos en servidor y cliente.

// URL absoluta (R2) o ruta local servida por Next (p. ej. /dev-audio en desarrollo).
const AudioBaseUrl = z
  .string()
  .min(1)
  .refine(
    (v) => v.startsWith('/') || URL.canParse(v),
    'debe ser una URL o una ruta que empiece por /',
  )
  .transform((v) => v.replace(/\/+$/, ''));

export const ClientEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_AUDIO_BASE_URL: AudioBaseUrl,
});
export type ClientEnv = z.infer<typeof ClientEnv>;

export const ServerEnv = ClientEnv.extend({
  ALLOWED_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
  // Secreto con el que se deriva la contraseña del código fijo de acceso (ADR-0020). Sin él,
  // solo se entra con el correo.
  LOGIN_CODE_PEPPER: z.string().min(32).optional(),
  // Sin ella la app funciona igual, pero el writing solo ofrece la revisión sin IA (ADR-0014).
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  // Solo para tests (un doble de la API) o un proxy propio; por defecto, la API de Anthropic.
  ANTHROPIC_BASE_URL: z.url().optional(),
  AI_WRITING_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
  // Solo para tests (un doble de Wiktionary); por defecto, https://en.wiktionary.org (ADR-0016).
  DICTIONARY_API_URL: z
    .url()
    .transform((v) => v.replace(/\/+$/, ''))
    .optional(),
  AI_DAILY_LIMIT: z.coerce.number().int().positive().default(10),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().positive().default(5),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

type EnvSource = Record<string, string | undefined>;

/** Las variables vacías (`FOO=`) cuentan como ausentes. */
function withoutEmpty(source: EnvSource): EnvSource {
  return Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
}

export function parseEnv<S extends z.ZodType>(schema: S, source: EnvSource): z.infer<S> {
  const present = withoutEmpty(source);
  const parsed = schema.safeParse(present);
  if (parsed.success) return parsed.data;

  const lines = parsed.error.issues.map((issue) => {
    const name = issue.path.join('.') || '(raíz)';
    const missing = present[name] === undefined;
    return `  - ${name}: ${missing ? 'falta' : issue.message}`;
  });
  throw new Error(
    [
      'Señal no puede arrancar: variables de entorno ausentes o no válidas.',
      ...lines,
      'Copia .env.example a .env.local y rellénalas (docs/06-desarrollo/04-entornos-y-despliegue.md §8).',
    ].join('\n'),
  );
}
