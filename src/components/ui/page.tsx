import type { LucideIcon } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Cabecera de pantalla: el título, una línea de contexto opcional y, a la derecha, las acciones. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="text-heading">{title}</h1>
        {subtitle ? <p className="mt-2 text-body text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

const WIDTH = {
  page: 'max-w-page',
  exercise: 'max-w-exercise',
} as const;

/**
 * Contenedor de pantalla (MASTER §4): `page` es el de 1.200 px y `exercise`, la columna centrada
 * de 680 px de las pantallas de ejercicio. Los bloques van a 32 px; las secciones de una página
 * de navegación, dentro de `PageSections`.
 */
export function PageContainer({
  width = 'page',
  className,
  children,
}: {
  width?: keyof typeof WIDTH;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full px-4 pt-8 pb-12 sm:px-6 lg:px-8 lg:pt-12 lg:pb-18">
      <div className={cn('mx-auto flex w-full flex-col gap-8', WIDTH[width], className)}>
        {children}
      </div>
    </div>
  );
}

/** Secciones de una página de navegación: 72 px entre una y la siguiente (MASTER §4). */
export function PageSections({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-18', className)} {...props} />;
}

/** Estado vacío: explica qué hacer y ofrece la acción (MASTER §7, «Contenido»). */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <Icon aria-hidden="true" className="size-5 text-muted" strokeWidth={1.75} />
      <h2 className="text-subheading">{title}</h2>
      {children ? <div className="max-w-md text-body-sm text-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
