'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Example } from '@/features/dictionary/components/word-list';
import { addDictionaryWords } from '@/features/dictionary/server/actions';
import type { CefrLevel } from '@/features/level/lib/bands';
import { setLexemeStatus } from '@/features/lexicon/server/actions';
import { SpeakButton } from '@/features/pronunciation/components/speak-button';
import { lemmaKey, type DictionaryPos } from '@/lib/content/dictionary-schema';
import { useT } from '@/lib/i18n/client';
import { useContentLang } from '@/components/content-language';

export interface StudyWord {
  lemma: string;
  pos: DictionaryPos[];
  /** Traducción, en el idioma de la interfaz. */
  translation: string;
  example: string;
  surface: string;
}

type Answer = 'review' | 'known' | 'ignored';

/**
 * Tanda de estudio: se ve la palabra, se piensa, se descubre la traducción y se decide. Lo que
 * no se sabía va al repaso espaciado; lo que ya se sabía queda como conocido. Cada respuesta
 * se guarda al darla, así que se puede dejar a medias.
 */
export function StudySession({
  level,
  words,
  query,
}: {
  level: CefrLevel;
  words: StudyWord[];
  /** Parámetros para volver a la lista del mismo nivel. */
  query: Record<string, string>;
}) {
  const t = useT();
  const lang = useContentLang();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState({ review: 0, known: 0, ignored: 0 });
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadingNext, startTransition] = useTransition();
  const revealRef = useRef<HTMLButtonElement>(null);
  const firstAnswerRef = useRef<HTMLButtonElement>(null);

  const word = words[index];

  // El foco sigue a la tarjeta: al botón de descubrir y, una vez descubierta, a la respuesta.
  useEffect(() => {
    (revealed ? firstAnswerRef : revealRef).current?.focus();
  }, [index, revealed]);

  async function answer(choice: Answer) {
    if (!word || saving) return;
    setSaving(true);
    setFailed(false);
    const key = lemmaKey(word.lemma);
    const result = await (
      choice === 'review'
        ? addDictionaryWords({ lemmas: [key] })
        : setLexemeStatus({ lemmas: [key], status: choice })
    ).catch(() => null);
    setSaving(false);
    if (!result?.ok) {
      setFailed(true);
      return;
    }
    setCounts((current) => ({ ...current, [choice]: current[choice] + 1 }));
    setRevealed(false);
    setIndex((current) => current + 1);
  }

  // Atajos: 1, 2 y 3 responden cuando la traducción ya está a la vista.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!revealed || event.metaKey || event.ctrlKey || event.altKey) return;
      const choice = ({ '1': 'review', '2': 'known', '3': 'ignored' } as const)[event.key];
      if (!choice) return;
      event.preventDefault();
      void answer(choice);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!word) {
    return (
      <Panel className="flex flex-col items-center gap-3 py-10 text-center">
        <CircleCheck aria-hidden="true" className="size-8 text-success" strokeWidth={1.75} />
        <h2 className="text-body-lg font-medium">{t('dictionary.doneTitle')}</h2>
        <p className="text-body-sm text-muted" role="status">
          {t('dictionary.doneBody', { review: counts.review, known: counts.known })}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button disabled={loadingNext} onClick={() => startTransition(() => router.refresh())}>
            {t('dictionary.another')}
          </Button>
          {counts.review > 0 ? (
            <Link href="/repasar" className={buttonVariants({ variant: 'outline' })}>
              {t('dictionary.goReview')}
            </Link>
          ) : null}
          <Link
            href={{ pathname: '/palabras', query }}
            className={buttonVariants({ variant: 'secondary' })}
          >
            {t('dictionary.back')}
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="tabular-nums text-body-sm text-muted" aria-live="polite">
        {t('dictionary.cardOf', { n: index + 1, total: words.length })} · {level}
      </p>

      <Panel className="flex flex-col gap-4 py-8 sm:py-10">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1">
            <h2 lang={lang} className="text-heading-lg">
              {word.lemma}
            </h2>
            <SpeakButton text={word.lemma} label={t('dictionary.listen', { word: word.lemma })} />
          </div>
          <p className="text-body-sm text-muted">
            {word.pos.map((pos) => t(`pos.${pos}`)).join(' · ')}
          </p>
        </div>

        {revealed ? (
          <div className="flex flex-col items-center gap-3 border-t border-border pt-4 text-center">
            <p className="text-subheading">{word.translation}</p>
            <div className="flex items-center gap-1">
              <Example
                sentence={word.example}
                surface={word.surface}
                className="prose-reading text-muted"
              />
              <SpeakButton
                text={word.example}
                label={t('dictionary.listenExample')}
                className="shrink-0"
              />
            </div>
          </div>
        ) : (
          <p className="text-center text-body-sm text-muted">{t('dictionary.doYouKnow')}</p>
        )}
      </Panel>

      {revealed ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <Button ref={firstAnswerRef} disabled={saving} onClick={() => void answer('review')}>
            {t('dictionary.didntKnow')}
          </Button>
          <Button variant="secondary" disabled={saving} onClick={() => void answer('known')}>
            {t('dictionary.knewIt')}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => void answer('ignored')}>
            {t('dictionary.skip')}
          </Button>
        </div>
      ) : (
        <Button ref={revealRef} size="lg" onClick={() => setRevealed(true)}>
          {t('dictionary.reveal')}
        </Button>
      )}

      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}
      <p className="hidden text-caption text-muted sm:block">{t('dictionary.shortcuts')}</p>
    </div>
  );
}
