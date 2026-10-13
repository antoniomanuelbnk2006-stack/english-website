import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InlineText } from '@/components/ui/inline-text';
import { PageContainer } from '@/components/ui/page';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { toPercent } from '@/features/lessons/lib/summary';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { PronunciationTrainer } from '@/features/pronunciation/components/pronunciation-trainer';
import { getSessionOrRedirect } from '@/lib/auth';
import { findPronunciationSet } from '@/lib/content/pronunciation';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata({
  params,
}: PageProps<'/pronunciar/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findPronunciationSet(id)?.title };
}

export default async function PronunciationSetPage({ params }: PageProps<'/pronunciar/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const set = findPronunciationSet(id);
  if (!set) notFound();

  const [t, progress] = await Promise.all([getT(), getLessonProgress(set.id)]);

  return (
    <PageContainer className="max-w-2xl">
      <header className="flex flex-col gap-3">
        <Link
          href="/pronunciar"
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('pronunciation.backToList')}
        </Link>
        <h1 lang="en" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {set.title}
        </h1>
        <p className="text-sm text-muted">{set.summary_es}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="hud">{set.level}</Chip>
          {set.sounds.length > 0 ? (
            <Chip className="hud" lang="en">
              /{set.sounds.join('/ · /')}/
            </Chip>
          ) : null}
          <Chip className="hud">{t('lesson.minutes', { n: set.est_minutes })}</Chip>
          {progress?.status === 'completed' && progress.bestScore != null ? (
            <Chip className="hud">
              {t('lesson.bestScore', { pct: toPercent(progress.bestScore) })}
            </Chip>
          ) : null}
        </div>
      </header>

      <Panel className="flex flex-col gap-2">
        <PanelTitle>{t('pronunciation.tipTitle')}</PanelTitle>
        <p className="text-sm">
          <InlineText text={set.tip_es} />
        </p>
      </Panel>

      <PronunciationTrainer
        setId={set.id}
        version={set.version}
        items={set.items.map(({ id: itemId, text, ipa, es, confusions }) => ({
          id: itemId,
          text,
          ipa,
          es,
          confusions,
        }))}
      />
    </PageContainer>
  );
}
