import { ArrowLeft } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import { PaperRunner } from '@/features/exams/components/paper-runner';
import { SpeakingRunner } from '@/features/exams/components/speaking-runner';
import { toPercent } from '@/features/lessons/lib/summary';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { EXAM_FORMATS } from '@/lib/content/exam-formats';
import { parsePaperId, toPublicPaper } from '@/lib/content/exam-schema';
import { findExamPaper } from '@/lib/content/exams';
import { env } from '@/lib/env';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata({ params }: PageProps<'/examenes/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const paper = findExamPaper(id);
  if (!paper) return {};
  const format = EXAM_FORMATS[paper.level];
  return { title: `${format.exam} · ${format[paper.paper].title}` };
}

export default async function ExamPaperPage({ params }: PageProps<'/examenes/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const paper = findExamPaper(id);
  if (!paper) notFound();

  const [t, progress] = await Promise.all([getT(), getLessonProgress(paper.id)]);
  const format = EXAM_FORMATS[paper.level];
  const own = format[paper.paper];
  const test = parsePaperId(paper.id)?.test ?? 1;
  const back = { pathname: '/examenes', query: { nivel: paper.level } } as const;

  return (
    <PageContainer className="max-w-6xl">
      <header className="flex flex-col gap-3">
        <Link
          href={back}
          className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('exams.backToIndex')}
        </Link>
        <h1 lang="en" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {format.exam} · {own.title}
        </h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip className="hud">{paper.level}</Chip>
          <Chip className="hud">{t('exams.test', { n: test })}</Chip>
          <Chip className="hud">
            {t(paper.paper === 'listening' ? 'exams.aboutMinutes' : 'lesson.minutes', {
              n: own.minutes,
            })}
          </Chip>
          {progress?.bestScore != null ? (
            <Chip className="hud">
              {t('lesson.bestScore', { pct: toPercent(progress.bestScore) })}
            </Chip>
          ) : null}
          {progress?.status === 'completed' && paper.paper !== 'speaking' ? (
            <Link
              href={`/examenes/${paper.id}/resultado` as Route}
              className="rounded-control text-sm text-accent hover:underline"
            >
              {t('exams.seeResult')}
            </Link>
          ) : null}
        </div>
      </header>

      {paper.paper === 'speaking' ? (
        <SpeakingRunner
          paperId={paper.id}
          version={paper.version}
          parts={paper.parts}
          format={{
            exam: format.exam,
            minutes: format.speaking.minutes,
            parts: [...format.speaking.parts],
            criteria: [...format.speaking.criteria],
            scale: format.speaking.scale,
            pass: format.pass,
          }}
        />
      ) : (
        // Solo viajan los enunciados: las respuestas, las explicaciones y los guiones de las
        // grabaciones se quedan en el servidor hasta que se entrega.
        <PaperRunner
          paper={toPublicPaper(paper)}
          format={{
            exam: format.exam,
            title: own.title,
            minutes: own.minutes,
            reviewS: format.listening.reviewS,
            parts: [...format[paper.paper].parts],
          }}
          audioBase={env.NEXT_PUBLIC_AUDIO_BASE_URL}
        />
      )}
    </PageContainer>
  );
}
