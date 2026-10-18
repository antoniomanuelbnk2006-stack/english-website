'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useContentLanguage } from '@/components/content-language';
import { Button, buttonVariants } from '@/components/ui/button';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { toPercent } from '@/features/lessons/lib/summary';
import { AccentPicker, useAccent } from '@/features/pronunciation/components/accent-picker';
import { PracticeCard } from '@/features/pronunciation/components/practice-card';
import {
  CLOSE_THRESHOLD,
  type Assessment,
  type Confusion,
} from '@/features/pronunciation/lib/assess';
import { savePronunciation } from '@/features/pronunciation/server/actions';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export interface TrainerItem {
  id: string;
  text: string;
  ipa?: string;
  es?: string;
  confusions: Confusion[];
}

interface Best {
  score: number;
  attempts: number;
  heard: string;
  understood: boolean;
}

/** Sin llegar a entenderse del todo, se ha entendido la mayor parte. */
const almost = (own: Best) => own.score >= CLOSE_THRESHOLD;

/**
 * Un ejercicio de pronunciación: una palabra o frase cada vez, tantos intentos como se quiera.
 * De cada una cuenta el mejor intento. Al terminar se guarda el resultado.
 */
export function PronunciationTrainer({
  setId,
  version,
  items,
}: {
  setId: string;
  version: number;
  items: TrainerItem[];
}) {
  const t = useT();
  const router = useRouter();
  const accent = useAccent();
  const language = useContentLanguage();
  const [index, setIndex] = useState(0);
  const [best, setBest] = useState<Record<string, Best>>({});
  const [finished, setFinished] = useState<{ score: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const startedAt = useRef<number | null>(null);

  const item = items[index];
  const last = index === items.length - 1;
  const attempted = Object.keys(best).length;

  function record(itemId: string, assessment: Assessment) {
    startedAt.current ??= Date.now();
    setBest((current) => {
      const previous = current[itemId];
      const improved = !previous || assessment.score > previous.score;
      return {
        ...current,
        [itemId]: {
          score: improved ? assessment.score : previous.score,
          heard: improved ? assessment.heard : previous.heard,
          understood: (previous?.understood ?? false) || assessment.verdict === 'good',
          attempts: (previous?.attempts ?? 0) + 1,
        },
      };
    });
  }

  async function finish() {
    setSaving(true);
    setFailed(false);
    const result = await savePronunciation({
      setId,
      version,
      durationMs: startedAt.current === null ? 0 : Date.now() - startedAt.current,
      results: Object.entries(best).map(([itemId, own]) => ({
        itemId,
        score: own.score,
        attempts: own.attempts,
        heard: own.heard.slice(0, 200),
        clientId: crypto.randomUUID(),
      })),
    }).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setFinished(result.data);
    router.refresh();
  }

  if (finished) {
    const understood = items.filter((entry) => best[entry.id]?.understood).length;
    return (
      <Panel className="flex flex-col gap-4">
        <PanelTitle>{t('pronunciation.resultTitle')}</PanelTitle>
        <p role="status" className="text-body-lg">
          {t('pronunciation.resultBody', {
            ok: understood,
            total: items.length,
            pct: toPercent(finished.score),
          })}
        </p>
        <ul className="flex flex-col gap-1.5">
          {items.map((entry) => {
            const own = best[entry.id];
            return (
              <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span lang="en">{entry.text}</span>
                <span
                  className={cn(
                    'tabular-nums text-body-sm',
                    !own && 'text-muted',
                    own?.understood && 'text-success',
                    own && !own.understood && (almost(own) ? 'text-warning' : 'text-error'),
                  )}
                >
                  {!own
                    ? t('pronunciation.itemSkipped')
                    : own.understood
                      ? t('pronunciation.itemGood')
                      : almost(own)
                        ? t('pronunciation.itemAlmost', { pct: toPercent(own.score) })
                        : t('pronunciation.itemMissed')}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setBest({});
              setIndex(0);
              setFinished(null);
              startedAt.current = null;
            }}
          >
            {t('pronunciation.again')}
          </Button>
          <Link href="/pronunciar" className={buttonVariants({ variant: 'secondary' })}>
            {t('pronunciation.backToList')}
          </Link>
        </div>
      </Panel>
    );
  }

  if (!item) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="tabular-nums text-body-sm text-muted" aria-live="polite">
          {t('pronunciation.itemOf', { n: index + 1, total: items.length })}
        </p>
        {language === 'en' ? <AccentPicker /> : null}
      </div>

      <ol aria-hidden="true" className="flex gap-1">
        {items.map((entry, position) => {
          const own = best[entry.id];
          return (
            <li
              key={entry.id}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                own?.understood ? 'bg-success' : own ? 'bg-warning' : 'bg-surface-2',
                position === index && 'outline-2 outline-offset-2 outline-accent',
              )}
            />
          );
        })}
      </ol>

      <PracticeCard
        // Cada palabra empieza limpia: sin el resultado de la anterior.
        key={`${item.id}-${accent}`}
        text={item.text}
        ipa={item.ipa}
        es={item.es}
        confusions={item.confusions}
        accent={accent}
        onAssessed={(assessment) => record(item.id, assessment)}
        assessed={Boolean(best[item.id])}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          disabled={index === 0}
          onClick={() => setIndex((current) => Math.max(0, current - 1))}
        >
          {t('pronunciation.previous')}
        </Button>
        {last ? (
          <Button
            variant={best[item.id] ? 'primary' : 'secondary'}
            disabled={saving || attempted === 0}
            onClick={() => void finish()}
          >
            {t('pronunciation.finish')}
          </Button>
        ) : (
          <Button
            variant={best[item.id] ? 'primary' : 'secondary'}
            onClick={() => setIndex((current) => current + 1)}
          >
            {t(best[item.id] ? 'pronunciation.next' : 'pronunciation.skip')}
          </Button>
        )}
      </div>

      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}
      <p className="text-caption text-muted">{t('pronunciation.privacy')}</p>
    </div>
  );
}
