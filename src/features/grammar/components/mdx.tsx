import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Cómo se pinta el cuerpo MDX de una ficha de gramática. Por convención, en las fichas todo
// el inglés va en cursiva: por eso `em` lleva `lang="en"` (y la negrita de dentro lo hereda).

export const fichaComponents = (tableLabel: string) => ({
  h2: ({ className, ...props }: ComponentProps<'h2'>) => (
    <h2
      className={cn(
        'mt-8 mb-3 text-xs font-medium tracking-widest text-muted uppercase first:mt-0',
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }: ComponentProps<'p'>) => (
    <p className={cn('my-3 leading-relaxed', className)} {...props} />
  ),
  ul: ({ className, ...props }: ComponentProps<'ul'>) => (
    <ul className={cn('my-3 flex list-disc flex-col gap-1.5 pl-5', className)} {...props} />
  ),
  ol: ({ className, ...props }: ComponentProps<'ol'>) => (
    <ol className={cn('my-3 flex list-decimal flex-col gap-1.5 pl-5', className)} {...props} />
  ),
  li: ({ className, ...props }: ComponentProps<'li'>) => (
    <li className={cn('leading-relaxed', className)} {...props} />
  ),
  em: ({ className, ...props }: ComponentProps<'em'>) => (
    <em lang="en" className={cn('font-reading text-[1.05em]', className)} {...props} />
  ),
  strong: ({ className, ...props }: ComponentProps<'strong'>) => (
    <strong className={cn('font-semibold text-accent', className)} {...props} />
  ),
  table: ({ className, ...props }: ComponentProps<'table'>) => (
    // Las tablas anchas se desplazan dentro de su caja, no la página entera.
    <div
      role="region"
      aria-label={tableLabel}
      tabIndex={0}
      className="my-4 overflow-x-auto rounded-control border border-border"
    >
      <table className={cn('w-full min-w-[30rem] text-left text-sm', className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }: ComponentProps<'th'>) => (
    <th
      className={cn('border-b border-border bg-surface-2 px-3 py-2 font-medium', className)}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentProps<'td'>) => (
    <td className={cn('border-b border-border px-3 py-2 align-top', className)} {...props} />
  ),
});
