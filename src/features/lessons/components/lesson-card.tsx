import { Circle, CircleCheck, CircleDashed, type LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Chip } from '@/components/ui/panel';
import type { LessonStatus } from '@/features/lessons/lib/library';
import { formatClock, toPercent } from '@/features/lessons/lib/summary';
import type { LessonMeta } from '@/lib/content/index';
import type { Translate, TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const STATUS: Record<LessonStatus, { icon: LucideIcon; label: TranslationKey; className: string }> =
  {
    new: { icon: Circle, label: 'lesson.statusNew', className: 'text-muted' },
    started: { icon: CircleDashed, label: 'lesson.statusStarted', className: 'text-warning' },
    done: { icon: CircleCheck, label: 'lesson.statusDone', className: 'text-success' },
  };

/** Tarjeta de una lección en la biblioteca. */
export function LessonCard({
  lesson,
  href,
  status,
  bestScore,
  coverage,
  t,
}: {
  lesson: LessonMeta;
  href: Route;
  status: LessonStatus;
  bestScore: number | null;
  /** Cobertura léxica para el usuario, de 0 a 1. */
  coverage: number | null;
  t: Translate;
}) {
  const { icon: StatusIcon, label, className } = STATUS[status];

  return (
    <Link
      href={href}
      className="flex h-full flex-col gap-3 rounded-panel border border-border bg-surface p-4 transition-colors duration-150 hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 lang="en" className="text-lg leading-snug font-medium">
          {lesson.title}
        </h3>
        <span className={cn('flex shrink-0 items-center gap-1.5 text-xs', className)}>
          <StatusIcon aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {t(label)}
        </span>
      </div>

      <p className="text-sm text-muted">{lesson.summary_es}</p>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Chip className="hud">{lesson.level}</Chip>
        <Chip>{t(`genres.${lesson.genre}` as TranslationKey)}</Chip>
        {lesson.skill === 'listening' && lesson.duration_s !== undefined ? (
          <Chip className="hud">{formatClock(lesson.duration_s * 1000)}</Chip>
        ) : (
          <Chip className="hud">{t('lesson.words', { n: lesson.word_count })}</Chip>
        )}
        {lesson.skill === 'listening' && lesson.wpm !== undefined ? (
          <Chip className="hud">{t('lesson.wpm', { n: Math.round(lesson.wpm) })}</Chip>
        ) : null}
        {lesson.accents.map((accent) => (
          <Chip key={accent} className="hud">
            {accent}
          </Chip>
        ))}
        <Chip className="hud">{t('lesson.minutes', { n: lesson.est_minutes })}</Chip>
        {coverage !== null ? (
          <Chip className="hud border-accent text-text">
            {t('lesson.coverage', { pct: Math.floor(coverage * 100) })}
          </Chip>
        ) : null}
      </div>

      {bestScore !== null ? (
        <p className="hud text-xs text-muted">
          {t('lesson.bestScore', { pct: toPercent(bestScore) })}
        </p>
      ) : null}
    </Link>
  );
}
