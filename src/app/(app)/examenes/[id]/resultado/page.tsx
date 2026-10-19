import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { PageContainer } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import { ResultReview } from '@/features/exams/components/result-review';
import { gradeExamPaper } from '@/features/exams/lib/grade';
import { getLastSitting } from '@/features/exams/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { APP_TIME_ZONE } from '@/lib/dates';
import { examFormat } from '@/lib/content/exam-formats';
import { parsePaperId } from '@/lib/content/exam-schema';
import { findExamPaper } from '@/lib/content/exams';
import { contentLang, languageOfId } from '@/lib/content/language';
import { intlLocale } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('exams.resultTitle') };
}

export default async function ExamResultPage({ params }: PageProps<'/examenes/[id]/resultado'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const paper = findExamPaper(id, await getLocale());
  if (!paper) notFound();
  // El Speaking se autoevalúa en su propia pantalla: no tiene corrección que reconstruir.
  if (paper.paper === 'speaking') redirect(`/examenes/${paper.id}` as Route);

  const sitting = await getLastSitting(paper.id);
  if (!sitting) redirect(`/examenes/${paper.id}` as Route);

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const format = examFormat(paper.level, languageOfId(paper.id));
  const answers = Object.fromEntries(
    Object.entries(sitting.answers).map(([n, value]) => [Number(n), value]),
  );
  // La corrección no se guarda: se vuelve a calcular con las respuestas de la última entrega.
  const result = gradeExamPaper(paper, answers);
  const when = new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: APP_TIME_ZONE,
  }).format(new Date(sitting.at));

  return (
    <PageContainer width="exercise">
      <header className="flex flex-col gap-3">
        <Link
          href={{ pathname: '/examenes', query: { nivel: paper.level } }}
          className="flex items-center gap-1.5 self-start rounded-structure text-body-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('exams.backToIndex')}
        </Link>
        <h1 className="text-heading-sm sm:text-heading">{t('exams.resultTitle')}</h1>
        <p lang={contentLang(paper.id)} className="text-muted">
          {format.exam} · {format[paper.paper].title}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="tabular-nums">{paper.level}</Chip>
          <Chip className="tabular-nums">
            {t('exams.test', { n: parsePaperId(paper.id)?.test ?? 1 })}
          </Chip>
          <Chip>{when}</Chip>
        </div>
      </header>

      <ResultReview paper={paper} format={format} result={result} t={t} />

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/examenes/${paper.id}` as Route}
          className={buttonVariants({ variant: 'secondary' })}
        >
          {t('exams.retake')}
        </Link>
        <Link
          href={{ pathname: '/examenes', query: { nivel: paper.level } }}
          className={buttonVariants({ variant: 'ghost' })}
        >
          {t('exams.backToIndex')}
        </Link>
      </div>
    </PageContainer>
  );
}
