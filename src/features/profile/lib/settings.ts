import { z } from 'zod';
import { THEMES } from '@/lib/theme';

export const READING_FONT_MIN = 16;
export const READING_FONT_MAX = 24;
export const PLAYBACK_RATE_MIN = 0.5;
export const PLAYBACK_RATE_MAX = 1.5;

/** Preferencias guardadas en `profiles.settings` (jsonb). Cada campo tolera valores antiguos o rotos. */
export const ProfileSettings = z.object({
  theme: z.enum(THEMES).catch('dark'),
  /** Tamaño de letra del lector en px (16–24). */
  reading_font_px: z.number().int().min(READING_FONT_MIN).max(READING_FONT_MAX).catch(19),
  /** Tema «papel» en el lector y las tarjetas. */
  reader_paper: z.boolean().catch(false),
  /** Velocidad de reproducción por defecto (0,5–1,5). */
  playback_rate: z.number().min(PLAYBACK_RATE_MIN).max(PLAYBACK_RATE_MAX).catch(1),
  /** Una palabra vista en 3 textos sin consultarla pasa a conocida. */
  implicit_promotion: z.boolean().catch(true),
});
export type ProfileSettings = z.infer<typeof ProfileSettings>;

export const DEFAULT_SETTINGS: ProfileSettings = {
  theme: 'dark',
  reading_font_px: 19,
  reader_paper: false,
  playback_rate: 1,
  implicit_promotion: true,
};

/** Lee el jsonb de la BD sin fallar nunca: lo que falte o no valga toma su valor por defecto. */
export function parseSettings(raw: unknown): ProfileSettings {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {};
  return ProfileSettings.parse({ ...DEFAULT_SETTINGS, ...source });
}

/** Temas que pueden elegirse como intereses (los mismos `topic` de las lecciones). */
export const INTEREST_TOPICS = [
  'science-space',
  'games',
  'music',
  'work-tech',
  'travel',
  'daily-life',
  'food',
  'health',
  'environment',
  'society',
  'media',
  'education',
  'sports',
  'money',
  'relationships',
  'history',
  'city-housing',
  'nature',
  'culture',
  'language',
] as const;
export type InterestTopic = (typeof INTEREST_TOPICS)[number];
