import {
  BookOpenCheck,
  CircleCheck,
  ClipboardCheck,
  Headphones,
  Mic,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Chip, Panel } from '@/components/ui/panel';
import { PAPER_HINT } from '@/features/exams/lib/labels';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { toPercent } from '@/features/lessons/lib/summary';
import { getProgressByLesson } from '@/features/lessons/server/queries';
import { getUserLevel } from '@/features/lexicon/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import {
  examFormat,
  EXAM_PAPERS,
  paperMarks,
  paperQuestions,
  speakingMarks,
  type ExamPaperKind,
} from '@/lib/content/exam-formats';
import { getExamTests } from '@/lib/content/exams';
import { getT } from '@/lib/i18n/server';
import { htmlLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { getPracticeLanguage } from '@/features/profile/server/queries';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.exams') };
}

const ICON: Record<ExamPaperKind, LucideIcon> = {
  reading: BookOpenCheck,
  listening: Headphones,
  speaking: Mic,
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ExamsPage({ searchParams }: PageProps<'/examenes'>) {
  await getSessionOrRedirect();
  const [params, t, userLevel, progress] = await Promise.all([
    searchParams,
    getT(),
    getUserLevel(),
    getProgressByLesson(),
  ]);

  // Sin nivel en la URL se enseña el examen del nivel del usuario.
  const level = CEFR_LEVELS.find((l) => l === first(params.nivel)) ?? userLevel;
  const language = await getPracticeLanguage();
  const format = examFormat(level, language);
  const lang = htmlLang(language);
  const dele = format.system === 'dele';
  const tests = getExamTests(language).filter((test) => test.level === level);

  return (
    <PageContainer>
      <PageHeader
        title={t('nav.exams')}
        subtitle={t(dele ? 'exams.subtitleDele' : 'exams.subtitle')}
      />

      <nav aria-label={t('library.filtersLabel')} className="flex flex-wrap items-center gap-2">
        <span className="w-14 shrink-0 text-caption text-muted">{t('library.level')}</span>
        <ul className="flex flex-wrap gap-1.5">
          {CEFR_LEVELS.map((l) => (
            <li key={l}>
              <Link
                href={{ pathname: '/examenes', query: l === userLevel ? {} : { nivel: l } }}
                aria-current={l === level ? 'true' : undefined}
                className={cn(
                  'flex h-8 items-center rounded-full border px-3 text-body-sm transition-colors duration-150 pointer-coarse:h-11',
                  l === level
                    ? 'border-accent bg-surface-2 font-medium text-accent-text'
                    : 'border-transparent bg-surface-2 text-muted hover:border-border hover:text-text',
                )}
              >
                {l}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section aria-labelledby="exam-name" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 id="exam-name" lang={lang} className="text-heading-sm">
            {format.exam}
          </h2>
          <p className="text-body-sm text-muted">
            {dele
              ? t('exams.officialNoteDele')
              : format.official
                ? t('exams.officialNote', { pass: format.pass ?? 0 })
                : t('exams.unofficialNote')}
          </p>
        </div>

        {tests.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title={t('exams.emptyTitle', { exam: format.exam })}>
            {t('exams.emptyBody')}
          </EmptyState>
        ) : (
          tests.map((test) => (
            <Panel key={test.test} className="flex flex-col gap-4">
              <h3 className="text-body-lg font-medium">{t('exams.test', { n: test.test })}</h3>
              <ul className="flex flex-col divide-y divide-border">
                {EXAM_PAPERS.map((kind) => {
                  const id = test.papers[kind];
                  if (!id) return null;
                  const Icon = ICON[kind];
                  const own = progress.get(id);
                  const done = own?.status === 'completed';
                  const paper = format[kind];
                  return (
                    <li
                      key={kind}
                      className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-6 shrink-0 text-accent-text"
                        strokeWidth={1.5}
                      />
                      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                        <span lang={lang} className="font-medium">
                          {paper.title}
                        </span>
                        <span className="text-body-sm text-muted">{t(PAPER_HINT[kind])}</span>
                        <span className="flex flex-wrap gap-1.5">
                          <Chip className="tabular-nums">
                            {t(kind === 'listening' ? 'exams.aboutMinutes' : 'lesson.minutes', {
                              n: paper.minutes,
                            })}
                          </Chip>
                          <Chip className="tabular-nums">
                            {t('exams.parts', { n: paper.parts.length })}
                          </Chip>
                          {kind === 'speaking' ? (
                            <Chip className="tabular-nums">
                              {t('uoe.marks', { n: speakingMarks(format) })}
                            </Chip>
                          ) : (
                            <>
                              <Chip className="tabular-nums">
                                {t('exams.questions', { n: paperQuestions(format[kind].parts) })}
                              </Chip>
                              <Chip className="tabular-nums">
                                {t('uoe.marks', { n: paperMarks(format[kind].parts) })}
                              </Chip>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        {done && own.score != null ? (
                          <span className="flex items-center gap-1.5 text-body-sm text-success">
                            <CircleCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            {t('exams.lastScore', { pct: toPercent(own.score) })}
                            {own.bestScore != null && own.bestScore > own.score ? (
                              <span className="text-muted">
                                · {t('lesson.bestScore', { pct: toPercent(own.bestScore) })}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        <span className="flex flex-wrap gap-2">
                          {done && kind !== 'speaking' ? (
                            <Link
                              href={`/examenes/${id}/resultado` as Route}
                              className={buttonVariants({ variant: 'ghost' })}
                            >
                              {t('exams.seeResult')}
                            </Link>
                          ) : null}
                          <Link
                            href={`/examenes/${id}` as Route}
                            aria-label={`${t(done ? 'lesson.repeat' : 'lesson.start')}: ${paper.title}`}
                            className={buttonVariants({ variant: 'secondary' })}
                          >
                            {t(done ? 'lesson.repeat' : 'lesson.start')}
                          </Link>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))
        )}

        {format.writing ? (
          <Panel className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <PenLine
              aria-hidden="true"
              className="size-6 shrink-0 text-accent-text"
              strokeWidth={1.5}
            />
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <span lang={lang} className="font-medium">
                {format.writing.title}
              </span>
              <span className="text-body-sm text-muted">
                {t(dele ? 'exams.writingElsewhereDele' : 'exams.writingElsewhere')}
              </span>
              <span className="flex flex-wrap gap-1.5">
                <Chip className="tabular-nums">
                  {t('lesson.minutes', { n: format.writing.minutes })}
                </Chip>
                <Chip lang={lang}>{format.writing.tasks}</Chip>
              </span>
            </div>
            <Link
              href={{ pathname: '/escribir', query: level === userLevel ? {} : { nivel: level } }}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {t('exams.goToWriting')}
            </Link>
          </Panel>
        ) : null}
      </section>

      <p className="text-caption text-muted">
        {t(dele ? 'exams.disclaimerDele' : 'exams.disclaimer')}
      </p>
    </PageContainer>
  );
}
