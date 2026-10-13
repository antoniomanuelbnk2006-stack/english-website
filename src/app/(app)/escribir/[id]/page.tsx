import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import { WritingStudio } from '@/features/writing/components/writing-studio';
import { getAiStatus, getSubmissionsByPrompt } from '@/features/writing/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { getGrammarIndex } from '@/lib/content/grammar';
import { findWritingPrompt } from '@/lib/content/writing';
import { toPublicPrompt } from '@/lib/content/writing-schema';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata({ params }: PageProps<'/escribir/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findWritingPrompt(id)?.title };
}

export default async function WritingPromptPage({ params }: PageProps<'/escribir/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const prompt = findWritingPrompt(id);
  if (!prompt) notFound();

  const [t, ai, byPrompt] = await Promise.all([getT(), getAiStatus(), getSubmissionsByPrompt()]);
  const own = byPrompt.get(prompt.id);
  const fichas = Object.fromEntries(getGrammarIndex().map((ficha) => [ficha.id, ficha.title]));

  return (
    <PageContainer>
      <header className="flex flex-col gap-3">
        <Link
          href="/escribir"
          className="flex items-center gap-1.5 self-start rounded-structure text-body-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('writing.backToIndex')}
        </Link>
        <h1 lang="en" className="text-heading-sm sm:text-heading">
          {prompt.title}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="tabular-nums">{prompt.level}</Chip>
          <Chip>{t(`writing.types.${prompt.task_type}`)}</Chip>
          <Chip className="tabular-nums">
            {t('writing.words', { min: prompt.words_min, max: prompt.words_max })}
          </Chip>
          <Chip className="tabular-nums">{t('lesson.minutes', { n: prompt.time_min })}</Chip>
          {own ? (
            <Link
              href="/escribir/historial"
              className="text-body-sm text-accent-text underline underline-offset-4"
            >
              {own.count === 1
                ? t('writing.timesDoneOne')
                : t('writing.timesDone', { n: own.count })}
            </Link>
          ) : null}
        </div>
      </header>

      {/* La respuesta modelo no viaja con la consigna: solo sale del servidor al entregar. */}
      <WritingStudio prompt={toPublicPrompt(prompt)} ai={ai} fichas={fichas} />
    </PageContainer>
  );
}
