import { ArrowLeft, ExternalLink, SearchX, WifiOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { EmptyState, PageContainer } from '@/components/ui/page';
import { Chip, Panel, PanelTitle } from '@/components/ui/panel';
import { LookupActions } from '@/features/dictionary/components/lookup-actions';
import { Example } from '@/features/dictionary/components/word-list';
import { stateOf } from '@/features/dictionary/lib/browse';
import {
  baseWord,
  LookupTerm,
  posKey,
  type LookupEntry,
} from '@/features/dictionary/lib/wiktionary';
import { lookupWord } from '@/features/dictionary/server/lookup';
import { getLexiconStatus } from '@/features/lexicon/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { findDictionaryEntry } from '@/lib/content/dictionary';
import { lemmaKey, type DictionaryPos } from '@/lib/content/dictionary-schema';
import { levelOfLemma } from '@/lib/content/levels';
import type { Translate } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('dictionary.lookupTitle') };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const TRY = ['serendipity', 'give up', 'comfortable', 'nevertheless'];

const BADGE = {
  learning: { label: 'dictionary.badgeLearning', className: 'text-accent-text' },
  known: { label: 'dictionary.badgeKnown', className: 'text-success' },
  ignored: { label: 'dictionary.badgeIgnored', className: '' },
} as const;

const lookupHref = (word: string) => ({
  pathname: '/palabras/buscar' as const,
  query: { q: word },
});

/** Categoría en español cuando coincide con las del mazo; si no, tal como la da Wiktionary. */
function posLabel(t: Translate, pos: string) {
  const key = posKey(pos);
  return key ? t(`pos.${key as DictionaryPos}`) : pos.toLowerCase();
}

async function Result({ entry, t }: { entry: LookupEntry; t: Translate }) {
  const key = lemmaKey(entry.word);
  const status = (await getLexiconStatus([key])).get(key);
  const state = stateOf(status);
  const badge = state === 'todo' ? null : BADGE[state];
  const level = levelOfLemma(key);
  const curated = findDictionaryEntry(entry.word);
  const base = baseWord(entry);

  return (
    <>
      <Panel className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 lang="en" className="text-heading">
              {entry.word}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {entry.ipa ? (
                <span lang="en" className="tabular-nums text-muted">
                  {entry.ipa}
                </span>
              ) : null}
              <Chip className="tabular-nums">
                {level ? t('dictionary.lookupLevel', { level }) : t('dictionary.lookupNoLevel')}
              </Chip>
              {badge ? <Chip className={badge.className}>{t(badge.label)}</Chip> : null}
            </div>
          </div>
          <LookupActions word={entry.word} state={state} />
        </div>

        {base ? (
          <p className="text-body-sm">
            {t('dictionary.lookupBase')}{' '}
            <Link
              href={lookupHref(base)}
              lang="en"
              className="rounded-structure font-medium text-accent-text hover:underline"
            >
              {base}
            </Link>
          </p>
        ) : null}

        {curated ? (
          <div className="rounded-card bg-surface-2 px-4 py-3">
            <p className="text-body-sm font-medium text-muted">
              {t('dictionary.lookupInDeck', { level: curated.level })}
            </p>
            <p className="mt-1 text-body-lg">{curated.entry.es}</p>
            <Example
              sentence={curated.entry.example}
              surface={curated.entry.surface}
              className="mt-1 text-body-sm text-muted"
            />
          </div>
        ) : null}
      </Panel>

      <Panel className="flex flex-col gap-3">
        <PanelTitle>{t('dictionary.lookupTranslations')}</PanelTitle>
        {entry.translations.length === 0 ? (
          <p className="text-body-sm text-muted">{t('dictionary.lookupNoTranslation')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entry.translations.map((translation, index) => (
              <li key={`${translation.gloss}-${index}`}>
                <span className="text-body-lg">{translation.terms.join(', ')}</span>
                {translation.gloss ? (
                  <span lang="en" className="ml-2 text-body-sm text-muted">
                    ({translation.gloss})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <PanelTitle>{t('dictionary.lookupDefinitions')}</PanelTitle>
        {entry.groups.map((group) => (
          <section key={group.pos} aria-label={posLabel(t, group.pos)}>
            <p className="text-body-sm font-medium text-accent-text">{posLabel(t, group.pos)}</p>
            <ol className="mt-1 ml-5 flex list-decimal flex-col gap-1.5" lang="en">
              {group.senses.map((sense, index) => (
                <li key={index}>
                  {sense.text}
                  {sense.example ? (
                    <span className="block text-body-sm text-muted">{sense.example}</span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ))}
        <a
          href={`https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word.replace(/ /g, '_'))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 self-start rounded-structure text-caption text-muted hover:text-text"
        >
          {t('dictionary.lookupSource')}
          <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        </a>
      </Panel>
    </>
  );
}

export default async function LookupPage({ searchParams }: PageProps<'/palabras/buscar'>) {
  await getSessionOrRedirect();
  const [params, t] = await Promise.all([searchParams, getT()]);
  const raw = (first(params.q) ?? '').trim();
  const term = LookupTerm.safeParse(raw);
  const result = term.success ? await lookupWord(term.data) : null;

  return (
    <PageContainer width="exercise">
      <header className="flex flex-col gap-3">
        <Link
          href="/palabras"
          className="flex items-center gap-1.5 self-start rounded-structure text-body-sm text-muted hover:text-text"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t('nav.words')}
        </Link>
        <h1 className="text-heading-sm sm:text-heading">{t('dictionary.lookupTitle')}</h1>
        <p className="text-body-sm text-muted">{t('dictionary.lookupSubtitle')}</p>
      </header>

      <form
        action="/palabras/buscar"
        role="search"
        aria-label={t('dictionary.lookupTitle')}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label htmlFor="lookup-q">{t('dictionary.lookupLabel')}</Label>
          <Input
            id="lookup-q"
            name="q"
            type="search"
            lang="en"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            maxLength={60}
            placeholder={t('dictionary.lookupPlaceholder')}
            defaultValue={raw}
          />
        </div>
        <Button type="submit">{t('dictionary.searchButton')}</Button>
      </form>

      {raw === '' ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
          {t('dictionary.lookupTry')}
          {TRY.map((word) => (
            <Link
              key={word}
              href={lookupHref(word)}
              lang="en"
              className="rounded-structure text-accent-text hover:underline"
            >
              {word}
            </Link>
          ))}
        </p>
      ) : !term.success ? (
        <p role="alert" className="text-body-sm text-error">
          {t('dictionary.lookupInvalid')}
        </p>
      ) : result?.status === 'found' ? (
        <Result entry={result.entry} t={t} />
      ) : result?.status === 'not_found' ? (
        <EmptyState icon={SearchX} title={t('dictionary.lookupNotFoundTitle', { word: raw })}>
          <p>{t('dictionary.lookupNotFoundBody')}</p>
          {result.suggestions.length > 0 ? (
            <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {t('dictionary.lookupSuggestions')}
              {result.suggestions.map((word) => (
                <Link
                  key={word}
                  href={lookupHref(word)}
                  lang="en"
                  className="rounded-structure text-accent-text hover:underline"
                >
                  {word}
                </Link>
              ))}
            </p>
          ) : null}
        </EmptyState>
      ) : (
        <EmptyState icon={WifiOff} title={t('dictionary.lookupUnavailableTitle')}>
          {t('dictionary.lookupUnavailableBody')}
        </EmptyState>
      )}
    </PageContainer>
  );
}
