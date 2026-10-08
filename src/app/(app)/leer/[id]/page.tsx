import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { getProfile } from '@/features/profile/server/queries';
import { ReadingLesson } from '@/features/reading/components/reading-lesson';
import { findLessonMeta, unitTitle } from '@/lib/content/index';
import { loadReadingLesson } from '@/lib/content/loader';

export async function generateMetadata({ params }: PageProps<'/leer/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findLessonMeta(id)?.title };
}

export default async function ReadingLessonPage({ params }: PageProps<'/leer/[id]'>) {
  const { id } = await params;
  const lesson = await loadReadingLesson(id);
  if (!lesson) notFound();

  const [profile, progress] = await Promise.all([getProfile(), getLessonProgress(id)]);

  return (
    <ReadingLesson
      lesson={lesson}
      unitTitle={unitTitle(lesson.unit)}
      initialPhase={progress?.status === 'started' ? progress.phase : 0}
      previous={
        progress?.status === 'completed'
          ? { score: progress.score, version: progress.lessonVersion }
          : null
      }
      fontPx={profile.settings.reading_font_px}
      paper={profile.settings.reader_paper}
    />
  );
}
