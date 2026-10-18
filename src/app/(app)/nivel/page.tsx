import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { LevelPicker } from '@/features/level/components/level-picker';
import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { getPracticeLanguage, getProfile } from '@/features/profile/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { getGrammarIndex } from '@/lib/content/grammar';
import { getLessonIndex, LANGUAGES_WITH_CONTENT } from '@/lib/content/index';
import { languageName, type PracticeLanguage } from '@/lib/content/language';
import { getUoeIndex } from '@/lib/content/uoe';
import type { Locale } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.level') };
}

/** Cuánto contenido hay publicado de cada nivel en un idioma. */
function countByLevel(locale: Locale, language: PracticeLanguage): Record<CefrLevel, number> {
  const counts = Object.fromEntries(CEFR_LEVELS.map((level) => [level, 0])) as Record<
    CefrLevel,
    number
  >;
  for (const item of [
    ...getLessonIndex(language),
    ...getUoeIndex(locale, language),
    ...getGrammarIndex(locale, language),
  ]) {
    counts[item.level]++;
  }
  return counts;
}

/**
 * Elegir el nivel. Mientras no haya test de nivel (fase 5 del roadmap), lo declara el usuario:
 * decide qué se le enseña primero en cada sección y qué palabras se dan por conocidas. Si hay
 * contenido de más de un idioma, antes se elige cuál se practica (ADR-0036).
 */
export default async function LevelPage() {
  await getSessionOrRedirect();
  const [t, profile, locale, language] = await Promise.all([
    getT(),
    getProfile(),
    getLocale(),
    getPracticeLanguage(),
  ]);

  const languages = LANGUAGES_WITH_CONTENT.map((value) => ({
    value,
    name: languageName(value, locale),
    counts: countByLevel(locale, value),
  }));

  return (
    <PageContainer width="exercise">
      <PageHeader
        title={t('level.chooseTitle')}
        subtitle={profile.declaredLevel ? t('level.chooseAgain') : t('level.chooseFirst')}
      />
      <LevelPicker
        current={profile.declaredLevel}
        currentLanguage={language}
        languages={languages}
      />
      <p className="text-body-sm text-muted">{t('level.chooseNote')}</p>
    </PageContainer>
  );
}
