'use client';

import { Mic } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import type { WordState } from '@/features/dictionary/lib/browse';
import { addLookupWord } from '@/features/dictionary/server/actions';
import { setLexemeStatus } from '@/features/lexicon/server/actions';
import { SpeakButton } from '@/features/pronunciation/components/speak-button';
import { lemmaKey } from '@/lib/content/dictionary-schema';
import { useT } from '@/lib/i18n/client';

/** Lo que se puede hacer con una palabra buscada: oírla, practicarla, repasarla o darla por sabida. */
export function LookupActions({ word, state: initial }: { word: string; state: WordState }) {
  const t = useT();
  const router = useRouter();
  // El cambio se enseña al momento; cuando el servidor devuelve el estado real, manda ese.
  const [override, setOverride] = useState<{ from: WordState; to: WordState } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const state = override && override.from === initial ? override.to : initial;

  async function change(to: WordState) {
    setSaving(true);
    setFailed(false);
    const result = await (
      to === 'learning'
        ? addLookupWord({ word })
        : setLexemeStatus({ lemmas: [lemmaKey(word)], status: to === 'known' ? 'known' : 'new' })
    ).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setOverride({ from: initial, to });
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <SpeakButton text={word} label={t('dictionary.listen', { word })} />
        <Link
          href={{ pathname: '/pronunciar/libre', query: { texto: word } }}
          aria-label={t('dictionary.pronounce', { word })}
          title={t('dictionary.pronounce', { word })}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <Mic aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </Link>
        {state !== 'learning' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            aria-label={t('dictionary.toReviewWord', { word })}
            onClick={() => void change('learning')}
          >
            {t('dictionary.toReview')}
          </Button>
        ) : null}
        {state === 'known' ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            aria-label={t('dictionary.dontKnowWord', { word })}
            onClick={() => void change('todo')}
          >
            {t('dictionary.dontKnowIt')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            aria-label={t('dictionary.iKnowWord', { word })}
            onClick={() => void change('known')}
          >
            {t('dictionary.iKnowIt')}
          </Button>
        )}
      </div>
      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}
    </div>
  );
}
