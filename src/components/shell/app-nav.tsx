'use client';

import { Ellipsis, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useState, type ReactNode } from 'react';
import { signOut } from '@/features/auth/server/actions';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath } from './nav-items';

const ICON_STROKE = 1.75;

function SignOutButton({ className }: { className?: string }) {
  const t = useT();
  return (
    <form action={signOut}>
      <button type="submit" className={cn('nav-link w-full', className)}>
        <LogOut aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        {t('nav.signOut')}
      </button>
    </form>
  );
}

const tabClasses =
  'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-caption leading-none transition-colors duration-150';

/** «Más»: el resto de secciones y cerrar sesión. Hoja inferior en móvil y panel en escritorio. */
function MoreMenu({
  triggerClassName,
  active,
  children,
}: {
  triggerClassName: string;
  active: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-active={active}
        className={cn(triggerClassName, active ? 'font-medium text-accent-text' : 'text-muted')}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-canvas/70" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-card bg-surface-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:top-18 md:right-8 md:bottom-auto md:w-80 md:rounded-card md:pb-4"
        >
          <Dialog.Title className="px-4 pb-2 font-sans text-caption font-normal text-muted">
            {t('nav.moreTitle')}
          </Dialog.Title>
          <ul className="flex flex-col gap-1">
            {SECONDARY_NAV.map((item) => {
              const isActive = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className="nav-link w-full text-body aria-[current=page]:bg-surface"
                  >
                    <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-border pt-2">
            <SignOutButton className="text-body" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Cabecera de escritorio: logotipo, secciones y «Más». Translúcida al hacer scroll (MASTER §8). */
export function TopNav({ signal }: { signal: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const moreActive = SECONDARY_NAV.some((item) => isActivePath(pathname, item.href));
  return (
    <header className="sticky top-0 z-20 hidden h-18 items-center justify-between gap-4 bg-canvas/90 px-8 backdrop-blur md:flex">
      {/* La presentación es un fichero estático: enlace normal, no una ruta de la app. */}
      <a href="/landing/index.html" aria-label={t('app.name')} className="rounded-structure">
        <Logo />
      </a>
      <nav aria-label={t('nav.main')}>
        <ul className="flex items-center gap-1">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                className="nav-link"
              >
                {t(item.label)}
              </Link>
            </li>
          ))}
          <li>
            <MoreMenu active={moreActive} triggerClassName="nav-link">
              {t('nav.more')}
            </MoreMenu>
          </li>
        </ul>
      </nav>
      {signal}
    </header>
  );
}

/** Barra inferior (móvil): Hoy · Escuchar · Leer · Repasar · Más. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const moreActive = SECONDARY_NAV.some((item) => isActivePath(pathname, item.href));

  return (
    <nav
      aria-label={t('nav.main')}
      // El aviso de cookies se coloca por encima de esta barra (globals.css, `.cookie-banner`).
      data-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-2 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-16 items-stretch">
        {PRIMARY_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(tabClasses, active ? 'font-medium text-accent-text' : 'text-muted')}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
                <span className="truncate">{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <MoreMenu active={moreActive} triggerClassName={tabClasses}>
            <Ellipsis aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
            <span className="truncate">{t('nav.more')}</span>
          </MoreMenu>
        </li>
      </ul>
    </nav>
  );
}
