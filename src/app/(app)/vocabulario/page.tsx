import { BookA, SearchX } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import { CEFR_LEVELS, type CefrLevel } from '@/features/level/lib/bands';
import { VocabularyTable } from '@/features/lexicon/components/vocabulary-table';
import type { LexemeStatus } from '@/features/lexicon/lib/known';
import {
  getLexiconCounts,
  getLexiconPage,
  LEXICON_PAGE_SIZE,
} from '@/features/lexicon/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.vocabulary') };
}

const STATUSES: LexemeStatus[] = ['new', 'learning', 'known', 'ignored'];
const STATUS_LABEL: Record<LexemeStatus, TranslationKey> = {
  new: 'lexicon.statusNew',
  learning: 'lexicon.statusLearning',
  known: 'lexicon.statusKnown',
  ignored: 'lexicon.statusIgnored',
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function VocabularyPage({ searchParams }: PageProps<'/vocabulario'>) {
  await getSessionOrRedirect();
  const params = await searchParams;
  const t = await getT();

  // Los filtros llegan por la URL: lo que no valga, se ignora.
  const rawStatus = first(params.estado);
  const rawLevel = first(params.nivel);
  const status = STATUSES.find((s) => s === rawStatus);
  const level = CEFR_LEVELS.find((l) => l === rawLevel) as CefrLevel | undefined;
  const search = (first(params.q) ?? '').trim().toLowerCase().slice(0, 40);
  const page = Math.max(1, Number.parseInt(first(params.pagina) ?? '1', 10) || 1);

  const [counts, { entries, total }] = await Promise.all([
    getLexiconCounts(),
    getLexiconPage({ status, level, search, page }),
  ]);
  const totalWords = STATUSES.reduce((sum, s) => sum + counts[s], 0);
  const pages = Math.max(1, Math.ceil(total / LEXICON_PAGE_SIZE));
  const hasFilters = Boolean(status || level || search);

  const query = (target: number) => ({
    ...(status ? { estado: status } : {}),
    ...(level ? { nivel: level } : {}),
    ...(search ? { q: search } : {}),
    ...(target > 1 ? { pagina: String(target) } : {}),
  });

  return (
    <PageContainer>
      <PageHeader title={t('nav.vocabulary')} subtitle={t('vocabulary.subtitle')} />

      {totalWords === 0 ? (
        <EmptyState
          icon={BookA}
          title={t('vocabulary.emptyTitle')}
          action={
            <Link href="/leer" className={buttonVariants({ variant: 'primary' })}>
              {t('nav.read')}
            </Link>
          }
        >
          {t('vocabulary.emptyBody')}
        </EmptyState>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATUSES.map((s) => (
              <div key={s} className="rounded-panel border border-border bg-surface p-3">
                <dt className="text-xs text-muted">{t(STATUS_LABEL[s])}</dt>
                <dd className="hud text-2xl">{counts[s]}</dd>
              </div>
            ))}
          </dl>

          <form
            action="/vocabulario"
            role="search"
            aria-label={t('library.filtersLabel')}
            className="grid gap-3 rounded-panel border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto] sm:items-end"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vocab-q">{t('vocabulary.search')}</Label>
              <Input
                id="vocab-q"
                name="q"
                type="search"
                lang="en"
                autoCapitalize="none"
                defaultValue={search}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vocab-status">{t('library.status')}</Label>
              <Select id="vocab-status" name="estado" defaultValue={status ?? ''}>
                <option value="">{t('library.all')}</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(STATUS_LABEL[s])}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vocab-level">{t('library.level')}</Label>
              <Select id="vocab-level" name="nivel" defaultValue={level ?? ''}>
                <option value="">{t('library.all')}</option>
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              {t('vocabulary.filter')}
            </Button>
          </form>

          {entries.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={t('library.emptyTitle')}
              action={
                hasFilters ? (
                  <Link href="/vocabulario" className={buttonVariants({ variant: 'secondary' })}>
                    {t('library.clearFilters')}
                  </Link>
                ) : undefined
              }
            >
              {t('library.emptyBody')}
            </EmptyState>
          ) : (
            <>
              {/* La clave reinicia la selección al cambiar de página o de filtros. */}
              <VocabularyTable key={JSON.stringify(query(page))} entries={entries} />
              <nav
                aria-label={t('vocabulary.pagination')}
                className="flex items-center justify-between gap-3"
              >
                <p className="hud text-sm text-muted">
                  {t('vocabulary.pageOf', { page, pages, total })}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={{ pathname: '/vocabulario', query: query(page - 1) }}
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      {t('vocabulary.previous')}
                    </Link>
                  ) : null}
                  {page < pages ? (
                    <Link
                      href={{ pathname: '/vocabulario', query: query(page + 1) }}
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
    </PageContainer>
  );
}
