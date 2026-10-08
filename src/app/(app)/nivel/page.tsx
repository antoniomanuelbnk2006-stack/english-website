import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { LevelPicker } from '@/features/level/components/level-picker';
import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { getProfile } from '@/features/profile/server/queries';
import { getGrammarIndex } from '@/lib/content/grammar';
import { getLessonIndex } from '@/lib/content/index';
import { getUoeIndex } from '@/lib/content/uoe';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.level') };
}

/**
 * Elegir el nivel. Mientras no haya test de nivel (fase 5 del roadmap), lo declara el usuario:
 * decide qué se le enseña primero en cada sección y qué palabras se dan por conocidas.
 */
export default async function LevelPage() {
  const [t, profile] = await Promise.all([getT(), getProfile()]);

  const counts = Object.fromEntries(CEFR_LEVELS.map((level) => [level, 0])) as Record<
    CefrLevel,
    number
  >;
  for (const item of [...getLessonIndex(), ...getUoeIndex(), ...getGrammarIndex()]) {
    counts[item.level]++;
  }

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title={t('level.chooseTitle')}
        subtitle={profile.declaredLevel ? t('level.chooseAgain') : t('level.chooseFirst')}
      />
      <LevelPicker current={profile.declaredLevel} counts={counts} />
      <p className="text-sm text-muted">{t('level.chooseNote')}</p>
    </PageContainer>
  );
}
