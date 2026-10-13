import type { Metadata } from 'next';
import { Logo } from '@/components/shell/logo';
import { LoginForm } from '@/features/auth/components/login-form';
import { LINK_ERROR } from '@/features/auth/lib/confirm';
import { env } from '@/lib/env';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('login.title') };
}

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const [t, params] = await Promise.all([getT(), searchParams]);
  // Se llega con este aviso cuando el enlace del correo no ha servido (ADR-0018).
  const linkFailed = params.error === LINK_ERROR;
  // Con código fijo (ADR-0020) lo principal es escribirlo; el correo queda como respaldo.
  const fixedCode = Boolean(env.LOGIN_CODE_PEPPER);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Logo className="self-start" />
          <p className="text-body-sm text-muted">{t('app.tagline')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-heading-sm">{t('login.title')}</h1>
          <p className="text-body-sm text-muted">
            {t(fixedCode ? 'login.subtitleFixedCode' : 'login.subtitle')}
          </p>
        </div>
        {linkFailed ? (
          <p role="alert" className="text-body-sm text-error">
            {t('login.errorLink')}
          </p>
        ) : null}
        <LoginForm fixedCode={fixedCode} />
      </div>
    </main>
  );
}
