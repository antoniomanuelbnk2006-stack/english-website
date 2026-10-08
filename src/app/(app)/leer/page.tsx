import { BookOpen } from 'lucide-react';
import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { LessonLibrary } from '@/features/lessons/components/lesson-library';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.read') };
}

export default async function ReadingLibraryPage({ searchParams }: PageProps<'/leer'>) {
  const [t, params] = await Promise.all([getT(), searchParams]);
  return (
    <PageContainer>
      <PageHeader title={t('reading.title')} subtitle={t('reading.subtitle')} />
      <LessonLibrary
        skill="reading"
        basePath="/leer"
        searchParams={params}
        emptyIcon={BookOpen}
        emptyBody="library.noReadingBody"
      />
    </PageContainer>
  );
}
