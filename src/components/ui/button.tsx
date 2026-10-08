import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Componentes base al estilo shadcn/ui (Radix + cva), adaptados a los tokens de Señal:
// aquí `accent` es el cian de la acción principal y `muted` un color de texto.
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-contrast hover:bg-accent-strong',
        secondary: 'border border-border bg-surface-2 text-text hover:border-subtle',
        ghost: 'text-muted hover:bg-surface-2 hover:text-text',
        outline: 'border border-accent text-accent hover:bg-karaoke',
        danger: 'border border-danger text-danger hover:bg-surface-2',
      },
      size: {
        // 44 px de alto por defecto: la app se usa en movimiento.
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        sm: 'h-9 px-3 pointer-coarse:h-11',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) return <Slot.Root className={classes} {...props} />;
  return <button type={type} className={classes} {...props} />;
}
