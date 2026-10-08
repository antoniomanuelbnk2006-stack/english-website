'use client';

import { CircleCheck, CircleX } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { splitPrompt } from '@/features/grammar/lib/practice';
import { submitPractice, type PracticeResult } from '@/features/grammar/server/actions';
import { toPercent } from '@/features/lessons/lib/summary';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/**
 * Mini-práctica de una ficha: cinco huecos. La corrige el servidor (las respuestas no viajan
 * al navegador hasta entonces) y los fallos pasan al repaso como tarjetas de gramática.
 */
export function Practice({
  grammarId,
  items,
}: {
  grammarId: string;
  items: { id: string; prompt: string }[];
}) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const startedAt = useRef<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Al corregir, el foco va al resultado para que se lea (y se anuncie) lo primero.
  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const byItem = new Map(result?.items.map((item) => [item.itemId, item]));
  const answered = items.some((item) => (answers[item.id] ?? '').trim() !== '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (result || busy) return;
    setBusy(true);
    setFailed(false);
    const elapsed = startedAt.current === null ? 0 : Date.now() - startedAt.current;
    const perItem = Math.min(600_000, Math.round(elapsed / items.length));
    const response = await submitPractice({
      grammarId,
      answers: items.map((item) => ({
        itemId: item.id,
        text: answers[item.id] ?? '',
        durationMs: perItem,
        clientId: crypto.randomUUID(),
      })),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setFailed(true);
      return;
    }
    setResult(response.data);
  }

  function reset() {
    setAnswers({});
    setResult(null);
    startedAt.current = null;
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {items.map((item, index) => {
          const prompt = splitPrompt(item.prompt);
          const outcome = byItem.get(item.id);
          return (
            <li key={item.id} className="flex flex-col gap-1.5">
              <p lang="en" className="reading-md flex flex-wrap items-baseline gap-x-1.5 gap-y-2">
                <span lang="es" className="hud text-sm text-muted">
                  {index + 1}.
                </span>
                <span>{prompt.before}</span>
                <Input
                  aria-label={t('tasks.gap', { n: index + 1 })}
                  lang="en"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="inline-block w-44"
                  value={answers[item.id] ?? ''}
                  readOnly={result !== null}
                  aria-invalid={outcome ? !outcome.correct : undefined}
                  onChange={(event) => {
                    startedAt.current ??= Date.now();
                    setAnswers((current) => ({ ...current, [item.id]: event.target.value }));
                  }}
                />
                <span>{prompt.after}</span>
              </p>
              {outcome ? (
                <p
                  className={cn(
                    'flex items-start gap-2 text-sm',
                    outcome.correct ? 'text-success' : 'text-danger',
                  )}
                >
                  {outcome.correct ? (
                    <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <CircleX aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>
                    <span className="font-medium">
                      {outcome.correct ? t('tasks.correct') : t('tasks.incorrect')}
                      {outcome.correct ? '' : ': '}
                    </span>
                    {outcome.correct ? null : (
                      <span lang="en" className="font-medium">
                        {outcome.answer}
                      </span>
                    )}
                    <span className="text-muted"> — {outcome.rule_es}</span>
                  </span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {t('errors.saveFailed')}
        </p>
      ) : null}

      {result ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className="flex flex-col gap-3 rounded-control border border-border bg-surface-2 p-3 outline-none"
        >
          <p className="font-medium">
            {t('grammar.practiceScore', {
              hits: result.items.filter((item) => item.correct).length,
              total: result.items.length,
              pct: toPercent(result.score),
            })}
          </p>
          {result.cardsAdded > 0 ? (
            <p className="text-sm text-muted">
              {result.cardsAdded === 1
                ? t('grammar.cardsAddedOne')
                : t('grammar.cardsAdded', { n: result.cardsAdded })}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={reset}>
              {t('grammar.practiceAgain')}
            </Button>
            {result.cardsAdded > 0 ? (
              <Link href="/repasar" className={buttonVariants({ variant: 'outline' })}>
                {t('harvest.goReview')}
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <Button type="submit" size="lg" className="self-start" disabled={busy || !answered}>
          {busy ? t('common.saving') : t('tasks.check')}
        </Button>
      )}
    </form>
  );
}
