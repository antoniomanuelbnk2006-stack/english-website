import 'server-only';
import { cache } from 'react';
import { DEFAULT_RATING, type CefrLevel } from '@/features/level/lib/bands';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import type { Enums } from '@/lib/supabase/database.types';

export type Skill = Enums<'skill'>;

export interface SkillRating {
  skill: Skill;
  rating: number;
  itemsCount: number;
  confirmedLevel: CefrLevel | null;
  updatedAt: string | null;
}

const fallback = (skill: Skill): SkillRating => ({
  skill,
  rating: DEFAULT_RATING,
  itemsCount: 0,
  confirmedLevel: null,
  updatedAt: null,
});

/** Rating por destreza del idioma que practica. Las que no tienen fila devuelven el valor inicial. */
export const getSkillRatings = cache(async (): Promise<Record<Skill, SkillRating>> => {
  const { supabase } = await getSessionOrRedirect();
  const { data, error } = await supabase
    .from('skill_ratings')
    .select('skill, rating, items_count, confirmed_level, updated_at')
    .eq('language', await getPracticeLanguage());
  if (error) throw new Error(`No se pudieron leer los ratings: ${error.message}`);

  const ratings: Record<Skill, SkillRating> = {
    listening: fallback('listening'),
    reading: fallback('reading'),
    vocabulary: fallback('vocabulary'),
    grammar: fallback('grammar'),
    writing: fallback('writing'),
    speaking: fallback('speaking'),
  };
  for (const row of data) {
    ratings[row.skill] = {
      skill: row.skill,
      rating: row.rating,
      itemsCount: row.items_count,
      confirmedLevel: row.confirmed_level,
      updatedAt: row.updated_at,
    };
  }
  return ratings;
});
