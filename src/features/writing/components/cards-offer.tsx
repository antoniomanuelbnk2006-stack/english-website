'use client';

import { BookmarkPlus } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PanelTitle } from '@/components/ui/panel';
import { addWritingCards } from '@/features/writing/server/actions';
import { useT } from '@/lib/i18n/client';

/** Errores de una entrega que se pueden pasar al repaso. El usuario elige cuáles. */
export function CardsOffer({
  submissionId,
  cards,
}: {
  submissionId: string;
  cards: readonly { front: string; back: string }[];
}) {
  const t = useT();
  const id = useId();
  const [chosen, setChosen] = useState<boolean[]>(() => cards.map(() => true));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<number | null>(null);

  if (cards.length === 0) return null;
  const items = chosen.flatMap((value, index) => (value ? [index] : []));

  async function add() {
    setBusy(true);
    setFailed(false);
    const response = await addWritingCards({ submissionId, items }).catch(() => null);
    setBusy(false);
    if (response?.ok) setAdded(response.data.added);
    else setFailed(true);
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <PanelTitle id={`${id}-title`}>{t('writing.cardsTitle')}</PanelTitle>
      <p className="text-sm text-muted">{t('writing.cardsHint')}</p>
      <ul className="flex flex-col">
        {cards.map((card, index) => (
          <li key={index}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-2 py-2 hover:bg-surface-2">
              <input
                type="checkbox"
                checked={chosen[index] ?? false}
                disabled={busy || added !== null}
                onChange={(event) =>
                  setChosen((current) =>
                    current.map((value, i) => (i === index ? event.target.checked : value)),
                  )
                }
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span lang="en" className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span>{card.front}</span>
                <span className="font-medium text-success">{card.back}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        {added === null ? (
          <Button
            variant="secondary"
            disabled={busy || items.length === 0}
            onClick={() => void add()}
          >
            <BookmarkPlus aria-hidden="true" strokeWidth={2} />
            {t('writing.addCards')}
          </Button>
        ) : (
          <Link href="/repasar" className={buttonVariants({ variant: 'outline' })}>
            {t('harvest.goReview')}
          </Link>
        )}
        <p role="status" className="text-sm">
          {added !== null ? (
            <span className="text-success">
              {added === 1 ? t('harvest.addedOne') : t('harvest.added', { n: added })}
            </span>
          ) : failed ? (
            <span className="text-danger">{t('errors.saveFailed')}</span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
