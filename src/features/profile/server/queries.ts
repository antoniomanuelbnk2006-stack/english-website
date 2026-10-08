import 'server-only';
import { cache } from 'react';
import { DEFAULT_RATING } from '@/features/level/lib/bands';
import { parseSettings, type ProfileSettings } from '@/features/profile/lib/settings';
import { getSessionOrRedirect } from '@/lib/auth';
import type { Enums, Tables } from '@/lib/supabase/database.types';

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
  uiLocale: 'es' | 'en';
  dailyGoalMin: number;
  streakMinMinutes: number;
  interests: string[];
  declaredLevel: Enums<'cefr'> | null;
  settings: ProfileSettings;
}

function toProfile(row: Tables<'profiles'>, email: string): Profile {
  return {
    id: row.id,
    email,
    displayName: row.display_name,
    uiLocale: row.ui_locale === 'en' ? 'en' : 'es',
    dailyGoalMin: row.daily_goal_min,
    streakMinMinutes: row.streak_min_minutes,
    interests: row.interests,
    declaredLevel: row.declared_level,
    settings: parseSettings(row.settings),
  };
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
  if (data) return toProfile(data, user.email);

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
    { onConflict: 'user_id,skill', ignoreDuplicates: true },
  );
  if (ratingsError) throw new Error(`No se pudieron crear los ratings: ${ratingsError.message}`);

  return toProfile(created, user.email);
});
