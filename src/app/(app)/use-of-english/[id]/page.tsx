import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import { toPercent } from '@/features/lessons/lib/summary';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { UoeRunner } from '@/features/use-of-english/components/uoe-runner';
import { findUoeSet } from '@/lib/content/uoe';
import { toPublicSet, type UoePart } from '@/lib/content/uoe-schema';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata({
  params,
}: PageProps<'/use-of-english/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findUoeSet(id)?.title };
}

const PART_TITLE: Record<UoePart, TranslationKey> = {
  mcq_cloze: 'uoe.partMcq',
  open_cloze: 'uoe.partOpen',
  word_formation: 'uoe.partFormation',
  key_word_transformation: 'uoe.partTransformation',
};

export default async function UoeSetPage({ params }: PageProps<'/use-of-english/[id]'>) {
  const { id } = await params;
  const set = findUoeSet(id);
  if (!set) notFound();

  const [t, progress] = await Promise.all([getT(), getLessonProgress(set.id)]);

  return (
    <PageContainer className="max-w-3xl">
      <header className="flex flex-col gap-3">
        <Link
          href="/use-of-english"
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('uoe.backToIndex')}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t(PART_TITLE[set.part])}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="hud">{set.level}</Chip>
          <Chip className="hud">{t('lesson.minutes', { n: set.est_minutes })}</Chip>
          {progress?.bestScore != null ? (
            <Chip className="hud">
              {t('lesson.bestScore', { pct: toPercent(progress.bestScore) })}
            </Chip>
          ) : null}
        </div>
      </header>

      {/* Solo viaja el enunciado: las respuestas y las explicaciones se quedan en el servidor. */}
      <UoeRunner set={toPublicSet(set)} />
    </PageContainer>
  );
}
