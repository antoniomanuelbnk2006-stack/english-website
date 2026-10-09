import { CircleCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { StudySession } from '@/features/dictionary/components/study-session';
import { parseBrowseParams, pickStudyBatch } from '@/features/dictionary/lib/browse';
import { getLexiconMap, getUserLevel } from '@/features/lexicon/server/queries';
import { getDictionary } from '@/lib/content/dictionary';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('dictionary.studyTitle') };
}

export default async function StudyWordsPage({ searchParams }: PageProps<'/palabras/estudiar'>) {
  const [raw, t, userLevel, statuses] = await Promise.all([
    searchParams,
    getT(),
    getUserLevel(),
    getLexiconMap(),
  ]);
  const { level } = parseBrowseParams(raw, userLevel);
  const query: Record<string, string> = level === userLevel ? {} : { nivel: level };
  const batch = pickStudyBatch(getDictionary(level), statuses);

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title={t('dictionary.studyTitle')}
        subtitle={t('dictionary.studySubtitle', { level })}
      />

      {batch.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          title={t('dictionary.allDoneTitle', { level })}
          action={
            <Link
              href={{ pathname: '/palabras', query }}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {t('dictionary.back')}
            </Link>
          }
        >
          {t('dictionary.allDoneBody')}
        </EmptyState>
      ) : (
        <StudySession
          // Una tanda nueva es una sesión nueva: se vuelve a empezar por la primera tarjeta.
          key={batch.map((entry) => entry.lemma).join('|')}
          level={level}
          query={query}
          words={batch.map(({ lemma, pos, es, example, surface }) => ({
            lemma,
            pos,
            es,
            example,
            surface,
          }))}
        />
      )}
    </PageContainer>
  );
}
