import Link from 'next/link';
import { BottomNav, SidebarNav } from '@/components/shell/app-nav';
import { Logo } from '@/components/shell/logo';
import { levelLabel } from '@/features/level/components/level-meter';
import { SignalBars } from '@/features/level/components/signal-bars';
import { progressInBand, summarizeRating } from '@/features/level/lib/bands';
import { getSkillRatings } from '@/features/level/server/queries';
import { getProfile } from '@/features/profile/server/queries';
import { getT } from '@/lib/i18n/server';

/** Shell autenticado: barra lateral en escritorio, cabecera y barra inferior en móvil. */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // getProfile comprueba la sesión (y crea el perfil si faltara) antes de pintar nada.
  const [t, , ratings] = await Promise.all([getT(), getProfile(), getSkillRatings()]);
  const listening = ratings.listening;
  const { level } = summarizeRating(listening.rating);

  const signal = (
    <span className="flex items-center gap-2">
      <SignalBars
        level={level}
        progress={progressInBand(listening.rating)}
        confirmed={listening.confirmedLevel}
        label={levelLabel(t, listening)}
        size="sm"
      />
      <span aria-hidden="true" className="hud text-sm text-muted">
        {level}
      </span>
    </span>
  );

  return (
    <div className="min-h-dvh md:pl-60">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-control bg-accent px-4 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('nav.skipToContent')}
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col gap-6 border-r border-border bg-surface p-4 md:flex">
        <Link href="/hoy" className="flex items-center justify-between rounded-control px-3 py-2">
          <Logo />
          {signal}
        </Link>
        <SidebarNav />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
        <Link href="/hoy" className="rounded-control">
          <Logo />
        </Link>
        {signal}
      </header>

      <main id="contenido" tabIndex={-1} className="pb-24 outline-none md:pb-8">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
