import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Botones de Señal (design-system/senal/MASTER.md §5). El aspecto sale de las clases `.btn` de
// globals.css; aquí solo se elige cuál:
//   primary    acción principal, cobalto. Una por pantalla.
//   secondary  acción secundaria, rellena en surface-2.
//   ghost      acción terciaria, con el borde fino.
//   danger     terciaria que borra o descarta: borde y texto de error, nunca relleno.
// `outline` se conserva por compatibilidad con lo que ya lo usaba: es una secundaria.

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'md' | 'lg' | 'sm' | 'icon';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  outline: 'btn-secondary',
  danger: 'btn-ghost border-error text-error',
};

const SIZE: Record<Size, string> = {
  // 44 px de alto por defecto: la app se usa en movimiento.
  md: '',
  lg: 'min-h-12 px-7 text-body',
  // Más bajo solo con ratón; en táctil vuelve a los 44 px.
  sm: 'min-h-9 px-4 pointer-coarse:min-h-11',
  icon: 'size-11 p-0',
};

export interface ButtonVariantProps {
  variant?: Variant | null;
  size?: Size | null;
}

export function buttonVariants({ variant, size }: ButtonVariantProps = {}): string {
  const v = variant ?? 'primary';
  const s = size ?? 'md';
  // Solo icono y sin relleno: el botón de icono de MASTER, de 44 × 44.
  if (s === 'icon' && v === 'ghost') return 'btn-icon';
  return cn('btn', VARIANT[v], SIZE[s]);
}

export type ButtonProps = ComponentProps<'button'> & ButtonVariantProps & { asChild?: boolean };

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
