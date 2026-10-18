import { Circle, CircleCheck, History, PenLine, type LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Chip } from '@/components/ui/panel';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { getUserLevel } from '@/features/lexicon/server/queries';
import { WEEKLY_TARGET, writingsThisWeek } from '@/features/writing/lib/history';
import {
  getAiStatus,
  getSubmissions,
  getSubmissionsByPrompt,
} from '@/features/writing/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { getWritingIndex } from '@/lib/content/writing';
import { todayMadrid } from '@/lib/dates';
import { getLocale, getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { contentLang } from '@/lib/content/language';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.write') };
}

const ALL = 'todos';
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function WritingPage({ searchParams }: PageProps<'/escribir'>) {
  await getSessionOrRedirect();
  const [params, t, userLevel, submissions, byPrompt, ai] = await Promise.all([
    searchParams,
    getT(),
    getUserLevel(),
    getSubmissions(),
    getSubmissionsByPrompt(),
    getAiStatus(),
  ]);
  const all = getWritingIndex(await getLocale(), await getPracticeLanguage());

  // Sin nivel en la URL se enseña el del usuario; «Todos» lo quita.
  const requested = first(params.nivel);
  const level = CEFR_LEVELS.find((l) => l === requested) ?? (requested === ALL ? null : userLevel);
  const levels = CEFR_LEVELS.filter((l) => all.some((prompt) => prompt.level === l));
  const visible = level ? all.filter((prompt) => prompt.level === level) : all;
  const thisWeek = writingsThisWeek(submissions, todayMadrid());

  const chip = (key: string, text: string, active: boolean, query: Record<string, string>) => (
    <li key={key}>
      <Link
        href={{ pathname: '/escribir', query }}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex h-8 items-center rounded-full border px-3 text-body-sm transition-colors duration-150 pointer-coarse:h-11',
          active
            ? 'border-accent bg-surface-2 font-medium text-accent-text'
            : 'border-transparent bg-surface-2 text-muted hover:border-border hover:text-text',
        )}
      >
        {text}
      </Link>
    </li>
  );

  return (
    <PageContainer>
      <PageHeader
        title={t('nav.write')}
        subtitle={t('writing.subtitle')}
        actions={
          <Link href="/escribir/historial" className={buttonVariants({ variant: 'secondary' })}>
            <History aria-hidden="true" strokeWidth={1.75} />
            {t('writing.history')}
          </Link>
        }
      />

      {all.length === 0 ? (
        <EmptyState icon={PenLine} title={t('writing.emptyTitle')}>
          {t('writing.emptyBody')}
        </EmptyState>
      ) : (
        <>
          <p className="tabular-nums flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted">
            <span>{t('writing.weekGoal', { done: thisWeek, target: WEEKLY_TARGET })}</span>
            <span>
              {ai.enabled
                ? t('writing.aiToday', { used: ai.usedToday, limit: ai.dailyLimit })
                : t('writing.aiOff')}
            </span>
          </p>

          <nav aria-label={t('library.filtersLabel')} className="flex flex-wrap items-center gap-2">
            <span className="w-14 shrink-0 text-caption text-muted">{t('library.level')}</span>
            <ul className="flex flex-wrap gap-1.5">
              {chip('all', t('library.all'), level === null, { nivel: ALL })}
              {levels.map((l) => chip(l, l, level === l, l === userLevel ? {} : { nivel: l }))}
            </ul>
          </nav>

          {visible.length === 0 ? (
            <EmptyState
              icon={PenLine}
              title={t('library.noLevelTitle', { level: level ?? userLevel })}
              action={
                <Link
                  href={{ pathname: '/escribir', query: { nivel: ALL } }}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  {t('library.seeAllLevels')}
                </Link>
              }
            >
              {t('library.noLevelBody')}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {visible.map((prompt) => {
                const own = byPrompt.get(prompt.id);
                const Icon: LucideIcon = own ? CircleCheck : Circle;
                return (
                  <li key={prompt.id}>
                    <Link
                      href={`/escribir/${prompt.id}` as Route}
                      className="card flex h-full flex-col gap-3 border border-transparent transition-colors duration-150 hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2
                          lang={contentLang(prompt.id)}
                          className="text-body-lg leading-snug font-medium"
                        >
                          {prompt.title}
                        </h2>
                        <span
                          className={cn(
                            'flex shrink-0 items-center gap-1.5 text-caption',
                            own ? 'text-success' : 'text-muted',
                          )}
                        >
                          <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                          {own
                            ? own.count === 1
                              ? t('writing.timesDoneOne')
                              : t('writing.timesDone', { n: own.count })
                            : t('lesson.statusNew')}
                        </span>
                      </div>
                      <p className="text-body-sm text-muted">{prompt.context_es}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        <Chip className="tabular-nums">{prompt.level}</Chip>
                        <Chip>{t(`writing.types.${prompt.task_type}`)}</Chip>
                        <Chip className="tabular-nums">
                          {t('writing.words', { min: prompt.words_min, max: prompt.words_max })}
                        </Chip>
                        <Chip className="tabular-nums">
                          {t('lesson.minutes', { n: prompt.time_min })}
                        </Chip>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-caption text-muted">{t('writing.disclaimer')}</p>
        </>
      )}
    </PageContainer>
  );
}
