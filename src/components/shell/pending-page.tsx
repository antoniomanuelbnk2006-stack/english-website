import { Hourglass } from 'lucide-react';
import { EmptyState, PageContainer, PageHeader } from '@/components/ui/page';
import type { TranslationKey } from '@/lib/i18n';
import { getT } from '@/lib/i18n/server';

/** Ruta del mapa cuya funcionalidad llega en una fase posterior del roadmap. */
export async function PendingPage({
  title,
  body,
  phase,
}: {
  title: TranslationKey;
  body: TranslationKey;
  phase: number;
}) {
  const t = await getT();
  return (
    <PageContainer>
      <PageHeader title={t(title)} />
      <EmptyState icon={Hourglass} title={t('pending.title')}>
        <p>{t(body)}</p>
        <p className="mt-1">{t('pending.phase', { n: phase })}</p>
      </EmptyState>
    </PageContainer>
  );
}
