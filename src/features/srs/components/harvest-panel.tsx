'use client';

import { BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Chip } from '@/components/ui/panel';
import type {
  CardRequest,
  LexiconSession,
} from '@/features/lexicon/components/use-lexicon-session';
import type { Cause } from '@/features/listening/lib/dictation';
import { harvest, HARVEST_LIMIT, type HarvestReason } from '@/features/srs/lib/harvest';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';

const REASON_LABEL: Record<HarvestReason, TranslationKey> = {
  dictation: 'harvest.reasonDictation',
  marked: 'harvest.reasonMarked',
  level: 'harvest.reasonLevel',
  chunk: 'harvest.reasonChunk',
  rare: 'harvest.reasonRare',
};

/**
 * Cosecha al terminar una lección: propone qué merece una tarjeta, ya priorizado y con el
 * límite por lección (docs/01-pedagogia/05-vocabulario-y-srs.md §8). El usuario decide.
 */
export function HarvestPanel({
  skill,
  lexicon,
  glossary,
  failures = [],
  segmentText,
}: {
  skill: 'listening' | 'reading';
  lexicon: LexiconSession;
  glossary: readonly { lemma: string; pos: string; def_es: string; cefr?: string }[];
  /** Fallos del dictado de la lección. */
  failures?: readonly { segmentId: string; cause: Cause }[];
  /** Texto de un segmento, para enseñar qué frase es cada tarjeta de audio. */
  segmentText?: (segmentId: string) => string | undefined;
}) {
  const t = useT();
  const limit = HARVEST_LIMIT[skill];

  const candidates = useMemo(
    () =>
      harvest({
        skill,
        userLevel: lexicon.userLevel,
        glossary: glossary.map(({ lemma, pos }) => ({ lemma, pos })),
        levelOf: lexicon.levelOf,
        statusOf: lexicon.statusOf,
        hasCard: lexicon.hasCard,
        failures,
        marked: lexicon.marked,
      }),
    [skill, lexicon, glossary, failures],
  );

  // La preselección se fija al abrir el panel; después manda lo que marque el usuario.
  const [chosen, setChosen] = useState(
    () => new Set(candidates.filter((c) => c.selected).map((c) => c.key)),
  );
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);

  const definitions = useMemo(
    () => new Map(glossary.map((entry) => [entry.lemma, entry.def_es])),
    [glossary],
  );
  const selected = candidates.filter((c) => chosen.has(c.key));
  const left = Math.max(0, limit - added);
  const atLimit = selected.length >= left;

  const toggle = (key: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function add() {
    const items: CardRequest[] = selected
      .slice(0, left)
      .map((candidate) =>
        candidate.kind === 'audio'
          ? { kind: 'audio', segmentId: candidate.segmentId ?? '' }
          : { kind: 'word', lemma: candidate.lemma ?? '' },
      );
    setBusy(true);
    const count = await lexicon.addToReview(items);
    setBusy(false);
    if (count !== null) setAdded((n) => n + count);
  }

  if (candidates.length === 0 && added === 0) return null;

  return (
    <section aria-labelledby="harvest-title" className="flex flex-col gap-3">
      <div>
        <h3 id="harvest-title" className="text-sm font-medium">
          {t('harvest.title')}
        </h3>
        <p className="mt-1 text-sm text-muted">{t('harvest.hint', { n: limit })}</p>
      </div>

      {candidates.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {candidates.map((candidate) => {
            const checked = chosen.has(candidate.key);
            const id = `harvest-${candidate.key.replace(/[^a-z0-9]+/gi, '-')}`;
            const sentence = candidate.segmentId ? segmentText?.(candidate.segmentId) : undefined;
            return (
              <li key={candidate.key}>
                <label
                  htmlFor={id}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-2 py-2 hover:bg-surface-2"
                >
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={busy || (!checked && atLimit)}
                    onChange={() => toggle(candidate.key)}
                    className="mt-1 size-4 shrink-0 accent-accent"
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                    {candidate.kind === 'audio' ? (
                      <>
                        <span className="font-medium">{t('harvest.audioCard')}</span>
                        {sentence ? (
                          <span lang="en" className="text-muted">
                            {sentence}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span lang="en" className="font-medium">
                          {candidate.lemma}
                        </span>
                        <span className="text-muted">{definitions.get(candidate.lemma ?? '')}</span>
                      </>
                    )}
                  </span>
                  <Chip className="mt-0.5 shrink-0">{t(REASON_LABEL[candidate.reason])}</Chip>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      {added > 0 ? (
        <p role="status" className="text-sm text-success">
          {added === 1 ? t('harvest.addedOne') : t('harvest.added', { n: added })}
        </p>
      ) : null}
      {lexicon.failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('errors.saveFailed')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {candidates.length > 0 && left > 0 ? (
          <Button disabled={busy || selected.length === 0} onClick={() => void add()}>
            <BookmarkPlus aria-hidden="true" strokeWidth={2} />
            {t('harvest.add', { n: Math.min(selected.length, left) })}
          </Button>
        ) : null}
        {added > 0 ? (
          <Link href="/repasar" className={buttonVariants({ variant: 'outline' })}>
            {t('harvest.goReview')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
