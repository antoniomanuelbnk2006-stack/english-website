import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Tarjeta: la superficie de contenido de MASTER (`.card`). La elevación es el salto de fondo. */
export function Panel({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('card', className)} {...props} />;
}

/** Título de una tarjeta o de una sección: el subtítulo de MASTER (21 px, Archivo). */
export function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-subheading', className)} {...props} />;
}

/**
 * Rótulo de un bloque dentro de una tarjeta que ya tiene título (o que agrupa varios bloques):
 * sigue siendo un encabezado, pero con el tamaño de una etiqueta.
 */
export function PanelLabel({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('font-sans text-body-sm font-medium text-muted', className)} {...props} />
  );
}

/** Etiqueta para metadatos (nivel, acento, duración…): el `.tag` de MASTER. */
export function Chip({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('tag', className)} {...props} />;
}

/** Placeholder de carga estable: mismo tamaño que el contenido final y sin parpadeo. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('skeleton', className)} {...props} />;
}
