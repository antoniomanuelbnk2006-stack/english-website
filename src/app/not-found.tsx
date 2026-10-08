import { Compass } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/page';
import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState
        icon={Compass}
        title={t('errors.notFoundTitle')}
        action={
          <Link href="/hoy" className={buttonVariants()}>
            {t('errors.goHome')}
          </Link>
        }
      >
        {t('errors.notFoundBody')}
      </EmptyState>
    </main>
  );
}
