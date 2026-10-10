import type { Metadata } from 'next';
import { Logo } from '@/components/shell/logo';
import { LoginForm } from '@/features/auth/components/login-form';
import { LINK_ERROR } from '@/features/auth/lib/confirm';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('login.title') };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const [t, params] = await Promise.all([getT(), searchParams]);
  // Se llega con este aviso cuando el enlace del correo no ha servido (ADR-0018).
  const linkFailed = params.error === LINK_ERROR;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="hud text-xs tracking-widest text-muted uppercase">{t('app.tagline')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
          <p className="text-sm text-muted">{t('login.subtitle')}</p>
        </div>
        {linkFailed ? (
          <p role="alert" className="text-sm text-danger">
            {t('login.errorLink')}
          </p>
        ) : null}
        <LoginForm />
      </div>
    </main>
  );
}
