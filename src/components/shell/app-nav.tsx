'use client';

import { Ellipsis, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { signOut } from '@/features/auth/server/actions';
import { useT } from '@/lib/i18n/client';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV, SECONDARY_NAV, isActivePath, type NavItem } from './nav-items';

const ICON_STROKE = 1.75;

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useT();
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center gap-3 rounded-control px-3 text-sm transition-colors duration-150',
        active
          ? 'bg-surface-2 font-medium text-accent'
          : 'text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      <Icon aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
      {t(item.label)}
    </Link>
  );
}

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

/** Barra lateral (escritorio): todas las secciones. */
export function SidebarNav() {
  const t = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={t('nav.main')} className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <ul className="flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} active={isActivePath(pathname, item.href)} />
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1 border-t border-border pt-4">
        {SECONDARY_NAV.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} active={isActivePath(pathname, item.href)} />
          </li>
        ))}
      </ul>
      <div className="mt-auto border-t border-border pt-4">
        <SignOutButton />
      </div>
    </nav>
  );
}

const tabClasses =
  'flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none transition-colors duration-150';

/** Barra inferior (móvil): Hoy · Escuchar · Leer · Repasar · Más. */
export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
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
          <Dialog.Root open={moreOpen} onOpenChange={setMoreOpen}>
            <Dialog.Trigger
              className={cn(tabClasses, moreActive ? 'font-medium text-accent' : 'text-muted')}
            >
              <Ellipsis aria-hidden="true" className="size-5" strokeWidth={ICON_STROKE} />
              <span className="truncate">{t('nav.more')}</span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-bg/70" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-panel border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
              >
                <Dialog.Title className="px-3 pb-2 text-xs font-medium tracking-widest text-muted uppercase">
                  {t('nav.moreTitle')}
                </Dialog.Title>
                <ul className="flex flex-col gap-1">
                  {SECONDARY_NAV.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            'flex h-12 items-center gap-3 rounded-control px-3 text-base',
                            active ? 'bg-surface-2 font-medium text-accent' : 'text-text',
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
        </li>
      </ul>
    </nav>
  );
}
