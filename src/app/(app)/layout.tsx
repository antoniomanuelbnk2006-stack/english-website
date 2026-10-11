import Link from 'next/link';
import { BottomNav, TopNav } from '@/components/shell/app-nav';
import { Logo } from '@/components/shell/logo';
import { SignalBars } from '@/features/level/components/signal-bars';
import { getProfile } from '@/features/profile/server/queries';
import { getT } from '@/lib/i18n/server';

/** Shell autenticado: cabecera superior en escritorio; cabecera y barra inferior en móvil. */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // getProfile comprueba la sesión (y crea el perfil si faltara) antes de pintar nada.
  const [t, profile] = await Promise.all([getT(), getProfile()]);
  // El nivel de la cabecera es el que se elige en /nivel; la estimación por destreza va en Hoy.
  const level = profile.declaredLevel;

  const signal = level ? (
    <span className="flex items-center gap-2">
      <SignalBars level={level} progress={0} label={t('level.chosenLabel', { level })} size="sm" />
      <span aria-hidden="true" className="hud text-sm text-muted">
        {level}
      </span>
    </span>
  ) : null;

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-control bg-accent px-4 py-2 text-accent-contrast focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('nav.skipToContent')}
      </a>

      <TopNav signal={signal} />

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
