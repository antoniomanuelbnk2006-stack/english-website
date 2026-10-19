import type { Metadata } from 'next';
import { ContentLanguage } from '@/components/content-language';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { ReviewSession } from '@/features/srs/components/review-session';
import { getPracticeLanguage } from '@/features/profile/server/queries';
import { getReviewSession } from '@/features/srs/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { env } from '@/lib/env';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.review') };
}

export default async function ReviewPage() {
  await getSessionOrRedirect();
  const [t, session, language] = await Promise.all([
    getT(),
    getReviewSession(),
    getPracticeLanguage(),
  ]);
  return (
    <PageContainer width="exercise">
      <PageHeader title={t('nav.review')} subtitle={t('review.subtitle')} />
      {/* Las tarjetas son del idioma que se practica: sus textos llevan su `lang`. */}
      <ContentLanguage language={language}>
        <ReviewSession session={session} audioBase={env.NEXT_PUBLIC_AUDIO_BASE_URL} />
      </ContentLanguage>
    </PageContainer>
  );
}
