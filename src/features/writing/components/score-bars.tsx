'use client';

import { CRITERIA, MAX_SCORE, type Scores } from '@/features/writing/lib/schema';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';

const STEPS = Array.from({ length: MAX_SCORE }, (_, index) => index + 1);

/** Las cuatro notas de la rúbrica (0–5), con su nombre y lo que mira cada una. */
export function ScoreBars({ scores }: { scores: Scores }) {
  const t = useT();
  return (
    <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {CRITERIA.map((criterion) => (
        <li key={criterion} className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{t(`writing.criteria.${criterion}`)}</span>
            <span className="hud text-muted">
              {t('writing.scoreOf', { score: scores[criterion] })}
            </span>
          </span>
          <span aria-hidden="true" className="flex gap-1">
            {STEPS.map((step) => (
              <span
                key={step}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  step <= scores[criterion] ? 'bg-accent' : 'bg-border',
                )}
              />
            ))}
          </span>
          <span className="text-xs text-muted">{t(`writing.criteriaHelp.${criterion}`)}</span>
        </li>
      ))}
    </ul>
  );
}
