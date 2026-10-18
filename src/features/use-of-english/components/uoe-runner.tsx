'use client';

import { BookmarkPlus, CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { fieldClasses } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { toPercent } from '@/features/lessons/lib/summary';
import {
  splitCloze,
  type UoeItemResult,
  type UoeResult,
} from '@/features/use-of-english/lib/grade';
import { addUoeCards, submitUoe } from '@/features/use-of-english/server/actions';
import { countExamWords, type PublicUoeSet } from '@/lib/content/uoe-schema';
import type { TranslationKey } from '@/lib/i18n';
import { useContentLang } from '@/components/content-language';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const INSTRUCTIONS: Record<PublicUoeSet['part'], TranslationKey> = {
  mcq_cloze: 'uoe.howMcq',
  open_cloze: 'uoe.howOpen',
  word_formation: 'uoe.howFormation',
  key_word_transformation: 'uoe.howTransformation',
};

/** Como mucho, estos fallos por ejercicio pasan al repaso. */
const MAX_CARDS = 5;
const LETTERS = ['A', 'B', 'C', 'D'];

const inlineField = cn(
  fieldClasses,
  'mx-1 inline-block h-9 w-32 px-2 align-baseline text-body pointer-coarse:h-11',
);

function Mark({ item }: { item: UoeItemResult }) {
  const t = useT();
  const Icon = item.correct ? CircleCheck : item.marks > 0 ? TriangleAlert : CircleX;
  const color = item.correct ? 'text-success' : item.marks > 0 ? 'text-warning' : 'text-error';
  const label = item.correct
    ? t('tasks.correct')
    : item.marks > 0
      ? t('uoe.halfRight')
      : t('tasks.incorrect');
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium', color)}>
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
      {label}
    </span>
  );
}

/**
 * Un ejercicio de Use of English. Las respuestas no están en el navegador: al corregir, el
 * servidor devuelve la nota, la respuesta modelo y la explicación de cada hueco.
 */
export function UoeRunner({ set }: { set: PublicUoeSet }) {
  const t = useT();
  const lang = useContentLang();
  const [answers, setAnswers] = useState<Record<number, string | number>>({});
  const [result, setResult] = useState<UoeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const numbers =
    set.part === 'key_word_transformation'
      ? set.items.map((item) => item.n)
      : set.gaps.map((gap) => gap.n);
  const answered = numbers.some((n) => {
    const value = answers[n];
    return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '');
  });
  const byNumber = new Map(result?.items.map((item) => [item.n, item]));
  const missed = result?.items.filter((item) => !item.correct) ?? [];
  const locked = result !== null;

  // Al corregir, el foco va al resultado para que se lea (y se anuncie) lo primero.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const update = (n: number, value: string | number) => {
    startedAt.current ??= Date.now();
    setAnswers((current) => ({ ...current, [n]: value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked || busy) return;
    setBusy(true);
    setFailed(false);
    const response = await submitUoe({
      setId: set.id,
      version: set.version,
      answers: numbers.map((n) => ({
        n,
        value: answers[n] ?? '',
        clientId: crypto.randomUUID(),
      })),
      durationMs: startedAt.current === null ? 0 : Date.now() - startedAt.current,
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    setResult(response.data);
  }

  async function addToReview() {
    setBusy(true);
    setFailed(false);
    const response = await addUoeCards({
      setId: set.id,
      items: missed.slice(0, MAX_CARDS).map((item) => item.n),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) setAdded(response.data.added);
    else setFailed(true);
  }

  function reset() {
    setAnswers({});
    setResult(null);
    setAdded(null);
    startedAt.current = null;
    window.scrollTo({ top: 0 });
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      <p className="text-body-sm text-muted">{t(INSTRUCTIONS[set.part])}</p>

      {set.part === 'key_word_transformation' ? (
        <>
          <p className="tabular-nums text-body-sm text-muted">
            {t('uoe.wordLimit', { min: set.min_words, max: set.max_words })}
          </p>
          <ol className="flex flex-col gap-6">
            {set.items.map((item) => {
              const value = String(answers[item.n] ?? '');
              const words = value.trim() === '' ? 0 : countExamWords(value);
              const outcome = byNumber.get(item.n);
              return (
                <li key={item.n} className="flex flex-col gap-2">
                  <p lang={lang} className="prose-reading">
                    <span lang="es" className="tabular-nums mr-2 text-body-sm text-muted">
                      {item.n}.
                    </span>
                    {item.original}
                  </p>
                  <p lang={lang} className="text-body-sm font-medium text-accent-text tabular-nums">
                    {item.keyword}
                  </p>
                  <p lang={lang} className="prose-reading leading-[2.75rem]">
                    {item.before}
                    <input
                      type="text"
                      lang={lang}
                      aria-label={t('uoe.sentence', { n: item.n })}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className={cn(inlineField, 'w-64 max-w-full')}
                      value={value}
                      readOnly={locked}
                      aria-invalid={outcome ? !outcome.correct : undefined}
                      onChange={(event) => update(item.n, event.target.value)}
                    />
                    {item.after}
                  </p>
                  {!locked ? (
                    <p
                      className={cn(
                        'tabular-nums text-caption',
                        words > set.max_words ? 'text-error' : 'text-muted',
                      )}
                    >
                      {words === 1 ? t('uoe.wordCountOne') : t('uoe.wordCount', { n: words })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <Panel>
          <h2 lang={lang} className="mb-3 text-body-lg font-medium">
            {set.title}
          </h2>
          <p lang={lang} className="prose-reading leading-[2.75rem]">
            {splitCloze(set.text).map((piece, index) => {
              if (typeof piece === 'string') return <span key={index}>{piece}</span>;
              const outcome = byNumber.get(piece);
              const label = t('tasks.gap', { n: piece });
              const invalid = outcome ? !outcome.correct : undefined;

              if (set.part === 'mcq_cloze') {
                const options = set.gaps.find((gap) => gap.n === piece)?.options ?? [];
                const chosen = answers[piece];
                return (
                  <span key={index} className="whitespace-nowrap">
                    <span lang="es" className="tabular-nums text-caption text-muted">
                      ({piece})
                    </span>
                    <select
                      lang={lang}
                      aria-label={label}
                      className={cn(inlineField, 'w-auto pr-7')}
                      value={typeof chosen === 'number' ? String(chosen) : ''}
                      disabled={locked}
                      aria-invalid={invalid}
                      onChange={(event) =>
                        update(piece, event.target.value === '' ? '' : Number(event.target.value))
                      }
                    >
                      <option value="">{t('tasks.choose')}</option>
                      {options.map((option, optionIndex) => (
                        <option key={option} value={optionIndex}>
                          {LETTERS[optionIndex]}. {option}
                        </option>
                      ))}
                    </select>
                  </span>
                );
              }

              const stem =
                set.part === 'word_formation'
                  ? set.gaps.find((gap) => gap.n === piece)?.stem
                  : undefined;
              return (
                <span key={index} className="whitespace-nowrap">
                  <span lang="es" className="tabular-nums text-caption text-muted">
                    ({piece})
                  </span>
                  <input
                    type="text"
                    lang={lang}
                    aria-label={label}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className={cn(inlineField, stem ? 'w-40' : 'w-28')}
                    value={String(answers[piece] ?? '')}
                    readOnly={locked}
                    aria-invalid={invalid}
                    onChange={(event) => update(piece, event.target.value)}
                  />
                  {stem ? (
                    <span className="tabular-nums text-body-sm font-medium text-accent-text">
                      {stem}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </p>
        </Panel>
      )}

      {failed ? (
        <p role="alert" className="text-body-sm text-error">
          {t('errors.saveFailed')}
        </p>
      ) : null}

      {result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className="card flex flex-col gap-4 outline-none"
        >
          <p className="tabular-nums text-heading-sm">
            {t('uoe.score', {
              marks: result.marks,
              total: result.total,
              pct: toPercent(result.score),
            })}
          </p>
          <ol className="flex flex-col gap-3">
            {result.items.map((item) => (
              <li key={item.n} className="flex flex-col gap-1 text-body-sm">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums text-muted">{item.n}.</span>
                  <Mark item={item} />
                  {item.max > 1 ? (
                    <span className="tabular-nums text-muted">
                      {t('uoe.marksOf', { marks: item.marks, max: item.max })}
                    </span>
                  ) : null}
                </span>
                {!item.correct ? (
                  <span className="text-muted">
                    {t('tasks.yourAnswer')}:{' '}
                    {item.given === '' ? (
                      t('uoe.blank')
                    ) : (
                      <span lang={lang} className="text-text">
                        {item.given}
                      </span>
                    )}
                  </span>
                ) : null}
                <span>
                  {t('tasks.correctAnswer')}:{' '}
                  <span lang={lang} className="font-medium">
                    {item.answer}
                  </span>
                </span>
                {item.note ? (
                  <span className="text-warning">
                    {t(item.note === 'word_limit' ? 'uoe.noteWordLimit' : 'uoe.noteKeyword')}
                  </span>
                ) : null}
                <span className="text-muted">{item.explanation_es}</span>
              </li>
            ))}
          </ol>

          {added !== null ? (
            <p className="text-body-sm text-success">
              {added === 1 ? t('harvest.addedOne') : t('harvest.added', { n: added })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {missed.length > 0 && added === null ? (
              <Button disabled={busy} onClick={() => void addToReview()}>
                <BookmarkPlus aria-hidden="true" strokeWidth={2} />
                {t('uoe.addMissed', { n: Math.min(missed.length, MAX_CARDS) })}
              </Button>
            ) : null}
            {added ? (
              <Link href="/repasar" className={buttonVariants({ variant: 'secondary' })}>
                {t('harvest.goReview')}
              </Link>
            ) : null}
            <Button variant="secondary" disabled={busy} onClick={reset}>
              {t('grammar.practiceAgain')}
            </Button>
            <Link href="/use-of-english" className={buttonVariants({ variant: 'ghost' })}>
              {t('uoe.backToIndex')}
            </Link>
          </div>
        </div>
      ) : (
        <Button type="submit" size="lg" className="self-start" disabled={busy || !answered}>
          {busy ? t('common.saving') : t('uoe.check')}
        </Button>
      )}
    </form>
  );
}
