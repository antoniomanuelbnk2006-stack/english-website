import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Panel tipo HUD: la elevación se marca con borde y luminosidad, no con sombra. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('rounded-panel border border-border bg-surface p-4 sm:p-5', className)}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-xs font-medium tracking-widest text-muted uppercase', className)}
      {...props}
    />
  );
}

/** Etiqueta redondeada para metadatos (nivel, acento, duración…). */
export function Chip({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border border-border bg-surface-2 px-2.5 text-xs text-muted',
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-control bg-surface-2', className)}
      {...props}
    />
  );
}
