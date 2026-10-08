import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const fieldClasses =
  'w-full rounded-control border border-border bg-surface-2 px-3 text-base text-text placeholder:text-subtle transition-colors duration-150 hover:border-subtle disabled:opacity-50 aria-invalid:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldClasses, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClasses, 'min-h-24 py-2.5', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(fieldClasses, 'h-11 pr-8', className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('block text-sm font-medium text-text', className)} {...props} />;
}

/** Mensaje de error de un campo: se enlaza con `aria-describedby`. */
export function FieldError({ id, children }: { id: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}
