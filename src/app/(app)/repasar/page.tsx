import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { ReviewSession } from '@/features/srs/components/review-session';
import { getReviewSession } from '@/features/srs/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { env } from '@/lib/env';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.review') };
}

export default async function ReviewPage() {
  await getSessionOrRedirect();
  const [t, session] = await Promise.all([getT(), getReviewSession()]);
  return (
    <PageContainer className="max-w-2xl">
      <PageHeader title={t('nav.review')} subtitle={t('review.subtitle')} />
      <ReviewSession session={session} audioBase={env.NEXT_PUBLIC_AUDIO_BASE_URL} />
    </PageContainer>
  );
}
