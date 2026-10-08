import { Circle, CircleCheck, GraduationCap, type LucideIcon } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Chip, PanelTitle } from '@/components/ui/panel';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { toPercent } from '@/features/lessons/lib/summary';
import { getProgressByLesson } from '@/features/lessons/server/queries';
import { getUserLevel } from '@/features/lexicon/server/queries';
import { getUoeIndex } from '@/lib/content/uoe';
import { UOE_PARTS, type UoePart } from '@/lib/content/uoe-schema';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.useOfEnglish') };
}

const PART: Record<UoePart, { title: TranslationKey; body: TranslationKey }> = {
  mcq_cloze: { title: 'uoe.partMcq', body: 'uoe.partMcqBody' },
  open_cloze: { title: 'uoe.partOpen', body: 'uoe.partOpenBody' },
  word_formation: { title: 'uoe.partFormation', body: 'uoe.partFormationBody' },
  key_word_transformation: { title: 'uoe.partTransformation', body: 'uoe.partTransformationBody' },
};

const ALL = 'todos';
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function UseOfEnglishPage({ searchParams }: PageProps<'/use-of-english'>) {
  const [params, t, userLevel, progress] = await Promise.all([
    searchParams,
    getT(),
    getUserLevel(),
    getProgressByLesson(),
  ]);
  const all = getUoeIndex();

  // Sin nivel en la URL se enseña el del usuario; «Todos» lo quita.
  const requested = first(params.nivel);
  const level = CEFR_LEVELS.find((l) => l === requested) ?? (requested === ALL ? null : userLevel);
  const levels = CEFR_LEVELS.filter((l) => all.some((set) => set.level === l));
  const visible = level ? all.filter((set) => set.level === level) : all;
  const done = visible.filter((set) => progress.get(set.id)?.status === 'completed').length;

  const chip = (key: string, text: string, active: boolean, query: Record<string, string>) => (
    <li key={key}>
      <Link
        href={{ pathname: '/use-of-english', query }}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-150 pointer-coarse:h-11',
          active
            ? 'border-accent bg-surface-2 font-medium text-accent'
            : 'border-border text-muted hover:border-subtle hover:text-text',
        )}
      >
        {text}
      </Link>
    </li>
  );

  return (
    <PageContainer>
      <PageHeader title={t('nav.useOfEnglish')} subtitle={t('uoe.subtitle')} />

      {all.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t('uoe.emptyTitle')}>
          {t('uoe.emptyBody')}
        </EmptyState>
      ) : (
        <>
          <nav
            aria-label={t('library.filtersLabel')}
            className="flex flex-wrap items-center gap-2 rounded-panel border border-border bg-surface p-3"
          >
            <span className="w-14 shrink-0 text-xs text-muted">{t('library.level')}</span>
            <ul className="flex flex-wrap gap-1.5">
              {chip('all', t('library.all'), level === null, { nivel: ALL })}
              {levels.map((l) => chip(l, l, level === l, l === userLevel ? {} : { nivel: l }))}
            </ul>
            <span className="hud ml-auto text-xs text-muted">
              {t('library.seriesProgress', { done, total: visible.length })}
            </span>
          </nav>

          {visible.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={t('library.noLevelTitle', { level: level ?? userLevel })}
              action={
                <Link
                  href={{ pathname: '/use-of-english', query: { nivel: ALL } }}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  {t('library.seeAllLevels')}
                </Link>
              }
            >
              {t('library.noLevelBody')}
            </EmptyState>
          ) : (
            UOE_PARTS.filter((part) => visible.some((set) => set.part === part)).map((part) => (
              <section key={part} aria-labelledby={`uoe-${part}`}>
                <PanelTitle id={`uoe-${part}`}>{t(PART[part].title)}</PanelTitle>
                <p className="mt-1 mb-3 text-sm text-muted">{t(PART[part].body)}</p>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {visible
                    .filter((set) => set.part === part)
                    .map((set) => {
                      const own = progress.get(set.id);
                      const finished = own?.status === 'completed';
                      const Icon: LucideIcon = finished ? CircleCheck : Circle;
                      return (
                        <li key={set.id}>
                          <Link
                            href={`/use-of-english/${set.id}` as Route}
                            className="flex h-full flex-col gap-3 rounded-panel border border-border bg-surface p-4 transition-colors duration-150 hover:border-accent"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 lang="en" className="text-lg leading-snug font-medium">
                                {set.title}
                              </h3>
                              <span
                                className={cn(
                                  'flex shrink-0 items-center gap-1.5 text-xs',
                                  finished ? 'text-success' : 'text-muted',
                                )}
                              >
                                <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
                                {t(finished ? 'lesson.statusDone' : 'lesson.statusNew')}
                              </span>
                            </div>
                            <p className="text-sm text-muted">{set.summary_es}</p>
                            <div className="mt-auto flex flex-wrap items-center gap-1.5">
                              <Chip className="hud">{set.level}</Chip>
                              <Chip className="hud">{t('uoe.marks', { n: set.marks })}</Chip>
                              <Chip className="hud">
                                {t('lesson.minutes', { n: set.est_minutes })}
                              </Chip>
                            </div>
                            {own?.bestScore != null && finished ? (
                              <p className="hud text-xs text-muted">
                                {t('lesson.bestScore', { pct: toPercent(own.bestScore) })}
                              </p>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ))
          )}

          <p className="text-xs text-muted">{t('uoe.disclaimer')}</p>
        </>
      )}
    </PageContainer>
  );
}
