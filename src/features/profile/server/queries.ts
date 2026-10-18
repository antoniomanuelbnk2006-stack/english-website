import 'server-only';
import { cache } from 'react';
import { DEFAULT_RATING } from '@/features/level/lib/bands';
import { parseSettings, type ProfileSettings } from '@/features/profile/lib/settings';
import { getSessionOrRedirect } from '@/lib/auth';
import { LANGUAGES_WITH_CONTENT } from '@/lib/content/index';
import { BASE_LANGUAGE, type PracticeLanguage } from '@/lib/content/language';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n';
import type { Enums, Tables } from '@/lib/supabase/database.types';
import type { SupabaseServerClient } from '@/lib/supabase/server';

const SKILLS: Enums<'skill'>[] = [
  'listening',
  'reading',
  'vocabulary',
  'grammar',
  'writing',
  'speaking',
];

export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  uiLocale: Locale;
  dailyGoalMin: number;
  streakMinMinutes: number;
  interests: string[];
  /** El idioma que practica: el elegido si tiene contenido; si no, inglés (ADR-0036). */
  practiceLanguage: PracticeLanguage;
  /** El nivel que declaró en ese idioma (ADR-0037). */
  declaredLevel: Enums<'cefr'> | null;
  settings: ProfileSettings;
}

function toProfile(
  row: Tables<'profiles'>,
  email: string,
  declaredLevel: Enums<'cefr'> | null,
): Profile {
  const settings = parseSettings(row.settings);
  return {
    id: row.id,
    email,
    displayName: row.display_name,
    uiLocale: isLocale(row.ui_locale) ? row.ui_locale : DEFAULT_LOCALE,
    dailyGoalMin: row.daily_goal_min,
    streakMinMinutes: row.streak_min_minutes,
    interests: row.interests,
    practiceLanguage: LANGUAGES_WITH_CONTENT.includes(settings.practice_language)
      ? settings.practice_language
      : BASE_LANGUAGE,
    declaredLevel,
    settings,
  };
}

/** El nivel declarado en un idioma; `null` si aún no lo ha elegido. */
async function declaredLevelIn(
  supabase: SupabaseServerClient,
  language: PracticeLanguage,
): Promise<Enums<'cefr'> | null> {
  const { data, error } = await supabase
    .from('language_levels')
    .select('declared_level')
    .eq('language', language)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el nivel: ${error.message}`);
  return data?.declared_level ?? null;
}

/** El perfil con el nivel del idioma que practica. */
async function withLevel(
  supabase: SupabaseServerClient,
  row: Tables<'profiles'>,
  email: string,
): Promise<Profile> {
  const base = toProfile(row, email, null);
  return { ...base, declaredLevel: await declaredLevelIn(supabase, base.practiceLanguage) };
}

/** Perfil del usuario. Una consulta por petición aunque lo pidan varios componentes. */
export const getProfile = cache(async (): Promise<Profile> => {
  const { user, supabase } = await getSessionOrRedirect();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el perfil: ${error.message}`);
  if (data) return withLevel(supabase, data, user.email);

  // El trigger handle_new_user crea perfil y ratings al dar de alta al usuario. Si el usuario
  // existía antes de aplicar la migración, se crean aquí (RLS permite insertar las filas propias).
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .upsert({ id: user.id }, { onConflict: 'id' })
    .select('*')
    .single();
  if (insertError) throw new Error(`No se pudo crear el perfil: ${insertError.message}`);

  const { error: ratingsError } = await supabase.from('skill_ratings').upsert(
    SKILLS.map((skill) => ({ user_id: user.id, skill, rating: DEFAULT_RATING })),
    { onConflict: 'user_id,language,skill', ignoreDuplicates: true },
  );
  if (ratingsError) throw new Error(`No se pudieron crear los ratings: ${ratingsError.message}`);

  return withLevel(supabase, created, user.email);
});

/**
 * El idioma que practica el usuario (ADR-0036): el que eligió, si tiene contenido; si no (o si
 * aún no ha elegido), el inglés.
 */
export const getPracticeLanguage = cache(async (): Promise<PracticeLanguage> => {
  return (await getProfile()).practiceLanguage;
});
