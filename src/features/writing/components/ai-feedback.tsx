'use client';

import { ArrowRight, Target } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { InlineText } from '@/components/ui/inline-text';
import { Chip, PanelTitle } from '@/components/ui/panel';
import { ScoreBars } from '@/features/writing/components/score-bars';
import type { Level, WritingFeedback } from '@/features/writing/lib/schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

/** La corrección de la IA: valoración, rúbrica, correcciones, mejoras y foco. */
export function AiFeedback({
  feedback,
  targetLevel,
  fichas,
}: {
  feedback: WritingFeedback;
  targetLevel: Level;
  /** Título de cada ficha de gramática, por id, para enlazar las correcciones. */
  fichas: Record<string, string>;
}) {
  const t = useT();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p>{feedback.overall_es}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip className="tabular-nums">
            {t('writing.estimatedLevel', { level: feedback.estimated_level })}
          </Chip>
          <Chip className="tabular-nums">{t('writing.targetLevel', { level: targetLevel })}</Chip>
        </div>
      </div>

      <section aria-labelledby="writing-scores" className="flex flex-col gap-3">
        <PanelTitle id="writing-scores">{t('writing.scoresTitle')}</PanelTitle>
        <ScoreBars scores={feedback.scores} />
      </section>

      <section aria-labelledby="writing-corrections" className="flex flex-col gap-3">
        <PanelTitle id="writing-corrections">{t('writing.correctionsTitle')}</PanelTitle>
        {feedback.corrections.length === 0 ? (
          <p className="text-body-sm text-muted">{t('writing.noCorrections')}</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {feedback.corrections.map((correction, index) => {
              const ficha = fichas[correction.grammar_ref];
              return (
                <li key={index} className="flex gap-3 text-body-sm">
                  <span aria-hidden="true" className="tabular-nums w-5 shrink-0 text-accent-text">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <p lang="en" className="flex flex-wrap items-baseline gap-x-2 text-body">
                      <del className="text-error">{correction.original}</del>
                      <ArrowRight aria-hidden="true" className="size-4 self-center text-muted" />
                      <ins className="font-medium text-success no-underline">
                        {correction.corrected}
                      </ins>
                    </p>
                    <p className="flex flex-wrap gap-1.5">
                      <Chip>{t(`writing.kinds.${correction.type}`)}</Chip>
                      <Chip className={cn(correction.severity === 'major' && 'text-warning')}>
                        {t(
                          correction.severity === 'major'
                            ? 'writing.severityMajor'
                            : 'writing.severityMinor',
                        )}
                      </Chip>
                    </p>
                    <p className="text-muted">
                      <InlineText text={correction.explanation_es} />
                    </p>
                    {ficha ? (
                      <Link
                        href={`/gramatica/${correction.grammar_ref}` as Route}
                        className="self-start text-accent-text underline underline-offset-4"
                      >
                        {t('writing.openFicha')}: <span lang="en">{ficha}</span>
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {feedback.corrections.length > 0 ? (
        <details className="rounded-card bg-surface-2 px-3 py-2">
          <summary className="cursor-pointer py-1 text-body-sm font-medium">
            {t('writing.correctedTitle')}
          </summary>
          <p lang="en" className="prose-reading mt-2 whitespace-pre-wrap">
            {feedback.corrected_text}
          </p>
        </details>
      ) : null}

      {feedback.upgrades.length > 0 ? (
        <section aria-labelledby="writing-upgrades" className="flex flex-col gap-3">
          <PanelTitle id="writing-upgrades">{t('writing.upgradesTitle')}</PanelTitle>
          <ul className="flex flex-col gap-3">
            {feedback.upgrades.map((upgrade, index) => (
              <li key={index} className="flex flex-col gap-1 text-body-sm">
                <p lang="en" className="flex flex-wrap items-baseline gap-x-2 text-body">
                  <span className="text-muted">{upgrade.from}</span>
                  <ArrowRight aria-hidden="true" className="size-4 self-center text-muted" />
                  <span className="font-medium text-accent-text">{upgrade.to}</span>
                </p>
                <p className="text-muted">
                  <InlineText text={upgrade.why_es} />
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feedback.focus_next_es ? (
        <section
          aria-labelledby="writing-focus"
          className="flex gap-3 rounded-card border border-accent p-3"
        >
          <Target
            aria-hidden="true"
            className="size-5 shrink-0 text-accent-text"
            strokeWidth={1.75}
          />
          <div className="flex flex-col gap-1">
            <PanelTitle id="writing-focus">{t('writing.focusTitle')}</PanelTitle>
            <p>
              <InlineText text={feedback.focus_next_es} />
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
