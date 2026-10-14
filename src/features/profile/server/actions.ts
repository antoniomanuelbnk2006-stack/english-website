'use server';

import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  INTEREST_TOPICS,
  PLAYBACK_RATE_MAX,
  PLAYBACK_RATE_MIN,
  READING_FONT_MAX,
  READING_FONT_MIN,
} from '@/features/profile/lib/settings';
import { fail, ok, type ActionResult } from '@/lib/actions';
import { requireUser } from '@/lib/auth';
import { CONSENT_COOKIE, allowsPreferences, parseConsent } from '@/lib/consent';
import { LOCALES, LOCALE_COOKIE } from '@/lib/i18n';
import type { Json } from '@/lib/supabase/database.types';
import { PREFERENCE_COOKIE_MAX_AGE, THEMES, THEME_COOKIE } from '@/lib/theme';

const UpdateSettings = z.object({
  dailyGoalMin: z.number().int().min(10).max(240),
  interests: z.array(z.enum(INTEREST_TOPICS)).max(INTEREST_TOPICS.length),
  uiLocale: z.enum(LOCALES),
  theme: z.enum(THEMES),
  readingFontPx: z.number().int().min(READING_FONT_MIN).max(READING_FONT_MAX),
  readerPaper: z.boolean(),
  playbackRate: z.number().min(PLAYBACK_RATE_MIN).max(PLAYBACK_RATE_MAX),
});

export async function updateSettings(input: unknown): Promise<ActionResult<null>> {
  const parsed = UpdateSettings.safeParse(input);
  if (!parsed.success) return fail('invalid_input');
  const settings = parsed.data;

  const session = await requireUser();
  if (!session.ok) return fail('unauthorized');
  const { supabase, user } = session;

  // Se conservan las claves de `settings` que esta pantalla no gestiona (p. ej. fsrs_params).
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', user.id)
    .single();
  if (readError) return fail('internal');
  const previous =
    typeof current.settings === 'object' &&
    current.settings !== null &&
    !Array.isArray(current.settings)
      ? current.settings
      : {};
  const merged: Json = {
    ...previous,
    theme: settings.theme,
    reading_font_px: settings.readingFontPx,
    reader_paper: settings.readerPaper,
    playback_rate: Number(settings.playbackRate.toFixed(2)),
  };

  const { error } = await supabase
    .from('profiles')
    .update({
      daily_goal_min: settings.dailyGoalMin,
      interests: [...new Set(settings.interests)],
      ui_locale: settings.uiLocale,
      settings: merged,
    })
    .eq('id', user.id);
  if (error) return fail('internal');

  // Tema e idioma van también en una cookie, para aplicarlos sin esperar al perfil. Son cookies
  // de preferencias: solo si se han aceptado (ADR-0028). Si no, se quitan las que hubiera y el
  // tema y el idioma salen del perfil (src/lib/preferences.ts).
  const cookieStore = await cookies();
  if (allowsPreferences(parseConsent(cookieStore.get(CONSENT_COOKIE)?.value))) {
    const options = { path: '/', maxAge: PREFERENCE_COOKIE_MAX_AGE, sameSite: 'lax' as const };
    cookieStore.set(THEME_COOKIE, settings.theme, options);
    cookieStore.set(LOCALE_COOKIE, settings.uiLocale, options);
  } else {
    cookieStore.delete(THEME_COOKIE);
    cookieStore.delete(LOCALE_COOKIE);
  }

  return ok(null);
}
