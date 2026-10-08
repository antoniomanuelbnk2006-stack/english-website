import { SearchX, type LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { PanelTitle } from '@/components/ui/panel';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import {
  LESSON_STATUSES,
  filterLessons,
  filtersToQuery,
  groupByUnit,
  parseFilters,
  statusOf,
  type LibraryFilters,
  type LessonStatus,
} from '@/features/lessons/lib/library';
import { getProgressByLesson } from '@/features/lessons/server/queries';
import { getCoverageByLesson } from '@/features/lexicon/server/queries';
import { getLessonIndex, unitTitle } from '@/lib/content/index';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';
import { LessonCard } from './lesson-card';

const STATUS_LABEL: Record<LessonStatus, TranslationKey> = {
  new: 'lesson.statusNew',
  started: 'lesson.statusStarted',
  done: 'lesson.statusDone',
};

function FilterRow({
  label,
  basePath,
  options,
}: {
  label: string;
  basePath: Route;
  options: { key: string; text: string; filters: LibraryFilters; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 shrink-0 text-xs text-muted">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <li key={option.key}>
            <Link
              href={{ pathname: basePath, query: filtersToQuery(option.filters) }}
              aria-current={option.active ? 'true' : undefined}
              className={cn(
                'flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-150 pointer-coarse:h-11',
                option.active
                  ? 'border-accent bg-surface-2 font-medium text-accent'
                  : 'border-border text-muted hover:border-subtle hover:text-text',
              )}
            >
              {option.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Biblioteca de lecciones de una destreza: filtros por URL y agrupación por unidad. */
export async function LessonLibrary({
  skill,
  basePath,
  searchParams,
  emptyIcon,
  emptyBody,
}: {
  skill: 'listening' | 'reading';
  basePath: Route;
  searchParams: Record<string, string | string[] | undefined>;
  emptyIcon: LucideIcon;
  emptyBody: TranslationKey;
}) {
  const t = await getT();
  const all = getLessonIndex().filter((lesson) => lesson.skill === skill);

  if (all.length === 0) {
    return (
      <EmptyState icon={emptyIcon} title={t('library.noContentTitle')}>
        {t(emptyBody)}
      </EmptyState>
    );
  }

  const [progress, coverage] = await Promise.all([getProgressByLesson(), getCoverageByLesson(all)]);
  const statusById = new Map(all.map((lesson) => [lesson.id, statusOf(progress.get(lesson.id))]));
  const topics = [...new Set(all.map((lesson) => lesson.topic))].sort();
  const levels = CEFR_LEVELS.filter((level) => all.some((lesson) => lesson.level === level));
  const filters = parseFilters(searchParams, topics);
  const groups = groupByUnit(filterLessons(all, statusById, filters));
  const hasFilters = Object.keys(filtersToQuery(filters)).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label={t('library.filtersLabel')}
        className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-3"
      >
        <FilterRow
          label={t('library.level')}
          basePath={basePath}
          options={[
            {
              key: 'all',
              text: t('library.all'),
              filters: { ...filters, level: undefined },
              active: !filters.level,
            },
            ...levels.map((level) => ({
              key: level,
              text: level,
              filters: { ...filters, level },
              active: filters.level === level,
            })),
          ]}
        />
        <FilterRow
          label={t('library.status')}
          basePath={basePath}
          options={[
            {
              key: 'all',
              text: t('library.all'),
              filters: { ...filters, status: undefined },
              active: !filters.status,
            },
            ...LESSON_STATUSES.map((status) => ({
              key: status,
              text: t(STATUS_LABEL[status]),
              filters: { ...filters, status },
              active: filters.status === status,
            })),
          ]}
        />
        {topics.length > 1 ? (
          <FilterRow
            label={t('library.topic')}
            basePath={basePath}
            options={[
              {
                key: 'all',
                text: t('library.all'),
                filters: { ...filters, topic: undefined },
                active: !filters.topic,
              },
              ...topics.map((topic) => ({
                key: topic,
                text: t(`topics.${topic}` as TranslationKey),
                filters: { ...filters, topic },
                active: filters.topic === topic,
              })),
            ]}
          />
        ) : null}
      </nav>

      {groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('library.emptyTitle')}
          action={
            hasFilters ? (
              <Link href={basePath} className={buttonVariants({ variant: 'secondary' })}>
                {t('library.clearFilters')}
              </Link>
            ) : undefined
          }
        >
          {t('library.emptyBody')}
        </EmptyState>
      ) : (
        groups.map((group) => {
          const done = group.lessons.filter((l) => statusById.get(l.id) === 'done').length;
          return (
            <section key={group.unit} aria-labelledby={`unit-${group.unit}`}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <PanelTitle id={`unit-${group.unit}`}>{unitTitle(group.unit)}</PanelTitle>
                <span className="hud text-xs text-muted">
                  {t('library.seriesProgress', { done, total: group.lessons.length })}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.lessons.map((lesson) => (
                  <li key={lesson.id}>
                    <LessonCard
                      lesson={lesson}
                      href={`${basePath}/${lesson.id}` as Route}
                      status={statusById.get(lesson.id) ?? 'new'}
                      bestScore={progress.get(lesson.id)?.bestScore ?? null}
                      coverage={coverage.get(lesson.id) ?? null}
                      t={t}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
