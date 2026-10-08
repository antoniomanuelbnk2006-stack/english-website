'use client';

import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer } from '@/components/ui/page';
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
        action={<Button onClick={reset}>{t('common.retry')}</Button>}
      >
        {t('errors.body')}
      </EmptyState>
    </PageContainer>
  );
}
