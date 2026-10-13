import { Headphones } from 'lucide-react';
import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { LessonLibrary } from '@/features/lessons/components/lesson-library';
import { getSessionOrRedirect } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.listen') };
}

export default async function ListeningLibraryPage({ searchParams }: PageProps<'/escuchar'>) {
  await getSessionOrRedirect();
  const [t, params] = await Promise.all([getT(), searchParams]);
  return (
    <PageContainer>
      <PageHeader title={t('listening.title')} subtitle={t('listening.subtitle')} />
      <LessonLibrary
        skill="listening"
        basePath="/escuchar"
        searchParams={params}
        emptyIcon={Headphones}
        emptyBody="library.noListeningBody"
      />
    </PageContainer>
  );
}
