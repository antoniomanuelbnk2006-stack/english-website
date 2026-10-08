'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer } from '@/components/ui/page';
import { signOut } from '@/features/auth/server/actions';
import { useT } from '@/lib/i18n/client';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <EmptyState
        icon={TriangleAlert}
        title={t('errors.title')}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={reset}>{t('common.retry')}</Button>
            {/* Si lo que falla es la sesión, reintentar no arregla nada: hace falta salir. */}
            <form action={signOut}>
              <Button type="submit" variant="secondary">
                {t('nav.signOut')}
              </Button>
            </form>
          </div>
        }
      >
        <p>{t('errors.body')}</p>
        <p className="mt-1">{t('errors.signOutHint')}</p>
      </EmptyState>
    </PageContainer>
  );
}
