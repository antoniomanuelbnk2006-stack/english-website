import { Languages, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { Panel } from '@/components/ui/panel';
import { WordList } from '@/features/dictionary/components/word-list';
import {
  STATE_FILTERS,
  STUDY_BATCH,
  filterEntries,
  paginate,
  parseBrowseParams,
  stateOf,
  summarize,
  toQuery,
  type BrowseParams,
  type StateFilter,
} from '@/features/dictionary/lib/browse';
import { CEFR_LEVELS } from '@/features/level/lib/bands';
import { getLexiconMap, getUserLevel } from '@/features/lexicon/server/queries';
import { dictionarySizes, getDictionary } from '@/lib/content/dictionary';
import { lemmaKey } from '@/lib/content/dictionary-schema';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.words') };
}

const STATE_LABEL: Record<StateFilter, TranslationKey> = {
  all: 'dictionary.stateAll',
  todo: 'dictionary.stateTodo',
  learning: 'dictionary.stateLearning',
  known: 'dictionary.stateKnown',
};

const chipClass = (active: boolean) =>
  cn(
    'flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-150 pointer-coarse:h-11',
    active
      ? 'border-accent bg-surface-2 font-medium text-accent'
      : 'border-border text-muted hover:border-subtle hover:text-text',
  );

export default async function WordsPage({ searchParams }: PageProps<'/palabras'>) {
  const [raw, t, userLevel, statuses] = await Promise.all([
    searchParams,
    getT(),
    getUserLevel(),
    getLexiconMap(),
  ]);
  const params = parseBrowseParams(raw, userLevel);
  const sizes = dictionarySizes();
  const entries = getDictionary(params.level);
  const summary = summarize(entries, statuses);
  const result = paginate(filterEntries(entries, statuses, params), params.page);

  const link = (change: Partial<BrowseParams>) => ({
    pathname: '/palabras' as const,
    query: toQuery({ ...params, page: 1, ...change }, userLevel),
  });
  const studyQuery = params.level === userLevel ? {} : { nivel: params.level };
  const toStudy = Math.min(STUDY_BATCH, summary.todo);
  const share = (n: number) => (summary.total === 0 ? 0 : (n / summary.total) * 100);

  return (
    <PageContainer>
      <PageHeader
        title={t('nav.words')}
        subtitle={t('dictionary.subtitle')}
        actions={
          toStudy > 0 ? (
            <Link
              href={{ pathname: '/palabras/estudiar', query: studyQuery }}
              className={buttonVariants()}
            >
              {t('dictionary.study', { n: toStudy })}
            </Link>
          ) : null
        }
      />

      <nav
        aria-label={t('library.filtersLabel')}
        className="flex flex-wrap items-center gap-2 rounded-panel border border-border bg-surface p-3"
      >
        <span className="w-14 shrink-0 text-xs text-muted">{t('library.level')}</span>
        <ul className="flex flex-wrap gap-1.5">
          {CEFR_LEVELS.map((level) => (
            <li key={level}>
              <Link
                href={link({ level, query: '', state: 'all' })}
                aria-current={level === params.level ? 'true' : undefined}
                className={chipClass(level === params.level)}
              >
                {level}
                <span className="hud ml-1.5 text-xs opacity-70">{sizes[level]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {entries.length === 0 ? (
        <EmptyState icon={Languages} title={t('dictionary.emptyTitle', { level: params.level })}>
          {t('dictionary.emptyBody')}
        </EmptyState>
      ) : (
        <>
          <Panel className="flex flex-col gap-3">
            <div
              role="img"
              aria-label={t('dictionary.progressLabel', {
                known: summary.known,
                learning: summary.learning,
                total: summary.total,
                level: params.level,
              })}
              className="flex h-2 overflow-hidden rounded-full bg-border"
            >
              <span className="bg-success" style={{ width: `${share(summary.known)}%` }} />
              <span className="bg-accent" style={{ width: `${share(summary.learning)}%` }} />
            </div>
            <dl className="hud flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <div className="flex gap-1.5">
                <dt>{t('dictionary.stateKnown')}</dt>
                <dd className="text-success">{summary.known}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>{t('dictionary.stateLearning')}</dt>
                <dd className="text-accent">{summary.learning}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>{t('dictionary.stateTodo')}</dt>
                <dd className="text-text">{summary.todo}</dd>
              </div>
            </dl>
          </Panel>

          <form
            action="/palabras"
            role="search"
            aria-label={t('dictionary.searchLabel')}
            className="flex flex-wrap items-end gap-2"
          >
            {params.level === userLevel ? null : (
              <input type="hidden" name="nivel" value={params.level} />
            )}
            {params.state === 'all' ? null : (
              <input type="hidden" name="estado" value={params.state} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Label htmlFor="words-q">{t('dictionary.searchLabel')}</Label>
              <Input
                id="words-q"
                name="q"
                type="search"
                autoCapitalize="none"
                placeholder={t('dictionary.searchPlaceholder')}
                defaultValue={params.query}
              />
            </div>
            <Button type="submit" variant="secondary">
              {t('dictionary.searchButton')}
            </Button>
          </form>

          <Link
            href={
              params.query
                ? { pathname: '/palabras/buscar', query: { q: params.query } }
                : '/palabras/buscar'
            }
            className="-mt-3 self-start rounded-control text-sm text-accent hover:underline"
          >
            {params.query
              ? t('dictionary.lookupFor', { word: params.query })
              : t('dictionary.lookupLink')}
          </Link>

          <nav aria-label={t('dictionary.stateLabel')}>
            <ul className="flex flex-wrap gap-1.5">
              {STATE_FILTERS.map((state) => (
                <li key={state}>
                  <Link
                    href={link({ state })}
                    aria-current={state === params.state ? 'true' : undefined}
                    className={chipClass(state === params.state)}
                  >
                    {t(STATE_LABEL[state])}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {result.total === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t('dictionary.noResultsTitle')}
              action={
                <Link
                  href={link({ query: '', state: 'all' })}
                  className={buttonVariants({ variant: 'secondary' })}
                >
                  {t('dictionary.clearFilters')}
                </Link>
              }
            >
              {t('dictionary.noResultsBody')}
            </EmptyState>
          ) : (
            <>
              <WordList
                label={t('dictionary.listLabel', { level: params.level })}
                words={result.items.map((entry) => ({
                  lemma: entry.lemma,
                  pos: entry.pos,
                  es: entry.es,
                  example: entry.example,
                  surface: entry.surface,
                  state: stateOf(statuses.get(lemmaKey(entry.lemma))),
                }))}
              />

              <nav
                aria-label={t('vocabulary.pagination')}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <span className="hud text-sm text-muted">
                  {t('vocabulary.pageOf', {
                    page: result.page,
                    pages: result.pages,
                    total: result.total,
                  })}
                </span>
                <div className="flex gap-2">
                  {result.page > 1 ? (
                    <Link
                      href={link({ page: result.page - 1 })}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      {t('vocabulary.previous')}
                    </Link>
                  ) : null}
                  {result.page < result.pages ? (
                    <Link
                      href={link({ page: result.page + 1 })}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      {t('vocabulary.next')}
                    </Link>
                  ) : null}
                </div>
              </nav>
            </>
          )}
        </>
      )}

      <p className="text-xs text-muted">{t('dictionary.attribution')}</p>
    </PageContainer>
  );
}
