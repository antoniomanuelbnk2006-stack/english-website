'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/panel';
import { setLexemeStatus } from '@/features/lexicon/server/actions';
import type { LexiconEntry } from '@/features/lexicon/server/queries';
import { APP_TIME_ZONE } from '@/lib/dates';
import type { TranslationKey } from '@/lib/i18n';
import { useIntlLocale, useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const STATUS_LABEL = {
  new: 'lexicon.statusNew',
  learning: 'lexicon.statusLearning',
  known: 'lexicon.statusKnown',
  ignored: 'lexicon.statusIgnored',
} as const satisfies Record<string, TranslationKey>;

const STATUS_CLASS = {
  new: 'text-warning',
  learning: 'text-accent-text',
  known: 'text-success',
  ignored: '',
} as const;

const SOURCE_LABEL = {
  placement: 'vocabulary.sourcePlacement',
  manual: 'vocabulary.sourceManual',
  srs: 'vocabulary.sourceSrs',
  implicit: 'vocabulary.sourceImplicit',
  lesson: 'vocabulary.sourceLesson',
} as const satisfies Record<string, TranslationKey>;

/** Tabla del léxico con selección y acciones en bloque. */
export function VocabularyTable({ entries }: { entries: LexiconEntry[] }) {
  const t = useT();
  const locale = useIntlLocale();
  const router = useRouter();
  const [selected, setSelected] = useState(() => new Set<string>());
  const [failed, setFailed] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const busy = saving || refreshing;

  const visible = entries.map((entry) => entry.lemma);
  const chosen = visible.filter((lemma) => selected.has(lemma));
  const allChosen = chosen.length === visible.length && visible.length > 0;
  // Con la zona fijada: el servidor (UTC) y el navegador tienen que escribir el mismo día.
  const date = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    timeZone: APP_TIME_ZONE,
  });

  const toggle = (lemma: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(lemma)) next.delete(lemma);
      else next.add(lemma);
      return next;
    });

  async function apply(status: 'new' | 'known' | 'ignored') {
    setSaving(true);
    setFailed(false);
    const result = await setLexemeStatus({ lemmas: chosen, status }).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setSelected(new Set());
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label={t('vocabulary.bulkLabel')}
        className="flex flex-wrap items-center gap-2"
      >
        <span className="tabular-nums text-body-sm text-muted" aria-live="polite">
          {t('vocabulary.selected', { n: chosen.length })}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || chosen.length === 0}
          onClick={() => void apply('known')}
        >
          {t('vocabulary.markKnown')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || chosen.length === 0}
          onClick={() => void apply('new')}
        >
          {t('vocabulary.markUnknown')}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || chosen.length === 0}
          onClick={() => void apply('ignored')}
        >
          {t('vocabulary.ignore')}
        </Button>
      </div>
      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}

      <div
        role="region"
        aria-label={t('vocabulary.tableLabel')}
        tabIndex={0}
        className="overflow-x-auto rounded-card bg-surface"
      >
        <table className="w-full min-w-[40rem] text-left text-body-sm">
          <thead className="border-b border-border text-caption text-muted">
            <tr>
              <th scope="col" className="w-11 p-0">
                <label className="grid size-11 cursor-pointer place-items-center">
                  <span className="sr-only">{t('vocabulary.selectAll')}</span>
                  <input
                    type="checkbox"
                    className="size-4 accent-accent"
                    checked={allChosen}
                    onChange={() => setSelected(allChosen ? new Set() : new Set(visible))}
                  />
                </label>
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('vocabulary.colLemma')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('library.level')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('library.status')}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t('vocabulary.colSeen')}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t('vocabulary.colLookups')}
              </th>
              <th scope="col" className="px-2 py-2 font-medium">
                {t('vocabulary.colNextReview')}
              </th>
              <th scope="col" className="px-2 py-2 pr-4 font-medium">
                {t('vocabulary.colSource')}
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.lemma} className="border-b border-border last:border-b-0">
                <td className="p-0">
                  <label className="grid size-11 cursor-pointer place-items-center">
                    <span className="sr-only">{t('vocabulary.select', { word: entry.lemma })}</span>
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={selected.has(entry.lemma)}
                      onChange={() => toggle(entry.lemma)}
                    />
                  </label>
                </td>
                <th scope="row" lang="en" className="px-2 py-2 font-medium">
                  {entry.lemma}
                </th>
                <td className="tabular-nums px-2 py-2 text-muted">{entry.cefr ?? '—'}</td>
                <td className="px-2 py-2">
                  <Chip className={cn(STATUS_CLASS[entry.status])}>
                    {t(STATUS_LABEL[entry.status])}
                  </Chip>
                </td>
                <td className="tabular-nums px-2 py-2 text-right text-muted">{entry.seenCount}</td>
                <td className="tabular-nums px-2 py-2 text-right text-muted">
                  {entry.lookupCount}
                </td>
                <td className="tabular-nums px-2 py-2 text-muted">
                  {entry.nextReview ? date.format(new Date(entry.nextReview)) : '—'}
                </td>
                <td className="px-2 py-2 pr-4 text-muted">{t(SOURCE_LABEL[entry.source])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
