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
      <button
        type="submit"
        className={cn(
          'flex h-11 w-full items-center gap-3 rounded-control px-3 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text',
          className,
        )}
      >
        <LogOut aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
        {t('nav.signOut')}
      </button>
    </form>
  );
}

const tabClasses =
  'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none transition-colors duration-150';

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
        className={cn(triggerClassName, active ? 'font-medium text-accent' : 'text-muted')}
      >
        {children}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-panel border-t border-border-strong bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:inset-x-auto md:top-20 md:right-8 md:bottom-auto md:w-80 md:rounded-panel md:border md:pb-4"
        >
          <Dialog.Title className="px-3 pb-2 text-xs font-medium tracking-widest text-muted uppercase">
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
                    className={cn(
                      'flex h-12 items-center gap-3 rounded-full px-4 text-base',
                      isActive ? 'bg-surface-2 font-medium text-accent' : 'text-text',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 border-t border-border pt-2">
            <SignOutButton className="h-12 text-base" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Cabecera de escritorio, como la de la presentación: logotipo, secciones y «Más». */
export function TopNav({ signal }: { signal: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const moreActive = SECONDARY_NAV.some((item) => isActivePath(pathname, item.href));
  return (
    <header className="sticky top-0 z-20 hidden h-20 items-center justify-between gap-4 bg-bg px-8 md:flex">
      <Link href="/hoy" aria-label={t('app.name')} className="rounded-full">
        <Logo />
      </Link>
      <nav aria-label={t('nav.main')}>
        <ul className="flex items-center gap-1">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActivePath(pathname, item.href) ? 'page' : undefined}
                className="block rounded-full px-4 py-2 text-base underline-offset-8 hover:underline aria-[current=page]:underline"
              >
                {t(item.label)}
              </Link>
            </li>
          ))}
          <li>
            <MoreMenu
              active={moreActive}
              triggerClassName="inline-flex items-center gap-2 rounded-full px-4 py-2 text-base underline-offset-8 hover:underline"
            >
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
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
                className={cn(tabClasses, active ? 'font-medium text-accent' : 'text-muted')}
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
