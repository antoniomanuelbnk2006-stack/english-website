import { TrendingUp } from 'lucide-react';
import { SignalBars } from '@/features/level/components/signal-bars';
import { isLowConfidence, progressInBand, summarizeRating } from '@/features/level/lib/bands';
import type { SkillRating } from '@/features/level/server/queries';
import { daysBetween, todayMadrid } from '@/lib/dates';
import type { Translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Texto accesible del nivel: «Listening: B1, 63 % hacia B2». */
export function levelLabel(t: Translate, rating: SkillRating): string {
  const { level, next, percent } = summarizeRating(rating.rating);
  const skill = t(`skills.${rating.skill}`);
  return next
    ? t('level.signalLabel', { skill, level, pct: percent, next })
    : t('level.signalLabelTop', { skill, level });
}

/** Fila de nivel por destreza: barras de señal, nivel estimado y progreso hacia el siguiente. */
export function LevelMeter({ rating, t }: { rating: SkillRating; t: Translate }) {
  const { level, next, percent } = summarizeRating(rating.rating);
  const daysSince = rating.updatedAt
    ? daysBetween(todayMadrid(new Date(rating.updatedAt)), todayMadrid())
    : null;
  const lowConfidence = isLowConfidence(rating.itemsCount, daysSince);

  return (
    <div className="flex items-center gap-4">
      <SignalBars
        level={level}
        progress={progressInBand(rating.rating)}
        confirmed={rating.confirmedLevel}
        label={levelLabel(t, rating)}
        size="lg"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{t(`skills.${rating.skill}`)}</span>
          <span
            className={cn('tabular-nums text-body-sm', lowConfidence ? 'text-muted' : 'text-text')}
          >
            {level}
            {next ? (
              <span className="text-muted"> · {t('level.towards', { pct: percent, next })}</span>
            ) : null}
          </span>
        </div>
        <div className="progress mt-2" aria-hidden="true">
          <div
            className={cn(lowConfidence && 'bg-accent/45')}
            style={{ width: `${next ? percent : 100}%` }}
          />
        </div>
        {lowConfidence ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-caption text-muted">
            <TrendingUp aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
            {t('level.lowConfidence')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
