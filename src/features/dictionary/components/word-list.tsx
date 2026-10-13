'use client';

import { Mic } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Chip } from '@/components/ui/panel';
import type { WordState } from '@/features/dictionary/lib/browse';
import { addDictionaryWords } from '@/features/dictionary/server/actions';
import { setLexemeStatus } from '@/features/lexicon/server/actions';
import { SpeakButton } from '@/features/pronunciation/components/speak-button';
import { splitAround } from '@/features/srs/lib/cards';
import { lemmaKey, type DictionaryPos } from '@/lib/content/dictionary-schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

export interface WordView {
  lemma: string;
  pos: DictionaryPos[];
  es: string;
  example: string;
  surface: string;
  state: WordState;
}

const BADGE = {
  learning: { label: 'dictionary.badgeLearning', className: 'text-accent-text' },
  known: { label: 'dictionary.badgeKnown', className: 'text-success' },
  ignored: { label: 'dictionary.badgeIgnored', className: '' },
} as const;

/** Frase de ejemplo con la palabra resaltada. */
export function Example({
  sentence,
  surface,
  className,
}: {
  sentence: string;
  surface: string;
  className?: string;
}) {
  const parts = splitAround(sentence, surface);
  return (
    <p lang="en" className={className}>
      {parts ? (
        <>
          {parts.before}
          <strong className="font-semibold text-accent-text">{parts.match}</strong>
          {parts.after}
        </>
      ) : (
        sentence
      )}
    </p>
  );
}

function WordRow({ word }: { word: WordView }) {
  const t = useT();
  const router = useRouter();
  // El cambio se enseña al momento; cuando el servidor devuelve el estado real, manda ese.
  const [override, setOverride] = useState<{ from: WordState; to: WordState } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();
  const state = override && override.from === word.state ? override.to : word.state;

  async function change(to: WordState) {
    setSaving(true);
    setFailed(false);
    const key = lemmaKey(word.lemma);
    const result = await (
      to === 'learning'
        ? addDictionaryWords({ lemmas: [key] })
        : setLexemeStatus({ lemmas: [key], status: to === 'known' ? 'known' : 'new' })
    ).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setOverride({ from: word.state, to });
    startTransition(() => router.refresh());
  }

  const badge = state === 'todo' ? null : BADGE[state];

  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span lang="en" className="text-body-lg leading-snug font-medium">
            {word.lemma}
          </span>
          <span className="text-caption text-muted">
            {word.pos.map((pos) => t(`pos.${pos}`)).join(' · ')}
          </span>
          {badge ? <Chip className={badge.className}>{t(badge.label)}</Chip> : null}
        </div>
        <p className="mt-0.5">{word.es}</p>
        <Example
          sentence={word.example}
          surface={word.surface}
          className="mt-1 text-body-sm text-muted"
        />
        {failed ? (
          <p role="alert" className="mt-1 text-body-sm text-error">
            {t('errors.saveFailed')}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <SpeakButton text={word.lemma} label={t('dictionary.listen', { word: word.lemma })} />
        <Link
          href={{ pathname: '/pronunciar/libre', query: { texto: word.lemma } }}
          aria-label={t('dictionary.pronounce', { word: word.lemma })}
          title={t('dictionary.pronounce', { word: word.lemma })}
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <Mic aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </Link>
        {state !== 'learning' ? (
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            aria-label={t('dictionary.toReviewWord', { word: word.lemma })}
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
            aria-label={t('dictionary.dontKnowWord', { word: word.lemma })}
            onClick={() => void change('todo')}
          >
            {t('dictionary.dontKnowIt')}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={saving}
            aria-label={t('dictionary.iKnowWord', { word: word.lemma })}
            onClick={() => void change('known')}
          >
            {t('dictionary.iKnowIt')}
          </Button>
        )}
      </div>
    </li>
  );
}

/** Lista de palabras del mazo, cada una con su traducción, su ejemplo y sus acciones. */
export function WordList({ words, label }: { words: WordView[]; label: string }) {
  return (
    <ul aria-label={label} className={cn('flex flex-col gap-2')}>
      {words.map((word) => (
        <WordRow key={word.lemma} word={word} />
      ))}
    </ul>
  );
}
