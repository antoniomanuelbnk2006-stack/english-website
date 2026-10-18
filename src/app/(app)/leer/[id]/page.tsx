import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { getLexiconSnapshot } from '@/features/lexicon/server/queries';
import { getProfile } from '@/features/profile/server/queries';
import { ReadingLesson } from '@/features/reading/components/reading-lesson';
import { getSessionOrRedirect } from '@/lib/auth';
import { fichasOfLesson } from '@/lib/content/grammar';
import { findLessonMeta, unitTitle } from '@/lib/content/index';
import { loadReadingLesson } from '@/lib/content/loader';
import { getLocale } from '@/lib/i18n/server';

export async function generateMetadata({ params }: PageProps<'/leer/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findLessonMeta(id)?.title };
}

export default async function ReadingLessonPage({ params }: PageProps<'/leer/[id]'>) {
  await getSessionOrRedirect();
  const { id } = await params;
  const lesson = await loadReadingLesson(id);
  if (!lesson) notFound();

  const [profile, progress, lexicon] = await Promise.all([
    getProfile(),
    getLessonProgress(id),
    getLexiconSnapshot(lesson),
  ]);

  return (
    <ReadingLesson
      lesson={lesson}
      unitTitle={unitTitle(lesson.unit, await getLocale())}
      initialPhase={progress?.status === 'started' ? progress.phase : 0}
      previous={
        progress?.status === 'completed'
          ? { score: progress.score, version: progress.lessonVersion }
          : null
      }
      fontPx={profile.settings.reading_font_px}
      paper={profile.settings.reader_paper}
      lexicon={lexicon}
      grammar={fichasOfLesson(lesson.id)}
    />
  );
}
