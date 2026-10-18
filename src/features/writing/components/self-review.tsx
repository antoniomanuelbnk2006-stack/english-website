'use client';

import { ArrowRight, CircleCheck, TriangleAlert } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineText } from '@/components/ui/inline-text';
import { Label, Select } from '@/components/ui/input';
import { Chip, PanelTitle } from '@/components/ui/panel';
import type { FormCheck, Hint, SelfReview as Review } from '@/features/writing/lib/checks';
import { CRITERIA, MAX_SCORE, type Criterion, type Scores } from '@/features/writing/lib/schema';
import { saveSelfAssessment } from '@/features/writing/server/actions';
import type { Translate } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { useContentLang } from '@/components/content-language';

const SCORE_OPTIONS = Array.from({ length: MAX_SCORE + 1 }, (_, index) => index);

/** El texto de una comprobación de forma, según haya salido bien o no. */
function describeCheck(t: Translate, check: FormCheck): string {
  switch (check.id) {
    case 'length': {
      const vars = { words: check.words, min: check.min, max: check.max };
      if (check.ok) return t('writing.check.lengthOk', vars);
      return t(
        check.words < check.min ? 'writing.check.lengthShort' : 'writing.check.lengthLong',
        vars,
      );
    }
    case 'paragraphs':
      return t(check.ok ? 'writing.check.paragraphsOk' : 'writing.check.paragraphsBad', {
        count: check.count,
        expected: check.expected,
      });
    case 'greeting':
      return t(check.ok ? 'writing.check.greetingOk' : 'writing.check.greetingBad');
    case 'closing':
      return t(check.ok ? 'writing.check.closingOk' : 'writing.check.closingBad');
    case 'headings':
      return t(check.ok ? 'writing.check.headingsOk' : 'writing.check.headingsBad', {
        count: check.count,
        expected: check.expected,
      });
    case 'linkers': {
      const vars = {
        n: check.found.length,
        expected: check.expected,
        list: check.found.join(', '),
      };
      if (check.ok) return t('writing.check.linkersOk', vars);
      return t(
        check.found.length === 0 ? 'writing.check.linkersNone' : 'writing.check.linkersBad',
        vars,
      );
    }
    case 'overused':
      return t(check.ok ? 'writing.check.overusedOk' : 'writing.check.overusedBad', {
        list: check.words.map((item) => `${item.word} ×${item.count}`).join(', '),
      });
    case 'long_sentences':
      return t(check.ok ? 'writing.check.longOk' : 'writing.check.longBad', {
        count: check.count,
        limit: check.limit,
      });
  }
}

function HintItem({ hint, number, ficha }: { hint: Hint; number?: number; ficha?: string }) {
  const t = useT();
  const lang = useContentLang();
  return (
    <li className="flex gap-3 text-body-sm">
      <span aria-hidden="true" className="tabular-nums w-5 shrink-0 text-accent-text">
        {number ?? '·'}
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p lang={lang} className="flex flex-wrap items-baseline gap-x-2 text-body">
          {hint.suggestion === null ? (
            <span className="font-medium">{hint.match}</span>
          ) : (
            <>
              <del className="text-error">{hint.match}</del>
              <ArrowRight aria-hidden="true" className="size-4 self-center text-muted" />
              <span lang="es" className="sr-only">
                {t('writing.suggestion')}:
              </span>
              <ins className="font-medium text-success no-underline">{hint.suggestion}</ins>
            </>
          )}
        </p>
        <p className="flex flex-wrap gap-1.5">
          <Chip>{t(`writing.kinds.${hint.type}`)}</Chip>
        </p>
        <p className="text-muted">
          <InlineText text={hint.explanation_es} />
        </p>
        {ficha ? (
          <Link
            href={`/gramatica/${hint.grammar_ref}` as Route}
            className="self-start text-accent-text underline underline-offset-4"
          >
            {t('writing.openFicha')}: <span lang={lang}>{ficha}</span>
          </Link>
        ) : null}
      </div>
    </li>
  );
}

/**
 * La revisión sin IA: comprobaciones de forma, posibles errores y la autoevaluación del
 * usuario (puntos cubiertos y notas con la rúbrica), que es lo único que se guarda.
 */
export function SelfReview({
  submissionId,
  review,
  points,
  initial,
  fichas,
}: {
  submissionId: string;
  review: Review;
  /** Los puntos que pedía la consigna. */
  points: readonly string[];
  initial: { scores: Scores | null; points: boolean[] };
  fichas: Record<string, string>;
}) {
  const t = useT();
  const lang = useContentLang();
  const formId = useId();
  const [covered, setCovered] = useState<boolean[]>(() =>
    points.map((_, index) => initial.points[index] ?? false),
  );
  const [scores, setScores] = useState<Partial<Scores>>(initial.scores ?? {});
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const errors = review.hints.filter((hint) => hint.severity !== 'check');
  const toCheck = review.hints.filter((hint) => hint.severity === 'check');
  const complete = CRITERIA.every((criterion) => scores[criterion] !== undefined);

  async function save() {
    setState('saving');
    const response = await saveSelfAssessment({
      submissionId,
      scores: complete ? scores : null,
      points: covered,
    }).catch(() => null);
    setState(response?.ok ? 'saved' : 'failed');
  }

  const setScore = (criterion: Criterion, value: string) => {
    setState('idle');
    setScores((current) => {
      const next = { ...current };
      if (value === '') delete next[criterion];
      else next[criterion] = Number(value);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body-sm text-muted">{t('writing.selfIntro')}</p>

      <section aria-labelledby={`${formId}-form`} className="flex flex-col gap-3">
        <PanelTitle id={`${formId}-form`} className="text-body-lg font-medium">
          {t('writing.formTitle')}
        </PanelTitle>
        <ul className="flex flex-col gap-2">
          {review.checks.map((check) => {
            const Icon = check.ok ? CircleCheck : TriangleAlert;
            return (
              <li key={check.id} className="flex items-start gap-2 text-body-sm">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    check.ok ? 'text-success' : 'text-warning',
                  )}
                  strokeWidth={2}
                />
                <span>
                  <span className="sr-only">
                    {t(check.ok ? 'writing.checkOk' : 'writing.checkWarn')}:{' '}
                  </span>
                  {describeCheck(t, check)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby={`${formId}-hints`} className="flex flex-col gap-3">
        <PanelTitle id={`${formId}-hints`} className="text-body-lg font-medium">
          {t('writing.hintsTitle')}
        </PanelTitle>
        {errors.length === 0 ? (
          <p className="text-body-sm text-muted">{t('writing.noHints')}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {errors.map((hint, index) => (
              <HintItem
                key={`${hint.rule}-${hint.start}`}
                hint={hint}
                number={index + 1}
                ficha={fichas[hint.grammar_ref]}
              />
            ))}
          </ol>
        )}
      </section>

      {toCheck.length > 0 ? (
        <section aria-labelledby={`${formId}-checks`} className="flex flex-col gap-3">
          <PanelTitle id={`${formId}-checks`} className="text-body-lg font-medium">
            {t('writing.checksTitle')}
          </PanelTitle>
          <ul className="flex flex-col gap-4">
            {toCheck.map((hint) => (
              <HintItem
                key={`${hint.rule}-${hint.start}`}
                hint={hint}
                ficha={fichas[hint.grammar_ref]}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby={`${formId}-self`} className="flex flex-col gap-4">
        <PanelTitle id={`${formId}-self`} className="text-body-lg font-medium">
          {t('writing.selfScoreTitle')}
        </PanelTitle>

        {points.length > 0 ? (
          <fieldset className="flex flex-col gap-1">
            <legend className="text-body-sm font-medium">{t('writing.pointsCheckTitle')}</legend>
            <p className="mb-1 text-caption text-muted">{t('writing.pointsCheckHint')}</p>
            {points.map((point, index) => (
              <label
                key={point}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-card px-2 py-2 hover:bg-surface-2"
              >
                <input
                  type="checkbox"
                  checked={covered[index] ?? false}
                  onChange={(event) => {
                    setState('idle');
                    setCovered((current) =>
                      current.map((value, i) => (i === index ? event.target.checked : value)),
                    );
                  }}
                  className="mt-1 size-4 shrink-0 accent-accent"
                />
                <span lang={lang} className="text-body-sm">
                  {point}
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <p className="text-body-sm text-muted">{t('writing.selfScoreHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {CRITERIA.map((criterion) => (
            <div key={criterion} className="flex flex-col gap-1">
              <Label htmlFor={`${formId}-${criterion}`}>{t(`writing.criteria.${criterion}`)}</Label>
              <Select
                id={`${formId}-${criterion}`}
                value={scores[criterion] ?? ''}
                onChange={(event) => setScore(criterion, event.target.value)}
              >
                <option value="">—</option>
                {SCORE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <span className="text-caption text-muted">
                {t(`writing.criteriaHelp.${criterion}`)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={state === 'saving'} onClick={() => void save()}>
            {state === 'saving' ? t('common.saving') : t('writing.saveAssessment')}
          </Button>
          <p role="status" className="text-body-sm">
            {state === 'saved' ? (
              <span className="text-success">{t('writing.assessmentSaved')}</span>
            ) : state === 'failed' ? (
              <span className="text-error">{t('errors.saveFailed')}</span>
            ) : null}
          </p>
        </div>
      </section>
    </div>
  );
}
