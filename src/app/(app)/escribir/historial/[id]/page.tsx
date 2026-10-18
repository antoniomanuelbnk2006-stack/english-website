import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { buttonVariants } from '@/components/ui/button';
import { PageContainer } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import {
  SubmissionReview,
  type ReviewResult,
} from '@/features/writing/components/submission-review';
import { reviewText } from '@/features/writing/lib/checks';
import { cardCandidates, toOffer } from '@/features/writing/server/cards';
import { getSubmission } from '@/features/writing/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { getGrammarIndex } from '@/lib/content/grammar';
import { findWritingPrompt } from '@/lib/content/writing';
import { WritingTaskType } from '@/lib/content/writing-schema';
import { intlLocale } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';
import { contentLang, languageOfId } from '@/lib/content/language';
import { ContentLanguage } from '@/components/content-language';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('writing.historyTitle') };
}

export default async function WritingSubmissionPage({
  params,
}: PageProps<'/escribir/historial/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const submission = await getSubmission(id);
  if (!submission?.feedback) notFound();
  const { feedback } = submission;

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const prompt = submission.promptId
    ? findWritingPrompt(submission.promptId, await getLocale())
    : null;
  const taskType = WritingTaskType.safeParse(submission.taskType);
  const fichas = Object.fromEntries(
    // Las fichas del idioma de la consigna; sin consigna, las de inglés, como antes.
    getGrammarIndex(locale, languageOfId(submission.promptId ?? '')).map((ficha) => [
      ficha.id,
      ficha.title,
    ]),
  );

  // La revisión sin IA no se guarda: se recalcula del texto, que es determinista. Si la
  // consigna ya no existe, se revisa con los datos que quedaron en la entrega.
  const result: ReviewResult =
    feedback.kind === 'ai'
      ? { kind: 'ai', feedback: feedback.feedback }
      : {
          kind: 'self',
          review: reviewText(submission.text, {
            language: languageOfId(submission.promptId ?? ''),
            level: submission.level,
            taskType: taskType.success ? taskType.data : 'message',
            wordsMin: prompt?.words_min ?? 0,
            wordsMax: prompt?.words_max ?? Number.MAX_SAFE_INTEGER,
          }),
          scores: feedback.scores,
          points: feedback.points,
        };

  const cards = toOffer(
    cardCandidates({
      id: submission.id,
      text: submission.text,
      promptId: submission.promptId,
      taskType: submission.taskType,
      feedback,
    }),
  );
  const day = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(new Date(submission.createdAt));

  return (
    <PageContainer>
      <header className="flex flex-col gap-3">
        <Link
          href="/escribir/historial"
          className="flex items-center gap-1.5 self-start rounded-structure text-body-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('writing.backToHistory')}
        </Link>
        {prompt ? (
          <h1 lang={contentLang(prompt.id)} className="text-heading-sm sm:text-heading">
            {prompt.title}
          </h1>
        ) : (
          <h1 className="text-heading-sm sm:text-heading">{t('writing.deletedPrompt')}</h1>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="tabular-nums">
            <time dateTime={submission.createdAt}>{day}</time>
          </Chip>
          <Chip className="tabular-nums">{submission.level}</Chip>
          {taskType.success ? <Chip>{t(`writing.types.${taskType.data}`)}</Chip> : null}
          <Chip className="tabular-nums">
            {submission.wordCount === 1
              ? t('writing.wordCountOne')
              : t('writing.wordCount', { n: submission.wordCount })}
          </Chip>
          {submission.examMode ? <Chip>{t('writing.entryExam')}</Chip> : null}
        </div>
      </header>

      <ContentLanguage language={languageOfId(submission.promptId ?? '')}>
        <SubmissionReview
          submissionId={submission.id}
          text={submission.text}
          targetLevel={submission.level}
          points={prompt?.points ?? []}
          result={result}
          modelAnswer={prompt?.model_answer ?? null}
          cards={cards}
          rewriteText={submission.rewriteText}
          fichas={fichas}
          footer={
            prompt ? (
              <Link
                href={`/escribir/${prompt.id}` as Route}
                className={buttonVariants({ variant: 'secondary' })}
              >
                {t('writing.redo')}
              </Link>
            ) : null
          }
        />
      </ContentLanguage>
    </PageContainer>
  );
}
