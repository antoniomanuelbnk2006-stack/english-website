import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** El campo de MASTER (`.input`): píldora, o caja de 12 px si es de varias líneas. */
export const fieldClasses = 'input';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(fieldClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClasses, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(fieldClasses, className)} {...props} />;
}

/** Etiqueta visible del campo (nunca solo el placeholder). */
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('block text-body-sm font-medium text-text', className)} {...props} />;
}

/** Mensaje de error de un campo: se enlaza con `aria-describedby`. */
export function FieldError({ id, children }: { id: string; children?: string | null }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-body-sm text-error">
      {children}
    </p>
  );
}
