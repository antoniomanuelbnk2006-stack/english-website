import { ArrowLeft, PenLine } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { EvolutionChart } from '@/features/writing/components/evolution-chart';
import { criterionSeries, recentAverages, weakestCriterion } from '@/features/writing/lib/history';
import { CRITERIA, overallScore } from '@/features/writing/lib/schema';
import { getSubmissions } from '@/features/writing/server/queries';
import { findWritingPrompt } from '@/lib/content/writing';
import { WritingTaskType } from '@/lib/content/writing-schema';
import { intlLocale } from '@/lib/i18n';
import { getLocale, getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('writing.historyTitle') };
}

export default async function WritingHistoryPage() {
  const [t, locale, submissions] = await Promise.all([getT(), getLocale(), getSubmissions()]);
  const formatDay = new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  });

  const decimal = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 });

  const series = criterionSeries(submissions);
  const averages = recentAverages(submissions);
  const weakest = weakestCriterion(submissions);
  const scored = series.content.length > 0;

  return (
    <PageContainer>
      <Link
        href="/escribir"
        className="flex items-center gap-1.5 self-start rounded-control text-sm text-muted hover:text-text"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        {t('writing.backToIndex')}
      </Link>
      <PageHeader title={t('writing.historyTitle')} subtitle={t('writing.historySubtitle')} />

      {submissions.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title={t('writing.historyEmptyTitle')}
          action={
            <Link href="/escribir" className={buttonVariants({ variant: 'primary' })}>
              {t('nav.write')}
            </Link>
          }
        >
          {t('writing.historyEmptyBody')}
        </EmptyState>
      ) : (
        <>
          <Panel aria-labelledby="writing-evolution" className="flex flex-col gap-4">
            <PanelTitle id="writing-evolution">{t('writing.evolutionTitle')}</PanelTitle>
            {scored ? (
              <>
                <ul className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                  {CRITERIA.map((criterion) => {
                    const points = series[criterion];
                    const name = t(`writing.criteria.${criterion}`);
                    return (
                      <li key={criterion} className="flex flex-col gap-1">
                        <span className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium">{name}</span>
                          <span className="hud text-muted">
                            {t('writing.average', {
                              score: decimal.format(averages[criterion] ?? 0),
                            })}
                          </span>
                        </span>
                        <EvolutionChart
                          points={points}
                          label={t('writing.evolutionLabel', {
                            criterion: name,
                            scores: points.map((point) => point.score).join(', '),
                          })}
                        />
                      </li>
                    );
                  })}
                </ul>
                {weakest ? (
                  <p className="text-sm">
                    {t('writing.weakest', { criterion: t(`writing.criteria.${weakest}`) })}
                  </p>
                ) : null}
                <p className="hud flex flex-wrap gap-x-4 text-xs text-muted">
                  <span>● {t('writing.byAi')}</span>
                  <span>○ {t('writing.bySelf')}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">{t('writing.evolutionEmpty')}</p>
            )}
          </Panel>

          <section aria-labelledby="writing-entries" className="flex flex-col gap-3">
            <PanelTitle id="writing-entries">{t('writing.entriesTitle')}</PanelTitle>
            <ul className="flex flex-col gap-3">
              {submissions.map((submission) => {
                const prompt = submission.promptId ? findWritingPrompt(submission.promptId) : null;
                const type = WritingTaskType.safeParse(submission.taskType);
                return (
                  <li key={submission.id}>
                    <Link
                      href={`/escribir/historial/${submission.id}` as Route}
                      className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4 transition-colors duration-150 hover:border-accent"
                    >
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        {prompt ? (
                          <span lang="en" className="text-lg leading-snug font-medium">
                            {prompt.title}
                          </span>
                        ) : (
                          <span className="text-lg leading-snug font-medium text-muted">
                            {t('writing.deletedPrompt')}
                          </span>
                        )}
                        <time dateTime={submission.createdAt} className="hud text-xs text-muted">
                          {formatDay.format(new Date(submission.createdAt))}
                        </time>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Chip className="hud">{submission.level}</Chip>
                        {type.success ? <Chip>{t(`writing.types.${type.data}`)}</Chip> : null}
                        <Chip className="hud">
                          {submission.wordCount === 1
                            ? t('writing.wordCountOne')
                            : t('writing.wordCount', { n: submission.wordCount })}
                        </Chip>
                        <Chip>
                          {t(submission.kind === 'ai' ? 'writing.byAi' : 'writing.bySelf')}
                        </Chip>
                        <Chip className="hud">
                          {submission.scores
                            ? t('writing.entryOverall', {
                                score: decimal.format(overallScore(submission.scores)),
                              })
                            : t('writing.entryNoScore')}
                        </Chip>
                        {submission.rewritten ? <Chip>{t('writing.entryRewritten')}</Chip> : null}
                        {submission.examMode ? <Chip>{t('writing.entryExam')}</Chip> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </PageContainer>
  );
}
